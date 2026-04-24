import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
  PageBreak,
  Header,
  Footer as DocxFooter,
  PageNumber,
  NumberFormat,
  convertInchesToTwip,
  VerticalAlign,
} from "docx";
import { writeFileSync } from "fs";

// ── Colors ──────────────────────────────────────────────────────────────────
const DARK_BLUE  = "1A5276";
const WHITE      = "FFFFFF";
const LIGHT_BLUE = "D6EAF8";
const ALT_ROW    = "EAF4FB";
const ORANGE     = "E67E22";

// ── Helpers ──────────────────────────────────────────────────────────────────
function sectionHeading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: DARK_BLUE, size: 26, font: "Arial" })],
    spacing: { before: 320, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: DARK_BLUE } },
  });
}

function subHeading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: ORANGE, size: 22, font: "Arial" })],
    spacing: { before: 180, after: 80 },
  });
}

function bodyParagraph(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, font: "Arial", bold: opts.bold || false, color: opts.color || "000000" })],
    spacing: { before: 60, after: 60 },
    bullet: opts.bullet ? { level: 0 } : undefined,
  });
}

function labelValue(label, value) {
  return new Paragraph({
    children: [
      new TextRun({ text: label + ": ", bold: true, size: 20, font: "Arial", color: DARK_BLUE }),
      new TextRun({ text: value, size: 20, font: "Arial" }),
    ],
    spacing: { before: 60, after: 60 },
  });
}

function headerCell(text, widthPct) {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 20, font: "Arial", color: WHITE })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
    })],
    shading: { fill: DARK_BLUE, type: ShadingType.CLEAR, color: DARK_BLUE },
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
  });
}

function dataCell(text, isAlt, opts = {}) {
  const fill = opts.header ? DARK_BLUE : isAlt ? ALT_ROW : WHITE;
  const textColor = opts.header ? WHITE : "000000";
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, size: 19, font: "Arial", color: textColor, bold: opts.bold || false })],
      spacing: { before: 50, after: 50 },
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    })],
    shading: { fill, type: ShadingType.CLEAR, color: fill },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
  });
}

function twoColTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map((h, i) => headerCell(h, i === 0 ? 35 : 65)), tableHeader: true }),
      ...rows.map((r, idx) => new TableRow({ children: r.map((cell) => dataCell(cell, idx % 2 === 1)) })),
    ],
  });
}

function threeColTable(headers, rows, widths = [35, 12, 53]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map((h, i) => headerCell(h, widths[i])), tableHeader: true }),
      ...rows.map((r, idx) => new TableRow({ children: r.map((cell) => dataCell(cell, idx % 2 === 1)) })),
    ],
  });
}

function spacer(lines = 1) {
  return new Paragraph({ children: [new TextRun({ text: "", size: 20 })], spacing: { before: lines * 60, after: 0 } });
}

// ===================== DOCUMENT CONTENT =====================
const children = [];

// ── COVER PAGE ──────────────────────────────────────────────────────────────
children.push(new Paragraph({ children: [new TextRun({ text: "", size: 20 })], spacing: { before: 1200, after: 0 } }));
children.push(new Paragraph({
  children: [new TextRun({ text: "HABITAPLAN", bold: true, size: 72, font: "Arial", color: DARK_BLUE })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "DOCUMENTO FUNDACIONAL V28", bold: true, size: 40, font: "Arial", color: DARK_BLUE })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Plataforma de Descubrimiento de Actividades y Eventos para Familias", size: 28, font: "Arial", color: "555555", italics: true })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "2026-04-23", size: 24, font: "Arial", color: "777777" })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Sesiones S43-S68 — Design System Zero-Debt, Magic Link Auth, Multi-City Map Fase 1, v0.15.0", size: 20, font: "Arial", color: "999999", italics: true })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 1200 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Generado automaticamente por Claude (Anthropic) | HabitaPlan v0.15.0 | 1214 tests | 75 archivos | 0 errores TS", size: 18, font: "Arial", color: "BBBBBB", italics: true })],
  alignment: AlignmentType.CENTER,
}));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ── SECTION 1: VISION ───────────────────────────────────────────────────────
children.push(sectionHeading("1. VISION Y PROBLEMA"));
children.push(bodyParagraph("Las familias con ninos pasan horas buscando actividades en fuentes fragmentadas: sitios web institucionales, Instagram, grupos de WhatsApp, Facebook, Telegram. No existe un lugar centralizado que agregue, normalice y filtre esta informacion."));
children.push(spacer());
children.push(labelValue("La Solucion", "HabitaPlan es un agregador multi-fuente con normalizacion inteligente que centraliza actividades y eventos para ninos, jovenes y familias en ciudades colombianas, con expansion a LATAM."));
children.push(labelValue("Nombre", "HabitaPlan (rebrand desde Infantia, 2026-04-07)"));
children.push(labelValue("Owner", "Denys Reyes (padre de una hija de 10 anos)"));
children.push(labelValue("Inicio del proyecto", "15 de marzo de 2026"));
children.push(labelValue("Dominio", "habitaplan.com (DNS apuntado a Vercel, SSL activo)"));
children.push(spacer());

// ── SECTION 2: PROPUESTA DE VALOR ──────────────────────────────────────────
children.push(sectionHeading("2. PROPUESTA DE VALOR"));
children.push(bodyParagraph("Para familias: Un solo lugar para descubrir todas las actividades disponibles para sus hijos, con filtros por edad, precio, ubicacion, audiencia y categoria."));
children.push(bodyParagraph("Para proveedores: Visibilidad gratuita, dashboard de metricas y herramientas para gestionar su oferta."));
children.push(bodyParagraph("Para anunciantes: Acceso a familias activas via newsletter y listings destacados (modelo de monetizacion implementado)."));
children.push(bodyParagraph("Para la plataforma: Datos propietarios de demanda de actividades en LATAM."));
children.push(spacer());
children.push(twoColTable(
  ["Diferenciador", "Descripcion"],
  [
    ["Agregacion multi-fuente", "Web + Instagram + Telegram (operativo) + Facebook + TikTok (canales tipificados)"],
    ["Normalizacion inteligente", "NLP Gemini 2.5 Flash + Parser Resiliente con fallback Cheerio ante 429/503"],
    ["Activity Gate", "NUEVO V28 — evaluateActivityGate() descarta falsos positivos institucionales con trazabilidad [discard:llm] vs [discard:gate]"],
    ["Multi-City Map", "NUEVO V28 — CityProvider + resolveCity.ts SSOT: URL > localStorage > default. cityId estricto en backend (HTTP 400 sin el)"],
    ["Design System Zero-Debt", "NUEVO V28 — Storybook + Chromatic VRT automatico (GitHub Actions) + hp-tokens semanticos + SVG-First branding"],
    ["Magic Link Auth", "NUEVO V28 — Supabase Magic Link como metodo primario. SSO social. Feature flag para OTP movil futuro"],
    ["Honest Facets UX", "NUEVO V28 — null = 'desconocemos', no cero. Dropdowns > Pills para evitar Gestalt mismatch en datos incompletos"],
    ["Search Assist System", "NUEVO V28 — pg_trgm tolerancia typos + normalizeQuery NFD + historial SearchLog + hibridacion score"],
    ["Centro de Seguridad SSOT", "V26 — /seguridad/* con PDFs descargables, texto SSOT, alineado SIC/Ley 1581"],
    ["Multi-vertical por config", "Ninos, mascotas, adultos mayores — nuevas verticales = registros en BD"],
    ["CTR Feedback Loop", "Analytics in-house (zero-dep) + ctrBoost tiered → ranking dinamico por dominio"],
    ["Geocoding curado", "venue-dictionary.ts con 40+ venues Bogota — coords exactas sin API call (~0ms)"],
    ["Monetizacion integrada", "Sponsors newsletter + listings premium + /anunciate landing — implementado desde mes 0"],
    ["Observabilidad produccion", "Logger estructurado createLogger(ctx), Sentry activo, /api/health + UptimeRobot + Smoke CI GitHub Actions cada 15min"],
  ]
));
children.push(spacer());

