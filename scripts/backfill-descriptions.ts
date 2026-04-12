/**
 * backfill-descriptions.ts
 *
 * Pipeline de reescritura segura de descripciones legacy.
 * Principio rector: si el contenido puede estructurarse → NO usar IA.
 *
 * Etapas:
 *   1. Normalización (limpieza de texto)
 *   2. Detección de estructura (regex, sin IA)
 *   3. Generación estructurada (sin IA)
 *   4. Fallback rule-based (primera frase limpia, sin IA)
 *   5. IA solo en edge cases (texto largo + ambiguo)
 *
 * Uso:
 *   npx tsx scripts/backfill-descriptions.ts [--dry-run] [--limit=N] [--ai-enabled]
 *
 * Flags:
 *   --dry-run      Muestra qué haría sin guardar en BD
 *   --limit=N      Procesar solo N actividades (útil para pruebas)
 *   --ai-enabled   Habilita la etapa de IA (por defecto desactivada para conservar cuota)
 */

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { GoogleGenerativeAI } from '@google/generative-ai';

// =============================================================================
// Setup
// =============================================================================

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const dryRun = process.argv.includes('--dry-run');
const aiEnabled = process.argv.includes('--ai-enabled');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

type Method = 'structured' | 'rule-based' | 'ai' | 'skipped';

interface Result {
  id: string;
  title: string;
  originalDescription: string;
  newDescription: string;
  method: Method;
  charsBefore: number;
  charsAfter: number;
}

// =============================================================================
// ETAPA 1 — Normalización
// =============================================================================

const PROMOTIONAL_PHRASES = [
  /te invitamos a/gi,
  /no te pierdas/gi,
  /ven a disfrutar/gi,
  /no te lo pierdas/gi,
  /anímate a/gi,
  /no faltes/gi,
  /inscríbete ya/gi,
  /cupos limitados/gi,
  /¡inscríbete!/gi,
  /¡no te lo pierdas!/gi,
];

function normalize(text: string): string {
  let t = text.replace(/[\r\n\t]+/g, ' ');
  for (const phrase of PROMOTIONAL_PHRASES) {
    t = t.replace(phrase, '');
  }
  return t.replace(/\s+/g, ' ').trim();
}

// =============================================================================
// ETAPA 2 — Detección de estructura
// =============================================================================

const TIPO_KEYWORDS = /\b(taller|curso|clase|evento|club|campamento|festival|ciclo|conferencia|obra|exposición|exposicion|concierto|recital|feria|muestra|seminario|diplomado|programa|actividad)\b/i;
const TEMA_KEYWORDS = /\b(arte|música|musica|danza|teatro|robótica|robotica|ciencia|lectura|escritura|cine|cocina|inglés|ingles|ajedrez|yoga|fotografía|fotografia|manualidades|pintura|dibujo|escultura|títeres|titeres|circo|acrobacia|natación|natacion|fútbol|futbol|baloncesto|atletismo|ecosistema|naturaleza|jardín|jardin|programación|programacion|animación|animacion)\b/i;
const PUBLICO_KEYWORDS = /\b(niños|niñas|niños y niñas|ninos|adolescentes|jóvenes|jovenes|familias|adultos|bebés|bebes|primera infancia|infantes|infantil|infantiles|toda la familia|público general)\b/i;

interface Parsed {
  tipo: string;
  tema: string;
  publico?: string;
}

function canParseStructured(text: string): boolean {
  return TIPO_KEYWORDS.test(text) && TEMA_KEYWORDS.test(text);
}

function parseStructured(text: string): Parsed | null {
  const tipoMatch = text.match(TIPO_KEYWORDS);
  const temaMatch = text.match(TEMA_KEYWORDS);
  if (!tipoMatch || !temaMatch) return null;

  const publicoMatch = text.match(PUBLICO_KEYWORDS);

  return {
    tipo: normalize(tipoMatch[0]).toLowerCase(),
    tema: normalize(temaMatch[0]).toLowerCase(),
    publico: publicoMatch ? normalize(publicoMatch[0]).toLowerCase() : undefined,
  };
}

// =============================================================================
// ETAPA 3+4 — Generación sin IA
// =============================================================================

