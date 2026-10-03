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
  'wa_get_messages', 'wa_list_templates', 'crm_whatsapp_internal_reads',
  'crm_list_monthly_reviews', 'crm_router_return_preview', 'crm_direct_sale_day_one_preview',
  'crm_installation_preview','crm_installation_settings','crm_installations_list','crm_operator_communication_templates'
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
    if (url.pathname === '/api/whatsapp-auto-replies' && method === 'GET') return 'read';
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

test('PC: textos de devolución compartidos en producción, solo lectura',async({context,page})=>{
  test.setTimeout(60000);
  const origin=crmOrigin(process.env.VERCEL_PREVIEW_URL||process.env.PLAYWRIGHT_BASE_URL),report=await installReadOnlyGuard(context,page,origin);
  try{
    await page.goto('/',{waitUntil:'domcontentloaded'});
    await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);await page.locator('#signin').click();
    await expect(page.locator('#app')).toBeVisible({timeout:35000});
    await page.locator('.nav[data-view="settings"]').first().click();await page.locator('#view-settings-router-texts-tab').click();
    const card=page.locator('#tpfRouterSettingsCard');await expect(card.locator('[data-router-text]')).toBeEnabled({timeout:15000});
    await expect(card.locator('[data-preview]')).toContainText('Vodafone');
    await card.locator('[data-search]').fill('masmovil');await card.locator('[data-operator="MásMóvil"]').click();
    await expect(card.locator('[data-title]')).toHaveText('MásMóvil');await expect(card.locator('[data-preview]')).toContainText('MásMóvil');
    for(const width of [1366,700]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
    await expect.poll(()=>report.pendingReads.length,{timeout:20000}).toBe(0);assertReadHealth(report);
  }finally{reportScope(report,'PC textos de devolución');}
});

