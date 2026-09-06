process.env.TZ='Europe/Madrid';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../js/mobile-app.js'),'utf8');
const testSource=source.replace(/\s*boot\(\);\s*\}\)\(\);\s*$/,`\nwindow.__homeAlerts={state,madridDateKey,noticeItems,noticeMatchesFilter,noticeFilterCounts,noticeListModel,noticeStats,homeDashboardStats,homePriorityRow,renderHome,renderAlertFilters,alertCard,alertResultText,alertRowsHtml,renderAlerts,updateAlertResults,updateAlertDot,handleViewClick};\n})();`);
assert.notEqual(testSource,source,'No se pudo preparar mobile-app.js para la prueba');

const fixedNow=new Date('2026-09-02T08:00:00Z').getTime();
class FixedDate extends Date{static now(){return fixedNow;}}
const dotClasses=new Set(['hidden']);
const nodes={
  mobileAlertFilters:{innerHTML:''},
  mobileAlertResultCount:{textContent:''},
  mobileAlertsList:{innerHTML:''},
  mobileAlertDot:{classList:{toggle(name,force){if(force)dotClasses.add(name);else dotClasses.delete(name);return force;}}}
};
const context={
  window:{},console,Date:FixedDate,Intl,URLSearchParams,setTimeout,clearTimeout,
  location:{hash:'#/home',replace(target){this.hash=target;}},
  history:{length:1,back(){}},
  document:{getElementById(id){return nodes[id]||null;},querySelectorAll(){return [];},querySelector(){return null;}}
};
vm.createContext(context);vm.runInContext(fs.readFileSync('js/modules/record-links.js','utf8'),context);vm.runInContext(fs.readFileSync('js/modules/task-model.js','utf8'),context);
vm.runInContext(testSource,context);

const api=context.window.__homeAlerts;
api.state.user={id:'user-1',email:'ramon@example.com'};
api.state.perms={is_admin:true,display_name:'Ramón Administrador'};
api.state.lastRefresh=fixedNow;
api.state.contacts=[
  {id:'contact-1',fullName:'Ramón Sánchez',dni:'12345678Z',phone:'612345678'},
  {id:'contact-2',fullName:'María Fernández',dni:'87654321X',phone:'698765432'}
];
api.state.tasks=[
  {id:'task-yesterday',title:'Llamada vencida',customer_name:'Ramón Sánchez',related_record_id:'contact-1',starts_at:'2026-09-01T08:00:00Z',status:'pending'},
  {id:'task-today-past',title:'Visita pasada',customer_name:'María Fernández',related_record_id:'contact-2',starts_at:'2026-09-02T06:00:00Z',status:'pending'},
  {id:'task-today-future',title:'Llamar esta tarde',customer_name:'Ramón Sánchez',related_record_id:'contact-1',starts_at:'2026-09-02T16:00:00Z',status:'pending',description:'Confirmar tarifa'},
  {id:'task-next-local-day',title:'Primera hora de mañana',starts_at:'2026-09-02T22:30:00Z',status:'pending'},
  {id:'task-uppercase',title:'Seguimiento',starts_at:'2026-09-03T12:00:00Z',status:'PENDING'},
  {id:'task-invalid',title:'Sin fecha válida',starts_at:'no-es-fecha',status:'pending'},
  {id:'task-completed',title:'Terminada',starts_at:'2026-09-01T08:00:00Z',status:'COMPLETED'}
];
api.state.board={
  stages:[{id:'open-stage',name:'Próximo'},{id:'closed-stage',name:'Ganada'}],
  fields:[],
  opportunities:[
    {id:'opp-yesterday',title:'Renovación vencida',client_name:'Ramón Sánchez',stage_id:'open-stage',expected_date:'2026-09-01',amount:10,status:'open'},
    {id:'opp-today',title:'Venta de hoy',client_name:'María Fernández',stage_id:'open-stage',expected_date:'2026-09-02',amount:25,status:'OPEN'},
    {id:'opp-tomorrow',title:'Venta próxima',client_name:'Cliente futuro',stage_id:'open-stage',expected_date:'2026-09-03',amount:30,status:'open'},
    {id:'opp-undated',title:'Sin fecha',stage_id:'open-stage',expected_date:null,status:'open'},
    {id:'opp-won',title:'Ganada por estado',stage_id:'open-stage',expected_date:'2026-09-02',status:'WON'},
    {id:'opp-closed-stage',title:'Ganada por columna',stage_id:'closed-stage',expected_date:'2026-09-02',status:'open'}
  ]
};

