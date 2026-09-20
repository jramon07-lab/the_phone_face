/* One presentation and protection layer for the existing shared contact form. */
(function(){
'use strict';
const $=id=>document.getElementById(id),text=v=>String(v??'');
const inputs=['tpfCreateFirst','tpfCreateLast','tpfCreateNickname','tpfCreatePhone','tpfCreateDni','tpfCreateEmail','tpfCreateBank','tpfCreateNotes','tpfCreateObs'];
const noteFields=[['tpfCreateNotes','NOTAS','Notas del contacto','Editar notas'],['tpfCreateObs','OBSERVACIONES','Observaciones','Editar observaciones']];
let session=null;
function readStored(data,key){const names=key==='NOTAS'?['NOTAS','NOTES']:['OBSERVACIONES','OBSERVACION','Observaciones'];for(const name of names)if(data?.[name]!=null)return text(data[name]);return '';}
function resolveText(original,current,locked,latest,label){
 if(locked||current===original)return latest;
 if(original.trim()&&!current.trim())throw Error('No puedes dejar '+label.toLowerCase()+' vacías. Corrige el texto o cancela su edición.');
 if(latest.trim()!==original.trim()&&latest!==current)throw Error(label+' han cambiado en otro dispositivo. Copia tu texto y vuelve a abrir la ficha antes de guardar.');
 return current;
}
function root(){return $('tpfContactsCreateBack');}
function open(){return !!session&&root()===session.root&&!session.root.classList.contains('hidden');}
function fingerprint(){
 const party=$('tpfContactParty');
 let legacy=null;try{legacy=window.TPFContactParty?.read('tpfContactParty')||null;}catch(_){}
 return JSON.stringify([inputs.map(id=>$(id)?.value||''),[...($('tpfCreateLabels')?.querySelectorAll('input:checked')||[])].map(x=>x.value).sort(),window.TPFContactRelations?.contactFingerprint?.(party)||'',legacy,$('tpfCreateWelcome')?.checked||false,$('tpfCreateWelcomeVariant')?.value||'']);
}
function isDirty(){return open()&&fingerprint()!==session.baseline;}
function status(){
 const el=$('tpfEditorSaveState');if(el){const pending=isDirty();el.textContent=pending?'Cambios sin guardar':session?.editing?'Sin cambios pendientes':'Nuevo contacto';el.classList.toggle('pending',pending);}
}
function syncNote(id){
 const field=$(id),panel=field?.closest('.tpfEditorNote');if(!panel)return;
 const locked=field.readOnly,editing=!!session?.editing;
 panel.querySelector('[data-note-unlock]').hidden=!editing||!locked;
 panel.querySelector('[data-note-restore]').hidden=!editing||locked;
 panel.querySelector('[data-note-lock]').textContent=editing?(locked?'Protegidas':'Edición activada'):'Opcional';
 panel.classList.toggle('isEditing',!locked);status();
}
function enhance(back){
 if(!back||back.classList.contains('tpfContactEditor'))return;
 back.classList.add('tpfContactEditor');
 const modal=back.querySelector('.tpfContactsModal');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','tpfContactEditorTitle');
 const title=back.querySelector('h3');title.id='tpfContactEditorTitle';
 const avatar=document.createElement('span');avatar.className='tpfEditorAvatar';avatar.id='tpfEditorAvatar';avatar.setAttribute('aria-hidden','true');title.parentElement.before(avatar);
 const close=$('tpfContactsCreateClose');close.textContent='×';close.setAttribute('aria-label','Cerrar editor de contacto');
 const grid=back.querySelector('.tpfContactsFormGrid'),heading=document.createElement('h4');heading.className='tpfEditorSectionTitle';heading.textContent='Datos del contacto';grid.before(heading);
 const group=document.createElement('div');group.className='tpfEditorNotes';grid.after(group);
 for(const [id,,label,action] of noteFields){
  const field=$(id),container=field.closest('label');container.classList.add('tpfEditorNote');container.classList.remove('full');
  if(container.firstChild?.nodeType===3)container.firstChild.textContent='';
  field.setAttribute('aria-label',label);field.rows=2;
  const head=document.createElement('span');head.className='tpfEditorNoteHead';head.innerHTML='<strong></strong><small data-note-lock></small><span class="tpfEditorNoteActions"><button type="button" class="secondary" data-note-unlock></button><button type="button" class="secondary" data-note-restore hidden>Cancelar edición</button></span>';
  head.querySelector('strong').textContent=label;head.querySelector('[data-note-unlock]').textContent=action;container.prepend(head);group.append(container);
  head.querySelector('[data-note-unlock]').onclick=e=>{e.preventDefault();field.readOnly=false;syncNote(id);field.focus();};
  head.querySelector('[data-note-restore]').onclick=e=>{e.preventDefault();if(session?.notes[id]==null)return;field.value=session.notes[id];field.readOnly=true;syncNote(id);};
 }
 const labels=$('tpfCompactLabels')||$('tpfCreateLabels')?.closest('label');if(labels){group.after(labels);const party=$('tpfContactParty');if(party)labels.after(party);}
 const actions=back.querySelector('.tpfContactsModalActions'),state=document.createElement('span');state.id='tpfEditorSaveState';state.setAttribute('role','status');actions.prepend(state);
 back.addEventListener('input',status);back.addEventListener('change',status);
}
function begin({editing=false}={}){
 const back=root();if(!back)return;enhance(back);
 back.querySelector('.tpfEditorLeaveNotice')?.remove();
 session={root:back,editing,notes:{},baseline:''};
 for(const [id] of noteFields){const field=$(id);session.notes[id]=field.value;field.readOnly=editing;syncNote(id);}
 const name=[$('tpfCreateFirst')?.value,$('tpfCreateLast')?.value].filter(Boolean).join(' '),nickname=$('tpfCreateNickname')?.value;
 $('tpfEditorAvatar').textContent=(name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('')||'+').toLocaleUpperCase('es');
 back.querySelector('.tpfContactsModalHead .small').textContent=editing?[name,nickname].filter(Boolean).join(' · '):'Crea el contacto con sus datos y etiquetas.';
 back.querySelector('.tpfContactsModalBody').scrollTop=0;
 const toggle=$('tpfPickToggle');if(toggle&&toggle.getAttribute('aria-expanded')!=='true')toggle.textContent='Editar etiquetas';
 session.baseline=fingerprint();window.dispatchEvent(new CustomEvent('tpf:editor-baseline',{detail:{root:back}}));status();
}
function readText(previous={}){
 const result={};
 for(const [id,key,label] of noteFields){const field=$(id),value=text(field?.value),original=session?.notes?.[id]??value,latest=readStored(previous,key);result[key]=session?.editing?resolveText(original,value,!!field?.readOnly,latest,label):value;}
 return result;
}
function discardBaseline(){if(!session)return;session.baseline=fingerprint();window.dispatchEvent(new CustomEvent('tpf:editor-baseline',{detail:{root:session.root}}));}
async function visitContact(id,edit=false){
 if(!id||!open())return;
 const current=session;
 const proceed=async()=>{
  if(session!==current||!open())return;
  try{await window.TPFContactRelations?.record?.(id);}catch(error){if(session===current&&open()){const msg=$('tpfContactsCreateMsg');if(msg)msg.textContent='La ficha vinculada ya no está disponible. Puede haberse eliminado o haber cambiado tus permisos.';}return;}
  if(session!==current||!open())return;
  current.root.querySelector('.tpfEditorLeaveNotice')?.remove();discardBaseline();
  $('tpfContactsCreateCancel')?.click();
  if(!current.root.classList.contains('hidden'))return;
  await window.openContact?.(id);
  if(edit)await window.TPFContactsList?.edit(id);
 };
 if(!isDirty())return proceed();
 current.root.querySelector('.tpfEditorLeaveNotice')?.remove();
 const notice=document.createElement('div');notice.className='tpfEditorLeaveNotice';notice.setAttribute('role','alert');
 notice.innerHTML='<strong>Hay cambios sin guardar</strong><p>Guarda el contacto para conservarlos o descártalos antes de abrir otra ficha.</p><button type="button" class="secondary" data-keep>Seguir editando</button><button type="button" class="secondary" data-discard>Descartar y abrir ficha</button>';
 current.root.querySelector('.tpfContactsModalActions').before(notice);
 notice.querySelector('[data-keep]').onclick=()=>notice.remove();notice.querySelector('[data-discard]').onclick=proceed;
}
window.TPFContactEditor={begin,readText,isDirty,owns:el=>open()&&session.root.contains(el),visitContact,resolveText};
})();
