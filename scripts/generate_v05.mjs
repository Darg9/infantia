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
        text: "DOCUMENTO FUNDACIONAL V13",
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
    children: [new TextRun({ text: "2026-03-16", size: 24, font: "Arial", color: "777777" })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 1600 },
  })
);
children.push(
  new Paragraph({
    children: [
      new TextRun({
        text: "Documento generado automáticamente por Claude Code — Infantia v0.7",
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

// ---- SECTION 1: VISIÓN Y PROBLEMA ----
children.push(sectionHeading("1. VISIÓN Y PROBLEMA"));
children.push(
  bodyParagraph(
    "Las familias con niños pasan horas buscando actividades en fuentes fragmentadas: sitios web institucionales, Instagram, grupos de WhatsApp, Facebook, Telegram. No existe un lugar centralizado que agregue, normalice y filtre esta información.",
    { bold: false }
  )
);
children.push(spacer());
children.push(labelValue("La Solución", "Infantia es un agregador multi-fuente con normalización inteligente que centraliza actividades y eventos para niños, jóvenes y familias en ciudades colombianas, con expansión a LATAM."));
children.push(labelValue("Nombre", "Infantia (raíz latina, decisión familiar)"));
children.push(labelValue("Owner", "Denys Reyes (padre de una hija de 10 años)"));
children.push(labelValue("Inicio del proyecto", "15 de marzo de 2026"));
children.push(spacer());

// ---- SECTION 2: PROPUESTA DE VALOR ----
children.push(sectionHeading("2. PROPUESTA DE VALOR"));
children.push(bodyParagraph("Para familias: Un solo lugar para descubrir todas las actividades disponibles para sus hijos, con filtros por edad, precio, ubicación y categoría."));
children.push(bodyParagraph("Para proveedores: Visibilidad gratuita y herramientas para gestionar su oferta de actividades."));
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Diferenciadores:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const d of [
  "Datos de múltiples fuentes (web + redes sociales)",
  "Normalización inteligente con IA (Gemini + Claude)",
  "Multi-vertical por configuración (no por código)",
  "Multi-país desde el día uno",
]) {
  children.push(bodyParagraph("• " + d));
}
children.push(spacer());

// ---- SECTION 3: ACTORES DEL SISTEMA ----
children.push(sectionHeading("3. ACTORES DEL SISTEMA"));
children.push(spacer(0.5));
children.push(
  twoColTable(
    ["Actor", "Descripción"],
    [
      ["Familia / Padre", "Usuario principal — busca y filtra actividades para sus hijos"],
      ["Niño / Joven", "Beneficiario final de las actividades"],
      ["Proveedor", "Academia, institución, club, biblioteca que ofrece actividades"],
      ["Administrador", "Gestiona la plataforma, modera contenido, configura verticales"],
      ["Scraper / Bot", "Componente automático que recolecta datos de fuentes externas"],
    ]
  )
);
children.push(spacer());

// ---- SECTION 4: STACK TECNOLÓGICO ----
children.push(sectionHeading("4. STACK TECNOLÓGICO"));
children.push(spacer(0.5));
children.push(
  threeColTable(
    ["Capa", "Tecnología", "Versión"],
    [
      ["Frontend + Backend", "Next.js + TypeScript", "15.x"],
      ["Base de Datos", "PostgreSQL via Supabase", "latest"],
      ["ORM", "Prisma", "7.5.0"],
      ["Búsqueda", "Meilisearch (MVP) → Elasticsearch (escala)", "—"],
      ["Cache / Queue", "Redis + BullMQ", "—"],
      ["Scraping estático", "Cheerio", "—"],
      ["Scraping dinámico", "Playwright", "—"],
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
children.push(sectionHeading("5. MODELO DE DATOS (11 entidades)"));
children.push(spacer(0.5));
children.push(
  twoColTable(
    ["Entidad", "Descripción"],
    [
      ["Activity", "Actividad o evento normalizado"],
      ["Provider", "Proveedor u organización que ofrece la actividad"],
      ["User", "Usuario registrado en la plataforma"],
      ["Child", "Perfil del niño o joven asociado a un usuario"],
      ["Location", "Lugar físico donde se realiza la actividad"],
      ["City", "Ciudad configurada en la plataforma"],
      ["Vertical", "Vertical temática (ej. kids, deportes, cultura)"],
      ["Category", "Categoría de actividad dentro de un vertical"],
      ["Favorite", "Actividad marcada como favorita por un usuario"],
      ["Rating", "Calificación de una actividad por un usuario"],
      ["ScrapingSource", "Fuente de datos configurada para scraping"],
      ["ScrapingLog", "Registro de ejecución de cada proceso de scraping"],
    ]
  )
);
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Campos clave de Activity:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 100, after: 60 } }));
for (const f of [
  "type: ONE_TIME | RECURRING | ONGOING",
  "status: DRAFT | ACTIVE | INACTIVE | EXPIRED",
  "ageMin, ageMax — rango de edad objetivo",
  "price, pricePeriod, priceCurrency",
  "sourceType, sourceUrl, sourceConfidence",
  "schedule (JSON para actividades recurrentes)",
]) {
  children.push(bodyParagraph("• " + f));
}
children.push(bodyParagraph("Decisión MVP: No se implementa ActivityOccurrence (sobre-ingeniería)", { bold: true }));
children.push(spacer());

// ---- SECTION 6: ARQUITECTURA DEL SISTEMA ----
children.push(sectionHeading("6. ARQUITECTURA DEL SISTEMA"));
children.push(new Paragraph({ children: [new TextRun({ text: "4 capas principales:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const layer of [
  "Presentación: Next.js (SSR + CSR)",
  "API: Next.js API Routes",
  "Ingesta: Pipeline de scraping (Cheerio + Playwright + Gemini)",
  "Datos: PostgreSQL (Supabase) + Redis (cache/queue)",
]) {
  children.push(bodyParagraph("• " + layer));
}
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Principios de arquitectura:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const p of [
  "API-first — todo a través de endpoints",
  "Multi-vertical por configuración (nuevos verticales = registros en DB, no código)",
  "Event-driven — comunicación interna por eventos",
  "Multi-país desde el día uno (sin hardcodear ciudades, países ni monedas)",
  "El dato es el activo, no el código",
  "Diversificar fuentes — ninguna fuente supera el 30% del total de datos",
  "Trazabilidad legal de todas las fuentes scrapeadas",
]) {
  children.push(bodyParagraph("• " + p));
}
children.push(spacer());

// ---- SECTION 7: PIPELINE DE SCRAPING ----
children.push(sectionHeading("7. PIPELINE DE SCRAPING (CONSTRUIDO Y FUNCIONAL)"));
children.push(labelValue("Estado", "Pipeline completamente funcional con datos reales en producción (2026-03-16)"));
children.push(spacer(0.5));
children.push(
  threeColTable(
    ["Paso", "Componente", "Descripción"],
    [
      ["1", "CheerioExtractor (discovery)", "Extrae URLs de actividades desde páginas listado con paginación automática"],
      ["2", "Paginación automática", "Detecta y recorre todas las páginas del sitio hasta agotar resultados"],
      ["3", "Gemini Filter (lotes de 50)", "Filtra URLs irrelevantes antes de scraping profundo — chunking optimizado"],
      ["4", "CheerioExtractor individual", "Extrae contenido HTML de cada actividad relevante"],
      ["5", "GeminiAnalyzer", "Normaliza con IA: extrae campos estructurados con confianza ≥ 0.9"],
      ["6", "ScrapingStorage", "Guarda en PostgreSQL vía Prisma con upsert por sourceUrl"],
      ["7", "Cache incremental", "Evita re-procesar URLs ya scrapeadas en sesiones anteriores"],
    ],
    [8, 30, 62]
  )
);
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Características técnicas:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const c of [
  "Concurrencia: 3 actividades paralelas",
  "Retry con backoff: 2s → 4s → 8s",
  "Chunking de lotes: 50 URLs por llamada a Gemini",
  "Upsert por sourceUrl (idempotente)",
]) {
  children.push(bodyParagraph("• " + c));
}
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Comandos:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
children.push(bodyParagraph("npx tsx scripts/test-scraper.ts --discover --save-db <URL>"));
children.push(bodyParagraph("npx tsx scripts/verify-db.ts"));
children.push(spacer());

// ---- SECTION 8: ESTRATEGIA DE SCRAPING ----
children.push(sectionHeading("8. ESTRATEGIA DE SCRAPING"));
children.push(new Paragraph({ children: [new TextRun({ text: "Fases de expansión de fuentes:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
children.push(bodyParagraph("• MVP: Web estático (Cheerio) + Instagram (Playwright)"));
children.push(bodyParagraph("• Fase 2: Facebook Graph API + Telegram Bot API"));
children.push(bodyParagraph("• Fase 3: TikTok, X (Twitter), WhatsApp Business"));
children.push(spacer());
for (const item of [
  ["Motor genérico", "Para todos los sitios. Extractor específico solo si >20% del contenido del sitio requiere tratamiento especial."],
  ["Precisión actual", "~97% de actividades con confianza alta (≥ 0.9 en campo sourceConfidence)"],
  ["NLP", "Gemini 2.5 Flash, temperatura 0.1 para máxima consistencia"],
  ["Anti-blocking", "Proxy rotation, user-agent rotation, rate limiting, respeto a robots.txt"],
]) {
  children.push(labelValue(item[0], item[1]));
}
children.push(spacer());

// ---- SECTION 9: BASE DE DATOS — ESTADO ACTUAL ----
children.push(sectionHeading("9. BASE DE DATOS — ESTADO ACTUAL"));
children.push(labelValue("Motor", "PostgreSQL en Supabase"));
children.push(labelValue("ORM", "Prisma 7.5.0"));
children.push(labelValue("Seed", "10 ciudades colombianas, 1 vertical kids, 47 categorías"));
children.push(spacer(0.5));
children.push(
  twoColTable(
    ["Métrica", "Valor"],
    [
      ["Actividades totales en Supabase", "167"],
      ["Proveedor principal", "biblored.gov.co"],
      ["Calidad alta (sourceConfidence ≥ 0.9)", "162 (97%)"],
      ["Con rango de edad definido", "142 (85%)"],
      ["Actividades gratuitas", "161"],
      ["Páginas scrapeadas", "19"],
      ["Tiempo total batch completo", "~12 minutos"],
    ]
  )
);
children.push(spacer());
children.push(new Paragraph({ children: [new TextRun({ text: "Tipos de actividades registradas:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
children.push(bodyParagraph("Arte, Cine, Ciencias, Escritura, Lectura, Lúdico, Música, Teatro, Literatura, Sensorial, Ajedrez"));
children.push(spacer());

// ---- SECTION 10: ROADMAP ----
children.push(sectionHeading("10. ROADMAP"));
children.push(
  threeColTable(
    ["Fase", "Hito", "Estado"],
    [
      ["Fase 1 MVP", "Pipeline de scraping funcional", "✅ Completado"],
      ["Fase 1 MVP", "167 actividades en Supabase", "✅ Completado"],
      ["Fase 1 MVP", "IA con 97% de confianza", "✅ Completado"],
      ["Fase 1 MVP", "Segunda fuente de datos", "⏳ Pendiente"],
      ["Fase 1 MVP", "Frontend (búsqueda y filtros)", "⏳ Pendiente"],
      ["Fase 1 MVP", "Panel de administración", "⏳ Pendiente"],
      ["Fase 1 MVP", "Scraping Instagram", "⏳ Pendiente"],
      ["Fase 2", "Panel de proveedores", "—"],
      ["Fase 2", "Facebook / Telegram scraping", "—"],
      ["Fase 2", "Sistema de ratings", "—"],
      ["Fase 2", "PWA + recomendaciones", "—"],
      ["Fase 3", "Multi-vertical", "—"],
      ["Fase 3", "Pagos y monetización", "—"],
      ["Fase 3", "TikTok / X / WhatsApp", "—"],
      ["Fase 3", "Expansión LATAM", "—"],
      ["Fase 4", "App nativa", "—"],
      ["Fase 4", "API pública", "—"],
      ["Fase 4", "Marketplace", "—"],
    ],
    [20, 55, 25]
  )
);
children.push(spacer());

// ---- SECTION 11: ESTRATEGIA DE FUENTES DE DATOS ----
children.push(sectionHeading("11. ESTRATEGIA DE FUENTES DE DATOS"));
children.push(new Paragraph({ children: [new TextRun({ text: "Principios:", bold: true, size: 20, font: "Arial", color: DARK_BLUE })], spacing: { before: 80, after: 60 } }));
for (const p of [
  "Ninguna fuente supera el 30% del total de actividades",
  "Trazabilidad legal de cada fuente (ScrapingSource + ScrapingLog)",
  "Monitoreo diario de disponibilidad",
  "Alertas automáticas ante anomalías de datos",
]) {
  children.push(bodyParagraph("• " + p));
}
children.push(spacer());
children.push(
  threeColTable(
    ["Fuente (Bogotá MVP)", "Tipo", "Estado"],
    [
      ["BibloRed (biblored.gov.co)", "Web estático", "✅ 167 actividades"],
      ["IDARTES", "Web estático", "⏳ Pendiente"],
      ["Jardín Botánico", "Web estático", "⏳ Pendiente"],
      ["Trazos (trazos.net)", "Web estático", "✅ Probado"],
      ["Academias privadas", "Web estático / Instagram", "⏳ Pendiente"],
    ],
    [40, 30, 30]
  )
);
children.push(spacer());

// ---- SECTION 12: MONETIZACIÓN ----
children.push(sectionHeading("12. MONETIZACIÓN (PENDIENTE POST-MVP)"));
children.push(bodyParagraph("Decisión estratégica: evaluar modelos con datos reales de uso del MVP antes de comprometerse."));
children.push(spacer(0.5));
children.push(
  twoColTable(
    ["Hipótesis", "Descripción"],
    [
      ["Freemium proveedores", "Básico gratis, funcionalidades avanzadas de pago"],
      ["Comisión por reserva", "% sobre transacciones procesadas en plataforma"],
      ["Publicidad contextual", "Avisos relevantes a familias con intención de búsqueda"],
      ["Suscripción familias", "Plan premium con funcionalidades avanzadas"],
      ["B2B datos", "Venta de insights agregados a municipios e instituciones"],
    ]
  )
);
children.push(spacer());

// ---- SECTION 13: DECISIONES TÉCNICAS PENDIENTES ----
children.push(sectionHeading("13. DECISIONES TÉCNICAS PENDIENTES"));
children.push(spacer(0.5));
children.push(
  twoColTable(
    ["Decisión", "Estado / Criterio"],
    [
      ["Modelo de monetización", "Pendiente — después de MVP con datos reales de uso"],
      ["Estrategia legal scraping", "Pendiente — debe resolverse antes del lanzamiento"],
      ["Proveedor de proxies", "Pendiente — necesario antes de scraping de redes sociales"],
      ["Servicio de geocoding", "Pendiente — evaluar Google Maps API vs Nominatim vs Mapbox"],
      ["Branding multi-vertical", "Pendiente — definir identidad para nuevos verticales"],
    ]
  )
);
children.push(spacer());

// ---- SECTION 14: HERRAMIENTAS DE TRABAJO ----
children.push(sectionHeading("14. HERRAMIENTAS DE TRABAJO"));
children.push(spacer(0.5));
children.push(
  twoColTable(
    ["Herramienta", "Rol en el proyecto"],
    [
      ["Claude Code", "Todo código, arquitectura, decisiones técnicas, generación de documentos"],
      ["Gemini / Antigravity", "Resúmenes de video, investigación web, análisis competencia, segundas opiniones"],
      ["Supabase", "PostgreSQL en la nube (DB + Auth + Storage)"],
      ["GitHub", "Control de versiones (repo privado: Infantia Claude — andresreyesg-cyber)"],
      ["Vercel", "Hosting frontend Next.js (planificado)"],
      ["Railway", "Workers de scraping en background (planificado)"],
    ]
  )
);
children.push(spacer());

// ---- SECTION 15: HISTORIAL DE VERSIONES ----
children.push(sectionHeading("15. HISTORIAL DE VERSIONES"));
children.push(spacer(0.5));
children.push(
  threeColTable(
    ["Versión", "Fecha", "Herramienta / Descripción"],
    [
      ["V01", "2026-03-15", "Claude web — Visión, problema, actores, modelo conceptual, roadmap inicial"],
      ["V02", "2026-03-15", "Claude Code — Stack tecnológico detallado, scraping deep dive, estrategia de evolución"],
      ["V03", "2026-03-16", "Gemini/Antigravity — Adiciones de estado real del proyecto (gaps detectados)"],
      ["V04", "2026-03-16", "Claude Code — Profundidad V02 + adiciones de estado real V03"],
      ["V05", "2026-03-16", "Claude Code — Pipeline scraping funcional, 167 actividades en Supabase, fix chunking Gemini, verify-db"],
      ["V06-V12", "2026-03-16 a 2026-03-24", "Claude Code — UI, Instagram, Auth, Deduplicación, CI/CD, Certificación v0.6.1"],
      ["V13", "2026-03-24", "Claude Code — Tests mejorados: 531 tests, 90.53% coverage, deduplication.ts + send-notifications"],
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
        text: "Documento generado automáticamente por Claude Code — Infantia v0.7 — 2026-03-24",
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

const outputPath = process.env.OUTPUT_PATH || String.raw`C:\Users\denys\OneDrive\Documents\DayJul\Denys\Infantia\Infantia_Claude\Infantia_Documento_Fundacional_V13.docx`;

const buffer = await Packer.toBuffer(doc);
writeFileSync(outputPath, buffer);
console.log("Document written to:", outputPath);
console.log("Size:", buffer.length, "bytes");
