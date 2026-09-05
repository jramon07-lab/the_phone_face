(function(){
 'use strict';
 const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let generation=0,names=new Map(),lastData=null,capability={installed:false,enabled:false};
 const author=r=>r?.crm_created_by_name||(r?.crm_actor_kind==='system'?'Sistema · usuario no identificado':names.get(r?.crm_created_by||r?.created_by))||((r?.crm_created_by||r?.created_by)?'Usuario registrado · nombre no disponible':'Autor no registrado');
 function line(r,responsible=true){if(!r)return '';const id=r.assigned_to||r.owner_user_id||r.crm_responsible_id;return '<div class="cpAuthLine">Creado por: '+esc(author(r))+(r.created_at?' · '+esc(new Date(r.created_at).toLocaleString('es-ES')):'')+(responsible?'<br>Responsable: '+esc(id?(names.get(id)||'Usuario asignado · nombre no disponible'):'Sin asignar'):'')+'</div>';}
 window.TPFAuthorship={line,author,get capability(){return capability;}};
 async function inspectCapability(){try{const r=await sb.rpc('crm_welcome_capability');capability=!r.error&&r.data?r.data:{installed:false,enabled:false};}catch(_){capability={installed:false,enabled:false};}return capability;}
 window.TPFAuthorship.refreshCapability=inspectCapability;
 function paint(){
  if(!lastData)return;let contact=null;try{contact=currentContact;}catch(_){}if(String(contact?.id)!==String(lastData.contact?.id))return;
  const left=document.querySelector('#contactModal .cpLeft');if(!left)return;
  let card=$('cpAuthorship');if(!card){card=document.createElement('section');card.id='cpAuthorship';left.appendChild(card);}
  const w=lastData.welcome,status={requested:'Solicitada',pending:'Pendiente de envío',running:'En curso',sent:'Enviada',failed:'Error · revisar antes de reintentar',cancelled:'Cancelada'};
  card.innerHTML='<h3>Autoría y bienvenida</h3>'+line(lastData.contact)+'<p>Bienvenida: '+esc(w?(status[w.status]||w.status):(capability.enabled?'No solicitada':'Pendiente de activar'))+'</p>'+(w?.actor_name?'<small>Etiqueta añadida por '+esc(w.actor_name)+'</small>':'');
  for(const [list,rows,selector] of [['cpTasks',lastData.tasks,'.cpTaskWrap'],['cpOpportunities',lastData.opportunities,'.oppUnifiedCard']]){
   $(list)?.querySelectorAll(selector).forEach(card=>{
    const handlers=[...card.querySelectorAll('[onclick]')].map(n=>n.getAttribute('onclick'));
    const row=(rows||[]).find(r=>handlers.some(h=>h.includes("'"+r.id+"'")||h.includes('"'+r.id+'"')));if(!row)return;
    card.querySelector('.cpAuthLine')?.remove();card.insertAdjacentHTML('beforeend',line(row));
   });
  }
 }
 async function refresh(){
  let contact=null;try{contact=currentContact;}catch(_){}if(!contact?.id)return;
  const id=contact.id,epoch=++generation;lastData=null;
  try{
   await inspectCapability();
   const users=await sb.from('user_permissions').select('user_id,display_name');names=new Map((users.data||[]).map(u=>[u.user_id,u.display_name]));
   let data=null;
   if(capability.installed){const result=await sb.rpc('crm_contact_authorship',{p_contact_id:id});if(!result.error)data=result.data;}
   if(!data){const results=await Promise.all([sb.from('records').select('*').eq('id',id).maybeSingle(),sb.from('agenda_items').select('*').eq('related_record_id',id),sb.from('sales_opportunities').select('*').eq('record_id',id)]);data={contact:results[0].data,tasks:results[1].data||[],opportunities:results[2].data||[]};}
   if(epoch!==generation||!data?.contact)return;lastData=data;paint();
  }catch(_){/* Attribution never blocks the approved contact actions. */}
 }
 function watchCreate(){const box=$('tpfContactsCreateBack'),choice=$('tpfCreateWelcome');if(!box||!choice)return false;
  const update=()=>{const editing=!!box.dataset.editId;choice.closest('.tpfWelcomeChoice').hidden=editing;if(editing)choice.checked=false;};
  new MutationObserver(update).observe(box,{attributes:true,attributeFilter:['data-edit-id','class']});update();return true;
 }
 if(!watchCreate()){const createObserver=new MutationObserver(()=>{if(watchCreate())createObserver.disconnect();});createObserver.observe(document.body,{childList:true});}
 window.addEventListener('tpf:contact-open',refresh);window.addEventListener('tpf:contact-updated',refresh);
 ['cpTasks','cpOpportunities'].forEach(id=>{if($(id))new MutationObserver(changes=>{if(changes.some(c=>c.target===$(id)))paint();}).observe($(id),{childList:true});});
})();