// ── SECTION 3: STACK ────────────────────────────────────────────────────────
children.push(sectionHeading("3. STACK TECNOLOGICO"));
children.push(twoColTable(
  ["Capa", "Tecnologia"],
  [
    ["Framework", "Next.js 16.2.1 (App Router) + TypeScript strict"],
    ["Estilos", "Tailwind CSS v4 + clsx + hp-tokens semanticos (NUEVO V28)"],
    ["Base de datos", "PostgreSQL via Supabase (Free Tier, AWS us-east-1)"],
    ["ORM", "Prisma 7.5.0 con adapter-pg (DATABASE_URL en prisma.config.ts, NO en schema.prisma)"],
    ["Autenticacion", "Supabase Auth — Magic Link primario (NUEVO V28) + SSR cookies + middleware global"],
    ["Scraping web", "Cheerio (HTML) + Playwright (JS-heavy / Instagram)"],
    ["AI / NLP", "Gemini 2.5 Flash (Google AI Studio, 20 RPD free tier). CHUNK_SIZE=100. Pool 4 keys"],
    ["Parser Resiliente", "parser.ts orchestrator → Gemini (primario) → fallback Cheerio (429/503). PARSER_FALLBACK_ENABLED feature flag"],
    ["Email", "Resend + react-email (UTM tracking + bloque sponsor). SPF+DKIM+DMARC activos"],
    ["Cola de tareas", "BullMQ + Upstash Redis (rediss:// TLS, Free Tier). Cron scheduler cada 6h via Vercel Cron"],
    ["PDF legal", "@react-pdf/renderer (serverExternalPackages) — generacion server-side"],
    ["Mapas", "Leaflet 1.9.4 + OpenStreetMap + CityProvider multi-ciudad (NUEVO V28)"],
    ["Geocoding", "Nominatim + venue-dictionary.ts curado (40+ venues, sin API key, ~0ms)"],
    ["Busqueda", "pg_trgm GIN indexes (similarity + word_similarity + prefix boost) — NUEVO V28"],
    ["Design System", "Storybook + Chromatic VRT automatico (NUEVO V28) + componentes primitivos en src/components/ui/"],
    ["Logger", "createLogger(ctx) en src/lib/logger.ts — formato estructurado + Sentry integration"],
    ["Error tracking", "Sentry (@sentry/nextjs) — ACTIVO con SENTRY_DSN en Vercel"],
    ["Hosting", "Vercel (frontend + API) — habitaplan.com DNS apuntado. Auto-deploy desde master"],
    ["CI/CD", "GitHub Actions — tests + build + Chromatic VRT + Smoke CI cada 15min"],
    ["Analytics", "Zero-dep in-house (window.__hp_analytics) — /api/events JSONB. CTR → ranking feedback"],
    ["Almacenamiento", "Supabase Storage (avatares de usuario)"],
    ["Pagos", "Wompi (Colombia) — pendiente mes 6, primer cliente y cuenta bancaria activa"],
  ]
));
children.push(spacer());

// ── SECTION 4: ARQUITECTURA ─────────────────────────────────────────────────
children.push(sectionHeading("4. ARQUITECTURA DEL SISTEMA"));
children.push(subHeading("4.1 Estructura de directorios (v0.15.0)"));
children.push(twoColTable(
  ["Directorio / Archivo", "Contenido"],
  [
    ["src/app/", "Next.js App Router — paginas, layouts, rutas API"],
    ["src/app/actividades/layout.tsx", "NUEVO V28 — Segment layout: CityProvider + Suspense (Server Component, scope limitado)"],
    ["src/app/seguridad/", "Hub Centro de Seguridad con 3 subpaginas legales + PDFs"],
    ["src/app/api/events/", "POST /api/events — analytics zero-dep: page_view, activity_view, outbound_click, search_applied"],
    ["src/app/api/activities/map/", "GET /api/activities/map — actividades con coords para mapa (max 500, cityId requerido)"],
    ["src/lib/city/resolveCity.ts", "NUEVO V28 — resolveCityId() SSOT: URL > localStorage > default (city con mas locations en BD)"],
    ["src/lib/track.ts", "Motor analytics in-house con throttle. trackEvent() fail-silent async"],
    ["src/lib/prisma-serialize.ts", "NUEVO V28 — serializeActivity/Location, toNumber/toISOString — capa segura Server→Client"],
    ["src/hooks/useLocalStorage.ts", "NUEVO V28 — SSR-safe, React 19 safe. Triple: [value, setter, mounted]"],
    ["src/config/feature-flags.ts", "PARSER_FALLBACK_ENABLED y otros feature flags. Default: true"],
    ["src/modules/legal/constants/", "SSOT: privacy.ts, terms.ts, data-treatment.ts — UI y PDF consumen los mismos objetos"],
    ["src/modules/scraping/parser/", "Parser Resiliente: parser.ts orchestrator + fallback-mapper.ts + parser.types.ts"],
    ["src/modules/scraping/utils/date-preflight.ts", "evaluatePreflight() — skip NLP para eventos pasados >14d. 3 capas: datetime HTML + texto + keywords/anos"],
    ["src/modules/scraping/utils/preflight-db.ts", "savePreflightLog() — fire-and-forget a table date_preflight_logs"],
    ["src/lib/intent-manager.ts", "NUEVO V28 — localStorage key hp_intent, TTL 15min. Persiste accion pendiente para post-auth"],
    ["src/lib/require-auth.ts", "requireAuth() — UNICO punto de auth pre-accion. Redirige a login con intent guardado"],
    ["src/components/IntentResolver.tsx", "NUEVO V28 — Montado globalmente en layout. Resuelve intent tras login exitoso"],
    ["src/app/api/health/", "GET /api/health — check DB + Redis timeouts 2000ms. ok/degraded/down + by_city JOIN SQL"],
    ["src/middleware.ts", "Middleware global Next.js — protege /api/admin/* automaticamente"],
    ["scripts/ingest-sources.ts", "Ingesta multi-fuente con canales (--channel/--source/--list/--save-db/--dry-run)"],
    ["scripts/generate_v28.mjs", "Genera este Documento Fundacional V28 (.docx)"],
    ["prisma/", "Schema de BD y prisma.config.ts (DATABASE_URL)"],
    ["docs/modules/design-system.md", "NUEVO V28 — Documentacion completa del Design System: tokens, Storybook, Chromatic"],
  ]
));
children.push(spacer());
children.push(subHeading("4.2 Principios arquitecturales"));
children.push(bodyParagraph("URL como SSOT de ciudad (NUEVO V28): ?cityId= es la unica fuente de verdad. Jerarquia: URL > localStorage > default. Backend requiere cityId explicito (HTTP 400 sin el). Sin fallback geografico implicito.", { bullet: true }));
children.push(bodyParagraph("CityProvider en segment layout (NUEVO V28): montado en /actividades/layout.tsx (Server Component) — no en root layout. Evita query global innecesaria. Suspense obligatorio por useSearchParams().", { bullet: true }));
children.push(bodyParagraph("EMERGENCY_CENTER (NUEVO V28): renombrado DEFAULT_CENTER en MapInner.tsx — coords hardcodeadas de Bogota son ultimo recurso defensivo, no comportamiento normal.", { bullet: true }));
children.push(bodyParagraph("Prisma Serialize obligatorio: NUNCA pasar objeto Prisma directo a Client Component. Usar serializeActivity/serializeLocation desde @/lib/prisma-serialize.", { bullet: true }));
children.push(bodyParagraph("useLocalStorage SSR-safe: NUNCA usar useSyncExternalStore para localStorage en React 19. Usar useLocalStorage<T> de @/hooks/useLocalStorage — triple: [value, setter, mounted].", { bullet: true }));
children.push(bodyParagraph("Design System SSOT (NUEVO V28): hp-tokens semanticos — prohibido bg-orange-X, usar brand/success/error/warning. ESLint bloquea alert()/prompt() y librerias externas de notificacion.", { bullet: true }));
children.push(bodyParagraph("Honest Facets (NUEVO V28): null = 'desconocemos', no cero. price === null significa precio desconocido, no gratuito. Dropdowns > Pill toggles para campos con datos incompletos.", { bullet: true }));
children.push(bodyParagraph("Activity Gate (NUEVO V28): evaluateActivityGate() entre parser y storage — descarta falsos positivos institucionales con trazabilidad diferenciada [discard:llm] vs [discard:gate].", { bullet: true }));
children.push(bodyParagraph("Multi-vertical por configuracion: nuevas verticales = registros en tabla verticals, no cambios de codigo.", { bullet: true }));
children.push(bodyParagraph("DDL via raw SQL: Supabase pgbouncer (transaction mode) incompatible con prisma migrate dev — usar scripts migrate-*.ts.", { bullet: true }));
children.push(bodyParagraph("Logger estructurado: createLogger(ctx) reemplaza todos los console.* — logs con timestamp + nivel + contexto.", { bullet: true }));
children.push(bodyParagraph("Sentry condicional: activo solo si SENTRY_DSN en env — zero overhead sin la variable.", { bullet: true }));
children.push(bodyParagraph("Prisma _count rule: NUNCA usar _count dentro de select anidado de relacion en Prisma 7. Solo en include directo.", { bullet: true }));
children.push(spacer());

