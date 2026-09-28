/* Customer workspace: reuse native data/actions; no background polling or business-state writes. */
(function(){
'use strict';
const $=id=>document.getElementById(id),modal=$('contactModal');if(!modal)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const current=()=>{try{return currentContact}catch(_){return null}};
const desktop=()=>modal.classList.contains('tpfContactReference');
let scheduled=false,oppFilter='active',oppQuery='',historyQuery='',historyType='all',dialog=null;
const observe=(node,fn,options={childList:true})=>{if(node)new MutationObserver(fn).observe(node,options)};
function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;refresh()})}
function button(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b}
function closeDialog(){dialog?.close()}
function showDialog(title){
 closeDialog();const trigger=document.activeElement,d=document.createElement('dialog');d.className='cpProDialog';
 d.setAttribute('aria-label',title);d.innerHTML='<header><h2>'+esc(title)+'</h2><button type="button" aria-label="Cerrar">×</button></header><div class="cpProDialogBody"></div>';
 d.querySelector('header button').onclick=()=>d.close();d.onclick=e=>{if(e.target===d)d.close()};
 d.addEventListener('close',()=>{d.remove();if(dialog===d)dialog=null;if(trigger?.isConnected)trigger.focus()},{once:true});
 document.body.append(d);d.showModal();dialog=d;return d;
}
function showFilePanel(title){
 if(!desktop())return showDialog(title);
 closeDialog();
 const pane=$('cpDocumentsPending'),d=document.createElement('section');
 d.className='cpProFilePanel';d.setAttribute('aria-label',title);
 d.innerHTML='<header><h2>'+esc(title)+'</h2><button type="button" aria-label="Cerrar vista previa">×</button></header><div class="cpProDialogBody"></div>';
 d.close=()=>{d.remove();pane?.classList.remove('cpProWithPreview');if(dialog===d)dialog=null};
 d.querySelector('header button').onclick=d.close;
 pane?.append(d);pane?.classList.add('cpProWithPreview');dialog=d;return d;
}
function recentDocuments(){
 const right=modal.querySelector('.cpRight');if(!right||!desktop())return;
 let section=$('cpProRecentDocs');
 if(!section){section=document.createElement('section');section.id='cpProRecentDocs';section.innerHTML='<header><h3>Documentos recientes</h3><button type="button">Ver todos</button></header><div></div>';section.querySelector('button').onclick=()=>$('cpRefTab-documentos')?.click();right.append(section)}
 const files=[...$('cpDocumentsPending')?.querySelectorAll('[data-doc-row]')||[]].slice(0,3),body=section.lastElementChild;
 const key=JSON.stringify([current()?.id,files.map(f=>[f.dataset.docRow,f.textContent])]);if(body.dataset.key===key)return;body.dataset.key=key;
 body.replaceChildren();
 if(!files.length){const p=document.createElement('p');p.textContent='Consulta los archivos y la conexión en Documentos.';body.append(p)}
 for(const file of files){const b=button(file.querySelector('b')?.textContent||'Documento',()=>{$('cpRefTab-documentos')?.click();file.querySelector('[data-doc-preview]')?.click()});const small=document.createElement('small');small.textContent=file.querySelector('small')?.textContent||'';b.append(small);body.append(b)}
}
function openRelations(){
 const c=current(),R=window.TPFContactRelations;if(!c?.id||!R)return;
 const d=showDialog('Titulares y gestores'),body=d.lastElementChild;body.textContent='Comprobando vínculos…';
 R.sidebarSnapshot(c).then(snapshot=>{
  if(!d.isConnected||current()?.id!==c.id)return d.close();
  const own=R.identity(c),holders=snapshot.holders,managers=snapshot.managers;
  const card=(person,role)=>'<article class="cpProPerson"><small>'+esc(role)+'</small><strong>'+esc(person.name||'Sin nombre')+'</strong><span>'+esc(person.phone||'Sin teléfono')+'</span><button type="button" data-person="'+esc(person.record_id)+'">Ver ficha</button></article>';
  body.innerHTML='<div class="cpProPeople">'+(holders.length?holders.map(h=>card(h,'Titular del contrato')).join('')+card(own,'Gestiona estos titulares'):card(own,'Titular de esta ficha'))+managers.map(m=>card(m,'Gestor de esta ficha')).join('')+'</div>'+(snapshot.legacy?'<p>También hay datos de un titular anterior: '+esc(snapshot.legacy)+'. Revisa el vínculo antes de enviar una oferta.</p>':'')+'<p class="cpProNotice">'+(holders.length?'Para las ofertas de estos titulares, revisa que el destinatario sea '+esc(own.name)+'.':managers.length?'Al enviar la oferta podrás comprobar el gestor y el teléfono destinatario.':'Este contacto no tiene otros titulares o gestores vinculados.')+'</p><div class="cpProActions"><button type="button" data-manage>+ Añadir o cambiar vínculo</button></div><small>Una relación, visible desde ambas fichas. Quitar un vínculo no elimina contactos.</small>';
  body.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>{d.close();window.openContact?.(b.dataset.person)});
  body.querySelector('[data-manage]').onclick=()=>{d.close();$('tpfContactEditToggle')?.click()};
  const removals=[...holders.map(h=>({manager:own.record_id,holder:h.record_id,name:h.name})),...managers.map(m=>({manager:m.record_id,holder:own.record_id,name:m.name}))];
  for(const relation of removals){const b=button('Quitar vínculo con '+relation.name,async()=>{
   if(!confirm('¿Quitar este vínculo? Las dos fichas se conservarán.'))return;b.disabled=true;
   try{await R.removeManagedLink(relation.manager,relation.holder);d.close();await window.openContact?.(c.id);window.dispatchEvent(new CustomEvent('tpf:contact-updated',{detail:{id:relation.manager}}))}catch(e){b.disabled=false;let error=body.querySelector('[role=status]');if(!error){error=document.createElement('p');error.setAttribute('role','status');body.append(error)}error.textContent=e.message}
  });b.className='cpProDanger';body.querySelector('.cpProActions').append(b)}
 }).catch(e=>{if(d.isConnected)body.textContent='No se pudieron comprobar los vínculos: '+e.message});
}
function verification(){
 const identity=modal.querySelector('.cpIdentity'),source=$('tpfGoogleInlineCard');if(!identity||!desktop())return;
 let badge=$('cpProVerification');if(!badge){badge=button('Verificación pendiente',()=>{const card=$('tpfGoogleInlineCard'),details=card?.querySelector('details');if(details)details.open=!details.open;card?.scrollIntoView({block:'nearest',behavior:'auto'})});badge.id='cpProVerification';identity.append(badge)}
 const status=source?.querySelector('.tpfGoogleInlineStatus'),text=status?.textContent?.trim()||'Verificación pendiente';
 if(badge.textContent!==text)badge.textContent=text;badge.classList.toggle('verified',!!status?.classList.contains('ok'));badge.title='Ver estado de CRM, Google y WhatsApp';
}
function opportunityState(card){
 const id=card.dataset.oppId;let row=null;try{row=salesCache?.opportunities?.find(x=>String(x.id)===id)}catch(_){}
 if(row){const stage=(()=>{try{return salesCache.stages?.find(s=>String(s.id)===String(row.stage_id))?.name||''}catch(_){return ''}})();return ['won','lost','closed','ganado','perdido'].includes(norm(row.status))||/^(viejo|historico|ganad[oa]|perdid[oa])/.test(norm(stage))?'history':'active'}
 return /^(viejo|historico|ganad[oa]|perdid[oa])/.test(norm(card.querySelector('select option:checked')?.textContent))?'history':'active';
}
function opportunities(){
 const list=$('cpOpportunities');if(!list)return;
 let tools=$('cpProOppTools');if(!tools){tools=document.createElement('div');tools.id='cpProOppTools';tools.className='cpProToolbar';tools.innerHTML='<div><button type="button" data-opp-filter="active">Actuales</button><button type="button" data-opp-filter="history">Históricas</button><button type="button" data-opp-filter="all">Todas</button></div><input type="search" aria-label="Buscar oportunidad del cliente" placeholder="Buscar oportunidad…">';list.before(tools);tools.onclick=e=>{const b=e.target.closest('[data-opp-filter]');if(b){oppFilter=b.dataset.oppFilter;opportunities()}};tools.querySelector('input').oninput=e=>{oppQuery=e.target.value;opportunities()}}
 const cards=[...list.querySelectorAll(':scope > .oppUnifiedCard')],selected=modal.querySelector('.cpRight')?.dataset.cpRefSelected;
 for(const b of tools.querySelectorAll('button')){const key=b.dataset.oppFilter,count=cards.filter(c=>key==='all'||opportunityState(c)===key).length;const text=({active:'Actuales',history:'Históricas',all:'Todas'})[key]+' · '+count;if(b.textContent!==text)b.textContent=text;b.setAttribute('aria-pressed',String(oppFilter===key))}
 let shown=0;for(const card of cards){const state=opportunityState(card),visible=(selected==='resumen'?state==='active':oppFilter==='all'||state===oppFilter)&&norm(card.textContent).includes(norm(oppQuery));card.classList.toggle('cpProFiltered',desktop()&&!visible);if(visible)shown++}
 let empty=$('cpProOppEmpty');if(!empty){empty=document.createElement('p');empty.id='cpProOppEmpty';empty.textContent='No hay oportunidades con este filtro.';list.after(empty)}empty.hidden=!cards.length||shown>0||!desktop();
}
function history(){
 const timeline=$('cpTimeline');if(!timeline)return;
 let tools=$('cpProHistoryTools');if(!tools){tools=document.createElement('div');tools.id='cpProHistoryTools';tools.className='cpProToolbar';tools.innerHTML='<input type="search" aria-label="Buscar en el historial" placeholder="Buscar en el historial…"><select aria-label="Tipo de actividad"><option value="all">Toda la actividad</option><option value="offer">Ofertas</option><option value="opp">Oportunidades</option><option value="task">Tareas</option><option value="note">Notas</option><option value="updated">Cambios</option></select>';timeline.before(tools);tools.querySelector('input').oninput=e=>{historyQuery=e.target.value;history()};tools.querySelector('select').onchange=e=>{historyType=e.target.value;history()}}
 for(const card of timeline.querySelectorAll('.cpEvent')){const type=norm(card.className+' '+card.querySelector('b')?.textContent);const match=historyType==='all'||({offer:/offer|oferta/,opp:/opp|oportunidad/,task:/task|tarea/,note:/note|nota/,updated:/updated|actualiz|modific/})[historyType].test(type);card.classList.toggle('cpProFiltered',desktop()&&(!match||!norm(card.textContent).includes(norm(historyQuery))))}
}
function summary(){
 const root=$('tpfSummaryAccordion');if(!root)return;
 let heading=$('cpProSummary');if(!heading){heading=document.createElement('section');heading.id='cpProSummary';root.before(heading)}
 const tasks=[...$('cpTasks')?.querySelectorAll('.cpTaskWrap')||[]].filter(c=>c.dataset.taskStatus==='pending').sort((a,b)=>(Date.parse(a.dataset.taskStarts)||Infinity)-(Date.parse(b.dataset.taskStarts)||Infinity));
 const opps=[...$('cpOpportunities')?.querySelectorAll('.oppUnifiedCard')||[]].filter(c=>opportunityState(c)==='active');
 const offers=[...$('cpOffersSection')?.querySelectorAll('.cpOfferCard,.cpOfferItem')||[]];
 const task=tasks[0],next=task?.querySelector('.cpTaskButton'),key=JSON.stringify([current()?.id,tasks.length,opps.length,offers.length,next?.textContent]);
 if(heading.dataset.content===key)return;heading.dataset.content=key;
 heading.innerHTML='<h2>Resumen del cliente</h2><div class="cpProMetrics"><button type="button" data-go="offers"><b>'+offers.length+'</b> ofertas</button><button type="button" data-go="oportunidades"><b>'+opps.length+'</b> oportunidades actuales</button><button type="button" data-go="tareas"><b>'+tasks.length+'</b> tareas pendientes</button></div>'+(next?'<div class="cpProNext"><div><small>Próxima tarea</small><strong>'+esc(next.querySelector('b')?.textContent)+'</strong><span>'+esc(next.querySelector('span')?.textContent)+'</span></div><button type="button" data-next>Ver tarea</button></div>':'');
 heading.querySelector('[data-next]')?.addEventListener('click',()=>next.click());
 heading.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{if(b.dataset.go==='offers'){const g=root.querySelector('[data-tpf-summary-group="offers"]');if(g?.dataset.tpfOpen!=='true')g?.querySelector('.tpfSummaryTrigger')?.click();g?.scrollIntoView({block:'nearest'})}else $('cpRefTab-'+b.dataset.go)?.click()});
}
function refresh(){if(modal.classList.contains('hidden'))return;watchSources();verification();opportunities();history();summary();recentDocuments()}
document.addEventListener('click',e=>{if(desktop()&&e.target.closest('#tpfContactPartySummary [data-rel-holders] > summary')){e.preventDefault();e.stopImmediatePropagation();openRelations()}else if(e.target.closest('[data-cp-ref-tab]'))queue()},true);
window.addEventListener('tpf:contact-open',()=>{closeDialog();oppFilter='active';oppQuery='';historyQuery='';historyType='all';for(const id of ['cpProOppTools','cpProHistoryTools']){const root=$(id);if(root){root.querySelector('input').value='';if(root.querySelector('select'))root.querySelector('select').value='all'}}queue()});
window.addEventListener('tpf:contact-updated',queue);
observe(modal,queue,{attributes:true,attributeFilter:['class']});
for(const id of ['cpOpportunities','cpTasks','cpTimeline','cpDocumentsPending'])observe($(id),queue);
let google=null,offerList=null;function watchSources(){const node=$('tpfGoogleInlineCard');if(node&&node!==google){google=node;observe(node,queue,{childList:true,subtree:true,characterData:true})}const offers=$('cpOfferInstances');if(offers&&offers!==offerList){offerList=offers;observe(offers,queue)}}
observe(modal.querySelector('.cpRight'),queue);observe(modal.querySelector('.tpfContactLinkRow'),queue);window.addEventListener('tpf:sales-updated',queue);
window.TPFContactWorkspace={openRelations,refresh:queue,opportunityState,showDialog,showFilePanel};queue();
})();
