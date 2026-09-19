/* Offline fixture: synthetic records only. No credentials, API calls or message sending. */
(function(){
'use strict';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const month=today.slice(0,7);
const stages=['Próximo','Este mes','Seguimiento','Pendiente de tramitar','Tramitado','Ganado','Perdido','Antiguos'].map((name,i)=>({id:String(i),name,position:i,active:true}));
const counts=[8,18,4,2,1,4,2,0];
const names=['María López','Carlos Sánchez','Ana Torres','Javier Martín','Lucía Ramírez','Sonia Navarro'];
let sequence=0;
const opps=stages.flatMap((stage,index)=>Array.from({length:counts[index]},(_,i)=>({
id:'demo-opp-'+(++sequence),stage_id:stage.id,status:index===5?'won':index===6?'lost':'open',
client_name:names[i%names.length],phone:'60000000'+(i%6+1),title:['Tarifa + móvil','Solo tarifa','Renovación','Cambio de operador','Fibra y móvil'][i%5],
amount:[34,46,59,27][i%4],expected_date:index===0?'2030-12-01':i<2?today:month+'-01',
created_at:today+'T08:00:00Z',updated_at:today+'T08:00:00Z'
})));
const tasks=[
{id:'demo-task-1',customer_name:'Pedro Gómez',customer_phone:'600000011',agenda_type:'Tarea',title:'Revisar documentación',description:'Revisar los documentos de la tramitación.',starts_at:today+'T10:00:00+02:00',status:'pending'},
{id:'demo-task-2',customer_name:'Sara Delgado',customer_phone:'600000012',agenda_type:'Tarea',title:'Seguimiento de oferta',description:'Llamar para revisar la propuesta con el cliente.',starts_at:today+'T12:00:00+02:00',status:'pending'},
...Array.from({length:7},(_,i)=>({id:'demo-call-'+i,customer_name:names[i%names.length],customer_phone:'60000002'+i,agenda_type:'Llamada',title:'Llamada de seguimiento',starts_at:(i<4?today:month+'-01')+'T13:00:00+02:00',status:'pending'}))
];
const activity=[{id:'demo-log-1',entity_type:'opportunity',entity_id:'demo-opp-1',action:'updated',summary:'Propuesta de ejemplo actualizada',created_at:today+'T09:00:00Z'},{id:'demo-log-2',entity_type:'task',entity_id:'demo-task-1',action:'updated',summary:'Revisión de ejemplo programada',created_at:today+'T08:45:00Z'}];
const empty=new URLSearchParams(location.search).get('empty')==='1';
const tableData={sales_opportunities:empty?[]:opps,sales_stages:stages,agenda_items:empty?[]:tasks,records:[],crm_audit_log:empty?[]:activity};
function query(table){const value={data:tableData[table]||[],count:table==='records'?(empty?0:1282):undefined};const chain={};for(const key of ['select','order','limit','eq'])chain[key]=()=>chain;chain.then=(resolve,reject)=>Promise.resolve(value).then(resolve,reject);return chain}
window.sb={from:query,rpc:async name=>name==='crm_get_month_goal'?{data:{target_amount:1500,target_opportunities:20}}:{error:{message:'Guardado desactivado: datos ficticios.'}}};
window.TPFModules={register(name,module){module.install()}};
const output=document.getElementById('fixtureAction');document.getElementById('tpfContactsAdd').onclick=()=>{output.textContent='Formulario de contacto abierto (prueba sin guardar).'};
for(const name of ['openOpportunityFull','openOpportunityCard','openAlertTask','editAlertTask','openContact'])window[name]=id=>{output.textContent='Apertura de prueba: '+id};
for(const name of ['deleteOpp','deleteAlertTask'])window[name]=()=>{output.textContent='Borrado desactivado en esta verificación.'};
document.querySelectorAll('.referenceSidebar .nav').forEach(button=>button.addEventListener('click',()=>{
document.querySelectorAll('main > section').forEach(section=>section.classList.toggle('hidden',section.id!=='view-'+button.dataset.view));
document.querySelectorAll('.referenceSidebar .nav').forEach(nav=>nav.classList.toggle('active',nav===button));
output.textContent='';
}));
})();
