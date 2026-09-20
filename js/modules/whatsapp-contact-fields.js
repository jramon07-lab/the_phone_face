/* WhatsApp uses the same field-scoped save service as the contact profile. */
(function(){
'use strict';
const $=id=>document.getElementById(id),view=$('view-whatsapplive');if(!view||innerWidth<1051)return;
const api=()=>window.TPFContactInlineEdit;
const current=()=>{try{return waLiveState.contact;}catch(_){return null;}};
const chatId=()=>{try{return String(waLiveState.selected?.id||'');}catch(_){return '';}};
let session=null,signature='',queued=false,tagBusy=false;
const pencil='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z M14 5l5 5"/></svg>';
function btn(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b;}
function editButton(id){const b=btn('',()=>edit(id));b.innerHTML=pencil;b.className='waFieldPencil';b.dataset.waEdit=id;b.title=b.ariaLabel='Editar '+api().fields[id].label;return b;}
function disclosure(title,id){const d=document.createElement('details');d.className='waFieldDisclosure';d.id=id;const s=document.createElement('summary');s.textContent=title;d.append(s);return d;}
function row(id,host){const f=api().fields[id],r=document.createElement('div');r.className='waFieldRow';r.dataset.waField=id;const l=document.createElement('span');l.textContent=f.label;l.className='waFieldLabel';const value=document.createElement('span');value.className='waFieldValue';const copy=btn('⧉',async()=>{let ok=false;try{const value=api().read(current()?.data,f);ok=window.TPFCopyData?await window.TPFCopyData.copy(value):(await navigator.clipboard.writeText(value),true);}catch(_){}window.TPFCopyData?.notify(ok);copy.textContent=ok?'✓':'⧉';copy.title=ok?'Texto copiado':'No se pudo copiar';setTimeout(()=>{copy.textContent='⧉';copy.title='Copiar '+f.label;},1800);});copy.ariaLabel=copy.title='Copiar '+f.label;copy.className='waFieldCopy';r.append(l,value,copy,editButton(id));host.append(r);return r;}
function close(){if(!session)return;session.box.remove();session.host.classList.remove('waFieldEditing');session=null;}
function valueOf(s){return s.id==='contactName'?JSON.stringify(s.inputs.map(x=>x.value)):s.inputs[0].value;}
function dirty(){return session&&valueOf(session)!==session.original;}
function edit(id){
 if(!api()?.allowed()||!current()?.id)return;
 if(session){if(session.busy||dirty()){session.msg.textContent='Guarda o cancela antes de editar otro campo.';return;}close();}
 const c=current(),f=api().fields[id],host=view.querySelector('[data-wa-field="'+id+'"]')||$('waFieldIdentityEditors'),box=document.createElement('div');box.className='waFieldEditor';box.setAttribute('role','group');box.ariaLabel='Editar '+f.label;
 const original=api().read(c.data,f),values=f.identity?JSON.parse(original):[original],inputs=values.map((v,i)=>{const input=document.createElement(f.multiline?'textarea':'input');if(!f.multiline)input.type=f.type||'text';else input.rows=3;input.value=v;input.ariaLabel=f.identity?(i?'Apellidos':'Nombre'):f.label;box.append(input);return input;});
 const actions=document.createElement('div'),msg=document.createElement('p');msg.setAttribute('role','status');actions.className='waFieldActions';
 const cancel=btn('× Cancelar',()=>{if(!s.busy){close();view.querySelector('[data-wa-edit="'+id+'"]')?.focus();}}),save=btn('✓ Guardar',async()=>{
 if(s.busy||String(current()?.id)!==s.contactId)return;s.busy=true;save.disabled=cancel.disabled=true;inputs.forEach(i=>i.disabled=true);msg.textContent='Guardando…';
 try{const r=await api().saveField({contactId:s.contactId,fieldId:id,original:s.original,value:valueOf(s)});if(String(current()?.id)===s.contactId)current().data=r.data;if(session===s)close();signature='';refresh();window.dispatchEvent(new CustomEvent('tpf:contact-updated',{detail:{id:s.contactId,previous:r.previous,data:r.data,phone:api().read(r.data,api().fields.contactPhone)}}));try{await window.tpfReloadContacts?.();}catch(_){}
 }catch(e){msg.textContent=e.message||'No se pudo guardar. Tu texto sigue aquí.';}finally{s.busy=false;save.disabled=cancel.disabled=false;inputs.forEach(i=>i.disabled=false);}
 });save.dataset.waFieldSave='';cancel.dataset.waFieldCancel='';actions.append(save,cancel);box.append(actions,msg);host.append(box);host.classList.add('waFieldEditing');const s={id,host,box,msg,inputs,original,contactId:String(c.id),chatId:chatId(),record:c,busy:false};session=s;
 box.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel.click();}else if(e.key==='Enter'&&(!f.multiline||e.ctrlKey||e.metaKey)){e.preventDefault();save.click();}};inputs[0].focus();box.scrollIntoView({block:'nearest'});
}
function compactOpportunities(){for(const card of view.querySelectorAll('#waSideOpps .oppUnifiedCard:not([data-wa-compact])')){card.dataset.waCompact='1';const d=disclosure('Detalles','');for(const el of [...card.querySelectorAll('.oppUnifiedNotes,.oppUnifiedStageControl,.oppUnifiedActions .danger')])d.append(el);card.append(d);}}
async function tags(){
 const c=current(),chips=[...view.querySelectorAll('#waSideTags .waGlobalTagChip:not([data-wa-label])')];if(!c?.id||!chips.length||tagBusy||!api()?.allowed())return;tagBusy=true;
 try{const rows=await crmGetContactLabels(c.id);if(String(current()?.id)!==String(c.id))return;for(const chip of chips){if(!chip.isConnected)continue;const label=rows.find(x=>x.name===chip.textContent.trim());if(!label)continue;chip.dataset.waLabel=label.id;const remove=btn('×',async()=>{if(remove.disabled)return;remove.disabled=true;try{await crmChangeSingleContactLabel(c.id,label.id,false);if(String(current()?.id)===String(c.id))await waRefreshGlobalContactTags();crmShowLabelUndo(c.id,label.id,label.name);renderWhatsAppChats();}catch(e){alert(e.message||'No se pudo quitar la etiqueta.');remove.disabled=false;}});remove.ariaLabel='Quitar etiqueta '+label.name;chip.append(remove);}}catch(_){}finally{tagBusy=false;}
}
function refresh(){
 if(!$('waFieldDetails'))return;let c=current();if(session&&(chatId()!==session.chatId||(c&&String(c.id)!==session.contactId)))close();if(!c&&session)c=session.record;
 const open=$('waSideOpenContact');if(open)open.style.setProperty('display','none','important');
 const nick=$('waSideNickname'),emptyNick=$('waFieldEmptyNickname');if(emptyNick)emptyNick.hidden=!c?.id||!!nick?.textContent.trim();
 for(const el of view.querySelectorAll('.waFieldsBlock,#waFieldIdentityEditors,[data-wa-edit="contactName"],[data-wa-edit="contactNickname"]'))el.hidden=!c?.id;
 const next=JSON.stringify([c?.id,c?.data,api()?.allowed()]);if(next!==signature){signature=next;for(const el of view.querySelectorAll('[data-wa-field]')){const f=api().fields[el.dataset.waField],value=api().read(c?.data,f);el.querySelector('.waFieldValue').textContent=value||'Sin añadir';el.querySelector('.waFieldCopy').hidden=!value;el.querySelector('.waFieldPencil').hidden=!api().allowed();}for(const id of ['contactName','contactNickname'])view.querySelector('[data-wa-edit="'+id+'"]')?.toggleAttribute('hidden',!c?.id||!api().allowed());}
 for(const peek of view.querySelectorAll('[data-peek]')){const v=api().read(c?.data,api().fields[peek.dataset.peek]).replace(/\s+/g,' ').slice(0,70);if(peek.textContent!==v)peek.textContent=v;}compactOpportunities();tags();
}
function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;refresh();},100);}
function install(){if($('waFieldDetails')||!view.classList.contains('waCleanWorkspace')||!api())return;
 view.classList.add('waFieldsReady');const identity=$('waSideIdentity'),block=document.createElement('div');block.id='waFieldDetails';block.className='waFieldsBlock';identity.after(block);row('contactPhone',block);row('contactDni',block);
 const more=disclosure('Más datos','waFieldMore');row('contactEmail',more);row('contactBank',more);block.append(more);
 for(const [id,title]of [['contactObservations','Observaciones'],['contactNotes','Notas de ficha']]){const d=disclosure(title,'waField-'+id);row(id,d);if(id==='contactNotes'){const hint=document.createElement('small');hint.textContent='Edición protegida';d.append(hint);}const peek=document.createElement('small');peek.className='waFieldPeek';peek.dataset.peek=id;d.firstChild.append(peek);block.append(d);}
 const editor=document.createElement('div');editor.id='waFieldIdentityEditors';$('waSideName').parentElement.append(editor);$('waSideName').after(editButton('contactName'));const nick=$('waSideNickname'),emptyNick=document.createElement('span');emptyNick.id='waFieldEmptyNickname';emptyNick.textContent='Añadir apodo';(nick||$('waSideName')).after(emptyNick);emptyNick.after(editButton('contactNickname'));
 const tagsSection=$('waSideTags')?.closest('.waSideSection');if(tagsSection)$('waCleanRelations').after(tagsSection);
 const notes=$('waSideNotes')?.closest('.waSideSection');if(notes)notes.classList.add('waNativeNotes');
 new MutationObserver(schedule).observe($('waContactCard'),{childList:true,subtree:true});refresh();
}
window.addEventListener('click',e=>{if(!session||!e.target.closest?.('.waChatRow,.nav,#waSideName,#waCleanManageRelations,#waCleanManageOffers,[data-wa-edit],#waSideNewOffer,#waSideDirectSale,#waCleanReview'))return;if(e.target.closest('[data-wa-edit]'))return;if(session.busy||(dirty()&&!confirm('Hay cambios sin guardar. ¿Quieres descartarlos?'))){e.preventDefault();e.stopImmediatePropagation();return;}close();},true);
window.addEventListener('beforeunload',e=>{if(dirty()||session?.busy){e.preventDefault();e.returnValue='';}});
window.addEventListener('tpf:contact-updated',()=>{signature='';schedule();});
new MutationObserver(install).observe(view,{attributes:true,attributeFilter:['class']});install();
})();
