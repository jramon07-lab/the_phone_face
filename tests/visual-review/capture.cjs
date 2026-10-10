const {chromium}=require('playwright'),{expect}=require('@playwright/test'),fs=require('fs'),path=require('path'),http=require('http');
const read=p=>fs.readFileSync(p,'utf8');
const out='browser-evidence/visual-review';fs.mkdirSync(out,{recursive:true});
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const report={base:'a97ec75fb78c428d3ddf9590601c38d43094037e',screens:[],errors:[],businessWrites:0};
let browser,server;
async function stamp(page){await page.addStyleTag({content:read('tests/visual-review/review.css')});await page.evaluate(()=>{document.getElementById('reviewStamp')?.remove();const s=document.createElement('div');s.id='reviewStamp';s.textContent='PROPUESTA · Base estable a97ec75 · Datos de prueba';document.body.append(s)});}
async function shot(page,name){await stamp(page);await page.screenshot({path:path.join(out,name+'.png'),fullPage:false});report.screens.push(name);console.log('CAPTURED',name);}
async function run(name,fn){const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'es-ES',timezoneId:'Europe/Madrid'});await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();return route.abort()});try{await fn(page)}catch(e){report.errors.push({name,error:e.message});console.log('REVIEW_ERROR',name,e.stack);await page.screenshot({path:path.join(out,'error-'+name+'.png')});}finally{await page.close()}}
async function oppFixture(page){
 const src=read('tests/e2e/crm-opportunity-contract.spec.js');
 const start=src.indexOf(' await page.setViewportSize(viewport)'),end=src.indexOf(" await expect(page.locator('#oppModalTerminalEnd'))",start);
 await new AsyncFunction('page','expect','read','viewport',src.slice(start,end))(page,expect,read,{width:1440,height:1000});
 await page.evaluate(()=>{row.client_name='Carlos Ejemplo';row.title='CAMBIO VODAFONE';row.amount=35.50;row.expected_date='2026-10-13';row.installation_date=null;row.discount_end_date='2027-10-13';row.terminal_commitment_end='2027-03-01';row.notes='Vivienda principal · Fibra 600 Mb + 2 móviles.\nConfirmar activación con el operador.';Object.assign(row.contract_party,{holder_name:'Carlos Ejemplo',contact_name:'María Ejemplo',recipient_name:'María Ejemplo'});salesCache.stages[0].name='Pendiente de tramitar';$('oppDetailModal').classList.add('hidden');document.querySelectorAll('#app main > section').forEach(s=>s.classList.add('hidden'));document.getElementById('login')?.classList.add('hidden');});
 await page.addStyleTag({content:read('assets/crm-reference.css')+read('assets/opportunity-detail.css')});
 await page.evaluate(()=>openOpportunityFull('opportunity'));await expect(page.locator('#opportunityFullPage')).toBeVisible();
}
(async()=>{
 server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p.includes('..')){res.writeHead(403).end();return}p=path.join(process.cwd(),p);if(!fs.existsSync(p)||fs.statSync(p).isDirectory()){res.writeHead(404).end();return}res.setHeader('Content-Type',p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(p))}).listen(3009,'127.0.0.1');
 browser=await chromium.launch();
 await run('inicio',async page=>{await page.goto('http://127.0.0.1:3009/tests/fixtures/dashboard-home.html');await expect(page.locator('#tdPrioritySub')).toBeVisible();await page.addStyleTag({content:read('assets/crm-reference.css')});await page.evaluate(()=>{document.body.classList.add('tpfUnified');document.querySelector('.fixtureBanner').textContent='Revisión visual · Código de estable a97ec75 · Datos de ejemplo';document.querySelector('.fixtureNote').textContent='PHONE HOUSE ALBOLOTE';});await shot(page,'01-inicio');});
 await run('oportunidad',async page=>{await oppFixture(page);await page.evaluate(()=>{const n=document.createElement('div');n.className='reviewServiceContext';n.innerHTML='<div><b>Vivienda principal · Fibra 600 Mb + 2 móviles</b><small>Servicio de ejemplo · Identificación del contrato</small></div><div>Ref. DEMO-001<small>Aceptada el 08/10/2026</small></div>';document.querySelector('.oppContractPeople').before(n);});await shot(page,'02-oportunidad');});
 await run('contacto',async page=>{
 await oppFixture(page);await page.evaluate(()=>{$('opportunityFullPage').classList.add('hidden');window.contactCanUseWhatsapp=()=>true;window.hydrateOpportunityStageNames=x=>x;window.oppIsClosed=()=>false;window.oppIsExpired=()=>false;window.oppStageName=()=> 'Pendiente de tramitar';window.fmtAgendaDate=v=>v;window.waIsDue=()=>false;window.applyWhatsappVisibilityForContact=()=>{};window.tpfRememberScreen=()=>{};window.TPFRecordLinks={load:async()=>[],related:(rows)=>rows};window.demoContact={id:'manager',source_sheet:'BASE DE DATOS',data:{NOMBRE:'María',APELLIDOS:'Ejemplo','TELÉFONO':'600000002',DNI:'12345678Z',EMAIL:'maria@example.test',NOTAS:'Documentación revisada en tienda.',OBSERVACIONES:'Gestiona los contratos de Carlos. Llamar por la tarde.'}};window.sb={rpc:async()=>({data:{opportunities:[row,{...row,id:'demo-002',title:'CAMBIO O2',amount:27,expected_date:'2027-09-18',notes:'Segunda vivienda · Solo fibra',installation_date:'2026-09-18'}]}}),from(table){const q={select(){return q},eq(){return q},or(){return q},order(){return q},range:async()=>({data:[]}),single:async()=>({data:demoContact}),maybeSingle:async()=>({data:demoContact}),then(resolve){resolve({data:[]})}};return q}};});
 const green=read('js/modules/whatsapp-green-core.js');await page.addScriptTag({content:green.slice(green.indexOf('function oppUnifiedCard('),green.indexOf('\nfunction hydrateOpportunityStageNames'))});
 const source=read('js/modules/contacts-sales-core.js');await page.addScriptTag({content:source.slice(0,source.indexOf('window.deleteContactProgrammedWhatsapp'))+'\n'+source.slice(source.indexOf('window.openContact=async(id)=>{'),source.indexOf('\n$("contactClose").onclick='))});
 for(const f of ['assets/contact-desktop.css','assets/contact-workspace-pro.css'])await page.addStyleTag({content:read(f)});
 await page.addScriptTag({content:read('js/modules/contact-desktop-layout.js')});
 await page.evaluate(()=>openContact('manager'));await expect(page.locator('#contactModal')).toBeVisible();
 await page.evaluate(()=>{const n=document.createElement('div');n.className='reviewServiceContext';n.innerHTML='<div><b>María gestiona los contratos de Carlos</b><small>Titular: Carlos Ejemplo · WhatsApp: María · 600 000 002</small></div>';document.getElementById('cpRefPanel').prepend(n);document.querySelector('[data-tpf-summary-group="opportunities"] .tpfSummaryTrigger')?.click();document.querySelectorAll('.oppUnified').forEach((card,i)=>{const c=document.createElement('p');c.className='reviewServiceContext';c.textContent=i?'Segunda vivienda · Solo fibra · Ref. DEMO-002':'Vivienda principal · Fibra + 2 móviles · Ref. DEMO-001';card.prepend(c)});});
 await shot(page,'03-contacto');
 });
 await run('gestionar',async page=>{
 const src=read('tests/e2e/crm-home-manage.spec.js');const code=src.slice(src.indexOf('async function fixture('),src.indexOf("test('Gestionar"));const fixture=await new AsyncFunction('require','expect',code+';return fixture;')(require,expect);
 await fixture(page,'accepted',true,false);await page.evaluate(()=>{document.body.classList.add('tpfUnified');document.getElementById('view-dashboard').innerHTML='<h1>Tu trabajo de hoy</h1><p>Tramitaciones pendientes · Ordenadas por aceptación</p>';});await shot(page,'04-gestionar');
 await page.getByRole('button',{name:'Preparar tramitación',exact:true}).click();await expect(page.locator('[data-confirm-processing]')).toBeEnabled();await shot(page,'05-mensaje-tramitacion');
 });
 await run('reclamacion',async page=>{
 await oppFixture(page);await page.evaluate(()=>{window.agendaEditingRow=null;window.toLocalInput=()=> '2026-10-13T10:00';window.agendaDefaultStart=()=> '2026-10-13T10:00';window.syncAgendaEditor=()=>{};window.currentUser={id:'demo'};window.crmCan=()=>true;});
 const core=read('js/modules/agenda-core.js');await page.addScriptTag({content:core.slice(0,core.indexOf('$("agendaOpenCreate").onclick='))});
 await page.evaluate(()=>TPFOpportunityDetails.createTask(row));await expect(page.locator('#agendaCreateCard')).toBeVisible();await shot(page,'06-reclamacion');
 });
 await browser.close();server.close();fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));if(report.errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
