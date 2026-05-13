// scripts/reclassify-categories.ts
// Consolida categorías a las 7 canónicas de HabitaPlan.
//
// Uso:
//   npx tsx scripts/reclassify-categories.ts          ← dry-run (solo muestra)
//   npx tsx scripts/reclassify-categories.ts --apply  ← aplica cambios en BD

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const APPLY = process.argv.includes('--apply');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter });

// ── Las 7 canónicas ───────────────────────────────────────────────────────────
const CANONICAL = [
  'Música',
  'Lectura',
  'Ciencia y tec.',
  'Naturaleza',
  'Deportes',
  'Teatro y danza',
  'Manualidades',
] as const;
type Canonical = typeof CANONICAL[number];

// ── Mapeo estructural: vieja categoría → canónica ────────────────────────────
const STRUCTURAL_MAP: Record<string, Canonical> = {
  // Música
  'Música': 'Música', 'Canto': 'Música', 'Piano': 'Música',
  'Guitarra': 'Música', 'Violín': 'Música', 'Batería': 'Música',

  // Lectura
  'Lectura': 'Lectura', 'Idiomas': 'Lectura', 'Inglés': 'Lectura',
  'Francés': 'Lectura', 'Mandarín': 'Lectura',
  'Apoyo Académico': 'Lectura', 'Tutorías': 'Lectura',
  'Desarrollo Personal': 'Lectura',

  // Ciencia y tec.
  'Ciencias': 'Ciencia y tec.', 'Tecnología': 'Ciencia y tec.',
  'Experimentos': 'Ciencia y tec.', 'Astronomía': 'Ciencia y tec.',
  'Robótica': 'Ciencia y tec.', 'Programación': 'Ciencia y tec.',
  'Diseño Digital': 'Ciencia y tec.', 'Matemáticas': 'Ciencia y tec.',
  'Ciencia y tec.': 'Ciencia y tec.',

  // Naturaleza
  'Naturaleza': 'Naturaleza', 'Campamentos': 'Naturaleza',
  'Campamentos de Día': 'Naturaleza', 'Campamentos Vacacionales': 'Naturaleza',

  // Deportes
  'Deportes': 'Deportes', 'Fútbol': 'Deportes', 'Baloncesto': 'Deportes',
  'Natación': 'Deportes', 'Tenis': 'Deportes', 'Gimnasia': 'Deportes',
  'Patinaje': 'Deportes', 'Artes Marciales': 'Deportes',
  'Mindfulness': 'Deportes', 'Yoga Infantil': 'Deportes',

  // Teatro y danza
  'Teatro': 'Teatro y danza', 'Danza': 'Teatro y danza',
  'Ballet': 'Teatro y danza', 'Danza Moderna': 'Teatro y danza',
  'Hip Hop': 'Teatro y danza', 'Danzas Folclóricas': 'Teatro y danza',
  'Teatro y danza': 'Teatro y danza',

  // Manualidades
  'Manualidades': 'Manualidades', 'Pintura y Dibujo': 'Manualidades',
  'Cerámica': 'Manualidades', 'Cocina': 'Manualidades',
};

// ── Basura scrapeada — se marca PAUSED, NO va a needs_review ─────────────────
// CAPTCHA, páginas de error, páginas institucionales, datos de prueba.
const JUNK_RE = /radware|bot manager|captcha|quiénes somos|subsidiarias|cómo publicar|términos y condiciones|tratamiento de datos|portafolio de servicios|librería (méxico|remedios|bosa|fernando|del paso)|pqrs\s*-\s*fce|tienda.?librer[ií]a|comprar libros|casa matriz|historia centro cultura|libros de ciencias|^español\s*-\s*fce|agenda infantil|agenda cultural de bogot|eventos en las bibliotecas|^evento \d+$|^25 cosas$|planes gratis de semana|programaci[oó]n familiar de biblo|actividades en san felipe/i;