// ── SECTION 5: DESIGN SYSTEM ZERO-DEBT (NUEVO V28) ─────────────────────────
children.push(sectionHeading("5. DESIGN SYSTEM ZERO-DEBT — NUEVO V28 (V27, S55+)"));
children.push(subHeading("5.1 Tokens Semanticos hp-tokens"));
children.push(bodyParagraph("Prohibido usar colores nativos de Tailwind (bg-orange-X, text-green-X). Usar tokens semanticos: brand, success, error, warning.", { bullet: true }));
children.push(bodyParagraph("Tokens definidos en tailwind.config con prefijo hp- — permite refactoring centralizado y soporte futuro de modo oscuro.", { bullet: true }));
children.push(bodyParagraph("ring-brand-500 para focus visible (WCAG AA global). Estados disabled y loading manejados por los propios primitivos.", { bullet: true }));
children.push(spacer());
children.push(subHeading("5.2 Storybook + Chromatic VRT"));
children.push(bodyParagraph("Storybook Vite configurado para los componentes primitivos de src/components/ui/.", { bullet: true }));
children.push(bodyParagraph("Chromatic Visual Regression Testing automatico en GitHub Actions — detecta regresiones visuales en cada PR.", { bullet: true }));
children.push(bodyParagraph("Componentes cubiertos: Button, Input, Card, Toast, Avatar, Dropdown, Modal.", { bullet: true }));
children.push(spacer());
children.push(subHeading("5.3 SVG-First Branding SSOT"));
children.push(bodyParagraph("Logo principal: logo.svg es el SSOT (Single Source of Truth) de la identidad visual.", { bullet: true }));
children.push(bodyParagraph("Pipeline de derivacion: npm run generate:brand genera og.png, favicon.png, apple-touch-icon.png automaticamente desde el SVG fuente.", { bullet: true }));
children.push(bodyParagraph("npm run validate:logo — valida que los SVGs no tengan fondos falsos antes de publicar.", { bullet: true }));
children.push(spacer());
children.push(subHeading("5.4 Reglas de UI (Strict)"));
children.push(twoColTable(
  ["Regla", "Detalle"],
  [
    ["Feedback al usuario", "SOLO useToast() de src/components/ui/toast.tsx. Prohibido: react-hot-toast, sonner, react-toastify"],
    ["Dialogs del navegador", "window.alert() y window.prompt() PROHIBIDOS. window.confirm() permitido temporalmente"],
    ["Intent Manager", "requireAuth() es el UNICO punto de auth pre-accion. IntentResolver montado globalmente en layout"],
    ["Colores", "Prohibido bg-orange-X, text-green-X. Usar brand/success/error/warning tokens semanticos"],
    ["ESLint CI", "no-explicit-any: error global — 0 nuevos any sin CI rojo. Legacy en LEGACY_ANY_FILES[] como warn"],
  ]
));
children.push(spacer());

