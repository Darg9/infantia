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
const GREEN      = "1E8449";
const AMBER      = "D4AC0D";
const RED        = "922B21";

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

function threeColTable(headers, rows, widths = [35, 45, 20]) {
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
  children: [new TextRun({ text: "DOCUMENTO FUNDACIONAL V23", bold: true, size: 40, font: "Arial", color: DARK_BLUE })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Plataforma de Descubrimiento de Actividades y Eventos", size: 28, font: "Arial", color: "555555", italics: true })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "2026-04-07", size: 24, font: "Arial", color: "777777" })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Sesion S33 — Rebrand HabitaPlan, nuevo dominio habitaplan.com", size: 20, font: "Arial", color: "999999", italics: true })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 1200 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Documento generado automaticamente por Claude Code — HabitaPlan v0.9.3-S33 (commit 429559a)", size: 18, font: "Arial", color: "BBBBBB", italics: true })],
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
    ["Agregacion multi-fuente", "Web + Instagram + Facebook + TikTok (canales ya tipificados en codigo)"],
    ["Normalizacion inteligente", "NLP con Gemini 2.5 Flash — estructura datos de fuentes heterogeneas"],
    ["Multi-vertical por config", "Ninos, mascotas, adultos mayores — nuevas verticales = registros en BD"],
    ["Multi-ciudad desde dia 1", "Bogota + 9 ciudades Banrep, expansion LATAM por configuracion"],
    ["Geocoding curado", "venue-dictionary.ts con 40+ venues Bogota — coords exactas sin API call (~0ms)"],
    ["Monetizacion integrada", "Sponsors newsletter + listings premium + /anunciate landing — implementado desde mes 0"],
    ["Sistema de seguridad", "Middleware global /api/admin/*, 0 vulnerabilidades npm, security headers completos"],
    ["Observabilidad produccion", "Logger estructurado createLogger(ctx), Sentry ready, /api/health para monitoreo"],
    ["Scraping inteligente", "Filtro pre-Gemini de binarios, sistema de canales --channel/--source, Banrep prioritario"],
    ["Proxy residencial", "IPRoyal ready — codigo listo para escalar scraping Instagram/TikTok sin bloqueos"],
  ]
));
children.push(spacer());

// ── SECTION 3: STACK ────────────────────────────────────────────────────────
children.push(sectionHeading("3. STACK TECNOLOGICO"));
children.push(twoColTable(
  ["Capa", "Tecnologia"],
  [
    ["Framework", "Next.js 16.2.1 (App Router) + TypeScript strict — actualizado S25"],
    ["Estilos", "Tailwind CSS + clsx"],
    ["Base de datos", "PostgreSQL via Supabase (Free Tier)"],
    ["ORM", "Prisma 7 con adapter-pg (PrismaClient con PrismaPg)"],
    ["Autenticacion", "Supabase Auth (SSR cookies, middleware)"],
    ["Scraping web", "Cheerio (HTML) + Playwright (JS-heavy / Instagram) + Proxy residencial (IPRoyal)"],
    ["AI / NLP", "Gemini 2.5 Flash (Google AI Studio, 20 RPD free tier)"],
    ["Email", "Resend + react-email templates (con UTM tracking + bloque sponsor)"],
    ["Cola de tareas", "BullMQ + Upstash Redis (rediss:// TLS, Free Tier)"],
    ["Busqueda", "Meilisearch Cloud free tier — activar cuando +1.000 actividades activas"],
    ["Mapas", "Leaflet 1.9.4 + OpenStreetMap (sin API key)"],
    ["Geocoding", "Nominatim + venue-dictionary.ts curado (40+ venues, sin API key, ~0ms)"],
    ["Logger", "createLogger(ctx) en src/lib/logger.ts — formato estructurado + Sentry integration — NUEVO V21"],
    ["Error tracking", "Sentry (@sentry/nextjs) — activo si SENTRY_DSN en env, zero overhead sin var — NUEVO V21"],
    ["Hosting", "Vercel (frontend + API) + Railway (workers, futuro)"],
    ["CI/CD", "GitHub Actions — tests + build en cada push a master"],
    ["Almacenamiento", "Supabase Storage (avatares de usuario)"],
    ["Pagos", "Wompi (Colombia) — pendiente mes 6, primer cliente y cuenta bancaria activa"],
  ]
));
children.push(spacer());

