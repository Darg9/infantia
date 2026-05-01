import { getErrorMessage } from '../src/lib/error';
/**
 * backfill-images.ts
 * Extrae og:image (o primera imagen relevante) de sourceUrl de cada actividad
 * que no tenga imageUrl y actualiza la BD.
 *
 * Uso:
 *   npx tsx scripts/backfill-images.ts
 *   npx tsx scripts/backfill-images.ts --dry-run   (muestra qué haría, sin actualizar)
 *   npx tsx scripts/backfill-images.ts --limit 50  (limita a 50 actividades)
 */

import 'dotenv/config';
import * as cheerio from 'cheerio';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => {
  const idx = process.argv.indexOf('--limit');
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : 500;
})();

// Dominios que requieren TLS relajado
const RELAXED_TLS = ['jbb.gov.co', 'cinematecadebogota.gov.co', 'planetariodebogota.gov.co'];

async function fetchWithTls(url: string): Promise<Response> {
  try {
    const { hostname } = new URL(url);
    if (RELAXED_TLS.some((d) => hostname.endsWith(d))) {
      const { Agent } = await import('undici');
      const dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
      // @ts-ignore
      return fetch(url, { signal: AbortSignal.timeout(10_000), dispatcher });
    }
  } catch { /* URL inválida */ }
  return fetch(url, { signal: AbortSignal.timeout(10_000) });
}

async function extractOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTls(url);
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    // Preferencia: og:image → twitter:image → primera img significativa
    const ogImage =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[property="og:image:url"]').attr('content');

    if (ogImage) {
      // Resolver URLs relativas
      try {
        const resolved = new URL(ogImage, url).href;
        // Descartar imágenes de placeholder/logo conocidas
        const lower = resolved.toLowerCase();
        if (lower.includes('blanco') || lower.includes('logobogota') || lower.includes('placeholder')) {
          return null;
        }
        return resolved;
      } catch {
        return null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`\n🖼️  Backfill de imágenes — ${DRY_RUN ? 'DRY RUN' : 'modo real'}`);
  console.log(`   Límite: ${LIMIT} actividades\n`);

  const activities = await prisma.activity.findMany({
    where: { imageUrl: null, sourceUrl: { not: null } },
    select: { id: true, title: true, sourceUrl: true },
    take: LIMIT,
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📋 Actividades sin imagen: ${activities.length}\n`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];
    if (!act.sourceUrl) { notFound++; continue; }

    process.stdout.write(`[${i + 1}/${activities.length}] ${act.title.slice(0, 60)}... `);

    const imageUrl = await extractOgImage(act.sourceUrl);

    if (!imageUrl) {
      process.stdout.write('❌ sin imagen\n');
      notFound++;
    } else {
      process.stdout.write(`✅ ${imageUrl.slice(0, 70)}\n`);
      if (!DRY_RUN) {
        try {
          await prisma.activity.update({
            where: { id: act.id },
            data: { imageUrl },
          });
          updated++;
        } catch (e: unknown) {
          process.stdout.write(`  ⚠️  Error al guardar: ${getErrorMessage(e)}\n`);
          errors++;
        }
      } else {
        updated++;
      }
    }

    // Rate limiting: 200ms entre requests (5 req/s máx)
    if (i < activities.length - 1) await sleep(200);
  }

  console.log(`\n📊 Resultado:`);
  console.log(`   ✅ Con imagen: ${updated}`);
  console.log(`   ❌ Sin imagen: ${notFound}`);
  if (errors > 0) console.log(`   ⚠️  Errores BD: ${errors}`);
  if (DRY_RUN) console.log(`\n   (dry-run: no se actualizó nada en la BD)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