// ── SECTION 6: PIPELINE DE SCRAPING (actualizado V28) ──────────────────────
children.push(sectionHeading("6. PIPELINE DE SCRAPING (v0.15.0)"));
children.push(subHeading("6.1 Flujo principal (Web)"));
children.push(twoColTable(
  ["Paso", "Descripcion"],
  [
    ["1. Extraccion de links", "CheerioExtractor.extractLinksAllPages() — paginacion automatica (Siguiente/Next, ?page=N+1). JSON-LD antes de limpiar scripts"],
    ["2. Pre-filtro binarios", "GeminiAnalyzer excluye .jpg/.png/.gif/.pdf/.mp4/etc — ahorra cuota 20 RPD"],
    ["3. URL Classifier", "score 0-100 filtra ~40% URLs no productivas. Threshold 45. 28 tests, 100% cobertura"],
    ["4. discoverWithFallback", "NUEVO V28 — si PARSER_FALLBACK_ENABLED: intenta Gemini CHUNK_SIZE=100. Si 429/503 → pasa TODOS los URLs (cero perdida)"],
    ["5. Cache incremental", "ScrapingCache dual: disco (scraping-cache.json) + BD PostgreSQL (tabla scraping_cache). syncFromDb() antes del pipeline"],
    ["6. Extraccion de contenido", "CheerioExtractor.extract() — HTML + JSON-LD + og:image"],
    ["7. Date Preflight v2", "evaluatePreflight() 3 capas: datetime HTML → texto plano → keywords/anos. Omite Gemini para eventos pasados >14d. Ahorra 20 RPD. Metricas en date_preflight_logs"],
    ["8. parseActivity", "NUEVO V28 — Gemini primario (retry x3 backoff) → fallback Cheerio (confidence 0.4, needsReparse=true) si 429/503"],
    ["9. Activity Gate", "NUEVO V28 — evaluateActivityGate(): rechaza si isActivity !== true (Gemini) + verifica intension evento + detecta falsos positivos institucionales"],
    ["10. Normalizacion Zod", "title null/'' → 'Sin titulo'; categories null/[] → ['General']. ActivityNLPResult schema inmutable"],
    ["11. Adaptive Quality Filter", "minDescriptionLength = max(global, source) segun ContentQualityMetric + SourceHealth. Log activity_discarded_adaptive"],
    ["12. Deduplicacion Nivel 1", "Jaccard >75% en saveActivity con ventana ±30 dias — evita duplicados en tiempo real"],
    ["13. Geocoding", "venue-dictionary.ts (~0ms) → Nominatim → cityFallback → null"],
    ["14. Persistencia", "ScrapingStorage.saveActivity() — upsert por sourceUrl, preserva imageUrl existente. ScrapingCache.saveToDb()"],
  ]
));
children.push(spacer());
children.push(subHeading("6.2 Fuentes activas (v0.15.0, 2026-04-23)"));
children.push(twoColTable(
  ["Ciudad / Fuente", "Canal / Estado"],
  [
    ["Bogota — BibloRed", "Web — ~150 actividades activas"],
    ["Bogota — Idartes, Sec. Cultura, Alcaldia, Planetario, Cinemateca, JBB, Banrep, FCE, FUGA Filarmonica", "Web — ~100+ actividades combinadas"],
    ["Bogota — 10 cuentas Instagram", "Instagram (Playwright) — activas"],
    ["Medellin — Parque Explora", "Web — sitemap activo"],
    ["Medellin — Biblioteca Piloto", "Web — sitemap activo"],
    ["Medellin — @parqueexplora, @quehacerenmedellin", "Instagram — validadas, operativas"],
    ["Banrep — 8 ciudades adicionales", "Web — Cali, Barranquilla, Cartagena, Bucaramanga, etc."],
    ["Telegram — @quehaypahacer", "Telegram MTProto via gramjs — pendiente ingest real (bloqueo ISP)"],
    ["Banrep Ibague", "PAUSADA — score 13/100, cuota Gemini insuficiente"],
  ]
));
children.push(spacer());
children.push(subHeading("6.3 Parser Resiliente (NUEVO V28, S52)"));
children.push(bodyParagraph("src/modules/scraping/parser/ — modulo desacoplado de pipeline.ts y gemini.analyzer.ts.", { bullet: true }));
children.push(bodyParagraph("parseActivity(): intenta Gemini → si 429/503 → fallbackFromCheerio() con confidence 0.4, needsReparse=true.", { bullet: true }));
children.push(bodyParagraph("isRetryableError() centralizado en parser.types.ts. ParseResult wrapper — schema ActivityNLPResult inmutable.", { bullet: true }));
children.push(bodyParagraph("PARSER_FALLBACK_ENABLED en feature-flags.ts — rollback sin redeploy en ~2 min via Vercel env vars.", { bullet: true }));
children.push(bodyParagraph("[PARSER:SUMMARY] emitido por batch con metricas: gemini_ok, fallback_used, discarded.", { bullet: true }));
children.push(spacer());
children.push(subHeading("6.4 Date Preflight v2 (NUEVO V28, S48-S50)"));
children.push(bodyParagraph("3 capas en cascada: (1) datetime HTML attribute, (2) texto plano ISO/espanol, (3) keywords/anos en titulo.", { bullet: true }));
children.push(bodyParagraph("Threshold: >14 dias en el pasado → skip Gemini (evento expirado). needsReparse=true si preflight ambiguo.", { bullet: true }));
children.push(bodyParagraph("savePreflightLog() fire-and-forget — persiste metricas en table date_preflight_logs sin bloquear el pipeline.", { bullet: true }));
children.push(bodyParagraph("[DATE-PREFLIGHT:SUMMARY] por batch: urls_checked, skipped_past, passed, ambiguous.", { bullet: true }));
children.push(spacer());
children.push(subHeading("6.5 Activity Gate (NUEVO V28, S58)"));
children.push(bodyParagraph("evaluateActivityGate(data, url) entre parseActivity y saveActivity — capa de calidad post-NLP.", { bullet: true }));
children.push(bodyParagraph("Rechaza si: Gemini declaro isActivity !== true + no hay intencion deterministica de evento.", { bullet: true }));
children.push(bodyParagraph("Detecta falsos positivos institucionales: Gestion, Noticias, Directorio, Politica, Informe.", { bullet: true }));
children.push(bodyParagraph("Trazabilidad diferenciada: [discard:llm] cuando Gemini lo rechazo; [discard:gate] cuando la heuristica lo rechazo.", { bullet: true }));
children.push(spacer());

// ── SECTION 7: MULTI-CITY MAP (NUEVO V28) ───────────────────────────────────
children.push(sectionHeading("7. MULTI-CITY MAP FASE 1 — NUEVO V28 (v0.15.0)"));
children.push(subHeading("7.1 CityProvider y resolveCity.ts"));
children.push(bodyParagraph("src/lib/city/resolveCity.ts — resolveCityId() como SSOT de seleccion de ciudad.", { bullet: true }));
children.push(bodyParagraph("Jerarquia estricta: URL (?cityId=) > localStorage (hp_city) > default (city con mas locations en BD).", { bullet: true }));
children.push(bodyParagraph("CityProvider montado en /actividades/layout.tsx — Server Component, scope limitado donde importa.", { bullet: true }));
children.push(bodyParagraph("Suspense obligatorio por useSearchParams(). Ciudad default determinista: sin hardcode de ciudad.", { bullet: true }));
children.push(spacer());
children.push(subHeading("7.2 Backend strict cityId"));
children.push(bodyParagraph("GET /api/activities/map requiere cityId explicito — HTTP 400 si falta. Sin fallback geografico implicito.", { bullet: true }));
children.push(bodyParagraph("EMERGENCY_CENTER en MapInner.tsx (renombrado desde DEFAULT_CENTER) — coords hardcodeadas Bogota como ultimo recurso defensivo.", { bullet: true }));
children.push(bodyParagraph("En runtime normal el mapa usa city.defaultLat/Lng/Zoom del contexto CityProvider.", { bullet: true }));
children.push(spacer());
children.push(subHeading("7.3 Ciudades disponibles"));
children.push(twoColTable(
  ["Ciudad", "Estado"],
  [
    ["Bogota", "Activa — 29 locations geocodificadas, ~250 actividades"],
    ["Medellin", "Activa — Parque Explora + Biblioteca Piloto web + 2 Instagram"],
    ["Cali, Barranquilla, Cartagena, Bucaramanga", "Registradas via Banrep — ingesta parcial"],
    ["Otras (LATAM)", "Expansion configurada por BD — sin codigo adicional"],
  ]
));
children.push(spacer());

// ── SECTION 8: ANALYTICS Y RANKING ─────────────────────────────────────────
children.push(sectionHeading("8. ANALYTICS IN-HOUSE Y HYBRID RANKING (NUEVO V28, S42-S44)"));
children.push(subHeading("8.1 Analytics Zero-Dependencies"));
children.push(bodyParagraph("window.__hp_analytics — tracker in-house, sin dependencias externas (no GA, no Mixpanel).", { bullet: true }));
children.push(bodyParagraph("src/lib/track.ts — trackEvent() fail-silent async con throttle por tipo de evento.", { bullet: true }));
children.push(bodyParagraph("POST /api/events — ingesta eventos JSONB: page_view, activity_view, activity_click, outbound_click, search_applied.", { bullet: true }));
children.push(bodyParagraph("GET /api/admin/analytics — agrega eventos ultimas 24h por tipo [{ type, _count }].", { bullet: true }));
children.push(spacer());
children.push(subHeading("8.2 CTR Feedback Loop (S44)"));
children.push(bodyParagraph("getCTRByDomain() agrega outbound_click/activity_view via join Event→Activity.sourceUrl. Cache TTL 5min.", { bullet: true }));
children.push(bodyParagraph("ctrToBoost(): tiers >0.3→0.15 / >0.15→0.08 / >0.05→0.03. Cold-start safe: sin datos = boost 0.", { bullet: true }));
children.push(bodyParagraph("computeActivityScore() acepta ctrBoost=0 opcional — fuentes con alto CTR ascienden en ranking.", { bullet: true }));
children.push(bodyParagraph("ingest-sources.ts: combina CTR priority con health priority via Math.min() en BullMQ.", { bullet: true }));
children.push(spacer());
children.push(subHeading("8.3 Adaptive Quality Filter (S43)"));
children.push(bodyParagraph("saveActivity() acepta ctx: AdaptiveContext opcional — default vacio.", { bullet: true }));
children.push(bodyParagraph("saveBatchResults() carga ContentQualityMetric + SourceHealth UNA sola vez antes del loop.", { bullet: true }));
children.push(bodyParagraph("minDescriptionLength = Math.max(adaptive, source) — umbral dinamico por actividad y fuente.", { bullet: true }));
children.push(spacer());

