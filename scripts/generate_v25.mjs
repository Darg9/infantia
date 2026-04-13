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
  children: [new TextRun({ text: "DOCUMENTO FUNDACIONAL V25", bold: true, size: 40, font: "Arial", color: DARK_BLUE })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Plataforma de Descubrimiento de Actividades y Eventos para Familias", size: 28, font: "Arial", color: "555555", italics: true })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "2026-04-13", size: 24, font: "Arial", color: "777777" })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Sesion S41 — Centro de Seguridad SSOT, PDFs legales (Ley 1581), v0.10.0 (Minor Bump)", size: 20, font: "Arial", color: "999999", italics: true })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 1200 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Documento generado automaticamente por Antigravity (Google DeepMind) — HabitaPlan v0.11.0-S42 (commits f8bd1db + a3d7dc9)", size: 18, font: "Arial", color: "BBBBBB", italics: true })],
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
    ["Centro de Seguridad SSOT", "NUEVO V25 — /seguridad/* con PDFs legales descargables, arquitectura Single Source of Truth"],
    ["Cumplimiento Ley 1581 SIC", "NUEVO V25 — Privacidad, Terminos y Tratamiento de Datos alineados a SIC Colombia, descargables en PDF"],
    ["Multi-vertical por config", "Ninos, mascotas, adultos mayores — nuevas verticales = registros en BD"],
    ["Multi-ciudad desde dia 1", "Bogota + Medellin activos + 8 ciudades Banrep, expansion LATAM por configuracion"],
    ["Geocoding curado", "venue-dictionary.ts con 40+ venues Bogota — coords exactas sin API call (~0ms)"],
    ["Monetizacion integrada", "Sponsors newsletter + listings premium + /anunciate landing — implementado desde mes 0"],
    ["Sistema de seguridad", "Middleware global /api/admin/*, 0 vulnerabilidades npm, security headers completos"],
    ["Observabilidad produccion", "Logger estructurado createLogger(ctx), Sentry activo, /api/health + UptimeRobot"],
    ["Scraping inteligente", "URL classifier pre-Gemini (-40% cuota), sistema de canales, Banrep prioritario, auto-pause dashboard"],
  ]
));
children.push(spacer());

