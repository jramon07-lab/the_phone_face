const {test,expect}=require('@playwright/test'),fs=require('fs');
const read=p=>fs.readFileSync(p,'utf8');
for(const viewport of [{width:1365,height:900},{width:430,height:900}])test('Contract fields, parties and navigation '+viewport.width,async({page})=>{
 await page.setViewportSize(viewport);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent(read('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''));
 await page.addStyleTag({content:read('assets/app.css')+'\n'+read('assets/opportunity-detail.css')+'\n'+read('assets/crm-reference.css')});
 await page.evaluate(()=>{
  document.body.classList.add('tpfUnified');document.getElementById('app').classList.remove('hidden');window.$=id=>document.getElementById(id);window.__oppKeepPreparedOrigin=false;window.pendingOpportunityRecordId=null;
  window.row={id:'opportunity',record_id:'manager',title:'CAMBIO VODAFONE',client_name:'Titular de prueba',phone:'600000001',amount:33,updated_at:'2026-10-07T08:00:00Z',stage_id:'followup',notes:'Nota conservada',previous_operator:'O2',terminal_commitment_end:'2028-02-29',discount_end_date:'2027-03-01',contract_party:{same:false,holder_name:'Titular de prueba',holder_record_id:'holder',contact_name:'Gestora de prueba',manager_record_id:'manager',recipient_name:'Gestora de prueba',recipient_phone:'600000002',recipient_contact_id:'manager'}};
  window.salesCache={opportunities:[row],stages:[{id:'followup',name:'Seguimiento',pipeline_id:'pipeline'}],fields:[]};window.failSave=false;window.closeCount=0;window.lastNav=null;window.alerts=[];window.sent=0;
  window.sb={from:table=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:async()=>({data:[]}),maybeSingle:async()=>({data:table==='sales_opportunities'?row:null}),single:async()=>{if(failSave)return{error:{message:'Simulated save failure'}};row={...row,...q.payload};return{data:row}},update:payload=>{q.payload=payload;return q}};return q;}};

  window.sb.rpc=async(name,args)=>{if(failSave)return{error:{message:'Simulated save failure'}};row={...row,previous_operator:args.p_previous_operator||null,after_sale_preferences:{previous_operator:args.p_previous_operator}};return{data:{opportunity:row}};};
  window.captureOpportunityModalOrigin=()=>{};window.renderOpportunityCustomFields=()=>{};window.loadOpportunityCustomFields=async()=>{};window.mapSalesContact=()=>({});window.esc=String;window.fmtDateOnly=s=>s.split('-').reverse().join('/');window.fmtMoney=n=>n+' €';window.oppVal=s=>String(s||'');
  window.saveDetectedOperator=async()=>{};window.runOpportunityAutomations=async()=>{sent++};window.refreshOpportunityEverywhere=async()=>{};window.closeOpportunityCard=async()=>{closeCount++;$('oppDetailModal').classList.add('hidden')};
  window.TPFRouterReturn={prepare:async(id,payload)=>payload};window.TPFContactParty={mountOpportunity:()=>{if(!$('tpfOpportunityParty'))$('oppModalPhone').closest('label').insertAdjacentHTML('afterend','<div id="tpfOpportunityParty">Titular de prueba · Gestora de prueba</div>')},displayPhone:s=>s};
  window.TPFContactRelations={prepareOpportunity:async()=>row.contract_party,opportunityPreview:()=>({holder:'Titular de prueba',manager:'Gestora de prueba',recipient:'Gestora de prueba',phone:'600000002'}),opportunityContacts:()=>({contacts:[],holder:{id:'holder'},manager:{id:'manager'}})};
  window.TPFOpportunityContext={loadExtras:async()=>({labels:[],tasks:[],taskCount:0})};window.TPFHomeManage={openOpportunity:async id=>{lastNav={manage:id}}};window.TPFLinkedActions={open:async(kind,c)=>{lastNav={kind,...c}}};window.openContact=id=>{lastNav={contact:id}};window.returnToContactFromOpportunity=(id,opp)=>{lastNav={contact:id,opp}};window.rememberOpportunityReturnContext=()=>{};window.tpfRememberScreen=()=>{};
 });
 await page.addScriptTag({content:read('js/modules/crm-reference-layout.js')});await page.addScriptTag({content:read('js/modules/opportunity-contract-details.js')});
 const main=read('js/core/20-main.js');
 const extract=(start,end)=>main.slice(main.indexOf(start),main.indexOf(end,main.indexOf(start)));
 await page.addScriptTag({content:extract('window.openOpportunityCard=(id)=>{','\nasync function closeOpportunityCard')});
 await page.addScriptTag({content:extract('$("oppModalSave").onclick=async()=>{','\n$("oppModalDelete").onclick')});
 await page.addScriptTag({content:extract('window.openOpportunityFull=async(id)=>{','\nwindow.returnToContactFromOpportunity=')});
 await page.evaluate(()=>openOpportunityCard('opportunity'));
 await expect(page.locator('#oppModalTerminalEnd')).toHaveValue('2028-02-29');await expect(page.locator('#oppModalDiscountEnd')).toHaveValue('2027-03-01');await expect(page.locator('#oppModalPreviousOperator')).toHaveValue('O2');
 await page.locator('#oppModalTerminalEnd').fill('2029-05-01');await page.locator('#oppModalDiscountEnd').fill('2027-08-15');
 await expect(page.locator('.crmOpportunitySaveState')).toHaveText('Cambios sin guardar');
 await page.locator('#oppModalSave').click();await expect(page.locator('#oppDetailModal')).toBeHidden();
 await page.evaluate(()=>openOpportunityCard('opportunity'));await expect(page.locator('#oppModalTerminalEnd')).toHaveValue('2029-05-01');await expect(page.locator('#oppModalDiscountEnd')).toHaveValue('2027-08-15');
 await page.evaluate(()=>failSave=true);await page.locator('#oppModalDiscountEnd').fill('2027-09-01');await page.locator('#oppModalSave').click();await expect(page.locator('#oppDetailModal')).toBeVisible();await expect(page.locator('#oppModalDiscountEnd')).toHaveValue('2027-09-01');
 await page.evaluate(()=>{$('oppDetailModal').classList.add('hidden');return openOpportunityFull('opportunity')});
 await expect(page.locator('.oppContractPeople')).toContainText('Titular de prueba');await expect(page.locator('.oppContractPeople')).toContainText('Gestora de prueba');await expect(page.locator('[data-opp-previous]')).toHaveText('O2');await expect(page.locator('.oppSummaryMetrics')).toContainText('01/05/2029');await expect(page.locator('.oppSummaryMetrics')).toContainText('15/08/2027');
 const order=await page.locator('.oppFullTop').evaluate(el=>[...el.children].map(n=>n.id||n.className));
 await page.locator('#oppFullMore summary').click();await expect(page.locator('#oppFullMore')).toHaveAttribute('open','');
 await page.locator('#oppFullEdit').click();await expect(page.locator('#oppFullMore')).not.toHaveAttribute('open','');
 await page.evaluate(()=>{$('oppDetailModal').classList.add('hidden');return openOpportunityFull('opportunity')});
 expect(await page.locator('.oppFullTop').evaluate(el=>[...el.children].map(n=>n.id||n.className))).toEqual(order);
 await expect(page.locator('#oppFullMore')).not.toHaveAttribute('open','');
 await page.locator('#oppFullMore summary').click();await page.keyboard.press('Escape');await expect(page.locator('#oppFullMore')).not.toHaveAttribute('open','');

 await expect(page.locator('#oppFullManage')).toBeVisible();await page.locator('#oppFullManage').click();expect(await page.evaluate(()=>lastNav)).toEqual({manage:'opportunity'});
 const spacing=await page.evaluate(()=>({gap:parseFloat(getComputedStyle(document.getElementById('oppFullContent')).gap),padding:parseFloat(getComputedStyle(document.querySelector('.oppField')).paddingTop)}));expect(spacing.gap).toBeLessThanOrEqual(10);expect(spacing.padding).toBeLessThanOrEqual(12);
 await page.locator('[data-opp-person="holder"]').click();expect(await page.evaluate(()=>lastNav)).toEqual({contact:'holder',opp:'opportunity'});
 await page.locator('#oppFullContent [data-opp-whatsapp="conversation"]').click();expect(await page.evaluate(()=>lastNav)).toMatchObject({kind:'conversation',phone:'600000002',contactId:'manager'});
 await page.locator('#oppFullContent [data-opp-whatsapp="message"]').click();expect(await page.evaluate(()=>lastNav)).toMatchObject({kind:'message',phone:'600000002',contactId:'manager'});expect(await page.evaluate(()=>sent)).toBe(0);expect(errors).toEqual([]);
 // Use the actual linked navigation module: the read overlay must disappear and return must restore it.
 await page.evaluate(()=>{window.crmCan=()=>true;window.tpfCaptureCurrentScreen=()=>({type:'oppView',id:row.id});window.tpfRestoreCapturedScreen=async()=>openOpportunityFull(row.id);window.selectWhatsAppChat=async id=>{lastNav={chat:id}};window.openWaQuick=async()=>{};});
 await page.addScriptTag({content:read('js/modules/linked-contact-actions.js')});
 await page.locator('#oppFullContent [data-opp-whatsapp="conversation"]').click();await expect(page.locator('#opportunityFullPage')).toBeHidden();expect(await page.evaluate(()=>lastNav)).toEqual({chat:'34600000002@c.us'});
 await page.evaluate(()=>TPFLinkedActions.back());await expect(page.locator('#opportunityFullPage')).toBeVisible();
 const follow=read('js/modules/offer-followup-ui.js');await page.evaluate(()=>{window.opportunityFor=(id,o)=>o;window.conversationPhone=o=>o.contract_party.recipient_phone});await page.addScriptTag({content:follow.slice(follow.indexOf('async function openConversation('),follow.indexOf('function acceptanceTime(',follow.indexOf('async function openConversation('))) });await page.evaluate(()=>openConversation(row.id,row));await expect(page.locator('#opportunityFullPage')).toBeHidden();await page.evaluate(()=>TPFLinkedActions.back());await expect(page.locator('#opportunityFullPage')).toBeVisible();
 await page.evaluate(()=>failSave=false);await page.locator('[aria-label="Editar operador anterior"]').click();await page.locator('.oppInlineForm input').fill('MásMóvil');await page.locator('.oppInlineForm button[type=submit]').click();await expect(page.locator('[data-opp-previous]')).toHaveText('MásMóvil');expect(await page.evaluate(()=>row.after_sale_preferences.previous_operator)).toBe('MásMóvil');
 await page.locator('[aria-label="Editar fin de descuento"]').click();await page.locator('.oppInlineForm input').fill('2029-09-01');await page.evaluate(()=>failSave=false);await page.locator('.oppInlineForm button[type=submit]').click();await expect(page.locator('.oppSummaryMetrics')).toContainText('01/09/2029');
 await page.locator('[aria-label="Editar fin de descuento"]').click();await page.locator('.oppInlineForm input').fill('2030-09-01');await page.evaluate(()=>failSave=true);await page.locator('.oppInlineForm button[type=submit]').click();await expect(page.locator('.oppInlineForm [role=status]')).toContainText('Simulated save failure');expect(await page.evaluate(()=>row.discount_end_date)).toBe('2029-09-01');expect(await page.evaluate(()=>sent)).toBe(0);

 // Exercise the real contact card, not a direct call into the dossier API.
 await page.evaluate(()=>{
  $('oppDetailModal').classList.add('hidden');$('opportunityFullPage').classList.add('hidden');
  window.currentContact={id:'manager'};window.__TPF_HISTORY=[];
  window.tpfMainViewId=()=> 'sales';window.tpfWhatsappSnapshot=()=>({});window.opportunityModalOrigin=null;
  window.oppStageName=()=> 'Seguimiento';window.oppIsExpired=()=>false;window.openedContacts=[];
  window.openContact=async id=>{openedContacts.push(id);currentContact={id};$('contactModal').classList.remove('hidden')};
  window.TPFModules={register(name,mod){if(name==='contact-opportunities')window.installContactCards=()=>mod.install()}};
  window.cardOpens=[];const actualOpen=window.openOpportunityFull;window.openOpportunityFull=id=>{cardOpens.push(id);return actualOpen(id)};
 });
 await page.addScriptTag({content:extract('function tpfCurrentScreen(){','\n/* Desactivar los sistemas antiguos de back')});
 const green=read('js/modules/whatsapp-green-core.js');await page.addScriptTag({content:green.slice(green.indexOf('function oppUnifiedCard('),green.indexOf('\nfunction hydrateOpportunityStageNames'))});
 await page.addScriptTag({content:read('js/modules/contact-opportunity-actions.js')});
 await page.addStyleTag({content:'#contactModal:not(.hidden){position:fixed;inset:0;z-index:50000!important;background:white;pointer-events:auto!important}'});
 await page.evaluate(()=>{
  // The unrelated first cache row catches the former index-based card binding.
  salesCache.opportunities=[{id:'wrong-opportunity',record_id:'manager'},row];
  $('contactModal').innerHTML='<div id="cpOpportunities">'+oppUnifiedCard(row)+'</div>';
  $('contactModal').classList.remove('hidden');$('oppFullBack').onclick=()=>tpfBackExactly();installContactCards();
 });
 await page.locator('#cpOpportunities').getByRole('button',{name:'Ver ficha',exact:true}).click();
 await expect(page.locator('#contactModal')).toBeHidden();await expect(page.locator('#opportunityFullPage')).toBeVisible();
 expect(await page.evaluate(()=>cardOpens)).toEqual(['opportunity']);expect(await page.evaluate(()=>currentFullOpportunity.id)).toBe('opportunity');
 expect(await page.evaluate(()=>__TPF_HISTORY.at(-1))).toMatchObject({type:'contact',id:'manager'});
 await page.locator('#oppFullBack').click();await expect(page.locator('#opportunityFullPage')).toBeHidden();await expect(page.locator('#contactModal')).toBeVisible();
 expect(await page.evaluate(()=>openedContacts)).toEqual(['manager']);
 // Legacy cards must resolve their own ID even when cache order differs.
 await page.locator('#cpOpportunities .oppUnifiedActions button').first().evaluate(b=>b.textContent='Ver / editar');
 await page.locator('#cpOpportunities').getByRole('button',{name:'Ver / editar',exact:true}).click();
 expect(await page.evaluate(()=>cardOpens)).toEqual(['opportunity','opportunity']);await expect(page.locator('#contactModal')).toBeHidden();
 await page.locator('#oppFullBack').click();await expect(page.locator('#contactModal')).toBeVisible();

 await page.evaluate(()=>{document.querySelectorAll('.nav').forEach(n=>n.onclick=()=>{document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x===n));document.getElementById('view-'+n.dataset.view)?.classList.remove('hidden')})});
 await page.locator('.nav[data-view="database"]').first().dispatchEvent('click');await expect(page.locator('#opportunityFullPage')).toBeHidden();await expect(page.locator('#view-database')).toBeVisible();
 await page.evaluate(()=>{window.pendingOpen=null;sb.from=()=>({select(){return this},eq(){return this},maybeSingle:()=>new Promise(resolve=>window.resolveOpen=resolve)});window.pendingOpen=openOpportunityFull('opportunity')});
 await page.locator('.nav[data-view="agenda"]').first().dispatchEvent('click');await page.evaluate(async()=>{resolveOpen({data:row});await pendingOpen});await expect(page.locator('#opportunityFullPage')).toBeHidden();

});

