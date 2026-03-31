// Migra console.* a logger.* en los módulos de scraping y components
import { readFileSync, writeFileSync } from 'fs';

/**
 * Transforma un archivo: agrega el import del logger y reemplaza console.*
 */
function migrate(file, loggerCtx, importPath) {
  let src = readFileSync(file, 'utf8');

  // 1. Agregar import si no existe
  if (!src.includes('createLogger')) {
    const lines = src.split('\n');
    let lastImport = 0;
    lines.forEach((l, i) => { if (l.startsWith('import ')) lastImport = i; });
    lines.splice(lastImport + 1, 0,
      `import { createLogger } from '${importPath}';`,
      ``,
      `const log = createLogger('${loggerCtx}');`,
    );
    src = lines.join('\n');
  }

  // 2. console.log(...) → log.info(...)
  src = src.replace(/\bconsole\.log\(/g, 'log.info(');

  // 3. console.warn(...) → log.warn(...)
  src = src.replace(/\bconsole\.warn\(/g, 'log.warn(');

  // 4. console.error(...) → log.error(...)
  src = src.replace(/\bconsole\.error\(/g, 'log.error(');

  // 5. Limpiar el prefijo [CTX] de los mensajes de log
  //    Ej: log.info(`[BATCH] Texto`) → log.info(`Texto`)
  src = src.replace(/log\.(info|warn|error)\(`\[[A-Z][A-Z\-_:]+\] /g, 'log.$1(`');
  src = src.replace(/log\.(info|warn|error)\('\[[A-Z][A-Z\-_:]+\] /g, "log.$1('");
  // Con emojos: ⚠️ ✅ ⏭️ ❌
  src = src.replace(/log\.(info|warn|error)\(`\[[A-Z][A-Z\-_:]+\] (⚠️|✅|⏭️|❌) /g, 'log.$1(`$2 ');

  writeFileSync(file, src);
  console.log(`✅ ${file} (${loggerCtx})`);
}

// ── Módulos de scraping ───────────────────────────────────────────────────────

migrate('src/modules/scraping/pipeline.ts',
  'scraping:pipeline', '../../lib/logger');

migrate('src/modules/scraping/storage.ts',
  'scraping:storage', '../../lib/logger');

migrate('src/modules/scraping/deduplication.ts',
  'scraping:dedup', '../../lib/logger');

migrate('src/modules/scraping/extractors/cheerio.extractor.ts',
  'scraping:cheerio', '../../../lib/logger');

migrate('src/modules/scraping/extractors/playwright.extractor.ts',
  'scraping:playwright', '../../../lib/logger');

migrate('src/modules/scraping/nlp/gemini.analyzer.ts',
  'scraping:gemini', '../../../lib/logger');

migrate('src/modules/scraping/nlp/claude.analyzer.ts',
  'scraping:claude', '../../../lib/logger');

migrate('src/modules/scraping/queue/producer.ts',
  'scraping:producer', '../../../lib/logger');

migrate('src/modules/scraping/queue/scraping.worker.ts',
  'scraping:worker', '../../../lib/logger');

// ── Componentes React (client-side) ──────────────────────────────────────────
// En client components solo podemos usar console.* — no server logger
// Pero sí queremos que log.error capture a Sentry
// Nota: PushButton y ShareButton son 'use client', importaremos desde lib/logger
// El logger en client-side no importa Sentry (import dinámico solo en server)

migrate('src/components/PushButton.tsx',
  'push-button', '@/lib/logger');

migrate('src/components/ShareButton.tsx',
  'share-button', '@/lib/logger');

// ── send-notifications (ya tiene algunas llamadas sin migrar) ─────────────────
migrate('src/app/api/admin/send-notifications/route.ts',
  'notifications', '@/lib/logger');

console.log('\n🎉 Migración completa');
