// =============================================================================
// reclassify-audience.ts
// Clasifica la audiencia (KIDS / FAMILY / ADULTS / ALL) de todas las
// actividades existentes usando Gemini 2.5 Flash en lotes de 20.
//
// Uso: npx tsx scripts/reclassify-audience.ts
//      npx tsx scripts/reclassify-audience.ts --dry-run   (solo muestra, no guarda)
// =============================================================================

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const isDryRun = process.argv.includes('--dry-run');
const BATCH_SIZE = 10;
const VALID_AUDIENCES = ['KIDS', 'FAMILY', 'ADULTS', 'ALL'] as const;
type Audience = typeof VALID_AUDIENCES[number];

// =============================================================================
// Llama a Gemini con un lote de actividades y devuelve clasificaciones
// =============================================================================
async function classifyBatch(
  genAI: GoogleGenerativeAI,
  activities: { id: string; title: string; description: string }[],
): Promise<Array<{ index: number; audience: Audience }>> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  });

  const activitiesText = activities
    .map((a, i) =>
      `${i + 1}. Título: "${a.title}"\n   Descripción: "${(a.description ?? '').substring(0, 200)}"`,
    )
    .join('\n\n');

  const prompt = `Clasifica la audiencia de cada actividad usando exactamente uno de estos valores:

- "KIDS": exclusivamente para niños como participantes (ej: taller de robótica para niños, club de lectura infantil, clases de danza para menores).
- "FAMILY": para familias completas o padres/adultos acompañando a sus hijos (ej: obra de teatro familiar, paseo ecológico en familia, taller para padres e hijos).
- "ADULTS": exclusivamente para adultos como participantes (ej: yoga para mamás, finanzas personales, taller de escritura para adultos).
- "ALL": aplica a múltiples audiencias mezcladas, o no hay información suficiente para clasificar con certeza.

ACTIVIDADES A CLASIFICAR:
${activitiesText}

Responde ÚNICAMENTE con este JSON (sin texto adicional):
{ "classifications": [{"index": 1, "audience": "KIDS"}, {"index": 2, "audience": "FAMILY"}, ...] }`;

  const result = await model.generateContent(prompt);
  const rawText = result.response.text();
  const jsonStr = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  const parsed = JSON.parse(jsonStr) as {
    classifications: Array<{ index: number; audience: string }>;
  };

  return parsed.classifications
    .filter((c) => c.index >= 1 && c.index <= activities.length)
    .map((c) => ({
      index: c.index,
      audience: VALID_AUDIENCES.includes(c.audience as Audience)
        ? (c.audience as Audience)
        : 'ALL',
    }));
}

// =============================================================================
// Main
// =============================================================================
async function main() {
  console.log(`\n🎯 Reclasificador de audiencia HabitaPlan`);
  if (isDryRun) console.log('⚠️  DRY RUN — no se guardarán cambios\n');

  const apiKey = process.env.GOOGLE_AI_STUDIO_KEY;
  if (!apiKey) {
    console.error('❌ GOOGLE_AI_STUDIO_KEY no encontrada en .env');
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Cargar todas las actividades
  const activities = await prisma.activity.findMany({
    select: { id: true, title: true, description: true, audience: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`📊 ${activities.length} actividades encontradas`);
  const totalBatches = Math.ceil(activities.length / BATCH_SIZE);

  // Contadores
  const counts: Record<Audience, number> = { KIDS: 0, FAMILY: 0, ADULTS: 0, ALL: 0 };
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < activities.length; i += BATCH_SIZE) {
    const batch = activities.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    process.stdout.write(
      `\n[Lote ${batchNum}/${totalBatches}] Clasificando ${batch.length} actividades... `,
    );

    try {
      const classifications = await classifyBatch(genAI, batch);

      for (const { index, audience } of classifications) {
        const activity = batch[index - 1];
        if (!activity) continue;

        counts[audience]++;

        if (!isDryRun) {
          await prisma.activity.update({
            where: { id: activity.id },
            data: { audience },
          });
        }

        updated++;
      }

      console.log(`✅ ${classifications.length} clasificadas`);

      // Pequeña pausa entre lotes para no saturar la API
      if (i + BATCH_SIZE < activities.length) {
        await new Promise((r) => setTimeout(r, 800));
      }
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      errors++;
    }
  }

  // Resumen
  console.log('\n' + '─'.repeat(50));
  console.log(`✅ ${updated} actividades clasificadas`);
  if (errors > 0) console.log(`❌ ${errors} lotes con error`);
  console.log('\nDistribución de audiencias:');
  for (const [audience, count] of Object.entries(counts)) {
    const pct = ((count / updated) * 100).toFixed(1);
    console.log(`  ${audience.padEnd(7)} → ${count} (${pct}%)`);
  }

  if (isDryRun) {
    console.log('\n⚠️  DRY RUN completado — ejecuta sin --dry-run para guardar');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
