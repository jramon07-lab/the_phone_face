process.env.TZ='Europe/Madrid';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../js/mobile-app.js'),'utf8');
const testSource=source.replace(/\s*boot\(\);\s*\}\)\(\);\s*$/,`\nwindow.__taskFilters={state,taskMatchesFilter,filterTasks,taskFilterCounts,renderTaskFilters,handleViewClick};\n})();`);
assert.notEqual(testSource,source,'No se pudo preparar mobile-app.js para la prueba');

const fixedNow=new Date('2026-09-02T08:00:00Z').getTime();
class FixedDate extends Date{static now(){return fixedNow;}}
const view={innerHTML:'',scrollTop:-1};
const nodes={
  mobileApp:{classList:{contains(){return false;}}},
  mobileView:view,
  mobileAdd:{classList:{toggle(){}}}
};
const context={
  window:{},console,Date:FixedDate,Intl,URLSearchParams,setTimeout,clearTimeout,
  location:{hash:'#/tasks'},
  document:{getElementById(id){return nodes[id]||null;},querySelectorAll(){return [];}}
};
vm.createContext(context);
vm.runInContext(testSource,context);

const api=context.window.__taskFilters;
const now=fixedNow;
const tasks=[
  {id:'today-past',title:'Hoy pasada',status:'pending',starts_at:'2026-09-02T06:00:00Z'},
  {id:'today-future',title:'Hoy futura',status:'pending',starts_at:'2026-09-02T16:00:00Z'},
  {id:'yesterday',title:'Ayer pendiente',status:'pending',starts_at:'2026-09-01T08:00:00Z'},
  {id:'tomorrow',title:'Mañana pendiente',status:'pending',starts_at:'2026-09-03T08:00:00Z'},
  {id:'invalid',title:'Fecha inválida',status:'pending',starts_at:'sin-fecha'},
  {id:'completed-yesterday',title:'Ayer completada',status:'completed',starts_at:'2026-09-01T08:00:00Z'},
  {id:'completed-today',title:'Hoy completada',status:'completed',starts_at:'2026-09-02T07:00:00Z'}
];

assert.deepEqual(JSON.parse(JSON.stringify(api.taskFilterCounts(tasks,now))),{all:7,pending:5,today:2,overdue:2,completed:2});
assert.deepEqual(Array.from(api.filterTasks(tasks,'today',now),task=>task.id),['today-past','today-future']);
assert.deepEqual(Array.from(api.filterTasks(tasks,'overdue',now),task=>task.id),['today-past','yesterday']);
assert.deepEqual(Array.from(api.filterTasks(tasks,'completed',now),task=>task.id),['completed-yesterday','completed-today']);
assert.equal(api.filterTasks(tasks,'desconocido',now).length,7);
const nextLocalDay={status:'pending',starts_at:'2026-09-02T22:30:00Z'};
assert.equal(api.taskMatchesFilter(nextLocalDay,'today',new Date('2026-09-02T20:00:00Z').getTime()),false);
assert.equal(api.taskMatchesFilter(nextLocalDay,'today',new Date('2026-09-02T23:00:00Z').getTime()),true);

const html=api.renderTaskFilters(api.taskFilterCounts(tasks,now),'today');
for(const label of ['Todas','Pendientes','Hoy','Vencidas','Completadas'])assert.match(html,new RegExp(`>${label}<`));
assert.match(html,/data-action="task-filter" data-filter="today"[^>]*aria-pressed="true"/);

api.state.user={id:'test'};api.state.perms={is_admin:true};api.state.tasks=tasks;
const target={dataset:{action:'task-filter',filter:'today'}};
api.handleViewClick({target:{closest(){return target;}},preventDefault(){}});
assert.equal(api.state.taskFilter,'today');
assert.match(view.innerHTML,/Hoy pasada/);
assert.match(view.innerHTML,/Hoy futura/);
assert.doesNotMatch(view.innerHTML,/Ayer pendiente|Mañana pendiente|Hoy completada/);
assert.match(view.innerHTML,/data-filter="today"[^>]*aria-pressed="true"/);

console.log('mobile task filters: ok');
