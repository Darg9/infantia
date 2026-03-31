import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
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

// Colors
const DARK_BLUE = "1A5276";
const WHITE = "FFFFFF";
const LIGHT_BLUE = "D6EAF8";
const ALT_ROW = "EAF4FB";
const LIGHT_GRAY = "F2F3F4";
const ORANGE = "E67E22";
const GREEN = "1E8449";

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
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, font: "Arial", color: WHITE })], alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 } })],
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
    children: [new Paragraph({ children: [new TextRun({ text, size: 19, font: "Arial", color: textColor, bold: opts.bold || false })], spacing: { before: 50, after: 50 }, alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT })],
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

// ---- COVER PAGE ----
children.push(new Paragraph({ children: [new TextRun({ text: "", size: 20 })], spacing: { before: 1200, after: 0 } }));
children.push(new Paragraph({ children: [new TextRun({ text: "INFANTIA", bold: true, size: 72, font: "Arial", color: DARK_BLUE })], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 } }));
children.push(new Paragraph({ children: [new TextRun({ text: "DOCUMENTO FUNDACIONAL V19", bold: true, size: 40, font: "Arial", color: DARK_BLUE })], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 } }));
children.push(new Paragraph({ children: [new TextRun({ text: "Plataforma de Descubrimiento de Actividades y Eventos", size: 28, font: "Arial", color: "555555", italics: true })], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 } }));
children.push(new Paragraph({ children: [new TextRun({ text: "2026-03-31", size: 24, font: "Arial", color: "777777" })], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 1600 } }));
children.push(new Paragraph({ children: [new TextRun({ text: "Documento generado automaticamente por Claude Code — Infantia v0.8.1", size: 18, font: "Arial", color: "999999", italics: true })], alignment: AlignmentType.CENTER }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- SECTION 1: VISION Y PROBLEMA ----
children.push(sectionHeading("1. VISION Y PROBLEMA"));
children.push(bodyParagraph("Las familias con ninos pasan horas buscando actividades en fuentes fragmentadas: sitios web institucionales, Instagram, grupos de WhatsApp, Facebook, Telegram. No existe un lugar centralizado que agregue, normalice y filtre esta informacion."));
children.push(spacer());
children.push(labelValue("La Solucion", "Infantia es un agregador multi-fuente con normalizacion inteligente que centraliza actividades y eventos para ninos, jovenes y familias en ciudades colombianas, con expansion a LATAM."));
children.push(labelValue("Nombre", "Infantia (raiz latina, decision familiar)"));
children.push(labelValue("Owner", "Denys Reyes (padre de una hija de 10 anos)"));
children.push(labelValue("Inicio del proyecto", "15 de marzo de 2026"));
children.push(spacer());

// ---- SECTION 2: PROPUESTA DE VALOR ----
children.push(sectionHeading("2. PROPUESTA DE VALOR"));
children.push(bodyParagraph("Para familias: Un solo lugar para descubrir todas las actividades disponibles para sus hijos, con filtros por edad, precio, ubicacion, audiencia y categoria."));
children.push(bodyParagraph("Para proveedores: Visibilidad gratuita y herramientas para gestionar su oferta de actividades."));
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
    ["Visuales ricos", "Gradientes por categoria para actividades sin imagen — nunca tarjeta vacia"],
  ]
));
children.push(spacer());

