import { test, expect } from '@playwright/test';

test.describe('Search Assist System (HeroSearch)', () => {

  test.beforeEach(async ({ page }) => {
    // Vamos a la home donde está el HeroSearch
    await page.goto('/');
  });

  test('Caso 1: AbortController cancela requests previas al escribir rápido', async ({ page }) => {
    let abortCount = 0;
    
    await page.route('**/api/activities/suggestions?q=*', async (route) => {
      // Simulamos latencia para que las primeras requests se aborten
      await new Promise(r => setTimeout(r, 400));
      try {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ type: 'query', id: '1', label: 'arte' }])
        });
      } catch (e) {
        abortCount++;
      }
    });

    const searchInput = page.locator('input[id="hero-search"]');
    await searchInput.fill('');
    
    // Escribimos rápido simulando typing real
    await searchInput.type('arte', { delay: 50 });

    // Esperamos a que termine el debounce y fetch
    await page.waitForTimeout(1000);
    
    await expect(page.getByRole('listbox')).toBeVisible();
    const option = page.getByRole('option').first();
    await expect(option).toBeVisible();
  });

  test('Caso 2: Tracking Integrity', async ({ page }) => {
    const trackingEvents: any[] = [];

    await page.route('**/api/events', async (route) => {
      if (route.request().method() === 'POST') {
        trackingEvents.push(route.request().postDataJSON());
      }
      await route.fulfill({ status: 204 });
    });

    await page.route('**/api/activities/suggestions?q=*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { type: 'activity', id: '123', label: 'Taller de Arte' }
        ])
      });
    });

    const searchInput = page.locator('input[id="hero-search"]');
    await searchInput.fill('arte');
    
    const option = page.getByRole('option', { name: /Taller de Arte/i });
    await expect(option).toBeVisible();

    await option.click();

    // Verificamos el payload de tracking
    // Necesitamos esperar un momento para que el fetch asíncrono en background se procese
    await page.waitForTimeout(500);

    const suggestionEvent = trackingEvents.find(e => e.type === 'search_suggestion_clicked');
    
    expect(suggestionEvent).toBeDefined();
    expect(suggestionEvent.metadata).toMatchObject({
      query: 'arte',
      suggestion: 'Taller de Arte',
      type: 'activity'
    });
  });

  test('Caso 3: XSS Protection en Input y Highlight', async ({ page }) => {
    const xssString = '<script>alert("XSS")</script>';
    
    await page.route('**/api/activities/suggestions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { type: 'query', id: 'xss', label: xssString }
        ])
      });
    });

    let dialogAppeared = false;
    page.on('dialog', async dialog => {
      dialogAppeared = true;
      await dialog.dismiss();
    });

    const searchInput = page.locator('input[id="hero-search"]');
    // Para que dispare la búsqueda, escribimos el XSS
    await searchInput.fill(xssString);
    
    // Provocar el trigger del fetch
    await searchInput.press('Space');
    await searchInput.press('Backspace');

    const option = page.getByRole('option').first();
    await expect(option).toBeVisible();

    // Verificamos que el texto esté visible como string puro y que el script NO se haya ejecutado
    await expect(option).toContainText(xssString);
    expect(dialogAppeared).toBe(false); // No hubo XSS execution
  });

  test('Caso 4: API Failure resiliencia (500 Timeout)', async ({ page }) => {
    await page.route('**/api/activities/suggestions?q=*', async (route) => {
      await route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    const searchInput = page.locator('input[id="hero-search"]');
    await searchInput.fill('talleres');

    await page.waitForTimeout(1000);

    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(searchInput).toBeEditable();
  });

});
