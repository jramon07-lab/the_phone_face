const { test, expect } = require('@playwright/test');

const HOME = '#view-dashboard.tpfDashPro';
const businessTables = new Set(['records', 'sales_opportunities', 'sales_stages', 'agenda_items', 'whatsapp_jobs', 'crm_month_goals']);
const audit = new WeakMap();
test.setTimeout(180000);
test.use({ screenshot: 'off', trace: 'off', video: 'off', actionTimeout: 10000, navigationTimeout: 30000, viewport: { width: 1440, height: 900 } });

function diagnosticSource(rawUrl) {
  try {
    const path = new URL(rawUrl).pathname;
    const rest = path.match(/\/rest\/v1\/(?:rpc\/)?[a-z_]+/i);
    if (rest) return rest[0];
    if (/^\/(?:js|assets)\/[a-z0-9_./-]+\.(?:js|css)$/i.test(path)) return path;
    const api = path.match(/^\/api\/[a-z_-]+/i);
    return api ? api[0] : '<page>';
  } catch (_) { return '<unknown>'; }
}

function covered(label) {
  // Control names only: never log customers, IDs, payloads or credentials.
  console.log(`[Inicio demo] PASS: ${label}`);
}

function unavailable(label) {
  test.info().annotations.push({ type: 'coverage-gap', description: `${label}: sin registro aplicable en demo; acción no probada` });
  console.log(`[Inicio demo] SIN DATOS: ${label}`);
}

async function login(page) {
  expect(Boolean(process.env.CRM_TEST_EMAIL && process.env.CRM_TEST_PASSWORD), 'Faltan credenciales demo en Actions').toBeTruthy();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#login')).toBeVisible();
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
}

async function dashboard(page) {
  await page.locator('.nav[data-view="dashboard"]').first().click();
  await expect(page.locator(HOME)).toBeVisible({ timeout: 20000 });
  await expect(page.locator(HOME)).toHaveAttribute('data-home-version', '20260919-sales-cockpit-7');
  await expect(page.locator(`${HOME} #mOppTotal`)).toHaveText(/^\d+$/, { timeout: 20000 });
  await expect(page.locator(`${HOME} #dashRefresh`)).toBeEnabled({ timeout: 20000 });
  await expect(page.locator(`${HOME} #dashAlerts`)).not.toBeEmpty();
  await expect(page.locator(`${HOME} #tdDataStatus`), 'Inicio no debe ocultar fallos de carga').toBeHidden();
}

async function expandAnalytics(page) {
  const details = page.locator(`${HOME} .tdBusinessDetails`);
  if (!(await details.evaluate(el => el.open))) await details.locator(':scope > summary').click();
  await expect(page.locator(`${HOME} .tdAnalysisHero`)).toBeVisible();
}

async function priorities(page) {
  await page.locator(`${HOME} #tdFilterBar [data-home-filter="priority"]`).click();
  await expect(page.locator(`${HOME} #tdFilterBar`)).toBeVisible();
  await expect(page.locator(`${HOME} #tdFilterBar [data-home-filter="priority"]`)).toHaveAttribute('aria-pressed', 'true');
  while (await page.locator(`${HOME} #tdPrevPage`).isEnabled()) await page.locator(`${HOME} #tdPrevPage`).click();
}

async function viewSnapshot(page) {
  return page.evaluate(() => {
    const displayed = element => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    };
    return {
      views: [...document.querySelectorAll('.referenceWorkspace > main > section[id^="view-"]')].filter(displayed).map(element => element.id),
      active: [...document.querySelectorAll('.referenceNav .nav.active[data-view]')].map(element => element.dataset.view),
    };
  });
}

async function exclusiveRoute(page, target, stableMs = 0) {
  const expected = { views: [`view-${target}`], active: [target] };
  await expect.poll(() => viewSnapshot(page), { timeout: 20000 }).toEqual(expected);
  await expect(page.locator(`#view-${target}`)).toBeInViewport();
  if (target !== 'dashboard') await expect(page.locator(HOME)).toBeHidden();
  const end = Date.now() + stableMs;
  while (Date.now() < end) {
    await page.waitForTimeout(Math.min(250, end - Date.now()));
    expect(await viewSnapshot(page), 'La vista debe seguir siendo exclusiva al terminar la carga y los sondeos').toEqual(expected);
  }
}

