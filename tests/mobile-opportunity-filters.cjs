process.env.TZ='Europe/Madrid';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../js/mobile-app.js'),'utf8');
const testSource=source.replace(/\s*boot\(\);\s*\}\)\(\);\s*$/,`\nwindow.__opportunityFilters={state,opportunityDateKey,opportunityIsClosed,opportunityMatchesFilter,filterOpportunities,opportunityFilterCounts,opportunityContactIndex,opportunityMatchesSearch,opportunityListModel,opportunityDisplayState,opportunityListCard,renderOpportunityFilters,handleViewClick};\n})();`);
assert.notEqual(testSource,source,'No se pudo preparar mobile-app.js para la prueba');

const fixedNow=new Date('2026-09-02T10:00:00+02:00').getTime();
class FixedDate extends Date{static now(){return fixedNow;}}
const nodes={
  mobileOpportunityFilters:{innerHTML:''},
  mobileOpportunityResultCount:{textContent:''},
  mobileOpportunitiesList:{innerHTML:''}
};
const context={
  window:{},console,Date:FixedDate,Intl,URLSearchParams,setTimeout,clearTimeout,
  location:{hash:'#/opportunities'},
  document:{getElementById(id){return nodes[id]||null;},querySelectorAll(){return [];}}
};
vm.createContext(context);
vm.runInContext(testSource,context);

const api=context.window.__opportunityFilters;
api.state.contacts=[
  {id:'contact-1',fullName:'Ramón Sánchez López',dni:'12345678Z',phone:'+34 612 345 678',email:'ramon@example.com'},
  {id:'contact-2',fullName:'María Fernández',dni:'87654321X',phone:'698765432',email:''}
];
api.state.board={
  stages:[{id:'stage-1',name:'Próximo'},{id:'stage-2',name:'Oferta pasada'}],
  fields:[],
  opportunities:[
    {id:'today',record_id:'contact-1',stage_id:'stage-1',title:'Renovación fibra',client_name:'Ramón Sánchez López',expected_date:'2026-09-02',amount:25,status:'open',updated_at:'2026-09-06'},
    {id:'overdue',record_id:'contact-2',stage_id:'stage-1',title:'Revisión atrasada',client_name:'María Fernández',expected_date:'2026-09-01',amount:30,status:'open',updated_at:'2026-09-05'},
    {id:'upcoming',stage_id:'stage-2',title:'Cambio móvil',client_name:'Cliente externo',phone:'611222333',expected_date:'2026-09-10',amount:null,status:'open',updated_at:'2026-09-04'},
    {id:'undated',stage_id:'stage-2',title:'Pendiente sin fecha',client_name:'Sin fecha',expected_date:null,amount:0,status:'open',updated_at:'2026-09-03'},
    {id:'won',stage_id:'stage-2',title:'Venta ganada',client_name:'Cliente ganado',expected_date:'2026-09-03',amount:80,status:'won',updated_at:'2026-09-02'},
    {id:'lost',stage_id:'stage-2',title:'Venta perdida',client_name:'Cliente perdido',expected_date:'2026-08-20',amount:50,status:'lost',updated_at:'2026-09-01'}
  ]
};

const opportunities=api.state.board.opportunities;
assert.deepEqual(JSON.parse(JSON.stringify(api.opportunityFilterCounts(opportunities,fixedNow))),{all:6,today:1,overdue:1,upcoming:1,closed:2});
assert.deepEqual(Array.from(api.filterOpportunities(opportunities,'today',fixedNow),row=>row.id),['today']);
assert.deepEqual(Array.from(api.filterOpportunities(opportunities,'overdue',fixedNow),row=>row.id),['overdue']);
assert.deepEqual(Array.from(api.filterOpportunities(opportunities,'upcoming',fixedNow),row=>row.id),['upcoming']);
assert.deepEqual(Array.from(api.filterOpportunities(opportunities,'closed',fixedNow),row=>row.id),['won','lost']);
assert.equal(api.filterOpportunities(opportunities,'desconocido',fixedNow).length,6);
assert.equal(api.opportunityIsClosed({status:'CERRADA'}),true);
assert.equal(api.opportunityIsClosed({status:'open'}),false);
assert.equal(api.opportunityIsClosed({status:'open'},{name:'Ganada'}),true,'Una columna terminal debe contar como cerrada');
assert.equal(api.opportunityMatchesFilter({status:'open',expected_date:'2026-09-10'},'closed',fixedNow,{name:'Cerrada'}),true);
assert.deepEqual(JSON.parse(JSON.stringify(api.opportunityDisplayState({status:'open',expected_date:'2026-09-10'},fixedNow,{name:'Ganada'}))),{label:'Ganada',tone:'green'});
assert.equal(api.opportunityIsClosed({status:'cancelled'}),true);

