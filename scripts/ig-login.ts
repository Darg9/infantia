// ig-login.ts
// One-time script to log into Instagram and save the session.
// Usage: npx tsx scripts/ig-login.ts
//
// Opens a VISIBLE browser window. You log in manually.
// Once logged in, press Enter in the terminal to save the session.
// The session is saved to data/ig-session.json and reused by the scraper.

import 'dotenv/config';
import { chromium } from 'playwright';
import { resolve } from 'path';
import { createInterface } from 'readline';

const SESSION_FILE = resolve(process.cwd(), 'data', 'ig-session.json');

function waitForEnter(prompt: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  console.log('=== Instagram Login — Sesion Persistente ===\n');
  console.log('Se abrira un navegador Chrome. Inicia sesion en Instagram manualmente.');
  console.log('Cuando estes logueado, vuelve aqui y presiona Enter.\n');

  const browser = await chromium.launch({
    headless: false, // Visible browser for manual login
    slowMo: 100,
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
  });

  const page = await context.newPage();
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded' });

  console.log('Navegador abierto en la pagina de login de Instagram.');
  console.log('Inicia sesion con tu cuenta de prueba.\n');

  await waitForEnter('Presiona Enter cuando hayas iniciado sesion exitosamente... ');

  // Verify we're logged in by checking the URL
  const currentUrl = page.url();
  if (currentUrl.includes('/accounts/login')) {
    console.log('\nParece que aun estas en la pagina de login.');
    await waitForEnter('Si ya iniciaste sesion, presiona Enter de nuevo... ');
  }

  // Save session (cookies + localStorage)
  await context.storageState({ path: SESSION_FILE });
  console.log(`\nSesion guardada en: ${SESSION_FILE}`);
  console.log('Ahora puedes ejecutar: npx tsx scripts/test-instagram.ts <URL>');

  await browser.close();
}

main().catch(console.error);