function buildDescription(p: Parsed): string {
  const base = `${capitalize(p.tipo)} de ${p.tema}`;
  return p.publico ? `${base} dirigido a ${p.publico}.` : `${base}.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// =============================================================================
// ETAPA 5 — Rule-based fallback
// =============================================================================

function safeRewrite(text: string): string {
  // Toma la primera oración completa y la limpia
  const firstSentence = text.split(/[.!?]/)[0] ?? text;
  let clean = firstSentence;
  for (const phrase of PROMOTIONAL_PHRASES) {
    clean = clean.replace(phrase, '');
  }
  return clean.replace(/\s+/g, ' ').trim();
}

function isGoodEnough(text: string): boolean {
  return text.length >= 40 && text.length <= 200;
}

// =============================================================================
// ETAPA 6 — IA como último recurso
// =============================================================================

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;
let lastGeminiCall = 0;
const MIN_INTERVAL_MS = 12000; // 5 RPM

async function aiRewrite(text: string, genAI: GoogleGenerativeAI): Promise<string> {
  // Rate limit
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastGeminiCall);
  if (wait > 0) {
    console.log(`   ⏳ Rate limit: esperando ${(wait / 1000).toFixed(1)}s...`);
    await new Promise((r) => setTimeout(r, wait));
  }
  lastGeminiCall = Date.now();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
  });

  const prompt = `Reescribe el siguiente texto en UNA SOLA frase clara, informativa y sin tono promocional.
No agregues información que no esté en el texto. Sin adjetivos exagerados. Máximo 160 caracteres.

TEXTO: ${text.substring(0, 500)}

Responde SOLO con la frase reescrita, sin comillas ni explicaciones.`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim().replace(/^["']|["']$/g, '');
      return raw.substring(0, 160);
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      const status = error?.status ?? 0;
      if ((status === 429 || status === 503) && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        console.log(`   ⚠️  Gemini ${status} (intento ${attempt}/${MAX_RETRIES}). Reintentando en ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Agotados reintentos Gemini');
}

// =============================================================================
// PIPELINE PRINCIPAL
// =============================================================================

