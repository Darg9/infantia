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
  children: [new TextRun({ text: "DOCUMENTO FUNDACIONAL V24", bold: true, size: 40, font: "Arial", color: DARK_BLUE })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Plataforma de Descubrimiento de Actividades y Eventos", size: 28, font: "Arial", color: "555555", italics: true })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "2026-04-17", size: 24, font: "Arial", color: "777777" })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Sesiones S34-S54 — Design System, Intent Manager, Parser Resiliente, Favoritos Mixtos, Date Preflight, Legal Center, Analytics, Multi-ciudad Medellin", size: 20, font: "Arial", color: "999999", italics: true })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 1200 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Documento generado automaticamente por Claude Code — HabitaPlan v0.11.0-S54 (commit 15ceec2)", size: 18, font: "Arial", color: "BBBBBB", italics: true })],
  alignment: AlignmentType.CENTER,
}));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ── SECTION 1: VISION ───────────────────────────────────────────────────────
children.push(sectionHeading("1. VISION Y PROBLEMA"));
children.push(bodyParagraph("Las familias con ninos pasan horas buscando actividades en fuentes fragmentadas: sitios web institucionales, Instagram, grupos de WhatsApp, Facebook, Telegram. No existe un lugar centralizado que agregue, normalice y filtre esta informacion."));
children.push(spacer());
children.push(labelValue("La Solucion", "HabitaPlan es un agregador multi-fuente con normalizacion inteligente que centraliza actividades y eventos para ninos, jovenes y familias en ciudades colombianas, con expansion a LATAM."));
children.push(labelValue("Nombre", "HabitaPlan (rebrand desde Infantia, 2026-04-07)"));
children.push(labelValue("Dominio", "habitaplan.com — DNS apuntado a Vercel, activo en produccion"));
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
    ["Agregacion multi-fuente", "Web + Instagram + Telegram + Facebook (canal tipificado) — Bogota + Medellin activos"],
    ["Normalizacion inteligente", "NLP con Gemini 2.5 Flash + Cheerio fallback — datos estructurados desde fuentes heterogeneas"],
    ["Parser Resiliente (NUEVO V24)", "Si Gemini no disponible (429/503), fallback automatico a Cheerio — 0 actividades perdidas por cuota"],
    ["Multi-vertical por config", "Ninos, mascotas, adultos mayores — nuevas verticales = registros en BD, sin codigo nuevo"],
    ["Multi-ciudad desde dia 1", "Bogota + Medellin activos — expansion LATAM por configuracion"],
    ["Geocoding curado", "venue-dictionary.ts con 40+ venues Bogota — coords exactas sin API call (~0ms)"],
    ["Date Preflight 3 capas (NUEVO V24)", "Filtro pre-Gemini: datetime HTML → texto → keywords. Ahorra cuota en eventos pasados."],
    ["Monetizacion integrada", "Sponsors newsletter + listings premium + /anunciate landing — implementado desde mes 0"],
    ["Design System enforced (NUEVO V24)", "ESLint bloquea alert()/prompt()/libr. externas. useToast() UNICO metodo de feedback"],
    ["Intent Manager (NUEVO V24)", "Acciones pre-autenticacion preservadas — post-login se ejecutan automaticamente"],
    ["Observabilidad completa", "Logger estructurado, Sentry, /api/health, UptimeRobot, Date Preflight metrics en BD"],
    ["CTR Feedback Loop (NUEVO V24)", "Clicks de usuarios retroalimentan rankingScore — ranking adaptativo en tiempo real"],
    ["Analytics propios zero-dep (NUEVO V24)", "window.__hp_analytics — sin Google Analytics, sin cookies de terceros, GDPR-safe"],
    ["Legal SSOT (NUEVO V24)", "PDFs de Terminos/Privacidad/Tratamiento generados con react-pdf desde fuente unica"],
  ]
));
children.push(spacer());

