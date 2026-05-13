import 'dotenv/config';
import { getAvailableKey, quota } from '../src/lib/quota-tracker';

async function main() {
  const key = await getAvailableKey();
  if (key) {
    console.log('✅ Quota disponible — key ends in:', key.slice(-4));
  } else {
    console.log('❌ Todas las keys agotadas');
  }

  const raw = process.env.GEMINI_KEYS ?? process.env.GOOGLE_AI_STUDIO_KEY ?? '';
  const keys = raw.split(',').map(k => k.trim()).filter(Boolean);
  for (const k of keys) {
    const resetAt = await quota.getResetAt(k);
    const status = resetAt ? `agotada hasta ${resetAt.toISOString().slice(0,16)} UTC` : 'disponible';
    console.log(`  key ...${k.slice(-4)}: ${status}`);
  }
}

main().catch(console.error);