async function processActivity(
  activity: { id: string; title: string; description: string },
  genAI: GoogleGenerativeAI | null,
): Promise<Result> {
  const original = activity.description ?? '';
  const charsBefore = original.length;

  // Skip si la descripción ya es corta y limpia (≤ 160 chars sin frases promocionales)
  const normalized = normalize(original);
  if (normalized.length <= 160 && !PROMOTIONAL_PHRASES.some((p) => p.test(original))) {
    return {
      id: activity.id, title: activity.title,
      originalDescription: original, newDescription: original,
      method: 'skipped', charsBefore, charsAfter: original.length,
    };
  }

  // Etapa 2+3+4: Detección y generación estructurada
  // Solo si el resultado estructurado es mejor que el rule-based (más informativo)
  if (canParseStructured(normalized)) {
    const parsed = parseStructured(normalized);
    if (parsed) {
      const structuredDesc = buildDescription(parsed);
      const fallbackForComparison = safeRewrite(normalized);
      // Usar structured solo si el fallback rule-based no es suficientemente bueno
      // O si la descripción estructurada es comparable en longitud (evita "Concierto de teatro.")
      if (!isGoodEnough(fallbackForComparison) && structuredDesc.length > 20) {
        return {
          id: activity.id, title: activity.title,
          originalDescription: original, newDescription: structuredDesc,
          method: 'structured', charsBefore, charsAfter: structuredDesc.length,
        };
      }
    }
  }

  // Etapa 5: Rule-based fallback
  const fallback = safeRewrite(normalized);
  if (isGoodEnough(fallback)) {
    return {
      id: activity.id, title: activity.title,
      originalDescription: original, newDescription: fallback,
      method: 'rule-based', charsBefore, charsAfter: fallback.length,
    };
  }

  // Etapa 6: IA solo si está habilitada y el fallback fue insuficiente
  if (aiEnabled && genAI && normalized.length > 300) {
    try {
      const aiDesc = await aiRewrite(normalized, genAI);
      return {
        id: activity.id, title: activity.title,
        originalDescription: original, newDescription: aiDesc,
        method: 'ai', charsBefore, charsAfter: aiDesc.length,
      };
    } catch {
      console.log(`   ❌ AI falló para activity ${activity.id} — usando fallback rule-based`);
    }
  }

  // Si el fallback es demasiado corto pero es lo mejor que tenemos → rule-based igual
  const safeFallback = fallback.length >= 10 ? fallback : normalized.substring(0, 160).trim();
  return {
    id: activity.id, title: activity.title,
    originalDescription: original, newDescription: safeFallback,
    method: 'rule-based', charsBefore, charsAfter: safeFallback.length,
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('\n✍️  Backfill de Descripciones — HabitaPlan');
  console.log(`Modo:        ${dryRun ? '🔍 DRY RUN (sin guardar)' : '💾 GUARDAR EN BD'}`);
  console.log(`IA habilitada: ${aiEnabled ? '✅ Sí (conserva cuota)' : '❌ No (--ai-enabled para activar)'}`);
  console.log(`Límite:      ${limit ?? 'todas las actividades'}\n`);

  // Agrega columna description_method si no existe (idempotente)
  if (!dryRun) {
    try {
      await prisma.$executeRaw`
        ALTER TABLE activities
        ADD COLUMN IF NOT EXISTS description_method TEXT DEFAULT NULL
      `;
      console.log('✅ Columna description_method verificada/creada\n');
    } catch (err) {
      console.log('ℹ️  Columna description_method ya existe\n');
    }
  }

  // Cargar actividades ACTIVE + PAUSED (las que se muestran al usuario)
  const activities = await prisma.activity.findMany({
    where: { status: { in: ['ACTIVE', 'PAUSED'] } },
    select: { id: true, title: true, description: true },
    orderBy: { createdAt: 'asc' },
    ...(limit ? { take: limit } : {}),
  });

  console.log(`📦 Actividades a procesar: ${activities.length}\n`);

  // Inicializar Gemini (opcional)
  const apiKey = process.env.GOOGLE_AI_STUDIO_KEY ?? '';
  const genAI = apiKey && aiEnabled ? new GoogleGenerativeAI(apiKey) : null;

  const results: Result[] = [];
  const stats: Record<Method, number> = { structured: 0, 'rule-based': 0, ai: 0, skipped: 0 };

  for (const activity of activities) {
    process.stdout.write(`⟳ [${results.length + 1}/${activities.length}] ${activity.title.substring(0, 60)}... `);

    const result = await processActivity(activity, genAI);
    results.push(result);
    stats[result.method]++;

    const methodEmoji: Record<Method, string> = {
      structured: '🏗️ structured',
      'rule-based': '📏 rule-based',
      ai: '🤖 ai',
      skipped: '⏭️ skipped',
    };
    console.log(methodEmoji[result.method]);

    if (result.method !== 'skipped') {
      console.log(`   Antes (${result.charsBefore}): ${result.originalDescription.substring(0, 80)}...`);
      console.log(`   Después (${result.charsAfter}): ${result.newDescription}`);
    }

    // Guardar en BD si no es dry-run
    if (!dryRun && result.method !== 'skipped') {
      // Usamos $executeRaw solo para el campo description_method (no en schema Prisma)
      // Para description usamos el ORM para respetar updatedAt automático
      await prisma.activity.update({
        where: { id: result.id },
        data: { description: result.newDescription },
      });
      // Actualizar description_method via raw (campo fuera del schema)
      await prisma.$executeRaw`
        UPDATE activities
        SET description_method = ${result.method}
        WHERE id = ${result.id}
      `;
    }
  }

  // =============================================================================
  // RESUMEN FINAL
  // =============================================================================
  const processed = activities.length - stats.skipped;
  const pct = (n: number) => processed > 0 ? `${((n / processed) * 100).toFixed(1)}%` : '0%';
  const withoutAI = stats.structured + stats['rule-based'];

  console.log('\n════════════════════════════════════════');
  console.log('📊 RESUMEN FINAL');
  console.log('════════════════════════════════════════');
  console.log(`Total actividades:   ${activities.length}`);
  console.log(`Procesadas:          ${processed}`);
  console.log(`Omitidas (ya ok):    ${stats.skipped}`);
  console.log('');
  console.log(`🏗️  Structured:      ${stats.structured} (${pct(stats.structured)} de procesadas)`);
  console.log(`📏 Rule-based:       ${stats['rule-based']} (${pct(stats['rule-based'])} de procesadas)`);
  console.log(`🤖 AI:               ${stats.ai} (${pct(stats.ai)} de procesadas)`);
  console.log('');
  console.log(`✅ Sin IA:           ${withoutAI} (${pct(withoutAI)}) — objetivo ≥ 80%`);
  console.log(`${parseFloat(pct(withoutAI)) >= 80 ? '🎯 OBJETIVO CUMPLIDO' : '⚠️  Por debajo del objetivo (80%)'}`);


  if (dryRun) {
    console.log('\n⚠️  Modo DRY RUN — ningún cambio fue guardado en BD');
    console.log('   Ejecuta sin --dry-run para aplicar los cambios\n');
  } else {
    console.log(`\n✨ ${processed} actividades actualizadas en BD\n`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('\n❌ Error fatal:', err);
  process.exit(1);
});