// ── SECTION 3: STACK ────────────────────────────────────────────────────────
children.push(sectionHeading("3. STACK TECNOLOGICO"));
children.push(twoColTable(
  ["Capa", "Tecnologia"],
  [
    ["Framework", "Next.js 16.2.1 (App Router) + TypeScript strict"],
    ["Estilos", "Tailwind CSS + clsx — Design System tokens en src/lib/design-tokens.ts"],
    ["Base de datos", "PostgreSQL via Supabase (Free Tier)"],
    ["ORM", "Prisma 7 con adapter-pg (PrismaClient con PrismaPg)"],
    ["Search engine", "pg_trgm (similarity + word_similarity + GIN indexes) — activo en produccion (NUEVO V24)"],
    ["Autenticacion", "Supabase Auth (SSR cookies, middleware)"],
    ["Scraping web", "Cheerio (HTML) + Playwright (JS-heavy / Instagram) + Proxy residencial (IPRoyal)"],
    ["AI / NLP", "Gemini 2.5 Flash (Google AI Studio, 20 RPD free tier) + fallback Cheerio (NUEVO V24)"],
    ["Email", "Resend + react-email templates (UTM tracking + bloque sponsor)"],
    ["Cola de tareas", "BullMQ + Upstash Redis (rediss:// TLS, Free Tier) + Cron scheduler 6h (NUEVO V24)"],
    ["Busqueda", "pg_trgm activo — Meilisearch Cloud free tier cuando +1.000 actividades"],
    ["Mapas", "Leaflet 1.9.4 + OpenStreetMap (sin API key)"],
    ["Geocoding", "Nominatim + venue-dictionary.ts curado (40+ venues, sin API key, ~0ms)"],
    ["Legal docs", "react-pdf — generacion de PDFs desde fuente unica SSOT (NUEVO V24)"],
    ["Analytics", "window.__hp_analytics — zero-dep, sin cookies terceros, GDPR-safe (NUEVO V24)"],
    ["Logger", "createLogger(ctx) en src/lib/logger.ts — formato estructurado + Sentry integration"],
    ["Error tracking", "Sentry (@sentry/nextjs) — activo si SENTRY_DSN en env"],
    ["ESLint", "Reglas custom: no-alert, no-restricted-imports (NUEVO V24) — bloquea libr. externas"],
    ["Hosting", "Vercel (frontend + API) + Railway (workers, futuro)"],
    ["CI/CD", "GitHub Actions — tests + build + smoke CI en cada push a master (NUEVO V24)"],
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
    ["src/app/api/health/", "GET /api/health — check DB + Redis en tiempo real"],
    ["src/app/admin/", "Panel admin: actividades, metricas, scraping, sponsors, quality"],
    ["src/app/admin/quality/", "Dashboard calidad NLP — metricas Date Preflight, parser resiliente (NUEVO V24)"],
    ["src/app/admin/sources/", "CRUD fuentes scraping en BD + toggle activar/desactivar (NUEVO V24)"],
    ["src/app/legal/", "Centro de Seguridad Legal — PDFs react-pdf desde SSOT (NUEVO V24)"],
    ["src/app/proveedores/[slug]/dashboard/", "Dashboard de proveedor — ADMIN o dueno (email + isClaimed)"],
    ["src/app/anunciate/", "Landing de monetizacion para sponsors y proveedores"],
    ["src/middleware.ts", "Middleware global Next.js — protege /api/admin/* automaticamente"],
    ["src/modules/", "Modulos de dominio: activities, providers, scraping, favorites, etc."],
    ["src/modules/scraping/parser/", "parser.ts orchestrator + fallback-mapper.ts Cheerio (NUEVO V24)"],
    ["src/modules/scraping/utils/date-preflight.ts", "Filtro pre-Gemini 3 capas (NUEVO V24)"],
    ["src/modules/scraping/utils/preflight-db.ts", "Persistencia metricas date_preflight_logs (NUEVO V24)"],
    ["src/modules/scraping/nlp/url-classifier.ts", "Clasificador URL pre-Gemini: activity/listing/other (NUEVO V24)"],
    ["src/modules/favorites/toggle-favorite.ts", "Servicio HTTP para toggle favorito — desacoplado de UI (NUEVO V24)"],
    ["src/lib/intent-manager.ts", "Intent Manager — localStorage hp_intent, TTL 15min (NUEVO V24)"],
    ["src/lib/require-auth.ts", "requireAuth() — UNICO punto de auth pre-accion (NUEVO V24)"],
    ["src/components/IntentResolver.tsx", "Resuelve intents post-login — montado globalmente en layout (NUEVO V24)"],
    ["src/components/ui/toast.tsx", "useToast() — UNICO metodo de feedback en Design System (NUEVO V24)"],
    ["src/lib/logger.ts", "createLogger(ctx) — logger estructurado universal + Sentry"],
    ["src/lib/geocoding.ts", "venue-dictionary → Nominatim → cityFallback → null"],
    ["src/lib/ratings.ts", "recalcProviderRating() — ratingAvg/Count siempre actualizados"],
    ["src/lib/analytics.ts", "window.__hp_analytics — tracking zero-dep GDPR-safe (NUEVO V24)"],
    ["src/lib/design-tokens.ts", "Tokens de Design System — colores, tamanios, radios (NUEVO V24)"],
    ["scripts/ingest-sources.ts", "Ingesta multi-fuente con canales (--channel/--source/--list)"],
    ["scripts/source-pause-manager.ts", "Auto-pause de fuentes por score bajo (NUEVO V24)"],
    ["prisma/", "Schema de BD y migraciones"],
  ]
));
children.push(spacer());
children.push(subHeading("4.2 Principios arquitecturales"));
children.push(bodyParagraph("Multi-vertical por configuracion: nuevas verticales = registros en BD, sin codigo nuevo.", { bullet: true }));
children.push(bodyParagraph("API-first: toda funcionalidad expuesta via endpoints REST en /api/.", { bullet: true }));
children.push(bodyParagraph("Event-driven: scraping asincrono via BullMQ — el worker procesa jobs en background.", { bullet: true }));
children.push(bodyParagraph("Multi-pais desde dia 1: ciudades, monedas y fuentes en BD — sin hardcoding.", { bullet: true }));
children.push(bodyParagraph("Parser resiliente: Gemini primario → si 429/503, fallback automatico a Cheerio — nunca falla por cuota.", { bullet: true }));
children.push(bodyParagraph("Design System enforced: ESLint bloquea alert()/prompt()/libr. externas. Toast global es el unico feedback.", { bullet: true }));
children.push(bodyParagraph("Intent Manager: requireAuth() en src/lib/require-auth.ts es el UNICO punto de auth pre-accion.", { bullet: true }));
children.push(bodyParagraph("Date Preflight: 3 capas (datetime HTML → texto → keywords/anos) filtran eventos pasados antes de consumir cuota Gemini.", { bullet: true }));
children.push(bodyParagraph("Los datos son el activo: normalizacion NLP convierte fuentes heterogeneas en modelo comun.", { bullet: true }));
children.push(bodyParagraph("Geocoding local primero: venue-dictionary.ts resuelve 40+ venues Bogota en ~0ms antes de llamar Nominatim.", { bullet: true }));
children.push(bodyParagraph("DDL via raw SQL: Supabase pgbouncer (transaction mode) es incompatible con prisma migrate dev — se usan scripts migrate-*.ts.", { bullet: true }));
children.push(bodyParagraph("Logger estructurado: createLogger(ctx) reemplaza todos los console.* — logs con timestamp + nivel + contexto.", { bullet: true }));
children.push(bodyParagraph("Middleware global de seguridad: src/middleware.ts protege /api/admin/* automaticamente.", { bullet: true }));
children.push(bodyParagraph("Analytics propios: window.__hp_analytics — sin dependencias externas, sin cookies de terceros, GDPR-safe.", { bullet: true }));
children.push(bodyParagraph("Cron scheduler integrado: Vercel Cron dispara BullMQ cada 6h para scraping automatico.", { bullet: true }));
children.push(spacer());