// ── SECTION 9: BUSQUEDA Y FACETS ────────────────────────────────────────────
children.push(sectionHeading("9. BUSQUEDA Y HONEST FACETS (NUEVO V28, S40-S57)"));
children.push(subHeading("9.1 Motor de Busqueda pg_trgm (S47)"));
children.push(bodyParagraph("Indices GIN en activities.title y activities.description. Tolerancia a typos.", { bullet: true }));
children.push(bodyParagraph("Score ponderado: similarity(title)*0.7 + similarity(description)*0.3 + prefixBoost(0.10).", { bullet: true }));
children.push(bodyParagraph("Raw query obtiene IDs coincidentes → Prisma filtra con todos los filtros activos.", { bullet: true }));
children.push(bodyParagraph("Ejemplos: 'taeatro' → teatro | 'natcion' → natacion | 'biblored' → BibloRed.", { bullet: true }));
children.push(spacer());
children.push(subHeading("9.2 Search Assist System (V27)"));
children.push(bodyParagraph("GET /api/activities/suggestions?q= — SuggestionItem[] max 5 (3 acts + 1 cat + 1 ciudad). Min 3 chars.", { bullet: true }));
children.push(bodyParagraph("Cache LRU en memoria (20 entries) en HeroSearch.tsx y Filters.tsx.", { bullet: true }));
children.push(bodyParagraph("AbortController cancela fetch previo en cada keystroke. Historial sessionStorage hp_recent_searches (max 5).", { bullet: true }));
children.push(bodyParagraph("normalizeQuery() NFD (sin tildes) — split palabras >3 letras, retiene max 3 tokens fuertes para pg_trgm.", { bullet: true }));
children.push(bodyParagraph("FEAT-6.8: SearchLog con filtro MIN_FREQ + MIN_CTR en /api/suggestions para evitar typos incompletos en historial.", { bullet: true }));
children.push(spacer());
children.push(subHeading("9.3 Honest Facets UX (S57)"));
children.push(bodyParagraph("Default = universo completo (incluye null). Filtros = subconjuntos explicitos.", { bullet: true }));
children.push(bodyParagraph("NUNCA normalizar null a valores falsos (ej: price ?? 0). price === null = 'desconocemos el precio'.", { bullet: true }));
children.push(bodyParagraph("Dropdowns (<select>) en lugar de Pills mutuamente excluyentes para campos con datos incompletos.", { bullet: true }));
children.push(bodyParagraph("Elimina expectativa aritmetica del usuario (Gestalt mismatch) cuando los datos tienen nulos.", { bullet: true }));
children.push(spacer());

// ── SECTION 10: AUTH Y CUMPLIMIENTO LEGAL ───────────────────────────────────
children.push(sectionHeading("10. AUTENTICACION, ROLES Y CUMPLIMIENTO LEGAL"));
children.push(subHeading("10.1 Magic Link Auth (NUEVO V28, v0.14.1)"));
children.push(bodyParagraph("Supabase Magic Link como metodo primario de autenticacion — email OTP sin contrasena.", { bullet: true }));
children.push(bodyParagraph("SSO social disponible via Supabase Auth providers.", { bullet: true }));
children.push(bodyParagraph("Feature flag para OTP movil (telefono) — pendiente habilitacion.", { bullet: true }));
children.push(bodyParagraph("Cookies HttpOnly SSR via @supabase/ssr — sin tokens en localStorage.", { bullet: true }));
children.push(spacer());
children.push(subHeading("10.2 Intent Manager (NUEVO V28, S53)"));
children.push(bodyParagraph("src/lib/intent-manager.ts — localStorage key hp_intent, TTL 15min.", { bullet: true }));
children.push(bodyParagraph("requireAuth() en src/lib/require-auth.ts — UNICO punto de auth pre-accion. Redirige a login con intent.", { bullet: true }));
children.push(bodyParagraph("IntentResolver.tsx montado globalmente en layout — resuelve intent tras login exitoso.", { bullet: true }));
children.push(bodyParagraph("Aplicado en FavoriteButton: toggle-favorite.ts como servicio HTTP extraido.", { bullet: true }));
children.push(spacer());
children.push(subHeading("10.3 Roles y middleware"));
children.push(bodyParagraph("Roles: ADMIN (acceso total), PROVIDER (dashboard propio si isClaimed), MODERATOR, PARENT.", { bullet: true }));
children.push(bodyParagraph("Middleware global src/middleware.ts: protege /api/admin/* — sin sesion 401, sin ADMIN 403.", { bullet: true }));
children.push(bodyParagraph("Rutas cron (cron/scrape, expire-activities, send-notifications) usan CRON_SECRET — excepciones del middleware.", { bullet: true }));
children.push(spacer());
children.push(subHeading("10.4 Cumplimiento Ley 1581 / SIC"));
children.push(twoColTable(
  ["Requisito SIC", "Estado"],
  [
    ["Responsable del tratamiento identificado", "LISTO — HabitaPlan SAS, info@habitaplan.com"],
    ["Finalidades del tratamiento (incluye CTR tracking)", "LISTO — privacy.ts cubre datos de interaccion + IP/UA bajo Ley 1581 (S45)"],
    ["Derechos ARCO documentados", "LISTO — 15 dias habiles, info@habitaplan.com"],
    ["Transferencias internacionales divulgadas", "LISTO — Supabase/AWS EEUU + Vercel EEUU con nivel de proteccion"],
    ["Politica de menores de edad", "LISTO — consentimiento parental en Child model + clausula en los 3 documentos SSOT"],
    ["PDF descargable", "LISTO — /api/legal/privacidad/pdf + /terminos/pdf + /datos/pdf (server-side)"],
    ["Email auth (SPF+DKIM+DMARC)", "LISTO — SPF: zoho.com + resend.com. DKIM via send.habitaplan.com. DMARC p=reject. Gmail PASS"],
    ["Registro SIC RNBD", "PENDIENTE — registrar en https://rnbd.sic.gov.co (Denys)"],
  ]
));
children.push(spacer());

// ── SECTION 11: MODELO DE DATOS ──────────────────────────────────────────────
children.push(sectionHeading("11. MODELO DE DATOS (v0.15.0)"));
children.push(twoColTable(
  ["Entidad / Tabla BD", "Descripcion"],
  [
    ["Activity", "titulo, descripcion, tipo, status, audiencia, precio, imageUrl, sourceUrl, schedules (JSON), rankingScore, ctrBoost"],
    ["Provider", "name, slug, tipo, isVerified, isClaimed, isPremium, premiumSince, ratingAvg, ratingCount, instagram"],
    ["Sponsor", "Patrocinador newsletter: name, tagline, logoUrl, url, isActive, campaignStart, campaignEnd"],
    ["ProviderClaim", "Solicitud reclamacion: status PENDING/APPROVED/REJECTED, userId, providerId"],
    ["Location", "name, address, neighborhood, latitude (Decimal), longitude (Decimal), cityId"],
    ["City", "name, country, timezone, defaultLat, defaultLng, defaultZoom"],
    ["Category", "name, slug, description, parentId (arbol jerarquico)"],
    ["ActivityCategory", "Relacion N:M Activity <-> Category"],
    ["Vertical", "name, slug (kids, mascotas, etc.) — configurable por BD"],
    ["User", "supabaseAuthId, name, email, role, avatarUrl, onboardingDone, cityId"],
    ["Child", "name, birthDate, gender, consentGivenAt, consentGivenBy, consentText"],
    ["Favorite", "userId, activityId?, locationId? — XOR CHECK constraint (solo uno puede ser no-null)"],
    ["Rating", "calificacion 1-5 estrellas + comentario opcional — una por usuario por actividad"],
    ["PushSubscription", "endpoint, p256dh, auth por usuario"],
    ["ScrapingSource", "url, platform, scraperType, status, isActive, lastRunAt, score"],
    ["ScrapingLog", "Log ejecucion scraping por fuente: ok, error, duration, count"],
    ["scraping_cache", "Cache dual disco+BD: url, sourceKey, scrapedAt, source"],
    ["source_pause_config", "Config auto-pause por fuente/ciudad: pauseAfterScore, minScore"],
    ["source_url_stats", "Estadisticas URL classifier por fuente: total, filtered, passed"],
    ["date_preflight_logs", "Metricas Date Preflight por URL: layer_matched, matched_text, result, savedAt"],
    ["ContentQualityMetric", "Metricas de calidad post-scraping: longitud, ruido, stopwords por fuente"],
    ["Event (analytics)", "Eventos in-house: type, activityId?, path?, metadata JSONB, userId?, createdAt"],
  ]
));
children.push(spacer());

