import IORedis from 'ioredis';
import 'dotenv/config';

const url = process.env.REDIS_URL!;
console.log('URL:', url.substring(0, 45) + '...');

const r = new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
r.on('error', (e) => console.error('❌ Error:', e.message));

r.ping()
  .then((res) => { console.log('✅ PONG:', res); return r.quit(); })
  .then(() => process.exit(0))
  .catch((e) => { console.error('❌', e.message); process.exit(1); });
