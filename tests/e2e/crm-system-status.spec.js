const { test, expect } = require('@playwright/test');

async function login(page){
  await page.goto('/');
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.getByRole('button', { name: /entrar|iniciar/i }).click();
}

test('Estado del sistema: respeta permisos y carga diagnóstico cuando procede', async ({ page }) => {
  await login(page);

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
    await expect(page.locator('#systemExportDiagnostic')).toBeVisible();
    await expect(page.locator('#tpfOperationalChecks')).toBeVisible();
    await expect(page.locator('#tpfIncidentRegistry')).toBeVisible();
    await expect(page.locator('#tpfMaintenanceCard')).toBeVisible();
  } else {
    await expect(nav).toBeHidden();
    await expect(page.locator('#view-system')).toHaveClass(/hidden/);
  }
});

test('Estado del sistema: genera diagnóstico exportable y redacta secretos', async ({ page }) => {
  await login(page);
  const isAdmin = await page.evaluate(() => {
    try { return typeof perms !== 'undefined' && !!perms?.is_admin; } catch (_) { return false; }
  });
  if(!isAdmin) return;

  await page.locator('.nav[data-view="system"]').click();
  await expect(page.locator('#systemExportDiagnostic')).toBeVisible();

  const diagnostic = await page.evaluate(() => {
    localStorage.setItem('tpf_system_errors_v1', JSON.stringify([
      {
        type:'Red',
        message:'https://example.com/api?token=SUPERSECRETO&x=1',
        detail:'Authorization: Bearer abcdefghijklmnopqrstuvwxyz.1234567890.secret',
        at:new Date().toISOString(),
        password:'no-debe-salir'
      }
    ]));
    return window.tpfBuildDiagnostic();
  });

  expect(diagnostic.schema).toBe('tpf-diagnostic-v1');
  expect(Array.isArray(diagnostic.modules)).toBe(true);
  expect(Array.isArray(diagnostic.system_errors)).toBe(true);
  const serialized=JSON.stringify(diagnostic);
  expect(serialized).not.toContain('SUPERSECRETO');
  expect(serialized).not.toContain('no-debe-salir');
  expect(serialized).not.toContain('abcdefghijklmnopqrstuvwxyz.1234567890.secret');
  expect(serialized).toContain('[REDACTADO]');
});
