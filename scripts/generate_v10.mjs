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

// Helper: section heading
function sectionHeading(text) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        color: DARK_BLUE,
        size: 26,
        font: "Arial",
      }),
    ],
    spacing: { before: 320, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: DARK_BLUE },
    },
  });
}

// Helper: body paragraph
function bodyParagraph(text, opts = {}) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        size: 20,
        font: "Arial",
        bold: opts.bold || false,
        color: opts.color || "000000",
      }),
    ],
    spacing: { before: 60, after: 60 },
    bullet: opts.bullet ? { level: 0 } : undefined,
  });
}

// Helper: label + value paragraph
function labelValue(label, value) {
  return new Paragraph({
    children: [
      new TextRun({ text: label + ": ", bold: true, size: 20, font: "Arial", color: DARK_BLUE }),
      new TextRun({ text: value, size: 20, font: "Arial" }),
    ],
    spacing: { before: 60, after: 60 },
  });
}

// Helper: build table header cell
function headerCell(text, widthPct) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 20, font: "Arial", color: WHITE })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 60 },
      }),
    ],
    shading: { fill: DARK_BLUE, type: ShadingType.CLEAR, color: DARK_BLUE },
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
  });
}

// Helper: build table data cell
function dataCell(text, isAlt, opts = {}) {
  const fill = opts.header ? DARK_BLUE : isAlt ? ALT_ROW : WHITE;
  const textColor = opts.header ? WHITE : "000000";
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 19, font: "Arial", color: textColor, bold: opts.bold || false })],
        spacing: { before: 50, after: 50 },
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      }),
    ],
    shading: { fill, type: ShadingType.CLEAR, color: fill },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
  });
}

// Helper: simple 2-col table
function twoColTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map((h, i) => headerCell(h, i === 0 ? 35 : 65)),
        tableHeader: true,
      }),
      ...rows.map((r, idx) =>
        new TableRow({
          children: r.map((cell) => dataCell(cell, idx % 2 === 1)),
        })
      ),
    ],
  });
}

// Helper: 3-col table
function threeColTable(headers, rows, widths = [35, 45, 20]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map((h, i) => headerCell(h, widths[i])),
        tableHeader: true,
      }),
      ...rows.map((r, idx) =>
        new TableRow({
          children: r.map((cell) => dataCell(cell, idx % 2 === 1)),
        })
      ),
    ],
  });
}

// Helper: spacer
function spacer(lines = 1) {
  return new Paragraph({ children: [new TextRun({ text: "", size: 20 })], spacing: { before: lines * 60, after: 0 } });
}

// ===================== DOCUMENT CONTENT =====================

const children = [];

