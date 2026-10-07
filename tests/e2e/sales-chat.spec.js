const {test,expect}=require('@playwright/test'),fs=require('node:fs');
for(const width of [1440,390])test('Select all respects stage and search scope '+width,async({page,context})=>{
 await context.route('**/*',r=>r.abort());await page.setViewportSize({width,height:844});
 await page.setContent('<section id="view-sales"><input id="salesSelectAll" type="checkbox"><span id="salesSelectedCount"></span><button id="salesBulkMove"></button><button id="salesBulkDelete"></button><input id="salesSearch"><select id="salesStageFilter"><option value=""></option></select><div id="salesSummaryStages"><button class="salesSummaryStageChip" data-stage-id="next">Próximo 7</button><button class="salesSummaryStageChip" data-stage-id="other">Seguimiento 7</button></div><div id="salesListView"><div class="salesListHeader"></div><div id="salesListRows"></div></div></section>');
 await page.evaluate(()=>{
  window.$=id=>document.getElementById(id);window.TPFModules={register:(name,m)=>window.module=m};window.updateStageSelectAllUi=()=>{};
  window.salesCache={stages:[{id:'next',name:'Próximo'},{id:'other',name:'Seguimiento'}],opportunities:Array.from({length:14},(_,i)=>({id:String(i),stage_id:i<7?'next':'other',title:i<2?'Coincide':'Otra oferta',phone:'600000000'}))};window.esc=String;window.fmtMoney=String;window.fmtDateOnly=String;window.edits=[];window.reads=[];window.openOpportunityFull=id=>reads.push(id);window.openOpportunityCard=id=>edits.push(id);
 });
 const sales=fs.readFileSync('js/modules/contacts-sales-core.js','utf8'),core=fs.readFileSync('js/core/20-main.js','utf8');
 await page.addScriptTag({content:sales.slice(sales.indexOf('function salesFilteredOpps(){'),sales.indexOf('function fmtMoney('))});
 await page.addScriptTag({content:core.slice(core.indexOf('const selectedSalesOpportunityIds=new Set();'),core.indexOf('function refreshSalesBulkStages('))});
 await page.addScriptTag({content:core.slice(core.indexOf('function renderSalesList(){'),core.indexOf('\nfunction setSalesView'))});
 await page.addScriptTag({content:fs.readFileSync('js/modules/sales-list-ui.js','utf8')});await page.evaluate(()=>{renderSalesList();module.install()});
 await page.locator('[data-stage-id=next]').click();await page.locator('#salesSelectAll').check();await expect(page.locator('#salesSelectedCount')).toHaveText('7 seleccionadas');
 expect(await page.evaluate(()=>[...selectedSalesOpportunityIds])).toEqual(['0','1','2','3','4','5','6']);
 await page.locator('#salesSearch').fill('Coincide');await page.evaluate(()=>renderSalesList());await expect(page.locator('#salesSelectedCount')).toHaveText('2 seleccionadas');
 await page.locator('[data-stage-id=other]').click();await expect(page.locator('#salesSelectedCount')).toHaveText('0 seleccionadas');await page.locator('#salesSelectAll').click();await expect(page.locator('#salesSelectedCount')).toHaveText('0 seleccionadas');
 await page.locator('#salesSearch').fill('');await page.evaluate(()=>renderSalesList());await page.locator('#salesSelectAll').check();await expect(page.locator('#salesSelectedCount')).toHaveText('7 seleccionadas');
 await page.locator('#salesListRows .salesListTitle').last().click();expect(await page.evaluate(()=>reads)).toEqual(['13']);expect(await page.evaluate(()=>edits)).toEqual([]);
});
test('Sales list keeps text and actions separate and opens the communication recipient without sending',async({page,context})=>{
 await context.route('**/*',r=>r.abort());const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<body class="tpfUnified"><div id="app"></div><button class="nav" data-view="whatsapplive">WhatsApp</button><button class="nav" data-view="sales">Ventas</button><section id="view-whatsapplive"><div class="waLiveHeaderActions"></div></section><section id="view-sales"><div id="salesListView"><div class="salesListHeader" data-compact="1"><div></div><div>Cliente</div><div>Contacto</div><div>Importe</div><div>Estado</div><div>Seguimiento</div><div>Fecha</div><div>Acciones</div></div><div id="salesListRows"></div></div></section></body>');
 for(const file of ['assets/app.css','assets/crm-reference.css'])await page.addStyleTag({content:fs.readFileSync(file,'utf8')});
 await page.evaluate(()=>{window.modules={};window.TPFModules={register:(name,m)=>window.modules[name]=m};window.$=id=>document.getElementById(id);window.esc=v=>String(v??'');window.fmtMoney=v=>v+' €';window.fmtDateOnly=String;window.updateSalesBulkUi=()=>{};window.crmCan=()=>true;window.navCalls=0;window.restored=null;window.tpfCaptureCurrentScreen=()=>({mainView:'sales',salesMode:'list'});window.tpfRestoreCapturedScreen=async state=>{window.restored=state;document.getElementById('view-sales').classList.remove('hidden');document.querySelector('[data-view="sales"]').click()};document.querySelector('.nav').onclick=()=>window.navCalls++;window.chats=[];window.selectWhatsAppChat=async id=>window.chats.push(id);window.controls=[];window.TPFControlWhatsappOffer=async(...args)=>window.controls.push(args);window.salesCache={stages:[{id:'s',name:'Seguimiento'}],opportunities:[{id:'a',client_name:'Titular prueba',title:'CAMBIO O2',phone:'600000001',amount:30,stage_id:'s',contract_party:{same:false,recipient_phone:'600000002'}},{id:'b',client_name:'Otra persona',title:'CAMBIO VODAFONE',phone:'600000003',amount:32,stage_id:'s'},{id:'c',client_name:'Sin destinatario',title:'CAMBIO YOIGO',phone:'600000004',amount:25,stage_id:'s',contract_party:{same:false,recipient_phone:''}}]};window.salesFilteredOpps=()=>window.salesCache.opportunities;window.TPFContactParty={opportunityIdentity:()=>({dni:'00000000X'})};window.TPFOfferWorkPlan={decorate:()=>{},summary:()=>'<small class="ofPlanNext">Motivo: pendiente de confirmar la dirección completa y la fecha de instalación del cliente.</small>'};});
 await page.addScriptTag({content:fs.readFileSync('js/modules/offer-followup-ui.js','utf8')});
 await page.evaluate(()=>{const api=TPFOfferFollowup,F=api.state;F.loaded=true;F.at=Date.now();F.offers=[{id:'offer-a',opportunity_id:'a',status:'paused',sent_at:'2026-10-02T10:00:00Z',offer_name:'Oferta O2'},{id:'offer-b',opportunity_id:'b',status:'following',sent_at:'2026-10-02T10:00:00Z',snapshot:{recipient_phone:'600000005'}}];F.byOpportunity=new Map(F.offers.map(x=>[x.opportunity_id,[x]]));modules['offer-followup-ui'].install();});
 const core=fs.readFileSync('js/core/20-main.js','utf8');await page.addScriptTag({content:core.slice(core.indexOf('function renderSalesList(){'),core.indexOf('\nfunction setSalesView'))});await page.evaluate(()=>renderSalesList());
 await page.addScriptTag({content:fs.readFileSync('js/modules/sales-list-ui.js','utf8')});await page.evaluate(()=>modules['sales-list-ui'].install());
 for(const width of [1280,1366,1920,2560]){
  await page.setViewportSize({width,height:900});
  expect(await page.locator('#salesListRows .salesListRow').first().evaluate(row=>{const text=row.querySelector('.salesFollowup').getBoundingClientRect(),actions=row.querySelector('.salesListAction').getBoundingClientRect();return text.right<=actions.left&&[...row.querySelectorAll('.ofSalesActions button')].every(b=>{const r=b.getBoundingClientRect();return r.left>=actions.left&&r.right<=actions.right+1})})).toBe(true);
  await expect(page.locator('[data-of-chat="a"]')).toBeVisible();
 }
 await page.evaluate(()=>{window.composed=[];window.scheduled=0;window.openWaQuick=data=>composed.push(data);const drop=document.createElement('button');drop.id='waQuickDrop';drop.onclick=()=>scheduled++;document.body.appendChild(drop)});
 await page.addScriptTag({content:fs.readFileSync('js/modules/linked-contact-actions.js','utf8')});
 await page.locator('[data-opp-id="a"] .tpfListMenuBtn').click();await page.getByRole('button',{name:'Programar WhatsApp',exact:true}).click();
 expect(await page.evaluate(()=>composed.map(x=>x.phone))).toEqual(['34600000002']);expect(await page.evaluate(()=>scheduled)).toBe(1);
 const noPhoneDialog=page.waitForEvent('dialog').then(async d=>{expect(d.message()).toContain('teléfono válido');await d.accept()});
 await page.locator('[data-opp-id="c"] .tpfListMenuBtn').click();await page.locator('.tpfListMenu').getByRole('button',{name:'WhatsApp',exact:true}).click();await noPhoneDialog;
 expect(await page.evaluate(()=>composed.length)).toBe(1);expect(await page.evaluate(()=>scheduled)).toBe(1);await page.evaluate(()=>delete window.TPFLinkedActions);
 await page.locator('[data-of-chat="a"]').click();expect(await page.evaluate(()=>chats)).toEqual(['34600000002@c.us']);
 await page.locator('[data-of-chat="b"]').click();expect(await page.evaluate(()=>chats)).toEqual(['34600000002@c.us','34600000005@c.us']);
 await expect(page.locator('[data-of-chat="c"]')).toBeDisabled();expect(await page.evaluate(()=>navCalls)).toBe(2);expect(await page.evaluate(()=>controls)).toEqual([]);
 await page.locator('[data-of-manage="offer-a"]').click();await expect(page.getByRole('dialog')).toContainText('Gestionar seguimiento');await page.locator('#ofManageDialog [data-of-close]').last().click();
 expect(await page.evaluate(()=>salesCache.opportunities.every(x=>x.stage_id==='s'))).toBe(true);await page.evaluate(()=>document.getElementById('view-sales').classList.add('hidden'));await expect(page.getByRole('button',{name:'← Volver a ventas'})).toBeVisible();await page.getByRole('button',{name:'← Volver a ventas'}).click();expect(await page.evaluate(()=>restored)).toEqual({mainView:'sales',salesMode:'list'});await expect(page.locator('#ofBackToSales')).toHaveCount(0);expect(errors).toEqual([]);
});

