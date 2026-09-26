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
  if (url.pathname.startsWith('/api/')) {
    const endpoint = url.pathname.split('/').pop().replace(/[^a-z0-9_-]/gi, '');
    const action = url.searchParams.get('action') || '';
    // Only fixed operation names: never log phones, IDs, payloads or tokens.
    return `api:${endpoint}${GREEN_READ.has(action) ? ':' + action : ''}`;
  }
  return 'external-request';
}

async function installReadOnlyGuard(context, page, origin) {
  const report = { blockedWrites: 0, blockedByEndpoint: {}, unknownReads: new Set(), failedReads: new Set(), pageErrors: 0, greenAuthorized: false, googleConnected: false, telegramConfigured: false, pendingReads: [] };
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
    if (kind === 'read') report.pendingReads.push(request);
    const headers = { ...request.headers() };
    delete headers['x-vercel-protection-bypass'];
    delete headers['x-vercel-set-bypass-cookie'];
    if (new URL(request.url()).origin === origin) headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    await route.continue({ headers });
  });
  page.on('pageerror', error => { report.pageErrors += 1; const frames=String(error.stack||'').split('\n').slice(1,4).map(line=>line.replace(/https?:\/\/[^\s)]+/g,url=>{try{const u=new URL(url);return u.pathname.replace(/\?.*/, '')}catch(_){return '[source]'}})); console.log('BROWSER_ERROR_LOCATION',JSON.stringify({name:error.name,frames})); });
  page.on('requestfinished', request => { report.pendingReads = report.pendingReads.filter(item => item !== request); });
  page.on('requestfailed', request => {
    report.pendingReads = report.pendingReads.filter(item => item !== request);
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
    pendingReads: report.pendingReads.map(safeLabel),
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
        if(view==='sales'){
          const more=page.locator('#salesMoreMenu');
          await more.locator('summary').click();
          await expect(more).toHaveAttribute('open','');
          await expect(more.getByRole('button',{name:'Personalizar panel'})).toBeVisible();
          await more.locator('summary').click();
          await expect(more).not.toHaveAttribute('open','');
          const filters=page.locator('#ofSalesFilters .ofMoreFilters');
          await filters.locator('summary').click();
          await expect(filters).toHaveAttribute('open','');
          await expect(filters.locator('[data-of-filter="all"]')).toBeVisible();
          await filters.locator('[data-of-filter="all"]').click();
          await expect(page.locator('#ofSalesFilters [data-of-filter="all"]')).toHaveAttribute('aria-pressed','true');
          await more.locator('summary').click();
          await page.locator('#tpfMonthlyCloseBtn').click();
          await expect(page.locator('#tpfMonthlyClose')).toBeVisible();
          for(const size of [{width:1366,height:768},{width:1280,height:720}]){
            await page.setViewportSize(size);
            for(const panel of ['sales','pending']){
              await page.locator('[data-monthly-view="'+panel+'"]').click();
              const geometry=await page.locator('#tpfMonthlyClose').evaluate(root=>{
                const card=root.querySelector('.tpfMonthlyCard').getBoundingClientRect();
                const section=root.querySelector('.tpfMonthlyView.active');
                const nodes=[section,section.querySelector('.tpfMonthlySectionHead'),section.querySelector('table'),...section.querySelectorAll('th'),root.querySelector('.tpfMonthlyFoot')];
                return nodes.every(el=>{const r=el.getBoundingClientRect();return r.left>=card.left&&r.right<=card.right+1});
              });
              expect(geometry,'Monthly close columns and controls must fit the dialog').toBe(true);
            }
          }
          await page.locator('#tpfMonthlyClose [data-close]').first().click();

        }

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
    // Read-only diagnosis of the newly created contact reported as unverified.
    const contactCheck = await page.evaluate(async () => {
      const result = await sb.from('records').select('id,data').eq('id','9bbc4eb2-4eac-40de-8ead-5c7c306ccc6a').single();
      if(result.error) throw Error('No se pudo leer la ficha de diagnóstico');
      const data=result.data.data, binding=data.TPF_GOOGLE_CONTACT;
      const person=await googleApi(binding.resource_name+'?personFields=names,nicknames,phoneNumbers');
      const phone=v=>String(v||'').replace(/\D/g,'').slice(-9);
      return { googleExists:person.resourceName===binding.resource_name,
        nameMatches:(person.names||[]).some(n=>n.givenName===data.NOMBRE&&n.familyName===data.APELLIDOS),
        phoneMatches:(person.phoneNumbers||[]).some(n=>phone(n.canonicalForm||n.value)===phone(data['TELÉFONO'])),
        verificationStored:!!data.TPF_CONTACT_VERIFIED };
    });
    console.log('REPORTED_CONTACT_READONLY_CHECK',JSON.stringify(contactCheck));
    expect(contactCheck.googleExists).toBe(true);
    expect(contactCheck.nameMatches).toBe(true);
    expect(contactCheck.phoneMatches).toBe(true);
    // Presentation-only navigation: existing inputs keep their identity and values.
    const telegramBefore = await page.locator('#notifyTelegramChatId').inputValue();
    await page.locator('#view-settings-notifications-tab').click();
    await expect(page.locator('#notifySave')).toBeVisible();
    await expect(page.locator('#agendaGlobalSave')).toBeVisible();
    await expect(card).toBeHidden();
    await page.locator('#view-settings-search-tab').click();
    await expect(page.locator('#settingsSearchSave')).toBeVisible();
    await page.locator('#view-settings-connections-tab').click();
    await expect(card).toBeVisible();
    expect(await page.locator('#notifyTelegramChatId').inputValue()).toBe(telegramBefore);
    // The demo account has no administrator permission. Do not elevate it.
    await expect(page.locator('#sideRole')).toHaveText('Usuario');
    await expect(page.locator('.nav[data-view="system"]').first()).toBeHidden();
    await page.setViewportSize({width:700,height:900});
    await expect.poll(() => page.locator('#view-settings .tpfAdminTabs').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await expect.poll(() => report.pendingReads.length, { timeout: 20000 }).toBe(0);
    assertReadHealth(report);
  } finally { reportScope(report, 'PC'); }
});

