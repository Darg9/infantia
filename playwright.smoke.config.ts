import { defineConfig } from '@playwright/test';
import { config } from 'dotenv';

// Cargar variables de entorno (al igual que en playwright.config.ts)
config({ path: '.env.e2e' });

export default defineConfig({
  testDir: './e2e',
  testMatch: /smoke\.spec\.ts$/,
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Garantizar determinismo
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'npm run build && npm run start:test',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000, // Build puede tardar más de 60s en CI
  },
});