// ── SECTION 4: ARQUITECTURA ─────────────────────────────────────────────────
children.push(sectionHeading("4. ARQUITECTURA DEL SISTEMA"));
children.push(subHeading("4.1 Estructura de directorios"));
children.push(twoColTable(
  ["Directorio / Archivo", "Contenido"],
  [
    ["src/app/", "Next.js App Router — paginas, layouts, rutas API"],
    ["src/app/api/health/", "GET /api/health — check DB + Redis en tiempo real — NUEVO V21"],
    ["src/app/admin/", "Panel admin: actividades, metricas, scraping, sponsors"],
    ["src/app/proveedores/[slug]/dashboard/", "Dashboard de proveedor — ADMIN o dueno (email + isClaimed)"],
    ["src/app/anunciate/", "Landing de monetizacion para sponsors y proveedores"],
    ["src/middleware.ts", "Middleware global Next.js — protege /api/admin/* automaticamente — NUEVO V21"],
    ["src/modules/", "Modulos de dominio: activities, providers, scraping, etc."],
    ["src/components/", "Componentes UI reutilizables"],
    ["src/lib/logger.ts", "createLogger(ctx) — logger estructurado universal + Sentry — NUEVO V21"],
    ["src/lib/geocoding.ts", "venue-dictionary -> Nominatim -> cityFallback -> null"],
    ["src/lib/push.ts", "Web Push VAPID — sendPushNotification, sendPushToMany"],
    ["src/lib/", "Utilidades compartidas (activity-url, auth, db, venue-dictionary, email)"],
    ["sentry.server.config.ts", "Sentry server-side — activo si SENTRY_DSN en env — NUEVO V21"],
    ["sentry.client.config.ts", "Sentry client-side — activo si NEXT_PUBLIC_SENTRY_DSN — NUEVO V21"],
    [".env.example", "14+ variables de entorno documentadas — NUEVO V21"],
    ["scripts/ingest-sources.ts", "Ingesta multi-fuente con sistema de canales (--channel/--source/--list) — REESCRITO V21"],
    ["scripts/", "Scripts de mantenimiento, migracion y generacion de documentos"],
    ["prisma/", "Schema de BD y migraciones"],
  ]
));
children.push(spacer());
children.push(subHeading("4.2 Principios arquitecturales"));
children.push(bodyParagraph("Multi-vertical por configuracion: nuevas verticales = registros en tabla verticals, no cambios de codigo.", { bullet: true }));
children.push(bodyParagraph("API-first: toda funcionalidad expuesta via endpoints REST en /api/.", { bullet: true }));
children.push(bodyParagraph("Event-driven: scraping asincrono via BullMQ — el worker procesa jobs en background.", { bullet: true }));
children.push(bodyParagraph("Multi-pais desde dia 1: ciudades, monedas y fuentes en BD — sin hardcoding.", { bullet: true }));
children.push(bodyParagraph("Los datos son el activo: normalizacion NLP convierte fuentes heterogeneas en modelo comun.", { bullet: true }));
children.push(bodyParagraph("Diversificacion de fuentes: ninguna fuente > 30% del total de actividades.", { bullet: true }));
children.push(bodyParagraph("Geocoding local primero: venue-dictionary.ts resuelve 40+ venues Bogota en ~0ms antes de llamar Nominatim.", { bullet: true }));
children.push(bodyParagraph("DDL via raw SQL: Supabase pgbouncer (transaction mode) es incompatible con prisma migrate dev — se usan scripts migrate-*.ts.", { bullet: true }));
children.push(bodyParagraph("Logger estructurado: createLogger(ctx) reemplaza todos los console.* — logs con timestamp + nivel + contexto, listos para Vercel Logs y Sentry.", { bullet: true }));
children.push(bodyParagraph("Middleware global de seguridad: src/middleware.ts protege /api/admin/* automaticamente — cualquier ruta nueva queda cubierta sin codigo adicional.", { bullet: true }));
children.push(bodyParagraph("Sentry condicional: activo solo si SENTRY_DSN en env — zero overhead sin la variable; activacion en produccion sin cambio de codigo.", { bullet: true }));
children.push(spacer());

// ── SECTION 5: SEGURIDAD (NUEVO V21) ────────────────────────────────────────
children.push(sectionHeading("5. SEGURIDAD — SPRINT S25 (NUEVO V21)"));
children.push(subHeading("5.1 Hallazgos y correcciones"));
children.push(twoColTable(
  ["ID", "Descripcion y Correccion"],
  [
    ["C-01 (Critico)", "PUT/DELETE /api/activities/:id estaban sin autenticacion. Correccion: requireRole([ADMIN]) agregado a ambos metodos en la misma sesion de la auditoria."],
    ["C-02 (Critico)", "CRON_SECRET tenia fallback inseguro '|| test-secret'. Cualquier request con Authorization: Bearer test-secret ejecutaba el cron. Correccion: eliminado fallback + check !cronSecret antes de comparar."],
    ["npm audit (Alto)", "15 vulnerabilidades: picomatch ReDoS (CVE-2024-21490) + Next.js 16.1.6 (HTTP smuggling, CSRF, DoS). Correccion: npm audit fix + upgrade Next.js 16.2.1. Resultado: 0 vulnerabilidades."],
  ]
));
children.push(spacer());
children.push(subHeading("5.2 Middleware global /api/admin/*"));
children.push(bodyParagraph("src/middleware.ts procesa TODAS las rutas Next.js excepto estaticos y multimedia.", { bullet: true }));
children.push(bodyParagraph("Para rutas /api/admin/*: verifica sesion Supabase y rol ADMIN.", { bullet: true }));
children.push(bodyParagraph("Sin sesion → 401 Unauthorized. Con sesion pero sin rol ADMIN → 403 Forbidden.", { bullet: true }));
children.push(bodyParagraph("Rutas cron (/api/admin/expire-activities, /api/admin/send-notifications) estan en lista de excepciones — se autentican via CRON_SECRET en su propio handler.", { bullet: true }));
children.push(bodyParagraph("Cualquier ruta /api/admin/* futura queda protegida automaticamente sin codigo adicional.", { bullet: true }));
children.push(spacer());
children.push(subHeading("5.3 Security Headers (next.config.ts)"));
children.push(twoColTable(
  ["Header", "Valor / Proposito"],
  [
    ["Content-Security-Policy", "default-src 'self' + fuentes permitidas (Supabase, Google Fonts, OpenStreetMap, CDNs) — previene XSS"],
    ["X-Content-Type-Options", "nosniff — previene MIME sniffing"],
    ["X-Frame-Options", "SAMEORIGIN — previene clickjacking"],
    ["Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload — fuerza HTTPS 2 anos"],
    ["Referrer-Policy", "strict-origin-when-cross-origin — controla datos en referrer"],
    ["Permissions-Policy", "camera=(), microphone=(), geolocation=() — deniega APIs no usadas"],
  ]
));
children.push(spacer());

