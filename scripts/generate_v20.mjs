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
  children: [new TextRun({ text: "INFANTIA", bold: true, size: 72, font: "Arial", color: DARK_BLUE })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "DOCUMENTO FUNDACIONAL V20", bold: true, size: 40, font: "Arial", color: DARK_BLUE })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Plataforma de Descubrimiento de Actividades y Eventos", size: 28, font: "Arial", color: "555555", italics: true })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "2026-03-31", size: 24, font: "Arial", color: "777777" })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Sesiones S22-S24 — Monetizacion A-G + Proxy residencial", size: 20, font: "Arial", color: "999999", italics: true })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 1200 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Documento generado automaticamente por Claude Code — Infantia v0.8.1 (commits c355246, 53f4961, 4772444)", size: 18, font: "Arial", color: "BBBBBB", italics: true })],
  alignment: AlignmentType.CENTER,
}));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ── SECTION 1: VISION ───────────────────────────────────────────────────────
children.push(sectionHeading("1. VISION Y PROBLEMA"));
children.push(bodyParagraph("Las familias con ninos pasan horas buscando actividades en fuentes fragmentadas: sitios web institucionales, Instagram, grupos de WhatsApp, Facebook, Telegram. No existe un lugar centralizado que agregue, normalice y filtre esta informacion."));
children.push(spacer());
children.push(labelValue("La Solucion", "Infantia es un agregador multi-fuente con normalizacion inteligente que centraliza actividades y eventos para ninos, jovenes y familias en ciudades colombianas, con expansion a LATAM."));
children.push(labelValue("Nombre", "Infantia (raiz latina, decision familiar)"));
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
    ["Agregacion multi-fuente", "Web + Instagram + Facebook + Telegram (futuro)"],
    ["Normalizacion inteligente", "NLP con Gemini 2.5 Flash — estructura datos de fuentes heterogeneas"],
    ["Multi-vertical por config", "Ninos, mascotas, adultos mayores — nuevas verticales = registros en BD"],
    ["Multi-ciudad desde dia 1", "Bogota + 9 ciudades Banrep, expansion LATAM por configuracion"],
    ["URLs canonicas", "Formato /actividades/{uuid}-{slug} — SEO-friendly, backward compatible"],
    ["Mapa interactivo", "Leaflet + OpenStreetMap — sin API key, pines por categoria"],
    ["Geocoding curado", "venue-dictionary.ts con 40+ venues Bogota — coords exactas sin API call"],
    ["Monetizacion integrada", "Sponsors newsletter + listings premium + /anunciate landing — implementado desde mes 0"],
    ["Proxy residencial", "IPRoyal ready — codigo listo para escalar scraping Instagram/TikTok sin bloqueos"],
  ]
));
children.push(spacer());

