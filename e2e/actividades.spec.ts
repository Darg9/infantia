import { test, expect } from '@playwright/test';

test.describe('Página /actividades', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/actividades');
    // Esperar a que carguen las actividades (el contador o las cards)
    await page.waitForSelector('main', { timeout: 10_000 });
  });

  test('carga la página y muestra actividades', async ({ page }) => {
    // El contador muestra "X actividades encontradas"
    await expect(page.getByText(/actividades encontradas/i)).toBeVisible();
  });

  test('campo de búsqueda existe y acepta texto', async ({ page }) => {
    const search = page.getByPlaceholder('Buscar actividades...');
    await expect(search).toBeVisible();
    await search.fill('danza');
    // Esperar debounce de 400ms
    await page.waitForTimeout(600);
    // La URL debe actualizarse con el parámetro search
    await expect(page).toHaveURL(/search=danza/);
  });

  test('limpiar búsqueda restaura resultados', async ({ page }) => {
    const search = page.getByPlaceholder('Buscar actividades...');
    await search.fill('xyzterminoquenoexiste');
    await page.waitForURL(/search=xyzterminoquenoexiste/, { timeout: 3_000 });
    // fill('') dispara onChange de React (clear() no lo hace de forma confiable)
    await search.fill('');
    await page.waitForURL(url => !url.href.includes('search='), { timeout: 5_000 });
    await expect(page).not.toHaveURL(/search=/);
  });

  test('filtro de edad cambia la URL', async ({ page }) => {
    // Buscar el select de edad por su opción default
    const ageSelect = page.getByRole('combobox').filter({
      hasText: /Cualquier edad/,
    });
    await expect(ageSelect).toBeVisible();
    await ageSelect.selectOption({ label: '4–6 años' });
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/ageMin=4/);
    await expect(page).toHaveURL(/ageMax=6/);
  });

  test('botón Limpiar aparece con filtros activos', async ({ page }) => {
    // Sin filtros no debe estar
    await expect(page.getByRole('button', { name: 'Limpiar' })).not.toBeVisible();
    // Activar un filtro
    const search = page.getByPlaceholder('Buscar actividades...');
    await search.fill('teatro');
    await page.waitForTimeout(600);
    await expect(page.getByRole('button', { name: 'Limpiar' })).toBeVisible();
  });

  test('botón Limpiar resetea todos los filtros', async ({ page }) => {
    const search = page.getByPlaceholder('Buscar actividades...');
    await search.fill('teatro');
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Limpiar' }).click();
    await page.waitForTimeout(300);
    await expect(page).not.toHaveURL(/search=/);
    await expect(search).toHaveValue('');
  });

  test('filtro de audiencia actualiza la URL', async ({ page }) => {
    // Audience select: segundo combobox (después de edad)
    // tiene opción "👤 Todos" con emoji — nth(1) tras el select de edad
    const selects = page.getByRole('combobox');
    const count = await selects.count();
    if (count >= 2) {
      // El select de audiencia tiene opciones KIDS/FAMILY/ADULTS
      await selects.nth(1).selectOption({ value: 'KIDS' });
      await page.waitForTimeout(300);
      await expect(page).toHaveURL(/audience=KIDS/);
    }
  });

  test('paginación — botón siguiente existe cuando hay más de una página', async ({
    page,
  }) => {
    // Solo verifica que la paginación está presente si hay suficientes resultados
    const nextBtn = page.getByRole('link', { name: /siguiente|›|»/i });
    const count = await nextBtn.count();
    if (count > 0) {
      await nextBtn.first().click();
      await expect(page).toHaveURL(/page=2/);
    }
  });
});