// ── SECTION 6: OBSERVABILIDAD (NUEVO V21) ───────────────────────────────────
children.push(sectionHeading("6. OBSERVABILIDAD — SPRINT S25 (NUEVO V21)"));
children.push(subHeading("6.1 Logger estructurado — createLogger(ctx)"));
children.push(bodyParagraph("Archivo: src/lib/logger.ts — reemplaza todos los console.* en produccion.", { bullet: true }));
children.push(bodyParagraph("API: const log = createLogger('ctx'); log.info('msg', { meta }); log.error('msg', { error });", { bullet: true }));
children.push(bodyParagraph("Formato de linea: 2026-04-07T22:00:00Z INFO  [ctx] mensaje {\"meta\":\"json\"}", { bullet: true }));
children.push(bodyParagraph("log.error() captura a Sentry si SENTRY_DSN configurado — import dinamico asincrono, no bloquea el request.", { bullet: true }));
children.push(bodyParagraph("Guard defensivo: si meta no es objeto plano (string, Error), se ignora sin serializar como array de chars {\"0\":\"[\",\"1\":\"G\"...}", { bullet: true }));
children.push(bodyParagraph("166 llamadas a console.* migradas a logger en 24 archivos de produccion.", { bullet: true }));
children.push(spacer());
children.push(subHeading("6.2 Sentry — Error Tracking"));
children.push(bodyParagraph("Paquete: @sentry/nextjs — sentry.server.config.ts + sentry.client.config.ts + src/instrumentation.ts.", { bullet: true }));
children.push(bodyParagraph("withSentryConfig en next.config.ts — solo envuelve si SENTRY_DSN esta definido.", { bullet: true }));
children.push(bodyParagraph("tracesSampleRate: 0.1 (server) y 0.05 (client) — evita sobrecarga en produccion.", { bullet: true }));
children.push(bodyParagraph("Para activar: crear cuenta en sentry.io → New Project → Next.js → agregar SENTRY_DSN en Vercel Dashboard.", { bullet: true }));
children.push(bodyParagraph("Sin SENTRY_DSN = zero overhead, la app funciona identico sin Sentry.", { bullet: true }));
children.push(spacer());
children.push(subHeading("6.3 Health Check — GET /api/health"));
children.push(bodyParagraph("Endpoint: GET /api/health — export const dynamic = 'force-dynamic' (nunca cachear).", { bullet: true }));
children.push(bodyParagraph("Check DB: prisma.$queryRaw`SELECT 1` — timeout implicito de Prisma.", { bullet: true }));
children.push(bodyParagraph("Check Redis: redis.ping() con timeout de 3s via Promise.race.", { bullet: true }));
children.push(bodyParagraph("Respuestas: 200 {status:'ok'} | 503 {status:'degraded'} | 503 {status:'down'} — incluye latencyMs, timestamp y version.", { bullet: true }));
children.push(bodyParagraph("Listo para UptimeRobot / BetterUptime — URL: https://habitaplan-activities.vercel.app/api/health", { bullet: true }));
children.push(spacer());

// ── SECTION 7: MODELO DE DATOS ──────────────────────────────────────────────
children.push(sectionHeading("7. MODELO DE DATOS"));
children.push(twoColTable(
  ["Entidad", "Descripcion"],
  [
    ["Activity", "Actividad normalizada: title, description, type, status, audience, price, imageUrl, sourceUrl, schedules (JSON)"],
    ["Provider", "Proveedor: name, slug, type, isVerified, isClaimed, isPremium, premiumSince"],
    ["Sponsor", "Patrocinador newsletter: name, tagline, logoUrl, url, isActive, campaignStart, campaignEnd"],
    ["Location", "Ubicacion: name, address, neighborhood, latitude, longitude, cityId"],
    ["City", "Ciudad: name, country, timezone"],
    ["Category", "Categoria: name, slug, description"],
    ["ActivityCategory", "Relacion N:M Activity <-> Category"],
    ["Vertical", "Vertical de mercado: name, slug (kids, mascotas, etc.)"],
    ["User", "Usuario: supabaseAuthId, name, email, role, avatarUrl"],
    ["Child", "Perfil de hijo: name, birthDate, gender, consentGivenAt"],
    ["Favorite", "Relacion User <-> Activity favoriteada"],
    ["Rating", "Calificacion 1-5 estrellas con comentario opcional"],
    ["PushSubscription", "Suscripcion Web Push: endpoint, p256dh, auth por usuario"],
    ["ScrapingSource", "Fuente de scraping: url, platform, scraperType, status"],
    ["ScrapingLog", "Log de ejecucion de scraping por fuente"],
  ]
));
children.push(spacer());