// ── SECTION 3: STACK ────────────────────────────────────────────────────────
children.push(sectionHeading("3. STACK TECNOLOGICO"));
children.push(twoColTable(
  ["Capa", "Tecnologia"],
  [
    ["Framework", "Next.js 16.2.1 (App Router) + TypeScript strict"],
    ["Estilos", "Tailwind CSS v4 + clsx"],
    ["Base de datos", "PostgreSQL via Supabase (Free Tier, AWS us-east-1)"],
    ["ORM", "Prisma 7 con adapter-pg (PrismaClient con PrismaPg)"],
    ["Autenticacion", "Supabase Auth (SSR cookies, middleware)"],
    ["Scraping web", "Cheerio (HTML) + Playwright (JS-heavy / Instagram) + Proxy residencial (IPRoyal)"],
    ["AI / NLP", "Gemini 2.5 Flash (Google AI Studio, 20 RPD free tier). CHUNK_SIZE=100"],
    ["Email", "Resend + react-email templates (con UTM tracking + bloque sponsor)"],
    ["Cola de tareas", "BullMQ + Upstash Redis (rediss:// TLS, Free Tier)"],
    ["PDF legal", "NUEVO V25 — @react-pdf/renderer (serverExternalPackages) — generacion server-side"],
    ["Mapas", "Leaflet 1.9.4 + OpenStreetMap (sin API key)"],
    ["Geocoding", "Nominatim + venue-dictionary.ts curado (40+ venues, sin API key, ~0ms)"],
    ["Logger", "createLogger(ctx) en src/lib/logger.ts — formato estructurado + Sentry integration"],
    ["Error tracking", "Sentry (@sentry/nextjs) — ACTIVO con SENTRY_DSN en Vercel"],
    ["Hosting", "Vercel (frontend + API) — habitaplan.com DNS apuntado"],
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
    ["src/app/seguridad/", "NUEVO V25 — Hub Centro de Seguridad con 3 subpaginas legales"],
    ["src/app/seguridad/privacidad/", "NUEVO V25 — Pagina Politica de Privacidad con descarga PDF"],
    ["src/app/seguridad/terminos/", "NUEVO V25 — Pagina Terminos de Uso con descarga PDF"],
    ["src/app/seguridad/datos/", "NUEVO V25 — Pagina Tratamiento de Datos Personales (SIC) con descarga PDF"],
    ["src/app/api/legal/privacidad/pdf/", "NUEVO V25 — API Route: genera PDF Privacidad server-side"],
    ["src/app/api/legal/terminos/pdf/", "NUEVO V25 — API Route: genera PDF Terminos server-side"],
    ["src/app/api/legal/datos/pdf/", "NUEVO V25 — API Route: genera PDF Tratamiento de Datos server-side"],
    ["src/modules/legal/constants/", "NUEVO V25 — SSOT: privacy.ts, terms.ts, data-treatment.ts"],
    ["src/modules/legal/components/", "NUEVO V25 — Componentes UI: PrivacyContent, TermsContent, DataTreatmentContent, DownloadPDFButton"],
    ["src/modules/legal/pdf/", "NUEVO V25 — PDFs: PrivacidadPDF, TermsPDF, DataTreatmentPDF (@react-pdf/renderer)"],
    ["src/app/api/health/", "GET /api/health — check DB + Redis en tiempo real"],
    ["src/app/admin/", "Panel admin: actividades, metricas, scraping, sponsors, sources (ULR score)"],
    ["src/middleware.ts", "Middleware global Next.js — protege /api/admin/* automaticamente"],
    ["src/modules/", "Modulos de dominio: activities, providers, scraping, legal"],
    ["src/lib/logger.ts", "createLogger(ctx) — logger estructurado universal + Sentry"],
    ["scripts/ingest-sources.ts", "Ingesta multi-fuente con sistema de canales (--channel/--source/--list)"],
    ["scripts/", "Scripts de mantenimiento, migracion y generacion de documentos"],
    ["prisma/", "Schema de BD y migraciones"],
  ]
));
children.push(spacer());
children.push(subHeading("4.2 Principios arquitecturales"));
children.push(bodyParagraph("SSOT para documentos legales: src/modules/legal/constants/*.ts es la UNICA fuente — UI y PDF consumen las mismas constantes. NUEVO V25.", { bullet: true }));
children.push(bodyParagraph("Multi-vertical por configuracion: nuevas verticales = registros en tabla verticals, no cambios de codigo.", { bullet: true }));
children.push(bodyParagraph("API-first: toda funcionalidad expuesta via endpoints REST en /api/.", { bullet: true }));
children.push(bodyParagraph("Event-driven: scraping asincrono via BullMQ — el worker procesa jobs en background.", { bullet: true }));
children.push(bodyParagraph("Multi-pais desde dia 1: ciudades, monedas y fuentes en BD — sin hardcoding.", { bullet: true }));
children.push(bodyParagraph("Los datos son el activo: normalizacion NLP convierte fuentes heterogeneas en modelo comun.", { bullet: true }));
children.push(bodyParagraph("Geocoding local primero: venue-dictionary.ts resuelve 40+ venues Bogota en ~0ms antes de llamar Nominatim.", { bullet: true }));
children.push(bodyParagraph("DDL via raw SQL: Supabase pgbouncer (transaction mode) es incompatible con prisma migrate dev — se usan scripts migrate-*.ts.", { bullet: true }));
children.push(bodyParagraph("Logger estructurado: createLogger(ctx) reemplaza todos los console.* — logs con timestamp + nivel + contexto.", { bullet: true }));
children.push(bodyParagraph("Middleware global de seguridad: src/middleware.ts protege /api/admin/* automaticamente.", { bullet: true }));
children.push(bodyParagraph("Sentry condicional: activo solo si SENTRY_DSN en env — zero overhead sin la variable.", { bullet: true }));
children.push(spacer());

