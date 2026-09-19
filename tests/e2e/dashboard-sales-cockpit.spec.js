const { test, expect } = require('@playwright/test');

async function login(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#login')).toBeVisible();
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
}

async function dashboard(page) {
  await page.locator('.nav[data-view="dashboard"]').first().click();
  await expect(page.locator('#view-dashboard.tpfDashPro')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#dashAlerts')).not.toBeEmpty({ timeout: 20000 });
}

test('Inicio comercial: acciones, filtros y analítica abren correctamente sin escribir datos', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error?.message || error)));
  await login(page);
  await dashboard(page);

  // Acciones de la cabecera: sólo navegan o muestran el formulario, no guardan nada.
  await page.locator('[data-route="database"]').first().click();
  await expect(page.locator('#view-database')).toBeVisible({ timeout: 10000 });
  await dashboard(page);
  await page.locator('[data-route="agenda"]').first().click();
  await expect(page.locator('#view-agenda')).toBeVisible({ timeout: 10000 });
  await dashboard(page);
  await page.locator('#dashNewOpp').click();
  await expect(page.locator('#view-sales')).toBeVisible({ timeout: 10000 });
  await dashboard(page);

  // Las tarjetas rápidas deben filtrar la tabla del Inicio.
  for (const key of ['calls', 'followup', 'processing']) {
    await page.locator(`.tdPulse[data-home-filter="${key}"]`).click();
    await expect(page.locator('#tdFilterBar')).toBeVisible();
    await expect(page.locator(`#view-dashboard .tdPipeline.isActive [data-home-filter="${key}"]`)).toHaveCount(1);
  }
  await page.locator('[data-home-filter="priority"]').first().click();
  await expect(page.locator('#tdFilterBar')).toBeHidden();

  // Controles locales: abrir/cerrar, más opciones, paginación y objetivo sin guardarlo.
  await page.locator('#tdMoreBtn').click();
  await expect(page.locator('#tdMoreMenu')).toBeVisible();
  await page.locator('#tdActivityMore').click();
  await expect(page.locator('#tdActivityMore')).toHaveText('Ver menos');
  await page.locator('#tdNextPage').click();
  await page.locator('#dashGoalEdit').click();
  await expect(page.locator('#tdGoalModal')).toBeVisible();
  await page.locator('#tdGoalCancel').click();
  await expect(page.locator('#tdGoalModal')).toBeHidden();

  // Bloque desplegable y sus rutas de ventas, agenda, contactos y vencidas.
  await page.locator('.tdBusinessDetails > summary').click();
  await expect(page.locator('.tdAnalysisHero')).toBeVisible();
  await page.locator('.tdMetric[data-route="sales"]').first().click();
  await expect(page.locator('#view-sales')).toBeVisible({ timeout: 10000 });
  await dashboard(page);
  await page.locator('.tdBusinessDetails > summary').click();
  await page.locator('.tdMetric[data-route="agenda"]').click();
  await expect(page.locator('#view-agenda')).toBeVisible({ timeout: 10000 });
  await dashboard(page);
  await page.locator('.tdBusinessDetails > summary').click();
  await page.locator('.tdMetric[data-route="database"]').click();
  await expect(page.locator('#view-database')).toBeVisible({ timeout: 10000 });
  await dashboard(page);
  await page.locator('.tdBusinessDetails > summary').click();
  await page.locator('.tdMetric[data-route="alerts-expired"]').click();
  await expect(page.locator('#view-alerts')).toBeVisible({ timeout: 10000 });

  expect(pageErrors, `Errores JavaScript: ${pageErrors.join(' | ')}`).toEqual([]);
});