// ── SECTION 8: PIPELINE DE SCRAPING ─────────────────────────────────────────
children.push(sectionHeading("8. PIPELINE DE SCRAPING"));
children.push(subHeading("8.1 Flujo principal (Web)"));
children.push(twoColTable(
  ["Paso", "Descripcion"],
  [
    ["1. Extraccion de links", "CheerioExtractor.extractLinksAllPages() — sigue paginacion automaticamente"],
    ["2. Pre-filtro binarios", "GeminiAnalyzer excluye .jpg/.png/.gif/.pdf/.mp4/etc antes de Gemini — ahorra cuota — NUEVO V21"],
    ["3. Filtrado IA", "GeminiAnalyzer.discoverActivityLinks() — identifica cuales son actividades"],
    ["4. Cache incremental", "ScrapingCache — omite URLs ya procesadas (reproducible entre runs)"],
    ["5. Extraccion de contenido", "CheerioExtractor.extract() — HTML + JSON-LD + og:image"],
    ["6. Analisis NLP", "GeminiAnalyzer.analyze() — extrae titulo, descripcion, precio, fechas, audiencia"],
    ["7. Enriquecimiento", "og:image adjuntada al resultado NLP si Gemini no la provee"],
    ["8. Deduplicacion", "Jaccard >75% en saveActivity — evita duplicados en tiempo real"],
    ["9. Geocoding", "venue-dictionary.ts (~0ms) -> Nominatim -> cityFallback -> null"],
    ["10. Persistencia", "ScrapingStorage.saveActivity() — upsert por sourceUrl, preserva imageUrl existente"],
  ]
));
children.push(spacer());
children.push(subHeading("8.2 Sistema de canales — ingest-sources.ts (NUEVO V21)"));
children.push(bodyParagraph("Cada fuente tiene un campo 'channel': 'web' | 'instagram' | 'tiktok' | 'facebook'.", { bullet: true }));
children.push(bodyParagraph("--list: muestra inventario de fuentes agrupado por canal con icono (web, instagram, tiktok, facebook).", { bullet: true }));
children.push(bodyParagraph("--channel=web: solo fuentes web. --channel=social: alias para todas las redes sociales.", { bullet: true }));
children.push(bodyParagraph("--source=banrep: filtra por nombre (parcial, sin importar mayusculas). Soporta lista: --source=banrep,cinemateca.", { bullet: true }));
children.push(bodyParagraph("Combinable: --channel=web --source=banrep (AND logico).", { bullet: true }));
children.push(bodyParagraph("Banrep va primero en el orden de ejecucion para aprovechar la cuota de Gemini (20 RPD) en la fuente prioritaria.", { bullet: true }));
children.push(bodyParagraph("Al agregar nuevas fuentes Instagram/TikTok/Facebook, solo se agrega una linea en ALL_SOURCES — los filtros funcionan automaticamente.", { bullet: true }));
children.push(spacer());
children.push(subHeading("8.3 Pre-filtro de URLs binarias (NUEVO V21)"));
children.push(bodyParagraph("GeminiAnalyzer.discoverActivityLinks() excluye antes de llamar a Gemini:", { bullet: true }));
children.push(bodyParagraph("Imagenes: .jpg, .jpeg, .png, .gif, .webp, .svg, .bmp, .tiff", { bullet: true }));
children.push(bodyParagraph("Documentos: .pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx", { bullet: true }));
children.push(bodyParagraph("Media: .mp4, .mp3, .zip", { bullet: true }));
children.push(bodyParagraph("Caso real: JBB publicaba agenda como JPGs — eran 4 requests de cuota perdidos por ejecucion.", { bullet: true }));
children.push(spacer());
children.push(subHeading("8.4 Fuentes activas (14 total — canal web)"));
children.push(twoColTable(
  ["Fuente", "Tipo / Actividades"],
  [
    ["BibloRed (biblored.gov.co)", "Web — 150 actividades, paginacion automatica"],
    ["IDARTES (idartes.gov.co)", "Web — sitemap XML, 19 actividades"],
    ["Bogota.gov.co", "Web — sitemap XML, 20 actividades"],
    ["Cultura, Rec. y Deporte (CRD)", "Web — sitemap XML"],
    ["Planetario de Bogota", "Web — sitemap XML — 25 actividades"],
    ["Cinemateca de Bogota", "Web — sitemap XML — 14 actividades (+13 ingest S26)"],
    ["Jardin Botanico (JBB)", "Web — sitemap XML — 7 actividades (+3 ingest S26)"],
    ["Maloka", "Web — sitemap XML"],
    ["Banrep — Bogota", "Sitemap XML filtrado por /bogota/ (cache: al dia)"],
    ["Banrep — Medellin, Cali, Barranquilla", "Sitemap XML filtrado por ciudad (cache: al dia)"],
    ["Banrep — Cartagena", "Sitemap XML filtrado por /cartagena/ — 1 actividad nueva, 17 pendientes (cuota Gemini)"],
    ["Banrep — Bucaramanga / Manizales / Pereira / Ibague / Santa Marta", "Sitemap XML por ciudad (cache: al dia)"],
  ]
));
children.push(spacer());
children.push(subHeading("8.5 Cola asincrona (BullMQ + Upstash Redis)"));
children.push(bodyParagraph("Jobs de scraping encolados via BullMQ en Upstash Redis (rediss:// TLS, Free Tier).", { bullet: true }));
children.push(bodyParagraph("Worker con concurrencia=1 respeta rate limit de Gemini (20 RPD free tier).", { bullet: true }));
children.push(bodyParagraph("Reintentos exponenciales: 3 intentos, backoff 5s.", { bullet: true }));
children.push(bodyParagraph("Proxy residencial: PlaywrightExtractor lee PLAYWRIGHT_PROXY_SERVER/USER/PASS del .env — backward compatible sin las vars.", { bullet: true }));
children.push(spacer());
children.push(subHeading("8.6 Cache dual disco + BD — scraping_cache (NUEVO S31)"));
children.push(bodyParagraph("ScrapingCache persiste URLs procesadas en PostgreSQL (tabla scraping_cache) ademas del archivo local.", { bullet: true }));
children.push(bodyParagraph("syncFromDb(source): fusiona BD con disco al iniciar — evita re-scrapear en otra maquina.", { bullet: true }));
children.push(bodyParagraph("saveToDb(): persiste URLs nuevas al terminar el pipeline.", { bullet: true }));
children.push(bodyParagraph("Tabla: url TEXT PK, title VARCHAR(500), source VARCHAR(100), scrapedAt TIMESTAMPTZ. Indices en source y scrapedAt.", { bullet: true }));
children.push(spacer());
children.push(subHeading("8.7 Tolerancia Zod ante Gemini impreciso (NUEVO S31)"));
children.push(bodyParagraph("activityNLPResultSchema normaliza: title null/'' → 'Sin titulo'; categories null/[] → ['General'].", { bullet: true }));
children.push(bodyParagraph("sanitizeGeminiResponse() en gemini.analyzer.ts aplica la limpieza antes de Zod — capa adicional de seguridad.", { bullet: true }));
children.push(bodyParagraph("Resultado: posts que antes se descartaban silenciosamente ahora se procesan con valores de fallback.", { bullet: true }));
children.push(spacer());
children.push(subHeading("8.8 Telegram (NUEVO S28-S29)"));
children.push(bodyParagraph("TelegramExtractor via gramjs (MTProto) — autenticacion persistida en TELEGRAM_SESSION.", { bullet: true }));
children.push(bodyParagraph("Canal activo: @quehaypahacer — dry-run detecto 3 actividades. Pendiente correr sin --dry-run.", { bullet: true }));
children.push(bodyParagraph("Nota ISP Colombia: ISP bloquea MTProto. Se requiere VPN para autenticacion inicial (telegram-auth.ts). Una vez obtenida TELEGRAM_SESSION, funciona directo.", { bullet: true }));
children.push(spacer());