// Isolated UI fixture: no login, real data or administrative permission changes.
test('Apartados administrativos: tarjetas dinámicas, teclado y controles conservados (datos sintéticos)', async ({page, context}) => {
  const fs=require('node:fs'), path=require('node:path');
  await context.route('**/*', route=>route.abort());
  await page.setContent(`<section id="view-settings"><div class="card"><h2>Configuración</h2></div><div class="card" id="fixtureConnection"><input id="fixtureValue" value="sin cambios"></div><div class="card searchConfigCard">Buscador</div><div class="card"><button id="notifySave">Guardar</button></div></section><section id="view-system"><div class="card systemStatusCard">Cabecera</div><div class="card" id="tpfOperationalChecks">Resumen</div><div class="card" id="tpfModuleStatusCard">Diagnóstico</div><div class="card" id="tpfIncidentRegistry">Incidencias</div><div class="card" id="tpfFollowupRegistry">Seguimientos</div><div class="card" id="tpfDriveBackupCard">Copias</div></section>`);
  await page.addStyleTag({content:fs.readFileSync(path.join(__dirname,'../../assets/crm-reference.css'),'utf8')});
  await page.evaluate(()=>{window.originalControl=document.getElementById('fixtureValue');window.savedClicks=0;document.getElementById('notifySave').onclick=()=>window.savedClicks++});
  await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../../js/modules/admin-sections.js'),'utf8')});
  await page.locator('#view-settings-notifications-tab').click();
  await page.locator('#notifySave').click();
  expect(await page.evaluate(()=>window.savedClicks)).toBe(1);
  expect(await page.evaluate(()=>window.originalControl===document.getElementById('fixtureValue'))).toBe(true);
  await expect(page.locator('#fixtureValue')).toHaveValue('sin cambios');
  for(const [tab,target] of [['incidents','tpfIncidentRegistry'],['followups','tpfFollowupRegistry'],['backups','tpfDriveBackupCard'],['advanced','tpfModuleStatusCard'],['overview','tpfOperationalChecks']]){
    await page.locator('#view-system-'+tab+'-tab').click();
    await expect(page.locator('#'+target)).toBeVisible();
    expect(await page.locator('#'+target).count()).toBe(1);
  }
  await expect(page.locator('#tpfModuleStatusCard')).toBeHidden();
  await page.evaluate(()=>{const card=document.createElement('div');card.id='tpfMaintenanceCard';card.className='card';card.textContent='Mantenimiento';document.getElementById('tpfOperationalChecks').after(card)});
  await expect(page.locator('#view-system-advanced #tpfMaintenanceCard')).toHaveCount(1);
  await page.locator('#view-system-overview-tab').focus();
  await page.keyboard.press('End');
  await expect(page.locator('#view-system-advanced-tab')).toBeFocused();
  await expect(page.locator('#tpfMaintenanceCard')).toBeVisible();
  await page.setViewportSize({width:700,height:900});
  await expect.poll(()=>page.locator('#view-system .tpfAdminTabs').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
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
      await expect.poll(() => report.pendingReads.length, { timeout: 20000 }).toBe(0);
      assertReadHealth(report);
    } finally { reportScope(report, 'móvil'); }
  });
});

