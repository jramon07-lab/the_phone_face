'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/dashboard-performance-guard.js','utf8');
const html=fs.readFileSync('index.html','utf8'),runtime=fs.readFileSync('js/modules/runtime.js','utf8'),css=fs.readFileSync('assets/dashboard-home.css','utf8');
const sandbox={window:{TPFModules:{register(){}}},document:{getElementById(){return null}},Intl,Date,Map,setTimeout,clearInterval,setInterval};
vm.runInNewContext(source.replace("M.register('dashboard-performance-guard'","window.testHome={commercialGroups,priorityRows,renderOperationalFolds,completeTask,D,setRenderer(fn){renderHomePanels=fn}};M.register('dashboard-performance-guard'"),sandbox);
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
assert.deepEqual(Array.from(result,g=>[g.key,g.rows.length]),[['calls',3],['followup',1],['processing',1],['processed',1]]);
assert.equal(result[0].caption,'2 para hoy · 1 atrasada','Madrid date boundary and overdue calls must be accurate');
assert.equal(result[1].rows[0].id,'follow','overdue followups stay visible');
assert.equal(result[2].caption,'1 pendiente de tramitar');
assert.deepEqual(Array.from(result[2].rows,r=>r.id),['pending']);
assert.deepEqual(Array.from(result[3].rows,r=>r.id),['done']);
assert.equal(groups({...data,opps:[]},stages,[]).every(g=>g.rows.length===0),true);
sandbox.window.TPFOfferFollowup={acceptanceTime:id=>({pending:Date.parse('2026-09-18'),done:Date.parse('2026-09-10')})[id]??Infinity};
const withOlderPending={...data,opps:[...data.opps,{id:'older-pending',stage_id:'2',expected_date:'2026-12-01'}]};
sandbox.window.TPFOfferFollowup.acceptanceTime=id=>({pending:Date.parse('2026-09-18'),'older-pending':Date.parse('2026-09-01'),done:Date.parse('2026-08-01')})[id]??Infinity;
assert.deepEqual(Array.from(groups(withOlderPending,stages,pending)[2].rows,r=>r.id),['older-pending','pending'],'pending acceptance order wins over expected date; processed sales stay separate');
sandbox.window.TPFOfferFollowup.acceptanceTime=()=>Infinity;
assert.equal(groups(data,stages,pending)[2].rows[0].id,'pending','legacy records retain a deterministic fallback');
const priorities=priorityRows(data,stages,pending);
assert.equal(priorities.length,6,'all due calls, tasks and open opportunities appear once');
assert.ok(priorities.every(r=>!['won','lost','closed-follow','cancelled','tomorrow-call'].includes(r.id)));
assert.ok(priorityRows({...data,opps:[...data.opps,{id:'old-processed',stage_id:'3',expected_date:'2026-01-01'}]},stages,pending).every(r=>r.id!=='old-processed'),'processed rows never return to the pending worklist');
assert.ok(source.includes('<h1>Tu trabajo de hoy</h1>')&&source.includes('Tu trabajo de hoy')&&source.includes('Próximos seguimientos'));
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
assert.ok(runtime.includes("file==='dashboard-performance-guard.js'?'20260925-workbench-1'"));
assert.match(html,/runtime\.js\?v=[^"\s]+/);
assert.ok(!/\.referenceSidebar|\.referenceNav|\.referenceWorkspace/.test(css),'Inicio must not restyle the shared CRM navigation');
assert.ok(!source.includes('scrollIntoView'),'filters never force the page to scroll');
assert.ok(!source.includes('tdPipelineRows'),'do not duplicate and truncate the worklist into previews');
assert.equal((source.slice(source.indexOf('async function fetchData'),source.indexOf('function removeConfirmed')).match(/sb\.from\(/g)||[]).length,6,'contact identities are read in batches and reminders reuse the shared follow-up read');
assert.equal((source.match(/sb\.rpc\(/g)||[]).length,2,'only existing goal RPCs');
assert.ok(!/sb\.(?:from|rpc)[\s\S]{0,100}sendMessage/.test(source));
console.log('dashboard home reference: counts, pending status, Madrid dates, closed exclusions, pagination and scope passed');
const api=sandbox.window.testHome,elements=new Map(['tdPendingTasks','tdScheduledSends','tdTaskFoldCount','tdSendFoldCount'].map(id=>[id,{}]));sandbox.document.getElementById=id=>elements.get(id)||null;
sandbox.Date=class extends Date{static now(){return Date.parse('2026-10-03T10:00:00Z')}};
const tasks=Array.from({length:12},(_,n)=>({id:String(n),title:n===0?'Tarea <b>texto</b>':'Tarea '+n,customer_name:'Cliente '+n,starts_at:n===0?'2026-10-03T09:00:00Z':'2026-10-03T11:00:00Z',status:'pending',updated_at:'task-version'})),daily={today:'2026-10-03',reminders:[],opps:[],tasks};
api.renderOperationalFolds(daily,tasks);let markup=elements.get('tdPendingTasks').innerHTML;assert.equal((markup.match(/data-complete-task=/g)||[]).length,10);assert.equal((markup.match(/>Gestionar</g)||[]).length,10);assert(!markup.includes('Cambiar fecha'));assert(markup.includes('&lt;b&gt;texto&lt;/b&gt;'));assert(markup.includes('1–10 de 12'));
api.D.taskFilter='late';api.renderOperationalFolds(daily,tasks);assert.equal((elements.get('tdPendingTasks').innerHTML.match(/data-complete-task=/g)||[]).length,1);api.D.taskFilter='today';api.renderOperationalFolds(daily,tasks);assert.equal((elements.get('tdPendingTasks').innerHTML.match(/data-complete-task=/g)||[]).length,10);
api.D.taskFilter='all';api.D.taskPage=1;api.renderOperationalFolds(daily,tasks);assert.equal((elements.get('tdPendingTasks').innerHTML.match(/data-complete-task=/g)||[]).length,2);
(async()=>{const selectors=[];let fail=true,rendered=0,refreshed=0;api.D.data=daily;api.setRenderer(()=>rendered++);sandbox.window.TPFRefreshTasks=()=>refreshed++;sandbox.sb={from(table){assert.equal(table,'agenda_items');const q={update(values){assert.equal(values.status,'completed');return q},eq(key,value){selectors.push([key,value]);return q},select(){return q},async single(){return fail?{error:{code:'PGRST116'}}:{data:{...tasks[0],status:'completed'}}}};return q}};await assert.rejects(api.completeTask('0'),/otro dispositivo/);assert.equal(tasks[0].status,'pending');assert.equal(rendered,0);fail=false;await api.completeTask('0');assert.equal(tasks[0].status,'completed');assert.equal(rendered,1);assert.equal(refreshed,1);assert.deepEqual(selectors.slice(-3),[['id','0'],['status','pending'],['updated_at','task-version']]);console.log('daily tasks: filters, paging, escaping, single editor and verified completion passed')})().catch(e=>{console.error(e);process.exitCode=1});
