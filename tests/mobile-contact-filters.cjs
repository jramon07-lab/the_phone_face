const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../js/mobile-app.js'),'utf8');
const testSource=source.replace(/\s*boot\(\);\s*\}\)\(\);\s*$/,`\nwindow.__contactFilters={state,contactActivityIndex,contactMatchesSearch,contactMatchesFilter,contactFilterCounts,contactListModel,contactCard,renderContactFilters,contactRowsHtml,contactResultText,handleViewClick};\n})();`);
assert.notEqual(testSource,source,'No se pudo preparar mobile-app.js para la prueba');

const nodes={
  mobileContactFilters:{innerHTML:''},
  mobileContactResultCount:{textContent:''},
  mobileContactsList:{innerHTML:''}
};
const context={
  window:{},console,Date,Intl,URLSearchParams,setTimeout,clearTimeout,
  location:{hash:'#/contacts'},history:{length:1},
  document:{getElementById(id){return nodes[id]||null;},querySelectorAll(){return [];}}
};
vm.createContext(context);
vm.runInContext(testSource,context);

const api=context.window.__contactFilters;
api.state.contacts=[
  {id:'c1',fullName:'Ramón Sánchez',phone:'+34 612 345 678',dni:'12345678Z',email:'ramon@example.com'},
  {id:'c2',fullName:'María López',phone:'698765432',dni:'',email:'maria@example.com'},
  {id:'c3',fullName:'José Álvarez',phone:'',dni:'87654321X',email:''},
  {id:'c4',fullName:'Sin Datos',phone:'',dni:'',email:'sin@example.com'}
];
api.state.board={
  stages:[{id:'open',name:'Próximo'},{id:'closed',name:'Ganada'}],
  fields:[],
  opportunities:[
    {id:'o1',record_id:'c1',stage_id:'open',status:'open'},
    {id:'o2',record_id:'c2',stage_id:'closed',status:'won'},
    {id:'orphan',record_id:'missing',stage_id:'open',status:'open'}
  ]
};
api.state.tasks=[
  {id:'t1',related_record_id:'c1',status:'pending'},
  {id:'t2',related_record_id:'c2',status:'completed'},
  {id:'t3',related_record_id:'c3',status:'pending'},
  {id:'orphan-task',related_record_id:'missing',status:'pending'}
];

const activity=api.contactActivityIndex();
assert.deepEqual(JSON.parse(JSON.stringify(activity.get('c1'))),{opportunities:1,pendingTasks:1});
assert.deepEqual(JSON.parse(JSON.stringify(activity.get('c2'))),{opportunities:0,pendingTasks:0},'Las ventas cerradas no cuentan como seguimiento abierto');

for(const [query,id] of [['sanchez','c1'],['jose alvarez','c3'],['12345678z','c1'],['612 345 678','c1'],['ramon@example.com','c1']]){
  assert.equal(api.contactMatchesSearch(api.state.contacts.find(contact=>contact.id===id),query),true,`Debe encontrar ${query}`);
}
assert.equal(api.contactMatchesSearch(api.state.contacts[0],'no existe'),false);
assert.equal(api.contactMatchesSearch({fullName:'Cruce',dni:'12A',phone:'345',email:''},'234'),false,'No debe unir los números de DNI y teléfono');

const counts=api.contactFilterCounts(api.state.contacts,activity);
assert.deepEqual(JSON.parse(JSON.stringify(counts)),{all:4,opportunities:1,tasks:2,untracked:2,incomplete:3});
assert.equal(api.contactMatchesFilter(api.state.contacts[0],'opportunities',activity),true);
assert.equal(api.contactMatchesFilter(api.state.contacts[2],'tasks',activity),true);
assert.equal(api.contactMatchesFilter(api.state.contacts[1],'untracked',activity),true);
assert.equal(api.contactMatchesFilter(api.state.contacts[3],'incomplete',activity),true);
assert.equal(api.contactMatchesFilter(api.state.contacts[0],'desconocido',activity),true,'Un filtro desconocido vuelve a Todos');

let model=api.contactListModel('sanchez','all');
assert.deepEqual(Array.from(model.rows,contact=>contact.id),['c1']);
assert.deepEqual(JSON.parse(JSON.stringify(model.counts)),{all:1,opportunities:1,tasks:1,untracked:0,incomplete:0},'Los contadores se recalculan tras buscar');
model=api.contactListModel('','untracked');
assert.deepEqual(Array.from(model.rows,contact=>contact.id),['c2','c4']);

const filters=api.renderContactFilters(counts,'untracked');
for(const label of ['Todos','Con ventas','Con tareas','Sin seguimiento','Incompletos'])assert.match(filters,new RegExp(`>${label}<`));
assert.match(filters,/data-action="contact-filter" data-filter="untracked"[^>]*aria-pressed="true"/);

const card=api.contactCard(api.state.contacts[0],activity);
assert.match(card,/data-route="contact\/c1"/);
assert.match(card,/Ramón Sánchez/);
assert.match(card,/\+34 612 345 678/);
assert.match(card,/12345678Z/);
assert.match(card,/ramon@example\.com/);
assert.match(card,/1 venta abierta/);
assert.match(card,/1 tarea pendiente/);

api.state.contactQuery='';api.state.contactFilter='all';api.state.contactLimit=60;
const filterTarget={dataset:{action:'contact-filter',filter:'tasks'}};
api.handleViewClick({target:{closest(){return filterTarget;}},preventDefault(){}});
assert.equal(api.state.contactFilter,'tasks');
assert.match(nodes.mobileContactsList.innerHTML,/Ramón Sánchez/);
assert.match(nodes.mobileContactsList.innerHTML,/José Álvarez/);
assert.doesNotMatch(nodes.mobileContactsList.innerHTML,/María López/);
assert.equal(nodes.mobileContactResultCount.textContent,'2 contactos');

api.state.contacts=Array.from({length:61},(_,index)=>({id:`bulk-${index}`,fullName:`Contacto ${index}`,phone:'600000000',dni:'12345678Z',email:''}));
api.state.board={stages:[],fields:[],opportunities:[]};api.state.tasks=[];api.state.contactFilter='all';api.state.contactLimit=60;
model=api.contactListModel();
assert.equal(api.contactResultText(model),'Mostrando 60 de 61 contactos');
assert.match(api.contactRowsHtml(model),/data-action="contact-more"/);
const moreTarget={dataset:{action:'contact-more'}};
api.handleViewClick({target:{closest(){return moreTarget;}},preventDefault(){}});
assert.equal(api.state.contactLimit,120);
assert.equal(nodes.mobileContactResultCount.textContent,'61 contactos');

const routeTarget={dataset:{action:'route',route:'contact/bulk-0'}};
api.handleViewClick({target:{closest(){return routeTarget;}},preventDefault(){}});
assert.equal(context.location.hash,'#/contact/bulk-0','La tarjeta conserva la apertura de la ficha');

console.log('mobile contact filters: ok');
