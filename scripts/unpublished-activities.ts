// =============================================================================
// unpublished-activities.ts — Actividades que NO quedaron publicadas (ACTIVE)
// =============================================================================
//
// Herramienta de auditoría operacional: lista actividades con status distinto
// de ACTIVE y muestra por qué método fueron procesadas.
//
// ── Columnas ──────────────────────────────────────────────────────────────────
//   Título         → nombre de la actividad (truncado a 44 chars)
//   Fuente         → sourceDomain
//   Status         → PAUSED | EXPIRED | DRAFT | PENDING_REVIEW
//   Método         → cómo se procesó el contenido:
//                    Gemini   = pipeline V2 con IA (extraction_metadata.temporal.status = resolved|missing)
//                    Cheerio  = fallback HTML estructurado (status = degraded)
//                    pre-V2   = procesado antes del pipeline V2 (sin metadata temporal)
//   startDate      → fecha de inicio si fue extraída
//   Días atrás     → antigüedad desde creación en BD
//
// ── Interpretación de Método ──────────────────────────────────────────────────
//   Gemini  → parser V2 activo; si quedó PAUSED fue por gate/trust, no por parser
//   Cheerio → fallback activado (429 Gemini o sitio bloqueado); calidad limitada
//   pre-V2  → actividad antigua sin trazabilidad de parser; candidata a reparse eventual
//
// ── Filtros disponibles ───────────────────────────────────────────────────────
//   --status=PAUSED          filtra por un status específico
//   --source=idartes         filtra por sourceDomain (substring, case-insensitive)
//   --days=7                 solo actividades creadas en los últimos N días
//
// Uso:
//   npx tsx scripts/unpublished-activities.ts
//   npx tsx scripts/unpublished-activities.ts --status=PAUSED
//   npx tsx scripts/unpublished-activities.ts --status=PENDING_REVIEW
//   npx tsx scripts/unpublished-activities.ts --source=idartes
//   npx tsx scripts/unpublished-activities.ts --days=7
//   npx tsx scripts/unpublished-activities.ts --days=1 --status=PAUSED
//
// =============================================================================

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ── CLI args ─────────────────────────────────────────────────────────────────
const arg = (prefix: string) =>
  process.argv.find(a => a.startsWith(prefix))?.split('=')[1];

const STATUS_FILTER = arg('--status=')?.toUpperCase();   // PAUSED | PENDING_REVIEW | DRAFT | EXPIRED
const SOURCE_FILTER = arg('--source=')?.toLowerCase();
const DAYS = parseInt(arg('--days=') ?? '0', 10);         // 0 = todos los tiempos

// ── Tipos ─────────────────────────────────────────────────────────────────────

type ParsedMethod = 'Gemini' | 'Cheerio' | 'pre-V2';

interface Row {
  id:       string;
  title:    string;
  domain:   string;
  status:   string;
  method:   ParsedMethod;
  dateInfo: string;  // startDate o '—'
  createdAt: Date;
  updatedAt: Date;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function parseMethod(meta: unknown): ParsedMethod {
  if (!meta || typeof meta !== 'object') return 'pre-V2';
  const m = meta as Record<string, unknown>;
  const temporal = m['temporal'] as Record<string, unknown> | undefined;
  if (!temporal) return 'pre-V2';
  const status = temporal['status'];
  if (status === 'degraded') return 'Cheerio';
  if (status === 'resolved' || status === 'missing') return 'Gemini';
  return 'pre-V2';
}

// ── Query ─────────────────────────────────────────────────────────────────────

async function getUnpublished(): Promise<Row[]> {
  const since = DAYS > 0
    ? new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000)
    : undefined;

  // Construimos el where dinámicamente — Prisma no acepta undefined en arrays
  const statusList = STATUS_FILTER
    ? [STATUS_FILTER]
    : ['PAUSED', 'PENDING_REVIEW', 'DRAFT', 'EXPIRED'];

  const activities = await prisma.activity.findMany({
    where: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: { in: statusList as any },
      ...(SOURCE_FILTER ? { sourceDomain: { contains: SOURCE_FILTER } } : {}),
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    select: {
      id:                true,
      title:             true,
      sourceDomain:      true,
      status:            true,
      startDate:         true,
      extractionMetadata: true,
      createdAt:         true,
      updatedAt:         true,
    },
    orderBy: [{ status: 'asc' }, { sourceDomain: 'asc' }, { createdAt: 'desc' }],
  });