// ── Reglas keyword — primera que matchea gana ─────────────────────────────────
// Solo se evalúan sobre el TÍTULO para evitar falsos positivos.
// El loop principal ya filtró junk antes de llamar a classifyByKeyword().
interface KwRule { target: Canonical; patterns: RegExp[] }
const KW_RULES: KwRule[] = [
  {
    target: 'Teatro y danza',
    patterns: [
      /^\[Obra/i,
      /^\[Presentaci[oó]n de Danza/i,
      /^\[Presentaci[oó]n de Ballet/i,
      // Palabras clave con límite de palabra inicial (leading \b del grupo)
      /\b(obra de teatro|obra teatral|bululú|bulubu|circo\b|circense\b|circus\b|impro\b|improvisaci[oó]n|danza\b|coreograf[ií]a|dramaturgia|escena\b|performance\b|teatro\b|obra\b|ballet\b|capoeira|salones? de baile|baile folcl[oó]rico|juegos? dramáticos?)\b/i,
      /t[ií]teres?/i,  // sin \b inicial — captura "Sabatíteres" y "títeres"
    ],
  },
  {
    target: 'Lectura',
    patterns: [
      /^\[Conversatorio/i,
      /^\[Libro al Viento/i,
      /^\[Presentaci[oó]n de libros/i,
      /^\[Encuentro\]/i,
      /^\[Taller\] (cuando|poesía|diarios|tres|bordando|lo que)/i,
      /^\[Proyecci[oó]n Cinematogr/i,
      /\b(conversatorio|literari[ao]s?|literatura|cuento|poes[ií]a|poema|escritor|escritura\b|libr[oa]\b|lectura\b|sala de lectura|club de lectura|narraci[oó]n|cineforo|cine foro|cine experiencia|lanzamiento|filbo|feria del libro|feria internacional|hora del cuento|leo con mi beb[eé]|leo con mi|lecturas? y texturas|palabras que|arrull[oa]s?\b|palabra\b|ficci[oó]n\b|ficciones\b|ficciona\w*|proyecci[oó]n cinematogr|pel[ií]culas\b)\b/i,
    ],
  },
  {
    target: 'Música',
    patterns: [
      /^\[Concierto/i,
      /\b(concierto|musical\b|coro\b|orquesta|banda\b|sonoro\b|jazz|vallenato|salsa\b|canta\b|canci[oó]n|guitarra|cuarteto\b|quinteto\b|trío\b|dj\b|disc.?jockey|m[uú]sica en vivo|en vivo\b|canta a todo pulm[oó]n|cumbiero|cumbia)\b/i,
      /sax\b/i,                    // captura "CaroSax", "saxophone" sin necesitar \b inicial
      /cantar a todo pulm[oó]n/i,  // "cantar" vs "canta" — mismo concepto
    ],
  },
  {
    target: 'Manualidades',
    patterns: [
      /\b(taller de (pintura|acuarela|dibujo|textil|grabado|arcilla|plastilina|bordado|tejido|cer[aá]mica|collage|m[aá]scaras|costuras|carpinteri|origami|repostería|fotografía))\b/i,
      /\b(pintura\b|acuarela\b|dibujo\b|grabado\b|arcilla\b|plastilina\b|bordado\b|tejido\b|craft\b|m[aá]scaras\b|collage\b|costuras?\b|costurero|carpinteri|origami\b|repostería|alfarería|cartapesta\b|ilustraci[oó]n\b|fotografía\b)\b/i,
    ],
  },
  {
    target: 'Ciencia y tec.',
    patterns: [
      // Solo keywords inequívocos — NO "laboratorio" solo ni "programación" sola
      /\b(planetario|domo\b|laboratorio de ciencias|laboratorio cient[ií]f|rob[oó]tica|programaci[oó]n (para|inform|comput|de niño)|coding\b|impres[ií][oó]n 3d|prototipado|maker\b|blender\b)\b/i,
      /astronom[ií]/i,        // prefijo: astronomía, astronómico — sin \b final
      /cient[ií]fic/i,        // prefijo: científico/a/os/as — sin \b final
      /\bestrelares?\b/i,     // cartografías estelares
      /\b(estrellas?\b|universo\b)\b/i,  // astronomía popular
    ],
  },
  {
    target: 'Naturaleza',
    patterns: [
      /\b(naturaleza|bio parque|ambiental|botánica|huerta|aves?|vegetales?|abejas?)\b/i,
      /ecológic|ecolog[ií]/i,  // prefijo — captura ecológico/a/as, ecología
      /[aá]rboles?\b/i,        // sin \b inicial — funciona con á (no-ASCII) como primer char
      /jard[ií]n\b/i,
    ],
  },
  {
    target: 'Deportes',
    patterns: [
      /\b(deporte|f[uú]tbol|kendo|patinaje|nataci[oó]n|gimnasia|yoga\b|karate|artes marciales|baloncesto|b[aá]squet|voleibol|atletismo|judo|badminton|tenis\b|tenis de mesa|ajedrez|capoeira\b|ciclismo|esgrima|boxeo|lucha|rugby)\b/i,
      /tu cuerpo en movimiento/i,   // clases de movimiento para bebés → Deportes
    ],
  },
];

// Señales de ambigüedad genuina — fuerzan needs_review aunque haya keyword
// (solo después de filtrar junk en el loop exterior)
const AMBIGUOUS_RE = /\b(exposici[oó]n\b|muestra\b|agenda\b|festival\b|experiencia art[ií]stica|ciclo\b)\b/i;

function classifyByKeyword(title: string): Canonical | null {
  if (AMBIGUOUS_RE.test(title)) return null;  // ambiguo → needs_review

  for (const rule of KW_RULES) {
    if (rule.patterns.some(p => p.test(title))) return rule.target;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Reclasificación de categorías — ${APPLY ? '✏️  APPLY' : '🔍 DRY-RUN'}`);
  console.log(`${'─'.repeat(60)}\n`);

  // 1. Estado actual de categorías en BD
  const allCats = await prisma.category.findMany({
    include: { _count: { select: { activities: true } } },
    orderBy: { name: 'asc' },
  });

  console.log(`📂 Categorías actuales en BD (${allCats.length}):\n`);
  for (const c of allCats) {
    const target = STRUCTURAL_MAP[c.name];
    const tag = CANONICAL.includes(c.name as Canonical)
      ? '✅ canónica'
      : target
        ? `→ ${target}`
        : c.name === 'Arte y Creatividad' || c.name === 'General'
          ? '⚠️  reclasificación keyword'
          : '❓ sin mapeo';
    console.log(`   ${c.name.padEnd(28)} (${String(c._count.activities).padStart(3)} acts)  ${tag}`);
  }

  // 2. Upsert de las 7 canónicas
  console.log(`\n📌 Paso 1 — Asegurar las 7 categorías canónicas en BD...`);
  const canonicalIds: Record<Canonical, string> = {} as Record<Canonical, string>;
  for (const name of CANONICAL) {
    let cat = await prisma.category.findFirst({ where: { name } });
    if (!cat && APPLY) {
      // verticalId = único vertical existente "Actividades Infantiles"
      cat = await prisma.category.create({
        data: {
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          verticalId: '7f8f366d-9877-494f-a192-d49097d321a0',
        },
      });
      console.log(`   ✨ Creada: ${name}`);
    } else if (!cat) {
      console.log(`   [dry] Crearía: ${name}`);
    }
    if (cat) canonicalIds[name] = cat.id;
  }

  // 3. Reasignación estructural
  console.log(`\n📌 Paso 2 — Reasignación estructural...`);
  let structuralMoves = 0;

  for (const cat of allCats) {
    const target = STRUCTURAL_MAP[cat.name];
    if (!target || cat.name === target) continue;
    if (cat._count.activities === 0) continue;

    const targetId = canonicalIds[target];
    if (!targetId && APPLY) { console.log(`   ⚠️  Sin ID para ${target}, saltando`); continue; }

    const acts = await prisma.activityCategory.findMany({
      where: { category: { name: cat.name } },
      select: { activityId: true },
    });

    for (const { activityId } of acts) {
      if (APPLY && targetId) {
        const alreadyHas = await prisma.activityCategory.findUnique({
          where: { activityId_categoryId: { activityId, categoryId: targetId } },
        });
        if (alreadyHas) {
          await prisma.activityCategory.delete({
            where: { activityId_categoryId: { activityId, categoryId: cat.id } },
          });
        } else {
          await prisma.activityCategory.update({
            where: { activityId_categoryId: { activityId, categoryId: cat.id } },
            data: { categoryId: targetId },
          });
        }
      }
      structuralMoves++;
    }
    console.log(`   ${APPLY ? '✅' : '[dry]'} ${cat.name.padEnd(25)} → ${target}  (${acts.length} acts)`);
  }
  console.log(`   Total movidas: ${structuralMoves}`);

  // 4. Keyword-first para Arte y Creatividad y General
  console.log(`\n📌 Paso 3 — Keyword-first para "Arte y Creatividad" y "General"...`);
  const ambiguousCats = allCats.filter(c => c.name === 'Arte y Creatividad' || c.name === 'General');
  const needsReview: Array<{ id: string; title: string }> = [];
  let kwMoves    = 0;
  let junkPaused = 0;

  for (const cat of ambiguousCats) {
    const activities = await prisma.activityCategory.findMany({
      where: { category: { name: cat.name } },
      include: { activity: { select: { id: true, title: true, description: true, status: true } } },
    });

    console.log(`\n   Categoría "${cat.name}" — ${activities.length} actividades:`);

    for (const { activity } of activities) {
      // ── Junk PRIMERO — marcar PAUSED, no llega a needs_review ──────────────
      if (JUNK_RE.test(activity.title)) {
        if (APPLY) {
          await prisma.activity.update({
            where: { id: activity.id },
            data: { status: 'PAUSED' },
          });
        }
        console.log(`   🗑  [JUNK→PAUSED]  ${activity.title.slice(0, 70)}`);
        junkPaused++;
        continue;
      }

      // ── Clasificación keyword ───────────────────────────────────────────────
      const target = classifyByKeyword(activity.title);

      if (!target) {
        needsReview.push({ id: activity.id, title: activity.title });
        console.log(`   ⏸  [needs_review]  ${activity.title.slice(0, 70)}`);
        continue;
      }

      const targetId = canonicalIds[target];
      if (APPLY && targetId) {
        const alreadyHas = await prisma.activityCategory.findUnique({
          where: { activityId_categoryId: { activityId: activity.id, categoryId: targetId } },
        });
        if (alreadyHas) {
          await prisma.activityCategory.delete({
            where: { activityId_categoryId: { activityId: activity.id, categoryId: cat.id } },
          });
        } else {
          await prisma.activityCategory.update({
            where: { activityId_categoryId: { activityId: activity.id, categoryId: cat.id } },
            data: { categoryId: targetId },
          });
        }
      }
      console.log(`   ${APPLY ? '✅' : '[dry]'} → ${target.padEnd(14)}  ${activity.title.slice(0, 60)}`);
      kwMoves++;
    }
  }

  // 5. Borrar categorías vacías no canónicas
  console.log(`\n📌 Paso 4 — Eliminar categorías vacías no canónicas...`);
  if (APPLY) {
    const catsNow = await prisma.category.findMany({
      include: { _count: { select: { activities: true } } },
    });
    for (const c of catsNow) {
      if (CANONICAL.includes(c.name as Canonical)) continue;
      if (c._count.activities === 0) {
        await prisma.category.delete({ where: { id: c.id } });
        console.log(`   🗑  Eliminada: ${c.name}`);
      }
    }
  } else {
    for (const c of allCats) {
      if (CANONICAL.includes(c.name as Canonical)) continue;
      if (STRUCTURAL_MAP[c.name] && c._count.activities > 0) continue;
      console.log(`   [dry] Borraría (si queda vacía): ${c.name}`);
    }
  }

  // 6. Resumen
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 RESUMEN:`);
  console.log(`   Movidas por mapa estructural : ${structuralMoves}`);
  console.log(`   Clasificadas por keyword     : ${kwMoves}`);
  console.log(`   Marcadas PAUSED (junk)       : ${junkPaused}`);
  console.log(`   Quedan en needs_review       : ${needsReview.length}`);

  if (needsReview.length > 0) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`⚠️  NEEDS REVIEW — ${needsReview.length} actividades sin clasificar automáticamente:`);
    console.log(`   (siguen en "Arte y Creatividad" hasta revisión manual)\n`);
    needsReview.forEach((a, i) => {
      console.log(`   ${String(i + 1).padStart(3)}. ${a.title}`);
      console.log(`        ID: ${a.id}`);
    });
  } else {
    console.log(`\n✅ Ninguna actividad quedó sin clasificar.`);
  }

  // 7. Estado final (solo en --apply)
  if (APPLY) {
    const finalCats = await prisma.category.findMany({
      include: { _count: { select: { activities: true } } },
      orderBy: { name: 'asc' },
    });
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📂 Categorías finales en BD:\n`);
    for (const c of finalCats) {
      console.log(`   ${c.name.padEnd(20)} ${c._count.activities} acts`);
    }
  } else {
    console.log(`\nℹ️  Para aplicar: npx tsx scripts/reclassify-categories.ts --apply`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
