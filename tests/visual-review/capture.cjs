const {chromium}=require('playwright'),{expect}=require('@playwright/test'),fs=require('fs'),path=require('path'),http=require('http');
const read=p=>fs.readFileSync(p,'utf8');
const out='browser-evidence/visual-review';fs.mkdirSync(out,{recursive:true});
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const report={base:'a97ec75fb78c428d3ddf9590601c38d43094037e',screens:[],errors:[],businessWrites:0};
let browser,server;
async function stamp(page){await page.addStyleTag({content:read('tests/visual-review/review.css')});await page.evaluate(()=>{document.getElementById('reviewStamp')?.remove();const s=document.createElement('div');s.id='reviewStamp';s.textContent='PROPUESTA · Base estable a97ec75 · Datos de prueba';(document.querySelector('dialog[open]')||document.body).append(s)});}
async function shot(page,name){await stamp(page);await (page.locator('dialog[open]').count().then(async n=>n?page.locator('dialog[open]').screenshot({path:path.join(out,name+'.png')}):page.screenshot({path:path.join(out,name+'.png'),fullPage:false})));report.screens.push(name);console.log('CAPTURED',name);}
async function run(name,fn){const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'es-ES',timezoneId:'Europe/Madrid'});await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();return route.abort()});try{await fn(page)}catch(e){report.errors.push({name,error:e.message});console.log('REVIEW_ERROR',name,e.stack);await page.screenshot({path:path.join(out,'error-'+name+'.png')});}finally{await page.close()}}
async function oppFixture(page){
 await page.addScriptTag({content:read('js/modules/opportunity-identity.js')});
 const src=read('tests/e2e/crm-opportunity-contract.spec.js');
 const start=src.indexOf(' await page.setViewportSize(viewport)'),end=src.indexOf(" await expect(page.locator('#oppModalTerminalEnd'))",start);
 await new AsyncFunction('page','expect','read','viewport',src.slice(start,end))(page,expect,read,{width:1440,height:1000});
 await page.evaluate(()=>{row.client_name='Carlos Ejemplo';row.title='CAMBIO VODAFONE';row.amount=35.50;row.expected_date='2026-10-13';row.installation_date=null;row.discount_end_date='2027-10-13';row.terminal_commitment_end='2027-03-01';row.notes='Vivienda principal · Fibra 600 Mb + 2 móviles.\nConfirmar activación con el operador.';Object.assign(row.contract_party,{holder_name:'Carlos Ejemplo',contact_name:'María Ejemplo',recipient_name:'María Ejemplo'});salesCache.stages[0].name='Pendiente de tramitar';$('oppDetailModal').classList.add('hidden');document.querySelectorAll('#app main > section').forEach(s=>s.classList.add('hidden'));document.getElementById('login')?.classList.add('hidden');});
 await page.addStyleTag({content:read('assets/crm-reference.css')+read('assets/opportunity-detail.css')});
 for(const m of read('index.html').matchAll(/href="(\/?assets\/[^?" ]+\.css)/g)){const f=m[1].replace(/^\//,'');if(fs.existsSync(f))await page.addStyleTag({content:read(f)});} await page.evaluate(()=>{window.fmtMoney=n=>Number(n).toLocaleString('es-ES',{minimumFractionDigits:2})+' €';}); await page.evaluate(()=>openOpportunityFull('opportunity'));await expect(page.locator('.oppContractPeople')).toBeVisible();await page.evaluate(()=>{document.querySelectorAll('.referenceNav [data-sheet]').forEach(n=>{if(n.dataset.sheet)n.hidden=true});});
}
(async()=>{
 server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p.includes('..')){res.writeHead(403).end();return}p=path.join(process.cwd(),p);if(!fs.existsSync(p)||fs.statSync(p).isDirectory()){res.writeHead(404).end();return}res.setHeader('Content-Type',p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(p))}).listen(3009,'127.0.0.1');
 browser=await chromium.launch();

 await run('comparacion',async page=>{
 await oppFixture(page);
 await page.addStyleTag({content:'[hidden]{display:none!important}.reviewVersion{position:fixed;bottom:10px;right:14px;background:#fff;border:1px solid #cbd5e1;padding:7px 12px;border-radius:6px;font:11px Arial;color:#475569;z-index:999999}'});
 await page.evaluate(()=>{const n=document.createElement('div');n.className='reviewVersion';n.textContent='ANTES · Componente de estable a97ec75 · Datos de prueba';document.body.append(n);});
 const controls=await page.locator('#opportunityFullPage button').evaluateAll(nodes=>nodes.map(n=>n.textContent.trim()).sort());
 await page.screenshot({path:path.join(out,'01-antes-oportunidad.png')});report.screens.push('01-antes-oportunidad');
 await page.evaluate(()=>{
 const root=document.getElementById('oppFullContent');
 const context=document.createElement('section');context.className='proposalContext';
 context.innerHTML='<div><span class="proposalEyebrow">CONTRATO QUE ESTÁS GESTIONANDO</span><h2>Vivienda principal · Fibra 600 Mb + 2 móviles</h2><p>Carlos Ejemplo <span>·</span> Referencia DEMO-001</p></div><div class="proposalPrice">35,50 €<small>al mes</small></div>';
 root.prepend(context);
 const action=document.createElement('section');action.className='proposalNext';
 action.innerHTML='<div><span class="proposalEyebrow">SIGUIENTE PASO</span><h3>Preparar la tramitación</h3><p>La activación todavía no está registrada.</p></div>';
 action.append(document.getElementById('oppFullManage'));context.after(action);
 const metrics=root.querySelector('.oppSummaryMetrics');metrics.classList.add('proposalDates');
 const datesTitle=document.createElement('h3');datesTitle.className='proposalSectionTitle';datesTitle.textContent='Importe, estado y fechas del contrato';metrics.before(datesTitle);
 const actions=root.querySelector('.oppContractActions');actions.classList.add('proposalQuick');
 document.querySelector('.reviewVersion').textContent='DESPUÉS · Propuesta visual · Mismos datos y controles · Sin publicar';
 });
 await page.addStyleTag({content:read('tests/visual-review/comparison.css')});
 const after=await page.locator('#opportunityFullPage button').evaluateAll(nodes=>nodes.map(n=>n.textContent.trim()).sort());
 expect(after).toEqual(controls);
 await page.screenshot({path:path.join(out,'02-despues-oportunidad.png')});report.screens.push('02-despues-oportunidad');report.preservedControls=controls.length;
 });
 await browser.close();server.close();fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));if(report.errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