// ── SECTION 5: SEGURIDAD ─────────────────────────────────────────────────────
children.push(sectionHeading("5. SEGURIDAD"));
children.push(subHeading("5.1 Hallazgos y correcciones (Sprint S25)"));
children.push(twoColTable(
  ["ID", "Descripcion y Correccion"],
  [
    ["C-01 (Critico)", "PUT/DELETE /api/activities/:id estaban sin autenticacion. Correccion: requireRole([ADMIN]) agregado."],
    ["C-02 (Critico)", "CRON_SECRET tenia fallback inseguro '|| test-secret'. Correccion: eliminado fallback + check !cronSecret."],
    ["npm audit", "0 vulnerabilidades criticas. defu prototype pollution (S29) y Vite (S30) corregidos. 3 moderate dev-only aceptables."],
  ]
));
children.push(spacer());
children.push(subHeading("5.2 Design System — ESLint enforced (NUEVO V24 — S45/S53)"));
children.push(bodyParagraph("ESLint reglas custom bloquean en build/CI:", { bullet: true }));
children.push(bodyParagraph("no-restricted-globals: alert(), confirm(), prompt() → error en compile time.", { bullet: true }));
children.push(bodyParagraph("no-restricted-imports: react-hot-toast, sonner, @radix-ui/toast y similares externos.", { bullet: true }));
children.push(bodyParagraph("useToast() de src/components/ui/toast.tsx es el UNICO metodo de feedback permitido.", { bullet: true }));
children.push(bodyParagraph("Resultado: feedback consistente en toda la UI, sin libr. externas adicionales.", { bullet: true }));
children.push(spacer());
children.push(subHeading("5.3 Middleware global /api/admin/*"));
children.push(bodyParagraph("src/middleware.ts: Sin sesion → 401 | Sin rol ADMIN → 403.", { bullet: true }));
children.push(bodyParagraph("Rutas cron en lista de excepciones — autenticadas via CRON_SECRET.", { bullet: true }));
children.push(bodyParagraph("Cualquier ruta /api/admin/* futura queda protegida automaticamente.", { bullet: true }));
children.push(spacer());
children.push(subHeading("5.4 Security Headers (next.config.ts)"));
children.push(twoColTable(
  ["Header", "Proposito"],
  [
    ["Content-Security-Policy", "Previene XSS — fuentes: Supabase, Google Fonts, OpenStreetMap, CDNs"],
    ["X-Content-Type-Options: nosniff", "Previene MIME sniffing"],
    ["X-Frame-Options: SAMEORIGIN", "Previene clickjacking"],
    ["Strict-Transport-Security", "Fuerza HTTPS 2 anos (preload)"],
    ["Referrer-Policy: strict-origin-when-cross-origin", "Controla datos en header Referer"],
    ["Permissions-Policy", "Deniega camera, microphone, geolocation"],
  ]
));
children.push(spacer());

// ── SECTION 6: OBSERVABILIDAD ───────────────────────────────────────────────
children.push(sectionHeading("6. OBSERVABILIDAD"));
children.push(subHeading("6.1 Logger estructurado — createLogger(ctx)"));
children.push(bodyParagraph("Archivo: src/lib/logger.ts — reemplaza todos los console.* en produccion.", { bullet: true }));
children.push(bodyParagraph("Formato: 2026-04-17T20:00:00Z INFO  [ctx] mensaje {\"meta\":\"json\"}", { bullet: true }));
children.push(bodyParagraph("log.error() captura a Sentry si SENTRY_DSN configurado — import dinamico, no bloquea el request.", { bullet: true }));
children.push(spacer());
children.push(subHeading("6.2 Sentry + UptimeRobot"));
children.push(bodyParagraph("Sentry activo — SENTRY_DSN en Vercel. tracesSampleRate 0.1 server / 0.05 client.", { bullet: true }));
children.push(bodyParagraph("UptimeRobot activo — monitoreando https://habitaplan.com/api/health.", { bullet: true }));
children.push(spacer());
children.push(subHeading("6.3 Date Preflight — Metricas en BD (NUEVO V24 — S50)"));
children.push(bodyParagraph("Tabla date_preflight_logs: decision (process|skip), razon, matchedText, timestamp por URL.", { bullet: true }));
children.push(bodyParagraph("Dashboard /admin/quality muestra distribucion en tiempo real.", { bullet: true }));
children.push(bodyParagraph("[DATE-PREFLIGHT:SUMMARY] al final de cada batch: total, sent_to_gemini, skip_rate.", { bullet: true }));
children.push(spacer());
children.push(subHeading("6.4 Parser Resiliente — [PARSER:SUMMARY] (NUEVO V24 — S52)"));
children.push(bodyParagraph("[PARSER:SUMMARY] al final de cada batch: gemini_ok, fallback_analyze_count, fallback_discover_count, fallback_rate.", { bullet: true }));
children.push(bodyParagraph("Feature flag PARSER_FALLBACK_ENABLED — desactivable sin deploy.", { bullet: true }));
children.push(spacer());
children.push(subHeading("6.5 Smoke CI (NUEVO V24 — S48)"));
children.push(bodyParagraph("GitHub Actions corre smoke tests en cada push: GET /api/health en staging, build check, lint.", { bullet: true }));
children.push(spacer());