// ---- COVER PAGE ----
children.push(
  new Paragraph({ children: [new TextRun({ text: "", size: 20 })], spacing: { before: 1200, after: 0 } })
);
children.push(
  new Paragraph({
    children: [
      new TextRun({
        text: "INFANTIA",
        bold: true,
        size: 72,
        font: "Arial",
        color: DARK_BLUE,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 80 },
  })
);
children.push(
  new Paragraph({
    children: [
      new TextRun({
        text: "DOCUMENTO FUNDACIONAL V10",
        bold: true,
        size: 40,
        font: "Arial",
        color: DARK_BLUE,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 200 },
  })
);
children.push(
  new Paragraph({
    children: [
      new TextRun({
        text: "Plataforma de Descubrimiento de Actividades y Eventos",
        size: 28,
        font: "Arial",
        color: "555555",
        italics: true,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 120 },
  })
);
children.push(
  new Paragraph({
    children: [new TextRun({ text: "2026-03-18", size: 24, font: "Arial", color: "777777" })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 1600 },
  })
);
children.push(
  new Paragraph({
    children: [
      new TextRun({
        text: "Documento generado automaticamente por Claude Code — Infantia v0.5.0",
        size: 18,
        font: "Arial",
        color: "999999",
        italics: true,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
  })
);
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- SECTION 1: VISION Y PROBLEMA ----
children.push(sectionHeading("1. VISION Y PROBLEMA"));
children.push(
  bodyParagraph(
    "Las familias con ninos pasan horas buscando actividades en fuentes fragmentadas: sitios web institucionales, Instagram, grupos de WhatsApp, Facebook, Telegram. No existe un lugar centralizado que agregue, normalice y filtre esta informacion."
  )
);
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
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Diferenciadores:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const d of [
  "Datos de multiples fuentes (web + redes sociales)",
  "Normalizacion inteligente con IA (Gemini + Claude)",
  "Multi-vertical por configuracion (no por codigo)",
  "Multi-pais desde el dia uno",
  "Filtros facetados inteligentes (cada dimension muestra conteos reales en tiempo real)",
]) {
  children.push(bodyParagraph("- " + d));
}
children.push(spacer());

// ---- SECTION 3: ACTORES DEL SISTEMA ----
children.push(sectionHeading("3. ACTORES DEL SISTEMA"));
children.push(spacer(0.5));
children.push(
  twoColTable(
    ["Actor", "Descripcion"],
    [
      ["Familia / Padre", "Usuario principal — busca y filtra actividades para sus hijos"],
      ["Nino / Joven", "Beneficiario final de las actividades"],
      ["Proveedor", "Academia, institucion, club, biblioteca que ofrece actividades"],
      ["Administrador", "Gestiona la plataforma, modera contenido, configura verticales"],
      ["Scraper / Bot", "Componente automatico que recolecta datos de fuentes externas"],
    ]
  )
);
children.push(spacer());

// ---- SECTION 4: STACK TECNOLOGICO ----
children.push(sectionHeading("4. STACK TECNOLOGICO"));
children.push(spacer(0.5));
children.push(
  threeColTable(
    ["Capa", "Tecnologia", "Version"],
    [
      ["Frontend + Backend", "Next.js + TypeScript", "15.x"],
      ["Base de Datos", "PostgreSQL via Supabase", "latest"],
      ["ORM", "Prisma", "7.5.0"],
      ["Busqueda", "Meilisearch (MVP) -> Elasticsearch (escala)", "—"],
      ["Cache / Queue", "Redis + BullMQ", "—"],
      ["Scraping estatico", "Cheerio", "—"],
      ["Scraping dinamico", "Playwright", "—"],
      ["IA / NLP", "Gemini 2.5 Flash (scraping) + Claude API (futuro)", "—"],
      ["Auth", "Supabase Auth", "—"],
      ["Hosting", "Vercel (frontend) + Railway (workers)", "—"],
      ["Storage", "Supabase Storage", "—"],
    ],
    [40, 45, 15]
  )
);
children.push(spacer());

// ---- SECTION 5: MODELO DE DATOS ----
children.push(sectionHeading("5. MODELO DE DATOS (12 entidades)"));
children.push(spacer(0.5));
children.push(
  twoColTable(
    ["Entidad", "Descripcion"],
    [
      ["Activity", "Actividad o evento normalizado"],
      ["Provider", "Proveedor u organizacion que ofrece la actividad"],
      ["User", "Usuario registrado (accountType: adult | minor, guardianId para menores futuros)"],
      ["Child", "Perfil del nino creado por el padre/tutor — Escenario A (MVP)"],
      ["Location", "Lugar fisico donde se realiza la actividad"],
      ["City", "Ciudad configurada en la plataforma"],
      ["Vertical", "Vertical tematica (ej. kids, deportes, cultura)"],
      ["Category", "Categoria de actividad dentro de un vertical"],
      ["Favorite", "Actividad marcada como favorita por un usuario"],
      ["Rating", "Calificacion de una actividad por un usuario"],
      ["ScrapingSource", "Fuente de datos configurada para scraping"],
      ["ScrapingLog", "Registro de ejecucion de cada proceso de scraping"],
    ]
  )
);
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Campos clave de Activity:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 100, after: 60 } }));
for (const f of [
  "type: ONE_TIME | RECURRING | CAMP | WORKSHOP",
  "status: DRAFT | ACTIVE | PAUSED | EXPIRED",
  "audience: KIDS | FAMILY | ADULTS | ALL (enum Prisma, inferido por Gemini desde el contenido)",
  "ageMin, ageMax — rango de edad objetivo (0 a 120, ageMin=0 valido)",
  "price, pricePeriod (FREE | PER_SESSION | MONTHLY | TOTAL), priceCurrency",
  "sourceType, sourceUrl, sourceConfidence",
  "schedule (JSON para actividades recurrentes)",
]) {
  children.push(bodyParagraph("- " + f));
}
children.push(bodyParagraph("Decision MVP: No se implementa ActivityOccurrence (sobre-ingenieria)", { bold: true }));
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Campos clave de Child:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 100, after: 60 } }));
for (const f of [
  "name, birthDate — campos requeridos",
  "gender (MALE | FEMALE | OTHER | PREFER_NOT_TO_SAY) — opcional",
  "consentType: 'parental' — Escenario A. Preparado para 'self' en Escenario B (menores con cuenta propia)",
  "consentGivenAt, consentGivenBy (userId del padre), consentText (texto legal completo guardado en DB)",
]) {
  children.push(bodyParagraph("- " + f));
}
children.push(bodyParagraph("Modelo diseñado para ser compatible hacia adelante con Escenario B sin migraciones destructivas.", { bold: false, color: "555555" }));
children.push(spacer());

