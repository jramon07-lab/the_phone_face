const { test, expect } = require('@playwright/test');
const percySnapshot = require('@percy/playwright');

test('Percy · pantalla inicial The Phone Face', async ({ page }) => {
  const response = await page.goto('/', { waitUntil: 'networkidle' });
  expect(response && response.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/The Phone Face/i);
  await expect(page.locator('body')).toBeVisible();

  await percySnapshot(page, 'The Phone Face · pantalla inicial', {
    widths: [390, 1100, 1280, 1440]
  });
});