// ── SECTION 7: MODELO DE DATOS ──────────────────────────────────────────────
children.push(sectionHeading("7. MODELO DE DATOS"));
children.push(subHeading("7.1 Entidades principales"));
children.push(twoColTable(
  ["Entidad", "Descripcion"],
  [
    ["Activity", "Actividad: title, description, type, status, audience, price, imageUrl, sourceUrl, schedules (JSON), rankingScore"],
    ["Provider", "Proveedor: name, slug, type, isVerified, isClaimed, isPremium, premiumSince, ratingAvg, ratingCount"],
    ["Sponsor", "Patrocinador newsletter: name, tagline, logoUrl, url, isActive, campaignStart, campaignEnd"],
    ["Location", "Ubicacion: name, address, neighborhood, latitude, longitude, cityId"],
    ["City", "Ciudad: name, country, timezone"],
    ["Category / ActivityCategory", "Categoria + relacion N:M con Activity"],
    ["Vertical", "Vertical de mercado: name, slug (kids, mascotas, etc.)"],
    ["User", "Usuario: supabaseAuthId, name, email, role, avatarUrl, onboardingDone, city"],
    ["Child", "Perfil de hijo: name, birthDate, gender, consentGivenAt"],
    ["Favorite (polimorf.)", "NUEVO V24 — activityId? | locationId? con XOR CHECK constraint BD (S49+S51)"],
    ["Rating", "Calificacion 1-5 estrellas con comentario opcional"],
    ["PushSubscription", "Suscripcion Web Push: endpoint, p256dh, auth por usuario"],
    ["ScrapingSource", "Fuente de scraping: url, platform, scraperType, status — CRUD desde admin (NUEVO V24)"],
    ["ScrapingLog", "Log de ejecucion de scraping por fuente"],
    ["ProviderClaim", "Solicitud de reclamacion: providerId, userId, ClaimStatus enum, email notif (S29)"],
  ]
));
children.push(spacer());
children.push(subHeading("7.2 Tablas de infraestructura / scraping"));
children.push(twoColTable(
  ["Tabla", "Proposito"],
  [
    ["scraping_cache", "Cache dual disco+BD — url PK, title, source, scrapedAt"],
    ["source_pause_config", "Config auto-pause por fuente/ciudad: score, threshold, pausedAt"],
    ["source_url_stats", "Estadisticas URL classifier por fuente: activity/listing/other counts"],
    ["date_preflight_logs", "Metricas Date Preflight por URL: decision, razon, matchedText (NUEVO V24)"],
    ["source_health", "Salud de fuentes: successCount, errorCount, avgResponseMs, scoreHealth"],
  ]
));
children.push(spacer());
children.push(subHeading("7.3 Integridad — Favorites XOR (NUEVO V24 — S51)"));
children.push(bodyParagraph("CHECK constraint: (activityId IS NOT NULL) != (locationId IS NOT NULL) — un favorito apunta a exactamente una entidad.", { bullet: true }));
children.push(bodyParagraph("Aplicado via script migrate-favorites-xor.ts — idempotente.", { bullet: true }));
children.push(spacer());

// ── SECTION 8: PIPELINE DE SCRAPING ─────────────────────────────────────────
children.push(sectionHeading("8. PIPELINE DE SCRAPING"));
children.push(subHeading("8.1 Flujo principal (Web)"));
children.push(twoColTable(
  ["Paso", "Descripcion"],
  [
    ["1. Extraccion de links", "CheerioExtractor.extractLinksAllPages() — paginacion automatica o sitemap XML"],
    ["2. URL Classifier pre-Gemini", "NUEVO V24 — url-classifier.ts clasifica en activity/listing/other sin IA. Ahorra cuota."],
    ["3. Filtrado IA (con fallback)", "NUEVO V24 — discoverWithFallback(): Gemini primario. Si 429/503, pasa TODOS los URLs (conservador)."],
    ["4. Date Preflight 3 capas", "NUEVO V24 — capa 1: <datetime> HTML; capa 2: texto (regex); capa 3: keywords/anos pasados."],
    ["5. Cache + DB diff", "ScrapingCache + diff contra activities BD — omite URLs ya procesadas."],
    ["6. Extraccion de contenido", "CheerioExtractor.extract() — HTML completo + JSON-LD + og:image"],
    ["7. Analisis NLP (con fallback)", "NUEVO V24 — parseActivity(): Gemini primario → si 429/503 → fallbackFromCheerio()."],
    ["8. fallbackFromCheerio()", "NUEVO V24 — extrae titulo (og:title→<title>→<h1>), desc, precio desde HTML real."],
    ["9. Enriquecimiento + Geocoding", "og:image adjuntada; venue-dictionary → Nominatim → cityFallback."],
    ["10. Persistencia", "ScrapingStorage.saveActivity() — upsert por sourceUrl + dedup Jaccard >75%."],
  ]
));
children.push(spacer());
children.push(subHeading("8.2 Date Preflight — 3 capas (NUEVO V24 — S48b/c)"));
children.push(bodyParagraph("Capa 1 (datetime HTML): busca <time datetime='...'> — maxima precision.", { bullet: true }));
children.push(bodyParagraph("Capa 2 (texto plano): patrones regex — '15 de marzo de 2026', '15/03/2026'. Compara vs fecha actual.", { bullet: true }));
children.push(bodyParagraph("Capa 3 (keywords/anos): ano < 2026 junto a palabras clave ('taller 2024', 'conferencia 2023').", { bullet: true }));
children.push(bodyParagraph("skip=true: NLP omitido — ahorra 1 request Gemini por URL. matchedText guardado para auditoria.", { bullet: true }));
children.push(bodyParagraph("Metricas persisten en date_preflight_logs (fire-and-forget, no bloquea pipeline).", { bullet: true }));
children.push(spacer());
children.push(subHeading("8.3 Parser Resiliente — Fallback Cheerio (NUEVO V24 — S52/S54)"));
children.push(bodyParagraph("Fase Descubrimiento: discoverWithFallback() — si Gemini 429/503, pasa TODOS los URLs al pipeline.", { bullet: true }));
children.push(bodyParagraph("Fase Analisis: parseActivity() — si Gemini 429/503, llama fallbackFromCheerio(raw).", { bullet: true }));
children.push(bodyParagraph("fallbackFromCheerio: og:title → <title> → <h1> para titulo; og:description → primer parrafo para desc.", { bullet: true }));
children.push(bodyParagraph("Fix S54: pipeline.ts pasa HTML completo (no texto plano) a rawForFallback.html — extractTitle() funciona.", { bullet: true }));
children.push(bodyParagraph("Feature flag PARSER_FALLBACK_ENABLED — desactivable sin deploy.", { bullet: true }));
children.push(spacer());
children.push(subHeading("8.4 Fuentes activas (2026-04-17)"));
children.push(twoColTable(
  ["Fuente", "Ciudad / Tipo / Estado"],
  [
    ["BibloRed (biblored.gov.co)", "Bogota — Web — 150+ actividades"],
    ["IDARTES (idartes.gov.co)", "Bogota — Web — sitemap XML"],
    ["FUGA — Filarmonica de Bogota", "Bogota — Web — NUEVO V24 — pendiente ingest con Gemini"],
    ["Bogota.gov.co / CRD", "Bogota — Web — sitemap XML"],
    ["Planetario de Bogota", "Bogota — Web — sitemap XML"],
    ["Cinemateca de Bogota", "Bogota — Web — 14 actividades"],
    ["Jardin Botanico (JBB)", "Bogota — Web — 7 actividades"],
    ["Banrep — 10 ciudades", "Multi-ciudad — Web — sitemap XML"],
    ["@biblored / @idartes / @planetariobogota", "Bogota — Instagram — activos"],
    ["@distritojovenbta / @festiencuentro", "Bogota — Instagram — validados, pendiente ingest"],
    ["@parqueexplora", "Medellin — Instagram — NUEVO V24 — validado, pendiente ingest"],
    ["@quehacerenmedellin", "Medellin — Instagram — NUEVO V24 — validado, pendiente ingest"],
    ["Parque Explora / Biblioteca Piloto", "Medellin — Web — NUEVO V24"],
    ["@quehaypahacer (Telegram)", "Bogota — Telegram MTProto — operativo, pendiente ingest sin --dry-run"],
  ]
));
children.push(spacer());
children.push(subHeading("8.5 Cron Scheduler (NUEVO V24 — S47)"));
children.push(bodyParagraph("Vercel Cron dispara POST /api/admin/scraping/cron cada 6 horas.", { bullet: true }));
children.push(bodyParagraph("Encola un BullMQ job por cada fuente activa — worker los procesa secuencialmente.", { bullet: true }));
children.push(bodyParagraph("Resultado: scraping automatico 4 veces al dia sin intervencion manual.", { bullet: true }));
children.push(spacer());