// ── SECTION 12: OBSERVABILIDAD Y CI/CD ──────────────────────────────────────
children.push(sectionHeading("12. OBSERVABILIDAD Y CI/CD"));
children.push(subHeading("12.1 Logger estructurado"));
children.push(bodyParagraph("src/lib/logger.ts — createLogger(ctx). Formato: ISO timestamp + LEVEL + [ctx] + mensaje + extras JSON.", { bullet: true }));
children.push(bodyParagraph("log.error() captura a Sentry si SENTRY_DSN configurado — import dinamico, no bloquea el request.", { bullet: true }));
children.push(bodyParagraph("0 console.* en produccion — migrado a createLogger(ctx) en todos los modulos.", { bullet: true }));
children.push(spacer());
children.push(subHeading("12.2 Sentry — Error Tracking ACTIVO"));
children.push(bodyParagraph("@sentry/nextjs con SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN en Vercel Dashboard.", { bullet: true }));
children.push(bodyParagraph("instrumentation-client.ts inicializa Sentry en browser (onRouterTransitionStart). Zero overhead sin la var.", { bullet: true }));
children.push(spacer());
children.push(subHeading("12.3 Health Check + UptimeRobot + Smoke CI"));
children.push(bodyParagraph("GET /api/health — timeouts DB/Redis 2000ms. Semantica: ok | degraded (Redis falla) | down (DB falla). 503 solo si DB falla.", { bullet: true }));
children.push(bodyParagraph("business_signal: operational (actividades activas) + stale (>48h sin nuevas) + by_city (JOIN SQL NFD slug).", { bullet: true }));
children.push(bodyParagraph("UptimeRobot monitoreando /api/health cada 5min. Alerta por email si cae.", { bullet: true }));
children.push(bodyParagraph("GitHub Actions Smoke CI: */15 * * * * — retry 3/3 + backoff 5s + Slack alert. Archivo: production-smoke.yml.", { bullet: true }));
children.push(spacer());
children.push(subHeading("12.4 GitHub Actions CI/CD"));
children.push(twoColTable(
  ["Workflow", "Descripcion"],
  [
    ["CI principal (en cada push a master)", "Tests (Vitest 1214) + build + TypeScript check. Rechaza si coverage < 85% branches"],
    ["Chromatic VRT (en cada PR)", "Visual Regression Testing automatico via Storybook. Detecta regresiones de UI"],
    ["Smoke CI (*/15 * * * *)", "Ping /api/health — retry 3 + backoff 5s + Slack alert si falla"],
    ["Playwright E2E (en cada push)", "19 tests: auth, actividades, favoritos. Bloqueante en CI"],
  ]
));
children.push(spacer());

// ── SECTION 13: FUNCIONALIDADES UI ───────────────────────────────────────────
children.push(sectionHeading("13. FUNCIONALIDADES DE INTERFAZ (v0.15.0)"));
children.push(subHeading("13.1 Paginas publicas"));
children.push(twoColTable(
  ["Ruta", "Descripcion"],
  [
    ["/", "Landing: hero buscador mixto, stats, categorias, actividades recientes (HeroSearch S37)"],
    ["/actividades", "Filtros facetados (1 fila desktop) + precio Dropdowns + chips activos + modal mobile + CityProvider (NUEVO V28)"],
    ["/actividades/[uuid-slug]", "Detalle: hero, descripcion, fechas, precio, mini-mapa, calificaciones, similares"],
    ["/mapa", "Mapa Leaflet multi-ciudad con CityProvider — EMERGENCY_CENTER como ultimo recurso (NUEVO V28)"],
    ["/seguridad", "Centro de Seguridad: hub de politicas legales (V26)"],
    ["/seguridad/privacidad + /terminos + /datos", "Documentos SSOT + PDFs descargables server-side (V26)"],
    ["/onboarding", "Wizard 3 pasos: Ciudad → Hijos → Listo"],
    ["/perfil/favoritos", "Favoritos Mixtos: actividades + lugares. FavoriteButton polimórfico (V28)"],
    ["/anunciate", "Landing monetizacion con stats y precios"],
    ["/proveedores/[slug]", "Perfil publico del proveedor con claim button"],
  ]
));
children.push(spacer());
children.push(subHeading("13.2 Panel admin (requiere rol ADMIN)"));
children.push(twoColTable(
  ["Ruta", "Descripcion"],
  [
    ["/admin", "Dashboard: Fuentes, Logs, Actividades, Metricas, Patrocinadores"],
    ["/admin/actividades", "Tabla con filtros, busqueda, paginacion, Ocultar/Activar, Editar"],
    ["/admin/sources", "URL Score dashboard + toggle activo/inactivo por fuente"],
    ["/admin/sponsors", "CRUD patrocinadores: crear, activar/desactivar, editar, eliminar"],
    ["/admin/claims", "Lista y gestion de solicitudes de reclamacion de providers"],
    ["/admin/quality", "ContentQualityMetric dashboard — metricas de calidad de ingesta"],
  ]
));
children.push(spacer());
children.push(subHeading("13.3 Favoritos Mixtos (NUEVO V28, S49-S51)"));
children.push(bodyParagraph("Sistema polimorficos: actividades + lugares fisicos. API POST /api/favorites con { targetId, type }.", { bullet: true }));
children.push(bodyParagraph("XOR CHECK constraint en BD — solo activityId O locationId puede ser no-null por registro.", { bullet: true }));
children.push(bodyParagraph("FavoriteButton polimórfico — usa requireAuth() del Intent Manager para auth pre-accion.", { bullet: true }));
children.push(bodyParagraph("toggle-favorite.ts como servicio HTTP extraido — separacion clara de responsabilidades.", { bullet: true }));
children.push(spacer());

// ── SECTION 14: MONETIZACION ─────────────────────────────────────────────────
children.push(sectionHeading("14. MONETIZACION"));
children.push(twoColTable(
  ["Fase", "Estado / Descripcion"],
  [
    ["Mes 1-5 (actual)", "Construir audiencia. 0 ingresos. Infraestructura legal y tecnica LISTA."],
    ["Mes 6", "Newsletter sponsorships: COP 200k-500k/mes. Sponsor model + CRUD + email block LISTOS."],
    ["Mes 9", "Listings premium: COP 150k-300k/mes. isPremium + badge + ordering LISTOS."],
    ["Ano 2", "Freemium proveedores (dashboard analiticas) + cajas de compensacion B2B."],
    ["Largo plazo", "Modelo Fever: de agregador a productor de eventos propios curados."],
    ["Pagos (Wompi)", "Pendiente: requiere cuenta bancaria + primer cliente real. Mes 6."],
  ]
));
children.push(spacer());

