const { test, expect } = require('@playwright/test');

test('Estado del sistema: respeta permisos y carga diagnóstico cuando procede', async ({ page }) => {
  await page.goto('/');
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.getByRole('button', { name: /entrar|iniciar/i }).click();

  const nav = page.locator('.nav[data-view="system"]');
  const isAdmin = await page.evaluate(() => {
    try {
      return typeof perms !== 'undefined' && !!perms?.is_admin;
    } catch (_) {
      return false;
    }
  });

  if (isAdmin) {
    await expect(nav).toBeVisible();
    await nav.click();
    await expect(page.locator('#view-system h2')).toHaveText('Estado del sistema');
    await expect(page.locator('#systemCheckedAt')).not.toHaveText('—', { timeout: 15000 });
    await expect(page.locator('#systemBanner')).not.toContainText('Comprobando', { timeout: 15000 });
  } else {
    await expect(nav).toBeHidden();
    await expect(page.locator('#view-system')).toHaveClass(/hidden/);
  }
});