// ── SECTION 9: GEOCODING ────────────────────────────────────────────────────
children.push(sectionHeading("9. GEOCODING — VENUE-DICTIONARY + NOMINATIM"));
children.push(twoColTable(
  ["Paso", "Descripcion"],
  [
    ["1. venue-dictionary.ts", "Lookup local — 40+ venues Bogota curados — ~0ms, sin API call"],
    ["2. Nominatim (OSM)", "Fallback geocodificacion via OpenStreetMap — rate limit 1.1s (ToS)"],
    ["3. cityFallback", "Si la direccion falla, geocodifica solo la ciudad"],
    ["4. Fallback null", "Ultimo recurso — actividad sin pin en el mapa"],
  ]
));
children.push(spacer());
children.push(bodyParagraph("Estado al 2026-04-17: 29/29 locations en BD con coordenadas reales (lat/lng != 0).", { bullet: true }));
children.push(spacer());

// ── SECTION 10: DESIGN SYSTEM + INTENT MANAGER ─────────────────────────────
children.push(sectionHeading("10. DESIGN SYSTEM E INTENT MANAGER (NUEVO V24)"));
children.push(subHeading("10.1 Design System enforced (S45/S53)"));
children.push(bodyParagraph("src/components/ui/toast.tsx: useToast() hook — UNICA fuente de feedback en la UI.", { bullet: true }));
children.push(bodyParagraph("ESLint bloquea en build/CI: alert(), confirm(), prompt(), react-hot-toast, sonner.", { bullet: true }));
children.push(bodyParagraph("Tokens en src/lib/design-tokens.ts — colores, tamanios, radios consistentes.", { bullet: true }));
children.push(bodyParagraph("Upload con AbortController — cancelacion limpia de subidas de imagen (S46).", { bullet: true }));
children.push(spacer());
children.push(subHeading("10.2 Intent Manager — requireAuth() (S53)"));
children.push(bodyParagraph("src/lib/intent-manager.ts guarda intent en localStorage (key hp_intent, TTL 15min).", { bullet: true }));
children.push(bodyParagraph("src/lib/require-auth.ts: UNICO punto de verificacion de autenticacion antes de una accion.", { bullet: true }));
children.push(bodyParagraph("IntentResolver.tsx en el layout raiz: al hacer login, detecta intent pendiente y lo ejecuta automaticamente.", { bullet: true }));
children.push(bodyParagraph("FavoriteButton usa requireAuth() — si no autenticado, guarda intent → /login → al volver, ejecuta toggle.", { bullet: true }));
children.push(spacer());

// ── SECTION 11: ANALYTICS + RANKING ─────────────────────────────────────────
children.push(sectionHeading("11. ANALYTICS Y RANKING ADAPTATIVO (NUEVO V24)"));
children.push(subHeading("11.1 Analytics zero-dep (S42)"));
children.push(bodyParagraph("window.__hp_analytics — objeto global sin dependencias externas.", { bullet: true }));
children.push(bodyParagraph("Eventos: page_view, activity_click, search, filter_use, favorite_add, favorite_remove.", { bullet: true }));
children.push(bodyParagraph("Sin cookies de terceros — GDPR-safe por diseno.", { bullet: true }));
children.push(bodyParagraph("API POST /api/analytics persiste eventos anonimizados en BD.", { bullet: true }));
children.push(spacer());
children.push(subHeading("11.2 CTR Feedback Loop + Ranking Adaptativo (S44)"));
children.push(bodyParagraph("Cada click incrementa rankingScore via PATCH /api/activities/[id]/ctr.", { bullet: true }));
children.push(bodyParagraph("ctrToBoost: CTR > 30% → +0.15 | CTR > 15% → +0.08 | CTR > 5% → +0.03.", { bullet: true }));
children.push(bodyParagraph("Hybrid Ranking: boostScore (CTR) + recency score + source health + premium boost.", { bullet: true }));
children.push(bodyParagraph("Resultado: actividades con mas engagement suben organicamente en el listing.", { bullet: true }));
children.push(spacer());

