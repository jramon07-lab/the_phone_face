'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/contacts-sales-core.js','utf8');
const nodes=new Map(),started=new Set();let releaseSales;
const ctx={currentContact:{id:'test',data:{NOMBRE:'Test'}},salesCache:{opportunities:[]},window:{TPFRecordLinks:{load:async()=>{started.add('people');return[]},related:()=>[]}},
 $:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)},contactField:(d,...keys)=>keys.map(k=>d[k]).find(Boolean)||'',esc:String,contactCanUseWhatsapp:()=>true,
 loadSales:()=>{started.add('sales');return new Promise(r=>releaseSales=r)},hydrateOpportunityStageNames:x=>x,oppIsClosed:()=>false,oppIsExpired:()=>false,
 sb:{from(table){const q={select(){return q},eq(k){if(k==='whatsapp_enabled')q.programs=true;return q},or(){return q},order(){return q},range(){started.add(q.programs?'programs':'tasks');return Promise.resolve({data:[]})},then(resolve){started.add(table);return Promise.resolve({data:[]}).then(resolve)}};return q}}};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function renderContactProfile(){'),source.indexOf('window.deleteContactProgrammedWhatsapp=')),ctx);
(async()=>{
 const work=ctx.renderContactProfile();await new Promise(r=>setImmediate(r));
 assert.deepEqual([...started].sort(),['contact_activity','people','programs','sales','tasks']);
 releaseSales();await work;assert(ctx.$('cpTasks').innerHTML.includes('No hay tareas'));
 console.log('PASS all independent profile reads start while sales is still pending');
})().catch(e=>{console.error(e);process.exitCode=1});