// ── SECTION 5: CENTRO DE SEGURIDAD (NUEVO V25) ──────────────────────────────
children.push(sectionHeading("5. CENTRO DE SEGURIDAD LEGAL — NUEVO V25 (S41)"));
children.push(subHeading("5.1 Arquitectura SSOT (Single Source of Truth)"));
children.push(bodyParagraph("Problema anterior: texto legal duplicado entre UI, PDF y rutas — riesgo de divergencias legales.", { bullet: true }));
children.push(bodyParagraph("Solucion: SSOT en src/modules/legal/constants/ — UI y PDF consumen los mismos objetos TypeScript.", { bullet: true }));
children.push(bodyParagraph("Cualquier actualizacion legal se hace SOLO en el archivo de constantes — sin riesgo de desincronia.", { bullet: true }));
children.push(twoColTable(
  ["Archivo SSOT", "Contenido"],
  [
    ["constants/privacy.ts", "Metadatos + resumen + 10 secciones — Politica de Privacidad"],
    ["constants/terms.ts", "Metadatos + resumen + 8 secciones — Terminos de Uso"],
    ["constants/data-treatment.ts", "Metadatos + resumen + 13 secciones — Tratamiento de Datos (nivel SIC)"],
  ]
));
children.push(spacer());
children.push(subHeading("5.2 Paginas del Centro de Seguridad"));
children.push(twoColTable(
  ["Ruta", "Descripcion"],
  [
    ["/seguridad", "Hub principal — cards con resumen de cada politica + estado de cumplimiento"],
    ["/seguridad/privacidad", "Politica de Privacidad: Resumen + documento completo + boton descarga PDF"],
    ["/seguridad/terminos", "Terminos de Uso: Resumen + documento completo + boton descarga PDF"],
    ["/seguridad/datos", "Tratamiento de Datos Personales (SIC): documento formal + boton descarga PDF"],
    ["/privacidad", "Preservada por SEO — redirige contenido (compatibilidad con footer y Google)"],
    ["/terminos", "Preservada por SEO — redirige contenido"],
    ["/tratamiento-datos", "Preservada por SEO — redirige contenido"],
  ]
));
children.push(spacer());
children.push(subHeading("5.3 API Routes PDF (server-side)"));
children.push(bodyParagraph("Generacion de PDFs en el servidor usando @react-pdf/renderer (listado en serverExternalPackages en next.config.ts).", { bullet: true }));
children.push(bodyParagraph("Headers estrictos: Content-Type: application/pdf + Content-Disposition: attachment + Cache-Control: no-store.", { bullet: true }));
children.push(bodyParagraph("Tracking JSON en console.info: { event, version, timestamp } — auditoria de cada descarga.", { bullet: true }));
children.push(twoColTable(
  ["Endpoint", "Nombre PDF generado"],
  [
    ["GET /api/legal/privacidad/pdf", "politica-privacidad-habitaplan.pdf"],
    ["GET /api/legal/terminos/pdf", "terminos-uso-habitaplan.pdf"],
    ["GET /api/legal/datos/pdf", "tratamiento-datos-habitaplan.pdf"],
  ]
));
children.push(spacer());
children.push(subHeading("5.4 Cumplimiento Ley 1581 / SIC"));
children.push(twoColTable(
  ["Requisito SIC", "Estado"],
  [
    ["Responsable del tratamiento identificado", "LISTO — HabitaPlan SAS, hola@habitaplan.com"],
    ["Finalidades del tratamiento descritas", "LISTO — data-treatment.ts seccion 3 (13 finalidades)"],
    ["Derechos ARCO documentados", "LISTO — seccion 7 de data-treatment.ts"],
    ["Procedimiento de atencion de derechos", "LISTO — 15 dias habiles, hola@habitaplan.com"],
    ["Transferencias internacionales divulgadas", "LISTO — Supabase/AWS EEUU + Vercel EEUU con nivel de proteccion explicito"],
    ["Politica de menores de edad", "LISTO — clausula parental en los 3 documentos (consentimiento previo del padre/tutor)"],
    ["Periodo de retencion de datos", "LISTO — condiciones de supresion con excepciones legales/contractuales"],
    ["Limitacion de responsabilidad intermediario", "LISTO — clausula blindada en terminos: 'en ningun caso sera responsable'"],
    ["PDF descargable del documento", "LISTO — @react-pdf/renderer, server-side, Cache-Control: no-store"],
  ]
));
children.push(spacer());