// ── SECTION 15: ESTADO ACTUAL ────────────────────────────────────────────────
children.push(sectionHeading("15. ESTADO ACTUAL — v0.15.0 (2026-04-23)"));
children.push(twoColTable(
  ["Metrica", "Valor"],
  [
    ["Actividades en BD", "~275 actividades activas + expiradas (cron diario de expiracion activo)"],
    ["Locations geocodificadas", "29/29 con coordenadas reales (lat/lng != 0)"],
    ["Tests", "1214 tests en 75 archivos — 100% pasando (1212 passed, 2 skipped)"],
    ["Cobertura", ">91% stmts / >85% branches (umbral 85% superado) / >88% funcs"],
    ["TypeScript", "0 errores (tsc --noEmit)"],
    ["npm audit", "3 moderate en @prisma/dev (dev-only, no produccion — mantener hasta Prisma fix)"],
    ["Build", "OK — sin warnings criticos. prisma generate incluido en build script"],
    ["Deployment", "Vercel ACTIVO en habitaplan.com — auto-deploy desde master"],
    ["Design System", "Storybook + Chromatic VRT activo en GitHub Actions"],
    ["Branding", "SVG-First SSOT — og.png, favicon.png generados desde logo.svg via generate:brand"],
    ["Centro de Seguridad", "ACTIVO — /seguridad + 3 subpaginas + 3 APIs PDF"],
    ["CI/CD", "GitHub Actions — tests + build + Chromatic VRT + Smoke CI */15"],
    ["Cola", "BullMQ + Upstash Redis OPERATIVO — Cron scheduler cada 6h"],
    ["Fuentes web", "20 (18 Bogota + 2 Medellin)"],
    ["Fuentes Instagram", "12 (10 Bogota + 2 Medellin)"],
    ["Fuentes Telegram", "1 canal configurado — pendiente ingest real"],
    ["Cache dual", "scraping_cache en BD + disco — sincronizado entre maquinas"],
    ["Gemini", "gemini-2.5-flash, 20 RPD, CHUNK_SIZE=100, pool 4 keys"],
    ["Parser Resiliente", "ACTIVO — fallback Cheerio ante 429/503. PARSER_FALLBACK_ENABLED=true"],
    ["Activity Gate", "ACTIVO — evaluateActivityGate() en pipeline. [discard:llm] vs [discard:gate]"],
    ["Date Preflight v2", "ACTIVO — 3 capas + metricas en date_preflight_logs"],
    ["Sentry", "ACTIVO — SENTRY_DSN en Vercel Dashboard"],
    ["UptimeRobot", "ACTIVO — monitoreando /api/health"],
    ["Smoke CI", "ACTIVO — GitHub Actions */15, retry 3/3 + Slack alert"],
    ["URL Classifier", "ACTIVO — reduce ~40% URLs antes de Gemini"],
    ["Favoritos Mixtos", "ACTIVO — XOR FK constraint aplicado en BD"],
    ["CTR Feedback Loop", "ACTIVO — events → ctrBoost → ranking + BullMQ priority"],
    ["Adaptive Quality Filter", "ACTIVO — ContentQualityMetric + SourceHealth en storage"],
    ["Intent Manager", "ACTIVO — requireAuth() + IntentResolver en layout global"],
    ["Magic Link Auth", "ACTIVO — Supabase Magic Link como metodo primario"],
    ["Multi-City Map", "ACTIVO — CityProvider + resolveCity.ts + cityId strict endpoint"],
    ["Dominio", "habitaplan.com apuntado a Vercel, SSL activo"],
  ]
));
children.push(spacer());
children.push(subHeading("15.1 Historial de versiones (hitos principales)"));
children.push(threeColTable(
  ["Git tag / commit", "Doc", "Hito principal"],
  [
    ["v0.1.0", "V05", "Pipeline scraping, 167 actividades BibloRed"],
    ["v0.4.0", "V09", "Auth SSR, admin, hijos, legal Ley 1581, 294 tests"],
    ["v0.7.3", "V15", "BullMQ + Redis, 14 fuentes, 636 tests"],
    ["v0.8.0", "V18", "Geocoding, mapa, autocompletado, ordenamiento"],
    ["v0.8.1+", "V20", "Monetizacion: sponsors, UTM, isPremium, /anunciate"],
    ["v0.9.0", "V21", "Seguridad, observabilidad, scraping canales. 783 tests"],
    ["v0.9.3", "V22", "Cache dual BD+disco, source-ranking, fix Zod. 797 tests"],
    ["v0.9.4-S35", "V23", "Multi-ciudad Medellin, URL classifier, auto-pause"],
    ["v0.9.8-S40", "V23", "Buscador mixto (acts+cats+ciudades). 889 tests"],
    ["v0.10.0 (S41)", "V25", "Centro de Seguridad SSOT, PDFs Ley 1581 / SIC"],
    ["v0.11.0 (S47)", "V26", "pg_trgm, Sources CRUD BD, Cron scheduler 6h, Intent Manager"],
    ["v0.12.0 (S52)", "V26", "Parser Resiliente, Date Preflight v2, Favoritos Mixtos, XOR FK"],
    ["v0.13.0", "V27", "Design System Zero-Debt, hp-tokens, Chromatic VRT, Storybook"],
    ["v0.13.1", "V27", "Search Assist System, Hybrid Ranking E2E"],
    ["v0.13.2", "V27", "SVG-First Branding SSOT, Brand Asset Pipeline"],
    ["v0.13.3", "V27", "prisma-serialize.ts, useLocalStorage, Prisma _count rule"],
    ["v0.14.1", "V28", "Magic Link Auth, Scraping URL Hardening, Activity Gate"],
    ["v0.15.0 (391d839)", "V28", "Multi-City Map Fase 1, CityProvider, resolveCity.ts. 1214 tests"],
  ]
));
children.push(spacer());

// ── SECTION 16: TESTING ──────────────────────────────────────────────────────
children.push(sectionHeading("16. TESTING (v0.15.0)"));
children.push(twoColTable(
  ["Metrica", "Valor"],
  [
    ["Framework", "Vitest 4 + @vitest/coverage-v8 + React Testing Library"],
    ["Tests totales", "1214 en 75 archivos (1212 passed, 2 skipped)"],
    ["Threshold", "85% branches (cap fijo desde dia 16 del proyecto)"],
    ["Statements", ">91%"],
    ["Branches", ">85%"],
    ["Functions", ">88%"],
    ["Lines", ">91%"],
    ["Duracion", "~20 segundos"],
    ["E2E", "19 tests Playwright (auth, actividades, favoritos) — bloqueantes en CI"],
  ]
));
children.push(spacer());
children.push(bodyParagraph("Modulos al 100%: lib/utils, lib/validation, lib/auth, lib/activity-url, lib/venue-dictionary, lib/expire-activities, scraping/cache, scraping/types, scraping/storage, activities/schemas, activities/service, activities/ranking, analytics/metrics.", { bullet: true }));
children.push(bodyParagraph("Gap justificado: playwright.extractor.ts (~90% funcs) — callbacks page.$$eval() ejecutan en contexto browser, inaccesibles en unit tests.", { bullet: true }));
children.push(bodyParagraph("Patron critico: vi.hoisted(() => vi.fn()) para mock functions en factories de vi.mock(). countCache.clear() entre tests concurrentes.", { bullet: true }));
children.push(spacer());

