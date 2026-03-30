import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// Cargar variables de entorno E2E (.env.e2e tiene credenciales de test)
config({ path: '.env.e2e' });

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'es-CO',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'sin-auth',
      use: { ...devices['Desktop Chrome'] },
      // Excluye *.auth.spec.ts — esos tests requieren sesión y los maneja 'con-auth'
      testMatch: /^(?!.*\.auth\.spec\.ts).*\.spec\.ts$/,
    },
    {
      name: 'con-auth',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /.*\.auth\.spec\.ts/,
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
