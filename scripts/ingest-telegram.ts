import { getErrorMessage } from '../src/lib/error';
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
  { username: 'quehaypahacer',      city: 'Bogotá',   description: 'Actividades para familias Bogotá' },
  // ── Agrega más canales aquí cuando encuentres sus usernames exactos ──
];

// ── Analyzer y Storage ────────────────────────────────────────────────────────
const gemini  = new GeminiAnalyzer();
const storage = new ScrapingStorage();


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
          const result = await gemini.analyze(msg.text, msg.url);

          if (!result || result.confidenceScore < 0.6 || !result.title) {
            skipped++;
            continue;
          }

          console.log(`   ✅ [${result.confidenceScore.toFixed(2)}] ${result.title}`);

          if (!dryRun) {
            await storage.saveActivity(result, msg.url, 'kids');
          }
          saved++;
        } catch (err: unknown) {
          log.error('Error analizando mensaje', { error: getErrorMessage(err), url: msg.url });
          skipped++;
        }
      }

      console.log(`\n   📊 ${ch.username}: ${saved} guardadas, ${skipped} omitidas`);
      totalSaved   += saved;
      totalSkipped += skipped;

    } catch (err: unknown) {
      console.error(`\n   ❌ Error en @${ch.username}: ${getErrorMessage(err)}`);
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