const searchContext={
  contacts:api.opportunityContactIndex(api.state.contacts),
  stages:new Map(api.state.board.stages.map(stage=>[String(stage.id),stage]))
};
assert.equal(api.opportunityMatchesSearch(opportunities[0],'12345678z',searchContext),true,'Debe buscar el DNI del contacto vinculado');
assert.equal(api.opportunityMatchesSearch(opportunities[0],'612345678',searchContext),true,'Debe buscar el teléfono del contacto vinculado');
assert.equal(api.opportunityMatchesSearch(opportunities[0],'sanchez',searchContext),true,'Debe ignorar tildes al buscar nombres');
assert.equal(api.opportunityMatchesSearch(opportunities[2],'611 222 333',searchContext),true,'Debe buscar el teléfono guardado en la oportunidad');
assert.equal(api.opportunityMatchesSearch(opportunities[2],'oferta pasada',searchContext),true,'Debe buscar por columna');
assert.equal(api.opportunityMatchesSearch(opportunities[2],'no existe',searchContext),false);

let model=api.opportunityListModel('', 'stage-1', 'all', fixedNow);
assert.deepEqual(Array.from(model.rows,row=>row.id),['today','overdue']);
assert.deepEqual(JSON.parse(JSON.stringify(model.counts)),{all:2,today:1,overdue:1,upcoming:0,closed:0});
model=api.opportunityListModel('12345678Z','stage-1','today',fixedNow);
assert.deepEqual(Array.from(model.rows,row=>row.id),['today']);

const filterHtml=api.renderOpportunityFilters(api.opportunityFilterCounts(opportunities,fixedNow),'upcoming');
for(const label of ['Todas','Hoy','Vencidas','Próximas','Cerradas'])assert.match(filterHtml,new RegExp(`>${label}<`));
assert.match(filterHtml,/data-action="opportunity-filter" data-filter="upcoming"[^>]*aria-pressed="true"/);

const card=api.opportunityListCard(opportunities[0],searchContext,fixedNow);
assert.match(card,/data-route="opportunity\/today"/);
assert.match(card,/Ramón Sánchez López · \+34 612 345 678/);
assert.match(card,/02\/09\/2026/);
assert.match(card,/class="m-badge amber">Hoy/);
assert.match(card,/Columna \/ estado/);
assert.match(card,/Próximo/);

api.state.opportunityQuery='';api.state.opportunityStage='';api.state.opportunityFilter='all';
const target={dataset:{action:'opportunity-filter',filter:'overdue'}};
api.handleViewClick({target:{closest(){return target;}},preventDefault(){}});
assert.equal(api.state.opportunityFilter,'overdue');
assert.match(nodes.mobileOpportunitiesList.innerHTML,/Revisión atrasada/);
assert.doesNotMatch(nodes.mobileOpportunitiesList.innerHTML,/Renovación fibra|Cambio móvil|Venta ganada/);
assert.equal(nodes.mobileOpportunityResultCount.textContent,'1 oportunidad');
assert.match(nodes.mobileOpportunityFilters.innerHTML,/data-filter="overdue"[^>]*aria-pressed="true"/);

console.log('mobile opportunity filters: ok');
