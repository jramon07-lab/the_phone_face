/* Customer workspace: reuse native data/actions; no background polling or business-state writes. */
(function(){
'use strict';
const $=id=>document.getElementById(id),modal=$('contactModal');if(!modal)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const current=()=>{try{return currentContact}catch(_){return null}};
const desktop=()=>modal.classList.contains('tpfContactReference');
let scheduled=false,oppFilter='active',oppQuery='',historyQuery='',historyType='all',dialog=null,selectedOpp='';
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
 if(!section){section=document.createElement('section');section.id='cpProRecentDocs';section.innerHTML='<header><h3>Documentos recientes</h3><button type="button">Ver todos</button></header><div></div>';section.querySelector('button').onclick=()=>$('cpRefTab-documentos')?.click();($('tpfSummaryAccordion')||right).append(section)}
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
 if(row){const stage=(()=>{try{return salesCache.stages?.find(s=>String(s.id)===String(row.stage_id))?.name||''}catch(_){return ''}})();return ['won','lost','closed','ganado','perdido'].includes(norm(row.status))||/^(viejo|antiguo|historico|ganad[oa]|perdid[oa])/.test(norm(stage))?'history':'active'}
 return /^(viejo|antiguo|historico|ganad[oa]|perdid[oa])/.test(norm(card.querySelector('select option:checked')?.textContent))?'history':'active';
}
function opportunities(){
 const list=$('cpOpportunities');if(!list)return;
 let tools=$('cpProOppTools');if(!tools){tools=document.createElement('div');tools.id='cpProOppTools';tools.className='cpProToolbar';tools.innerHTML='<div><button type="button" data-opp-filter="active">Actuales</button><button type="button" data-opp-filter="history">Históricas</button><button type="button" data-opp-filter="all">Todas</button></div><input type="search" aria-label="Buscar oportunidad del cliente" placeholder="Buscar oportunidad…">';list.before(tools);tools.onclick=e=>{const b=e.target.closest('[data-opp-filter]');if(b){oppFilter=b.dataset.oppFilter;opportunities();opportunityDetail()}};tools.querySelector('input').oninput=e=>{oppQuery=e.target.value;opportunities();opportunityDetail()}}
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
 const nextHtml=next?'<strong>Próxima acción · '+esc(next.querySelector('b')?.textContent)+'</strong><span>'+esc(next.querySelector('span')?.textContent)+'</span>':'<strong>Planifica el próximo contacto</strong><span>No hay tareas pendientes para este cliente.</span>';
 heading.innerHTML='<h2>Resumen del cliente</h2><div class="cpProNext"><div>'+nextHtml+'</div><button type="button" '+(next?'data-next':'data-plan')+'>'+(next?'Ver tarea':'Nueva tarea')+'</button></div><div class="cpProMetrics"><button type="button" data-go="offers"><b>'+offers.length+'</b> '+(offers.length===1?'oferta':'ofertas')+'</button><button type="button" data-go="oportunidades"><b>'+opps.length+'</b> '+(opps.length===1?'oportunidad':'oportunidades')+'</button><button type="button" data-go="tareas"><b>'+tasks.length+'</b> '+(tasks.length===1?'tarea pendiente':'tareas pendientes')+'</button></div>';
 heading.querySelector('[data-plan]')?.addEventListener('click',()=>$('cpSideNewTask')?.click());
 heading.querySelector('[data-next]')?.addEventListener('click',()=>next.click());
 heading.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{if(b.dataset.go==='offers'){const g=root.querySelector('[data-tpf-summary-group="offers"]');if(g?.dataset.tpfOpen!=='true')g?.querySelector('.tpfSummaryTrigger')?.click();g?.scrollIntoView({block:'nearest'})}else $('cpRefTab-'+b.dataset.go)?.click()});
}
function opportunityDetail(){
 const list=$('cpOpportunities');if(!list||!desktop())return;
 const pane=list.closest('[data-cp-ref-pane]');if(!pane)return;
 let split=$('cpProOppSplit');
 if(!split){split=document.createElement('div');split.id='cpProOppSplit';split.className='cpProOppSplit';const main=document.createElement('div');main.className='cpProOppList';const detail=document.createElement('aside');detail.id='cpProOppDetail';detail.className='cpProOppDetail';detail.setAttribute('aria-label','Detalle de la oportunidad');list.before(split);split.append(main,detail);main.append(list);}
 const main=split.firstElementChild;for(const id of ['cpProOppTools','cpProOppEmpty']){const el=$(id);if(el&&el.parentElement!==main){if(id==='cpProOppTools')main.prepend(el);else main.append(el);}}
 const cards=[...list.querySelectorAll('.oppUnifiedCard')].filter(c=>!c.classList.contains('cpProFiltered'));
 if(!cards.some(c=>c.dataset.oppId===selectedOpp))selectedOpp=cards[0]?.dataset.oppId||'';
 for(const card of list.querySelectorAll('.oppUnifiedCard'))card.classList.toggle('cpProSelected',card.dataset.oppId===selectedOpp);
 const out=$('cpProOppDetail');let row=null,stages=[];try{row=salesCache.opportunities.find(o=>String(o.id)===selectedOpp);stages=salesCache.stages||[];}catch(_){}
 const key=JSON.stringify([current()?.id,row,stages]);if(out.dataset.key===key)return;out.dataset.key=key;
 if(!row){out.innerHTML='<h3>Detalle de la oportunidad</h3><p>Selecciona una oportunidad de la lista.</p>';return;}
 const card=cards.find(c=>c.dataset.oppId===selectedOpp),stage=stages.find(st=>String(st.id)===String(row.stage_id));
 const money=new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(row.amount)||0);
 const party=row.contract_party||{},holder=party.holder_name||row.client_name||$('contactName')?.value||'Sin indicar',manager=party.manager_name||party.contact_name||$('contactName')?.value||'Sin indicar';
 const date=value=>value?new Date(value.length===10?value+'T12:00':value).toLocaleDateString('es-ES'):'Sin fecha';
 const note=card?.querySelector('.oppUnifiedNotes')?.textContent||row.notes||'Sin notas para esta oportunidad.';
 out.innerHTML='<h3>Detalle de la oportunidad</h3><h3>'+esc(row.title||'Oportunidad')+'</h3><span class="cpProOppStage">'+esc(stage?.name||row.status||'Sin estado')+'</span><p class="cpProOppPrice">'+esc(money)+'</p><dl><dt>Titular</dt><dt>Gestión</dt><dd>'+esc(holder)+'</dd><dd>'+esc(manager)+'</dd><dt>Fecha prevista</dt><dt>Creada</dt><dd>'+esc(date(row.expected_date))+'</dd><dd>'+esc(date(row.created_at))+'</dd></dl><div class="cpProOppSteps">'+stages.map(st=>'<span class="'+(String(st.id)===String(row.stage_id)?'active':'')+'">'+esc(st.name)+'</span>').join('')+'</div><div class="cpProActions"><button type="button" class="primary" data-edit-opportunity>Editar oportunidad</button><button type="button" class="secondary" data-opportunity-task>Crear tarea</button></div><h4>Notas de la oportunidad</h4><p>'+esc(note)+'</p><h4>Seguimiento</h4><p>Consulta las ofertas y los mensajes programados de este cliente en Resumen.</p><button type="button" class="secondary" data-opportunity-summary>Ver seguimiento</button>';
 out.querySelector('[data-edit-opportunity]').onclick=()=>window.openOpportunityCard?.(selectedOpp);
 out.querySelector('[data-opportunity-task]').onclick=()=>$('cpSideNewTask')?.click();
 out.querySelector('[data-opportunity-summary]').onclick=()=>$('cpRefTab-resumen')?.click();
}
function relationsPreview(){
 const source=$('tpfContactPartySummary');if(!source||!desktop())return;
 let preview=$('cpProRelationsPreview');if(!preview){preview=document.createElement('div');preview.id='cpProRelationsPreview';preview.className='cpProRelationsPreview';source.before(preview);}
 const c=current(),data=c?.data||{},links=data.TPF_RELACIONES?.managed_contacts||[],legacy=data.TPF_TITULAR,own=$('contactName')?.value||'';
 const holders=links.map(x=>x.name).filter(Boolean);if(legacy?.same===false&&legacy.holder_name&&!holders.includes(legacy.holder_name))holders.push(legacy.holder_name);
 const key=JSON.stringify([c?.id,holders,own]);if(preview.dataset.key===key)return;preview.dataset.key=key;
 preview.replaceChildren();if(holders.length){const title=document.createElement('small');title.textContent='Titular'+(holders.length>1?'es':'')+' del contrato';const b=button(holders.join(' · '),openRelations);const manager=document.createElement('div');manager.textContent='Gestión: '+own;preview.append(title,b,manager);}else{const b=button('Ver titulares y gestores',openRelations);preview.append(b);}
}
document.addEventListener('click',e=>{
 const card=e.target.closest?.('#cpOpportunities .oppUnifiedCard');if(!desktop()||!card)return;
 const edit=e.target.closest('button');if(edit&&/Ver \/ editar|Ver detalle/.test(edit.textContent)){e.preventDefault();e.stopImmediatePropagation();selectedOpp=card.dataset.oppId;$('cpRefTab-oportunidades')?.click();opportunityDetail();}
 else if(!e.target.closest('button,select,input,details')){selectedOpp=card.dataset.oppId;opportunityDetail();}
},true);
// Keep the native composer and persistence handlers; only dock its shell to this client.
const nativeComposer=window.openAgendaComposer;
if(typeof nativeComposer==='function'){
 window.openAgendaComposer=function(prefill={},origin={}){
  const within=desktop()&&!modal.classList.contains('hidden'),contact=current(),tab=modal.querySelector('.cpRight')?.dataset.cpRefSelected;
  if(!within)return nativeComposer.call(this,prefill,origin);
  const restore=()=>{document.body.classList.remove('cpWorkspaceTask');if(!modal.classList.contains('hidden'))$('cpRefTab-'+(tab||'tareas'))?.click();};
  const callbacks={...origin,onCancel:(...args)=>{restore();return origin.onCancel?.(...args);},onSaved:async(...args)=>{restore();if(origin.onSaved)return origin.onSaved(...args);if(current()?.id===contact?.id&&typeof renderContactProfile==='function')await renderContactProfile();}};
  const result=nativeComposer.call(this,prefill,callbacks);document.body.classList.add('cpWorkspaceTask');
  const options=$('agendaCreateCard')?.querySelector('.agendaCompactOptions');if(options)options.open=true;
  return result;
 };
}
observe($('agendaCreateCard'),()=>{if(!$('agendaCreateCard')?.classList.contains('open'))document.body.classList.remove('cpWorkspaceTask');},{attributes:true,attributeFilter:['class']});
function refresh(){document.body.classList.toggle('cpWorkspaceOpen',desktop()&&!modal.classList.contains('hidden'));if(modal.classList.contains('hidden'))return;watchSources();verification();opportunities();opportunityDetail();history();summary();recentDocuments();relationsPreview();}
document.addEventListener('click',e=>{if(desktop()&&e.target.closest('#tpfContactPartySummary [data-rel-holders] > summary')){e.preventDefault();e.stopImmediatePropagation();openRelations()}else if(e.target.closest('[data-cp-ref-tab]'))queue()},true);
window.addEventListener('tpf:contact-open',()=>{closeDialog();selectedOpp='';oppFilter='active';oppQuery='';historyQuery='';historyType='all';for(const id of ['cpProOppTools','cpProHistoryTools']){const root=$(id);if(root){root.querySelector('input').value='';if(root.querySelector('select'))root.querySelector('select').value='all'}}queue()});
window.addEventListener('tpf:contact-updated',queue);
observe(modal,queue,{attributes:true,attributeFilter:['class']});
for(const id of ['cpOpportunities','cpTasks','cpTimeline','cpDocumentsPending'])observe($(id),queue);
let google=null,offerList=null;function watchSources(){const node=$('tpfGoogleInlineCard');if(node&&node!==google){google=node;observe(node,queue,{childList:true,subtree:true,characterData:true})}const offers=$('cpOfferInstances');if(offers&&offers!==offerList){offerList=offers;observe(offers,queue)}}
observe(modal.querySelector('.cpRight'),queue);observe(modal.querySelector('.tpfContactLinkRow'),queue);window.addEventListener('tpf:sales-updated',queue);
window.TPFContactWorkspace={openRelations,refresh:queue,opportunityState,showDialog,showFilePanel};queue();
})();