assert.equal(api.madridDateKey('2026-09-02T22:30:00Z'),'2026-09-03','Debe clasificar por el día local de Madrid');
assert.equal(api.madridDateKey('2026-03-29T00:30:00Z'),'2026-03-29','Debe respetar el cambio horario de marzo');
assert.equal(api.madridDateKey('2026-03-29T22:30:00Z'),'2026-03-30','Debe respetar el horario de verano de Madrid');
assert.equal(api.madridDateKey('fecha-invalida'),'');

const items=api.noticeItems(fixedNow);
assert.deepEqual(Array.from(items,item=>item.key),[
  'task:task-yesterday','opportunity:opp-yesterday','task:task-today-past',
  'opportunity:opp-today','task:task-today-future',
  'task:task-next-local-day','opportunity:opp-tomorrow','task:task-uppercase'
]);
assert.equal(new Set(items.map(item=>item.key)).size,items.length,'Cada aviso debe aparecer una sola vez');
assert.equal(items.some(item=>item.key==='task:task-invalid'),false);
assert.equal(items.some(item=>item.key==='task:task-completed'),false);
assert.equal(items.some(item=>item.key==='opportunity:opp-won'),false);
assert.equal(items.some(item=>item.key==='opportunity:opp-closed-stage'),false,'Una columna cerrada no debe generar aviso');

const counts=api.noticeFilterCounts(items);
assert.deepEqual(JSON.parse(JSON.stringify(counts)),{all:8,overdue:3,today:2,upcoming:3,tasks:5,opportunities:3});
assert.deepEqual(Array.from(api.noticeListModel('overdue',fixedNow).rows,item=>item.key),['task:task-yesterday','opportunity:opp-yesterday','task:task-today-past']);
assert.deepEqual(Array.from(api.noticeListModel('today',fixedNow).rows,item=>item.key),['opportunity:opp-today','task:task-today-future']);
assert.equal(api.noticeListModel('desconocido',fixedNow).active,'all');
assert.equal(api.noticeMatchesFilter(items[0],'tasks'),true);
assert.equal(api.noticeMatchesFilter(items[0],'opportunities'),false);
assert.deepEqual(JSON.parse(JSON.stringify(api.noticeStats(fixedNow))),{all:8,overdue:3,today:2,upcoming:3,tasks:5,opportunities:3,expired:3,pending:6,soon:3,urgent:5});

const dashboard=api.homeDashboardStats(fixedNow);
assert.deepEqual(JSON.parse(JSON.stringify(dashboard)),{contacts:2,opportunities:6,month:3,monthAmount:65,tasks:6});
const homeHtml=api.renderHome();
assert.match(homeHtml,/Hola, Ramón/);
assert.match(homeHtml,/data-route="contacts"/);
assert.match(homeHtml,/data-action="open-opportunities" data-filter="month"/);
assert.match(homeHtml,/data-action="open-tasks" data-filter="pending"/);
assert.match(homeHtml,/data-action="open-alerts" data-filter="overdue"/);
assert.match(homeHtml,/Centro de avisos/);
assert.match(homeHtml,/Llamada vencida/);
assert.match(homeHtml,/data-route="whatsapp"/,'Debe conservar el acceso rápido aprobado a WhatsApp');
assert.match(homeHtml,/data-action="start-scan"/,'Debe conservar el escáner aprobado');

