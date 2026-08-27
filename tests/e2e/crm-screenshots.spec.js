const { test, expect } = require('@playwright/test');
const fs = require('fs');

async function login(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#login')).toBeVisible();
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
}

test('capturas: home, WhatsApp y automatizaciones', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.screenshot({ path: 'test-results/control-2-home.png', fullPage: true });

  const wa = page.locator('.nav[data-view="whatsapplive"]').first();
  await wa.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/control-2-whatsapp.png', fullPage: true });

  // En Vercel real, si GREEN devuelve conversaciones, abrir una y documentar
  // geometría completa. En el preview local sin GREEN no debe fallar el CI.
  const firstChat = page.locator('.waChatRow').first();
  const hasChat = await firstChat.isVisible().catch(() => false);
  if (hasChat) {
    await firstChat.click();
    const composer = page.locator('#view-whatsapplive .waComposer').first();
    await expect(composer).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(800);

    const geometry = await page.evaluate(() => {
      const rect = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x:r.x, y:r.y, width:r.width, height:r.height, top:r.top, right:r.right, bottom:r.bottom, left:r.left };
      };
      return {
        viewport: { width: innerWidth, height: innerHeight },
        view: rect('#view-whatsapplive'),
        page: rect('#view-whatsapplive .waLivePage'),
        layout: rect('#view-whatsapplive .waLiveLayout'),
        chatPane: rect('#view-whatsapplive .waChatPane'),
        active: rect('#view-whatsapplive .waChatActive'),
        composer: rect('#view-whatsapplive .waComposer')
      };
    });
    fs.writeFileSync('test-results/control-2-whatsapp-chat-open-geometry.json', JSON.stringify(geometry, null, 2));
    await page.screenshot({ path: 'test-results/control-2-whatsapp-chat-open.png', fullPage: true });
  }

  const auto = page.locator('.nav[data-view="automations"]').first();
  await auto.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/control-2-automations.png', fullPage: true });
});