test('Opportunity dossier stays compact with offer access and the linked contact at desktop and mobile widths',async({page,context})=>{
 await context.route('**/*',r=>r.abort());const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const html=fs.readFileSync('index.html','utf8');await page.setContent('<body class="tpfUnified">'+html.slice(html.indexOf('<div id="opportunityFullPage"'),html.indexOf('<div id="waQuickModal"'))+'</body>');
 for(const file of ['assets/app.css','assets/opportunity-detail.css','assets/crm-reference.css'])await page.addStyleTag({content:fs.readFileSync(file,'utf8')});
 await page.evaluate(()=>{window.$=id=>document.getElementById(id);window.rememberOpportunityReturnContext=()=>{};window.tpfRememberScreen=()=>{};window.oppVal=v=>String(v??'');window.fmtMoney=v=>v+' €';window.fmtDateOnly=String;window.currentFullOpportunity=null;window.salesCache={opportunities:[{id:'synthetic',title:'CAMBIO VODAFONE',client_name:'Cliente de prueba',phone:'600000001',amount:25,expected_date:'2026-10-14',stage_id:'pending',notes:'Nota de prueba'}],stages:[{id:'pending',name:'Pendiente de tramitar'}]};window.sb={rpc:async()=>({data:null,error:null}),from:table=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:table==='sales_opportunities'?salesCache.opportunities[0]:null})})})})};window.returnToContactFromOpportunity=()=>{};window.TPFOfferFollowup={opportunityButton:()=>'<button type="button" data-of-view-opp="synthetic">Ver oferta enviada</button>'};});
 const core=fs.readFileSync('js/core/20-main.js','utf8');await page.addScriptTag({content:core.slice(core.indexOf('window.openOpportunityFull=async'),core.indexOf('window.returnToContactFromOpportunity=async'))});
 const offers=fs.readFileSync('js/modules/offers-pro.js','utf8');await page.addScriptTag({content:offers.slice(offers.indexOf('function offerAccess('),offers.indexOf('function renderInstances('))});
 await page.addScriptTag({content:fs.readFileSync('js/modules/opportunity-contract-details.js','utf8')});
 await page.evaluate(async()=>{await openOpportunityFull('synthetic');refreshOpportunityFollowup();});
 for(const width of [1280,1366,1920,2560,390]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(250);await expect(page.locator('#oppFullOfferAccess button')).toBeVisible();
  const boxes=await page.evaluate(()=>{const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right}};return{title:rect('.oppFullTop'),head:rect('#oppFullHeaderStage'),contact:rect('.oppContractPeople'),actions:rect('.oppContractActions'),metrics:rect('.oppSummaryMetrics'),notes:rect('.oppReadNotes'),scroll:document.getElementById('opportunityFullPage').scrollWidth,client:document.getElementById('opportunityFullPage').clientWidth}});
  expect(boxes.head.top).toBeGreaterThanOrEqual(boxes.title.top);expect(boxes.head.bottom).toBeLessThanOrEqual(boxes.title.bottom+1);expect(boxes.contact.top).toBeGreaterThanOrEqual(boxes.title.bottom);expect(boxes.actions.top).toBeGreaterThanOrEqual(boxes.contact.bottom);expect(boxes.metrics.top).toBeGreaterThanOrEqual(boxes.actions.bottom);expect(boxes.metrics.top-boxes.actions.bottom).toBeLessThan(30);expect(boxes.scroll).toBeLessThanOrEqual(boxes.client+1);
  expect(boxes.notes.top).toBeGreaterThanOrEqual(boxes.metrics.bottom);
 }
 expect(errors).toEqual([]);
});


