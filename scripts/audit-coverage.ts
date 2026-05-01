/**
 * audit-coverage.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Auditoría de cobertura del scraping scheduler.
 *
 * Para cada fuente web: navega al listing URL, extrae links que parezcan
 * actividades/eventos, compara con el caché de BD, y reporta cuántos son
 * nuevos vs ya procesados.
 *
 * Útil para detectar fuentes donde el presupuesto del scheduler (maxUrls)
 * es menor al tamaño real del listing → actividades perdidas.
 *
 * Uso:
 *   npx tsx scripts/audit-coverage.ts
 *   npx tsx scripts/audit-coverage.ts --source=banrep   (solo una fuente)
 *   npx tsx scripts/audit-coverage.ts --fast            (solo Cheerio, sin Playwright)
 *
 * NO usa Gemini, NO guarda en BD, NO modifica nada.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import 'dotenv/config';
import { chromium, Browser } from 'playwright';
import * as cheerio from 'cheerio';
import { ScrapingCache } from '../src/modules/scraping/cache';
import { buildPredictivePlan } from '../src/modules/scraping/scheduler/scheduler.core';
import { type SourceStats } from '../src/modules/scraping/scheduler/scheduler.types';
import { getSourceAggregatedStats, getCTRByDomain } from '../src/modules/analytics/metrics';
import { prisma } from '../src/lib/db';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface AuditSource {
  name: string;
  url: string;
  cityName?: string;
}

interface AuditResult {
  name: string;
  url: string;
  status: 'ok' | 'error' | 'timeout';
  totalLinks: number;      // Links únicos en el listing (mismo dominio, filtrados)
  cached: number;          // Ya en caché → ya procesados
  newLinks: number;        // No están en caché → potencial nuevo contenido
  newUrls: string[];       // URLs nuevas (max 10 para display)
  schedulerMode?: string;  // Modo que asignaría el scheduler
  schedulerBudget?: number; // maxUrls que daría el scheduler
  error?: string;
  durationMs: number;
}

// ── Fuentes a auditar (solo canal web) ────────────────────────────────────────
// Copiadas y simplificadas de ingest-sources.ts. Solo las que tienen listing navegable.

const SOURCES: AuditSource[] = [
  { name: 'BibloRed',             url: 'https://www.biblored.gov.co/eventos',                               cityName: 'Bogotá' },
  { name: 'Banrep — Bogotá',      url: 'https://www.banrepcultural.org/actividades/bogota',                 cityName: 'Bogotá' },
  { name: 'Idartes',              url: 'https://www.idartes.gov.co/es/agenda',                              cityName: 'Bogotá' },
  { name: 'Planetario de Bogotá', url: 'https://planetariodebogota.gov.co/programate',                      cityName: 'Bogotá' },
  { name: 'Cinemateca de Bogotá', url: 'https://cinematecadebogota.gov.co/cine/11',                         cityName: 'Bogotá' },
  { name: 'FCE — Luis Caballero', url: 'https://fce.gov.co/es/agenda',                                      cityName: 'Bogotá' },
  { name: 'FCE — Reyes Católicos',url: 'https://fce.gov.co/es/agenda',                                      cityName: 'Bogotá' },
  { name: 'FCE — Villa de Leyva', url: 'https://fce.gov.co/es/agenda',                                      cityName: 'Bogotá' },
  { name: 'Sec. Cultura',         url: 'https://www.culturarecreacionydeporte.gov.co/es/agenda',            cityName: 'Bogotá' },
  { name: 'Parque Explora',       url: 'https://www.parqueexplora.org/visita/actividades-y-talleres',       cityName: 'Medellín' },
];

// ── Patrones de exclusión: paths claramente de navegación, no eventos ─────────

const NAV_EXCLUSIONS = [
  '/servicios', '/service', '/noticias', '/noticia/',
  '/biblioteca-virtual', '/coleccion', '/colecciones',
  '/museo-del-oro', '/museo-botero', '/museo-de-arte', '/museo-casa',
  '/museos-', '/red-museos', '/centros-culturales', '/centro-cultural',
  '/accesibilidad', '/about-', '/sobre-', '/quienes-somos',
  '/contacto', '/contact', '/buscar', '/search', '/login', '/registro',
  '/mapa-del-sitio', '/sitemap', '/politica', '/terminos', '/ayuda',
  '/preguntas-frecuentes', '/faq', '/fundaciones',
  '/barranquilla', '/bucaramanga', '/buenaventura', '/san-andres',
  '/santa-marta', '/valledupar', '/villavicencio', '/cartagena',
  '/medellin', '/cali', '/manizales', '/pereira', '/leticia',
  '/armenia/', '/pasto/', '/bogota/museo', '/bogota/casa',
  '/actividad-musical', '/biblioteca-para-sordos', '/imagen-regional',
  '/leer-el-', '/jovenes-interpretes', '/programas/colombia-en-un',
  '/servicios/maletas', '/servicios/internet', '/servicios/listas',
  '/servicios/calendario', '/servicios/desarrollo',
  '/biblioteca-virtual/recursos', '/biblioteca-virtual/colecciones',
  '/exposicion-permanente', '/exposiciones/exposicion-permanente',
  '/multimedia', '/descubridor.banrep', 'colecciones.banrep',
  'publicaciones.banrep',
  '#',
];

// ── Heurística: ¿es este link potencialmente un evento/actividad? ─────────────

function isActivityLike(href: string, listingUrl: string): boolean {
  try {
    const parsed = new URL(href);
    const listing = new URL(listingUrl);

    // Solo mismo dominio (o subdominio del mismo dominio base)
    const baseDomain = listing.hostname.replace('www.', '');
    if (!parsed.hostname.includes(baseDomain)) return false;

    const path = parsed.pathname.toLowerCase();

    // Excluir extensiones de archivo
    if (/\.(pdf|jpg|jpeg|png|gif|svg|css|js|xml|zip|doc|docx)(\?|$)/i.test(path)) return false;

    // Excluir paths de navegación conocidos
    if (NAV_EXCLUSIONS.some((exc) => path.includes(exc.toLowerCase()))) return false;

    // El path debe tener cierta profundidad (al menos 2 segmentos no vacíos)
    const segments = path.split('/').filter(Boolean);
    if (segments.length < 2) return false;

    // El último segmento debe tener al menos 8 chars (slugs cortos suelen ser nav)
    const lastSegment = segments[segments.length - 1];
    if (lastSegment.length < 8) return false;

    // Señales positivas: palabras clave en el path
    const positiveSignals = [
      '/actividad/', '/evento/', '/taller/', '/programa/', '/concierto/',
      '/exposicion/', '/exposiciones/', '/agenda/', '/funcion/', '/obra/',
      '/espectaculo/', '/cine/', '/pelicula/', '/funcion/', '/encuentro/',
      '/programate/', '/eventos/', '/film/',
    ];
    const hasPositiveSignal = positiveSignals.some((s) => path.includes(s));

    // Si tiene señal positiva → incluir siempre
    if (hasPositiveSignal) return true;

    // Sin señal positiva → incluir solo si el path es suficientemente específico (slug largo)
    const fullPath = parsed.href;
    if (fullPath.length < 55) return false;

    return true;
  } catch {
    return false;
  }
}

// ── Extracción de links con Cheerio (rápido, sin JS) ─────────────────────────

async function fetchLinksCheerio(url: string): Promise<string[]> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
      'Accept-Language': 'es-CO,es;q=0.9',
    },
    signal: AbortSignal.timeout(15_000),
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    try {
      const abs = new URL(href, url).href;
      links.push(abs);
    } catch { /* skip malformed */ }
  });
  return [...new Set(links)];
}

