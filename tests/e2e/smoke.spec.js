const { test, expect } = require('@playwright/test');

test('la aplicación responde y muestra el acceso', async ({ page }) => {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/The Phone Face/i);
  await expect(page.locator('body')).toBeVisible();
});

test('no hay desbordamiento horizontal en la pantalla inicial', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

test('no aparecen errores JavaScript no controlados al cargar', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error.message || error)));
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('el contrato estructural de las pantallas principales sigue presente', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const requiredViews = [
    'dashboard',
    'alerts',
    'database',
    'sales',
    'agenda',
    'whatsapplive',
    'whatsapp',
    'labels',
    'automations',
    'settings',
    'users'
  ];

  for (const view of requiredViews) {
    await expect(page.locator(`[data-view="${view}"]`).first(), `Falta la vista ${view}`).toHaveCount(1);
  }

  const criticalIds = [
    'contactLabelsModal',
    'contactLabelsClose',
    'contactLabelsSave',
    'goalModal',
    'goalModalClose'
  ];

  for (const id of criticalIds) {
    await expect(page.locator(`#${id}`), `Falta el elemento crítico #${id}`).toHaveCount(1);
  }
});