// Exercise the real browser MutationObserver, including its own DOM writes.
test('Panel de ventas queda en reposo tras decorar y cambiar filtros', async ({page,context})=>{
  const fs=require('node:fs');await context.route('**/*',route=>route.abort());
  await page.setContent('<section id="view-sales"><button id="salesOptionsToggle"></button><div id="salesOptionsPanel" class="hidden"></div><div id="tpfDateStatus"></div><div id="salesBoard"></div></section>');
  await page.evaluate(()=>{window.TPFModules={register:(_,module)=>window.fixtureModule=module};window.salesCache={opportunities:[]};window.fixtureChanges=0;new MutationObserver(()=>window.fixtureChanges++).observe(document.getElementById('view-sales'),{childList:true,subtree:true});});
  await page.addScriptTag({content:fs.readFileSync('js/modules/contacts-sales.js','utf8')});
  await page.evaluate(()=>window.fixtureModule.install());
  await page.waitForTimeout(300);
  const settled=await page.evaluate(()=>window.fixtureChanges);
  await page.waitForTimeout(500);
  expect(await page.evaluate(()=>window.fixtureChanges)).toBe(settled);
  await page.evaluate(()=>document.getElementById('view-sales').classList.add('hidden'));
  await page.waitForTimeout(100);
  await page.evaluate(()=>document.getElementById('view-sales').classList.remove('hidden'));
  await page.waitForTimeout(300);
  const resumed=await page.evaluate(()=>window.fixtureChanges);
  await page.waitForTimeout(300);
  expect(await page.evaluate(()=>window.fixtureChanges)).toBe(resumed);
});

