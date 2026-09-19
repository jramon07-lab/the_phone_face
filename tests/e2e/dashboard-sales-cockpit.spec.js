const { test, expect } = require('@playwright/test');

const HOME = '#view-dashboard.tpfDashPro';
const businessTables = new Set(['records', 'sales_opportunities', 'sales_stages', 'agenda_items', 'whatsapp_jobs', 'crm_month_goals']);
const audit = new WeakMap();
test.setTimeout(180000);
test.use({ screenshot: 'off', trace: 'off', video: 'off', actionTimeout: 10000, navigationTimeout: 30000 });

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
  if (await page.locator(`${HOME} #tdFilterBar`).isVisible()) await page.locator(`${HOME} #tdFilterBar [data-home-filter="priority"]`).click();
  await expect(page.locator(`${HOME} #tdFilterBar`)).toBeHidden();
  while (await page.locator(`${HOME} #tdPrevPage`).isEnabled()) await page.locator(`${HOME} #tdPrevPage`).click();
}

async function visitRoute(page, selector, target, expired = false) {
  await page.locator(`${HOME} ${selector}`).click();
  await expect(page.locator(`#view-${target}`)).toBeVisible({ timeout: 20000 });
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

test('Inicio: indicadores rápidos, cabeceras, pies y paginación filtran correctamente', async ({ page }) => {
  for (const surface of ['.tdPulse', '.tdPipelineHead', '.tdPipelineFoot']) {
    for (const key of ['calls', 'followup', 'processing']) {
      await priorities(page);
      await page.locator(`${HOME} ${surface}[data-home-filter="${key}"]`).click();
      await expect(page.locator(`${HOME} #tdFilterBar`)).toBeVisible();
      await expect(page.locator(`${HOME} .tdPipeline.isActive`)).toHaveCount(1);
      await expect(page.locator(`${HOME} .tdPipeline.isActive .tdPipelineHead[data-home-filter="${key}"]`)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator(`${HOME} #tdPrevPage`)).toBeDisabled();
      covered(`Filtro ${key} desde ${surface}`);
    }
  }
  await priorities(page);
  const next = page.locator(`${HOME} #tdNextPage`);
  if (await next.isEnabled()) {
    const initial = await page.locator(`${HOME} #tdPageInfo`).textContent();
    await next.click();
    await expect(page.locator(`${HOME} #tdPageInfo`)).not.toHaveText(initial);
    await expect(page.locator(`${HOME} #tdPrevPage`)).toBeEnabled();
    await page.locator(`${HOME} #tdPrevPage`).click();
    await expect(page.locator(`${HOME} #tdPageInfo`)).toHaveText(initial);
    covered('Paginación siguiente/anterior conserva prioridades');
  } else {
    await expect(next).toBeDisabled();
    unavailable('Paginación siguiente: hay una sola página');
  }
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

test('Inicio: tareas, siguiente acción, columnas y próximos seguimientos abren registros', async ({ page }) => {
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
    ['#dashContactToday .tdPipelineRow[data-type="opportunity"]', 'Oportunidad de columnas'],
    ['#dashContactToday .tdPipelineRow[data-type="task"]', 'Llamada de columnas'],
    ['#dashPriorityFollowups [data-open]', 'Próximo seguimiento'],
  ]) {
    const item = page.locator(`${HOME} ${selector}`).first();
    if (await item.count()) await openAndReturn(page, item, label);
    else unavailable(label);
  }
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
  await page.locator(`${HOME} #tdActivityMore`).click();
  await expect(page.locator(`${HOME} #tdActivityMore`)).toHaveText('Ver menos');
  const expandedCount = await page.locator(`${HOME} .tdActivityRow`).count();
  expect(expandedCount).toBeGreaterThanOrEqual(initialCount);
  expect(expandedCount).toBeLessThanOrEqual(24);
  await page.locator(`${HOME} #tdActivityMore`).click();
  await expect(page.locator(`${HOME} .tdActivityRow`)).toHaveCount(initialCount);
  covered('Actividad reciente: ampliar y reducir');
  const activity = page.locator(`${HOME} .tdActivityRow[data-open]`).filter({ hasNotText: /eliminad[ao]/i }).first();
  if (await activity.count()) await openAndReturn(page, activity, 'Actividad reciente abre ficha');
  else unavailable('Actividad reciente con ficha aún existente');
});
