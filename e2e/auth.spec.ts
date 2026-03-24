import { test, expect } from '@playwright/test';

test.describe('Página de login', () => {
  test('renderiza el formulario correctamente', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByPlaceholder('tu@correo.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
  });

  test('muestra error con credenciales inválidas', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('tu@correo.com').fill('noexiste@test.com');
    await page.getByPlaceholder('••••••••').fill('claveincorrecta');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(
      page.getByText('Correo o contraseña incorrectos')
    ).toBeVisible({ timeout: 8_000 });
  });

  test('redirige a /registro desde el link del formulario', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /Crear cuenta|Regístrate/i }).click();
    await expect(page).toHaveURL('/registro');
  });
});

test.describe('Página de registro', () => {
  test('renderiza el formulario correctamente', async ({ page }) => {
    await page.goto('/registro');
    await expect(page.getByPlaceholder('Tu nombre')).toBeVisible();
    await expect(page.getByPlaceholder('tu@correo.com')).toBeVisible();
    await expect(page.getByPlaceholder('Mínimo 6 caracteres')).toBeVisible();
    await expect(page.locator('#acepta-terminos')).toBeVisible();
  });

  test('botón Crear cuenta deshabilitado sin aceptar términos', async ({
    page,
  }) => {
    await page.goto('/registro');
    await page.getByPlaceholder('Tu nombre').fill('Test Usuario');
    await page.getByPlaceholder('tu@correo.com').fill('test@test.com');
    await page.getByPlaceholder('Mínimo 6 caracteres').fill('clave123');
    // Sin marcar el checkbox
    const btn = page.getByRole('button', { name: 'Crear cuenta' });
    await expect(btn).toBeDisabled();
  });

  test('valida contraseña corta', async ({ page }) => {
    await page.goto('/registro');
    await page.getByPlaceholder('Tu nombre').fill('Test Usuario');
    await page.getByPlaceholder('tu@correo.com').fill('test@test.com');
    await page.getByPlaceholder('Mínimo 6 caracteres').fill('abc');
    await page.locator('#acepta-terminos').check();
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    // Mensaje de error específico de contraseña corta
    await expect(
      page.getByText('La contraseña debe tener al menos 6 caracteres')
    ).toBeVisible({ timeout: 5_000 });
  });
});
