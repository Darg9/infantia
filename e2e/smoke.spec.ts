import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - Production Build', () => {
  test('home loads without hydration or serialization errors', async ({ page }) => {
    const errors: string[] = [];

    // Catch console errors (hydration mismatches, React errors)
    page.on('console', (msg) => {
      if (
        msg.type() === 'error' &&
        !msg.text().includes('favicon') &&
        !msg.text().includes('Warning:')
      ) {
        errors.push(msg.text());
      }
    });

    const res = await page.goto('/');
    
    // Check for 500 fatal errors (Server Component serialization crash)
    expect(res?.status()).toBeLessThan(400);

    // Give it a moment to hydrate
    await page.waitForLoadState('networkidle');

    // Fail the test if there were any console errors during hydration
    expect(errors).toHaveLength(0);
  });

  test('perfil historial loads without crashing', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (
        msg.type() === 'error' &&
        !msg.text().includes('favicon') &&
        !msg.text().includes('Warning:')
      ) {
        errors.push(msg.text());
      }
    });

    const res = await page.goto('/perfil/historial');
    
    expect(res?.status()).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });
});
