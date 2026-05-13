// =============================================================================
// export-activities.ts — Snapshot de salud sistémica de HabitaPlan
// =============================================================================
//
// Genera un Excel con 5 hojas:
//
//   1. Actividades — una fila por actividad (todas: ACTIVE, PAUSED, EXPIRED…)
//      Columnas clave:
//        · Método ingesta   → canal de origen (WEB | INSTAGRAM | TELEGRAM | MANUAL)
//        · Método parser    → cómo se extrajo el contenido:
//                             Gemini   = extracción IA (pipeline V2, status resolved/missing)
//                             Cheerio  = fallback HTML estructurado (status degraded)
//                             pre-V2   = procesado antes del pipeline V2 (sin metadata temporal)
//        · Tipo fuente      → sourceType del modelo (SCRAPED | MANUAL | …)
//        · Completeness     → score 0–100 calculado con 6 señales (ver abajo)
//        · Campos faltantes → lista textual de señales ausentes ("date, image, age")
//        · Tiene fecha      → startDate IS NOT NULL
//        · Tiene imagen     → imageUrl IS NOT NULL
//        · Fallback Cheerio → equivale a Método parser = Cheerio
//        · Verificada       → campo isVerified de la actividad
//
//   2. Resumen por fuente — total histórico + activas + tasa de publicación
//
//   3. URLs vistas (cache) — todo lo que pasó por el discovery (scraping_cache)
//
//   4. URLs rechazadas — gate/trust layer rejections (tabla url_rejections si existe)
//
//   5. Calidad por parser — avg completeness + % con fecha/imagen por Gemini/Cheerio/pre-V2
//
// ── Cálculo de Completeness ───────────────────────────────────────────────────
//   Score = (señales presentes / 6) × 100
//   Señales:
//     1. date        → startDate IS NOT NULL
//     2. image       → imageUrl IS NOT NULL
//     3. age         → ageMin OR ageMax IS NOT NULL
//     4. location    → locationId IS NOT NULL
//     5. price       → price IS NOT NULL
//     6. description → description.length > 150 chars
//
// ── Output ────────────────────────────────────────────────────────────────────
//   Por defecto: habitaplan-actividades-YYYY-MM-DD.xlsx (relativo al cwd del proyecto)
//   Configurable: --output=ruta/archivo.xlsx
//
// Uso:
//   npx tsx scripts/export-activities.ts
//   npx tsx scripts/export-activities.ts --output=exports/snapshot-mayo.xlsx
//
// =============================================================================

import 'dotenv/config';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { prisma } from '../src/lib/db';

const outputArg = process.argv.find((a) => a.startsWith('--output='));
const OUTPUT_FILE = outputArg
  ? path.resolve(process.cwd(), outputArg.replace('--output=', ''))
  : path.join(process.cwd(), `habitaplan-actividades-${new Date().toISOString().slice(0, 10)}.xlsx`);

// Crear directorio de destino si no existe
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatSchedule(schedule: unknown): string {
  if (!schedule || typeof schedule !== 'object') return '';
  const s = schedule as Record<string, unknown>;
  const items = Array.isArray(s['items']) ? s['items'] : [];
  if (items.length === 0) return '';
  return items
    .map((item: unknown) => {
      if (!item || typeof item !== 'object') return '';
      const i = item as Record<string, unknown>;
      const start = i['startDate'] ? String(i['startDate']) : '';
      const end   = i['endDate']   ? ` → ${String(i['endDate'])}` : '';
      const notes = i['notes']     ? ` (${String(i['notes'])})` : '';
      return `${start}${end}${notes}`;
    })
    .filter(Boolean)
    .join(' | ');
}

function sourceMethod(sourceDomain: string | null, sourcePlatform: string | null): string {
  if (sourcePlatform) return sourcePlatform.toUpperCase();  // 'INSTAGRAM', 'TELEGRAM', etc.
  if (sourceDomain)   return 'WEB';
  return 'MANUAL';
}

function parserMethod(meta: unknown): string {
  if (!meta || typeof meta !== 'object') return 'pre-V2';
  const m = meta as Record<string, unknown>;
  const temporal = m['temporal'] as Record<string, unknown> | undefined;
  if (!temporal) return 'pre-V2';
  const status = temporal['status'];
  if (status === 'degraded') return 'Cheerio';
  if (status === 'resolved' || status === 'missing') return 'Gemini';
  return 'pre-V2';
}

interface CompletenessResult {
  score: number;           // 0–100
  missingFields: string;   // "date, image, age" — vacío si completa
}

