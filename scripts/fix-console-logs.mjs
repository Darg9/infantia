// Script para reemplazar console.* con logger.* en todos los archivos del proyecto
import { readFileSync, writeFileSync } from 'fs';

const fixes = [
  // expire-activities
  {
    file: 'src/app/api/admin/expire-activities/route.ts',
    from: "    log.info('expire-activities: ${result.expired} actividades expiradas`)",
    to:   "    log.info('Actividades expiradas', { count: result.expired })",
  },
  {
    file: 'src/app/api/admin/expire-activities/route.ts',
    from: "    console.error('[cron] expire-activities error:', err)",
    to:   "    log.error('expire-activities falló', { error: err })",
  },
  // queue enqueue
  {
    file: 'src/app/api/admin/queue/enqueue/route.ts',
    from: "    console.error('POST /api/admin/queue/enqueue error:', error)",
    to:   "    log.error('POST /api/admin/queue/enqueue', { error })",
  },
  // queue status
  {
    file: 'src/app/api/admin/queue/status/route.ts',
    from: "    console.error('GET /api/admin/queue/status error:', error)",
    to:   "    log.error('GET /api/admin/queue/status', { error })",
  },
  // scraping logs
  {
    file: 'src/app/api/admin/scraping/logs/route.ts',
    from: "    console.error('GET /api/admin/scraping/logs error:', error)",
    to:   "    log.error('GET /api/admin/scraping/logs', { error })",
  },
  // scraping sources
  {
    file: 'src/app/api/admin/scraping/sources/route.ts',
    from: "    console.error('GET /api/admin/scraping/sources error:', error)",
    to:   "    log.error('GET /api/admin/scraping/sources', { error })",
  },
  // send-welcome — warn
  {
    file: 'src/app/api/auth/send-welcome/route.ts',
    from: `      console.warn(\`[WELCOME-EMAIL] Error enviando a \${email}:\`, result.error)`,
    to:   "      log.warn('Error enviando welcome email', { email, error: result.error })",
  },
  // send-welcome — error
  {
    file: 'src/app/api/auth/send-welcome/route.ts',
    from: "    console.error('[WELCOME-EMAIL] Exception:', error.message)",
    to:   "    log.error('Exception en send-welcome', { error })",
  },
  // callback — upsert
  {
    file: 'src/app/auth/callback/route.ts',
    from: "        }).catch((err) => console.error('[CALLBACK] User upsert error:', err))",
    to:   "        }).catch((err) => log.error('User upsert error', { error: err, userId: user.id }))",
  },
  // callback — welcome email
  {
    file: 'src/app/auth/callback/route.ts',
    from: "            }).catch((err) => console.error('[CALLBACK] Welcome email error:', err))",
    to:   "            }).catch((err) => log.error('Welcome email error', { error: err, email: user.email }))",
  },
];

let ok = 0;
let missing = 0;
for (const fix of fixes) {
  const src = readFileSync(fix.file, 'utf8');
  if (src.includes(fix.from)) {
    writeFileSync(fix.file, src.replace(fix.from, fix.to));
    console.log('✅', fix.file);
    ok++;
  } else {
    console.log('⚠️  NOT FOUND in', fix.file);
    console.log('   Looking for:', fix.from.substring(0, 60));
    missing++;
  }
}
console.log(`\nDone: ${ok} fixed, ${missing} not found`);