// ── SECTION 9: GEOCODING ────────────────────────────────────────────────────
children.push(sectionHeading("9. GEOCODING — VENUE-DICTIONARY + NOMINATIM"));
children.push(twoColTable(
  ["Paso", "Descripcion"],
  [
    ["1. venue-dictionary.ts", "Lookup local en diccionario curado de 40+ venues Bogota — ~0ms, sin API call"],
    ["2. Nominatim (OSM)", "Fallback: geocodificacion via OpenStreetMap — rate limit 1.1s (ToS)"],
    ["3. cityFallback", "Si la direccion falla, geocodifica solo la ciudad"],
    ["4. Fallback null", "Ultimo recurso — la actividad aparece sin pin en el mapa"],
  ]
));
children.push(spacer());
children.push(bodyParagraph("40+ venues de Bogota verificados en OpenStreetMap: BibloRed x15 sedes, Centros de Felicidad x10, Planetario, Jardin Botanico, Maloka, Cinemateca, Museo Nacional, Idartes, Banrep, y mas.", { bullet: true }));
children.push(bodyParagraph("Resultado al 2026-04-07: 29/29 locations en BD con coordenadas reales (lat/lng != 0).", { bullet: true }));
children.push(spacer());

// ── SECTION 10: MONETIZACION ─────────────────────────────────────────────────
children.push(sectionHeading("10. MONETIZACION"));
children.push(twoColTable(
  ["Fase", "Estado / Descripcion"],
  [
    ["Mes 1-5 (actual)", "Construir audiencia. 0 ingresos. Datos y UX. INFRAESTRUCTURA LISTA."],
    ["Mes 6", "Newsletter sponsorships: COP 200k-500k/mes. Sponsor model + CRUD + email block LISTOS."],
    ["Mes 9", "Listings premium: COP 150k-300k/mes. isPremium + badge + ordering LISTOS."],
    ["Ano 2", "Freemium proveedores (dashboard analiticas) + cajas de compensacion B2B."],
    ["Largo plazo", "Modelo Fever: de agregador a productor de eventos propios curados."],
    ["Pagos (Wompi)", "Pendiente: requiere cuenta bancaria + primer cliente real. Mes 6."],
  ]
));
children.push(spacer());
children.push(twoColTable(
  ["Componente", "Estado"],
  [
    ["Sponsor en email digest", "LISTO — bloque entre actividades y CTA, con UTM utm_campaign=newsletter"],
    ["isPremium Provider", "LISTO — campo en BD + badge 'Destacado' (estrella ambar) + ordering preferencial"],
    ["Pagina /anunciate", "LISTO — stats, opciones de patrocinio, precios orientativos"],
    ["Admin sponsors CRUD", "LISTO — /admin/sponsors: crear, activar, editar, eliminar"],
    ["UTM tracking email", "LISTO — todos los links del digest con utm_source/medium/campaign"],
    ["Dashboard proveedor", "LISTO — /proveedores/[slug]/dashboard (ADMIN o dueno verificado)"],
    ["Pasarela Wompi", "PENDIENTE — requiere cuenta bancaria + primer cliente (mes 6)"],
  ]
));
children.push(spacer());

// ── SECTION 11: FUNCIONALIDADES UI ───────────────────────────────────────────
children.push(sectionHeading("11. FUNCIONALIDADES DE INTERFAZ"));
children.push(subHeading("11.1 Paginas publicas"));
children.push(twoColTable(
  ["Ruta", "Descripcion"],
  [
    ["/", "Landing: stats reales, filtros rapidos, top 8 categorias, 8 actividades recientes"],
    ["/actividades", "Grid con filtros facetados + ordenamiento (5 criterios) + toggle Lista/Mapa + autocompletado"],
    ["/actividades/[uuid-slug]", "Detalle: hero imagen/gradiente, descripcion, fechas, precio, mini-mapa Leaflet, calificaciones, similares"],
    ["/mapa", "Mapa Leaflet interactivo — pines por categoria, popup con imagen y link"],
    ["/anunciate", "Landing de monetizacion: stats, opciones de patrocinio y listing premium, contacto"],
    ["/proveedores/[slug]", "Perfil publico del proveedor con actividades activas y anteriores"],
    ["/contribuir", "Formulario para sugerir actividades o instituciones"],
    ["/contacto", "6 motivos de contacto — precompletado desde link 'Reportar error'"],
    ["/login", "Formulario email + contrasena con Supabase Auth"],
    ["/registro", "Crear cuenta con aceptacion de terminos"],
  ]
));
children.push(spacer());
children.push(subHeading("11.2 Zona de usuario (requiere sesion)"));
children.push(twoColTable(
  ["Ruta", "Descripcion"],
  [
    ["/perfil", "Dashboard con resumen: favoritos, hijos, calificaciones"],
    ["/perfil/favoritos", "Grid de actividades guardadas con FavoriteButton"],
    ["/perfil/hijos", "Lista de perfiles de hijos + /perfil/hijos/nuevo"],
    ["/perfil/historial", "Actividades vistas (localStorage, max 50 FIFO)"],
    ["/perfil/notificaciones", "Toggles email/frecuencia + PushButton (Web Push real)"],
    ["/proveedores/[slug]/dashboard", "Dashboard de proveedor: vistas, premium, tabla actividades"],
  ]
));
children.push(spacer());
children.push(subHeading("11.3 Panel admin (requiere rol ADMIN)"));
children.push(twoColTable(
  ["Ruta", "Descripcion"],
  [
    ["/admin", "Dashboard con 5 cards: Fuentes, Logs, Actividades, Metricas, Patrocinadores"],
    ["/admin/actividades", "Tabla con filtros, busqueda, paginacion, botones Ocultar/Activar y Editar"],
    ["/admin/metricas", "Vistas de actividades, busquedas frecuentes, distribucion por tipo y proveedores"],
    ["/admin/sponsors", "CRUD de patrocinadores: crear, activar/desactivar, editar, eliminar"],
    ["/admin/scraping/sources", "Estado de las fuentes de scraping configuradas"],
    ["/admin/scraping/logs", "Historial de scraping y resultados"],
  ]
));
children.push(spacer());

