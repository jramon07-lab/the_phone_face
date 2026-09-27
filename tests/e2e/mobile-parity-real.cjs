// Real mobile and shared modules, isolated synthetic data: no external requests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');const root=path.resolve(__dirname,'../..');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
try{
const page=await browser.newPage({viewport:{width:393,height:852}}),errors=[];page.setDefaultTimeout(4000);page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message)});
await page.route('**/*',r=>{const u=new URL(r.request().url()),file=path.join(root,u.pathname);if(u.hostname==='fixture.test'&&u.pathname==='/movil/')return r.fulfill({contentType:'text/html',body:html});if(u.hostname==='fixture.test'&&fs.existsSync(file)&&fs.statSync(file).isFile())return r.fulfill({path:file});return r.abort();});
let html=fs.readFileSync(root+'/movil/index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');await page.goto('https://fixture.test/movil/');
await page.evaluate(()=>{
window.crypto.randomUUID=()=> '11111111-1111-4111-8111-111111111111';window.fixtureWrites=[];window.fixtureRows=new Map();
window.fixtureContact={id:'demo-1',data:{NOMBRE:'Ana',APELLIDOS:'Martín','TELÉFONO':'600000001'}};
const db={auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}})},rpc:async(name,args)=>{fixtureWrites.push({name,args});return {data:name==='crm_whatsapp_mark_internal_read'?args.p_ts:[],error:null}},from(table){let row;const q=new Proxy({},{get(_,key){if(key==='then')return (ok,bad)=>Promise.resolve({data:row||(table==='records'?fixtureContact:table==='crm_whatsapp_chat_state'?[...fixtureRows.values()]:table==='crm_offer_catalog'?[{id:'offer-1',operator:'Vodafone',name:'Fibra',base_price:30,base_features:['Fibra 600 Mb'],active:true}]:[]),error:null}).then(ok,bad);return (...args)=>{if(key==='upsert'){row=args[0];fixtureRows.set(row.chat_id,row);fixtureWrites.push({table,row})}return q}}});return q}};window.supabase={createClient:()=>db};
});
for(const file of ['record-links','task-model','contact-party'])await page.addScriptTag({path:root+'/js/modules/'+file+'.js'});
let app=fs.readFileSync(root+'/js/mobile-app.js','utf8').replace(/\s*boot\(\);\s*\}\)\(\);\s*$/,`initMobileViewport();window.fixture={state,render,bindStaticEvents,mapContact,renderMobileWhatsAppChat,renderMobileWhatsApp,openMobileSharedOffer,openMobileSharedSchedule,renderContact,updateMobileWaListDom,loadMobileWaChats,refreshVisibleMobileData,rememberMobileDraft,renderMobileWaListBody};})();`);
await page.addScriptTag({content:app});
for(const file of ['whatsapp-inbox-manual','whatsapp-automation-inbox','whatsapp-auto-replies','whatsapp-read-guard','offer-followup-ui','offers-pro','whatsapp-schedule-direct-v3'])await page.addScriptTag({path:root+'/js/modules/'+file+'.js'});
await page.evaluate(()=>{fixture.state.user={id:'demo-user'};fixture.state.perms={is_admin:true};fixture.state.contacts=[fixture.mapContact(fixtureContact)];fixture.state.whatsapp.chats=[{id:'34600000001@c.us',name:'Ana Martín',unreadCount:1,_lastMessage:{type:'incoming',textMessage:'Hola',timestamp:Math.floor(Date.now()/1000)-10}}];fixture.state.whatsapp.selectedId='34600000001@c.us';document.getElementById('mobileBoot').classList.add('hidden');document.getElementById('mobileApp').classList.remove('hidden');fixture.bindStaticEvents();document.getElementById('mobileView').innerHTML=fixture.renderMobileWhatsApp();});
assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(245, 247, 251)');
await page.evaluate(async()=>{await waApi('read',{chatId:'34600000001@c.us'})});
assert(await page.evaluate(()=>fixtureWrites.some(x=>x.name==='crm_whatsapp_mark_internal_read')));
await page.evaluate(()=>{document.getElementById('mobileView').innerHTML=fixture.renderMobileWhatsAppChat('34600000001@c.us')});
assert.equal(await page.locator('.m-mobile-tools button').count(),4);
await page.click('[data-action="wa-quick"]');await page.click('[data-action="wa-quick-use"][data-index="0"]');assert.match(await page.inputValue('#mobileWaComposer'),/Hola, Ana\./);
await page.evaluate(()=>TPFInboxManual.open('waiting'));await page.locator('#waInboxDialog').waitFor();await page.selectOption('#waInboxDialog select','Documentación del cliente');await page.click('#waInboxDialog button[type="submit"]');assert.equal(await page.evaluate(()=>TPFAutomationInbox.category(fixture.state.whatsapp.chats[0])),'waiting');
await page.evaluate(()=>fixture.openMobileSharedOffer('demo-1'));await page.locator('#opOfferModal:not(.hidden)').waitFor({timeout:4000});
assert.match(await page.locator('#opPreview').textContent(),/oferta de Vodafone/);
for(const width of [393,430]){await page.setViewportSize({width,height:852});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow '+width);}
await page.screenshot({path:'/tmp/mobile-offer-parity.png'});
await page.check('#opWelcomeOffer');assert(!/Vodafone/.test(await page.locator('#opPreview').textContent()),'welcome excludes operator');
await page.locator('#opOfferModal .opClose').click();
await page.evaluate(()=>fixture.openMobileSharedSchedule());await page.locator('#tpfS3msg').waitFor();assert.match(await page.inputValue('#tpfS3msg'),/Hola, Ana/);assert.equal(await page.inputValue('#tpfS3phone'),'600000001');
assert(await page.locator('#tpfS3save').isVisible());

await page.locator('#tpfSched3 [data-close]').first().click();
// Refresh must preserve settings access, input drafts and editors.
await page.evaluate(()=>{document.getElementById('mobileView').innerHTML=fixture.renderMobileWhatsApp();fixture.updateMobileWaListDom();});
assert.equal(await page.locator('[data-action="wa-auto-settings"]').count(),1);
await page.evaluate(settings=>{window.fetch=async(url)=>({ok:true,json:async()=>({ok:true,settings,connected:true,issues:[],chats:fixture.state.whatsapp.chats,messages:[]})});},require('../../lib/whatsapp-auto-replies').DEFAULTS);
await page.click('[data-action="wa-auto-settings"]');await page.locator('#waAutoReplyDialog textarea').waitFor();assert.match(await page.locator('#waAutoReplyDialog').innerText(),/Horario de atención/);await page.click('#waAutoReplyDialog [data-close]');
await page.evaluate(()=>{location.hash='#/whatsapp-chat/34600000001%40c.us'});await page.locator('#mobileWaComposer').waitFor();await page.fill('#mobileWaComposer','Borrador que debe conservarse');
await page.evaluate(()=>fixture.refreshVisibleMobileData());assert.equal(await page.inputValue('#mobileWaComposer'),'Borrador que debe conservarse');
await page.evaluate(()=>{waPushLiveMessage({idMessage:'live-1',type:'incoming',timestamp:Date.now()/1000,textMessage:'Mensaje en tiempo real'});waPushLiveMessage({idMessage:'live-1',type:'incoming',timestamp:Date.now()/1000,textMessage:'Mensaje en tiempo real'});});assert.equal(await page.getByText('Mensaje en tiempo real',{exact:true}).count(),1);
await page.click('[data-action="wa-back-list"]');await page.locator('#mobileWaSearch').waitFor();await page.click('[data-route="whatsapp-chat/34600000001%40c.us"]');await page.locator('#mobileWaComposer').waitFor();assert.equal(await page.inputValue('#mobileWaComposer'),'Borrador que debe conservarse');
// A slow connection status must not delay the chat list.
await page.evaluate(()=>{window.fetch=(url)=>new URL(url,'https://fixture.test').searchParams.get('action')==='state'?new Promise(()=>{}):Promise.resolve({ok:true,json:async()=>({ok:true,chats:fixture.state.whatsapp.chats})});});
await Promise.race([page.evaluate(()=>fixture.loadMobileWaChats({light:true})),new Promise((_,reject)=>setTimeout(()=>reject(Error('Chat list blocked by connection status')),2000))]);
await page.evaluate(()=>{window.fetch=async()=>({ok:true,json:async()=>({ok:true,chats:fixture.state.whatsapp.chats,messages:[]})});});
for(const route of ['home','contacts','contact/demo-1','opportunities','alerts','more','templates','labels','new-task/demo-1','edit-contact/demo-1']){
 await page.evaluate(route=>{location.hash='#/'+route},route);await page.waitForTimeout(30);
 assert(!await page.getByText('No se pudo abrir esta pantalla',{exact:true}).count(),route+' renders');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' fits');
}
await page.fill('#editFirst','Ana editada');await page.evaluate(()=>fixture.refreshVisibleMobileData());assert.equal(await page.inputValue('#editFirst'),'Ana editada');
await page.screenshot({path:'/tmp/mobile-review-contact.png'});
// Reproduce the installed-screen and keyboard constraints from the user recordings.
await page.evaluate(()=>{location.hash='#/contact/demo-1';document.documentElement.classList.add('m-installed')});
await page.locator('[data-action="contact-compose"]').waitFor();
await page.screenshot({path:'/tmp/mobile-contact-fixed.png'});
assert(await page.evaluate(()=>{const nav=document.querySelector('.m-bottom-nav').getBoundingClientRect();return nav.bottom<=innerHeight+1&&[...document.querySelectorAll('.m-bottom-nav button')].every(b=>b.getBoundingClientRect().bottom<=innerHeight-10)}),'navigation tap targets clear the bottom edge');
assert(await page.evaluate(()=>Math.abs(document.querySelector('.m-bottom-nav').getBoundingClientRect().bottom-innerHeight)<2),'no empty strip below navigation');
await page.click('[data-action="contact-compose"]');
assert.match(await page.locator('.m-contact-compose').innerText(),/Enviar ahora/);
await page.fill('.m-contact-compose textarea','Prueba de programación');
await page.click('.m-contact-compose [data-schedule]');
assert.equal(await page.inputValue('#tpfS3msg'),'Prueba de programación');
assert.equal(await page.inputValue('#tpfS3phone'),'34600000001');
await page.setViewportSize({width:393,height:440});
await page.locator('#tpfS3msg').focus();
assert(await page.evaluate(()=>{const x=document.querySelector('#tpfSched3 [data-close]').getBoundingClientRect(),save=document.querySelector('#tpfS3save').getBoundingClientRect();return x.top>=0&&save.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth+1}),'scheduler header and footer fit with keyboard-sized viewport');
assert(await page.evaluate(()=>{const body=document.querySelector('#tpfSched3 .tpfS3b');body.scrollLeft=100;return body.scrollWidth<=body.clientWidth+1&&body.scrollLeft===0&&[...body.querySelectorAll('input,textarea,select,.tpfS3q')].every(el=>{const a=el.getBoundingClientRect(),b=body.getBoundingClientRect();return a.left>=b.left&&a.right<=b.right+1})}),'scheduler fields fit the internal scroller without sideways movement');
await page.screenshot({path:'/tmp/mobile-keyboard-fixed.png'});
await page.locator('#tpfSched3 [data-close]').first().click();await page.setViewportSize({width:393,height:852});
await page.click('.m-contact-tabs [data-tab="tasks"]');
assert(await page.evaluate(()=>{const tabs=document.querySelector('.m-contact-tabs').getBoundingClientRect(),view=document.querySelector('#mobileView').getBoundingClientRect();return tabs.top>=view.top-1&&tabs.bottom<view.bottom-44}),'selected tab and content remain visible');
await page.click('[data-action="contact-compose"]');await page.fill('.m-contact-compose textarea','Mensaje de prueba aislado');
await page.evaluate(()=>{window.sentFixture=[];window.fetch=async(url,options)=>{sentFixture.push({url:String(url),body:options?.body});return {ok:true,json:async()=>({ok:true,idMessage:'synthetic-only'})}}});
await page.click('.m-contact-compose [data-send]');await page.locator('.m-contact-compose').waitFor({state:'detached'});
assert(await page.evaluate(()=>sentFixture.some(r=>r.body?.includes('Mensaje de prueba aislado')&&r.body?.includes('34600000001@c.us')&&r.body?.includes('manualReply'))),'manual sending uses chosen recipient and read policy');
const elapsed=await page.evaluate(()=>{const contacts=fixture.state.contacts,chats=fixture.state.whatsapp.chats;fixture.state.contacts=Array.from({length:2500},(_,i)=>({id:'c'+i,phone:String(600000000+i),fullName:'Cliente '+i,nickname:'Apodo '+i}));fixture.state.whatsapp.chats=fixture.state.contacts.slice(0,1500).map(c=>({id:'34'+c.phone+'@c.us',name:c.fullName}));fixture.state.whatsapp.filter='all';const start=performance.now();fixture.renderMobileWaListBody();const elapsed=performance.now()-start;fixture.state.contacts=contacts;fixture.state.whatsapp.chats=chats;return elapsed;});assert(elapsed<1500,'indexed list with 2500 contacts and 1500 chats');console.log('Synthetic large-list render milliseconds:',Math.round(elapsed));
assert.deepEqual(errors,[]);console.log('Mobile parity: light theme, private read, quick reply draft, shared waiting and offer layout passed.');
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