async function scrollOffsets(page) {
  return page.evaluate(() => ({ window: window.scrollY, main: document.querySelector('.referenceWorkspace > main')?.scrollTop || 0 }));
}

async function clickWithoutScrollJump(page, locator) {
  // Account for Playwright moving the button into view BEFORE measuring.
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const before = await scrollOffsets(page);
  await locator.click();
  let elapsed = 0;
  for (const sample of [250, 750, 1500]) {
    await page.waitForTimeout(sample - elapsed);
    elapsed = sample;
    const after = await scrollOffsets(page);
    expect(Math.abs(after.window - before.window), 'El filtro no debe saltar por la página').toBeLessThanOrEqual(48);
    expect(Math.abs(after.main - before.main), 'El filtro no debe desplazar automáticamente la mesa de trabajo').toBeLessThanOrEqual(48);
  }
}

async function pageRange(page) {
  const label = await page.locator(`${HOME} #tdPageInfo`).textContent();
  const numbers = label.match(/\d+/g)?.map(Number) || [];
  const rows = await page.locator(`${HOME} #dashAlerts tbody tr`).count();
  if (!numbers.length || (numbers.length === 1 && numbers[0] === 0)) {
    expect(rows, 'La lista vacía debe tener cero filas').toBe(0);
    return { first: 0, last: 0, total: 0, rows };
  }
  expect(numbers.length, 'Rango legible con inicio, fin y total').toBe(3);
  const [first, last, total] = numbers;
  expect(rows, 'Las filas visibles deben coincidir con el rango indicado').toBe(last - first + 1);
  return { first, last, total, rows };
}

async function sidebarGeometry(page) {
  return page.evaluate(() => {
    const sidebar = document.querySelector('.referenceSidebar');
    const item = document.querySelector('.referenceNav .nav[data-view="database"]');
    const style = getComputedStyle(item);
    return {
      width: Math.round(sidebar.getBoundingClientRect().width),
      fontSize: style.fontSize, lineHeight: style.lineHeight,
      padding: style.padding, minHeight: style.minHeight, gap: style.gap,
    };
  });
}

async function visitRoute(page, selector, target, expired = false) {
  await page.locator(`${HOME} ${selector}`).click();
  await expect(page.locator(`#view-${target}`)).toBeVisible({ timeout: 20000 });
  await exclusiveRoute(page, target, 3000);
  if (expired) {
    await expect(page.locator('#view-alerts .avCounter[data-kind="expired"]')).toHaveClass(/active/, { timeout: 20000 });
    await expect(page.locator('#view-alerts .avCounter.active')).toHaveCount(1);
  }
  await dashboard(page);
}

async function closeOpportunityEditor(page, existing = false) {
  await expect(page.locator('#oppDetailModal')).toBeVisible({ timeout: 20000 });
  // Check identity presence without exposing a customer ID in failure output.
  await expect.poll(async () => Boolean(await page.locator('#oppModalId').inputValue())).toBe(existing);
  await expect(page.locator('#oppModalTitle')).toBeVisible();
  await page.locator('#oppModalCloseX').click();
  await expect(page.locator('#oppDetailModal')).toBeHidden({ timeout: 10000 });
}