// ---- SECTION 3: STACK TECNOLOGICO ----
children.push(sectionHeading("3. STACK TECNOLOGICO"));
children.push(twoColTable(
  ["Capa", "Tecnologia"],
  [
    ["Framework", "Next.js 16.1.6 (App Router) + TypeScript strict"],
    ["Estilos", "Tailwind CSS + clsx"],
    ["Base de datos", "PostgreSQL via Supabase (Free Tier)"],
    ["ORM", "Prisma 7 con adapter-pg (PrismaClient con PrismaPg)"],
    ["Autenticacion", "Supabase Auth (SSR cookies, middleware)"],
    ["Scraping web", "Cheerio (HTML) + Playwright (JS-heavy / Instagram)"],
    ["AI / NLP", "Gemini 2.5 Flash (Google AI Studio, 20 RPD free tier)"],
    ["Email", "Resend + react-email templates"],
    ["Cola de tareas", "BullMQ + Upstash Redis (rediss:// TLS, Free Tier)"],
    ["Busqueda", "Meilisearch Cloud free tier — activar cuando +1.000 actividades activas"],
    ["Mapas", "Leaflet 1.9.4 + OpenStreetMap (sin API key)"],
    ["Geocoding", "Nominatim + venue-dictionary.ts curado (40+ venues, sin API key, ~0ms)"],
    ["Hosting", "Vercel (frontend + API) + Railway (workers, futuro)"],
    ["CI/CD", "GitHub Actions — tests + build en cada push a master"],
    ["Almacenamiento", "Supabase Storage (avatares de usuario)"],
  ]
));
children.push(spacer());

