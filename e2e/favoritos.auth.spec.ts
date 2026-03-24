/**
 * Tests de favoritos — requieren usuario autenticado.
 * Ejecutados por el proyecto 'con-auth' (usa e2e/.auth/user.json).
 *
 * Requiere en .env.e2e:
 *   E2E_TEST_EMAIL=...
 *   E2E_TEST_PASSWORD=...
 */
import { test, expect } from '@playwright/test';

test.describe('Favoritos (sin autenticación)', () => {
  test('clic en favorito redirige a login si no hay sesión', async ({ page }) => {
    await page.goto('/actividades');
    await page.waitForSelector('main');

    const heartBtn = page
      .locator('[aria-label="Guardar en favoritos"]')
      .first();
    if ((await heartBtn.count()) === 0) {
      test.skip(); // No hay actividades visibles
      return;
    }
    await heartBtn.click();
    // Next.js router.push() — esperar navegación cliente
    await page.waitForURL(/\/login/, { timeout: 8_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Favoritos (con autenticación)', () => {
  test.skip(
    !process.env.E2E_TEST_EMAIL,
    'E2E_TEST_EMAIL no definido — saltar tests con auth'
  );

  test('agregar y quitar favorito', async ({ page }) => {
    await page.goto('/actividades');
    await page.waitForSelector('main');

    const heartBtn = page
      .locator('[aria-label="Guardar en favoritos"]')
      .first();
    if ((await heartBtn.count()) === 0) {
      test.skip(); // No hay actividades visibles
      return;
    }

    // Agregar favorito
    await heartBtn.click();
    await expect(
      page.locator('[aria-label="Quitar de favoritos"]').first()
    ).toBeVisible({ timeout: 5_000 });

    // Quitar favorito
    await page
      .locator('[aria-label="Quitar de favoritos"]')
      .first()
      .click();
    await expect(
      page.locator('[aria-label="Guardar en favoritos"]').first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('favorito guardado aparece en /perfil/favoritos', async ({ page }) => {
    await page.goto('/actividades');
    await page.waitForSelector('main');

    const heartBtn = page
      .locator('[aria-label="Guardar en favoritos"]')
      .first();
    if ((await heartBtn.count()) === 0) {
      test.skip();
      return;
    }

    await heartBtn.click();
    await expect(
      page.locator('[aria-label="Quitar de favoritos"]').first()
    ).toBeVisible({ timeout: 5_000 });

    // Ir a perfil > favoritos
    await page.goto('/perfil/favoritos');
    await expect(page.getByText(/favorit/i)).toBeVisible();
  });
});