async function openAndReturn(page, locator, label) {
  const type = await locator.getAttribute('data-type');
  await locator.click();
  if (type === 'opportunity') {
    await expect(page.locator('#opportunityFullPage')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#oppFullContent')).not.toBeEmpty();
    await page.locator('#oppFullBack').click();
    await expect(page.locator('#opportunityFullPage')).toBeHidden({ timeout: 10000 });
  } else if (type === 'task') {
    await expect(page.locator('#agendaCreateCard')).toHaveClass(/open/, { timeout: 20000 });
    await expect(page.locator('#agendaTitle')).toBeVisible();
    await page.locator('#agendaCloseCreate').click();
    await expect(page.locator('#agendaCreateCard')).not.toHaveClass(/open/);
  } else if (type === 'contact') {
    await expect(page.locator('#contactModal')).toBeVisible({ timeout: 20000 });
    await page.locator('#contactClose').click();
    await expect(page.locator('#contactModal')).toBeHidden({ timeout: 10000 });
  } else throw new Error('Tipo de elemento de Inicio no soportado por la prueba');
  await dashboard(page);
  covered(label);
}

async function findPriorityType(page, type) {
  await priorities(page);
  for (let i = 0; i < 210; i += 1) {
    const item = page.locator(`${HOME} #dashAlerts .tdClientButton[data-type="${type}"]`).first();
    if (await item.count()) return item;
    const next = page.locator(`${HOME} #tdNextPage`);
    if (!(await next.isEnabled())) break;
    await next.click();
  }
  return null;
}

test.beforeEach(async ({ page }) => {
  const result = { runtimeErrors: 0, consoleErrors: 0, blockedBusinessWrites: 0, unexpectedDialogs: 0, isolatedWhatsappQueueReads: 0 };
  audit.set(page, result);
  page.on('pageerror', () => { result.runtimeErrors += 1; });
  page.on('console', message => {
    if (message.type() === 'error' && !message.location().url.startsWith('chrome-extension://')) {
      result.consoleErrors += 1;
      const category = /Failed to load resource|net::ERR_/i.test(message.text()) ? 'resource-error' : 'application-error';
      console.log(`[Inicio demo] ERROR: ${category} source=${diagnosticSource(message.location().url)}`);
    }
  });
  page.on('dialog', async dialog => { result.unexpectedDialogs += 1; await dialog.dismiss(); });
  // Only open/cancel forms. Block accidental business writes as a safety net.
  await page.route('**/rest/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/rest\/v1\//, '');
    // waAutoSendDueSchedules (whatsapp-green-core.js) runs on startup and
    // every 30s. Isolate ONLY its due-message queue, before it can claim/send.
    // The dashboard's live agenda reads use no such filters and stay intact.
    if (request.method() === 'GET' && path === 'agenda_items' &&
        url.searchParams.get('whatsapp_enabled') === 'eq.true' &&
        url.searchParams.get('status') === 'eq.pending' &&
        String(url.searchParams.get('whatsapp_scheduled_at') || '').startsWith('lte.')) {
      result.isolatedWhatsappQueueReads += 1;
      console.log('[Inicio demo] AISLADO: cola automática de WhatsApp; lectura vacía sólo en este navegador');
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(request.method());
    if (mutating && (businessTables.has(path.split('/')[0]) || /^(rpc\/)?crm_set_(month_goal|contact_labels)$/.test(path))) {
      result.blockedBusinessWrites += 1;
      console.log(`[Inicio demo] BLOQUEADO: ${request.method()} ${diagnosticSource(request.url())}`);
      await route.abort('blockedbyclient');
    } else await route.continue();
  });
  await login(page);
  await dashboard(page);
});

test.afterEach(async ({ page }) => {
  const result = audit.get(page);
  console.log(`[Inicio demo] diagnóstico: ${JSON.stringify(result)}`);
  const { isolatedWhatsappQueueReads, ...errors } = result;
  expect(errors, 'Navegación libre de errores y escrituras comerciales').toEqual({ runtimeErrors: 0, consoleErrors: 0, blockedBusinessWrites: 0, unexpectedDialogs: 0 });
});

test('Inicio: creación desde cabecera y analítica abre formularios y permite cancelar', async ({ page }) => {
  // Fresh login: no prior visit to Sales has warmed its cache.
  await page.locator(`${HOME} #dashNewOpp`).click();
  await closeOpportunityEditor(page);
  covered('Nueva oportunidad de cabecera con caché fría; cancelar sin guardar');
  await dashboard(page);
  await expandAnalytics(page);
  await page.locator(`${HOME} #dashNewOppDetail`).click();
  await closeOpportunityEditor(page);
  covered('Nueva oportunidad de analítica; cancelar sin guardar');
  await dashboard(page);
  for (const selector of ['.tdHeroQuick [data-home-action="new-contact"]', '#tdAddContact']) {
    await page.locator(`${HOME} ${selector}`).click();
    await expect(page.locator('#tpfContactsCreateBack')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#tpfCreateFirst')).toBeVisible();
    await expect(page.locator('#tpfCreateFirst')).toHaveValue('');
    await page.locator('#tpfContactsCreateCancel').click();
    await expect(page.locator('#tpfContactsCreateBack')).toBeHidden();
    await dashboard(page);
    covered(`${selector === '#tdAddContact' ? 'Añadir contacto de tabla' : 'Nuevo contacto de cabecera'} abre el alta, no sólo la lista`);
  }
});

test('Inicio: indicadores y pestañas conservan el contexto, búsqueda y resultados completos', async ({ page }) => {
  await expect(page.locator(`${HOME} .tdPipelineGrid`)).toHaveCount(0);
  await expect(page.locator(`${HOME} #tdFilterBar [data-home-filter]`)).toHaveCount(4);
  await expect(page.locator(`${HOME} #tdPageSize`)).toHaveValue('10');
  for (const surface of ['.tdPulse', '#tdFilterBar button']) {
    for (const key of ['calls', 'followup', 'processing']) {
      await priorities(page);
      await clickWithoutScrollJump(page, page.locator(`${HOME} ${surface}[data-home-filter="${key}"]`));
      await expect(page.locator(`${HOME} #tdFilterBar`)).toBeVisible();
      await expect(page.locator(`${HOME} #tdFilterBar [aria-pressed="true"]`)).toHaveCount(1);
      await expect(page.locator(`${HOME} #tdFilterBar [data-home-filter="${key}"]`)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator(`${HOME} #tdPrevPage`)).toBeDisabled();
      const range = await pageRange(page);
      const pulseId = { calls: 'tdPulseCalls', followup: 'tdPulseFollowup', processing: 'tdPulseProcessing' }[key];
      const count = Number(await page.locator(`${HOME} #${pulseId}`).textContent());
      expect(range.total, 'El filtro debe incluir todos los registros del indicador').toBe(count);
      // Clicking the selected tab must not unexpectedly switch back to Priority.
      await page.locator(`${HOME} #tdFilterBar [data-home-filter="${key}"]`).click();
      await expect(page.locator(`${HOME} #tdFilterBar [data-home-filter="${key}"]`)).toHaveAttribute('aria-pressed', 'true');
      covered(`Filtro ${key} desde ${surface}`);
    }
  }
  await priorities(page);
  const original = await pageRange(page);
  expect(original.rows).toBeLessThanOrEqual(10);
  const next = page.locator(`${HOME} #tdNextPage`);
  if (await next.isEnabled()) {
    await next.click();
    const second = await pageRange(page);
    expect(second.first).toBe(11);
    expect(second.total).toBe(original.total);
    await expect(page.locator(`${HOME} #tdPrevPage`)).toBeEnabled();
    await page.locator(`${HOME} #tdPrevPage`).click();
    expect(await pageRange(page)).toEqual(original);
    covered('Paginación siguiente/anterior conserva prioridades');
  } else {
    await expect(next).toBeDisabled();
    unavailable('Paginación siguiente: hay una sola página');
  }
  for (const size of ['25', '50', 'all']) {
    await page.locator(`${HOME} #tdPageSize`).selectOption(size);
    const range = await pageRange(page);
    expect(range.total).toBe(original.total);
    expect(range.rows).toBe(Math.min(original.total, size === 'all' ? original.total : Number(size)));
    await expect(page.locator(`${HOME} #tdPrevPage`)).toBeDisabled();
    if (size === 'all') await expect(next).toBeDisabled();
    covered(`Tamaño de lista ${size}: rango completo y consistente`);
  }
  // No customer text is placed in the test log, even on a failed fill action.
  await page.locator(`${HOME} #tdWorkSearch`).fill('zzzz__inicio_demo_no_match__');
  await expect(page.locator(`${HOME} #dashAlerts tbody tr`)).toHaveCount(0);
  expect((await pageRange(page)).total).toBe(0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
  await dashboard(page);
  await expect(page.locator(`${HOME} #tdWorkSearch`)).toHaveValue('zzzz__inicio_demo_no_match__');
  await expect(page.locator(`${HOME} #tdPageSize`)).toHaveValue('all');
  await expect(page.locator(`${HOME} #tdFilterBar [data-home-filter="priority"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(`${HOME} #dashAlerts tbody tr`)).toHaveCount(0);
  covered('Recargar conserva pestaña, búsqueda y tamaño de lista sin guardar registros');
  await expect(page.locator(`${HOME} #tdClearSearch`)).toBeVisible();
  await page.locator(`${HOME} #tdClearSearch`).click();
  await expect(page.locator(`${HOME} #tdWorkSearch`)).toHaveValue('');
  expect((await pageRange(page)).rows).toBe(original.total);
  covered('Búsqueda sin coincidencias y borrar recupera todos los resultados');
  await page.locator(`${HOME} #tdPageSize`).selectOption('10');
  await visitRoute(page, '.tdPulse[data-route="alerts-expired"]', 'alerts', true);
  covered('Vencidas rápidas abre Avisos con filtro Vencidas activo');
});

test('Inicio: oportunidad y menú abren/editan con caché fría y cierran sin guardar', async ({ page }) => {
  const candidate = await findPriorityType(page, 'opportunity');
  expect(Boolean(candidate), 'Demo necesita una oportunidad pendiente para Abrir/Editar').toBeTruthy();
  const row = candidate.locator('xpath=ancestor::tr');
  await row.locator('[data-dots]').click();
  await expect(row.locator('.tdRowMenu')).toBeVisible();
  await row.locator('[data-action="edit"]').click();
  await closeOpportunityEditor(page, true);
  covered('Editar oportunidad desde tres puntos sin precargar Ventas');
  await dashboard(page);
  await openAndReturn(page, await findPriorityType(page, 'opportunity'), 'Abrir oportunidad pulsando cliente');
  const menuRow = (await findPriorityType(page, 'opportunity')).locator('xpath=ancestor::tr');
  await menuRow.locator('[data-dots]').click();
  await openAndReturn(page, menuRow.locator('[data-action="open"]'), 'Abrir oportunidad desde tres puntos');
  const interestRow = (await findPriorityType(page, 'opportunity')).locator('xpath=ancestor::tr');
  await openAndReturn(page, interestRow.locator('.tdInterestButton'), 'Abrir oportunidad pulsando interés');
});

test('Inicio: tareas, siguiente acción y próximos seguimientos abren registros', async ({ page }) => {
  const task = await findPriorityType(page, 'task');
  if (task) {
    await openAndReturn(page, task, 'Abrir tarea pendiente de tabla');
    const row = (await findPriorityType(page, 'task')).locator('xpath=ancestor::tr');
    await row.locator('[data-dots]').click();
    await openAndReturn(page, row.locator('[data-action="edit"]'), 'Editar tarea desde tres puntos; cancelar');
  } else unavailable('Abrir/editar tarea pendiente de tabla');
  await priorities(page);
  for (const [selector, label] of [
    ['#tdFocusContent [data-open]', 'Siguiente mejor acción'],
    ['#dashPriorityFollowups [data-open]', 'Próximo seguimiento'],
  ]) {
    const item = page.locator(`${HOME} ${selector}`).first();
    if (await item.count()) await openAndReturn(page, item, label);
    else unavailable(label);
  }
  const initial = await page.locator(`${HOME} #dashPriorityFollowups .tdUpcoming`).count();
  expect(initial).toBeLessThanOrEqual(3);
  const toggle = page.locator(`${HOME} #tdUpcomingMore`);
  if (await toggle.isVisible()) {
    await toggle.click();
    await expect(toggle).toHaveText('Ver menos');
    expect(await page.locator(`${HOME} #dashPriorityFollowups .tdUpcoming`).count()).toBeGreaterThanOrEqual(initial);
    await toggle.click();
    await expect(page.locator(`${HOME} #dashPriorityFollowups .tdUpcoming`)).toHaveCount(initial);
    covered('Próximos seguimientos: tres iniciales, ampliar y reducir');
  } else unavailable('Ampliar seguimientos: no hay más de tres');
});

test('Inicio: analítica, seis indicadores, embudo, previsión y objetivo', async ({ page }) => {
  await expandAnalytics(page);
  await expect(page.locator(`${HOME} .tdMetric`)).toHaveCount(6);
  for (const id of ['tdAnalysisOpen', 'tdAnalysisForecast', 'tdAnalysisConversion', 'tdGoalDetailAmount']) await expect(page.locator(`${HOME} #${id}`)).not.toHaveText('—');
  await expect(page.locator(`${HOME} #dashFunnel`)).not.toBeEmpty();
  await expect(page.locator(`${HOME} #dashForecastBreakdown`)).not.toBeEmpty();
  covered('Desplegable: cabecera, indicadores, embudo, objetivo y previsión cargados');
  for (let index = 0; index < 6; index += 1) {
    await expandAnalytics(page);
    const metric = page.locator(`${HOME} .tdMetric`).nth(index);
    const route = await metric.getAttribute('data-route');
    await metric.click();
    await expect(page.locator(`#view-${route === 'alerts-expired' ? 'alerts' : route}`)).toBeVisible({ timeout: 20000 });
    await exclusiveRoute(page, route === 'alerts-expired' ? 'alerts' : route, 3000);
    if (route === 'alerts-expired') await expect(page.locator('#view-alerts .avCounter[data-kind="expired"]')).toHaveClass(/active/, { timeout: 20000 });
    await dashboard(page);
    await expect(page.locator(`${HOME} .tdAnalysisHero`)).toBeVisible();
    covered(`Indicador ${index + 1}: destino correcto; desplegable abierto al volver`);
  }
  for (const label of ['Abrir panel de ventas', 'Ver previsión comercial']) {
    await expandAnalytics(page);
    await visitRoute(page, `[aria-label="${label}"]`, 'sales');
    covered(label);
  }
  await page.locator(`${HOME} #dashGoalEdit`).click();
  await expect(page.locator(`${HOME} #tdGoalModal`)).toBeVisible();
  await expect(page.locator(`${HOME} #tdGoalAmountInput`)).toBeVisible();
  await expect(page.locator(`${HOME} #tdGoalCountInput`)).toBeVisible();
  await page.locator(`${HOME} #tdGoalCancel`).click();
  await expect(page.locator(`${HOME} #tdGoalModal`)).toBeHidden();
  covered('Editar objetivo abre dos campos; cancelar no guarda');
  await expandAnalytics(page);
  await page.locator(`${HOME} .tdBusinessDetails > summary`).click();
  await expect(page.locator(`${HOME} .tdAnalysisHero`)).toBeHidden();
  await expandAnalytics(page);
  covered('Analítica se pliega y despliega nuevamente');
});

test('Inicio: actualizar, opciones, rutas secundarias y actividad', async ({ page }) => {
  await page.locator(`${HOME} #dashRefresh`).click();
  await expect(page.locator(`${HOME} #dashRefresh`)).toBeEnabled({ timeout: 20000 });
  await expect(page.locator(`${HOME} #tdDataStatus`)).toBeHidden();
  covered('Actualizar sin aviso de carga parcial');
  await page.locator(`${HOME} #tdMoreBtn`).click();
  await expect(page.locator(`${HOME} #tdMoreMenu`)).toBeVisible();
  await expect(page.locator(`${HOME} #backupJson`)).toBeVisible();
  await expect(page.locator(`${HOME} #backupCsv`)).toBeVisible();
  await page.locator(`${HOME} #tdMoreBtn`).click();
  await expect(page.locator(`${HOME} #tdMoreMenu`)).toBeHidden();
  covered('Más opciones muestra exportaciones y se cierra (sin descargar datos)');
  for (const [selector, route, label] of [
    ['.tdHeroQuick [data-route="agenda"]', 'agenda', 'Agenda de cabecera'],
    ['.tdAgendaButton', 'agenda', 'Ver todas las tareas'],
    ['.tdTableFooter [data-route="alerts"]', 'alerts', 'Ver avisos'],
  ]) { await visitRoute(page, selector, route); covered(label); }
  const initialCount = await page.locator(`${HOME} .tdActivityRow`).count();
  expect(initialCount).toBeLessThanOrEqual(5);
  const activityToggle = page.locator(`${HOME} #tdActivityMore`);
  if (await activityToggle.isVisible()) {
    await activityToggle.click();
    await expect(activityToggle).toHaveText('Ver menos');
    const expandedCount = await page.locator(`${HOME} .tdActivityRow`).count();
    expect(expandedCount).toBeGreaterThan(initialCount);
    expect(expandedCount).toBeLessThanOrEqual(40);
    await activityToggle.click();
    await expect(page.locator(`${HOME} .tdActivityRow`)).toHaveCount(initialCount);
    covered('Actividad reciente: ampliar y reducir');
  } else unavailable('Ampliar actividad: no hay más de cinco registros');
  const activity = page.locator(`${HOME} .tdActivityRow[data-open]`).filter({ hasNotText: /eliminad[ao]/i }).first();
  if (await activity.count()) await openAndReturn(page, activity, 'Actividad reciente abre ficha');
  else unavailable('Actividad reciente con ficha aún existente');
});

test('Inicio: Avisos y Agenda permanecen exclusivos durante los sondeos y conservan el menú', async ({ page }) => {
  const sidebar = await sidebarGeometry(page);
  await exclusiveRoute(page, 'dashboard', 3000);
  for (const [selector, target] of [
    ['.tdPulse[data-route="alerts-expired"]', 'alerts'],
    ['.tdAgendaButton', 'agenda'],
  ]) {
    await page.locator(`${HOME} ${selector}`).click();
    await exclusiveRoute(page, target, 35000);
    expect(await sidebarGeometry(page), 'Cambiar de pantalla no debe alterar tipografía ni densidad del menú').toEqual(sidebar);
    if (target === 'alerts') await expect(page.locator('#view-alerts .avCounter[data-kind="expired"]')).toHaveClass(/active/);
    covered(`${target}: vista exclusiva y menú estable durante 35 segundos`);
    await dashboard(page);
    await exclusiveRoute(page, 'dashboard', 3000);
  }
});

test('Inicio: mesa de trabajo sin desbordamiento horizontal en tres tamaños de escritorio', async ({ page }) => {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    await expect(page.locator(`${HOME} #dashRefresh`)).toBeVisible();
    await expect(page.locator(`${HOME} #tdWorkSearch`)).toBeVisible();
    await expect(page.locator(`${HOME} #tdPageSize`)).toBeVisible();
    const layout = await page.evaluate(() => {
      const home = document.getElementById('view-dashboard');
      const main = document.querySelector('.referenceWorkspace > main');
      const bounds = home.getBoundingClientRect();
      const cards = ['.tdSalesHero', '.tdPulseGrid', '.tdCockpitGrid', '.tdBusinessDetails'];
      return {
        documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        workspaceOverflow: Math.max(0, main.scrollWidth - main.clientWidth),
        cardsOutside: cards.filter(selector => {
          const card = home.querySelector(selector);
          if (!card) return false;
          const rectangle = card.getBoundingClientRect();
          return rectangle.left < bounds.left - 2 || rectangle.right > bounds.right + 2;
        }),
      };
    });
    expect(layout.documentOverflow).toBeLessThanOrEqual(2);
    expect(layout.workspaceOverflow).toBeLessThanOrEqual(2);
    expect(layout.cardsOutside).toEqual([]);
    covered(`Escritorio ${viewport.width}×${viewport.height}: controles y anchura correctos`);
  }
});
