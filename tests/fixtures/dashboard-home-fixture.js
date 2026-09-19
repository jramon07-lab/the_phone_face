/* Offline fixture: synthetic records only. No credentials, API calls or message sending. */
(function(){
'use strict';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const month=today.slice(0,7);
const stages=['Próximo','Este mes','Seguimiento','Pendiente de tramitar','Tramitado','Ganado','Perdido','Antiguos'].map((name,i)=>({id:String(i),name,position:i,active:true}));
const counts=[8,18,7,5,6,4,2,0];
const names=['Cliente de ejemplo A','Cliente de ejemplo B','Cliente de ejemplo C','Cliente de ejemplo D','Cliente de ejemplo E','Cliente de ejemplo F'];
let sequence=0;
const opps=stages.flatMap((stage,index)=>Array.from({length:counts[index]},(_,i)=>({
id:'demo-opp-'+(++sequence),stage_id:stage.id,status:index===5?'won':index===6?'lost':'open',
client_name:names[i%names.length],title:['Revisión de fibra y móvil','Cambio de operador','Oferta de fibra 1 Gb'][i%3],
amount:[34,46,59,27][i%4],expected_date:index===0?'2030-12-01':i<2?today:month+'-01',
created_at:today+'T08:00:00Z',updated_at:today+'T08:00:00Z'
})));
const tasks=[{id:'demo-task-1',customer_name:'Cliente de ejemplo A',title:'Revisar propuesta de fibra',starts_at:today+'T09:30:00+02:00',status:'pending'},{id:'demo-task-2',customer_name:'Cliente de ejemplo B',title:'Llamada de seguimiento',starts_at:today+'T12:00:00+02:00',status:'pending'},{id:'demo-task-3',customer_name:'Cliente de ejemplo C',title:'Confirmar documentación',starts_at:'2030-12-01T10:00:00+01:00',status:'pending'}];
const activity=[{id:'demo-log-1',entity_type:'opportunity',entity_id:'demo-opp-1',action:'updated',summary:'Propuesta de ejemplo actualizada',created_at:today+'T09:00:00Z'},{id:'demo-log-2',entity_type:'task',entity_id:'demo-task-1',action:'updated',summary:'Revisión de ejemplo programada',created_at:today+'T08:45:00Z'}];
const empty=new URLSearchParams(location.search).get('empty')==='1';
const tableData={sales_opportunities:empty?[]:opps,sales_stages:stages,agenda_items:empty?[]:tasks,records:[],crm_audit_log:empty?[]:activity};
function query(table){const value={data:tableData[table]||[],count:table==='records'?(empty?0:1282):undefined};const chain={};for(const key of ['select','order','limit','eq'])chain[key]=()=>chain;chain.then=(resolve,reject)=>Promise.resolve(value).then(resolve,reject);return chain}
window.sb={from:query,rpc:async name=>name==='crm_get_month_goal'?{data:{target_amount:1500,target_opportunities:20}}:{error:{message:'Guardado desactivado: datos ficticios.'}}};
window.TPFModules={register(name,module){module.install()}};
const output=document.getElementById('fixtureAction');
for(const name of ['openOpportunityFull','openOpportunityCard','openAlertTask','editAlertTask','openContact'])window[name]=id=>{output.textContent='Apertura de prueba: '+id};
for(const name of ['deleteOpp','deleteAlertTask'])window[name]=()=>{output.textContent='Borrado desactivado en esta verificación.'};
document.querySelectorAll('.fixtureSidebar .nav').forEach(button=>button.addEventListener('click',()=>{
document.querySelectorAll('main > section').forEach(section=>section.classList.toggle('hidden',section.id!=='view-'+button.dataset.view));
document.querySelectorAll('.fixtureSidebar .nav').forEach(nav=>nav.classList.toggle('active',nav===button));
output.textContent='';
}));
})();
