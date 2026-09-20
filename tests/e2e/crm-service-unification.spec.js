const { test, expect } = require('@playwright/test');
const { crmOrigin, expectation, verifyHealth } = require('../../scripts/wait-service-deployment.cjs');

// Real shared data is read, but never captured in screenshots, traces or videos.
// Bypass headers are added only to the exact CRM origin in the routing guard.
test.skip(process.env.E2E_SERVICE_UNIFICATION !== '1', 'Se ejecuta exclusivamente desde el workflow de unificación con SHA y entorno explícitos.');
test.use({ screenshot: 'off', trace: 'off', video: 'off', serviceWorkers: 'block', extraHTTPHeaders: {} });
const DATABASE_ORIGIN = 'https://overfzbjtpjqxzbujezg.supabase.co';
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const READ_RPCS = new Set([
  'current_user_permissions', 'admin_list_users_permissions', 'sales_board', 'search_records',
  'contact_related_items', 'find_possible_duplicate_contact', 'crm_get_contact_custom_values',
  'crm_get_contact_labels', 'crm_get_month_goal', 'crm_list_automation_execution_history',
  'crm_list_automations', 'crm_list_custom_fields', 'crm_list_labels', 'crm_list_offer_followup_events',
  'crm_list_system_events', 'crm_offer_delivery_status', 'crm_offer_followup_latest',
  'crm_system_health_snapshot', 'crm_welcome_capability', 'crm_contact_authorship',
  'wa_get_messages', 'wa_list_templates'
]);
const GREEN_READ = new Map([
  ['state', 'GET'], ['settings', 'GET'], ['summary', 'GET'], ['chats', 'GET'],
  ['avatar', 'POST'], ['previews', 'POST'], ['history', 'POST'], ['file', 'POST'], ['download', 'GET']
]);
const BLOCKED_ACTIONS = /^(send|sendbuttons|sendfile|read|ensure|notification|notifications|webhook|setwebhook|cron|run|callback|authorize|disconnect|test|setup-forum|sync-whatsapp-photo|ensureFolder|link|bulkLink|upload|trash|expiry)$/;

function payload(request) {
  try { return request.postDataJSON() || {}; } catch { return {}; }
}

// GET is not automatically safe: GREEN notifications consume receipts and
// cron endpoints may run jobs. Only reviewed service actions are allowed.
function classify(request, origin) {
  const url = new URL(request.url()), method = request.method();
  const action = url.searchParams.get('action') || '';
  if (url.pathname.startsWith('/functions/v1/')) return 'write';
  if (url.origin === DATABASE_ORIGIN) {
    if (method === 'OPTIONS') return 'read';
    if (url.pathname === '/auth/v1/token' && method === 'POST' &&
        ['password', 'refresh_token'].includes(url.searchParams.get('grant_type'))) return 'auth';
    if (url.pathname === '/auth/v1/user' && READ_METHODS.has(method)) return 'read';
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const name = url.pathname.split('/').pop();
      return READ_RPCS.has(name) && ['GET', 'POST', 'HEAD', 'OPTIONS'].includes(method) ? 'read' : 'write';
    }
    if (url.pathname.startsWith('/rest/v1/')) return READ_METHODS.has(method) ? 'read' : 'write';
    if (url.pathname.startsWith('/storage/v1/object/') && READ_METHODS.has(method)) return 'read';
    return 'blocked-unknown';
  }
  if (url.origin === origin && url.pathname.startsWith('/api/')) {
    if (BLOCKED_ACTIONS.test(action) || /(?:cron|runner|webhook|send|reply|read-safe|enable-status|green-status)/.test(url.pathname)) return 'write';
    if (['/api/green', '/api/mobile-green'].includes(url.pathname)) {
      return GREEN_READ.get(action) === method ? 'read' : 'blocked-unknown';
    }
    if (['/api/health', '/api/green-health'].includes(url.pathname) && method === 'GET') return 'read';
    if (['/api/google-contacts', '/api/crm-backup', '/api/crm-documents'].includes(url.pathname) &&
        ['status', ''].includes(action) && method === 'GET') return 'read';
    if (url.pathname === '/api/google-contacts' && action === 'proxy' && method === 'POST' &&
        String(payload(request).method || 'GET').toUpperCase() === 'GET') return 'read';
    if (url.pathname === '/api/crm-documents' && ['list', 'search', 'bulkFolders'].includes(action) && method === 'GET') return 'read';
    return method === 'GET' ? 'blocked-unknown' : 'write';
  }
  // Another deployment may not receive service calls, even with the same code.
  if (/\.vercel\.app$/.test(url.hostname) && url.origin !== origin && url.pathname.startsWith('/api/')) return 'blocked-unknown';
  return READ_METHODS.has(method) && !url.pathname.startsWith('/api/') ? 'asset' : 'write';
}