const filtersHtml=api.renderAlertFilters(counts,'today');
for(const label of ['Todos','Vencidos','Hoy','Próximos','Tareas','Ventas'])assert.match(filtersHtml,new RegExp(`>${label}<`));
assert.match(filtersHtml,/data-filter="today"[^>]*aria-pressed="true"/);
const taskCard=api.alertCard(items.find(item=>item.key==='task:task-today-future'));
assert.match(taskCard,/Confirmar tarifa/);
assert.match(taskCard,/data-action="complete-task"/);
assert.match(taskCard,/data-route="contact\/contact-1"/);
const opportunityCard=api.alertCard(items.find(item=>item.key==='opportunity:opp-today'));
assert.match(opportunityCard,/data-route="opportunity\/opp-today"/);
assert.match(opportunityCard,/25,00/);
assert.match(opportunityCard,/Próximo/);
assert.match(opportunityCard,/m-alert-badge today">Hoy</);
assert.match(api.renderAlerts(),/id="mobileAlertResultCount"[^>]*aria-live="polite"/);

api.state.alertFilter='all';api.state.alertLimit=40;
api.handleViewClick({target:{closest(){return {dataset:{action:'alert-filter',filter:'today'}};}},preventDefault(){}});
assert.equal(api.state.alertFilter,'today');
assert.match(nodes.mobileAlertFilters.innerHTML,/data-filter="today"[^>]*aria-pressed="true"/);
assert.equal(nodes.mobileAlertResultCount.textContent,'2 avisos');
assert.match(nodes.mobileAlertsList.innerHTML,/Venta de hoy/);
assert.doesNotMatch(nodes.mobileAlertsList.innerHTML,/Renovación vencida/);

api.handleViewClick({target:{closest(){return {dataset:{action:'open-alerts',filter:'overdue'}};}},preventDefault(){}});
assert.equal(api.state.alertFilter,'overdue');
assert.equal(api.state.alertLimit,40);
assert.equal(context.location.hash,'#/alerts');
context.location.hash='#/home';
api.handleViewClick({target:{closest(){return {dataset:{action:'open-tasks',filter:'pending'}};}},preventDefault(){}});
assert.equal(api.state.taskFilter,'pending');
assert.equal(context.location.hash,'#/tasks');
context.location.hash='#/home';
api.state.opportunityQuery='buscar';api.state.opportunityStage='open-stage';api.state.opportunityFilter='closed';
api.handleViewClick({target:{closest(){return {dataset:{action:'open-opportunities',filter:'month'}};}},preventDefault(){}});
assert.equal(api.state.opportunityQuery,'');
assert.equal(api.state.opportunityStage,'');
assert.equal(api.state.opportunityFilter,'month');
assert.equal(context.location.hash,'#/opportunities');

api.state.tasks=Array.from({length:45},(_,index)=>({id:`many-${index}`,title:`Aviso ${index+1}`,starts_at:`2026-09-${String(3+(index%20)).padStart(2,'0')}T12:00:00Z`,status:'pending'}));
api.state.board.opportunities=[];api.state.alertFilter='all';api.state.alertLimit=40;
const pagedModel=api.noticeListModel('all',fixedNow);
assert.equal(api.alertResultText(pagedModel),'Mostrando 40 de 45 avisos');
assert.match(api.alertRowsHtml(pagedModel),/data-action="alert-more"[^>]*>Mostrar 5 más</);
api.handleViewClick({target:{closest(){return {dataset:{action:'alert-more'}};}},preventDefault(){}});
assert.equal(api.state.alertLimit,80);
assert.equal(nodes.mobileAlertResultCount.textContent,'45 avisos');
assert.doesNotMatch(nodes.mobileAlertsList.innerHTML,/data-action="alert-more"/);

api.state.tasks=[{id:'urgent-again',title:'Urgente',starts_at:'2026-09-01T08:00:00Z',status:'pending'}];
api.updateAlertDot();
assert.equal(dotClasses.has('hidden'),false,'La campana debe activarse si hay avisos urgentes');
api.state.tasks=[];api.state.board.opportunities=[{id:'future-only',stage_id:'open-stage',expected_date:'2026-09-10',status:'open'}];
api.updateAlertDot();
assert.equal(dotClasses.has('hidden'),true,'La campana no debe marcar urgencia por avisos únicamente futuros');

console.log('mobile home and alerts: ok');