// ── Extracción de links con Playwright (SPA / JS-rendered) ───────────────────

async function fetchLinksPlaywright(url: string, browser: Browser): Promise<string[]> {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
  });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(2500);
    const links = await page.$$eval('a[href]', (anchors) =>
      (anchors as HTMLAnchorElement[]).map((a) => a.href).filter(Boolean)
    );
    return [...new Set(links)];
  } finally {
    await page.close();
    await context.close();
  }
}

// ── Auditar una sola fuente ───────────────────────────────────────────────────

async function auditSource(
  source: AuditSource,
  cache: ScrapingCache,
  browser: Browser,
  fastMode: boolean
): Promise<AuditResult> {
  const start = Date.now();
  const domain = new URL(source.url).hostname.replace('www.', '');

  try {
    // Sincronizar caché desde BD para este dominio
    await cache.syncFromDb(domain);

    // Extraer links del listing
    let allLinks: string[];
    try {
      allLinks = fastMode
        ? await fetchLinksCheerio(source.url)
        : await fetchLinksPlaywright(source.url, browser);
    } catch (err: any) {
      // Si Playwright falla (SPA), intentar Cheerio como fallback
      if (!fastMode) {
        try {
          allLinks = await fetchLinksCheerio(source.url);
        } catch {
          throw err;
        }
      } else {
        throw err;
      }
    }

    // Filtrar: solo links que parezcan actividades
    const activityLinks = [...new Set(allLinks)].filter((href) =>
      isActivityLike(href, source.url)
    );

    // Comparar con caché
    const cached = activityLinks.filter((url) => cache.has(url));
    const newUrls = activityLinks.filter((url) => !cache.has(url));

    return {
      name: source.name,
      url: source.url,
      status: 'ok',
      totalLinks: activityLinks.length,
      cached: cached.length,
      newLinks: newUrls.length,
      newUrls: newUrls.slice(0, 10),
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    const isTimeout = err.message?.includes('timeout') || err.message?.includes('ETIMEDOUT');
    return {
      name: source.name,
      url: source.url,
      status: isTimeout ? 'timeout' : 'error',
      totalLinks: 0,
      cached: 0,
      newLinks: 0,
      newUrls: [],
      error: err.message?.slice(0, 120),
      durationMs: Date.now() - start,
    };
  }
}

// ── Obtener modo del scheduler para cada fuente ───────────────────────────────

async function getSchedulerModes(sources: AuditSource[]): Promise<Map<string, { mode: string; maxUrls: number }>> {
  const result = new Map<string, { mode: string; maxUrls: number }>();
  try {
    const healthData = await prisma.sourceHealth.findMany({ select: { source: true, score: true } });
    const healthDict: Record<string, number> = {};
    for (const h of healthData) healthDict[h.source] = h.score;

    const ctrMap = await getCTRByDomain();
    const dummyCache = new ScrapingCache();

    const inputs: { source: any; stats: SourceStats }[] = [];
    for (const s of sources) {
      const host = new URL(s.url).hostname.replace('www.', '');
      const { saveRate, avgCost } = await getSourceAggregatedStats(host, 5);
      const ctr = (ctrMap as Record<string, number>)[host] ?? 0;
      const score = healthDict[host] ?? 0.5;
      dummyCache.setSource(host);
      await dummyCache.syncFromDb(host);
      const reparseUrls = dummyCache.getReparseUrlsByDomain(host);

      inputs.push({
        source: { name: s.name, channel: 'web' as const, url: s.url, cityName: s.cityName, verticalSlug: 'kids' },
        stats: {
          sourceId: host,
          ctr7d: ctr,
          saveRate,
          health: score,
          avgCost,
          reparseCount: reparseUrls.length,
          isGov: host.includes('.gov.co'),
        },
      });
    }

    const plan = buildPredictivePlan(inputs, 300);
    for (const item of plan.planned) {
      result.set(item.source.name, { mode: item.mode, maxUrls: item.maxUrls });
    }
    for (const item of plan.skipped) {
      result.set(item.source.name, { mode: 'SKIPPED', maxUrls: 0 });
    }
  } catch (err: any) {
    console.warn(`⚠️  No se pudo consultar el scheduler: ${err.message?.slice(0, 80)}`);
  }
  return result;
}

// ── Formateo de tabla ─────────────────────────────────────────────────────────

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const fastMode = args.includes('--fast');
  const sourceFilter = args.find((a) => a.startsWith('--source='))?.split('=')[1]?.toLowerCase();

  const sources = sourceFilter
    ? SOURCES.filter((s) => s.name.toLowerCase().includes(sourceFilter))
    : SOURCES;

  if (sources.length === 0) {
    console.error(`❌ Ninguna fuente coincide con: ${sourceFilter}`);
    process.exit(1);
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`🔍 AUDITORÍA DE COBERTURA — ${new Date().toISOString().slice(0, 10)}`);
  console.log(`   Fuentes a auditar: ${sources.length} | Modo: ${fastMode ? 'FAST (Cheerio)' : 'FULL (Playwright)'}`);
  console.log(`${'═'.repeat(70)}\n`);

  // Cargar scheduler modes en paralelo con la inicialización del cache
  const cache = new ScrapingCache();
  const [schedulerModes] = await Promise.all([
    getSchedulerModes(sources),
  ]);

  // Lanzar browser (una sola instancia para todas las fuentes)
  const browser = fastMode ? null : await chromium.launch({ headless: true });

  const results: AuditResult[] = [];

  for (const source of sources) {
    process.stdout.write(`  ⏳ ${pad(source.name, 28)} `);
    const result = await auditSource(source, cache, browser!, fastMode);

    // Enriquecer con modo scheduler
    const sched = schedulerModes.get(source.name);
    if (sched) {
      result.schedulerMode = sched.mode;
      result.schedulerBudget = sched.maxUrls;
    }

    results.push(result);

    // Status inline
    if (result.status === 'ok') {
      const alert = result.newLinks > (result.schedulerBudget ?? 5) ? ' ⚠️' : '';
      process.stdout.write(
        `✅ ${result.totalLinks} en listing | ${result.cached} cacheados | 🆕 ${result.newLinks} nuevos (${formatDuration(result.durationMs)})${alert}\n`
      );
    } else {
      process.stdout.write(`${result.status === 'timeout' ? '⏱️ TIMEOUT' : '❌ ERROR'} — ${result.error?.slice(0, 60)}\n`);
    }
  }

  if (browser) await browser.close();

  // ── Tabla resumen ────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(95)}`);
  console.log(
    pad('Fuente', 28) +
    pad('Listing', 9) +
    pad('Cacheados', 11) +
    pad('🆕 Nuevos', 11) +
    pad('Scheduler', 16) +
    'Alerta'
  );
  console.log(`${'─'.repeat(95)}`);

  const sorted = [...results].sort((a, b) => b.newLinks - a.newLinks);

  for (const r of sorted) {
    if (r.status !== 'ok') {
      console.log(
        pad(r.name, 28) +
        pad('–', 9) + pad('–', 11) + pad('–', 11) +
        pad('–', 16) +
        `${r.status === 'timeout' ? '⏱️ TIMEOUT' : '❌ ERROR'}`
      );
      continue;
    }

    const schedLabel = r.schedulerMode
      ? `${r.schedulerMode} (${r.schedulerBudget})`
      : '?';

    let alert = '';
    if (r.schedulerBudget !== undefined && r.newLinks > r.schedulerBudget) {
      alert = `🔴 Budget insuficiente (necesita ≥${r.newLinks})`;
    } else if (r.newLinks > 0) {
      alert = '🟡 Hay contenido nuevo';
    } else {
      alert = '✅ Al día';
    }

    console.log(
      pad(r.name, 28) +
      pad(String(r.totalLinks), 9) +
      pad(String(r.cached), 11) +
      pad(String(r.newLinks), 11) +
      pad(schedLabel, 16) +
      alert
    );
  }

  // ── Detalle de URLs nuevas (solo fuentes con nuevos) ─────────────────────────
  const withNew = sorted.filter((r) => r.status === 'ok' && r.newLinks > 0);
  if (withNew.length > 0) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log('📋 DETALLE DE URLs NUEVAS (top 10 por fuente)');
    console.log(`${'─'.repeat(70)}`);
    for (const r of withNew) {
      console.log(`\n${r.name} (${r.newLinks} nuevas):`);
      for (const url of r.newUrls) {
        const shortUrl = url.replace(/^https?:\/\/(www\.)?[^/]+/, '');
        console.log(`  🆕 ${shortUrl}`);
      }
      if (r.newLinks > 10) {
        console.log(`  ... y ${r.newLinks - 10} más`);
      }
    }
  }

  // ── Recomendación final ───────────────────────────────────────────────────────
  const critical = sorted.filter(
    (r) => r.status === 'ok' && r.schedulerBudget !== undefined && r.newLinks > r.schedulerBudget
  );

  console.log(`\n${'═'.repeat(70)}`);
  if (critical.length > 0) {
    console.log('⚠️  ACCIÓN REQUERIDA — Fuentes con budget insuficiente:');
    for (const r of critical) {
      console.log(`   • ${r.name}: ${r.newLinks} nuevas, budget actual ${r.schedulerBudget} → subir a ≥${r.newLinks}`);
    }
  } else {
    console.log('✅ Todos los budgets del scheduler cubren el tamaño real del listing.');
  }
  console.log(`${'═'.repeat(70)}\n`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
