/**
 * clean-baseline.ts — elimina outliers pre-threshold de fuentes problemáticas.
 *
 * Criterio conservador:
 *   - sourceDomain conocido como ruidoso
 *   - confidenceScore < 0.5 (pre-threshold diferenciado)
 *   - título coincide con blacklist institucional
 *
 * Uso:
 *   npx tsx scripts/clean-baseline.ts [--dry-run]
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');

// Dominios a revisar (fuentes donde el fallback metió ruido antes del threshold)
const NOISY_DOMAINS = ['maloka.org'];

// Blacklist normalizada (sin tildes, minúsculas) — misma lógica que fallback-mapper.ts
const NON_EVENT_PATTERNS = [
  'tratamiento de datos',
  'como llegar',
  'cómo llegar',
  'trabaja con nosotros',
  'sala de prensa',
  'politica',
  'política',
  'terminos',
  'términos',
  'preguntas frecuentes',
  'pqrs',
  'quienes somos',
  'quiénes somos',
  'contactenos',
  'contáctenos',
  'compra tu entrada',
  'nuestros servicios',
];

async function main() {
  console.log(`\n=== Limpieza de baseline ${DRY_RUN ? '(DRY-RUN)' : '(REAL)'} ===\n`);

  for (const domain of NOISY_DOMAINS) {
    // Fetch candidatas con baja confianza del dominio
    const candidates = await prisma.activity.findMany({
      where: {
        sourceDomain: domain,
        sourceConfidence: { lt: 0.5 },
      },
      select: { id: true, title: true, sourceConfidence: true, sourceUrl: true },
    });

    console.log(`${domain}: ${candidates.length} actividades con confidence < 0.5`);

    const toDelete = candidates.filter((act) => {
      const title = (act.title ?? '').toLowerCase()
        .normalize('NFD').replace(/\p{Diacritic}/gu, '');  // NFD igual que fallback-mapper
      return NON_EVENT_PATTERNS.some((p) => title.includes(
        p.normalize('NFD').replace(/\p{Diacritic}/gu, '')
      ));
    });

    if (toDelete.length === 0) {
      console.log(`  → No hay registros que coincidan con el blacklist.\n`);
      continue;
    }

    console.log(`  Candidatas para eliminar: ${toDelete.length}`);
    for (const act of toDelete) {
      console.log(`  ✗ "${act.title}" (score=${act.sourceConfidence}, url=${act.sourceUrl})`);
    }

    if (!DRY_RUN) {
      await prisma.activity.deleteMany({
        where: { id: { in: toDelete.map((a) => a.id) } },
      });
      console.log(`  ✅ ${toDelete.length} eliminadas.\n`);
    } else {
      console.log(`  [DRY-RUN] Se eliminarían ${toDelete.length} registros.\n`);
    }
  }

  // Resumen post-limpieza
  const [totalActive, totalExpired] = await Promise.all([
    prisma.activity.count({ where: { status: 'ACTIVE' } }),
    prisma.activity.count({ where: { status: 'EXPIRED' } }),
  ]);
  console.log(`\n=== Estado BD post-limpieza ===`);
  console.log(`  ACTIVE:  ${totalActive}`);
  console.log(`  EXPIRED: ${totalExpired}`);
  console.log(`  TOTAL:   ${totalActive + totalExpired}`);

  await prisma.$disconnect();
}

main().catch(console.error);
