'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const classes=(...values)=>{const set=new Set(values);return{add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x)}};
const element=()=>({classList:classes('hidden'),attributes:{},dataset:{},innerHTML:'',setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this.attributes[k]}});
async function templates(){
 const src=fs.readFileSync('js/modules/whatsapp-templates-library-v3.js','utf8');
 const page=element(),nav=element(),other=element();let resolve,reject,renders=0,hides=0;
 const ctx={window:{tpfNavigationRevision:1},state:{edit:3},page:()=>page,nav:()=>nav,$:()=>element(),document:{querySelectorAll:()=>[nav,other]},hideViews(){hides++;other.classList.add('hidden')},render(){renders++;page.innerHTML='Current templates'},sync:()=>new Promise((r,j)=>{resolve=r;reject=j}),esc:String,setTimeout,clearTimeout};
 vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('let openRevision='),src.indexOf('\nfunction render()')),ctx);
 let pending=ctx.open();assert.match(page.innerHTML,/Cargando plantillas/);assert.equal(page.classList.contains('hidden'),false);assert.equal(nav.classList.contains('active'),true);assert.equal(renders,0);
 ctx.window.tpfNavigationRevision++;page.classList.add('hidden');nav.classList.remove('active');resolve();await pending;
 assert.equal(renders,0,'late result must not render or reopen departed menu');assert.equal(hides,1);
 pending=ctx.open();resolve();await pending;assert.equal(renders,1);assert.equal(page.attributes['aria-busy'],undefined);
 pending=ctx.open();reject(new Error('Offline'));await pending;assert.match(page.innerHTML,/Offline/);assert.match(page.innerHTML,/Reintentar/);assert.equal(page.attributes['aria-busy'],undefined);
}
async function tickets(){
 const src=fs.readFileSync('js/core/00-bootstrap.js','utf8');const section=element(),ctx={window:{tpfNavigationRevision:1},$:()=>section,setTimeout,clearTimeout,console};vm.createContext(ctx);
 vm.runInContext(src.slice(src.indexOf('function tpfLoadView('),src.indexOf('\ndocument.querySelectorAll(".nav").forEach(n=>n.onclick')),ctx);
 let resolve1,resolve2;const p1=ctx.tpfLoadView('sales',()=>new Promise(r=>resolve1=r));ctx.window.tpfNavigationRevision=2;
 const p2=ctx.tpfLoadView('sales',()=>new Promise(r=>resolve2=r));resolve1();await p1;assert.equal(section.attributes['aria-busy'],'true','previous response cannot clear current loading state');resolve2();await p2;assert.equal(section.attributes['aria-busy'],undefined);
}
function mail(){
 const src=fs.readFileSync('js/modules/email-m365-lazy.js','utf8');const nav=element();let scripts=[],views=[],shown=0;
 const ctx={window:{tpfNavigationRevision:1},document:{getElementById:id=>views.find(v=>v.id===id),createElement:()=>element(),querySelector:s=>s.includes('main')?{appendChild:v=>views.push(v)}:nav,querySelectorAll:s=>s.includes('section')?views:[nav],head:{appendChild:s=>scripts.push(s)}},M:{report(){}},queueMicrotask};vm.createContext(ctx);
 vm.runInContext(src.slice(src.indexOf('let loading='),src.indexOf('\nfunction installNav()')),ctx);
 ctx.loadMail();assert.equal(scripts.length,1);assert.match(views[0].innerHTML,/Cargando correo/);ctx.window.tpfNavigationRevision++;
 const ready=element();ready.id='view-email';views.push(ready);scripts[0].onload();assert.equal(ready.classList.contains('hidden'),true,'late mail script must not navigate back');
 ctx.loadMail();assert.equal(ready.classList.contains('hidden'),false);assert.equal(scripts.length,1,'loaded module is reused');
}
(async()=>{await templates();await tickets();mail();console.log('PASS immediate current loading screen, delayed navigation, retry, load ticket ordering and lazy-mail reuse')})().catch(e=>{console.error(e);process.exitCode=1});