// ---- SECTION 4: ARQUITECTURA ----
children.push(sectionHeading("4. ARQUITECTURA DEL SISTEMA"));
children.push(subHeading("4.1 Estructura de directorios"));
children.push(twoColTable(
  ["Directorio", "Contenido"],
  [
    ["src/app/", "Next.js App Router — paginas, layouts, rutas API"],
    ["src/modules/", "Modulos de dominio: activities, providers, scraping, etc."],
    ["src/components/", "Componentes UI reutilizables"],
    ["src/lib/", "Utilidades compartidas (activity-url, category-utils, auth, db, venue-dictionary, geocoding)"],
    ["src/hooks/", "Custom React hooks (useActivityHistory)"],
    ["src/config/", "Constantes de configuracion (SITE_URL, etc.)"],
    ["scripts/", "Scripts de mantenimiento y generacion de documentos"],
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
children.push(spacer());

// ---- SECTION 5: MODELO DE DATOS ----
children.push(sectionHeading("5. MODELO DE DATOS"));
children.push(twoColTable(
  ["Entidad", "Descripcion"],
  [
    ["Activity", "Actividad normalizada: title, description, type, status, audience, price, imageUrl, sourceUrl, schedules (JSON)"],
    ["Provider", "Proveedor/institucion: name, slug (unico), type, website, isVerified"],
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

// ---- SECTION 6: PIPELINE DE SCRAPING ----
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
children.push(subHeading("6.2 Fuentes activas (14 total)"));
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
children.push(subHeading("6.3 Cola asincrona (BullMQ + Upstash Redis)"));
children.push(bodyParagraph("Los jobs de scraping se encolan via BullMQ en Upstash Redis (rediss:// TLS, Free Tier).", { bullet: true }));
children.push(bodyParagraph("Worker con concurrencia=1 respeta rate limit de Gemini (20 RPD free tier).", { bullet: true }));
children.push(bodyParagraph("Reintentos exponenciales: 3 intentos, backoff 5s.", { bullet: true }));
children.push(bodyParagraph("Comando: npx tsx scripts/ingest-sources.ts --queue + npx tsx scripts/run-worker.ts", { bullet: true }));
children.push(spacer());

// ---- SECTION 7: GEOCODING ----
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
children.push(bodyParagraph("lookupVenue() retorna { lat, lng, name } o null — integrado en geocoding.ts antes de llamar Nominatim.", { bullet: true }));
children.push(spacer());
children.push(subHeading("7.3 backfill-geocoding.ts"));
children.push(bodyParagraph("Script que detecta locations con coords 0,0 y las geocodifica usando venue-dictionary + Nominatim.", { bullet: true }));
children.push(bodyParagraph("Resultado al 2026-03-31: 29/29 locations con coordenadas reales (todas geocodificadas desde el pipeline de ingest).", { bullet: true }));
children.push(bodyParagraph("Modo --dry-run disponible para previsualizar sin guardar.", { bullet: true }));
children.push(spacer());

// ---- SECTION 8: FUNCIONALIDADES UI ----
children.push(sectionHeading("8. FUNCIONALIDADES DE INTERFAZ"));
children.push(subHeading("8.1 Paginas publicas"));
children.push(twoColTable(
  ["Ruta", "Descripcion"],
  [
    ["/", "Landing: stats reales, filtros rapidos por tipo, top 8 categorias, 8 actividades recientes"],
    ["/actividades", "Grid con filtros facetados + ordenamiento (5 criterios) + toggle Lista/Mapa + autocompletado"],
    ["/actividades/[uuid-slug]", "Detalle: hero imagen/gradiente, descripcion, fechas, precio, mini-mapa Leaflet, calificaciones, similares"],
    ["/mapa", "Mapa Leaflet interactivo — pines por categoria, popup con imagen y link"],
    ["/contribuir", "Formulario para sugerir actividades o instituciones (mailto)"],
    ["/contacto", "6 motivos de contacto — precompletado desde link 'Reportar error'"],
    ["/login", "Formulario email + contrasena con Supabase Auth"],
    ["/registro", "Crear cuenta con aceptacion de terminos"],
    ["/privacidad", "Politica de privacidad (Ley 1581 Colombia)"],
    ["/terminos", "Terminos de uso"],
    ["/tratamiento-datos", "Politica de tratamiento de datos"],
  ]
));
children.push(spacer());
children.push(subHeading("8.2 Zona de usuario (requiere sesion)"));
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
  ]
));
children.push(spacer());
children.push(subHeading("8.3 Panel admin (requiere rol ADMIN)"));
children.push(bodyParagraph("/admin — dashboard con links a fuentes y logs de scraping.", { bullet: true }));
children.push(bodyParagraph("/admin/actividades — tabla con filtros, busqueda, paginacion, botones Ocultar/Activar y Editar.", { bullet: true }));
children.push(bodyParagraph("/admin/metricas — vistas de actividades, busquedas frecuentes, distribucion por tipo y proveedores.", { bullet: true }));
children.push(bodyParagraph("API: GET/POST /api/admin/queue/status — estado y encolado de jobs.", { bullet: true }));
children.push(bodyParagraph("Script: npx tsx scripts/promote-admin.ts <email> — dar rol ADMIN.", { bullet: true }));
children.push(spacer());
children.push(subHeading("8.4 Componentes clave"));
children.push(twoColTable(
  ["Componente", "Descripcion"],
  [
    ["ActivityCard", "Tarjeta con strip h-20: imagen real o gradiente por categoria + emoji + badge 'Nuevo'"],
    ["ActivityDetailMap", "Mini-mapa Leaflet en sidebar de detalle (next/dynamic ssr:false, skeleton animado)"],
    ["ActivityMap", "Mapa Leaflet client-only (ssr:false), pines coloridos, popup con CTA"],
    ["SimilarActivities", "4 actividades similares en detalle (scoring categoria + ciudad)"],
    ["FavoriteButton", "Corazon SVG con optimistic update — redirige a /login si no autenticado"],
    ["ShareButton", "Web Share API + dropdown 9 plataformas (WhatsApp, Facebook, X, etc.)"],
    ["StarRating", "1-5 estrellas interactivo o readonly"],
    ["RatingForm", "Form con StarRating + comentario en detalle de actividad"],
    ["ProfileSidebar", "Sidebar desktop 240px + nav horizontal mobile en zona usuario"],
    ["ActivityHistoryTracker", "Invisible — registra actividades vistas en localStorage"],
    ["getCategoryGradient()", "14 gradientes CSS por categoria + 8 fallbacks hash-based"],
    ["PushButton", "Boton Web Push: registra SW, suscribe via PushManager, guarda endpoint en BD"],
  ]
));
children.push(spacer());

// ---- SECTION 9: SEO Y CANONICALIZACION ----
children.push(sectionHeading("9. SEO Y CANONICALIZACION DE URLs"));
children.push(subHeading("9.1 URLs canonicas"));
children.push(bodyParagraph("Formato: /actividades/{uuid}-{slug-titulo} — UUID como clave de lookup, slug para SEO.", { bullet: true }));
children.push(bodyParagraph("extractActivityId() extrae UUID via regex del parametro — backward compatible con URLs bare.", { bullet: true }));
children.push(bodyParagraph("Redirect server-side: /actividades/{uuid} → /actividades/{uuid}-{slug} (permanente, SEO-safe).", { bullet: true }));
children.push(bodyParagraph("<link rel='canonical'> apunta siempre a la URL con slug.", { bullet: true }));
children.push(spacer());
children.push(subHeading("9.2 Metadata y structured data"));
children.push(bodyParagraph("generateMetadata dinamico en /actividades/[id] — titulo, descripcion, OG, Twitter cards.", { bullet: true }));
children.push(bodyParagraph("JSON-LD Event schema en cada pagina de detalle.", { bullet: true }));
children.push(bodyParagraph("sitemap.xml dinamico con todas las actividades ACTIVE (URL con slug).", { bullet: true }));
children.push(bodyParagraph("robots.txt configurado para permitir indexacion.", { bullet: true }));
children.push(spacer());

// ---- SECTION 10: IMAGENES ----
children.push(sectionHeading("10. GESTION DE IMAGENES"));
children.push(twoColTable(
  ["Estrategia", "Detalle"],
  [
    ["og:image en pipeline", "CheerioExtractor extrae <meta property='og:image'> de cada pagina durante scraping"],
    ["Filtro de placeholders", "Descarta imagenes con 'blanco', 'logobogota', 'placeholder' en la URL"],
    ["Preservacion", "storage.ts no sobreescribe imageUrl existente al actualizar una actividad"],
    ["Backfill manual", "scripts/backfill-images.ts — 77/230 actividades enriquecidas con og:image real"],
    ["Gradientes placeholder", "getCategoryGradient() — 14 gradientes CSS por categoria para actividades sin imagen"],
    ["BibloRed", "150 actividades sin og:image — muestran gradiente segun categoria"],
    ["Detalle sin imagen", "Hero h-44 con gradiente + emoji centrado + badges backdrop-blur"],
  ]
));
children.push(spacer());

// ---- SECTION 11: AUTENTICACION Y USUARIOS ----
children.push(sectionHeading("11. AUTENTICACION Y GESTION DE USUARIOS"));
children.push(subHeading("11.1 Flujo de autenticacion"));
children.push(bodyParagraph("Supabase Auth SSR con cookies HttpOnly — sin tokens en localStorage.", { bullet: true }));
children.push(bodyParagraph("Trigger SQL: al registro en auth.users → crea registro en public.users automaticamente.", { bullet: true }));
children.push(bodyParagraph("getSessionWithRole() — obtiene sesion + rol del usuario en una sola llamada.", { bullet: true }));
children.push(bodyParagraph("Middleware protege /admin (rol ADMIN) y /perfil (usuario autenticado).", { bullet: true }));
children.push(spacer());
children.push(subHeading("11.2 Cumplimiento legal (Ley 1581 Colombia)"));
children.push(bodyParagraph("Paginas: /privacidad, /terminos, /tratamiento-datos.", { bullet: true }));
children.push(bodyParagraph("Formulario /contacto con motivo 'Ejercer derechos ARCO'.", { bullet: true }));
children.push(bodyParagraph("Consentimiento parental explicito en creacion de perfiles de hijos.", { bullet: true }));
children.push(bodyParagraph("SIC_RNBD_Registro.md — guia de registro ante la SIC.", { bullet: true }));
children.push(spacer());

// ---- SECTION 12: NOTIFICACIONES ----
children.push(sectionHeading("12. NOTIFICACIONES (EMAIL + WEB PUSH)"));
children.push(subHeading("Email (Resend + react-email)"));
children.push(bodyParagraph("Templates: welcome.tsx (bienvenida) y activity-digest.tsx (resumen de actividades nuevas).", { bullet: true }));
children.push(bodyParagraph("Logica de envio: API POST /api/admin/send-notifications — filtra por preferencias del usuario.", { bullet: true }));
children.push(bodyParagraph("Cron Vercel: 9am UTC diario (vercel.json).", { bullet: true }));
children.push(spacer());
children.push(subHeading("Web Push (VAPID + Service Worker)"));
children.push(bodyParagraph("VAPID keys generadas — public/private key pair para autenticacion del servidor de push.", { bullet: true }));
children.push(bodyParagraph("public/sw.js — Service Worker: maneja eventos 'push' y 'notificationclick'.", { bullet: true }));
children.push(bodyParagraph("API POST /api/push/subscribe — guarda suscripcion (endpoint, p256dh, auth) en BD.", { bullet: true }));
children.push(bodyParagraph("PushButton — estados: loading | unsupported | denied | subscribed | unsubscribed.", { bullet: true }));
children.push(spacer());

// ---- SECTION 13: ESTADO ACTUAL ----
children.push(sectionHeading("13. ESTADO ACTUAL — v0.8.1 (2026-03-31)"));
children.push(twoColTable(
  ["Metrica", "Valor"],
  [
    ["Actividades en BD", "260 (150 BibloRed + 29 Sec. Cultura + 25 Planetario + 20 Alcaldia + 19 Idartes + 10 FCE + 4 JBB + 1 Cinemateca + 2 otros)"],
    ["Actividades con imagen real", "77+ (og:image extraida por pipeline + backfill)"],
    ["Locations geocodificadas", "29/29 con coordenadas reales (lat/lng != 0)"],
    ["Tests", "721 tests en 47 archivos — todos verdes"],
    ["Cobertura", "~97% stmts / ~93% branches / ~99% funcs"],
    ["TypeScript", "0 errores (tsc --noEmit)"],
    ["Build", "OK — sin warnings criticos"],
    ["Deployment", "Vercel ACTIVO en https://infantia-activities.vercel.app"],
    ["CI/CD", "GitHub Actions — tests + build en cada push"],
    ["Cola", "BullMQ + Upstash Redis OPERATIVO"],
    ["Fuentes configuradas", "14 (web institucional + Banrep 10 ciudades)"],
    ["Gemini quota", "20 RPD free tier — renovacion medianoche UTC"],
    ["Geocoding", "venue-dictionary.ts (40+ venues) + Nominatim fallback"],
  ]
));
children.push(spacer());
children.push(subHeading("13.1 Historial de versiones"));
children.push(threeColTable(
  ["Git tag", "Doc Fundacional", "Hito principal"],
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
    ["v0.8.1", "V19", "Mini-mapa detalle actividad, venue-dictionary 40+ venues, backfill-geocoding"],
  ],
  [30, 15, 55]
));
children.push(spacer());

// ---- SECTION 14: ROADMAP ----
children.push(sectionHeading("14. ROADMAP"));
children.push(subHeading("v0.9.0 — Panel de proveedores y busqueda avanzada"));
children.push(bodyParagraph("Reclamacion de perfil de proveedor — dashboard para gestionar sus actividades.", { bullet: true }));
children.push(bodyParagraph("Activar Meilisearch Cloud — busqueda full-text con relevancia, facetas y typo-tolerance (cuando +1.000 actividades activas).", { bullet: true }));
children.push(bodyParagraph("Vista calendario en /actividades — tercer modo de vista junto a Lista y Mapa.", { bullet: true }));
children.push(bodyParagraph("Formulario 'Sugiere una actividad' — usuarios envian actividades → DRAFT → revision admin.", { bullet: true }));
children.push(bodyParagraph("Banrep 10 ciudades con datos completos — ampliar covertura nacional.", { bullet: true }));
children.push(spacer());
children.push(subHeading("v1.0.0 — MVP publico"));
children.push(bodyParagraph("Segunda ciudad con datos completos (Medellin o Cali).", { bullet: true }));
children.push(bodyParagraph("Onboarding de nuevas fuentes automatizado.", { bullet: true }));
children.push(bodyParagraph("Modelo de monetizacion: newsletter sponsorships (mes 6), listings premium (mes 9).", { bullet: true }));
children.push(spacer());
children.push(subHeading("Monetizacion — Roadmap Año 1"));
children.push(twoColTable(
  ["Fase", "Descripcion"],
  [
    ["Mes 1-5 (actual)", "Construir audiencia. 0 ingresos. Enfoque en calidad de datos y UX."],
    ["Mes 6", "Newsletter sponsorships: patrocinios en digest semanal. COP 200k-500k/mes."],
    ["Mes 9", "Listings premium: proveedores destacados en busqueda. COP 150k-300k/mes."],
    ["Ano 2", "Freemium proveedores (dashboard analiticas) + cajas de compensacion B2B."],
    ["Largo plazo", "Modelo Fever: de agregador a productor de eventos propios curados."],
  ]
));
children.push(spacer());

// ---- SECTION 15: PENDIENTE ----
children.push(sectionHeading("15. PENDIENTE INMEDIATO"));
children.push(twoColTable(
  ["Item", "Detalle"],
  [
    ["Banrep ingest", "Correr ingest cuando Gemini resetee (19:00 COL). Objetivo: +200 actividades de 10 ciudades."],
    ["Meilisearch Cloud", "Activar cuando se superen 1.000 actividades activas — decidido Cloud free tier."],
    ["Vista calendario", "/actividades?view=calendar — actividades por fecha en calendario mensual"],
    ["Segunda ciudad", "Medellin o Cali con datos completos para MVP publico"],
    ["Proxy provider", "Antes de escalar scraping Instagram/TikTok"],
    ["Documento Fundacional V20", "Cuando acumulen cambios suficientes post-v0.9.0"],
  ]
));
children.push(spacer());

// ---- SECTION 16: SCRIPTS UTILES ----
children.push(sectionHeading("16. SCRIPTS Y COMANDOS UTILES"));
children.push(twoColTable(
  ["Comando", "Descripcion"],
  [
    ["npm run dev", "Servidor de desarrollo Next.js"],
    ["npm test", "Correr todos los tests una vez (vitest)"],
    ["npm run test:coverage", "Tests + reporte de cobertura con threshold dinamico"],
    ["npx tsx scripts/promote-admin.ts <email>", "Dar rol ADMIN a un usuario"],
    ["npx tsx scripts/seed-scraping-sources.ts", "Crear las 14 fuentes de scraping en BD"],
    ["npx tsx scripts/verify-db.ts", "Verificar estado de la BD"],
    ["npx tsx scripts/expire-activities.ts", "Expirar actividades manualmente"],
    ["npx tsx scripts/reclassify-audience.ts", "Reclasificar audiencia de actividades via Gemini"],
    ["npx tsx scripts/backfill-images.ts", "Extraer og:image para actividades sin imagen"],
    ["npx tsx scripts/backfill-geocoding.ts [--dry-run]", "Geocodificar locations con coords 0,0"],
    ["npx tsx scripts/ingest-sources.ts --queue", "Encolar todos los jobs de scraping"],
    ["npx tsx scripts/run-worker.ts", "Iniciar el worker BullMQ para procesar jobs"],
    ["npx tsx scripts/clean-queue.ts", "Limpiar jobs BullMQ acumulados (--dry-run disponible)"],
    ["node scripts/generate_v19.mjs", "Generar este Documento Fundacional V19"],
  ]
));
children.push(spacer());

// ---- FINAL NOTE ----
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(new Paragraph({ children: [new TextRun({ text: "Infantia — Documento Fundacional V19", size: 18, font: "Arial", color: "999999", italics: true })], alignment: AlignmentType.CENTER, spacing: { before: 400, after: 80 } }));
children.push(new Paragraph({ children: [new TextRun({ text: "Generado por Claude Code el 2026-03-31 | Version del software: v0.8.1", size: 16, font: "Arial", color: "BBBBBB" })], alignment: AlignmentType.CENTER }));

// ===================== BUILD DOCUMENT =====================
const doc = new Document({
  numbering: { config: [] },
  sections: [
    {
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "INFANTIA — DOCUMENTO FUNDACIONAL V19", size: 16, font: "Arial", color: "999999" }),
              ],
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
          margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1.2), right: convertInchesToTwip(1.2) },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      children,
    },
  ],
});

const OUTPUT = "C:/Users/denys/OneDrive/Documents/DayJul/Denys/Infantia/Infantia_Claude/Infantia_Documento_Fundacional_V19.docx";
const buffer = await Packer.toBuffer(doc);
writeFileSync(OUTPUT, buffer);
console.log("✅ Documento generado: " + OUTPUT);
