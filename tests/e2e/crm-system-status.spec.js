const { test, expect } = require('@playwright/test');

test('Estado del sistema: visible para admin y carga diagnóstico', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/correo|email/i).fill(process.env.CRM_TEST_EMAIL);
  await page.getByPlaceholder(/contraseña|password/i).fill(process.env.CRM_TEST_PASSWORD);
  await page.getByRole('button', { name: /entrar|iniciar/i }).click();
  await expect(page.locator('.nav[data-view="system"]')).toBeVisible();
  await page.locator('.nav[data-view="system"]').click();
  await expect(page.locator('#view-system h2')).toHaveText('Estado del sistema');
  await expect(page.locator('#systemCheckedAt')).not.toHaveText('—', { timeout: 15000 });
  await expect(page.locator('#systemBanner')).not.toContainText('Comprobando', { timeout: 15000 });
});
