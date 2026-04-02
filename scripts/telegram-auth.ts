// =============================================================================
// telegram-auth.ts — Autenticación one-time para Telegram MTProto
//
// Ejecutar UNA sola vez para obtener el TELEGRAM_SESSION string.
// Después de correr este script, copia el session string a tu .env.
//
// Uso:
//   npx tsx scripts/telegram-auth.ts
// =============================================================================

import 'dotenv/config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { ConnectionTCPObfuscated } from 'telegram/network/connection/TCPObfuscated.js';
import * as readline from 'readline';

const API_ID   = parseInt(process.env.TELEGRAM_API_ID   ?? '0', 10);
const API_HASH = process.env.TELEGRAM_API_HASH ?? '';

if (!API_ID || !API_HASH) {
  console.error('❌ Faltan variables de entorno: TELEGRAM_API_ID y TELEGRAM_API_HASH');
  console.error('   Agrégalas en .env antes de correr este script.');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> => new Promise((r) => rl.question(q, r));

async function main() {
  console.log('\n📱 Telegram MTProto — Autenticación inicial\n');

  const client = new TelegramClient(new StringSession(''), API_ID, API_HASH, {
    connectionRetries: 5,
    connection: ConnectionTCPObfuscated,
    useWSS: true,          // WebSocket Secure — puerto 443, pasa firewalls
    testServers: false,
  });

  await client.start({
    phoneNumber: async () => {
      const phone = await ask('   Tu número de Telegram (con código país, ej: +573001234567): ');
      return phone.trim();
    },
    phoneCode: async () => {
      const code = await ask('   Código que llegó a tu app Telegram: ');
      return code.trim();
    },
    onError: (err) => console.error('❌ Error:', err.message),
  });

  const sessionString = client.session.save() as unknown as string;

  console.log('\n✅ Autenticación exitosa!\n');
  console.log('   Agrega esta línea a tu .env en Vercel y localmente:\n');
  console.log(`   TELEGRAM_SESSION="${sessionString}"\n`);
  console.log('   ⚠️  Guarda este string de forma segura — da acceso a tu cuenta.\n');

  await client.disconnect();
  rl.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