function safeLabel(request) {
  const url = new URL(request.url());
  if (url.pathname.startsWith('/rest/v1/rpc/')) return `rpc:${url.pathname.split('/').pop().replace(/[^a-z0-9_]/gi, '')}`;
  if (url.pathname.startsWith('/rest/v1/')) return `table:${url.pathname.split('/')[3].replace(/[^a-z0-9_]/gi, '')}`;
  if (url.pathname.startsWith('/api/')) return `api:${url.pathname.split('/').pop().replace(/[^a-z0-9_-]/gi, '')}`;
  return 'external-request';
}

async function installReadOnlyGuard(context, page, origin) {
  const report = { blockedWrites: 0, blockedByEndpoint: {}, unknownReads: new Set(), failedReads: new Set(), pageErrors: 0, greenAuthorized: false, googleConnected: false, telegramConfigured: false, pendingReads: new Set() };
  const blocked = new WeakSet();
  await context.route('**/*', async route => {
    const request = route.request(), kind = classify(request, origin);
    if (kind === 'write' || kind === 'blocked-unknown') {
      blocked.add(request);
      const label = safeLabel(request);
      if (kind === 'blocked-unknown') report.unknownReads.add(label);
      else {
        report.blockedWrites += 1;
        report.blockedByEndpoint[label] = (report.blockedByEndpoint[label] || 0) + 1;
      }
      // Return an explicit failure, never a fake successful read or write.
      return route.fulfill({ status: 409, headers: { 'Access-Control-Allow-Origin': origin }, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'READ_ONLY_VALIDATION', message: 'Operación bloqueada por la validación de solo lectura.' }) });
    }
    if (kind === 'read') report.pendingReads.add(request);
    const headers = { ...request.headers() };
    delete headers['x-vercel-protection-bypass'];
    delete headers['x-vercel-set-bypass-cookie'];
    if (new URL(request.url()).origin === origin) headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    await route.continue({ headers });
  });
  page.on('pageerror', () => { report.pageErrors += 1; });
  page.on('requestfinished', request => { report.pendingReads.delete(request); });
  page.on('requestfailed', request => {
    report.pendingReads.delete(request);
    if (!blocked.has(request) && classify(request, origin) === 'read' && request.failure()?.errorText !== 'net::ERR_ABORTED') {
      report.failedReads.add(`${safeLabel(request)}:network`);
    }
  });
  page.on('response', async response => {
    const request = response.request();
    if (blocked.has(request) || classify(request, origin) !== 'read') return;
    if (response.status() >= 400) report.failedReads.add(`${safeLabel(request)}:${response.status()}`);
    const url = new URL(request.url());
    try {
      if (url.origin === origin && ['/api/green', '/api/mobile-green'].includes(url.pathname) && url.searchParams.get('action') === 'state') {
        const data = await response.json();
        if (response.ok() && data.ok === true && data.state === 'authorized' && !data.degraded && data.providerHealthy !== false) report.greenAuthorized = true;
      }
      if (url.origin === origin && url.pathname === '/api/google-contacts' && url.searchParams.get('action') === 'status') {
        const data = await response.json();
        report.googleConnected = response.ok() && data.connected === true;
      }
    } catch { /* Incomplete response will not satisfy the positive connection checks. */ }
  });
  return report;
}

function reportScope(report, device) {
  console.log('SERVICE_READONLY_SUMMARY', JSON.stringify({
    device, blockedWrites: report.blockedWrites, blockedByEndpoint: report.blockedByEndpoint,
    unknownReads: [...report.unknownReads], failedReads: [...report.failedReads],
    pageErrors: report.pageErrors, greenAuthorized: report.greenAuthorized, googleConnected: report.googleConnected, telegramConfigured: report.telegramConfigured,
    messagesSent: 0, businessWritesAllowed: 0, deliveryAndRunnersTested: false
  }));
}

function assertReadHealth(report) {
  expect([...report.unknownReads], 'No se deben ocultar lecturas no reconocidas por la guardia').toEqual([]);
  expect([...report.failedReads], 'Las lecturas reales de los servicios deben responder correctamente').toEqual([]);
  expect(report.pageErrors, 'La navegación no debe producir errores JavaScript sin manejar').toBe(0);
}

