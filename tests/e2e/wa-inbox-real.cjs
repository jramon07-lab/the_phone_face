// Offline browser regression: real markup/CSS/modules, synthetic contacts, no network writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.join(root,u.pathname);if(u.hostname==='fixture.test'&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});return route.abort();});
 let html=fs.readFileSync(root+'/index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('<head>','<head><base href="http://fixture.test/">');
 await page.setContent(html);
 await page.evaluate(()=>{
 const $=id=>document.getElementById(id);document.querySelectorAll('main>section').forEach(x=>x.classList.add('hidden'));$('login').classList.add('hidden');$('app').classList.remove('hidden');$('view-whatsapplive').classList.remove('hidden');$('waContactCard').classList.remove('hidden');$('waChatActive').classList.remove('hidden');$('waContactEmpty').classList.add('hidden');$('waChatEmpty').classList.add('hidden');
 window.waLiveState={contact:{id:'demo-1',data:{}},selected:{id:'demo-chat'},history:[]};window.openContact=()=>{};window.TPFContactReview={openForContact:()=>{window.reviewOpened=true}};window.TPFContactRelations={sidebarSnapshot:async()=>({holders:[],managers:[],legacy:null})};window.TPFWhatsappOfferSummary=async()=>[{rawStatus:'following',title:'Oferta de fibra y móvil',amount:'39,00 €',status:'Seguimiento activo',followupHtml:'<button id="fixtureManage">Gestionar seguimiento</button>'}];
 const ids=['contactName','contactNickname','contactPhone','contactDni','contactEmail','contactBank','contactObservations','contactNotes'];window.TPFContactInlineEdit={allowed:()=>true,fields:Object.fromEntries(ids.map(id=>[id,{label:({contactPhone:'Teléfono',contactDni:'DNI / NIF',contactObservations:'Observaciones',contactNotes:'Notas',contactEmail:'Correo',contactBank:'Banco'})[id]||id,id}])),read:(d,f)=>d?.[f.id]||'',saveField:async x=>({data:{...waLiveState.contact.data,[x.fieldId]:x.value},previous:{}})};waLiveState.contact.data={contactName:'Ana Martín',contactPhone:'600000001',contactDni:'Documento de ejemplo',contactObservations:'Prefiere contacto por la tarde',contactNotes:'Nota protegida'};window.crmGetContactLabels=async()=>[];
 $('waSideName').textContent='Ana Martín';$('waChatName').textContent='Ana Martín';$('waChatAvatar').textContent='AM';$('waSideAvatar').textContent='AM';$('waLiveStatus').textContent='Conectado';$('waLiveChats').innerHTML='<div class="waChatRow">Ana Martín</div>';
 const actions=document.createElement('div');actions.id='waSideContactActions';actions.innerHTML='<button id="waSideNewOffer">Enviar oferta</button><button id="waSideDirectSale">Venta directa</button>';$('waContactCard').prepend(actions);
 window.nativeActions=[];for(const id of ['waSideNewOffer','waSideDirectSale','waSideNewTask','waSideNewOpp','waPinChat','waSaveInternalNote'])$(id).onclick=()=>window.nativeActions.push(id);
 $('waSideOpps').innerHTML='<div class="waSideItem">Oferta de fibra y móvil · 39,00 €</div>';$('waSideTasks').innerHTML='<div class="waSideItem">Revisar factura · Hoy, 17:00</div>';
 $('waMessages').innerHTML='<div class="waMsg in"><div class="waBubble">Te adjunto la factura.<div class="waMsgMeta">12:42</div></div></div><div class="waMsg out"><div class="waBubble">Gracias, reviso las dos líneas.<div class="waMsgMeta">12:44</div></div></div>';
 });
 await page.evaluate(()=>{window.TPFModules={register:(name,m)=>m.install()}});
 for(const name of ['sidebar-fixed-safe','sidebar-compact','global-responsive','whatsapp-large-screen','whatsapp-workspace-design','whatsapp-contact-fields'])await page.addScriptTag({path:root+'/js/modules/'+name+'.js'});
 await page.waitForTimeout(650);

 await page.evaluate(()=>{
 window.$=id=>document.getElementById(id);window.waMetaStore={};window.waMeta=id=>waMetaStore[id]||{};window.waMetaSave=(id,patch)=>{waMetaStore[id]={...waMeta(id),...patch};renderWhatsAppChats()};
 const now=Math.floor(Date.now()/1000);window.fixtureNow=now;
 waLiveState.filter='unanswered';waLiveState.avatars={};waLiveState.livePreview={};
 waLiveState.chats=[['600000001','Ana Martín','¿Podéis revisar mi factura?','in'],['600000002','Carlos López','Te envío la oferta de fibra y móvil.','out'],['600000003','Lucía García','¿Qué tal va tu nueva tarifa?','out'],['600000004','Miguel Ruiz','Ya tengo la documentación.','in'],['600000005','Elena Torres','Quedo pendiente de tu confirmación.','out']].map(([id,name,text,direction])=>({id:id+'@c.us',name,_lastMessage:{timestamp:now,direction,text}}));
 window.waMessageTimestamp=m=>m?.timestamp||0;window.waMessageDirection=m=>m?.direction||'in';
 window.waUnreadCount=id=>waMessageDirection(waLiveState.chats.find(c=>c.id===id)?._lastMessage)==='in'?1:0;
 window.waNormalizePhone=id=>id.split('@')[0];window.waInitials=name=>name.split(' ').map(x=>x[0]).join('').slice(0,2);window.waTime=()=> '18:20';window.waLivePreviewText=m=>m?.text||'';window.waChatServerPreview=()=>'';
 window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));window.WA_CHAT_RENDER_LIMIT=300;window.waIsUnanswered=id=>waMessageDirection(waLiveState.chats.find(c=>c.id===id)?._lastMessage)==='in';window.waUpdateStats=()=>{};window.hydrateWaAvatars=()=>{};
 window.selectWhatsAppChat=id=>{const c=waLiveState.chats.find(c=>c.id===id);waLiveState.selected=c;waLiveState.contact={id,data:{contactName:c.name,contactObservations:'Prefiere contacto por la tarde',contactNotes:'Documentación pendiente de revisar'}};document.getElementById('waChatName').textContent=c.name;document.getElementById('waSideName').textContent=c.name;document.getElementById('waSideAvatar').textContent=waInitials(c.name);document.getElementById('waChatAvatar').textContent=waInitials(c.name);document.getElementById('waMessages').innerHTML='<div class="waMsg '+(c._lastMessage.direction==='in'?'in':'out')+'"><div class="waBubble">'+esc(c._lastMessage.text)+'<div class="waMsgMeta">18:20</div></div></div>';renderWhatsAppChats();};
 document.getElementById('waArchiveChat').onclick=()=>{const id=waLiveState.selected.id;waMetaSave(id,{archived:!waMeta(id).archived,archivedAt:Date.now()/1000})};
 document.getElementById('waLiveStatus').textContent='Vista con datos de ejemplo';
 });
 await page.evaluate(()=>{document.getElementById('waComposerText').placeholder='Escribe un mensaje…'});
 const core=fs.readFileSync(root+'/js/modules/whatsapp-green-core.js','utf8');
 const start=core.indexOf('renderWhatsAppChats=function(){',core.indexOf('/* Re-render chats with CRM filters/metadata. */'));
 const end=core.indexOf('\n};',start)+3;
 await page.addScriptTag({content:core.slice(start,end)});
 await page.addScriptTag({path:root+'/js/modules/whatsapp-automation-inbox.js'});
 await page.evaluate(()=>{TPFAutomationInbox.ingestJobs([{context:{phone:'600000003'},completed_at:new Date(fixtureNow*1000).toISOString()}]);selectWhatsAppChat('600000001@c.us');renderWhatsAppChats();});

 await page.evaluate(()=>{
 window.demoInboxRows=new Map();window.demoFailSave=false;
 window.sb={from(table){if(table!=='crm_whatsapp_chat_state')throw Error('Unexpected table '+table);return {select(){let after='';const q={order(){return q},limit(){return q},gt(k,v){after=v;return q},then(ok,bad){return Promise.resolve({data:[...demoInboxRows.values()].filter(r=>r.chat_id>after).sort((a,b)=>a.chat_id.localeCompare(b.chat_id)),error:null}).then(ok,bad)}};return q},upsert(p){return {select(){return {async single(){if(demoFailSave)return {error:{message:'Sin conexión'}};demoInboxRows.set(p.chat_id,{...p});return {data:{...p},error:null};}}}}}}}};
 });
 await page.addScriptTag({path:root+'/js/modules/whatsapp-inbox-manual.js'});
 await page.evaluate(async()=>{await TPFInboxManual.save('600000002@c.us','waiting','Documentación del cliente');await TPFInboxManual.save('600000005@c.us','waiting','Confirmación del cliente');});
 await page.waitForTimeout(350);
 for(const [key,count,id]of [['unanswered',2,'600000001'],['waiting',2,'600000002'],['automatic',1,'600000003'],['all',5,'600000001']]){
 await page.click('[data-wa-tab="'+key+'"]');assert.equal(await page.locator('#waLiveChats .waChatRow').count(),count,key);await page.click('[data-wa-chat-id="'+id+'@c.us"]');await page.waitForTimeout(250);
 const hit=await page.locator('#waComposerText').evaluate(n=>{const r=n.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===n});assert(hit,'composer is visible and clickable');
 }
 // Resolve retains chat history and automatic jobs; another incoming reply returns to pending.
 await page.click('#waArchiveChat');assert.equal(await page.locator('#waLiveChats .waChatRow').count(),4);
 await page.evaluate(()=>{const c=waLiveState.chats[0];waMetaStore[c.id].archived=false;c._lastMessage.timestamp=fixtureNow+120;c._lastMessage.direction='in';renderWhatsAppChats()});
 await page.click('[data-wa-tab="unanswered"]');assert.equal(await page.locator('#waLiveChats .waChatRow').count(),2);
 await page.evaluate(()=>{const c=waLiveState.chats[2];c._lastMessage={timestamp:fixtureNow+150,direction:'in',text:'Necesito ayuda'};renderWhatsAppChats();});assert.equal(await page.locator('#waLiveChats .waChatRow').count(),3);
 // An automatic message after an unhandled incoming message must not hide it.
 await page.evaluate(()=>{const c=waLiveState.chats[2];c._lastIncomingAt=fixtureNow+150;c._lastMessage={timestamp:fixtureNow+200,direction:'out',text:'Seguimiento automático'};TPFAutomationInbox.ingestJobs([{context:{phone:'600000003'},completed_at:new Date((fixtureNow+200)*1000).toISOString()}]);renderWhatsAppChats();});assert.equal(await page.locator('#waLiveChats .waChatRow').count(),3);
 for(const width of [1280,1440,390]){await page.setViewportSize({width,height:844});await page.waitForTimeout(200);const box=await page.locator('.waTabs').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1,'tabs fit '+width);}

 await page.setViewportSize({width:1366,height:768});
 await page.evaluate(()=>{waLiveState.chats[0]._lastMessage.timestamp=fixtureNow;selectWhatsAppChat('600000001@c.us')});
 await page.click('#waWaitManual');await page.selectOption('#waInboxDialog select','Confirmación del cliente');await page.fill('#waInboxDialog input[name=detail]','Precio de fibra');await page.click('#waInboxDialog button[type=submit]');
 await page.locator('#waInboxDialog').waitFor({state:'detached',timeout:2000});
 assert.equal(await page.evaluate(()=>TPFAutomationInbox.category(waLiveState.chats[0])),'waiting');
 await page.evaluate(()=>{waLiveState.chats[0]._lastIncomingAt=Date.now()/1000+5});
 assert.equal(await page.evaluate(()=>TPFAutomationInbox.category(waLiveState.chats[0])),'unanswered');
 await page.evaluate(()=>{waLiveState.chats[0]._lastIncomingAt=0;waLiveState.chats[0]._lastMessage.timestamp=fixtureNow;});
 await page.click('#waSnoozeManual');await page.click('#waInboxDialog button[type=submit]');
 assert.equal(await page.evaluate(()=>TPFAutomationInbox.category(waLiveState.chats[0])),'snoozed');
 await page.evaluate(async()=>{demoInboxRows.get('600000001@c.us').inbox_until=new Date(Date.now()-1000).toISOString();await TPFInboxManual.sync()});
 assert.equal(await page.evaluate(()=>TPFAutomationInbox.category(waLiveState.chats[0])),'unanswered');
 await page.evaluate(()=>{demoFailSave=true});await page.click('#waWaitManual');await page.click('#waInboxDialog button[type=submit]');await page.waitForTimeout(100);
 assert.match(await page.locator('.waInboxError').textContent(),/Sin conexión/);assert.equal(await page.locator('#waInboxDialog').count(),1);
 await page.click('#waInboxDialog [data-cancel]');

 // Real settings dialog and realtime events, using only synthetic data.
 await page.evaluate((settings)=>{
 window.replySettings=settings;window.replySaved=null;window.realtimeCallbacks={};window.sharedEvents=0;
 window.addEventListener('tpf:wa-shared-state',()=>sharedEvents++);
 const oldFrom=sb.from.bind(sb);sb.from=table=>{if(table!=='crm_whatsapp_reply_receipts')return oldFrom(table);const q={select(){return q},eq(){return q},order(){return q},range(){return Promise.resolve({data:[{outgoing_id:'auto-reply-test'}]})}};return q;};
 sb.auth={getSession:async()=>({data:{session:{user:{id:'demo'},access_token:'demo'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})};
 sb.channel=()=>{const c={on(type,filter,fn){realtimeCallbacks[filter.table]=fn;return c},subscribe(fn){fn('SUBSCRIBED');return c}};return c};sb.removeChannel=async()=>{};
 window.fetch=async(url,options)=>{if(url!=='/api/whatsapp-auto-replies')throw Error('Unexpected request');if(options.method==='POST')replySaved=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true,settings:replySettings,connected:true,issues:[]})};};
 },require('../../lib/whatsapp-auto-replies').DEFAULTS);
 await page.addScriptTag({path:root+'/js/modules/whatsapp-auto-replies.js'});
 await page.click('#waAutoReplySettings');await page.waitForSelector('#waAutoReplyDialog textarea');
 await page.check('#waAutoReplyDialog [name=enabled]');await page.fill('#waAutoReplyDialog textarea','Mensaje de ejemplo fuera de horario');await page.click('#waAutoReplyDialog [type=submit]');
 assert.equal(await page.evaluate(()=>replySaved.enabled),true);assert.equal(await page.evaluate(()=>replySaved.schedule[1].length),2);
 await page.evaluate(()=>realtimeCallbacks.crm_whatsapp_chat_state({new:{chat_id:'demo'}}));await page.waitForTimeout(650);assert(await page.evaluate(()=>sharedEvents>0));
 await page.evaluate(()=>{const c=waLiveState.chats[3];c._lastMessage={idMessage:'auto-reply-test',timestamp:fixtureNow+500,direction:'out',text:'Respuesta automática'};});
 assert.equal(await page.evaluate(()=>TPFAutomationInbox.category(waLiveState.chats[3])),'unanswered');
 await page.evaluate(()=>waLiveState.chats[3]._lastMessage.idMessage='manual-human-reply');
 assert.equal(await page.evaluate(()=>TPFAutomationInbox.category(waLiveState.chats[3])),'all');
 await page.click('#waAutoReplySettings');await page.waitForSelector('#waAutoReplyDialog textarea');
 for(const width of [1366,390]){await page.setViewportSize({width,height:844});const box=await page.locator('#waAutoReplyDialog').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1,'settings dialog fits '+width);}
 await page.click('#waAutoReplyDialog [data-close]');

 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: actual stable markup and chat renderer; category counts, resolve, incoming, automatic retention, desktop/mobile tabs; zero page errors');
})().catch(e=>{console.error(e);process.exit(1)});