// ── SECTION 12: MONETIZACION ─────────────────────────────────────────────────
children.push(sectionHeading("12. MONETIZACION"));
children.push(twoColTable(
  ["Fase", "Estado / Descripcion"],
  [
    ["Mes 1-5 (actual)", "Construir audiencia. 0 ingresos. Datos y UX. INFRAESTRUCTURA LISTA."],
    ["Mes 6", "Newsletter sponsorships: COP 200k-500k/mes. Sponsor model + CRUD + email block LISTOS."],
    ["Mes 9", "Listings premium: COP 150k-300k/mes. isPremium + badge + ordering LISTOS."],
    ["Ano 2", "Freemium proveedores (dashboard analiticas) + cajas de compensacion B2B."],
    ["Largo plazo", "Modelo Fever: de agregador a productor de eventos propios curados."],
    ["Pagos (Wompi)", "PENDIENTE: cuenta bancaria + primer cliente real. Mes 6."],
  ]
));
children.push(spacer());
children.push(twoColTable(
  ["Componente", "Estado"],
  [
    ["Sponsor en email digest", "LISTO — bloque entre actividades y CTA, UTM tracking"],
    ["isPremium Provider", "LISTO — campo en BD + badge 'Destacado' + ordering preferencial"],
    ["Pagina /anunciate", "LISTO — stats, opciones de patrocinio, precios orientativos"],
    ["Admin sponsors CRUD", "LISTO — /admin/sponsors: crear, activar, editar, eliminar"],
    ["Dashboard proveedor", "LISTO — /proveedores/[slug]/dashboard"],
    ["Provider claim flow", "LISTO — ProviderClaim + admin UI + email notif + Supabase role update"],
    ["Pasarela Wompi", "PENDIENTE — mes 6"],
  ]
));
children.push(spacer());

// ── SECTION 13: FUNCIONALIDADES UI ───────────────────────────────────────────
children.push(sectionHeading("13. FUNCIONALIDADES DE INTERFAZ"));
children.push(subHeading("13.1 Paginas publicas"));
children.push(twoColTable(
  ["Ruta", "Descripcion"],
  [
    ["/", "Landing: HeroSearch prominente + autocomplete + chips Hoy/Gratis/Cerca. Footer 4 columnas. (S37)"],
    ["/actividades", "Grid: barra filtros unica desktop; modal mobile. Chips activos con X. Estado loading+spinner. (S38-S40)"],
    ["/actividades/[uuid-slug]", "Detalle: hero, descripcion, fechas, precio, mini-mapa Leaflet, RatingForm 3 pasos, similares"],
    ["/mapa", "Mapa Leaflet — pines por categoria, popup con imagen y link"],
    ["/legal", "Centro de Seguridad Legal — PDFs react-pdf Terminos, Privacidad, Tratamiento (S41)"],
    ["/anunciate", "Landing monetizacion: stats, opciones de patrocinio y listing premium"],
    ["/proveedores/[slug]", "Perfil publico del proveedor"],
    ["/contribuir", "Formulario para sugerir actividades"],
    ["/contacto", "6 motivos de contacto"],
    ["/login / /registro", "Auth Supabase SSR"],
  ]
));
children.push(spacer());
children.push(subHeading("13.2 Buscador mixto — Suggestions API (NUEVO V24 — S40)"));
children.push(bodyParagraph("GET /api/suggestions: max 5 = 3 actividades + 1 categoria + 1 ciudad. Tipo SuggestionItem {type, id, label, sublabel}.", { bullet: true }));
children.push(bodyParagraph("Cache LRU 20 entradas. AbortController para cancelar requests. Debounce 300ms.", { bullet: true }));
children.push(bodyParagraph("Historial sessionStorage max 5 — busquedas recientes sin backend.", { bullet: true }));
children.push(spacer());
children.push(subHeading("13.3 Zona de usuario + Panel admin"));
children.push(twoColTable(
  ["Ruta", "Descripcion"],
  [
    ["/perfil/favoritos", "Actividades Y lugares favoritos (polimorficos) con FavoriteButton (S49)"],
    ["/admin/sources", "CRUD fuentes scraping + toggle activar/desactivar + score auto-pause (NUEVO V24)"],
    ["/admin/quality", "Dashboard calidad NLP — Date Preflight metrics, parser fallback rate (NUEVO V24)"],
    ["/admin/sponsors / /admin/actividades / /admin/metricas", "CRUD y reportes (existentes)"],
  ]
));
children.push(spacer());

// ── SECTION 14: AUTH Y LEGAL ─────────────────────────────────────────────────
children.push(sectionHeading("14. AUTENTICACION, ROLES Y CUMPLIMIENTO LEGAL"));
children.push(bodyParagraph("Supabase Auth SSR con cookies HttpOnly — sin tokens en localStorage.", { bullet: true }));
children.push(bodyParagraph("Roles: ADMIN, PROVIDER (isClaimed), MODERATOR, PARENT.", { bullet: true }));
children.push(bodyParagraph("Intent Manager: requireAuth() preserva accion → /login → post-login ejecuta automaticamente.", { bullet: true }));
children.push(bodyParagraph("Cumplimiento Ley 1581: /legal — PDFs react-pdf desde SSOT. /privacidad, /terminos, /tratamiento-datos.", { bullet: true }));
children.push(bodyParagraph("SIC RNBD — pendiente registrar en https://rnbd.sic.gov.co (accion Denys).", { bullet: true }));
children.push(spacer());

// ── SECTION 15: NOTIFICACIONES ──────────────────────────────────────────────
children.push(sectionHeading("15. NOTIFICACIONES (EMAIL + WEB PUSH)"));
children.push(bodyParagraph("Email: Resend + react-email. Templates welcome + activity-digest con UTM y bloque sponsor.", { bullet: true }));
children.push(bodyParagraph("Cron Vercel: 9am UTC diario → POST /api/admin/send-notifications (CRON_SECRET).", { bullet: true }));
children.push(bodyParagraph("Web Push VAPID: public/sw.js + API /api/push/subscribe. sendPushToMany() limpia endpoints expirados.", { bullet: true }));
children.push(spacer());

