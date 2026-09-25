'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function exercise(source){
 const code=source.match(/function applyDates\(\).*\n/)[0];let pending=1,writes=0,passes=0;
 const node=()=>{let value='';return {get textContent(){return value},set textContent(v){value=v;writes++;pending++},classList:{toggle(){}}}};
 const nodes={tpfDateStatus:node(),salesOptionsToggle:node()};
 const ctx={document:{querySelectorAll:()=>[]},$:id=>nodes[id],dateLabel:()=>'',toolsOpen:false,dateFrom:'',dateTo:'',dateMode:''};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 while(pending&&passes<100){pending=0;ctx.applyDates();passes++;}
 return {passes,pending,writes,ctx,nodes};
}
const source=fs.readFileSync('js/modules/contacts-sales.js','utf8');
// A textContent assignment generates a childList mutation even when unchanged.
const original=source.replace("const text=label?'Filtro activo: '+label:'';if(status.textContent!==text)status.textContent=text;", "status.textContent=label?'Filtro activo: '+label:'';").replace("if(toggle&&!toolsOpen){const text=label?'Filtros · '+label:'Filtros y acciones ▾';if(toggle.textContent!==text)toggle.textContent=text}","if(toggle&&!toolsOpen)toggle.textContent=label?'Filtros · '+label:'Filtros y acciones ▾'");
assert.equal(exercise(original).passes,100,'reproduce the old perpetual observer cycle');
const fixed=exercise(source);assert.ok(fixed.passes<=2);assert.equal(fixed.pending,0);
fixed.ctx.dateLabel=()=> 'Hoy';fixed.ctx.applyDates();assert.equal(fixed.nodes.tpfDateStatus.textContent,'Filtro activo: Hoy');
assert.equal(fixed.nodes.salesOptionsToggle.textContent,'Filtros · Hoy');
const writes=fixed.writes;for(let i=0;i<100;i++)fixed.ctx.applyDates();
assert.match(source,/function decorate\(\)\{if\(document.hidden\|\|\$\('view-sales'\)\?\.classList.contains\('hidden'\)\)return/);
console.log('Sales filter observer reproduces old infinite cycle and settles after correction; date changes remain visible');