// ── SECTION 12: AUTH Y LEGAL ─────────────────────────────────────────────────
children.push(sectionHeading("12. AUTENTICACION, ROLES Y CUMPLIMIENTO LEGAL"));
children.push(bodyParagraph("Supabase Auth SSR con cookies HttpOnly — sin tokens en localStorage.", { bullet: true }));
children.push(bodyParagraph("Roles: ADMIN (acceso total), PROVIDER (dashboard propio si isClaimed), MODERATOR, PARENT.", { bullet: true }));
children.push(bodyParagraph("requireRole([UserRole.ADMIN]) — redirige a '/' si rol insuficiente.", { bullet: true }));
children.push(bodyParagraph("Middleware global src/middleware.ts: protege /api/admin/* — sin sesion 401, sin ADMIN 403.", { bullet: true }));
children.push(bodyParagraph("PUT/DELETE /api/activities/:id requieren ADMIN (fix C-01 — auditoria S25).", { bullet: true }));
children.push(bodyParagraph("Cumplimiento Ley 1581: /privacidad, /terminos, /tratamiento-datos, ARCO via /contacto.", { bullet: true }));
children.push(bodyParagraph("Menores de edad: modelo Child con consentGivenAt, consentGivenBy, consentText.", { bullet: true }));
children.push(spacer());

// ── SECTION 13: NOTIFICACIONES ──────────────────────────────────────────────
children.push(sectionHeading("13. NOTIFICACIONES (EMAIL + WEB PUSH)"));
children.push(subHeading("Email (Resend + react-email)"));
children.push(bodyParagraph("Templates: welcome.tsx (bienvenida) y activity-digest.tsx (resumen de actividades nuevas).", { bullet: true }));
children.push(bodyParagraph("UTM tracking en todos los links del digest: ?utm_source=habitaplan&utm_medium=email&utm_campaign=digest_{daily|weekly}", { bullet: true }));
children.push(bodyParagraph("Bloque sponsor opcional entre actividades y CTA final — prop 'sponsor' al template.", { bullet: true }));
children.push(bodyParagraph("Cron Vercel: 9am UTC diario (vercel.json). API POST /api/admin/send-notifications — autenticado con CRON_SECRET.", { bullet: true }));
children.push(spacer());
children.push(subHeading("Web Push (VAPID + Service Worker)"));
children.push(bodyParagraph("VAPID keys generadas — public/private key pair para autenticacion del servidor de push.", { bullet: true }));
children.push(bodyParagraph("public/sw.js — Service Worker: maneja eventos 'push' y 'notificationclick'.", { bullet: true }));
children.push(bodyParagraph("API POST /api/push/subscribe — guarda suscripcion (endpoint, p256dh, auth) en BD.", { bullet: true }));
children.push(bodyParagraph("sendPushToMany() limpia automaticamente endpoints expirados (HTTP 410/404).", { bullet: true }));
children.push(spacer());

