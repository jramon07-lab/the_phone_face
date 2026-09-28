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
 let badge=$('cpProVerification');if(!badge){badge=button('Verificación pendiente',()=>{const card=$('tpfGoogleInlineCard');if(!card)return;const anchor=document.createComment('verification origin');card.before(anchor);const d=showDialog('CRM, Google y WhatsApp'),details=card.querySelector('details'),wasOpen=details?.open;d.lastElementChild.append(card);if(details)details.open=true;d.addEventListener('close',()=>{if(anchor.isConnected){anchor.after(card);anchor.remove();}if(details)details.open=wasOpen;},{once:true})});badge.id='cpProVerification';identity.append(badge)}
 const status=source?.querySelector('.tpfGoogleInlineStatus'),text=status?.textContent?.trim()||'Verificación pendiente';
 if(badge.textContent!==text)badge.textContent=text;badge.classList.toggle('verified',!!status?.classList.contains('ok'));badge.title='Ver estado de CRM, Google y WhatsApp';
}
function refresh(){if(!modal.classList.contains('hidden'))verification();}
let google=null;
function watch(){const node=$('tpfGoogleInlineCard');if(node&&node!==google){google=node;observe(node,queue,{childList:true,subtree:true,characterData:true})}queue();}
observe(modal,watch,{attributes:true,attributeFilter:['class']});
observe(modal.querySelector('.tpfContactLinkRow'),watch);
window.addEventListener('tpf:contact-open',watch);window.addEventListener('tpf:contact-updated',watch);
window.TPFContactWorkspace={showDialog,showFilePanel,openRelations,refresh:queue};watch();
})();
