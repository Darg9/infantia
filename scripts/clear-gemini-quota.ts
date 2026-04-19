import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { quota } from '../src/lib/quota-tracker';
import { createLogger } from '../src/lib/logger';

const log = createLogger('clear-gemini-quota');

async function main() {
  log.info('Iniciando limpieza manual de cuota Gemini en Redis...');
  
  try {
    const cleared = await quota.clearAll();
    log.info(`✅ Limpieza completada. Teclas liberadas: ${cleared}. El pipeline ahora puede intentar usar Gemini de nuevo.`);
  } catch (error) {
    log.error('❌ Error al limpiar cuota de Gemini:', { error });
  } finally {
    process.exit(0);
  }
}

main();
