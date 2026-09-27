// Real mobile and shared modules, isolated synthetic data: no external requests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');const root=path.resolve(__dirname,'../..');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
try{
const page=await browser.newPage({viewport:{width:393,height:852}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>{const u=new URL(r.request().url()),file=path.join(root,u.pathname);if(u.hostname==='fixture.test'&&fs.existsSync(file)&&fs.statSync(file).isFile())return r.fulfill({path:file});return r.abort();});
let html=fs.readFileSync(root+'/movil/index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('<head>','<head><base href="http://fixture.test/">');await page.setContent(html);
await page.evaluate(()=>{
window.crypto.randomUUID=()=> '11111111-1111-4111-8111-111111111111';window.fixtureWrites=[];window.fixtureRows=new Map();
window.fixtureContact={id:'demo-1',data:{NOMBRE:'Ana',APELLIDOS:'Martín','TELÉFONO':'600000001'}};
const db={auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}})},rpc:async(name,args)=>{fixtureWrites.push({name,args});return {data:name==='crm_whatsapp_mark_internal_read'?args.p_ts:[],error:null}},from(table){let row;const q=new Proxy({},{get(_,key){if(key==='then')return (ok,bad)=>Promise.resolve({data:row||(table==='records'?fixtureContact:table==='crm_whatsapp_chat_state'?[...fixtureRows.values()]:table==='crm_offer_catalog'?[{id:'offer-1',operator:'Vodafone',name:'Fibra',base_price:30,base_features:['Fibra 600 Mb'],active:true}]:[]),error:null}).then(ok,bad);return (...args)=>{if(key==='upsert'){row=args[0];fixtureRows.set(row.chat_id,row);fixtureWrites.push({table,row})}return q}}});return q}};window.supabase={createClient:()=>db};
});
for(const file of ['record-links','task-model','contact-party'])await page.addScriptTag({path:root+'/js/modules/'+file+'.js'});
let app=fs.readFileSync(root+'/js/mobile-app.js','utf8').replace(/\s*boot\(\);\s*\}\)\(\);\s*$/,`window.fixture={state,render,bindStaticEvents,mapContact,renderMobileWhatsAppChat,renderMobileWhatsApp,openMobileSharedOffer,openMobileSharedSchedule,renderContact};})();`);
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

assert.deepEqual(errors,[]);console.log('Mobile parity: light theme, private read, quick reply draft, shared waiting and offer layout passed.');
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