test('PC: demo, nueve pantallas y conexión real de WhatsApp y Google, solo lectura', async ({ context, page }) => {
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
    for (const view of ['dashboard', 'database', 'sales', 'reviews', 'agenda', 'whatsapplive', 'automations', 'labels', 'settings']) {
      await test.step(`Abrir ${view}`, async () => {
        const nav = page.locator(`.nav[data-view="${view}"]`).first();
        await expect(nav).toBeVisible();
        const navigationStarted=Date.now();
        await nav.click();
        await expect(page.locator(`#view-${view}`)).toBeVisible();
        console.log("CRM_VIEW_VISIBLE_MS",JSON.stringify({view,elapsedMs:Date.now()-navigationStarted}));
        // A visible section alone is insufficient: the normal navigation must
        // finish and contain rendered content while the real reads stay active.
        await expect.poll(() => page.locator(`#view-${view}`).evaluate(el => el.childElementCount > 0)).toBe(true);
        const searchSelector={dashboard:'#tdWorkSearch',sales:'#salesSearch',agenda:'#agendaSearch',labels:'#lmSearch'}[view];
        if(searchSelector){
          const input=page.locator(searchSelector);await expect(input).toBeVisible();
          await page.evaluate(()=>{window.__searchLongTasks=[];window.__searchPerf=new PerformanceObserver(list=>{for(const entry of list.getEntries())window.__searchLongTasks.push(entry.duration)});window.__searchPerf.observe({type:'longtask',buffered:false});});
          const started=Date.now();await input.pressSequentially('zzzz rendimiento teclado');
          await expect(input).toHaveValue('zzzz rendimiento teclado');
          // Includes the debounce window. Never submit or send the synthetic text.
          await page.waitForTimeout(250);
          const timing=await page.evaluate(()=>{window.__searchPerf.disconnect();return {longTasks:window.__searchLongTasks.length,longestMs:Math.round(Math.max(0,...window.__searchLongTasks))}});
          console.log('CRM_SEARCH_TYPING',JSON.stringify({view,elapsedMs:Date.now()-started,...timing}));
          await input.fill('');
        }
        if(view==='database'){
          const search=page.locator('#tpfContactsSearch');await expect(search).toBeVisible();
          await page.evaluate(()=>{window.__typingTasks=[];window.__typingObserver=new PerformanceObserver(list=>{for(const e of list.getEntries())window.__typingTasks.push(e.duration)});window.__typingObserver.observe({type:'longtask',buffered:false});});
          const typingStarted=Date.now();
          await search.pressSequentially('zzzz rendimiento teclado');
          await expect(search).toHaveValue('zzzz rendimiento teclado');
          await expect(page.locator('#tpfContactsResultCount')).toHaveText('0 resultados');
          const typingTasks=await page.evaluate(()=>{window.__typingObserver.disconnect();return {count:window.__typingTasks.length,longestMs:Math.round(Math.max(0,...window.__typingTasks))};});
          console.log('CONTACT_SEARCH_TYPING_PERFORMANCE',JSON.stringify({...typingTasks,elapsedMs:Date.now()-typingStarted}));
          await search.fill('');

          await page.locator('#tpfContactsFiltersToggle').click();
          const filters=page.locator('#tpfContactsFilters');
          await expect(filters).toHaveClass(/open/);
          await filters.getByRole('button',{name:'Solo las seleccionadas',exact:true}).click();
          await expect(filters.locator('[data-mode="exact"]')).toHaveAttribute('aria-pressed','true');
          await expect(page.locator('#tpfFilterHint')).toContainText('ninguna más');
          await page.locator('#tpfApplyFilters').click();
          await expect(page.locator('#tpfFilterError')).toContainText('Selecciona al menos una etiqueta');
          await expect(filters).toHaveClass(/open/);
          await page.locator('#tpfContactsFiltersClose').click();
          await expect(filters).not.toHaveClass(/open/);
        }
        if(view==='whatsapplive'){
          await expect(page.locator('#waSideTabs')).toHaveCount(1);
          await expect(page.locator('[data-wa-tab="archived"]')).toBeVisible();
          await expect(page.locator('[data-wa-tab="automatic"]')).toBeVisible();
          await expect(page.locator('[data-wa-tab="processing"]')).toBeVisible();
          await expect(page.locator('[data-wa-tab="declined"]')).toBeVisible();
          await expect(page.locator('#waCleanTools [data-wa-tab="contacts"]')).toHaveCount(1);
          await page.locator('#waCleanTools>summary').click();
          await page.locator('#waCleanTools [data-wa-tab="contacts"]').click();
          await expect.poll(()=>page.evaluate(()=>waLiveState.filter)).toBe('contacts');
          await expect(page.locator('#waCleanTools')).not.toHaveAttribute('open','');
          const originalViewport=page.viewportSize();
          for(const width of [1280,1366,1920,2560]){
            await page.setViewportSize({width,height:768});
            await expect.poll(async()=>{const tabs=await page.locator('#view-whatsapplive .waLivePage>.waTabs').evaluate(el=>{
              const buttons=[...el.querySelectorAll(':scope>button[data-wa-tab]')].filter(b=>b.getBoundingClientRect().width);
              return {count:buttons.length,tops:buttons.map(b=>Math.round(b.getBoundingClientRect().top)),accessible:el.scrollWidth<=el.clientWidth+1||['auto','scroll'].includes(getComputedStyle(el).overflowX)};
            });
            return {count:tabs.count,lines:new Set(tabs.tops).size,accessible:tabs.accessible};},{message:'Las 13 pestañas conservan una fila y acceso por desplazamiento cuando sea necesario',timeout:5000}).toEqual({count:13,lines:1,accessible:true});
            const keys=['unanswered','waiting','reviews','automatic','processing','aftercare','declined','all','groups','unread','favorites','archived','snoozed'];
            for(const key of keys){
              const button=page.locator('#view-whatsapplive .waLivePage>.waTabs>button[data-wa-tab="'+key+'"]');
              await expect(button).toHaveCount(1);
              // Live badge counts can resize the tab after the initial scroll.
              await expect.poll(async()=>{await button.scrollIntoViewIfNeeded();return button.evaluate(b=>{const r=b.getBoundingClientRect(),p=b.parentElement.getBoundingClientRect();return r.left>=p.left-1&&r.right<=p.right+1&&r.top>=p.top-1&&r.bottom<=p.bottom+1});},{message:'Pestaña accesible: '+key,timeout:5000}).toBe(true);
            }
            await page.locator('#view-whatsapplive .waLivePage>.waTabs>button[data-wa-tab="all"]').click();
          }
          await page.setViewportSize(originalViewport);
          const row=page.locator('#waLiveChats .waChatRow').first();
          if(await row.count()){
            await row.click();
            await expect(page.locator('#waChatActive')).toBeVisible();
            await expect(page.locator('#waContactCard')).not.toHaveAttribute('aria-busy','true',{timeout:15000});
            if(await page.locator('#waContactCard').isVisible()){
              for(const tab of ['work','history','client']){
                await page.locator('[data-wa-side-tab="'+tab+'"]').click();
                await expect(page.locator('#waSidePanel-'+tab)).toBeVisible();
              }
              // The first live chat can be unlinked or a group. Its card still
              // exists, but review/offer actions require a linked contact.
              if(await page.evaluate(()=>!!waLiveState.contact?.id)){
                await expect(page.locator('#waCleanReview')).toBeVisible();
                await expect(page.locator('#waSideNewOffer')).toBeVisible();
              }else await expect(page.locator('#waCleanReview')).toBeHidden();
            }
          }
        }
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
          await expect(page.locator('#tpfMonthlyClose [data-monthly-view="sales"]')).toBeVisible({timeout:20000});
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
    await page.locator('#view-settings-router-texts-tab').click();
    await expect(page.locator('#tpfRouterSettingsCard [data-router-text]')).toBeEnabled();
    await expect(page.locator('#tpfRouterSettingsCard [data-preview]')).toContainText('Vodafone');
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

test('Ficha: redimensionar textos no produce bucles ResizeObserver (datos sintéticos)', async ({page,context}) => {
  const fs=require('node:fs'),path=require('node:path'),errors=[];
  await context.route('**/*',route=>route.abort());
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1366,height:900});
  await page.setContent(`<body class="tpfUnified"><div id="contactModal" class="tpfContactDesktop"><div class="contactProfile"><div class="cpIdentity"></div><div class="cpColumns"><div class="cpLeft"><div class="cpData"><label for="contactObservations">Observaciones</label><textarea id="contactObservations"></textarea><label for="contactNotes">Notas</label><textarea id="contactNotes" readonly></textarea></div></div><div class="cpCenter"></div><div class="cpRight"></div></div></div></div></body>`);
  for(const file of ['contact-desktop.css','crm-reference.css'])await page.addStyleTag({content:fs.readFileSync(path.join(__dirname,'../../assets',file),'utf8')});
  await page.evaluate(()=>{for(const id of ['contactObservations','contactNotes'])document.getElementById(id).value='Texto sintético para comprobar el ajuste de altura. '.repeat(12);});
  await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../../js/modules/contact-desktop-layout.js'),'utf8')});
  const settle=()=>page.evaluate(()=>new Promise(resolve=>{let frames=12;function next(){if(--frames===0)resolve();else requestAnimationFrame(next);}requestAnimationFrame(next);}));
  for(const width of [330,280,390,310,360]){
    await page.evaluate(width=>{document.querySelector('.cpData').style.setProperty('width',width+'px','important');},width);
    await settle();
    const height=await page.locator('#contactObservations').evaluate(el=>el.getBoundingClientRect().height);
    expect(height).toBeGreaterThan(36);expect(height).toBeLessThanOrEqual(160);
    await settle();
    expect(await page.locator('#contactObservations').evaluate(el=>el.getBoundingClientRect().height)).toBe(height);
  }
  expect(errors).toEqual([]);
});

async function continueReadOnlyPartyPreview(page,destination){
  const party=page.locator('dialog:has([data-holder])');
  await expect.poll(async()=>await destination.isVisible()||await party.isVisible(),{timeout:15000}).toBe(true);
  if(await party.isVisible()){
    for(const field of ['holder','manager','recipient']){
      const select=party.locator('[data-'+field+']');
      const value=await select.evaluate(el=>el.value||[...el.options].find(x=>x.value)?.value||'');
      expect(value,'La vista previa debe ofrecer una persona válida para '+field).toBeTruthy();
      await select.selectOption(value);
    }
    await party.locator('[data-continue]').click();
  }
  await expect(destination).toBeVisible({timeout:15000});
}

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
      await expect.poll(()=>page.evaluate(()=>typeof window.TPFRouterReturn?.choose)).toBe('function');
      for (const view of ['home', 'contacts', 'opportunities', 'whatsapp']) {
        await page.locator(`[data-mobile-route="${view}"]`).click();
        await expect(page.locator(`[data-mobile-route="${view}"]`)).toHaveClass(/active/);
        await expect(page.locator('#mobileView')).toBeVisible();
        await expect.poll(() => page.locator('#mobileView').evaluate(el => el.childElementCount > 0)).toBe(true);
      }
      await expect.poll(() => report.greenAuthorized, { timeout: 20000 }).toBe(true);
      await expect(page.locator('[data-action="wa-auto-settings"]')).toBeVisible();
      await page.locator('[data-action="wa-auto-settings"]').click();
      await expect(page.locator('#waAutoReplyDialog textarea')).toBeVisible({timeout:15000});
      await page.locator('#waAutoReplyDialog [data-close]').click();
      await page.locator('[data-mobile-route="contacts"]').click();
      await expect(page.locator('#mobileView .m-contact-card').first()).toBeVisible({timeout:15000});
      await page.locator('#mobileView .m-contact-card').first().click();
      await page.locator('[data-action="contact-compose"]').click();
      await expect(page.locator('.m-contact-compose textarea')).toBeVisible();
      await expect(page.locator('.m-contact-compose [data-send]')).toBeVisible();
      await page.locator('.m-contact-compose [data-schedule]').click();
      await expect(page.locator('#tpfS3save')).toBeVisible();
      await page.locator('#tpfSched3 [data-close]').first().click();
      await expect(page.locator('[data-action="contact-offer"]')).toBeVisible();
      await page.locator('[data-action="contact-offer"]').click();
      await continueReadOnlyPartyPreview(page,page.locator('#opOfferModal:not(.hidden) #opPreview'));
      await page.locator('#opOfferModal .opClose').click();
      await page.locator('[data-action="contact-direct"]').click();
      await continueReadOnlyPartyPreview(page,page.locator('#directSalePrice'));
      await page.locator('#directSaleModal [data-direct-close]').first().click();
      await page.locator('#mobileMenu').click();
      await page.locator('[data-route="router-texts"]').click();
      await expect(page.locator('#mobileRouterSettings [data-router-text]')).toBeEnabled();
      await expect(page.locator('#mobileRouterSettings [data-preview]')).toContainText('Vodafone');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      await page.locator('[data-mobile-route="whatsapp"]').click();
      await expect(page.locator('[data-action="wa-auto-settings"]')).toBeVisible();
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

test('WhatsApp: búsqueda entre bandejas y lista estable al escribir y refrescar',async({page,context})=>{
 const fs=require('node:fs');await context.route('**/*',route=>route.abort());
 await page.setContent('<style>#waLiveChats{height:300px;overflow:auto}.waChatRow{height:80px}.waChatMeta{height:20px}</style><input id="waLiveSearch"><textarea id="waComposerText"></textarea><div id="waLiveChats"></div>');
 await page.evaluate(()=>{
  window.fixtureModules={};window.TPFModules={register:(name,module)=>fixtureModules[name]=module};
  window.waLiveState={filter:'all',selected:null,avatars:{},avatarPending:{},livePreview:{},chats:Array.from({length:35},(_,i)=>({id:`34600000${String(i).padStart(3,'0')}@c.us`,name:'Persona '+i}))};
  waLiveState.chats.push({id:'grupo@g.us',name:'Objetivo grupo',timestamp:1});
  window.renderWhatsAppChats=()=>{};window.hydrateWaAvatars=()=>{};window.waApi=async()=>({urlAvatar:''});
  window.waMeta=()=>({});window.waUnreadCount=()=>0;window.waChatServerUnread=()=>0;window.waIsUnanswered=()=>false;
  window.waNormalizePhone=id=>id;window.waTime=()=>'';window.esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;');
  window.waApplyAvatar=()=>{};
 });
 for(const file of ['whatsapp-performance-max','whatsapp-five-fixes']){
  await page.addScriptTag({content:fs.readFileSync('js/modules/'+file+'.js','utf8')});
  await page.evaluate(name=>fixtureModules[name].install(),file);
 }
 await page.addScriptTag({content:fs.readFileSync('js/modules/whatsapp-automation-inbox.js','utf8').replace('window.TPFAutomationInbox={','window.__fixtureWrap=wrapRenderer;window.TPFAutomationInbox={')});
 await page.evaluate(()=>window.__fixtureWrap());
 const result=await page.evaluate(async()=>{
  const search=document.getElementById('waLiveSearch'),box=document.getElementById('waLiveChats');
  const outcomes=[];
  search.value='Objetivo';
  for(const filter of ['unanswered','waiting','automatic','all','groups','archived','snoozed']){
   waLiveState.filter=filter;renderWhatsAppChats();await Promise.resolve();
   outcomes.push(box.querySelectorAll('.waChatRow').length===1&&box.textContent.includes('Objetivo grupo')&&waLiveState.filter===filter);
  }
  search.value='';waLiveState.filter='all';renderWhatsAppChats();await Promise.resolve();
  box.scrollTop=600;const top=box.scrollTop,first=box.firstElementChild;
  const composer=document.getElementById('waComposerText');composer.focus();composer.value='Borrador sin enviar';composer.dispatchEvent(new Event('input'));
  for(let i=0;i<5;i++){renderWhatsAppChats();await Promise.resolve();}
  const stable=box.firstElementChild===first&&box.scrollTop===top&&composer.value==='Borrador sin enviar';
  const bounds=box.getBoundingClientRect(),anchor=[...box.querySelectorAll('.waChatRow')].find(n=>n.getBoundingClientRect().bottom>bounds.top),id=anchor.dataset.waChatId,y=anchor.getBoundingClientRect().top;
  waLiveState.chats.unshift({id:'nuevo@g.us',name:'Nuevo entrante'});renderWhatsAppChats();await Promise.resolve();await Promise.resolve();await Promise.resolve();
  const next=[...box.querySelectorAll('.waChatRow')].find(n=>n.dataset.waChatId===id);
  return {global:outcomes.every(Boolean),stable,anchor:Math.abs(next.getBoundingClientRect().top-y)<2};
 });
 expect(result).toEqual({global:true,stable:true,anchor:true});
 const phases=await page.evaluate(async()=>{
   const id='34600123456@c.us',chat={id,name:'Cliente de prueba',_lastMessage:{timestamp:100,direction:'in'}};
   window.waMessageTimestamp=m=>m?.timestamp||0;window.waMessageDirection=m=>m?.direction;
   waLiveState.chats=[chat];document.getElementById('waLiveSearch').value='';
   TPFAutomationInbox.ingestBusiness([{id:'offer',opportunity_id:'new',status:'following',snapshot:{recipient_phone:'34600123456'}}],[{id:'old',phone:'600123456',stage_id:'this-month'},{id:'new',phone:'600123456'}]);
   waLiveState.filter='automatic';renderWhatsAppChats();await Promise.resolve();
   const box=document.getElementById('waLiveChats'),both=box.textContent.includes('Pendiente')&&box.textContent.includes('Oferta en seguimiento');
   waLiveState.filter='unanswered';renderWhatsAppChats();await Promise.resolve();const pending=box.querySelectorAll('.waChatRow').length===1;
   TPFAutomationInbox.ingestBusiness([{id:'offer',opportunity_id:'new',status:'processed',snapshot:{recipient_phone:'34600123456'}}],[{id:'old',phone:'600123456',stage_id:'this-month'},{id:'new',phone:'600123456'}]);
   chat._lastMessage={timestamp:110,direction:'out'};waLiveState.filter='processing';renderWhatsAppChats();await Promise.resolve();
   const processing=box.textContent.includes('En tramitación')&&!box.textContent.includes('Pendiente');
   waLiveState.filter='waiting';renderWhatsAppChats();await Promise.resolve();
   const notWaiting=box.querySelectorAll('.waChatRow').length===0;
   const now=Date.now(),plan={id:'offer',opportunity_id:'new',status:'following',snapshot:{recipient_phone:'34600123456'},updated_at:new Date(now-60000).toISOString(),next_action:'Revisar documento',next_action_at:new Date(now+3600000).toISOString(),plan_task_id:'task',plan_task:{status:'pending',starts_at:new Date(now+3600000).toISOString(),title:'Revisar documento'}};
   TPFAutomationInbox.ingestBusiness([plan],[]);waLiveState.filter='snoozed';renderWhatsAppChats();await Promise.resolve();
   const planned=box.querySelectorAll('.waChatRow').length===1&&box.textContent.includes('Próxima acción: Revisar documento');
   plan.plan_task.starts_at=new Date(now-1000).toISOString();TPFAutomationInbox.ingestBusiness([plan],[]);waLiveState.filter='unanswered';renderWhatsAppChats();await Promise.resolve();
   const due=box.querySelectorAll('.waChatRow').length===1&&box.textContent.includes('Próxima acción vencida');
   plan.plan_task.status='completed';TPFAutomationInbox.ingestBusiness([plan],[]);renderWhatsAppChats();await Promise.resolve();
   const completed=box.querySelectorAll('.waChatRow').length===0;
   TPFAutomationInbox.ingestJobs([{context:{phone:'34600123456'},action_config:{__delivery_receipt:{idMessage:'auto-test'}}}]);
   chat._lastIncomingAt=100;chat._lastMessage={timestamp:120,direction:'out',idMessage:'auto-test'};renderWhatsAppChats();await Promise.resolve();
   const autoPending=box.querySelectorAll('.waChatRow').length===1;
   chat._lastMessage={timestamp:120,direction:'out',idMessage:'phone-test'};renderWhatsAppChats();await Promise.resolve();
   const phoneResolved=box.querySelectorAll('.waChatRow').length===0;
   waLiveState.filter='automatic';renderWhatsAppChats();await Promise.resolve();
   const offerPreserved=box.querySelectorAll('.waChatRow').length===1;
   return {both,pending,processing,notWaiting,planned,due,completed,autoPending,phoneResolved,offerPreserved};
 });
 expect(phases).toEqual({both:true,pending:true,processing:true,notWaiting:true,planned:true,due:true,completed:true,autoPending:true,phoneResolved:true,offerPreserved:true});
});
