process.env.TZ='Europe/Madrid';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../js/mobile-app.js'),'utf8');
const testSource=source.replace(/\s*boot\(\);\s*\}\)\(\);\s*$/,`\nwindow.__mobileAgenda={state,validAgendaDateKey,shiftAgendaDateKey,agendaSelectedDate,agendaDateLabel,agendaDayUtcRange,agendaDateTime,agendaListModel,agendaTaskCard,renderAgenda,renderHome,handleViewClick};\n})();`);
assert.notEqual(testSource,source,'No se pudo preparar mobile-app.js para la prueba');

const fixedNow=new Date('2026-09-02T08:00:00Z').getTime();
class FixedDate extends Date{static now(){return fixedNow;}}
const nodes={
  mobileApp:{classList:{contains(){return false;}}},
  mobileView:{innerHTML:'',scrollTop:0},
  mobileAdd:{classList:{toggle(){}}}
};
const context={
  window:{},console,Date:FixedDate,Intl,URLSearchParams,setTimeout,clearTimeout,confirm(){return true;},
  location:{hash:'#/agenda?date=2026-09-02',replace(value){this.hash=value;}},history:{length:1,back(){}},
  document:{getElementById(id){return nodes[id]||null;},querySelectorAll(){return [];},querySelector(){return null;}}
};
vm.createContext(context);
vm.runInContext(testSource,context);

const api=context.window.__mobileAgenda;
api.state.user={id:'test-user',email:'ramon@example.com'};
api.state.perms={is_admin:true,display_name:'Ramón'};
api.state.tasks=[
  {id:'morning',title:'Llamada de mañana',customer_name:'Ana',status:'pending',starts_at:'2026-09-02T07:00:00Z'},
  {id:'afternoon',title:'Cita de tarde',customer_name:'Luis',status:'completed',starts_at:'2026-09-02T16:00:00Z'},
  {id:'cancelled',title:'Cita cancelada',customer_name:'Eva',status:'cancelled',starts_at:'2026-09-02T18:00:00Z'},
  {id:'next-midnight',title:'Ya es mañana en Madrid',status:'pending',starts_at:'2026-09-02T22:30:00Z'},
  {id:'other-day',title:'Otro día',status:'pending',starts_at:'2026-09-04T08:00:00Z'}
];

assert.equal(api.validAgendaDateKey('2026-09-02'),true);
assert.equal(api.validAgendaDateKey('2026-02-30'),false);
assert.equal(api.shiftAgendaDateKey('2026-09-01',-1),'2026-08-31');
assert.equal(api.shiftAgendaDateKey('2026-12-31',1),'2027-01-01');
assert.equal(api.agendaSelectedDate({query:new URLSearchParams('date=2026-09-03')},fixedNow),'2026-09-03');
assert.equal(api.agendaSelectedDate({query:new URLSearchParams('date=no')},fixedNow),'2026-09-02');
assert.deepEqual(JSON.parse(JSON.stringify(api.agendaDayUtcRange('2026-09-02'))),{start:'2026-09-01T22:00:00.000Z',end:'2026-09-02T22:00:00.000Z'});
assert.deepEqual(JSON.parse(JSON.stringify(api.agendaDayUtcRange('2026-01-02'))),{start:'2026-01-01T23:00:00.000Z',end:'2026-01-02T23:00:00.000Z'});
assert.match(api.agendaDateTime('2026-09-02T22:30:00Z'),/03\/09\/2026.*00:30/);
assert.match(source,/\.gte\('starts_at',range\.start\)\.lt\('starts_at',range\.end\)/);

const model=api.agendaListModel('2026-09-02',api.state.tasks);
assert.deepEqual(Array.from(model.rows,row=>row.id),['morning','afternoon','cancelled']);
assert.equal(model.pending,1);
assert.equal(model.completed,1);
assert.equal(model.cancelled,1);
assert.match(api.agendaTaskCard(api.state.tasks[2]),/Cancelada/);

api.state.agenda={date:'2026-09-02',rows:model.rows,loading:false,loaded:true,error:'',requestId:1};
const agendaHtml=api.renderAgenda();
assert.match(agendaHtml,/Agenda/);
assert.match(agendaHtml,/id="mobileAgendaDate"[^>]*value="2026-09-02"/);
assert.match(agendaHtml,/Llamada de mañana/);
assert.match(agendaHtml,/Cita de tarde/);
assert.match(agendaHtml,/Cita cancelada/);
assert.doesNotMatch(agendaHtml,/Ya es mañana en Madrid|Otro día/);
assert.match(agendaHtml,/data-route="tasks"/);

const homeHtml=api.renderHome();
assert.match(homeHtml,/data-action="route" data-route="agenda"><span>◷<\/span><small>Agenda<\/small>/);
assert.doesNotMatch(homeHtml,/data-action="open-desktop"><span>◷<\/span><small>Agenda<\/small>/);

api.handleViewClick({target:{closest(){return {dataset:{action:'agenda-day',date:'2026-09-03'}};}},preventDefault(){}});
assert.equal(context.location.hash,'#/agenda?date=2026-09-03');

console.log('mobile agenda: ok');