// ── SECTION 16: ESTADO ACTUAL ────────────────────────────────────────────────
children.push(sectionHeading("16. ESTADO ACTUAL — v0.11.0-S54 (2026-04-17)"));
children.push(twoColTable(
  ["Metrica", "Valor"],
  [
    ["Actividades en BD", "~300+ actividades activas"],
    ["Locations geocodificadas", "29/29 con coordenadas reales"],
    ["Tests", "1157 tests en 73 archivos — todos verdes (+ 2 skipped)"],
    ["Cobertura", ">91% stmts / >85% branches / >88% funcs"],
    ["TypeScript", "0 errores (tsc --noEmit)"],
    ["npm audit", "3 moderate dev-only (@hono/node-server via @prisma/dev — NO --force)"],
    ["Build", "OK — sin warnings criticos"],
    ["Deployment", "Vercel ACTIVO — habitaplan.com"],
    ["CI/CD", "GitHub Actions — tests + build + smoke CI"],
    ["Cola", "BullMQ + Upstash Redis OPERATIVO — Cron 6h activo"],
    ["Fuentes activas", "10 web Bogota + 2 web Medellin + 10 Instagram + 1 Telegram"],
    ["Search engine", "pg_trgm activo — similarity + GIN indexes"],
    ["Date Preflight", "Activo — date_preflight_logs. 3 capas."],
    ["Parser Resiliente", "Activo — PARSER_FALLBACK_ENABLED. Cheerio fallback cuando Gemini 429/503."],
    ["Intent Manager", "Activo — hp_intent localStorage TTL 15min"],
    ["Sentry", "ACTIVO — SENTRY_DSN en Vercel"],
    ["UptimeRobot", "ACTIVO — monitoreando /api/health"],
    ["Analytics", "window.__hp_analytics + CTR Feedback Loop"],
    ["Legal Center", "/legal — PDFs react-pdf desde SSOT"],
  ]
));
children.push(spacer());

children.push(subHeading("16.1 Historial de versiones (S33-S54)"));
children.push(threeColTable(
  ["Git tag / commit", "Doc", "Hito principal"],
  [
    ["429559a (S33)", "V23", "Rebrand Infantia → HabitaPlan, 71 archivos. 835 tests."],
    ["S34 — fc7c1aa..168a465", "V23", "URL classifier (28 tests, 100% cov). Auto-pause dashboard. Banrep Ibague pausado."],
    ["S35 — 08f8a8d..ce060ff", "V23", "Multi-ciudad Medellin (Parque Explora + Bib. Piloto web + IG). Admin toggle fuentes. habitaplan.com DNS."],
    ["S36 — 6418fda", "V23", "Rebrand masivo 71 archivos, CLAUDE.md rutas fisicas. 876 tests."],
    ["S37 — f30addd (v0.9.5)", "V23", "Home UX: HeroSearch, chips, ActivityCard compact, Footer 4 columnas."],
    ["S38 — 871512e", "V23", "Filters.tsx: barra unica desktop, modal mobile, chips activos con X."],
    ["S39 — 67ecb2e (v0.9.7)", "V23", "Header /actividades, loading+spinner, FiltersSkeleton, mobile ordenar."],
    ["S40 — c5efce5 (v0.9.8)", "V23", "Buscador mixto: SuggestionItem, LRU cache, AbortController, debounce. 882 tests."],
    ["S41 — v0.10.0", "V24", "Legal SSOT + react-pdf. /legal con PDFs. 882 tests."],
    ["S42", "V24", "Analytics zero-dep window.__hp_analytics. Hybrid Ranking boostScore + recency."],
    ["S44", "V24", "CTR Feedback Loop. ctrToBoost tiers. Adaptive Quality Filter."],
    ["S45", "V24", "ESLint Freeze: no-alert, no-restricted-imports. Legal SSOT auditoria."],
    ["S46", "V24", "UI Hardening: Toast global, AbortController uploads, A11y, Performance."],
    ["S47 — v0.11.0", "V24", "Sources CRUD en BD. pg_trgm search engine. Vercel Cron → BullMQ 6h."],
    ["S48/b/c", "V24", "Date Preflight v2: 3 capas. Health by_city. Smoke CI. 1082 tests."],
    ["S49", "V24", "Favoritos Mixtos (actvidades+lugares). FavoriteButton polimorfco. 1082 tests."],
    ["S50", "V24", "Date Preflight metricas BD. date_preflight_logs. matchedText. 1101 tests."],
    ["S51", "V24", "Favorites XOR CHECK constraint BD. migrate-favorites-xor.ts. 1105 tests."],
    ["S52", "V24", "Parser Resiliente: fallback Cheerio 429/503. parser.ts + fallback-mapper.ts. 1123 tests."],
    ["S53 — 043aa3e", "V24", "Design System ESLint. Intent Manager. toggle-favorite.ts. requireAuth. 1155 tests."],
    ["S54 — 15ceec2", "V24", "Fix fallback-mapper HTML completo. FUGA + IG Medellin sources. 1157 tests."],
  ],
  [22, 8, 70]
));
children.push(spacer());

// ── SECTION 17: TESTING ──────────────────────────────────────────────────────
children.push(sectionHeading("17. TESTING"));
children.push(twoColTable(
  ["Metrica", "Valor"],
  [
    ["Framework", "Vitest + @vitest/coverage-v8"],
    ["Tests totales", "1157 en 73 archivos (+ 2 skipped)"],
    ["Threshold", "85% branches — cap fijo"],
    ["Statements", ">91%"],
    ["Branches", ">85%"],
    ["Functions", ">88%"],
    ["Tiempo ejecucion", "~20s"],
  ]
));
children.push(spacer());
children.push(subHeading("Tests nuevos V24 (S34-S54 — seleccion)"));
children.push(bodyParagraph("url-classifier.test.ts (28 tests, S34): clasificacion activity/listing/other, 100% cobertura.", { bullet: true }));
children.push(bodyParagraph("date-preflight.test.ts (S48b): 3 capas, casos limite, matchedText preservado.", { bullet: true }));
children.push(bodyParagraph("FavoriteButton.test.tsx (11 tests, S49/S53): estado, toggle, auth, reversion optimista.", { bullet: true }));
children.push(bodyParagraph("gemini-analyzer.test.ts +2 tests (S54): re-lanza 429 si todos lotes fallan; resultados parciales si un lote exitoso.", { bullet: true }));
children.push(bodyParagraph("parser.test.ts (S52): discoverWithFallback, parseActivity con fallback Cheerio.", { bullet: true }));
children.push(bodyParagraph("fallback-mapper.test.ts (S52): extractTitle og:title→title→h1, extractDescription, extractPrice.", { bullet: true }));
children.push(bodyParagraph("favorites.test.ts (S51): XOR constraint, tipo invalido rechazado.", { bullet: true }));
children.push(bodyParagraph("source-scoring.test.ts (22 tests, S32): calcSourceScore, formatReach, TIER_LABEL.", { bullet: true }));
children.push(spacer());