test('Conversation opened from send control returns to send control instead of the sales screen',async({page,context})=>{
 await context.route('**/*',r=>r.abort());
 await page.setContent('<button class="nav active" data-view="sendcontrol">Control de envíos</button><button class="nav" data-view="whatsapplive">WhatsApp</button><section id="ccPanel" style="height:100px;overflow:auto"><input id="ccSearch" value="Prueba"><div style="height:500px">Envíos</div></section><section id="view-whatsapplive" hidden><div class="waLiveHeaderActions"></div></section>');
 await page.evaluate(()=>{
  window.crmCan=()=>true;window.chats=[];window.selectWhatsAppChat=async id=>chats.push(id);
  window.tpfCaptureCurrentScreen=()=>({mainView:'sales'});window.restoreCalls=0;window.tpfRestoreCapturedScreen=async()=>restoreCalls++;
  document.getElementById('ccPanel').scrollTop=80;
  for(const nav of document.querySelectorAll('.nav'))nav.onclick=()=>{
   for(const other of document.querySelectorAll('.nav'))other.classList.toggle('active',other===nav);
   document.getElementById('ccPanel').hidden=nav.dataset.view!=='sendcontrol';
   document.getElementById('view-whatsapplive').hidden=nav.dataset.view!=='whatsapplive';
  };
 });
 await page.addScriptTag({content:fs.readFileSync('js/modules/offer-followup-ui.js','utf8')});
 await page.evaluate(()=>TPFOfferFollowup.openConversation('test',{id:'test',phone:'600000001'}));
 await expect(page.getByRole('button',{name:'← Volver a Control de envíos',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'← Volver a Control de envíos',exact:true}).click();
 await expect(page.locator('#ccPanel')).toBeVisible();await expect(page.locator('#ccSearch')).toHaveValue('Prueba');
 expect(await page.evaluate(()=>restoreCalls)).toBe(0);
 expect(await page.locator('#ccPanel').evaluate(el=>el.scrollTop)).toBe(80);
 expect(await page.evaluate(()=>chats)).toEqual(['34600000001@c.us']);
});