function completeness(a: {
  startDate:   Date | null;
  imageUrl:    string | null;
  ageMin:      number | null;
  ageMax:      number | null;
  locationId:  string | null;
  price:       unknown;
  description: string;
}): CompletenessResult {
  const signals: Array<{ key: string; present: boolean }> = [
    { key: 'date',        present: a.startDate !== null },
    { key: 'image',       present: !!a.imageUrl },
    { key: 'age',         present: a.ageMin !== null || a.ageMax !== null },
    { key: 'location',    present: a.locationId !== null },
    { key: 'price',       present: a.price !== null && a.price !== undefined },
    { key: 'description', present: a.description.length > 150 },
  ];

  const presentCount = signals.filter(s => s.present).length;
  const missing = signals.filter(s => !s.present).map(s => s.key);

  return {
    score:         Math.round((presentCount / signals.length) * 100),
    missingFields: missing.join(', '),
  };
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    ACTIVE:     'Sí — Publicada',
    DRAFT:      'No — Borrador',
    PAUSED:     'No — Pausada',
    ARCHIVED:   'No — Archivada',
    QUARANTINE: 'No — Cuarentena',
  };
  return map[status] ?? status;
}

function priceLabel(price: unknown, period: string | null): string {
  if (price === null || price === undefined) return '';
  const n = Number(price);
  if (n === 0) return 'Gratis';
  const formatted = n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  const periodMap: Record<string, string> = {
    PER_SESSION: '/ sesión',
    MONTHLY:     '/ mes',
    TOTAL:       'total',
    FREE:        '',
  };
  return period ? `${formatted} ${periodMap[period] ?? period}`.trim() : formatted;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📦 Consultando actividades...');

  const activities = await prisma.activity.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      categories: { include: { category: true } },
      location:   { include: { city: true } },
      provider:   true,
    },
  });

  console.log(`✅ ${activities.length} actividades encontradas. Generando Excel...`);

  const rows = activities.map((a) => {
    const cats = a.categories.map((ac) => ac.category.name).join(', ');
    const city = a.location?.city?.name ?? '';
    const locationName = a.location
      ? [a.location.name, a.location.address, a.location.neighborhood].filter(Boolean).join(', ')
      : '';

    const comp = completeness({
      startDate:   a.startDate,
      imageUrl:    a.imageUrl,
      ageMin:      a.ageMin,
      ageMax:      a.ageMax,
      locationId:  a.locationId,
      price:       a.price,
      description: a.description,
    });

    return {
      'ID':              a.id,
      'Título':          a.title,
      'Estado (portal)': statusLabel(a.status),
      'URL en HabitaPlan': `https://www.habitaplan.com/actividad/${a.id}`,
      'Fuente (dominio)': a.sourceDomain ?? '',
      'Método ingesta':  sourceMethod(a.sourceDomain, a.sourcePlatform),
      'Método parser':   parserMethod(a.extractionMetadata),
      'Tipo fuente':     a.sourceType ?? '',
      'Completeness':    comp.score,
      'Campos faltantes': comp.missingFields,
      'Tiene fecha':     a.startDate !== null ? 'Sí' : 'No',
      'Tiene imagen':    a.imageUrl ? 'Sí' : 'No',
      'Fallback Cheerio': parserMethod(a.extractionMetadata) === 'Cheerio' ? 'Sí' : 'No',
      'Verificada':      a.isVerified ? 'Sí' : 'No',
      'URL fuente':      a.sourceUrl ?? '',
      'Ciudad':          city,
      'Ubicación':       locationName,
      'Descripción':     a.description,
      'Categorías':      cats,
      'Fecha inicio':    formatDate(a.startDate),
      'Fecha fin':       formatDate(a.endDate),
      'Horarios':        formatSchedule(a.schedule),
      'Precio':          priceLabel(a.price, a.pricePeriod),
      'Edad mín':        a.ageMin ?? '',
      'Edad máx':        a.ageMax ?? '',
      'Puntaje IA':      a.sourceConfidence,
      'Proveedor':       a.provider?.name ?? '',
      'Creada en BD':    formatDate(a.createdAt),
    };
  });

  // Crear workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 36 }, // ID
    { wch: 55 }, // Título
    { wch: 18 }, // Estado
    { wch: 55 }, // URL HabitaPlan
    { wch: 30 }, // Fuente
    { wch: 15 }, // Método ingesta
    { wch: 12 }, // Método parser
    { wch: 12 }, // Tipo fuente
    { wch: 14 }, // Completeness
    { wch: 30 }, // Campos faltantes
    { wch: 12 }, // Tiene fecha
    { wch: 12 }, // Tiene imagen
    { wch: 16 }, // Fallback Cheerio
    { wch: 12 }, // Verificada
    { wch: 70 }, // URL fuente
    { wch: 15 }, // Ciudad
    { wch: 40 }, // Ubicación
    { wch: 80 }, // Descripción
    { wch: 35 }, // Categorías
    { wch: 14 }, // Fecha inicio
    { wch: 14 }, // Fecha fin
    { wch: 50 }, // Horarios
    { wch: 18 }, // Precio
    { wch: 10 }, // Edad mín
    { wch: 10 }, // Edad máx
    { wch: 12 }, // Puntaje
    { wch: 30 }, // Proveedor
    { wch: 14 }, // Creada
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Actividades');

  // Hoja resumen por fuente
  const bySource: Record<string, { total: number; activas: number }> = {};
  for (const a of activities) {
    const src = a.sourceDomain ?? 'manual';
    if (!bySource[src]) bySource[src] = { total: 0, activas: 0 };
    bySource[src].total++;
    if (a.status === 'ACTIVE') bySource[src].activas++;
  }
  const summaryRows = Object.entries(bySource)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([src, v]) => ({
      'Fuente': src,
      'Total histórico': v.total,
      'Activas en portal': v.activas,
      'Tasa publicación': v.total > 0 ? `${Math.round((v.activas / v.total) * 100)}%` : '0%',
    }));

  const ws2 = XLSX.utils.json_to_sheet(summaryRows);
  ws2['!cols'] = [{ wch: 35 }, { wch: 18 }, { wch: 20 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumen por fuente');

  // ── Hoja 3: scraping_cache (URLs que pasaron Gemini discover) ──────────────
  console.log('📦 Consultando scraping_cache...');
  const cache = await prisma.scrapingCache.findMany({ orderBy: { scrapedAt: 'asc' } });
  const cacheRows = cache.map((c) => ({
    'URL':       c.url,
    'Fuente':    c.source,
    'Título detectado': c.title,
    'Fecha detección':  formatDate(c.scrapedAt),
    'Llegó a BD':       activities.some((a) => a.sourceUrl === c.url) ? 'Sí' : 'No',
  }));
  const ws3 = XLSX.utils.json_to_sheet(cacheRows);
  ws3['!cols'] = [{ wch: 90 }, { wch: 30 }, { wch: 55 }, { wch: 16 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'URLs vistas (cache)');

  // ── Hoja 4: url_rejections (desde ahora — vacía si tabla no existe aún) ────
  let rejRows: Record<string, unknown>[] = [];
  try {
    const rejs = await (prisma as unknown as { urlRejection: { findMany: (args: unknown) => Promise<unknown[]> } })
      .urlRejection.findMany({ orderBy: { rejectedAt: 'desc' } });
    rejRows = (rejs as Array<Record<string, unknown>>).map((r) => ({
      'URL':      r['url'],
      'Fuente':   r['source'],
      'Etapa':    r['stage'],
      'Razón':    r['reason'],
      'Score URL': r['score'] ?? '',
      'Fecha':    formatDate(r['rejectedAt'] as Date),
    }));
  } catch {
    // Tabla aún no existe — se creará en la migración
    rejRows = [{ 'Nota': 'Tabla url_rejections aún no existe. Se creará en la próxima migración.' }];
  }
  const ws4 = XLSX.utils.json_to_sheet(rejRows);
  ws4['!cols'] = [{ wch: 90 }, { wch: 30 }, { wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'URLs rechazadas');

  // ── Hoja 5: Completeness por parser ──────────────────────────────────────────
  const parserGroups: Record<string, number[]> = { Gemini: [], Cheerio: [], 'pre-V2': [] };
  for (const row of rows) {
    const p = row['Método parser'] as string;
    const s = row['Completeness'] as number;
    if (parserGroups[p]) parserGroups[p].push(s);
    else parserGroups[p] = [s];
  }
  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const qualityRows = Object.entries(parserGroups).map(([parser, scores]) => ({
    'Parser':            parser,
    'Total actividades': scores.length,
    'Avg completeness':  avg(scores),
    'Score mínimo':      scores.length > 0 ? Math.min(...scores) : 0,
    'Score máximo':      scores.length > 0 ? Math.max(...scores) : 0,
    'Con fecha (%)':     scores.length > 0
      ? `${Math.round(rows.filter(r => r['Método parser'] === parser && r['Tiene fecha'] === 'Sí').length / scores.length * 100)}%`
      : '0%',
    'Con imagen (%)':    scores.length > 0
      ? `${Math.round(rows.filter(r => r['Método parser'] === parser && r['Tiene imagen'] === 'Sí').length / scores.length * 100)}%`
      : '0%',
  }));

  const ws5 = XLSX.utils.json_to_sheet(qualityRows);
  ws5['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws5, 'Calidad por parser');

  XLSX.writeFile(wb, OUTPUT_FILE);
  console.log(`\n📊 Excel generado: ${OUTPUT_FILE}`);
  console.log(`   Actividades exportadas: ${activities.length}`);
  console.log(`   Activas en portal:      ${activities.filter((a) => a.status === 'ACTIVE').length}`);
  console.log(`   Fuentes distintas:      ${Object.keys(bySource).length}`);
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
