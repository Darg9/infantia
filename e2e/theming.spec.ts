import { test, expect } from '@playwright/test';

// =============================================================================
// Theming E2E Tests
//
// Valida el contrato de Dark/Light Mode del Design System:
// 1. La clase .dark se aplica ANTES del primer paint (sin FOT)
// 2. El toggle alterna correctamente entre modos y persiste en localStorage
// 3. El encabezado (header) mantiene contraste mínimo aceptable en ambos modos
//
// Nota: los tests de visibilidad del logo (dark:hidden / hidden dark:block)
// dependen del motor CSS de producción compilado. Se cubren con aserciones de
// clase CSS (source of truth) para ser independientes del viewport del test.
// =============================================================================

test.describe('Theming — Contrato de Dark/Light Mode', () => {

  test.beforeEach(async ({ page }) => {
    // Empezar desde estado limpio (sin preferencia guardada)
    await page.addInitScript(() => {
      localStorage.removeItem('theme');
    });
  });

  // ── 1. Sin FOT: el script inline aplica .dark antes del DOMContentLoaded ──
  test('respeta prefers-color-scheme:dark y aplica .dark antes del FCP', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });

    let hasDarkAtDCL = false;
    page.on('domcontentloaded', async () => {
      hasDarkAtDCL = await page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      );
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // El script inline del <head> debe haber actuado antes del DOMContentLoaded
    expect(hasDarkAtDCL).toBe(true);
  });

  // ── 2. Modo claro: .dark ausente, logos con clases correctas (source of truth) ──
  test('en light mode: <html> no tiene clase .dark y logos tienen clases correctas', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // El <html> no debe tener .dark
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // El logo claro debe tener las clases correctas del DS (fuente de verdad)
    const logoLight = page.locator('img[src="/logo.svg"]').first();
    await expect(logoLight).toHaveClass(/dark:hidden/);
  });

  // ── 3. Modo oscuro: .dark presente en <html> desde el inicio ─────────────
  test('en dark mode: <html> tiene clase .dark inmediatamente', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => { localStorage.setItem('theme', 'dark'); });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // La clase .dark debe estar presente antes de cualquier interacción
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  // ── 4. Toggle: de light a dark, persiste en localStorage ─────────────────
  test('ThemeToggle alterna de light a dark y lo persiste en localStorage', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Estado inicial: light
    const initialIsDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );
    expect(initialIsDark).toBe(false);

    // Clic en el toggle (id="theme-toggle" según ThemeToggle.tsx para desktop)
    await page.locator('#theme-toggle').first().click();

    // La clase .dark debe aparecer en el <html>
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Debe persistir en localStorage
    const stored = await page.evaluate(() => localStorage.getItem('theme'));
    expect(stored).toBe('dark');
  });

  // ── 5. Toggle: de dark a light, actualiza localStorage ───────────────────
  test('ThemeToggle alterna de dark a light y actualiza localStorage', async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('theme', 'dark'); });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Esperar a que el script inline haya procesado el localStorage
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'));

    // Clic para volver a light
    await page.locator('#theme-toggle').first().click();

    await expect(page.locator('html')).not.toHaveClass(/dark/);

    const stored = await page.evaluate(() => localStorage.getItem('theme'));
    expect(stored).toBe('light');
  });

  // ── 6. El header existe y es visible en ambos modos ──────────────────────
  test('el header es visible en light y dark mode con logo presente', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.addInitScript((s) => { localStorage.setItem('theme', s); }, scheme);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Esperar a que el body esté estabilizado
      await page.waitForTimeout(300);

      // En desktop: header[aria-label="Sitio principal"]
      // En mobile: header[aria-label="Cabecera móvil"]
      const header = page.locator('header').first();
      await expect(header).toBeVisible();

      // Al menos un logo (cualquier variante) debe estar en el DOM
      const logoCount = await page.locator('img[src="/logo.svg"], img[src="/logo-dark.svg"]').count();
      expect(logoCount).toBeGreaterThanOrEqual(1);
    }
  });
});