// ── SECTION 14: ESTADO ACTUAL ────────────────────────────────────────────────
children.push(sectionHeading("14. ESTADO ACTUAL — v0.9.3-S33 (2026-04-07)"));
children.push(twoColTable(
  ["Metrica", "Valor"],
  [
    ["Actividades en BD", "~275 (actividades de marzo expiraron por fecha — ajuste normal de temporada)"],
    ["Locations geocodificadas", "29/29 con coordenadas reales (lat/lng != 0)"],
    ["Tests", "797 tests en 53 archivos — todos verdes"],
    ["Cobertura", "90.66% stmts / 85.18% branches (umbral 85% superado)"],
    ["TypeScript", "0 errores (tsc --noEmit)"],
    ["npm audit", "0 vulnerabilidades"],
    ["Build", "OK — sin warnings criticos"],
    ["console.* en produccion", "0 — 166 llamadas migradas a createLogger(ctx)"],
    ["Deployment", "Vercel ACTIVO en https://habitaplan-activities.vercel.app"],
    ["CI/CD", "GitHub Actions — tests + build en cada push"],
    ["Cola", "BullMQ + Upstash Redis OPERATIVO"],
    ["Fuentes web", "14 (institucional + Banrep 10 ciudades)"],
    ["Fuentes Instagram", "10 cuentas activas (S30)"],
    ["Fuentes Telegram", "1 canal configurado — operativo, pendiente ingest sin --dry-run"],
    ["Cache dual", "scraping_cache en BD + disco — evita re-scrapear entre maquinas (NUEVO S31)"],
    ["Gemini quota", "20 RPD free tier — renovacion medianoche UTC (19:00 COL)"],
    ["Proxy Playwright", "Codigo listo — IPRoyal vars en .env cuando sea necesario"],
    ["Sentry", "ACTIVO — SENTRY_DSN en Vercel Dashboard"],
    ["UptimeRobot", "ACTIVO — monitoreando /api/health"],
  ]
));
children.push(spacer());
children.push(subHeading("14.1 Historial de versiones"));
children.push(threeColTable(
  ["Git tag / commit", "Doc Fundacional", "Hito principal"],
  [
    ["v0.1.0", "V05", "Pipeline scraping, 167 actividades BibloRed"],
    ["v0.2.0", "V07", "/actividades UI, bogota.gov.co, 193 tests"],
    ["v0.3.0", "V08", "Instagram scraping (Playwright)"],
    ["v0.4.0", "V09", "Auth SSR, admin, hijos, legal Ley 1581, 294 tests"],
    ["v0.5.0", "V10", "Filtros facetados, enum audience, ShareButton, 314 tests"],
    ["v0.6.0", "V12", "robots.txt, sitemap, CI/CD, Vercel deployment"],
    ["v0.7.0", "V13", "531 tests, 90.53% coverage, send-notifications"],
    ["v0.7.3", "V15", "Queue tests: 636 tests, queue/* 100% coverage"],
    ["v0.7.5", "V16", "BullMQ + Upstash Redis, Banrep 10 ciudades, URLs canonicas"],
    ["v0.8.0", "V18", "Geocoding Nominatim, mapa, autocompletado, ordenamiento, metricas"],
    ["v0.8.1", "V19", "Mini-mapa detalle, venue-dictionary 40+ venues, backfill-geocoding. 721 tests."],
    ["c355246", "V20", "Monetizacion A-G: sponsors, UTM, isPremium, /anunciate, dashboard proveedor. 748 tests."],
    ["4772444", "V20", "Proxy residencial IPRoyal listo en PlaywrightExtractor"],
    ["50c7f97", "V21", "Seguridad: C-01 (PUT/DELETE auth), C-02 (CRON_SECRET), npm audit 0 vulns"],
    ["5d198d5", "V21", "Observabilidad: Sentry + logger estructurado, 0 console.* en produccion"],
    ["8b85193", "V21", "Middleware global /api/admin/* + /api/health health check"],
    ["50da7ec", "V21", "Scraping: canales --channel/--source/--list, filtro binarios Gemini, fix logger"],
    ["b1e764a", "V21", "Docs completos v0.9.0: CHANGELOG, ARCHITECTURE, TEST_STATUS, CLAUDE.md, modules"],
    ["v0.9.1 (5aeb2fb)", "V21", "Telegram MTProto, provider claim flow, onboarding wizard, ratings aggregation. 792 tests."],
    ["v0.9.2 (ddcea08..05fd928)", "V21", "Instagram 10 fuentes, --validate-only, ratings.test.ts, branches 85.18%. 795 tests."],
    ["v0.9.3 (ddcea08)", "V21", "Instagram 7 cuentas corridas (~23 acts), nueva API key Gemini, fix Vite vuln"],
    ["cddd248 (S31)", "V22", "Cache dual disco+BD, source-ranking, --count-new en test-instagram. 795 tests."],
    ["432b9b0 (S31)", "V22", "Fix Zod Gemini: title null / categories [] normalizados. 797 tests."],
    ["12120fd (S32)", "V22", "Fix cobertura: vi.mock+static imports cache.ts, source-scoring.test.ts 22 tests. 832 tests."],
    ["429559a (S33)", "V23", "Rebrand Infantia → HabitaPlan, dominio habitaplan.com. 71 archivos, 832 tests."],
  ],
  [25, 12, 63]
));
children.push(spacer());

// ── SECTION 15: TESTING ──────────────────────────────────────────────────────
children.push(sectionHeading("15. TESTING"));
children.push(twoColTable(
  ["Metrica", "Valor"],
  [
    ["Framework", "Vitest + @vitest/coverage-v8"],
    ["Tests totales", "832 en 54 archivos"],
    ["Threshold", "85% branches (cap fijo desde dia 16 del proyecto)"],
    ["Statements", "90.95%"],
    ["Branches", "85.69%"],
    ["Functions", "86.97%"],
    ["Lines", "92.46%"],
  ]
));
children.push(spacer());
children.push(subHeading("Tests nuevos en V23 (S32-S33)"));
children.push(bodyParagraph("telegram-extractor.test.ts (9 tests, S28): extraccion de mensajes, gestion de sesion, manejo de errores.", { bullet: true }));
children.push(bodyParagraph("ratings.test.ts (3 tests, S29): recalcProviderRating, avg null cuando sin ratings, propagacion errores.", { bullet: true }));
children.push(bodyParagraph("types.test.ts +4 tests (S31): normalizacion title null → 'Sin titulo', title '' → 'Sin titulo', categories null → ['General'], categories [] → ['General'].", { bullet: true }));
children.push(bodyParagraph("pipeline.test.ts actualizado (S31): mocks para syncFromDb() y saveToDb() del cache dual.", { bullet: true }));
children.push(bodyParagraph("cache.test.ts +11 tests (S32): syncFromDb (merge, dedup, error) + saveToDb (upsert, clear, error). Fix vi.mock con imports estaticos + function() para Vitest 4.", { bullet: true }));
children.push(bodyParagraph("source-scoring.test.ts 22 tests (S32): calcSourceScore, formatReach, TIER_LABEL, TIER_COLOR.", { bullet: true }));
children.push(spacer());

