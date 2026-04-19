/**
 * clean-baseline.ts — elimina outliers pre-threshold de fuentes problemáticas.
 *
 * Criterio conservador:
 *   - sourceDomain conocido como ruidoso (o sourceUrl contiene el dominio si sourceDomain=NULL)
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

// ── Fuentes ruidosas ────────────────────────────────────────────────────────
// Cada entrada: dominio (para actividades con sourceDomain set) +
// patrón de URL (para actividades pre-fix con sourceDomain=NULL)
const NOISY_SOURCES = [
  { domain: 'maloka.org', urlPattern: 'maloka' },
];

// ── Blacklist institucional ─────────────────────────────────────────────────
// Misma lógica NFD que fallback-mapper.ts, más patrones específicos de Maloka.
const NON_EVENT_PATTERNS = [
  // Global (sincronizado con fallback-mapper.ts)
  'tratamiento de datos',
  'como llegar',
  'trabaja con nosotros',
  'sala de prensa',
  'politica',
  'terminos',
  'preguntas frecuentes',
  'pqrs',
  'quienes somos',
  'contactenos',
  'compra tu entrada',
  'nuestros servicios',
  // Páginas institucionales adicionales (horarios/tarifas, cotizaciones, about…)
  'horarios, tarifas',
  'tarifas y precios',
  'cotizaciones y grupos',
  'resolvemos aqui todas tus dudas',
  'museo interactivo en bogota, colombia',   // homepage title pattern
  'acerca de -',                              // "Acerca de - [Sitio]"
];

function normalizeText(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function isNonEvent(title: string): boolean {
  const t = normalizeText(title);
  return NON_EVENT_PATTERNS.some((p) => t.includes(normalizeText(p)));
}

async function main() {
  console.log(`\n=== Limpieza de baseline ${DRY_RUN ? '(DRY-RUN)' : '(REAL)'} ===\n`);

  for (const source of NOISY_SOURCES) {
    // Fetch candidatas con baja confianza — cubre tanto domain set como NULL (pre-fix)
    const candidates = await prisma.activity.findMany({
      where: {
        AND: [
          {
            OR: [
              { sourceDomain: source.domain },
              { AND: [{ sourceDomain: null }, { sourceUrl: { contains: source.urlPattern } }] },
            ],
          },
          { sourceConfidence: { lt: 0.5 } },
        ],
      },
      select: { id: true, title: true, sourceConfidence: true, sourceUrl: true },
    });

    console.log(`${source.domain}: ${candidates.length} actividades con confidence < 0.5`);

    const toDelete = candidates.filter((act) => isNonEvent(act.title ?? ''));
    const toKeep   = candidates.filter((act) => !isNonEvent(act.title ?? ''));

    if (toKeep.length > 0) {
      console.log(`  ✔ Conservadas (no coinciden blacklist): ${toKeep.length}`);
      for (const act of toKeep) {
        console.log(`    · "${act.title}" (score=${act.sourceConfidence})`);
      }
    }

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