test('Seguimientos: filtros y acciones conservan la etapa (datos sintéticos)',async({page,context})=>{
 const fs=require('node:fs');await context.route('**/*',route=>route.abort());
 await page.setContent('<section id="view-sales"><div id="salesScroll"></div></section>');
 await page.evaluate(()=>{window.TPFModules={register:(_,m)=>window.followModule=m};window.actionCalls=[];window.TPFControlWhatsappOffer=async(id,action)=>window.actionCalls.push({id,action});});
 await page.addScriptTag({content:fs.readFileSync('js/modules/offer-followup-ui.js','utf8')});
 await page.evaluate(()=>{const api=window.TPFOfferFollowup,F=api.state;F.loaded=true;F.at=Date.now();F.byOpportunity=new Map([['a',[{id:'offer-a',status:'following',sent_at:'2026-09-20T10:00:00Z'}]],['b',[{id:'offer-b',status:'paused',paused_at:'2026-09-24T10:00:00Z'}]]]);window.fixtureRows=[{id:'a',stage:'Seguimiento'},{id:'b',stage:'Seguimiento'}];window.renderSales=()=>{api.salesControls(window.fixtureRows);document.getElementById('salesScroll').innerHTML=api.filterRows(window.fixtureRows).map(x=>'<article data-row="'+x.id+'"><b>'+x.stage+'</b>'+api.html(x.id,true)+'</article>').join('')};window.followModule.install();window.renderSales()});
 await page.locator('.ofMoreFilters summary').click();
 await page.evaluate(()=>{window.originalFilterMenu=document.querySelector('.ofMoreFilters');window.renderSales()});
 await expect(page.locator('.ofMoreFilters')).toHaveAttribute('open','');
 expect(await page.evaluate(()=>window.originalFilterMenu===document.querySelector('.ofMoreFilters'))).toBe(true);
 await page.evaluate(()=>{window.fixtureRows.push({id:'c',stage:'Seguimiento'});window.renderSales()});
 await expect(page.locator('.ofMoreFilters')).toHaveAttribute('open','');
 await page.locator('[data-of-filter="all"]').click();
 await expect(page.locator('.ofMoreFilters')).not.toHaveAttribute('open','');
 await page.locator('[data-of-filter="paused"]').click();await expect(page.locator('article')).toHaveCount(1);await expect(page.locator('article')).toHaveAttribute('data-row','b');
 await page.locator('[data-of-manage]').click();await page.getByRole('button',{name:'Reanudar'}).click();expect(await page.evaluate(()=>window.actionCalls)).toEqual([{id:'offer-b',action:'resume'}]);
 expect(await page.evaluate(()=>window.fixtureRows.every(x=>x.stage==='Seguimiento'))).toBe(true);
 await page.locator('[data-of-filter="active"]').click();await expect(page.locator('article')).toHaveAttribute('data-row','a');await page.locator('[data-of-manage]').click();await page.getByRole('button',{name:'Pausar',exact:false}).click();
 expect(await page.evaluate(()=>window.actionCalls.length)).toBe(2);await expect(page.locator('article .ofBadge')).toHaveText('Sin envíos pendientes');
});

test('Plan compartido: pausa, aviso interno y fecha Madrid sin envío (datos sintéticos)',async({page,context})=>{
 const fs=require('node:fs');await context.route('**/*',route=>route.abort());await page.setContent('<section id="view-sales"></section>');
 await page.evaluate(()=>{window.TPFModules={register:(_,m)=>m.install()};window.saved=[];window.sb={rpc:async(name,args)=>{saved.push({name,args});return{data:{ok:true}}}}});
 await page.addScriptTag({content:fs.readFileSync('js/modules/offer-work-plan.js','utf8')});
 await page.addScriptTag({content:fs.readFileSync('js/modules/offer-followup-ui.js','utf8')});
 await page.evaluate(()=>{const F=TPFOfferFollowup.state;F.loaded=true;F.at=Date.now();window.addEventListener('tpf:sales-updated',e=>e.stopImmediatePropagation(),true);F.offers=[{id:'example',status:'following',updated_at:'2026-09-26T10:00:00Z'}];TPFOfferFollowup.manage('example')});
 await expect(page.locator('[name=reason]')).toBeHidden();await page.getByRole('button',{name:'Pausar',exact:true}).click();await page.locator('[name=reason]').fill('Cliente necesita pensarlo');await page.locator('[name=at]').fill('2026-09-28T10:00');await page.locator('[name=remind]').check();
 await page.getByRole('button',{name:'Guardar pausa',exact:true}).click();await expect(page.locator('dialog')).toHaveCount(0);
 const calls=await page.evaluate(()=>saved);expect(calls).toHaveLength(1);expect(calls[0].name).toBe('crm_save_offer_work_plan');expect(calls[0].args.p_at).toBe('2026-09-28T08:00:00.000Z');expect(calls[0].args.p_pause).toBe(true);expect(calls[0].args.p_next_action).toBe('Revisar oferta');expect(calls[0].args.p_remind).toBe(true);
 expect(await page.evaluate(()=>TPFOfferWorkPlan.madrid('2026-12-28T10:00'))).toBe('2026-12-28T09:00:00.000Z');
});
