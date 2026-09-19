'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/dashboard-performance-guard.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const runtime=fs.readFileSync('js/modules/runtime.js','utf8');
const css=fs.readFileSync('assets/dashboard-home.css','utf8');
const sandbox={window:{TPFModules:{register(){}}},document:{getElementById(){return null}},Intl,Date,Map,setTimeout,clearInterval,setInterval};
vm.runInNewContext(source.replace("M.register('dashboard-performance-guard'","window.testHome={commercialGroups};M.register('dashboard-performance-guard'"),sandbox);
const groups=sandbox.window.testHome.commercialGroups;
const stages=new Map([['1',{name:'Seguimiento'}],['2',{name:'Pendiente de tramitar'}],['3',{name:'Tramitado'}],['4',{name:'Ganado'}],['5',{name:'Perdido'}]]);
const data={today:'2026-09-19',opps:[
{id:'follow',stage_id:'1',expected_date:'2026-09-17'},
{id:'pending',stage_id:'2',expected_date:'2026-09-19'},
{id:'done',stage_id:'3'},
{id:'won',stage_id:'4',expected_date:'2026-09-19'},
{id:'lost',stage_id:'5',expected_date:'2026-09-19'},
{id:'closed-follow',stage_id:'1',status:'won'},
{id:'cancelled',stage_id:'2',status:'cancelled'}]};
const pending=[{id:'today-task',starts_at:'2026-09-19T09:00:00+02:00'},{id:'tomorrow-task',starts_at:'2026-09-20T09:00:00+02:00'},{id:'midnight-task',starts_at:'2026-09-18T22:30:00Z'}];
const result=groups(data,stages,pending);
assert.deepEqual(Array.from(result,g=>[g.key,g.rows.length]),[['today',3],['followup',1],['pending',1],['processed',1]]);
assert.equal(result[1].rows[0].id,'follow','overdue followups must remain visible');
assert.equal(groups({...data,opps:[]},stages,[]).every(g=>g.rows.length===0),true);
assert.ok(source.includes('renderCommercial(d,map,pending)'));
assert.ok(source.includes('Hoy comercial')&&source.includes('Tu día, de un vistazo.'));
assert.ok(!source.includes('Clientes a contactar hoy')&&!source.includes('function renderContacts('));
assert.ok(source.includes("if(el.closest('.nav[data-view=\"dashboard\"]'))"),'return navigation must reload the same renderer');
assert.ok(!html.includes('dashboard-home-pro.js'),'remove the competing patch');
assert.ok(runtime.includes("file==='dashboard-performance-guard.js'?'20260919-home-verified-1'"),'active renderer cache version');
assert.ok(html.includes('runtime.js?v=20260919-home-verified-1'));
assert.ok(css.includes('#view-dashboard.tpfDashPro .tdCommercialTab.isActive'));
assert.ok(!css.includes('.referenceSidebar'),'do not restyle other CRM sections');
assert.equal((source.match(/sb\.from\(/g)||[]).length,5,'no new database reads');
assert.equal((source.match(/sb\.rpc\(/g)||[]).length,2,'only the existing goal RPCs');
console.log('dashboard home: real renderer, summary counts, Madrid date boundary and isolation passed');
