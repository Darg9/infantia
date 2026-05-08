// export-activities.ts
// Exporta TODAS las actividades históricas de HabitaPlan a un archivo Excel.
// Uso: npx tsx scripts/export-activities.ts [--output=archivo.xlsx]

import 'dotenv/config';
import * as XLSX from 'xlsx';
import path from 'path';
import { prisma } from '../src/lib/db';

const outputArg = process.argv.find((a) => a.startsWith('--output='));
const OUTPUT_FILE = outputArg
  ? outputArg.replace('--output=', '')
  : path.join(process.cwd(), `habitaplan-actividades-${new Date().toISOString().slice(0, 10)}.xlsx`);

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
  if (sourcePlatform) return sourcePlatform;  // 'instagram', 'telegram', etc.
  if (sourceDomain)   return 'web';
  return 'manual';
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

    return {
      'ID':              a.id,
      'Título':          a.title,
      'Estado (portal)': statusLabel(a.status),
      'URL en HabitaPlan': `https://www.habitaplan.com/actividad/${a.id}`,
      'Fuente (dominio)': a.sourceDomain ?? '',
      'Método ingesta':  sourceMethod(a.sourceDomain, a.sourcePlatform),
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
    { wch: 15 }, // Método
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

  XLSX.writeFile(wb, OUTPUT_FILE);
  console.log(`\n📊 Excel generado: ${OUTPUT_FILE}`);
  console.log(`   Actividades exportadas: ${activities.length}`);
  console.log(`   Activas en portal:      ${activities.filter((a) => a.status === 'ACTIVE').length}`);
  console.log(`   Fuentes distintas:      ${Object.keys(bySource).length}`);
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