test.beforeAll(async () => {
  for (const key of ['CRM_TEST_EMAIL', 'CRM_TEST_PASSWORD']) if (!process.env[key]) throw new Error(`Falta ${key}.`);
  const origin = crmOrigin(process.env.VERCEL_PREVIEW_URL || process.env.PLAYWRIGHT_BASE_URL);
  expect(await verifyHealth(origin, expectation(), process.env.VERCEL_AUTOMATION_BYPASS_SECRET), 'Commit, rama y entorno exactos antes de abrir una sesión').toBe(true);
});

test('PC: demo, siete pantallas y conexión real de WhatsApp y Google, solo lectura', async ({ context, page }) => {
  test.setTimeout(150000);
  const origin = crmOrigin(process.env.VERCEL_PREVIEW_URL || process.env.PLAYWRIGHT_BASE_URL);
  const report = await installReadOnlyGuard(context, page, origin);
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#login')).toBeVisible();
    await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
    await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
    await page.locator('#signin').click();
    await expect(page.locator('#app')).toBeVisible({ timeout: 35000 });
    for (const view of ['dashboard', 'database', 'sales', 'agenda', 'whatsapplive', 'automations', 'settings']) {
      await test.step(`Abrir ${view}`, async () => {
        const nav = page.locator(`.nav[data-view="${view}"]`).first();
        await expect(nav).toBeVisible();
        await nav.click();
        await expect(page.locator(`#view-${view}`)).toBeVisible();
        // A visible section alone is insufficient: the normal navigation must
        // finish and contain rendered content while the real reads stay active.
        await expect.poll(() => page.locator(`#view-${view}`).evaluate(el => el.childElementCount > 0)).toBe(true);
      });
    }
    const card = page.locator('#whatsappSettingsStatus');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('aria-busy', 'false', { timeout: 20000 });
    await expect(card).toHaveAttribute('data-state', /^(active|paused)$/);
    await expect(page.locator('#whatsappSettingsProvider')).toHaveText('Autorizado');
    await expect.poll(() => report.greenAuthorized, { timeout: 15000 }).toBe(true);
    await expect.poll(() => report.googleConnected, { timeout: 15000 }).toBe(true);
    report.telegramConfigured = await page.locator('#notifyTelegramChatId').evaluate(el => /^-?\d+$/.test(el.value.trim()));
    expect(report.telegramConfigured, 'Telegram debe tener un destino configurado; esto no prueba la entrega').toBe(true);
    await expect.poll(() => report.pendingReads.size, { timeout: 20000 }).toBe(0);
    assertReadHealth(report);
  } finally { reportScope(report, 'PC'); }
});

test.describe('Móvil de solo lectura', () => {
  test.use({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  test('Móvil: demo, Inicio, Contactos, Ventas y WhatsApp', async ({ context, page }) => {
    test.setTimeout(120000);
    const origin = crmOrigin(process.env.VERCEL_PREVIEW_URL || process.env.PLAYWRIGHT_BASE_URL);
    const report = await installReadOnlyGuard(context, page, origin);
    try {
      await page.goto('/movil/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#mobileLogin')).toBeVisible();
      await page.locator('#mobileEmail').fill(process.env.CRM_TEST_EMAIL);
      await page.locator('#mobilePassword').fill(process.env.CRM_TEST_PASSWORD);
      await page.locator('#mobileSignIn').click();
      await expect(page.locator('#mobileApp')).toBeVisible({ timeout: 35000 });
      for (const view of ['home', 'contacts', 'opportunities', 'whatsapp']) {
        await page.locator(`[data-mobile-route="${view}"]`).click();
        await expect(page.locator(`[data-mobile-route="${view}"]`)).toHaveClass(/active/);
        await expect(page.locator('#mobileView')).toBeVisible();
        await expect.poll(() => page.locator('#mobileView').evaluate(el => el.childElementCount > 0)).toBe(true);
      }
      await expect.poll(() => report.greenAuthorized, { timeout: 20000 }).toBe(true);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      expect(overflow, 'La página móvil no debe desbordar el ancho de pantalla').toBe(false);
      await expect.poll(() => report.pendingReads.size, { timeout: 20000 }).toBe(0);
      assertReadHealth(report);
    } finally { reportScope(report, 'móvil'); }
  });
});
