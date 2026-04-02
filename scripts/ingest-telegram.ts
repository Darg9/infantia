// =============================================================================
// ingest-telegram.ts — Ingesta de canales de Telegram
//
// Lee mensajes de canales públicos colombianos, los analiza con Gemini
// y guarda las actividades encontradas en la BD.
//
// Uso:
//   npx tsx scripts/ingest-telegram.ts                  # todos los canales
//   npx tsx scripts/ingest-telegram.ts --dry-run        # sin guardar en BD
//   npx tsx scripts/ingest-telegram.ts --channel=bogotaenplanes
//   npx tsx scripts/ingest-telegram.ts --limit=100      # más mensajes por canal
// =============================================================================

import 'dotenv/config';
import { extractTelegramChannel, disconnectTelegram } from '../src/modules/scraping/extractors/telegram.extractor';
import { GeminiAnalyzer } from '../src/modules/scraping/nlp/gemini.analyzer';
import { ScrapingStorage } from '../src/modules/scraping/storage';
import { createLogger } from '../src/lib/logger';

const log = createLogger('ingest:telegram');

// ── Canales objetivo ──────────────────────────────────────────────────────────
// Agrega aquí los canales públicos colombianos relevantes.
// Formato: { username: 'nombre_sin_arroba', city: 'Ciudad', description: '...' }
const TELEGRAM_CHANNELS = [
  // Bogotá
  { username: 'bogotaenplanes',     city: 'Bogotá',   description: 'Planes y eventos en Bogotá' },
  { username: 'quehaypahacer',      city: 'Bogotá',   description: 'Actividades para familias Bogotá' },
  { username: 'agendabogota',       city: 'Bogotá',   description: 'Agenda cultural Bogotá' },
  // Medellín
  { username: 'medellínenplanes',   city: 'Medellín', description: 'Planes y eventos en Medellín' },
  // ── Agrega más canales aquí ──
];

// ── Analyzer y Storage ────────────────────────────────────────────────────────
const gemini  = new GeminiAnalyzer();
const storage = new ScrapingStorage();

// ── Prompt para Telegram ──────────────────────────────────────────────────────
// Adaptado para mensajes de texto sin estructura HTML
function buildPrompt(text: string, city: string): string {
  return `Analiza este mensaje de Telegram de un canal colombiano de eventos/planes y extrae la información de la actividad si la hay.

Ciudad de referencia: ${city}
Mensaje:
"""
${text}
"""

Responde SOLO con JSON válido siguiendo exactamente este esquema (null si no hay información):
{
  "title": "string (nombre de la actividad, obligatorio)",
  "description": "string",
  "categories": ["string"],
  "minAge": number|null,
  "maxAge": number|null,
  "price": number|null,
  "pricePeriod": "FREE"|"PER_SESSION"|"MONTHLY"|"TOTAL"|null,
  "currency": "COP",
  "audience": "KIDS"|"FAMILY"|"ADULTS"|"ALL",
  "location": { "address": "string|null", "city": "string|null" }|null,
  "schedules": [{ "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD|null", "notes": "string|null" }]|null,
  "confidenceScore": 0.0-1.0,
  "imageUrl": null
}

Si el mensaje NO es una actividad o evento (es publicidad genérica, noticias, memes, etc.), responde:
{ "confidenceScore": 0.0, "title": "", "categories": [], "description": "" }`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args    = process.argv.slice(2);
  const dryRun  = args.includes('--dry-run');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit   = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;
  const channelArg = args.find((a) => a.startsWith('--channel='))?.split('=')[1];

  const channels = channelArg
    ? TELEGRAM_CHANNELS.filter((c) => c.username.toLowerCase().includes(channelArg.toLowerCase()))
    : TELEGRAM_CHANNELS;

  if (channels.length === 0) {
    console.error(`❌ No se encontró canal con nombre "${channelArg}"`);
    process.exit(1);
  }

  console.log(`\n📨 INGESTA TELEGRAM — ${channels.length} canal(es)`);
  console.log(`   Modo: ${dryRun ? 'DRY RUN (sin guardar)' : 'GUARDAR EN BD'}`);
  console.log(`   Mensajes por canal: ${limit}\n`);

  let totalSaved = 0;
  let totalSkipped = 0;

  for (const ch of channels) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📡 @${ch.username} — ${ch.city}`);
    console.log('='.repeat(60));

    try {
      const data = await extractTelegramChannel(ch.username, limit);

      if (data.messagesExtracted === 0) {
        console.log('   ⚠️  Sin mensajes con contenido suficiente');
        continue;
      }

      console.log(`   📥 ${data.messagesExtracted} mensajes a analizar\n`);

      let saved = 0;
      let skipped = 0;

      for (const msg of data.messages) {
        try {
          const prompt = buildPrompt(msg.text, ch.city);
          // Usamos Gemini directamente para analizar el texto del mensaje
          const result = await (gemini as any).analyzeText(prompt);

          if (!result || result.confidenceScore < 0.6 || !result.title) {
            skipped++;
            continue;
          }

          console.log(`   ✅ [${result.confidenceScore.toFixed(2)}] ${result.title}`);

          if (!dryRun) {
            await storage.saveActivity(result, msg.url, 'kids');
          }
          saved++;
        } catch (err: any) {
          log.error('Error analizando mensaje', { error: err.message, url: msg.url });
          skipped++;
        }
      }

      console.log(`\n   📊 ${ch.username}: ${saved} guardadas, ${skipped} omitidas`);
      totalSaved   += saved;
      totalSkipped += skipped;

    } catch (err: any) {
      console.error(`\n   ❌ Error en @${ch.username}: ${err.message}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 RESUMEN: ${totalSaved} actividades guardadas, ${totalSkipped} omitidas`);
  console.log('='.repeat(60));

  await disconnectTelegram();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
