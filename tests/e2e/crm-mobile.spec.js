const { test, expect } = require('@playwright/test');

test.describe('CRM móvil aislado', () => {
  test.use({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3
  });

  test('carga /movil con una interfaz válida para iPhone', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/movil', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/The Phone Face CRM · Móvil/);
    await expect(page.getByTestId('mobile-login')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'CRM móvil' })).toBeVisible();

    const viewport = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth
    }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth + 1);
    expect(viewport.bodyWidth).toBeLessThanOrEqual(viewport.innerWidth + 1);
    expect(errors).toEqual([]);
  });

  test('mantiene la página de escritorio separada', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#login')).toBeAttached();
    await expect(page.locator('#mobileLogin')).toHaveCount(0);
  });
});
