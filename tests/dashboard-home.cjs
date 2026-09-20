'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/dashboard-performance-guard.js','utf8');
const html=fs.readFileSync('index.html','utf8'),runtime=fs.readFileSync('js/modules/runtime.js','utf8'),css=fs.readFileSync('assets/dashboard-home.css','utf8');
const sandbox={window:{TPFModules:{register(){}}},document:{getElementById(){return null}},Intl,Date,Map,setTimeout,clearInterval,setInterval};
vm.runInNewContext(source.replace("M.register('dashboard-performance-guard'","window.testHome={commercialGroups,priorityRows};M.register('dashboard-performance-guard'"),sandbox);
const {commercialGroups:groups,priorityRows}=sandbox.window.testHome;
const stages=new Map([['1',{name:'Seguimiento'}],['2',{name:'Pendiente de tramitar'}],['3',{name:'Tramitado'}],['4',{name:'Ganado'}],['5',{name:'Perdido'}]]);
const data={today:'2026-09-19',opps:[
{id:'follow',stage_id:'1',expected_date:'2026-09-17'},
{id:'pending',stage_id:'2',expected_date:'2026-09-19'},
{id:'done',stage_id:'3'},
{id:'won',stage_id:'4',expected_date:'2026-09-19'},
{id:'lost',stage_id:'5',expected_date:'2026-09-19'},
{id:'closed-follow',stage_id:'1',status:'won',expected_date:'2026-09-19'},
{id:'cancelled',stage_id:'2',status:'cancelled',expected_date:'2026-09-19'}]};
const pending=[
{id:'today-call',agenda_type:'Llamada',starts_at:'2026-09-19T09:00:00+02:00'},
{id:'tomorrow-call',agenda_type:'Llamada',starts_at:'2026-09-20T09:00:00+02:00'},
{id:'midnight-call',agenda_type:'Llamada',starts_at:'2026-09-18T22:30:00Z'},
{id:'overdue-call',agenda_type:'Llamada',starts_at:'2026-09-18T09:00:00Z'},
{id:'today-task',agenda_type:'Tarea',starts_at:'2026-09-19T10:00:00+02:00'}];
const result=groups(data,stages,pending);
assert.deepEqual(Array.from(result,g=>[g.key,g.rows.length]),[['calls',3],['followup',1],['processing',2]]);
assert.equal(result[0].caption,'2 para hoy · 1 atrasada','Madrid date boundary and overdue calls must be accurate');
assert.equal(result[1].rows[0].id,'follow','overdue followups stay visible');
assert.equal(result[2].caption,'1 por tramitar · 1 tramitada');
assert.equal(groups({...data,opps:[]},stages,[]).every(g=>g.rows.length===0),true);
const priorities=priorityRows(data,stages,pending);
assert.equal(priorities.length,6,'all due calls, tasks and open opportunities appear once');
assert.ok(priorities.every(r=>!['won','lost','closed-follow','cancelled','tomorrow-call'].includes(r.id)));
assert.ok(source.includes('<h1>Inicio</h1>')&&source.includes('Tu mesa de trabajo')&&source.includes('Próximos seguimientos'));
assert.ok(!source.includes('Tu día, de un vistazo.')&&!source.includes('Clientes a contactar hoy'));
assert.ok(source.includes('tdPriorityTable')&&source.includes('tdPrevPage')&&source.includes('tdNextPage'),'lists remain usable beyond the first five rows');
const shell=source.slice(source.indexOf('v.innerHTML=`'),source.indexOf('D.built=true;bind();'));
const shellIds=Array.from(shell.matchAll(/\bid="([^"]+)"/g),match=>match[1]);
assert.equal(new Set(shellIds).size,shellIds.length,'Every dashboard control must have one unique ID');
for(const id of ['dashNewOpp','tdAddContact','dashGoalEdit','tdWorkSearch','tdPageSize','tdFocusContent','dashPriorityFollowups','dashActivity','dashFunnel','dashForecastBreakdown','tdActivityCommercial','tdActivityTechnical'])assert.ok(shellIds.includes(id),id+' remains available');
assert.ok(shell.indexOf('tdTableFooter')<shell.indexOf('class="tdFocusZone"'),'The worktable comes before the suggested action');
assert.ok(shell.indexOf('class="tdFocusZone"')<shell.indexOf('class="tdSideRail"'),'Agenda and activity sit below the full-width worktable');
assert.match(shell,/<details class="tdBusinessDetails">/,'Analytics remains available as a complete expandable panel');
assert.ok(source.includes("if(el.closest('.nav[data-view=\"dashboard\"]'))"),'navigation keeps the same renderer');
assert.ok(!html.includes('dashboard-home-pro.js'));
assert.ok(runtime.includes("file==='dashboard-performance-guard.js'?'20260920-inicio-12'"));
assert.match(html,/runtime\.js\?v=20260920-contact-fixes-1/);
assert.ok(!/\.referenceSidebar|\.referenceNav|\.referenceWorkspace/.test(css),'Inicio must not restyle the shared CRM navigation');
assert.ok(!source.includes('scrollIntoView'),'filters never force the page to scroll');
assert.ok(!source.includes('tdPipelineRows'),'do not duplicate and truncate the worklist into previews');
assert.equal((source.match(/sb\.from\(/g)||[]).length,5,'no new database reads');
assert.equal((source.match(/sb\.rpc\(/g)||[]).length,2,'only existing goal RPCs');
assert.ok(!/sb\.(?:from|rpc)[\s\S]{0,100}sendMessage/.test(source));
console.log('dashboard home reference: counts, pending status, Madrid dates, closed exclusions, pagination and scope passed');