// ── SECTION 16: ROADMAP ──────────────────────────────────────────────────────
children.push(sectionHeading("16. ROADMAP"));
children.push(subHeading("Corto plazo — v0.9.x (pendiente)"));
children.push(twoColTable(
  ["Item", "Accion requerida"],
  [
    ["Instagram 3 cuentas", "@distritojovenbta, @festiencuentro, @centrodeljapon — pendiente cuota Gemini"],
    ["Banrep 8 ciudades restantes", "npx tsx scripts/ingest-sources.ts --source=banrep --save-db"],
    ["Telegram ingest real", "npx tsx scripts/ingest-telegram.ts sin --dry-run (canal @quehaypahacer)"],
    ["Proxy IPRoyal", "Cuando Instagram empiece a bloquear — PLAYWRIGHT_PROXY_SERVER en Vercel env vars"],
  ]
));
children.push(spacer());
children.push(subHeading("Mediano plazo — v1.0.0 (MVP publico)"));
children.push(bodyParagraph("Primer cliente sponsor newsletter (mes 6) — requiere cuenta Wompi activa.", { bullet: true }));
children.push(bodyParagraph("Primer proveedor premium (mes 9) — isClaimed + isPremium.", { bullet: true }));
children.push(bodyParagraph("Pagos Wompi: PSE + tarjeta + Nequi.", { bullet: true }));
children.push(bodyParagraph("Meilisearch Cloud — activar cuando +1.000 actividades activas.", { bullet: true }));
children.push(bodyParagraph("Segunda vertical o segunda ciudad completa (Medellin o Cali).", { bullet: true }));
children.push(spacer());
children.push(subHeading("Largo plazo"));
children.push(bodyParagraph("Facebook Pages y TikTok como fuentes (channel ya preparado en ingest-sources.ts).", { bullet: true }));
children.push(bodyParagraph("Expansion a Medellin y Cali como verticales de ciudad.", { bullet: true }));
children.push(bodyParagraph("App movil (React Native o PWA mejorada).", { bullet: true }));
children.push(spacer());

// ── SECTION 17: SCRIPTS UTILES ──────────────────────────────────────────────
children.push(sectionHeading("17. SCRIPTS Y COMANDOS UTILES"));
children.push(twoColTable(
  ["Comando", "Descripcion"],
  [
    ["npm run dev", "Servidor de desarrollo Next.js"],
    ["npm test", "Correr todos los tests una vez (797 tests)"],
    ["npm run test:coverage", "Tests + reporte de cobertura (threshold 85%)"],
    ["npx tsx scripts/ingest-sources.ts --list", "Ver inventario de fuentes por canal"],
    ["npx tsx scripts/ingest-sources.ts --save-db", "Ingest completo a BD (todas las fuentes)"],
    ["npx tsx scripts/ingest-sources.ts --source=banrep --save-db", "Solo Banrep — ahorra cuota Gemini"],
    ["npx tsx scripts/ingest-sources.ts --channel=web --save-db", "Solo fuentes web"],
    ["npx tsx scripts/ingest-sources.ts --queue", "Encolar todos los jobs de scraping"],
    ["npx tsx scripts/run-worker.ts", "Iniciar el worker BullMQ para procesar jobs"],
    ["npx tsx scripts/promote-admin.ts <email>", "Dar rol ADMIN a un usuario"],
    ["npx tsx scripts/verify-db.ts", "Verificar estado de la BD"],
    ["npx tsx scripts/backfill-geocoding.ts [--dry-run]", "Geocodificar locations con coords 0,0"],
    ["npx tsx scripts/backfill-images.ts", "Extraer og:image para actividades sin imagen"],
    ["npx tsx scripts/expire-activities.ts", "Expirar actividades manualmente"],
    ["npx tsx scripts/telegram-auth.ts", "Autenticacion one-time Telegram MTProto (NUEVO S28)"],
    ["npx tsx scripts/ingest-telegram.ts [--dry-run]", "Ingestar canales Telegram (NUEVO S28)"],
    ["npx tsx scripts/source-ranking.ts [--weeks=4]", "Ranking de fuentes por produccion/volumen/alcance (NUEVO S31)"],
    ["npx tsx scripts/test-instagram.ts <URL> --count-new", "Contar posts nuevos sin consumir Gemini (NUEVO S31)"],
    ["node scripts/generate_v23.mjs", "Generar este Documento Fundacional V23"],
  ]
));
children.push(spacer());

// ── FINAL NOTE ───────────────────────────────────────────────────────────────
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(new Paragraph({
  children: [new TextRun({ text: "HabitaPlan — Documento Fundacional V23", size: 18, font: "Arial", color: "999999", italics: true })],
  alignment: AlignmentType.CENTER, spacing: { before: 400, after: 80 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Generado por Claude Code el 2026-04-07 | Software: v0.9.3-S33 (commit 429559a) | 832 tests | 54 archivos | 0 vulnerabilidades npm", size: 16, font: "Arial", color: "BBBBBB" })],
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
              children: [new TextRun({ text: "HABITAPLAN — DOCUMENTO FUNDACIONAL V23", size: 16, font: "Arial", color: "999999" })],
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
              children: [new TextRun({ text: "Confidencial — Uso interno", size: 16, font: "Arial", color: "BBBBBB", italics: true })],
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

const OUTPUT_PATH = "C:\\Users\\denys\\OneDrive\\Documents\\DayJul\\Denys\\Infantia\\Infantia_Claude\\HabitaPlan_Documento_Fundacional_V23.docx";

Packer.toBuffer(doc).then((buffer) => {
  writeFileSync(OUTPUT_PATH, buffer);
  console.log(`✅ Documento generado: ${OUTPUT_PATH}`);
});