  return activities.map(a => ({
    id:       a.id,
    title:    a.title,
    domain:   a.sourceDomain ?? 'unknown',
    status:   a.status,
    method:   parseMethod(a.extractionMetadata),
    dateInfo: a.startDate
      ? a.startDate.toISOString().slice(0, 10)
      : '—',
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }));
}

// ── Resumen global ─────────────────────────────────────────────────────────────

function globalSummary(rows: Row[]) {
  const byStatus: Record<string, number> = {};
  const byMethod: Record<ParsedMethod, number> = { Gemini: 0, Cheerio: 0, 'pre-V2': 0 };
  const byDomain: Record<string, number> = {};

  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    byMethod[r.method]++;
    byDomain[r.domain] = (byDomain[r.domain] ?? 0) + 1;
  }

  console.log('\n📊 RESUMEN GLOBAL');
  console.log(`   Total no-publicadas: ${rows.length}`);

  console.log('\n   Por status:');
  for (const [s, n] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
    const icon = s === 'PAUSED' ? '🟡' : s === 'PENDING_REVIEW' ? '🟠' : s === 'DRAFT' ? '🔵' : '⚪';
    console.log(`     ${icon} ${s.padEnd(15)} ${n}`);
  }

  console.log('\n   Por método de procesamiento:');
  console.log(`     🤖 Gemini   ${byMethod.Gemini}`);
  console.log(`     🕷️  Cheerio  ${byMethod.Cheerio}`);
  console.log(`     📜 pre-V2   ${byMethod['pre-V2']}`);

  if (Object.keys(byDomain).length > 1) {
    console.log('\n   Por fuente:');
    for (const [d, n] of Object.entries(byDomain).sort((a, b) => b[1] - a[1])) {
      console.log(`     ${d.padEnd(40)} ${n}`);
    }
  }
}

// ── Tabla ─────────────────────────────────────────────────────────────────────

function renderTable(rows: Row[]) {
  const COL = {
    title:  45,
    domain: 32,
    status: 16,
    method:  8,
    date:   12,
    age:    10,
  };

  const pad  = (s: string | number, n: number) => String(s).padEnd(n);
  const rpad = (s: string | number, n: number) => String(s).padStart(n);

  const header = [
    pad('Título', COL.title),
    pad('Fuente', COL.domain),
    pad('Status', COL.status),
    pad('Método', COL.method),
    pad('startDate', COL.date),
    rpad('Días atrás', COL.age),
  ].join('  ');

  const sep = '─'.repeat(header.length);
  console.log('\n' + sep);
  console.log(header);
  console.log(sep);

  let lastStatus = '';
  for (const r of rows) {
    if (r.status !== lastStatus) {
      const icon = r.status === 'PAUSED' ? '🟡' : r.status === 'PENDING_REVIEW' ? '🟠' : r.status === 'DRAFT' ? '🔵' : '⚪';
      console.log(`\n${icon} ${r.status}`);
      lastStatus = r.status;
    }

    const methodIcon = r.method === 'Gemini' ? '🤖' : r.method === 'Cheerio' ? '🕷️ ' : '📜';
    const daysOld = Math.floor((Date.now() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24));

    console.log([
      pad(r.title.slice(0, COL.title - 1), COL.title),
      pad(r.domain.slice(0, COL.domain - 1), COL.domain),
      pad(r.status, COL.status),
      `${methodIcon} ${pad(r.method, COL.method - 3)}`,
      pad(r.dateInfo, COL.date),
      rpad(`${daysOld}d`, COL.age),
    ].join('  '));
  }

  console.log('\n' + sep);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const filters: string[] = [];
  if (STATUS_FILTER) filters.push(`status=${STATUS_FILTER}`);
  if (SOURCE_FILTER) filters.push(`source≈${SOURCE_FILTER}`);
  if (DAYS > 0) filters.push(`últimos ${DAYS} días`);
  const filterStr = filters.length > 0 ? filters.join(' | ') : 'todos los tiempos, todos los status';

  console.log(`\n📋 ACTIVIDADES NO-PUBLICADAS — ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })} COT`);
  console.log(`   Filtros: ${filterStr}`);

  const rows = await getUnpublished();

  if (rows.length === 0) {
    console.log('\n✅ No hay actividades no-publicadas con estos filtros.');
    return;
  }

  renderTable(rows);
  globalSummary(rows);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