for(const width of [1365,430])test('Contact opens prepared without stale cards or task layout '+width,async({page})=>{
 await page.setViewportSize({width,height:900});await page.route('**/*',r=>r.abort());const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent(read('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''));await page.addStyleTag({content:read('assets/app.css')+read('assets/contact-desktop.css')});
 await page.evaluate(()=>{window.$=id=>document.getElementById(id);document.getElementById('app').classList.remove('hidden');window.currentContact={id:'old',data:{NOMBRE:'Anterior'}};window.contactOpenSequence=0;window.tpfRememberScreen=()=>{};window.contactField=(d,...keys)=>keys.map(k=>d[k]).find(Boolean)||'';window.splitContactFullName=n=>({first:n,last:''});window.contactFullNameFromData=d=>d.NOMBRE;window.applyWhatsappVisibilityForContact=()=>{};window.sb={from(){return{select(){return this},eq(){return this},async single(){return{data:{id:'new',data:{NOMBRE:'Nuevo cliente',TELEFONO:'600000001'}}}}}}};window.renderContactProfile=()=>new Promise(resolve=>window.finishProfile=resolve);document.getElementById('contactModal').classList.add('tpfTaskStandalone');document.getElementById('cpTaskPage').classList.remove('hidden');for(const id of ['cpOpportunities','cpTasks','cpWhatsappPrograms','cpTimeline'])$(id).textContent='Contenido anterior';window.preparedVisible=null;window.addEventListener('tpf:contact-prepared',()=>window.preparedVisible=!$('contactModal').classList.contains('hidden'));});
 await page.addScriptTag({content:read('js/modules/contact-desktop-layout.js')});
 const source=read('js/modules/contacts-sales-core.js');await page.addScriptTag({content:source.slice(source.indexOf('window.openContact=async(id)=>{'),source.indexOf('\n$("contactClose").onclick='))});
 await page.evaluate(()=>{void openContact('new')});await expect(page.locator('#contactModal')).toBeVisible();await expect(page.locator('#cpTaskPage')).toBeHidden();await expect(page.locator('#contactModal')).not.toHaveClass(/tpfTaskStandalone/);await expect(page.locator('#cpOpportunities')).not.toContainText('Contenido anterior');expect(await page.evaluate(()=>preparedVisible)).toBe(false);
 if(width===1365){await expect(page.locator('#contactModal')).toHaveClass(/tpfContactReference/);await expect(page.locator('#cpRefTab-resumen')).toHaveAttribute('aria-selected','true');}
 await page.evaluate(()=>finishProfile());expect(errors).toEqual([]);
});

test('Every local asset and dynamically mounted module carries the exact deployment SHA',async({page})=>{
 const source=read('api/final-fix.js'),vm=require('node:vm'),context={process:{env:{VERCEL_GIT_COMMIT_SHA:'a'.repeat(40)}}};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function pinBuildAssets('),source.indexOf('module.exports=async')),context);
 const html=context.pinBuildAssets('<script src="/js/modules/runtime.js?v=old"></script><link href="/assets/app.css"><script src="https://external.test/x.js"></script>');expect(html).toContain('v=old&tpfBuild='+ 'a'.repeat(40));expect(html).toContain('/assets/app.css?tpfBuild='+ 'a'.repeat(40));expect(html).toContain('src="https://external.test/x.js"');
 await page.route('**/*',r=>r.fulfill({contentType:'application/javascript',body:''}));await page.setContent('<script>window.loaded=[];const append=document.head.appendChild.bind(document.head);document.head.appendChild=s=>{loaded.push(s.src);return append(s)};</script>');await page.route('**/runtime.js?*',r=>r.fulfill({contentType:'application/javascript',body:read('js/modules/runtime.js')}));await page.addScriptTag({url:'https://fixture.test/js/modules/runtime.js?tpfBuild='+ 'a'.repeat(40)});expect(await page.evaluate(()=>loaded.filter(x=>x.includes('/js/modules/')).every(x=>x.includes('tpfBuild='+ 'a'.repeat(40))))).toBe(true);
});

for(const draft of [false,true])test('New production build refreshes idle pages and protects open drafts '+draft,async({page})=>{
 let loads=0;await page.clock.install();await page.route('https://fixture.test/**',r=>{if(r.request().url().includes('/api/deployment-version'))return r.fulfill({json:{sha:'b'.repeat(40),environment:'production'}});loads++;return r.fulfill({contentType:'text/html',body:'<div id="tpfBuildBadge" data-tpf-full-commit="'+ 'a'.repeat(40)+'"></div>'+(draft?'<div id="waQuickModal"><textarea id="draft">Texto sin enviar</textarea></div>':'')});});await page.goto('https://fixture.test/');await page.addScriptTag({content:read('js/modules/deployment-refresh.js')});await page.clock.runFor(2000);
 if(draft){expect(loads).toBe(1);await expect(page.locator('#draft')).toHaveValue('Texto sin enviar');await expect(page.locator('#tpfUpdateNotice')).toBeVisible();await page.evaluate(()=>document.getElementById('waQuickModal').hidden=true);await page.clock.runFor(2000);}
 await expect.poll(()=>loads).toBe(2);
});
