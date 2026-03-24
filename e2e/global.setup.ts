import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

setup('autenticar usuario de prueba', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    console.warn(
      '⚠️  E2E_TEST_EMAIL / E2E_TEST_PASSWORD no definidos — ' +
        'los tests con-auth serán saltados.'
    );
    // Guardar estado vacío para que no falle el archivo
    await page.context().storageState({ path: authFile });
    return;
  }

  await page.goto('/login');
  await page.getByPlaceholder('tu@correo.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  // Esperar redirección al home tras login exitoso
  await expect(page).toHaveURL('/', { timeout: 10_000 });

  await page.context().storageState({ path: authFile });
});