// ── SECTION 17: DEUDA TECNICA CONOCIDA ──────────────────────────────────────
children.push(sectionHeading("17. DEUDA TECNICA CONOCIDA Y ACEPTADA"));
children.push(twoColTable(
  ["ID", "Descripcion y Mitigacion"],
  [
    ["DEBT-01 (CERRADO)", "Copyright descripciones pre-S41. COMPLETADO (S43): Fase 1 y 2 de reescritura con rule-based y NLP."],
    ["DEBT-02", "235 usos de any pre-existentes en pipeline.ts, storage.ts, gemini.analyzer.ts. CONGELADO (S45): ESLint bloquea nuevos any. Boy Scout Rule: reducir al tocar cada archivo."],
    ["DEBT-03", "3 vulnerabilidades moderate en @prisma/dev (dev-only, no produccion). Esperar fix Prisma. No aplicar --force."],
    ["FEAT-6.8-1", "SearchLog contaminado con typos incompletos. Plan: filtro MIN_FREQ + MIN_CTR en /api/suggestions."],
    ["FEAT-6.8-2", "Busquedas largas fallan en pg_trgm. Plan: normalizeQuery() NFD split palabras >3 letras, max 3 tokens."],
    ["PENDIENTE OPERATIVO", "npx tsx scripts/migrate-favorites-xor.ts (verificar aplicado en prod). npx tsx scripts/migrate-date-preflight-logs.ts."],
    ["PENDIENTE LEGAL", "Registro SIC RNBD en https://rnbd.sic.gov.co — responsabilidad de Denys."],
    ["PENDIENTE INGEST", "Telegram real sin --dry-run (@quehaypahacer). Bloqueado por ISP Colombia. Distrito Joven BTA."],
  ]
));
children.push(spacer());

// ── SECTION 18: ROADMAP ──────────────────────────────────────────────────────
children.push(sectionHeading("18. ROADMAP"));
children.push(subHeading("Corto plazo (v0.15.x — v0.16.0)"));
children.push(twoColTable(
  ["Item", "Descripcion"],
  [
    ["Multi-City Map Fase 2", "Filtro por ciudad en /actividades persistido en URL. Switch de ciudad en header."],
    ["Telegram ingest real", "npx tsx scripts/ingest-telegram.ts sin --dry-run cuando red sin bloqueo ISP"],
    ["Distrito Joven BTA ingest", "npx tsx scripts/ingest-sources.ts --source='Distrito Joven BTA' --save-db"],
    ["Actividades Qué hacer Medellín", "3 posts fallados en S55 por cuota Gemini — reintentar tras reset quota"],
    ["normalizeQuery NFD", "Implementar FEAT-6.8-2 para busquedas largas en pg_trgm"],
    ["SearchLog filtro", "Implementar FEAT-6.8-1 — MIN_FREQ + MIN_CTR en suggestions API"],
  ]
));
children.push(spacer());
children.push(subHeading("Mediano plazo (v1.0.0 — MVP publico)"));
children.push(bodyParagraph("Primer cliente sponsor newsletter (mes 6) — requiere cuenta Wompi activa.", { bullet: true }));
children.push(bodyParagraph("Primer proveedor premium (mes 9) — isClaimed + isPremium.", { bullet: true }));
children.push(bodyParagraph("Pagos Wompi: PSE + tarjeta + Nequi.", { bullet: true }));
children.push(bodyParagraph("Meilisearch Cloud — activar cuando +1.000 actividades activas.", { bullet: true }));
children.push(bodyParagraph("Renombrar repo GitHub → habitaplan (Settings → Rename).", { bullet: true }));
children.push(bodyParagraph("Renombrar proyecto Vercel → habitaplan.", { bullet: true }));
children.push(spacer());
children.push(subHeading("Largo plazo"));
children.push(bodyParagraph("Facebook Pages y TikTok como fuentes (channel ya tipificado en codigo).", { bullet: true }));
children.push(bodyParagraph("App movil (React Native o PWA mejorada).", { bullet: true }));
children.push(bodyParagraph("Segunda vertical: adultos mayores o mascotas.", { bullet: true }));
children.push(bodyParagraph("Expansion a Cali y otras ciudades como verticales completas.", { bullet: true }));
children.push(spacer());

// ── SECTION 19: SCRIPTS UTILES ──────────────────────────────────────────────
children.push(sectionHeading("19. SCRIPTS Y COMANDOS UTILES"));
children.push(twoColTable(
  ["Comando", "Descripcion"],
  [
    ["npm run dev", "Servidor de desarrollo Next.js (Turbopack)"],
    ["npm test", "Correr todos los tests (1214 tests)"],
    ["npm run test:coverage", "Tests + reporte de cobertura (threshold 85% branches)"],
    ["npm run generate:brand", "Genera og.png, favicon.png, apple-touch-icon.png desde SVG fuente"],
    ["npm run validate:logo", "Valida que los SVGs no tengan fondos falsos"],
    ["npx tsx scripts/ingest-sources.ts --list", "Ver inventario de fuentes por canal"],
    ["npx tsx scripts/ingest-sources.ts --save-db", "Ingest completo a BD (todas las fuentes)"],
    ["npx tsx scripts/ingest-sources.ts --source=banrep --save-db", "Solo Banrep — ahorra cuota Gemini"],
    ["npx tsx scripts/ingest-sources.ts --channel=web --save-db", "Solo fuentes web"],
    ["npx tsx scripts/ingest-sources.ts --channel=instagram --save-db", "Solo fuentes Instagram"],
    ["npx tsx scripts/clear-gemini-quota.ts", "Limpia estado de cuota Gemini en Redis (reset manual)"],
    ["npx tsx scripts/run-worker.ts", "Iniciar el worker BullMQ para procesar jobs"],
    ["npx tsx scripts/promote-admin.ts <email>", "Dar rol ADMIN a un usuario"],
    ["npx tsx scripts/verify-db.ts", "Verificar estado de la BD"],
    ["npx tsx scripts/backfill-geocoding.ts [--dry-run]", "Geocodificar locations con coords 0,0"],
    ["npx tsx scripts/backfill-images.ts", "Extraer og:image para actividades sin imagen"],
    ["npx tsx scripts/source-ranking.ts [--weeks=4]", "Ranking de fuentes por produccion/volumen/alcance"],
    ["npx tsx scripts/test-instagram.ts <URL> --validate-only", "Validar cuenta Instagram sin consumir Gemini"],
    ["npx tsx scripts/ingest-telegram.ts [--dry-run]", "Ingestar canales Telegram"],
    ["node scripts/generate_v28.mjs", "Generar este Documento Fundacional V28"],
  ]
));
children.push(spacer());

// ── FINAL NOTE ───────────────────────────────────────────────────────────────
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(new Paragraph({
  children: [new TextRun({ text: "HabitaPlan — Documento Fundacional V28", size: 18, font: "Arial", color: "999999", italics: true })],
  alignment: AlignmentType.CENTER, spacing: { before: 400, after: 80 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Generado por Claude (Anthropic) el 2026-04-23 | Software: v0.15.0 (commit 391d839) | 1214 tests | 75 archivos | 0 errores TS", size: 16, font: "Arial", color: "BBBBBB" })],
  alignment: AlignmentType.CENTER,
}));

// ===================== BUILD DOCUMENT =====================
const doc = new Document({
  numbering: { config: [] },
  sections: [
    {
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [new TextRun({ text: "HABITAPLAN — DOCUMENTO FUNDACIONAL V28", size: 16, font: "Arial", color: "999999" })],
              alignment: AlignmentType.RIGHT,
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LIGHT_BLUE } },
            }),
          ],
        }),
      },
      footers: {
        default: new DocxFooter({
          children: [
            new Paragraph({
              children: [new TextRun({ text: "Confidencial — Uso interno | habitaplan.com", size: 16, font: "Arial", color: "BBBBBB", italics: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.2),
            right: convertInchesToTwip(1.2),
          },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      children,
    },
  ],
});

const OUTPUT_PATH = "C:\\Users\\denys\\Projects\\infantia\\Infantia_Claude\\HabitaPlan_Documento_Fundacional_V28.docx";

Packer.toBuffer(doc).then((buffer) => {
  writeFileSync(OUTPUT_PATH, buffer);
  console.log(`Documento generado: ${OUTPUT_PATH}`);
});