// ── SECTION 6: SEGURIDAD PLATAFORMA ─────────────────────────────────────────
children.push(sectionHeading("6. SEGURIDAD DE PLATAFORMA"));
children.push(subHeading("6.1 Hallazgos y correcciones (S25)"));
children.push(twoColTable(
  ["ID", "Descripcion y Correccion"],
  [
    ["C-01 (Critico)", "PUT/DELETE /api/activities/:id estaban sin autenticacion. Corregido: requireRole([ADMIN])."],
    ["C-02 (Critico)", "CRON_SECRET tenia fallback inseguro '|| test-secret'. Corregido: eliminado fallback + check explicito."],
    ["npm audit (Alto)", "15 vulnerabilidades: picomatch ReDoS + Next.js 16.1.6. Corregido: npm audit fix + upgrade Next.js 16.2.1. Resultado: 0 vuln."],
  ]
));
children.push(spacer());
children.push(subHeading("6.2 Security Headers (next.config.ts)"));
children.push(twoColTable(
  ["Header", "Valor / Proposito"],
  [
    ["Content-Security-Policy", "default-src 'self' + fuentes permitidas — previene XSS"],
    ["X-Content-Type-Options", "nosniff — previene MIME sniffing"],
    ["X-Frame-Options", "SAMEORIGIN — previene clickjacking"],
    ["Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload — HTTPS 2 anos"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
  ]
));
children.push(spacer());

// ── SECTION 7: OBSERVABILIDAD ───────────────────────────────────────────────
children.push(sectionHeading("7. OBSERVABILIDAD"));
children.push(subHeading("7.1 Logger estructurado — createLogger(ctx)"));
children.push(bodyParagraph("Archivo: src/lib/logger.ts. API: const log = createLogger('ctx'); log.info('msg', { meta }); log.error(...);", { bullet: true }));
children.push(bodyParagraph("Formato: ISO timestamp + LEVEL + [ctx] + mensaje + extras JSON.", { bullet: true }));
children.push(bodyParagraph("log.error() captura a Sentry si SENTRY_DSN configurado — import dinamico, no bloquea el request.", { bullet: true }));
children.push(bodyParagraph("Tracking legal: console.info(JSON.stringify({ event, version, timestamp })) en cada descarga de PDF.", { bullet: true }));
children.push(spacer());
children.push(subHeading("7.2 Sentry — Error Tracking ACTIVO"));
children.push(bodyParagraph("@sentry/nextjs con SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN en Vercel Dashboard.", { bullet: true }));
children.push(bodyParagraph("instrumentation-client.ts inicializa Sentry en browser (onRouterTransitionStart).", { bullet: true }));
children.push(spacer());
children.push(subHeading("7.3 Health Check + UptimeRobot ACTIVO"));
children.push(bodyParagraph("GET /api/health — check DB + Redis. 200 ok | 200 degraded (Redis falla) | 503 down (DB falla).", { bullet: true }));
children.push(bodyParagraph("UptimeRobot monitoreando https://habitaplan-activities.vercel.app/api/health.", { bullet: true }));
children.push(spacer());

// ── SECTION 8: MODELO DE DATOS ──────────────────────────────────────────────
children.push(sectionHeading("8. MODELO DE DATOS"));
children.push(twoColTable(
  ["Entidad", "Descripcion"],
  [
    ["Activity", "Actividad normalizada: title, description, type, status, audience, price, imageUrl, sourceUrl, schedules (JSON)"],
    ["Provider", "Proveedor: name, slug, type, isVerified, isClaimed, isPremium, premiumSince, ratingAvg, ratingCount"],
    ["Sponsor", "Patrocinador newsletter: name, tagline, logoUrl, url, isActive, campaignStart, campaignEnd"],
    ["ProviderClaim", "Solicitud de reclamacion: status PENDING/APPROVED/REJECTED, userId, providerId"],
    ["Location", "Ubicacion: name, address, neighborhood, latitude, longitude, cityId"],
    ["City", "Ciudad: name, country, timezone"],
    ["Category", "Categoria: name, slug, description"],
    ["ActivityCategory", "Relacion N:M Activity <-> Category"],
    ["Vertical", "Vertical de mercado: name, slug (kids, mascotas, etc.)"],
    ["User", "Usuario: supabaseAuthId, name, email, role, avatarUrl, onboardingDone"],
    ["Child", "Perfil de hijo: name, birthDate, gender, consentGivenAt, consentGivenBy, consentText"],
    ["Favorite", "Relacion User <-> Activity favoriteada"],
    ["Rating", "Calificacion 1-5 estrellas con comentario opcional"],
    ["PushSubscription", "Suscripcion Web Push: endpoint, p256dh, auth por usuario"],
    ["ScrapingSource", "Fuente de scraping: url, platform, scraperType, status, isActive"],
    ["ScrapingLog", "Log de ejecucion de scraping por fuente"],
  ]
));
children.push(spacer());

// ── SECTION 9: PIPELINE DE SCRAPING ─────────────────────────────────────────
children.push(sectionHeading("9. PIPELINE DE SCRAPING"));
children.push(subHeading("9.1 Flujo principal (Web)"));
children.push(twoColTable(
  ["Paso", "Descripcion"],
  [
    ["1. Extraccion de links", "CheerioExtractor.extractLinksAllPages() — sigue paginacion automaticamente"],
    ["2. Pre-filtro binarios", "GeminiAnalyzer excluye .jpg/.png/.gif/.pdf/.mp4/etc antes de Gemini — ahorra cuota"],
    ["3. URL Classifier", "NUEVO S34 — score 0-100 filtra ~40% URLs no productivas antes de Gemini"],
    ["4. Filtrado IA", "GeminiAnalyzer.discoverActivityLinks() en lotes de 100 URLs (CHUNK_SIZE=100, S35)"],
    ["5. Cache incremental", "ScrapingCache — omite URLs ya procesadas. Dual: disco + BD PostgreSQL"],
    ["6. Extraccion de contenido", "CheerioExtractor.extract() — HTML + JSON-LD + og:image"],
    ["7. Analisis NLP", "GeminiAnalyzer.analyze() — extrae titulo, descripcion, precio, fechas, audiencia"],
    ["8. Normalizacion Zod", "title null/'' → 'Sin titulo'; categories null/[] → ['General'] (S31)"],
    ["9. Deduplicacion", "Jaccard >75% en saveActivity — evita duplicados en tiempo real"],
    ["10. Geocoding", "venue-dictionary.ts (~0ms) -> Nominatim -> cityFallback -> null"],
    ["11. Persistencia", "ScrapingStorage.saveActivity() — upsert por sourceUrl, preserva imageUrl existente"],
  ]
));
children.push(spacer());
children.push(subHeading("9.2 Fuentes activas (S41)"));
children.push(twoColTable(
  ["Ciudad / Fuente", "Canal / Estado"],
  [
    ["Bogota — BibloRed", "Web — ~150 actividades"],
    ["Bogota — IDARTES, Sec. Cultura, CRD, Planetario, Cinemateca, JBB, Maloka", "Web — ~100 actividades combinadas"],
    ["Bogota — Banrep", "Web — sitemap filtrado /bogota/"],
    ["Bogota — 10 cuentas Instagram", "Instagram (Playwright) — activas"],
    ["Medellin — Parque Explora", "Web — sitemap activo (NUEVO S35)"],
    ["Medellin — Biblioteca Piloto", "Web — sitemap activo (NUEVO S35)"],
    ["Medellin — @parqueexplora, @quehacerenmedellin", "Instagram — validadas, pendiente ingest real"],
    ["Banrep — 8 ciudades adicionales", "Web — Cali, Barranquilla, Cartagena, Bucaramanga, etc."],
    ["Telegram — @quehaypahacer", "Telegram MTProto via gramjs — dry-run OK"],
    ["Banrep Ibague", "PAUSADA — score 13/100, cuota Gemini insuficiente"],
  ]
));
children.push(spacer());
children.push(subHeading("9.3 URL Classifier (NUEVO S34)"));
children.push(bodyParagraph("src/lib/url-classifier.ts — score 0-100 para decidir si una URL es productiva.", { bullet: true }));
children.push(bodyParagraph("Detecta patrones no productivos: categorias, archivos, infraestructura, paginacion.", { bullet: true }));
children.push(bodyParagraph("Detecta indicadores productivos: palabras clave (evento, taller, concierto), fechas, IDs.", { bullet: true }));
children.push(bodyParagraph("Threshold 45 — filtra ~40% de URLs antes de Gemini. 28 tests, 100% cobertura.", { bullet: true }));
children.push(spacer());
children.push(subHeading("9.4 Dashboard auto-pause de fuentes (NUEVO S35)"));
children.push(bodyParagraph("/admin/sources — tabla con URL Score + toggle activo/inactivo por fuente.", { bullet: true }));
children.push(bodyParagraph("PATCH /api/admin/sources/[id] — actualiza isActive con feedback inmediato + router.refresh().", { bullet: true }));
children.push(bodyParagraph("source-pause-manager.ts — logica auto-pause con 3 niveles: global, ciudad, fuente especifica.", { bullet: true }));
children.push(spacer());

// ── SECTION 10: GEOCODING ────────────────────────────────────────────────────
children.push(sectionHeading("10. GEOCODING — VENUE-DICTIONARY + NOMINATIM"));
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

// ── SECTION 11: MONETIZACION ─────────────────────────────────────────────────
children.push(sectionHeading("11. MONETIZACION"));
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

// ── SECTION 12: FUNCIONALIDADES UI ───────────────────────────────────────────
children.push(sectionHeading("12. FUNCIONALIDADES DE INTERFAZ"));
children.push(subHeading("12.1 Paginas publicas"));
children.push(twoColTable(
  ["Ruta", "Descripcion"],
  [
    ["/", "Landing: hero buscador mixto, stats, categorias, actividades recientes (S37)"],
    ["/actividades", "Filtros facetados desktop (1 fila) + precio pills + chips activos + modal mobile (S38)"],
    ["/actividades/[uuid-slug]", "Detalle: hero, descripcion, fechas, precio, mini-mapa, calificaciones, similares"],
    ["/mapa", "Mapa Leaflet interactivo — pines por categoria"],
    ["/anunciate", "Landing de monetizacion con stats y precios"],
    ["/seguridad", "NUEVO V25 — Centro de Seguridad: hub de politicas legales"],
    ["/seguridad/privacidad", "NUEVO V25 — Politica de Privacidad + PDF descargable"],
    ["/seguridad/terminos", "NUEVO V25 — Terminos de Uso + PDF descargable"],
    ["/seguridad/datos", "NUEVO V25 — Tratamiento de Datos Personales (SIC) + PDF descargable"],
    ["/onboarding", "Wizard 3 pasos: Ciudad → Hijos → Listo"],
    ["/proveedores/[slug]", "Perfil publico del proveedor con claim button"],
    ["/proveedores/[slug]/reclamar", "Formulario de reclamacion de ownership"],
  ]
));
children.push(spacer());
children.push(subHeading("12.2 Buscador mixto (NUEVO S40)"));
children.push(bodyParagraph("GET /api/activities/suggestions — devuelve SuggestionItem[] max 5 (3 acts + 1 cat + 1 ciudad). Min 3 chars.", { bullet: true }));
children.push(bodyParagraph("Cache LRU en memoria (20 entries) en HeroSearch.tsx y Filters.tsx.", { bullet: true }));
children.push(bodyParagraph("AbortController cancela el fetch anterior en cada keystroke.", { bullet: true }));
children.push(bodyParagraph("Historial en sessionStorage hp_recent_searches (max 5 busquedas).", { bullet: true }));
children.push(spacer());
children.push(subHeading("12.3 Panel admin (requiere rol ADMIN)"));
children.push(twoColTable(
  ["Ruta", "Descripcion"],
  [
    ["/admin", "Dashboard con cards: Fuentes, Logs, Actividades, Metricas, Patrocinadores"],
    ["/admin/actividades", "Tabla con filtros, busqueda, paginacion, Ocultar/Activar, Editar"],
    ["/admin/sources", "NUEVO S35 — URL Score dashboard + toggle activo/inactivo"],
    ["/admin/sponsors", "CRUD de patrocinadores: crear, activar/desactivar, editar, eliminar"],
    ["/admin/claims", "Lista y gestion de solicitudes de reclamacion de providers"],
  ]
));
children.push(spacer());

// ── SECTION 13: AUTH Y CUMPLIMIENTO LEGAL ───────────────────────────────────
children.push(sectionHeading("13. AUTENTICACION, ROLES Y CUMPLIMIENTO LEGAL"));
children.push(bodyParagraph("Supabase Auth SSR con cookies HttpOnly — sin tokens en localStorage.", { bullet: true }));
children.push(bodyParagraph("Roles: ADMIN (acceso total), PROVIDER (dashboard propio si isClaimed), MODERATOR, PARENT.", { bullet: true }));
children.push(bodyParagraph("Middleware global src/middleware.ts: protege /api/admin/* — sin sesion 401, sin ADMIN 403.", { bullet: true }));
children.push(bodyParagraph("Cumplimiento Ley 1581 / SIC: NUEVO V25 — /seguridad/* con documentos SSOT y PDFs descargables.", { bullet: true }));
children.push(bodyParagraph("Menores de edad: consentGivenAt, consentGivenBy, consentText en modelo Child.", { bullet: true }));
children.push(bodyParagraph("Autorizacion parental explicita documentada en los 3 documentos legales SSOT.", { bullet: true }));
children.push(bodyParagraph("Transferencias internacionales divulgadas: Supabase AWS EEUU + Vercel EEUU con nivel de proteccion.", { bullet: true }));
children.push(spacer());

// ── SECTION 14: ESTADO ACTUAL ────────────────────────────────────────────────
children.push(sectionHeading("14. ESTADO ACTUAL — v0.11.0-S42 (2026-04-13)"));
children.push(twoColTable(
  ["Metrica", "Valor"],
  [
    ["Actividades en BD", "~296 actividades (~44 activas / ~252 expiradas — cron diario de expiracion activo)"],
    ["Locations geocodificadas", "29/29 con coordenadas reales (lat/lng != 0)"],
    ["Tests", "889 tests en 58 archivos — 100% pasando"],
    ["Cobertura", "91.39% stmts / 85.90% branches (umbral 85% superado)"],
    ["TypeScript", "0 errores (tsc --noEmit)"],
    ["npm audit", "3 moderate en @prisma/dev (dev-only, no produccion) — mantener hasta fix de Prisma"],
    ["Build", "OK — sin warnings criticos"],
    ["Precios y Schema", "Hardening de normalizacion de precios (decimal.ts) y validador schema:check ACTIVOS"],
    ["console.* en produccion", "0 — migrado a createLogger(ctx) con tracking JSON legal"],
    ["Deployment", "Vercel ACTIVO en habitaplan.com — commit f8bd1db (09:18 AM COL, 2026-04-13)"],
    ["Centro de Seguridad", "ACTIVO — /seguridad + 3 subpaginas + 3 APIs PDF"],
    ["PDFs legales", "Privacidad + Terminos + Tratamiento de Datos — generados server-side"],
    ["CI/CD", "GitHub Actions — tests + build en cada push a master"],
    ["Cola", "BullMQ + Upstash Redis OPERATIVO"],
    ["Fuentes web", "20 (18 Bogota + 2 Medellin)"],
    ["Fuentes Instagram", "12 (10 Bogota + 2 Medellin validadas)"],
    ["Fuentes Telegram", "1 canal configurado — dry-run OK"],
    ["Cache dual", "scraping_cache en BD + disco — sincronizado entre maquinas"],
    ["Gemini", "gemini-2.5-flash, 20 RPD, CHUNK_SIZE=100"],
    ["Sentry", "ACTIVO — SENTRY_DSN en Vercel Dashboard"],
    ["UptimeRobot", "ACTIVO — monitoreando /api/health"],
    ["URL Classifier", "ACTIVO — reduce ~40% URLs antes de Gemini"],
    ["Auto-pause sources", "ACTIVO — dashboard /admin/sources"],
    ["Dominio", "habitaplan.com apuntado a Vercel"],
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
    ["v0.7.3", "V15", "BullMQ + Upstash Redis. 636 tests."],
    ["v0.8.0", "V18", "Geocoding, mapa, autocompletado, ordenamiento, metricas"],
    ["v0.8.1+", "V20", "Monetizacion: sponsors, UTM, isPremium, /anunciate. 748 tests."],
    ["v0.9.0", "V21", "Seguridad C-01/C-02, observabilidad, scraping canales. 783 tests."],
    ["v0.9.1", "V21", "Telegram, provider claim, onboarding, ratings aggregation. 792 tests."],
    ["v0.9.3-S31", "V22", "Cache dual BD+disco, source-ranking, fix Zod Gemini. 797 tests."],
    ["v0.9.3-S33", "V23", "Rebrand Infantia → HabitaPlan, dominio habitaplan.com. 832 tests."],
    ["v0.9.4-S35", "V23", "Multi-ciudad Medellin, URL classifier, auto-pause dashboard. 876 tests."],
    ["v0.9.5-S37", "V23", "Home UX: HeroSearch, ActivityCard compact, footer 4 cols."],
    ["v0.9.6-S38", "V23", "Filtros /actividades: 1 fila desktop, precio pills, modal mobile."],
    ["v0.9.8-S40", "V23", "Buscador mixto (acts+cats+ciudades), 3 bugs autocomplete. 889 tests."],
    ["v0.11.0-S42 (f8bd1db)", "V25", "Centro de Seguridad SSOT, PDFs Ley 1581 / SIC, Minor Bump. 889 tests."],
    ["v0.11.0-S42 (a3d7dc9)", "V25", "Hardening critico estabilidad de precios y schema validator. 889 tests."],
  ],
  [25, 12, 63]
));
children.push(spacer());

// ── SECTION 15: TESTING ──────────────────────────────────────────────────────
children.push(sectionHeading("15. TESTING"));
children.push(twoColTable(
  ["Metrica", "Valor"],
  [
    ["Framework", "Vitest 4 + @vitest/coverage-v8 + React Testing Library"],
    ["Tests totales", "882 en 58 archivos"],
    ["Threshold", "85% branches (cap fijo desde dia 16 del proyecto)"],
    ["Statements", "91.39%"],
    ["Branches", "85.90%"],
    ["Functions", "88.09%"],
    ["Lines", "92.71%"],
    ["Duracion", "~8.5 segundos"],
    ["E2E", "19 tests Playwright (auth, actividades, favoritos)"],
  ]
));
children.push(spacer());
children.push(subHeading("Gaps de cobertura conocidos y aceptados"));
children.push(bodyParagraph("scraping/queue/types.ts (0%) — solo interfaces TypeScript, sin runtime. Correcto.", { bullet: true }));
children.push(bodyParagraph("playwright.extractor.ts (~10% funcs gap) — callbacks page.$$eval() ejecutan en contexto browser, inaccesibles en unit tests.", { bullet: true }));
children.push(bodyParagraph("lib/logger.ts (~73% stmts) — ramas Sentry dynamic import no mockeables limpiamente en Vitest.", { bullet: true }));
children.push(spacer());

// ── SECTION 16: ROADMAP ──────────────────────────────────────────────────────
children.push(sectionHeading("16. ROADMAP"));
children.push(subHeading("Corto plazo — v0.10.x"));
children.push(twoColTable(
  ["Item", "Descripcion"],
  [
    ["Ingest Medellin Instagram", "@parqueexplora y @quehacerenmedellin — pendiente cuota Gemini"],
    ["Telegram ingest real", "npx tsx scripts/ingest-telegram.ts sin --dry-run (canal @quehaypahacer)"],
    ["Banrep ciudades restantes", "Cartagena, Bucaramanga, Manizales, Pereira, Ibague pendientes de cuota"],
    ["Proxy IPRoyal", "Cuando Instagram empiece a bloquear — vars en Vercel env"],
    ["Documento Fundacional V25", "Cuando se complete el proximo milestone significativo"],
  ]
));
children.push(spacer());
children.push(subHeading("Mediano plazo — v1.0.0 (MVP publico)"));
children.push(bodyParagraph("Primer cliente sponsor newsletter (mes 6) — requiere cuenta Wompi activa.", { bullet: true }));
children.push(bodyParagraph("Primer proveedor premium (mes 9) — isClaimed + isPremium.", { bullet: true }));
children.push(bodyParagraph("Pagos Wompi: PSE + tarjeta + Nequi.", { bullet: true }));
children.push(bodyParagraph("Meilisearch Cloud — activar cuando +1.000 actividades activas.", { bullet: true }));
children.push(spacer());
children.push(subHeading("Largo plazo"));
children.push(bodyParagraph("Facebook Pages y TikTok como fuentes (channel ya preparado).", { bullet: true }));
children.push(bodyParagraph("Expansion a Cali y otras ciudades como verticales completas.", { bullet: true }));
children.push(bodyParagraph("App movil (React Native o PWA mejorada).", { bullet: true }));
children.push(spacer());

// ── SECTION 17: SCRIPTS UTILES ──────────────────────────────────────────────
children.push(sectionHeading("17. SCRIPTS Y COMANDOS UTILES"));
children.push(twoColTable(
  ["Comando", "Descripcion"],
  [
    ["npm run dev", "Servidor de desarrollo Next.js (Turbopack)"],
    ["npm test", "Correr todos los tests (889 tests)"],
    ["npm run test:coverage", "Tests + reporte de cobertura (threshold 85%)"],
    ["npx tsx scripts/ingest-sources.ts --list", "Ver inventario de fuentes por canal"],
    ["npx tsx scripts/ingest-sources.ts --save-db", "Ingest completo a BD (todas las fuentes)"],
    ["npx tsx scripts/ingest-sources.ts --source=banrep --save-db", "Solo Banrep — ahorra cuota Gemini"],
    ["npx tsx scripts/ingest-sources.ts --channel=web --save-db", "Solo fuentes web"],
    ["npx tsx scripts/ingest-sources.ts --channel=instagram --save-db", "Solo fuentes Instagram"],
    ["npx tsx scripts/run-worker.ts", "Iniciar el worker BullMQ para procesar jobs"],
    ["npx tsx scripts/promote-admin.ts <email>", "Dar rol ADMIN a un usuario"],
    ["npx tsx scripts/verify-db.ts", "Verificar estado de la BD"],
    ["npx tsx scripts/backfill-geocoding.ts [--dry-run]", "Geocodificar locations con coords 0,0"],
    ["npx tsx scripts/backfill-images.ts", "Extraer og:image para actividades sin imagen"],
    ["npx tsx scripts/expire-activities.ts", "Expirar actividades manualmente"],
    ["npx tsx scripts/telegram-auth.ts", "Autenticacion one-time Telegram MTProto"],
    ["npx tsx scripts/ingest-telegram.ts [--dry-run]", "Ingestar canales Telegram"],
    ["npx tsx scripts/source-ranking.ts [--weeks=4]", "Ranking de fuentes por produccion/volumen/alcance"],
    ["npx tsx scripts/test-instagram.ts <URL> --validate-only", "Validar cuenta Instagram sin consumir Gemini"],
    ["npx tsx scripts/apply-source-pause.ts [--dry-run] [--city=medellin]", "Auto-pause segun score de fuentes"],
    ["node scripts/generate_v24.mjs", "Generar este Documento Fundacional V25"],
  ]
));
children.push(spacer());

// ── FINAL NOTE ───────────────────────────────────────────────────────────────
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(new Paragraph({
  children: [new TextRun({ text: "HabitaPlan — Documento Fundacional V25", size: 18, font: "Arial", color: "999999", italics: true })],
  alignment: AlignmentType.CENTER, spacing: { before: 400, after: 80 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Generado por Antigravity (Google DeepMind) el 2026-04-13 | Software: v0.11.0-S42 (commits f8bd1db + a3d7dc9) | 889 tests | 58 archivos | 0 errores TS", size: 16, font: "Arial", color: "BBBBBB" })],
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
              children: [new TextRun({ text: "HABITAPLAN — DOCUMENTO FUNDACIONAL V25", size: 16, font: "Arial", color: "999999" })],
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

const OUTPUT_PATH = "C:\\Users\\denys\\OneDrive\\Documents\\DayJul\\Denys\\Infantia\\Infantia_Claude\\HabitaPlan_Documento_Fundacional_V25.docx";

Packer.toBuffer(doc).then((buffer) => {
  writeFileSync(OUTPUT_PATH, buffer);
  console.log(`✅ Documento generado: ${OUTPUT_PATH}`);
});