// ── SECTION 3: STACK ────────────────────────────────────────────────────────
children.push(sectionHeading("3. STACK TECNOLOGICO"));
children.push(twoColTable(
  ["Capa", "Tecnologia"],
  [
    ["Framework", "Next.js 16.1.6 (App Router) + TypeScript strict"],
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
  ["Directorio", "Contenido"],
  [
    ["src/app/", "Next.js App Router — paginas, layouts, rutas API"],
    ["src/app/admin/", "Panel admin: actividades, metricas, scraping, sponsors (NUEVO)"],
    ["src/app/proveedores/[slug]/dashboard/", "Dashboard de proveedor — ADMIN o dueno (NUEVO)"],
    ["src/app/anunciate/", "Landing de monetizacion para sponsors y proveedores (NUEVO)"],
    ["src/modules/", "Modulos de dominio: activities, providers, scraping, etc."],
    ["src/components/", "Componentes UI reutilizables"],
    ["src/lib/", "Utilidades compartidas (activity-url, auth, db, venue-dictionary, geocoding, email)"],
    ["src/hooks/", "Custom React hooks (useActivityHistory)"],
    ["src/config/", "Constantes de configuracion (SITE_URL, etc.)"],
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
children.push(bodyParagraph("DDL via raw SQL: Supabase pgbouncer (transaction mode) es incompatible con prisma migrate dev — se usan scripts migrate-*.ts con $executeRawUnsafe().", { bullet: true }));
children.push(spacer());

// ── SECTION 5: MODELO DE DATOS ──────────────────────────────────────────────
children.push(sectionHeading("5. MODELO DE DATOS"));
children.push(twoColTable(
  ["Entidad", "Descripcion"],
  [
    ["Activity", "Actividad normalizada: title, description, type, status, audience, price, imageUrl, sourceUrl, schedules (JSON)"],
    ["Provider", "Proveedor: name, slug, type, isVerified, isClaimed, isPremium (*), premiumSince (*) — (*) NUEVO v0.8.1"],
    ["Sponsor", "Patrocinador newsletter: name, tagline, logoUrl, url, isActive, campaignStart, campaignEnd — NUEVO v0.8.1"],
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
children.push(subHeading("5.1 Campos clave de Activity"));
children.push(twoColTable(
  ["Campo", "Descripcion"],
  [
    ["status", "ACTIVE | EXPIRED | DRAFT | REMOVED"],
    ["type", "ONE_TIME | RECURRING | WORKSHOP | CAMP"],
    ["audience", "KIDS | FAMILY | ADULTS | ALL"],
    ["imageUrl", "URL de imagen (og:image extraida en scraping o backfill manual)"],
    ["sourceUrl", "URL original de donde se scraped la actividad"],
    ["sourcePlatform", "WEBSITE | INSTAGRAM | FACEBOOK | TELEGRAM"],
    ["sourceConfidence", "0.0 - 1.0 — confianza del NLP en la extraccion"],
    ["schedule", "JSON con { items: [{ startDate, endDate, notes }] }"],
    ["pricePeriod", "PER_SESSION | MONTHLY | TOTAL | FREE"],
  ]
));
children.push(spacer());
children.push(subHeading("5.2 Modelo Sponsor (NUEVO v0.8.1)"));
children.push(bodyParagraph("Tabla 'sponsors' creada via migrate-sponsors.ts (raw SQL — patrón establecido para DDL en Supabase pgbouncer).", { bullet: true }));
children.push(bodyParagraph("Un sponsor activo (isActive=true) se muestra en el email digest entre la lista de actividades y el CTA final.", { bullet: true }));
children.push(bodyParagraph("Campos: id, name, tagline, logoUrl, url, isActive, campaignStart, campaignEnd, createdAt, updatedAt.", { bullet: true }));
children.push(bodyParagraph("CRUD completo en /admin/sponsors — accesible solo a ADMIN.", { bullet: true }));
children.push(spacer());
children.push(subHeading("5.3 isPremium en Provider (NUEVO v0.8.1)"));
children.push(bodyParagraph("isPremium (Boolean, default false) y premiumSince (DateTime?) agregados via migrate-premium.ts.", { bullet: true }));
children.push(bodyParagraph("Efecto en ordenamiento: relevance sort incluye { provider: { isPremium: 'desc' } } — actividades de proveedores premium aparecen primero.", { bullet: true }));
children.push(bodyParagraph("Efecto en UI: badge 'Destacado' (estrella dorada) en ActivityCard — prioridad sobre badge 'Nuevo'.", { bullet: true }));
children.push(spacer());

// ── SECTION 6: PIPELINE DE SCRAPING ─────────────────────────────────────────
children.push(sectionHeading("6. PIPELINE DE SCRAPING"));
children.push(subHeading("6.1 Flujo principal (Web)"));
children.push(twoColTable(
  ["Paso", "Descripcion"],
  [
    ["1. Extraccion de links", "CheerioExtractor.extractLinksAllPages() — sigue paginacion automaticamente"],
    ["2. Filtrado IA", "GeminiAnalyzer.discoverActivityLinks() — identifica cuales son actividades"],
    ["3. Cache incremental", "ScrapingCache — omite URLs ya procesadas (reproducible entre runs)"],
    ["4. Extraccion de contenido", "CheerioExtractor.extract() — HTML + JSON-LD + og:image"],
    ["5. Analisis NLP", "GeminiAnalyzer.analyze() — extrae titulo, descripcion, precio, fechas, audiencia"],
    ["6. Enriquecimiento", "og:image adjuntada al resultado NLP si Gemini no la provee"],
    ["7. Deduplicacion", "Jaccard >75% en saveActivity — evita duplicados en tiempo real"],
    ["8. Geocoding", "venue-dictionary.ts (~0ms) → Nominatim → cityFallback → 0,0"],
    ["9. Persistencia", "ScrapingStorage.saveActivity() — upsert por sourceUrl, preserva imageUrl existente"],
  ]
));
children.push(spacer());
children.push(subHeading("6.2 Proxy residencial (NUEVO S24)"));
children.push(bodyParagraph("PlaywrightExtractor lee PLAYWRIGHT_PROXY_SERVER / PLAYWRIGHT_PROXY_USER / PLAYWRIGHT_PROXY_PASS del .env.", { bullet: true }));
children.push(bodyParagraph("Si las vars estan ausentes: comportamiento anterior sin proxy (backward compatible).", { bullet: true }));
children.push(bodyParagraph("Proxy aplicado a todos los chromium.launch(): Instagram, extractWebLinks() y extractWebText().", { bullet: true }));
children.push(bodyParagraph("Proveedor recomendado: IPRoyal — IPs residenciales, pay-as-you-go $7/GB. Pendiente activacion (compra de credito).", { bullet: true }));
children.push(bodyParagraph("Log en consola: '[PLAYWRIGHT] Proxy activo: ...' cuando el proxy esta configurado.", { bullet: true }));
children.push(spacer());
children.push(subHeading("6.3 Fuentes activas (14 total)"));
children.push(twoColTable(
  ["Fuente", "Tipo"],
  [
    ["BibloRed (biblored.gov.co)", "Web — 150 actividades, paginacion automatica"],
    ["IDARTES (idartes.gov.co)", "Web — sitemap XML"],
    ["Bogota.gov.co", "Web — sitemap XML"],
    ["Cultura, Rec. y Deporte (CRD)", "Web — sitemap XML"],
    ["Planetario de Bogota", "Web — sitemap XML — 25 actividades"],
    ["Cinemateca de Bogota", "Web — sitemap XML"],
    ["Jardin Botanico (JBB)", "Web — sitemap XML — 4 actividades"],
    ["Maloka", "Web — sitemap XML"],
    ["Banrep — Bogota", "Sitemap XML filtrado por /bogota/"],
    ["Banrep — Medellin", "Sitemap XML filtrado por /medellin/"],
    ["Banrep — Cali", "Sitemap XML filtrado por /cali/"],
    ["Banrep — Barranquilla", "Sitemap XML filtrado por /barranquilla/"],
    ["Banrep — Cartagena", "Sitemap XML filtrado por /cartagena/"],
    ["Banrep — Bucaramanga / Manizales / Pereira / Ibague / Santa Marta", "Sitemap XML filtrado por ciudad"],
  ]
));
children.push(spacer());
children.push(subHeading("6.4 Cola asincrona (BullMQ + Upstash Redis)"));
children.push(bodyParagraph("Los jobs de scraping se encolan via BullMQ en Upstash Redis (rediss:// TLS, Free Tier).", { bullet: true }));
children.push(bodyParagraph("Worker con concurrencia=1 respeta rate limit de Gemini (20 RPD free tier).", { bullet: true }));
children.push(bodyParagraph("Reintentos exponenciales: 3 intentos, backoff 5s.", { bullet: true }));
children.push(bodyParagraph("Comando: npx tsx scripts/ingest-sources.ts --queue + npx tsx scripts/run-worker.ts", { bullet: true }));
children.push(spacer());

// ── SECTION 7: GEOCODING ────────────────────────────────────────────────────
children.push(sectionHeading("7. GEOCODING — VENUE-DICTIONARY + NOMINATIM"));
children.push(subHeading("7.1 Flujo de geocoding"));
children.push(twoColTable(
  ["Paso", "Descripcion"],
  [
    ["1. venue-dictionary.ts", "Lookup local en diccionario curado de 40+ venues Bogota — ~0ms, sin API call"],
    ["2. Nominatim (OSM)", "Fallback: geocodificacion via OpenStreetMap — rate limit 1.1s (ToS)"],
    ["3. cityFallback", "Si la direccion falla, geocodifica solo la ciudad"],
    ["4. Fallback 0,0", "Ultimo recurso — la actividad aparece sin pin en el mapa"],
  ]
));
children.push(spacer());
children.push(subHeading("7.2 venue-dictionary.ts — Venues curados"));
children.push(bodyParagraph("40+ venues de Bogota con coordenadas exactas verificadas en OpenStreetMap (marzo 2026).", { bullet: true }));
children.push(bodyParagraph("BibloRed x15 sedes: Virgilio Barco, El Tintal, El Tunal, Chapinero, Suba, Usme, Bosa, Kennedy, Fontibon, Engativa, La Candelaria, Antonio Narino, La Pedregal, Rafaelito Pombo.", { bullet: true }));
children.push(bodyParagraph("Centros de Felicidad x10: Chapinero, Bosa, Kennedy, Usme, Suba, Engativa, Fontibon, Rafael Uribe, Ciudad Bolivar, San Cristobal.", { bullet: true }));
children.push(bodyParagraph("Otros: Planetario, Jardin Botanico, Maloka, Parque Simon Bolivar, Museo de los Ninos, Cinemateca, Museo Nacional, Idartes, Teatro Mayor, Garcia Marquez, Banrep, Colsubsidio, Parque Nacional, Parque El Country.", { bullet: true }));
children.push(bodyParagraph("Matching AND de keywords: normalizado (sin tildes, minusculas, colapso de espacios) — previene falsos positivos.", { bullet: true }));
children.push(bodyParagraph("Resultado al 2026-03-31: 29/29 locations con coordenadas reales.", { bullet: true }));
children.push(spacer());

// ── SECTION 8: MONETIZACIÓN ─────────────────────────────────────────────────
children.push(sectionHeading("8. MONETIZACION — IMPLEMENTACION COMPLETA (v0.8.1)"));
children.push(bodyParagraph("La infraestructura completa de monetizacion fue construida en el dia 16 del proyecto (S23). Activacion comercial: mes 6 (newsletter) y mes 9 (listings premium)."));
children.push(spacer());
children.push(subHeading("8.1 Roadmap de monetizacion Ano 1"));
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
children.push(subHeading("8.2 Componentes implementados"));
children.push(twoColTable(
  ["Componente", "Descripcion"],
  [
    ["A — Sponsor en email", "Bloque patrocinador en activity-digest.tsx: logo, tagline, link con UTM utm_campaign=newsletter"],
    ["B — isPremium Provider", "Campo en BD + badge 'Destacado' (estrella ambar) en ActivityCard + ordering preferencial"],
    ["C — Pagina /anunciate", "Landing estatica con stats (260+ acts, 14 fuentes, ~35% open rate) y precios orientativos"],
    ["D — Admin sponsors", "CRUD completo en /admin/sponsors: crear, activar/desactivar, editar, eliminar"],
    ["E — UTM tracking email", "Links 'Ver detalles' y 'Ver todas las actividades' con ?utm_source=infantia&utm_medium=email&utm_campaign=digest_{period}"],
    ["F — Pasarela de pago", "Wompi Colombia — PENDIENTE hasta mes 6 con primer cliente y cuenta activa"],
    ["G — Dashboard proveedor", "/proveedores/[slug]/dashboard — vistas totales, estado premium, tabla actividades. Acceso: ADMIN o proveedor dueno (email match + isClaimed=true)"],
  ]
));
children.push(spacer());
children.push(subHeading("8.3 Patron de acceso al dashboard de proveedor"));
children.push(bodyParagraph("Guard: getSessionWithRole() → si ADMIN permite; si role=provider verifica provider.email === session.user.email && provider.isClaimed.", { bullet: true }));
children.push(bodyParagraph("Header: si role=provider, busca proveedor con email match e isClaimed=true → extrae slug.", { bullet: true }));
children.push(bodyParagraph("UserMenu: si providerSlug presente, muestra link 'Mi panel' (indigo) ademas del admin link.", { bullet: true }));
children.push(bodyParagraph("Activar proveedor: setear isClaimed=true + email + rol PROVIDER (script promote-provider.ts pendiente).", { bullet: true }));
children.push(spacer());

// ── SECTION 9: FUNCIONALIDADES UI ───────────────────────────────────────────
children.push(sectionHeading("9. FUNCIONALIDADES DE INTERFAZ"));
children.push(subHeading("9.1 Paginas publicas"));
children.push(twoColTable(
  ["Ruta", "Descripcion"],
  [
    ["/", "Landing: stats reales, filtros rapidos, top 8 categorias, 8 actividades recientes"],
    ["/actividades", "Grid con filtros facetados + ordenamiento (5 criterios) + toggle Lista/Mapa + autocompletado"],
    ["/actividades/[uuid-slug]", "Detalle: hero imagen/gradiente, descripcion, fechas, precio, mini-mapa Leaflet, calificaciones, similares"],
    ["/mapa", "Mapa Leaflet interactivo — pines por categoria, popup con imagen y link"],
    ["/anunciate", "Landing de monetizacion: stats, opciones de patrocinio y listing premium, contacto (NUEVO v0.8.1)"],
    ["/proveedores/[slug]", "Perfil publico del proveedor con actividades activas y anteriores"],
    ["/contribuir", "Formulario para sugerir actividades o instituciones (mailto)"],
    ["/contacto", "6 motivos de contacto — precompletado desde link 'Reportar error'"],
    ["/login", "Formulario email + contrasena con Supabase Auth"],
    ["/registro", "Crear cuenta con aceptacion de terminos"],
    ["/privacidad", "Politica de privacidad (Ley 1581 Colombia)"],
    ["/terminos", "Terminos de uso"],
  ]
));
children.push(spacer());
children.push(subHeading("9.2 Zona de usuario (requiere sesion)"));
children.push(twoColTable(
  ["Ruta", "Descripcion"],
  [
    ["/perfil", "Dashboard con resumen: favoritos, hijos, calificaciones"],
    ["/perfil/editar", "Editar nombre, avatar (Supabase Storage), contrasena"],
    ["/perfil/favoritos", "Grid de actividades guardadas con FavoriteButton"],
    ["/perfil/hijos", "Lista de perfiles de hijos + /perfil/hijos/nuevo"],
    ["/perfil/historial", "Actividades vistas (localStorage, max 50 FIFO)"],
    ["/perfil/calificaciones", "Calificaciones del usuario con StarRating"],
    ["/perfil/notificaciones", "Toggles email/frecuencia + PushButton (Web Push real)"],
    ["/proveedores/[slug]/dashboard", "Dashboard de proveedor: vistas, premium, tabla actividades (NUEVO v0.8.1)"],
  ]
));
children.push(spacer());
children.push(subHeading("9.3 Panel admin (requiere rol ADMIN)"));
children.push(twoColTable(
  ["Ruta", "Descripcion"],
  [
    ["/admin", "Dashboard con 5 cards: Fuentes, Logs, Actividades, Metricas, Patrocinadores"],
    ["/admin/actividades", "Tabla con filtros, busqueda, paginacion, botones Ocultar/Activar y Editar"],
    ["/admin/metricas", "Vistas de actividades, busquedas frecuentes, distribucion por tipo y proveedores"],
    ["/admin/sponsors", "CRUD de patrocinadores: crear, activar/desactivar, editar, eliminar (NUEVO v0.8.1)"],
    ["/admin/scraping/sources", "Estado de las fuentes de scraping configuradas"],
    ["/admin/scraping/logs", "Historial de scraping y resultados"],
  ]
));
children.push(spacer());
children.push(subHeading("9.4 Componentes clave"));
children.push(twoColTable(
  ["Componente", "Descripcion"],
  [
    ["ActivityCard", "Tarjeta con strip h-20: imagen real o gradiente. Badge 'Destacado' (ambar, isPremium) o 'Nuevo' (rose)"],
    ["ActivityDetailMap", "Mini-mapa Leaflet en sidebar de detalle (next/dynamic ssr:false, skeleton animado)"],
    ["ActivityMap", "Mapa Leaflet client-only (ssr:false), pines coloridos, popup con CTA"],
    ["SimilarActivities", "4 actividades similares en detalle (scoring categoria + ciudad)"],
    ["FavoriteButton", "Corazon SVG con optimistic update — redirige a /login si no autenticado"],
    ["ShareButton", "Web Share API + dropdown 9 plataformas (WhatsApp, Facebook, X, etc.)"],
    ["StarRating", "1-5 estrellas interactivo o readonly"],
    ["UserMenu", "Menu usuario: Admin link + Mi panel (si providerSlug) + perfil + favoritos + salir (ACTUALIZADO)"],
    ["ProfileSidebar", "Sidebar desktop 240px + nav horizontal mobile en zona usuario"],
    ["PushButton", "Boton Web Push: registra SW, suscribe via PushManager, guarda endpoint en BD"],
    ["Footer", "Incluye link 'Anunciate' en naranja bajo seccion Explorar"],
  ]
));
children.push(spacer());

// ── SECTION 10: SEO ─────────────────────────────────────────────────────────
children.push(sectionHeading("10. SEO Y CANONICALIZACION DE URLs"));
children.push(bodyParagraph("Formato: /actividades/{uuid}-{slug-titulo} — UUID como clave de lookup, slug para SEO.", { bullet: true }));
children.push(bodyParagraph("extractActivityId() extrae UUID via regex del parametro — backward compatible con URLs bare.", { bullet: true }));
children.push(bodyParagraph("Redirect server-side: /actividades/{uuid} → /actividades/{uuid}-{slug} (permanente, SEO-safe).", { bullet: true }));
children.push(bodyParagraph("<link rel='canonical'> apunta siempre a la URL con slug.", { bullet: true }));
children.push(bodyParagraph("generateMetadata dinamico en /actividades/[id] — titulo, descripcion, OG, Twitter cards.", { bullet: true }));
children.push(bodyParagraph("JSON-LD Event schema en cada pagina de detalle.", { bullet: true }));
children.push(bodyParagraph("sitemap.xml dinamico con todas las actividades ACTIVE (URL con slug).", { bullet: true }));
children.push(bodyParagraph("robots.txt configurado para permitir indexacion.", { bullet: true }));
children.push(spacer());

// ── SECTION 11: IMAGENES ─────────────────────────────────────────────────────
children.push(sectionHeading("11. GESTION DE IMAGENES"));
children.push(twoColTable(
  ["Estrategia", "Detalle"],
  [
    ["og:image en pipeline", "CheerioExtractor extrae <meta property='og:image'> de cada pagina durante scraping"],
    ["Filtro de placeholders", "Descarta imagenes con 'blanco', 'logobogota', 'placeholder' en la URL"],
    ["Preservacion", "storage.ts no sobreescribe imageUrl existente al actualizar una actividad"],
    ["Backfill manual", "scripts/backfill-images.ts — 77/230 actividades enriquecidas con og:image real"],
    ["Gradientes placeholder", "getCategoryGradient() — 14 gradientes CSS por categoria para actividades sin imagen"],
    ["BibloRed", "150 actividades sin og:image — muestran gradiente segun categoria"],
  ]
));
children.push(spacer());

// ── SECTION 12: AUTH ─────────────────────────────────────────────────────────
children.push(sectionHeading("12. AUTENTICACION Y ROLES"));
children.push(bodyParagraph("Supabase Auth SSR con cookies HttpOnly — sin tokens en localStorage.", { bullet: true }));
children.push(bodyParagraph("Trigger SQL: al registro en auth.users → crea registro en public.users automaticamente.", { bullet: true }));
children.push(bodyParagraph("Roles: ADMIN (acceso total), PROVIDER (dashboard propio si isClaimed), MODERATOR, PARENT.", { bullet: true }));
children.push(bodyParagraph("requireRole([UserRole.ADMIN]) — redirige a '/' si rol insuficiente.", { bullet: true }));
children.push(bodyParagraph("getSessionWithRole() — obtiene sesion + rol en una sola llamada, lee app_metadata.role.", { bullet: true }));
children.push(bodyParagraph("Middleware protege /admin (rol ADMIN) y /perfil (usuario autenticado).", { bullet: true }));
children.push(bodyParagraph("Cumplimiento Ley 1581: /privacidad, /terminos, /tratamiento-datos, ARCO via /contacto.", { bullet: true }));
children.push(spacer());

// ── SECTION 13: NOTIFICACIONES ──────────────────────────────────────────────
children.push(sectionHeading("13. NOTIFICACIONES (EMAIL + WEB PUSH)"));
children.push(subHeading("Email (Resend + react-email)"));
children.push(bodyParagraph("Templates: welcome.tsx (bienvenida) y activity-digest.tsx (resumen de actividades nuevas).", { bullet: true }));
children.push(bodyParagraph("UTM tracking en todos los links del digest: ?utm_source=infantia&utm_medium=email&utm_campaign=digest_{daily|weekly} (NUEVO v0.8.1).", { bullet: true }));
children.push(bodyParagraph("Bloque sponsor opcional entre actividades y CTA final — se activa pasando prop 'sponsor' al template (NUEVO v0.8.1).", { bullet: true }));
children.push(bodyParagraph("Link del sponsor lleva utm_campaign=newsletter para diferenciar conversiones.", { bullet: true }));
children.push(bodyParagraph("Cron Vercel: 9am UTC diario (vercel.json). API POST /api/admin/send-notifications.", { bullet: true }));
children.push(spacer());
children.push(subHeading("Web Push (VAPID + Service Worker)"));
children.push(bodyParagraph("VAPID keys generadas — public/private key pair para autenticacion del servidor de push.", { bullet: true }));
children.push(bodyParagraph("public/sw.js — Service Worker: maneja eventos 'push' y 'notificationclick'.", { bullet: true }));
children.push(bodyParagraph("API POST /api/push/subscribe — guarda suscripcion (endpoint, p256dh, auth) en BD.", { bullet: true }));
children.push(spacer());

// ── SECTION 14: ESTADO ACTUAL ────────────────────────────────────────────────
children.push(sectionHeading("14. ESTADO ACTUAL — v0.8.1 + commits (2026-03-31)"));
children.push(twoColTable(
  ["Metrica", "Valor"],
  [
    ["Actividades en BD", "260 (150 BibloRed + 29 Sec. Cultura + 25 Planetario + 20 Alcaldia + 19 Idartes + 10 FCE + 4 JBB + 1 Cinemateca + 2 otros)"],
    ["Estado actividades", "Mayoria EXPIRED (cron expira por fecha < hoy). Pendiente: Banrep ingest para traer actividades futuras."],
    ["Locations geocodificadas", "29/29 con coordenadas reales (lat/lng != 0) — todas desde pipeline de ingest"],
    ["Tests", "748 tests en 49 archivos — todos verdes"],
    ["Cobertura", "~97% stmts / ~93% branches / ~99% funcs"],
    ["TypeScript", "0 errores (tsc --noEmit)"],
    ["Build", "OK — sin warnings criticos"],
    ["Deployment", "Vercel ACTIVO en https://infantia-activities.vercel.app"],
    ["CI/CD", "GitHub Actions — tests + build en cada push"],
    ["Cola", "BullMQ + Upstash Redis OPERATIVO"],
    ["Fuentes configuradas", "14 (web institucional + Banrep 10 ciudades)"],
    ["Gemini quota", "20 RPD free tier — renovacion medianoche UTC (19:00 COL)"],
    ["Proxy Playwright", "Codigo listo — IPRoyal vars en .env pendientes"],
    ["Sponsors CRUD", "Operativo — /admin/sponsors"],
    ["isPremium/badge", "Operativo — ordering + badge Destacado en ActivityCard"],
    ["Dashboard proveedor", "Operativo — /proveedores/[slug]/dashboard (ADMIN + owner)"],
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
    ["v0.7.1", "V14", "581 tests, 98.32% stmts, deuda tecnica tests"],
    ["v0.7.3", "V15", "Queue tests: 636 tests, queue/* 100% coverage"],
    ["v0.7.4", "V16", "BullMQ + Upstash Redis, Banrep 10 ciudades"],
    ["v0.7.5", "V16", "URLs canonicas, backfill imagenes, filtro precio"],
    ["v0.7.6", "V16", "Mapa Leaflet, similares, og:image pipeline, gradientes"],
    ["v0.7.7", "V17", "Web Push, admin actividades, pagina proveedor /proveedores/[slug]"],
    ["v0.8.0", "V18", "Autocompletado busqueda, ordenamiento, mapa pines, metricas admin, badge Nuevo"],
    ["v0.8.1", "V19", "Mini-mapa detalle, venue-dictionary 40+ venues, backfill-geocoding. 721 tests."],
    ["c355246", "V20", "Monetizacion A-G: sponsors CRUD, UTM tracking, isPremium, /anunciate, dashboard proveedor. 748 tests."],
    ["53f4961", "V20", "Dashboard proveedor accesible al dueno (email match + isClaimed)"],
    ["4772444", "V20", "Proxy residencial IPRoyal listo en PlaywrightExtractor"],
  ],
  [32, 13, 55]
));
children.push(spacer());

// ── SECTION 15: ROADMAP ──────────────────────────────────────────────────────
children.push(sectionHeading("15. ROADMAP"));
children.push(subHeading("v0.9.0 — Datos y busqueda avanzada"));
children.push(bodyParagraph("Banrep 10 ciudades con datos completos — ingest pendiente (Gemini quota resetea 19:00 COL).", { bullet: true }));
children.push(bodyParagraph("Activar Meilisearch Cloud — busqueda full-text cuando +1.000 actividades activas.", { bullet: true }));
children.push(bodyParagraph("Vista calendario en /actividades — tercer modo de vista junto a Lista y Mapa.", { bullet: true }));
children.push(bodyParagraph("Segunda ciudad con datos completos (Medellin o Cali) para MVP publico.", { bullet: true }));
children.push(bodyParagraph("Formulario 'Sugiere una actividad' — DRAFT → revision admin.", { bullet: true }));
children.push(spacer());
children.push(subHeading("v1.0.0 — MVP publico y monetizacion activa"));
children.push(bodyParagraph("Primer cliente sponsor newsletter (mes 6) — requiere cuenta Wompi activa.", { bullet: true }));
children.push(bodyParagraph("Primer proveedor premium (mes 9) — isClaimed + isPremium.", { bullet: true }));
children.push(bodyParagraph("Pagos Wompi: PSE + tarjeta + Nequi — webhook activa sponsor/isPremium automaticamente.", { bullet: true }));
children.push(bodyParagraph("Onboarding de nuevas fuentes automatizado.", { bullet: true }));
children.push(bodyParagraph("Activar proxy IPRoyal para escalar Instagram y explorar TikTok.", { bullet: true }));
children.push(spacer());

// ── SECTION 16: PENDIENTE ────────────────────────────────────────────────────
children.push(sectionHeading("16. PENDIENTE INMEDIATO"));
children.push(twoColTable(
  ["Item", "Detalle"],
  [
    ["Banrep ingest", "Correr ingest cuando Gemini resetee (19:00 COL). Cmd: npx tsx scripts/ingest-sources.ts --save-db"],
    ["Activar proxy IPRoyal", "Comprar credito ($7/GB) y agregar PLAYWRIGHT_PROXY_SERVER/USER/PASS al .env"],
    ["Meilisearch Cloud", "Activar cuando se superen 1.000 actividades activas — decidido Cloud free tier"],
    ["Wompi pagos", "Mes 6: cuenta bancaria + primer cliente + integracion checkout + webhook"],
    ["Script promote-provider.ts", "Dar rol PROVIDER + activar isClaimed para primer proveedor real"],
    ["Vista calendario", "/actividades?view=calendar — actividades por fecha en calendario mensual"],
  ]
));
children.push(spacer());

// ── SECTION 17: SCRIPTS UTILES ──────────────────────────────────────────────
children.push(sectionHeading("17. SCRIPTS Y COMANDOS UTILES"));
children.push(twoColTable(
  ["Comando", "Descripcion"],
  [
    ["npm run dev", "Servidor de desarrollo Next.js"],
    ["npm test", "Correr todos los tests una vez (vitest)"],
    ["npm run test:coverage", "Tests + reporte de cobertura con threshold dinamico"],
    ["npx tsx scripts/promote-admin.ts <email>", "Dar rol ADMIN a un usuario"],
    ["npx tsx scripts/verify-db.ts", "Verificar estado de la BD"],
    ["npx tsx scripts/expire-activities.ts", "Expirar actividades manualmente"],
    ["npx tsx scripts/backfill-images.ts", "Extraer og:image para actividades sin imagen"],
    ["npx tsx scripts/backfill-geocoding.ts [--dry-run]", "Geocodificar locations con coords 0,0"],
    ["npx tsx scripts/ingest-sources.ts --save-db", "Correr ingest directo a BD (sin queue)"],
    ["npx tsx scripts/ingest-sources.ts --queue", "Encolar todos los jobs de scraping"],
    ["npx tsx scripts/run-worker.ts", "Iniciar el worker BullMQ para procesar jobs"],
    ["npx tsx scripts/migrate-premium.ts", "Agregar columnas isPremium/premiumSince a providers (ya ejecutado)"],
    ["npx tsx scripts/migrate-sponsors.ts", "Crear tabla sponsors (ya ejecutado)"],
    ["npx tsx scripts/clean-queue.ts", "Limpiar jobs BullMQ acumulados (--dry-run disponible)"],
    ["node scripts/generate_v20.mjs", "Generar este Documento Fundacional V20"],
  ]
));
children.push(spacer());

// ── FINAL NOTE ───────────────────────────────────────────────────────────────
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(new Paragraph({
  children: [new TextRun({ text: "Infantia — Documento Fundacional V20", size: 18, font: "Arial", color: "999999", italics: true })],
  alignment: AlignmentType.CENTER, spacing: { before: 400, after: 80 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Generado por Claude Code el 2026-03-31 | Software: v0.8.1 (c355246, 53f4961, 4772444) | 748 tests | 49 archivos", size: 16, font: "Arial", color: "BBBBBB" })],
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
              children: [new TextRun({ text: "INFANTIA — DOCUMENTO FUNDACIONAL V20", size: 16, font: "Arial", color: "999999" })],
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

const OUTPUT_PATH = "C:\\Users\\denys\\OneDrive\\Documents\\DayJul\\Denys\\Infantia\\Infantia_Claude\\Infantia_Documento_Fundacional_V20.docx";

Packer.toBuffer(doc).then((buffer) => {
  writeFileSync(OUTPUT_PATH, buffer);
  console.log(`✅ Documento generado: ${OUTPUT_PATH}`);
});