// ---- SECTION 6: ARQUITECTURA DEL SISTEMA ----
children.push(sectionHeading("6. ARQUITECTURA DEL SISTEMA"));
children.push(new Paragraph({ children: [new TextRun({ text: "4 capas principales:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const layer of [
  "Presentacion: Next.js (SSR + CSR)",
  "API: Next.js API Routes",
  "Ingesta: Pipeline de scraping (Cheerio + Playwright + Gemini)",
  "Datos: PostgreSQL (Supabase) + Redis (cache/queue)",
]) {
  children.push(bodyParagraph("- " + layer));
}
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Principios de arquitectura:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const p of [
  "API-first — todo a traves de endpoints",
  "Multi-vertical por configuracion (nuevos verticales = registros en DB, no codigo)",
  "Event-driven — comunicacion interna por eventos",
  "Multi-pais desde el dia uno (sin hardcodear ciudades, paises ni monedas)",
  "El dato es el activo, no el codigo",
  "Diversificar fuentes — ninguna fuente supera el 30% del total de datos",
  "Trazabilidad legal de todas las fuentes scrapeadas",
]) {
  children.push(bodyParagraph("- " + p));
}
children.push(spacer());

// ---- SECTION 7: PIPELINE DE SCRAPING ----
children.push(sectionHeading("7. PIPELINE DE SCRAPING (CONSTRUIDO Y FUNCIONAL)"));
children.push(labelValue("Estado", "Pipeline completamente funcional con datos reales en produccion (2026-03-16)"));
children.push(spacer(0.5));
children.push(
  threeColTable(
    ["Paso", "Componente", "Descripcion"],
    [
      ["1", "CheerioExtractor (discovery)", "Extrae URLs de actividades desde paginas listado con paginacion automatica"],
      ["2", "Paginacion automatica", "Detecta y recorre todas las paginas del sitio hasta agotar resultados"],
      ["3", "Gemini Filter (lotes de 50)", "Filtra URLs irrelevantes antes de scraping profundo — chunking optimizado"],
      ["4", "CheerioExtractor individual", "Extrae contenido HTML de cada actividad relevante"],
      ["5", "GeminiAnalyzer", "Normaliza con IA: extrae campos estructurados incluyendo audience (KIDS/FAMILY/ADULTS/ALL)"],
      ["6", "ScrapingStorage", "Guarda en PostgreSQL via Prisma con upsert por sourceUrl"],
      ["7", "Cache incremental", "Evita re-procesar URLs ya scrapeadas en sesiones anteriores"],
    ],
    [8, 30, 62]
  )
);
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Pipeline de Instagram:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const c of [
  "PlaywrightExtractor: Chromium headless, desktop UA, viewport 1280x800",
  "Sesion persistente: Login manual one-time, cookies guardadas en ig-session.json (no en git)",
  "Extraccion: Perfil > bio + grid de posts > navegacion individual a cada post",
  "Datos por post: caption, imagenes, timestamp, likes",
  "Anti-deteccion: delays aleatorios 2-5s, locale es-CO, timezone America/Bogota",
  "NLP: Prompt Gemini especifico para Instagram (hashtags como categorias, emojis como indicadores, audience inferido)",
  "Procesamiento secuencial (no paralelo) para evitar bans",
]) {
  children.push(bodyParagraph("- " + c));
}
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Comandos utiles:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
children.push(bodyParagraph("npx tsx scripts/test-scraper.ts --discover --save-db <URL>"));
children.push(bodyParagraph("npx tsx scripts/verify-db.ts"));
children.push(bodyParagraph("npx tsx scripts/ig-login.ts"));
children.push(bodyParagraph("npx tsx scripts/test-instagram.ts <URL> [--save-db] [--max-posts=N]"));
children.push(bodyParagraph("npx tsx scripts/reclassify-audience.ts  (reclasificar audiencia de todas las actividades)"));
children.push(bodyParagraph("npx tsx scripts/expire-activities.ts  (expiracion manual)"));
children.push(spacer());

// ---- SECTION 8: ESTRATEGIA DE SCRAPING ----
children.push(sectionHeading("8. ESTRATEGIA DE SCRAPING"));
children.push(new Paragraph({ children: [new TextRun({ text: "Fases de expansion de fuentes:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
children.push(bodyParagraph("- MVP: Web estatico (Cheerio) + Instagram (Playwright)"));
children.push(bodyParagraph("- Fase 2: Facebook Graph API + Telegram Bot API"));
children.push(bodyParagraph("- Fase 3: TikTok, X (Twitter), WhatsApp Business"));
children.push(spacer());
for (const item of [
  ["Motor generico", "Para todos los sitios. Extractor especifico solo si >20% del contenido del sitio requiere tratamiento especial."],
  ["Precision actual", "~97% de actividades con confianza alta (>= 0.9 en campo sourceConfidence)"],
  ["NLP", "Gemini 2.5 Flash, temperatura 0.1 para maxima consistencia. Prompt actualizado para inferir audience."],
  ["Anti-blocking", "Proxy rotation, user-agent rotation, rate limiting, respeto a robots.txt"],
]) {
  children.push(labelValue(item[0], item[1]));
}
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Riesgo legal y mitigacion:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
children.push(
  threeColTable(
    ["Fuente", "Riesgo", "Mitigacion"],
    [
      ["Entidades publicas (BibloRed, Alcaldia)", "Bajo — datos publicos", "Atribucion, enlace a fuente, politica de remocion"],
      ["Instagram", "Medio-alto — viola ToS de Meta", "Mecanismo de takedown, contacto proactivo a cuentas, revisar Fase 2"],
      ["Academias privadas", "Bajo-medio — datos publicados voluntariamente", "Atribucion clara, respuesta en 5 dias habiles ante solicitudes"],
    ],
    [30, 30, 40]
  )
);
children.push(spacer());

// ---- SECTION 9: BASE DE DATOS — ESTADO ACTUAL ----
children.push(sectionHeading("9. BASE DE DATOS — ESTADO ACTUAL"));
children.push(labelValue("Motor", "PostgreSQL en Supabase"));
children.push(labelValue("ORM", "Prisma 7.5.0"));
children.push(labelValue("Seed", "10 ciudades colombianas, 1 vertical kids, 47 categorias"));
children.push(spacer(0.5));
children.push(
  twoColTable(
    ["Metrica", "Valor"],
    [
      ["Actividades totales en Supabase", "200"],
      ["Fuentes activas", "4"],
      ["Gratis (pricePeriod = FREE)", "175 (93%)"],
      ["De pago", "13 (7%)"],
      ["Alta confianza (sourceConfidence >= 0.7)", "185 (98%)"],
      ["Muy alta confianza (>= 0.9)", "181 (96%)"],
      ["Con rango de edad definido", "145 (77%)"],
      ["Tiempo total batch completo", "~12 minutos"],
    ]
  )
);
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Desglose por fuente:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
children.push(spacer(0.5));
children.push(
  threeColTable(
    ["Fuente", "Actividades", "Alta confianza"],
    [
      ["BibloRed (biblored.gov.co)", "167 (84%)", "165 / 167 (99%)"],
      ["Alcaldia de Bogota (bogota.gov.co)", "21 (10.5%)", "20 / 21 (95%)"],
      ["FCE Colombia (Instagram @fcecolombia)", "10 (5%)", "8 / 10 (80%)"],
      ["Que hay pa hacer (Instagram @quehaypahacerenbogota)", "2 (1%)", "2 / 2 (100%)"],
    ],
    [50, 25, 25]
  )
);
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Clasificacion por audiencia (post reclasificacion Gemini):", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
children.push(spacer(0.5));
children.push(
  twoColTable(
    ["Audiencia", "Actividades"],
    [
      ["KIDS (ninos)", "35 (17.5%)"],
      ["FAMILY (familias)", "36 (18%)"],
      ["ADULTS (adultos)", "68 (34%)"],
      ["ALL (todas las edades)", "61 (30.5%)"],
      ["TOTAL", "200 (100%)"],
    ]
  )
);
children.push(bodyParagraph("Script de reclasificacion: npx tsx scripts/reclassify-audience.ts — procesa todas las actividades ACTIVE via Gemini y actualiza el campo audience en DB.", { color: "555555" }));
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Logica de expiracion de actividades:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const r of [
  "ONE_TIME / CAMP / WORKSHOP con endDate pasado → EXPIRED automaticamente",
  "ONE_TIME / CAMP / WORKSHOP con startDate > 3 dias atras y sin endDate → EXPIRED",
  "RECURRING → nunca expira automaticamente (se gestiona manualmente)",
  "Actividades EXPIRED se muestran con badge de advertencia en la UI",
]) {
  children.push(bodyParagraph("- " + r));
}
children.push(labelValue("Cron automatico", "Vercel Cron — 5AM UTC (medianoche Colombia) — /api/admin/expire-activities"));
children.push(labelValue("Script manual", "npx tsx scripts/expire-activities.ts"));
children.push(spacer());

// ---- SECTION 10: FRONTEND — ESTADO ACTUAL ----
children.push(sectionHeading("10. FRONTEND — ESTADO ACTUAL (v0.5.0)"));
children.push(labelValue("Stack", "Next.js 15 App Router — Server Components + Client Components con Tailwind v4"));
children.push(spacer(0.5));
children.push(
  threeColTable(
    ["Pagina / Componente", "Tipo", "Estado"],
    [
      ["/ (Home page)", "Server Component", "Funcional"],
      ["/actividades (listado + filtros facetados)", "Server + Client", "Funcional"],
      ["/actividades/[id] (detalle + ShareButton)", "Server + Client", "Funcional"],
      ["/login", "Client Component", "Funcional"],
      ["/registro (con aceptacion de terminos)", "Client Component", "Funcional"],
      ["/perfil", "Server Component", "Funcional (requiere auth)"],
      ["/perfil/hijos", "Server Component", "Funcional"],
      ["/perfil/hijos/nuevo", "Client Component", "Funcional"],
      ["/admin", "Server Component", "Funcional (requiere rol ADMIN)"],
      ["/admin/scraping/sources", "Server Component", "Funcional"],
      ["/admin/scraping/logs", "Server Component", "Funcional"],
      ["/privacidad", "Server Component", "Funcional"],
      ["/tratamiento-datos", "Server Component", "Funcional"],
      ["/terminos", "Server Component", "Funcional"],
      ["/contacto (formulario con 6 motivos)", "Client Component", "Funcional"],
      ["Header global (auth-aware)", "Server + Client", "Funcional"],
      ["Footer global (3 columnas + legal)", "Server Component", "Funcional"],
      ["ShareButton (Web Share API + 9 plataformas)", "Client Component", "Funcional"],
    ],
    [45, 28, 27]
  )
);
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Filtros facetados — arquitectura:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const f of [
  "buildWhere(filters, exclude?) — genera clausula Prisma WHERE, excluye una dimension para calcular sus propios facets",
  "getFacets() — 5 queries paralelas (tipo, audiencia, ageRange, categoria, precio) cada una con su dimension excluida",
  "Cada opcion de filtro muestra el conteo real de actividades que la cumplen (no el total global)",
  "Filtros activos: busqueda full-text, edad (6 rangos), audiencia (KIDS/FAMILY/ADULTS/ALL), tipo, categoria",
  "Validacion de enums antes de Prisma: tipos invalidos devuelven 200 con filtro ignorado (no crash 500)",
  "NaN guard en parseInt: parseAge() con Number.isFinite() para evitar propagacion silenciosa a Prisma",
]) {
  children.push(bodyParagraph("- " + f));
}
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "ShareButton — funcionalidad:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const s of [
  "Mobile: Web Share API nativa del sistema operativo (navigator.share)",
  "Desktop: dropdown con 9 plataformas — WhatsApp, Facebook, X, Telegram, Email, LinkedIn, Instagram, TikTok, Copiar enlace",
  "Deteccion de soporte en useEffect (evita hidratacion incorrecta en SSR)",
  "Clipboard API para copiar: feedback visual 'Copiado!' durante 2 segundos",
  "Texto de compartir incluye nombre, descripcion y precio/edad de la actividad",
]) {
  children.push(bodyParagraph("- " + s));
}
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Politica de precios en la UI:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const p of [
  "precio null → badge 'No disponible' (gris) en tarjeta y pagina de detalle",
  "precio 0 o pricePeriod=FREE → badge 'Gratis' (verde emerald)",
  "precio > 0 → monto formateado con moneda y periodo (ej. $80.000/mes)",
  "Sin suposicion de pago cuando no hay precio — siempre 'No disponible'",
]) {
  children.push(bodyParagraph("- " + p));
}
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Tests — cobertura (v0.5.0):", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
children.push(spacer(0.5));
children.push(
  threeColTable(
    ["Modulo / Archivo", "Cobertura lineas", "Tests"],
    [
      ["category-utils.ts", "100%", "14"],
      ["api-response.ts", "100%", "9"],
      ["claude.analyzer.ts", "100%", "11"],
      ["gemini.analyzer.ts", "98.8%", "23"],
      ["pipeline.ts", "100%", "19 (web) + 6 (IG)"],
      ["cheerio.extractor.ts", "91.4%", "15"],
      ["playwright-extractor.test.ts", "100%", "8"],
      ["activities.schemas.ts", "100%", "24 (incl. audience, ageMax=120, ageMin=0)"],
      ["activities.service.ts", "100%", "22 (incl. filtro audience)"],
      ["children API (GET, POST, DELETE)", "—", "13"],
      ["Auth (login, registro, perfil, admin)", "—", "~50"],
      ["Resto modulos (middleware, utils, etc.)", "—", "~120"],
      ["TOTAL PROYECTO", "~95% / ~88% branch", "314"],
    ],
    [50, 25, 25]
  )
);
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Bugs corregidos en v0.5.0 (9 bugs):", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
children.push(spacer(0.5));
children.push(
  twoColTable(
    ["Bug", "Solucion"],
    [
      ["?type=INVALID_TYPE crashea con error 500", "Validar enum contra VALID_TYPES[] antes de pasar a Prisma"],
      ["audience ignorado en GET /api/activities", "Agregar ActivityAudience a listActivitiesSchema"],
      ["ShareButton: ageMin=0 muestra 'Hasta 100 años' (falsy)", "Cambiar && → != null en condicion de rango"],
      ["parseInt retorna NaN, Prisma falla silenciosamente", "parseAge() con Number.isFinite() guard"],
      ["Paginacion: Siguiente habilitado mas alla de totalPages", "page === totalPages → page >= totalPages"],
      ["ageMax max(18): API rechazaba actividades de 0-100 anos", "Cambiar max(18) → max(120) en schemas"],
      ["audience faltaba en createActivitySchema", "Agregar audience: ActivityAudience.default('ALL')"],
      ["Calculo de edad en hijos: ignora mes/dia del cumpleanos", "Comparar con new Date(year-18, month, day)"],
      ["parseInt sin radix en admin logs route", "Agregar radix 10 y fallback con || default"],
    ]
  )
);
children.push(spacer());

// ---- SECTION 11: CUMPLIMIENTO LEGAL Y PRIVACIDAD ----
children.push(sectionHeading("11. CUMPLIMIENTO LEGAL Y PRIVACIDAD"));
children.push(new Paragraph({ children: [new TextRun({ text: "Marco normativo aplicable:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const n of [
  "Ley 1581 de 2012 — Proteccion de datos personales (Colombia)",
  "Decreto 1377 de 2013 — Reglamentacion Ley 1581",
  "Ley 1098 de 2006 — Codigo de Infancia y Adolescencia (datos de menores)",
  "Ley 1273 de 2009 — Delitos informaticos",
]) {
  children.push(bodyParagraph("- " + n));
}
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Paginas legales implementadas:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
children.push(spacer(0.5));
children.push(
  twoColTable(
    ["Pagina", "Contenido"],
    [
      ["/privacidad", "Politica de privacidad — 10 secciones (responsable, datos, finalidades, derechos, seguridad, etc.)"],
      ["/tratamiento-datos", "Politica de tratamiento de datos — tabla de datos, plazos legales (10/15 dias), transferencias internacionales"],
      ["/terminos", "Terminos de uso — propiedad intelectual, mecanismo de takedown, disclaimers, jurisdiccion colombiana"],
      ["/contacto", "Formulario con 6 motivos — remocion de contenido, derechos ARCO, errores, sugerencias"],
    ]
  )
);
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Mecanismo de takedown:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const t of [
  "Formulario de contacto con motivo 'Solicitud de remocion de contenido'",
  "Campo URL requerido para identificar el contenido",
  "Compromiso de respuesta en 5 dias habiles (24h para casos urgentes)",
  "Remocion inmediata de contenido que viole derechos de PI o privacidad",
]) {
  children.push(bodyParagraph("- " + t));
}
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Registro SIC (RNBD):", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
children.push(bodyParagraph("Documento SIC_RNBD_Registro.md generado con toda la informacion necesaria para el registro ante la Superintendencia de Industria y Comercio. Pendiente de completar y presentar por el owner antes del lanzamiento."));
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Consentimiento parental (datos de menores):", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const c of [
  "Texto legal completo de consentimiento mostrado en pantalla antes de crear perfil de hijo",
  "Checkbox de confirmacion requerido (no puede omitirse)",
  "consentText guardado en DB al momento del consentimiento",
  "consentGivenAt, consentGivenBy (ID del padre) trazables en DB",
]) {
  children.push(bodyParagraph("- " + c));
}
children.push(spacer());

// ---- SECTION 12: PERFILES DE HIJOS ----
children.push(sectionHeading("12. PERFILES DE HIJOS — ESCENARIO A (MVP)"));
children.push(new Paragraph({ children: [new TextRun({ text: "Arquitectura de escenarios:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
children.push(spacer(0.5));
children.push(
  twoColTable(
    ["Escenario", "Descripcion"],
    [
      ["Escenario A (MVP — implementado)", "Padres crean perfiles de hijos. El menor no tiene cuenta propia. Toda la interaccion es del padre."],
      ["Escenario B (futuro — modelo listo)", "Menores con cuenta propia. Padres como tutores con consentimiento. Modelo de datos compatible sin migraciones destructivas."],
    ]
  )
);
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Flujo del Escenario A:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const step of [
  "Padre autenticado accede a /perfil/hijos",
  "Crea perfil: nombre, fecha de nacimiento (0-18 anos), genero (opcional)",
  "Acepta texto de consentimiento legal (checkbox obligatorio)",
  "Sistema guarda consentType='parental', consentGivenBy=userId del padre",
  "Padre puede eliminar perfiles (soft delete con confirm() en UI)",
]) {
  children.push(bodyParagraph("- " + step));
}
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Compatibilidad con Escenario B (sin cambios destructivos):", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const f of [
  "User.accountType: 'adult' | 'minor' (default 'adult')",
  "User.guardianId: FK a otro User (el padre/tutor del menor)",
  "Child.consentType: 'parental' | 'self' (cuando el menor consiente por si mismo en Escenario B)",
  "Escenario B = cambios aditivos, sin tocar modelo actual",
]) {
  children.push(bodyParagraph("- " + f));
}
children.push(spacer());

// ---- SECTION 13: ROADMAP ----
children.push(sectionHeading("13. ROADMAP"));
children.push(
  threeColTable(
    ["Fase", "Hito", "Estado"],
    [
      ["Fase 1 MVP", "Pipeline de scraping funcional", "Completado"],
      ["Fase 1 MVP", "200 actividades en Supabase (4 fuentes)", "Completado"],
      ["Fase 1 MVP", "IA con 97% de confianza", "Completado"],
      ["Fase 1 MVP", "Frontend /actividades (busqueda y filtros)", "Completado"],
      ["Fase 1 MVP", "Pagina de detalle /actividades/[id]", "Completado"],
      ["Fase 1 MVP", "Home page con categorias", "Completado"],
      ["Fase 1 MVP", "Scraping Instagram (Playwright)", "Completado"],
      ["Fase 1 MVP", "Auth completa (login, registro, perfil)", "Completado"],
      ["Fase 1 MVP", "Panel de administracion (/admin)", "Completado"],
      ["Fase 1 MVP", "SEO (metadata, OG, JSON-LD, sitemap, robots)", "Completado"],
      ["Fase 1 MVP", "Cumplimiento legal (privacidad, terminos, contacto)", "Completado"],
      ["Fase 1 MVP", "Perfiles de hijos (Escenario A)", "Completado"],
      ["Fase 1 MVP", "Logica de expiracion de actividades (cron + manual)", "Completado"],
      ["Fase 1 MVP", "Politica de precios ('No disponible' / 'Gratis' / monto)", "Completado"],
      ["Fase 1 MVP", "Enum audience (KIDS/FAMILY/ADULTS/ALL) + reclasificacion", "Completado"],
      ["Fase 1 MVP", "Filtros facetados con conteos reales por dimension", "Completado"],
      ["Fase 1 MVP", "ShareButton (Web Share API + 9 plataformas)", "Completado"],
      ["Fase 1 MVP", "314 tests (cobertura ~95% lineas / ~88% branch)", "Completado"],
      ["Fase 1 MVP", "Busqueda full-text (Meilisearch)", "Pendiente"],
      ["Fase 1 MVP", "Sistema de favoritos", "Pendiente"],
      ["Fase 1 MVP", "Notificaciones de nuevas actividades", "Pendiente"],
      ["Fase 1 MVP", "Panel de proveedor (reclamar ficha)", "Pendiente"],
      ["Fase 1 MVP", "Registro ante SIC (RNBD)", "Pendiente (owner)"],
      ["Fase 2", "Facebook Graph API + Telegram Bot API", "—"],
      ["Fase 2", "Sistema de ratings y resenas", "—"],
      ["Fase 2", "PWA + recomendaciones personalizadas", "—"],
      ["Fase 2", "Escenario B (cuentas de menores)", "—"],
      ["Fase 3", "Multi-vertical", "—"],
      ["Fase 3", "Pagos y monetizacion", "—"],
      ["Fase 3", "Expansion LATAM", "—"],
      ["Fase 4", "App nativa", "—"],
      ["Fase 4", "API publica", "—"],
      ["Fase 4", "Marketplace", "—"],
    ],
    [20, 55, 25]
  )
);
children.push(spacer());

// ---- SECTION 14: ESTRATEGIA DE FUENTES ----
children.push(sectionHeading("14. ESTRATEGIA DE FUENTES DE DATOS"));
children.push(new Paragraph({ children: [new TextRun({ text: "Principios:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const p of [
  "Ninguna fuente supera el 30% del total de actividades",
  "Trazabilidad legal de cada fuente (ScrapingSource + ScrapingLog)",
  "Monitoreo diario de disponibilidad",
  "Alertas automaticas ante anomalias de datos",
]) {
  children.push(bodyParagraph("- " + p));
}
children.push(spacer());
children.push(
  threeColTable(
    ["Fuente (Bogota MVP)", "Tipo", "Estado"],
    [
      ["BibloRed (biblored.gov.co)", "Web estatico", "167 actividades"],
      ["Bogota ciudad (bogota.gov.co)", "Web estatico / JSON-LD", "21 actividades"],
      ["FCE Colombia (@fcecolombia)", "Instagram (Playwright)", "10 actividades"],
      ["Que hay pa hacer (@quehaypahacerenbogota)", "Instagram (Playwright)", "2 actividades"],
      ["IDARTES", "Web estatico", "Pendiente"],
      ["Jardin Botanico", "Web estatico", "Pendiente"],
      ["Trazos (trazos.net)", "Web estatico", "Probado"],
      ["Academias privadas", "Web estatico / Instagram", "Pendiente"],
    ],
    [40, 30, 30]
  )
);
children.push(spacer());

// ---- SECTION 15: MONETIZACION ----
children.push(sectionHeading("15. MONETIZACION (PENDIENTE POST-MVP)"));
children.push(bodyParagraph("Decision estrategica: evaluar modelos con datos reales de uso del MVP antes de comprometerse."));
children.push(spacer(0.5));
children.push(
  twoColTable(
    ["Hipotesis", "Descripcion"],
    [
      ["Freemium proveedores", "Basico gratis, funcionalidades avanzadas de pago"],
      ["Comision por reserva", "% sobre transacciones procesadas en plataforma"],
      ["Publicidad contextual", "Avisos relevantes a familias con intencion de busqueda"],
      ["Suscripcion familias", "Plan premium con funcionalidades avanzadas"],
      ["B2B datos", "Venta de insights agregados a municipios e instituciones"],
    ]
  )
);
children.push(spacer());

// ---- SECTION 16: DECISIONES PENDIENTES ----
children.push(sectionHeading("16. DECISIONES TECNICAS PENDIENTES"));
children.push(spacer(0.5));
children.push(
  twoColTable(
    ["Decision", "Estado / Criterio"],
    [
      ["Modelo de monetizacion", "Pendiente — despues de MVP con datos reales de uso"],
      ["Estrategia legal scraping Instagram", "Pendiente — revisar antes de escalar (Fase 2: Facebook API)"],
      ["Proveedor de proxies", "Pendiente — necesario antes de scraping masivo de redes sociales"],
      ["Servicio de geocoding", "Pendiente — evaluar Google Maps API vs Nominatim vs Mapbox"],
      ["Branding multi-vertical", "Pendiente — definir identidad para nuevos verticales"],
      ["Escenario B (cuentas de menores)", "Pendiente — modelo listo, activar cuando haya demanda real"],
      ["Registro SIC (RNBD)", "Pendiente — owner debe completar SIC_RNBD_Registro.md y presentar ante sic.gov.co"],
    ]
  )
);
children.push(spacer());

// ---- SECTION 17: HERRAMIENTAS DE TRABAJO ----
children.push(sectionHeading("17. HERRAMIENTAS DE TRABAJO"));
children.push(spacer(0.5));
children.push(
  twoColTable(
    ["Herramienta", "Rol en el proyecto"],
    [
      ["Claude Code", "Todo codigo, arquitectura, decisiones tecnicas, generacion de documentos"],
      ["Gemini / Antigravity", "Resumenes de video, investigacion web, analisis competencia, segundas opiniones"],
      ["Supabase", "PostgreSQL en la nube (DB + Auth + Storage)"],
      ["GitHub", "Control de versiones (repo privado: Infantia Claude — andresreyesg-cyber)"],
      ["Vercel", "Hosting frontend Next.js + Cron jobs (planificado)"],
      ["Railway", "Workers de scraping en background (planificado)"],
    ]
  )
);
children.push(spacer());

// ---- SECTION 18: HISTORIAL DE VERSIONES ----
children.push(sectionHeading("18. HISTORIAL DE VERSIONES"));
children.push(spacer(0.5));
children.push(
  threeColTable(
    ["Version", "Fecha", "Herramienta / Descripcion"],
    [
      ["V01", "2026-03-15", "Claude web — Vision, problema, actores, modelo conceptual, roadmap inicial"],
      ["V02", "2026-03-15", "Claude Code — Stack tecnologico detallado, scraping deep dive, estrategia de evolucion"],
      ["V03", "2026-03-16", "Gemini/Antigravity — Adiciones de estado real del proyecto (gaps detectados)"],
      ["V04", "2026-03-16", "Claude Code — Profundidad V02 + adiciones de estado real V03"],
      ["V05", "2026-03-16", "Claude Code — Pipeline scraping funcional, 167 actividades en Supabase, fix chunking Gemini, verify-db"],
      ["V06", "2026-03-16", "Claude Code — UI completa (/actividades + detalle + home), bogota.gov.co (21 act.), 127 tests"],
      ["V07", "2026-03-16", "Claude Code — Cobertura de tests 32% -> 95.8% (193 tests), script check-sources.ts, version estable"],
      ["V08", "2026-03-16", "Claude Code — Instagram (Playwright + sesion), 200 actividades, 212 tests, prompt Gemini IG"],
      ["V09", "2026-03-17", "Claude Code — Auth completa, admin, SEO, cumplimiento legal (Ley 1581), perfiles hijos Esc.A, expiracion actividades (cron), politica precios, 307 tests"],
      ["V10", "2026-03-18", "Claude Code — Enum audience (KIDS/FAMILY/ADULTS/ALL), reclasificacion 200 actividades, filtros facetados con conteos reales, ShareButton (9 plataformas), 9 bugs corregidos, 314 tests"],
    ],
    [10, 18, 72]
  )
);
children.push(spacer(2));

// ---- FOOTER NOTE ----
children.push(
  new Paragraph({
    children: [
      new TextRun({
        text: "Documento generado automaticamente por Claude Code — Infantia v0.5.0 — 2026-03-18",
        size: 16,
        font: "Arial",
        color: "999999",
        italics: true,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 0 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 4, color: DARK_BLUE },
    },
  })
);

// ===================== BUILD DOCUMENT =====================

const doc = new Document({
  styles: {
    default: {
      document: {
        run: {
          font: "Arial",
          size: 20,
        },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1),
          },
        },
      },
      children,
    },
  ],
});

const outputPath = process.env.OUTPUT_PATH || String.raw`C:\Users\denys\OneDrive\Documents\DayJul\Denys\Infantia\Infantia_Claude\Infantia_Documento_Fundacional_V10.docx`;

const buffer = await Packer.toBuffer(doc);
writeFileSync(outputPath, buffer);
console.log("Document written to:", outputPath);
console.log("Size:", buffer.length, "bytes");