// ── SECTION 18: ROADMAP ──────────────────────────────────────────────────────
children.push(sectionHeading("18. ROADMAP"));
children.push(subHeading("Inmediato — cuando Gemini quota se renueve (~3am COL)"));
children.push(twoColTable(
  ["Item", "Comando"],
  [
    ["FUGA Filarmonica Bogota", "npx tsx scripts/ingest-sources.ts --source=fuga --save-db (~16-26 actividades)"],
    ["@parqueexplora + @quehacerenmedellin", "npx tsx scripts/ingest-sources.ts --source='Parque Explora IG' --save-db"],
    ["@festiencuentro + @distritojovenbta", "npx tsx scripts/ingest-sources.ts --source=festiencuentro --save-db"],
  ]
));
children.push(spacer());
children.push(subHeading("Pendiente — Infra"));
children.push(bodyParagraph("Renombrar repo GitHub → habitaplan (Settings → Rename).", { bullet: true }));
children.push(bodyParagraph("Renombrar proyecto Vercel → habitaplan.", { bullet: true }));
children.push(bodyParagraph("Telegram ingest real — npx tsx scripts/ingest-telegram.ts sin --dry-run.", { bullet: true }));
children.push(bodyParagraph("SIC RNBD — registrar en https://rnbd.sic.gov.co (accion Denys).", { bullet: true }));
children.push(spacer());
children.push(subHeading("Mediano plazo — v1.0.0 (MVP publico)"));
children.push(bodyParagraph("Primer cliente sponsor newsletter (mes 6) — requiere cuenta Wompi activa.", { bullet: true }));
children.push(bodyParagraph("Pagos Wompi: PSE + tarjeta + Nequi.", { bullet: true }));
children.push(bodyParagraph("Meilisearch Cloud — activar cuando +1.000 actividades activas.", { bullet: true }));
children.push(spacer());
children.push(subHeading("Largo plazo"));
children.push(bodyParagraph("Facebook Pages y TikTok (channel ya tipificado en ingest-sources.ts).", { bullet: true }));
children.push(bodyParagraph("Expansion Cali y Barranquilla.", { bullet: true }));
children.push(bodyParagraph("App movil (React Native o PWA).", { bullet: true }));
children.push(spacer());

// ── SECTION 19: SCRIPTS UTILES ──────────────────────────────────────────────
children.push(sectionHeading("19. SCRIPTS Y COMANDOS UTILES"));
children.push(twoColTable(
  ["Comando", "Descripcion"],
  [
    ["npm test", "Correr todos los tests (1157 tests, ~20s)"],
    ["npm run test:coverage", "Tests + reporte de cobertura (threshold 85%)"],
    ["npx tsx scripts/ingest-sources.ts --list", "Ver inventario de fuentes por canal"],
    ["npx tsx scripts/ingest-sources.ts --save-db", "Ingest completo a BD (todas las fuentes)"],
    ["npx tsx scripts/ingest-sources.ts --source=banrep --save-db", "Solo Banrep — ahorra cuota Gemini"],
    ["npx tsx scripts/ingest-sources.ts --source=fuga --save-db", "Solo FUGA Filarmonica (NUEVO V24)"],
    ["npx tsx scripts/ingest-sources.ts --channel=instagram --save-db", "Solo fuentes Instagram"],
    ["npx tsx scripts/ingest-sources.ts --queue", "Encolar todos los jobs de scraping"],
    ["npx tsx scripts/run-worker.ts", "Iniciar el worker BullMQ"],
    ["npx tsx scripts/promote-admin.ts <email>", "Dar rol ADMIN a un usuario"],
    ["npx tsx scripts/verify-db.ts", "Verificar estado de la BD"],
    ["npx tsx scripts/backfill-geocoding.ts [--dry-run]", "Geocodificar locations con coords 0,0"],
    ["npx tsx scripts/backfill-images.ts", "Extraer og:image para actividades sin imagen"],
    ["npx tsx scripts/telegram-auth.ts", "Autenticacion one-time Telegram MTProto"],
    ["npx tsx scripts/ingest-telegram.ts [--dry-run]", "Ingestar canales Telegram"],
    ["npx tsx scripts/source-ranking.ts [--weeks=4]", "Ranking de fuentes por produccion/volumen"],
    ["npx tsx scripts/source-pause-manager.ts", "Calcular scores y pausar fuentes bajas (NUEVO V24)"],
    ["npx tsx scripts/test-instagram.ts <URL> --count-new", "Contar posts nuevos sin consumir Gemini"],
    ["node scripts/generate_v24.mjs", "Generar este Documento Fundacional V24"],
  ]
));
children.push(spacer());

// ── FINAL NOTE ───────────────────────────────────────────────────────────────
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(new Paragraph({
  children: [new TextRun({ text: "HabitaPlan — Documento Fundacional V24", size: 18, font: "Arial", color: "999999", italics: true })],
  alignment: AlignmentType.CENTER, spacing: { before: 400, after: 80 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Generado por Claude Code el 2026-04-17 | Software: v0.11.0-S54 (commit 15ceec2) | 1157 tests | 73 archivos | habitaplan.com activo", size: 16, font: "Arial", color: "BBBBBB" })],
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
              children: [new TextRun({ text: "HABITAPLAN — DOCUMENTO FUNDACIONAL V24", size: 16, font: "Arial", color: "999999" })],
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

const OUTPUT_PATH = "C:\\Users\\denys\\OneDrive\\Documents\\DayJul\\Denys\\Infantia\\Infantia_Claude\\HabitaPlan_Documento_Fundacional_V24.docx";

Packer.toBuffer(doc).then((buffer) => {
  writeFileSync(OUTPUT_PATH, buffer);
  console.log(`✅ Documento generado: ${OUTPUT_PATH}`);
});
