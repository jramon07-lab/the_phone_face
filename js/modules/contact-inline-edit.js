/* Field-scoped editing: the profile's native inputs remain protected. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const fields={
 contactPhone:{label:'Teléfono',keys:['TELÉFONO','TELEFONO','PHONE','MOVIL'],type:'tel'},
 contactDni:{label:'DNI / NIF',keys:['DNI / NIF','DNI','NIF']},
 contactObservations:{label:'Observaciones',keys:['OBSERVACIONES','OBSERVACION','Observaciones'],multiline:true},
 contactNotes:{label:'Notas',keys:['NOTAS','NOTES'],multiline:true},
 contactBank:{label:'Banco / IBAN',keys:['BANCO','Banco']},
 contactEmail:{label:'Correo electrónico',keys:['EMAIL','CORREO','CORREO ELECTRÓNICO','Email','email'],type:'email'}
};
const read=(data,config)=>{for(const key of config.keys)if(data?.[key]!=null)return String(data[key]);return '';};
function allowed(){return typeof perms!=='undefined'&&!!(perms?.is_admin||perms?.can_edit_records);}
function contact(){try{return typeof currentContact!=='undefined'?currentContact:null;}catch(_){return null;}}
function prepare(data,id,original,value){
 const config=fields[id];if(!config)throw Error('Campo no válido.');
 value=config.multiline?String(value):String(value).trim();
 if(id==='contactEmail'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw Error('Revisa el correo electrónico.');
 if(id==='contactPhone'&&value&&!/^\+?[\d\s().-]{6,25}$/.test(value))throw Error('Revisa el teléfono.');
 if(id==='contactPhone'&&value&&(value.replace(/\D/g,'').length<6||value.replace(/\D/g,'').length>15))throw Error('Revisa el teléfono.');
 if(config.multiline&&original.trim()&&!value.trim())throw Error('Este campo contiene texto. Corrígelo o cancela para evitar un borrado accidental.');
 const latest=read(data,config);
 if(latest!==original&&latest!==value)throw Error('Este campo ha cambiado en otro dispositivo. Copia tu texto y vuelve a abrir la ficha antes de guardar.');
 const next={...data};
 // Keep legacy aliases consistent without touching other fields or relations.
 for(const key of config.keys)if(key in next||key===config.keys[0]||(id==='contactDni'&&key==='DNI'))next[key]=value;
 return next;
}
async function saveField({contactId,fieldId,original,value},client=sb){
 if(!allowed())throw Error('No tienes permiso para editar contactos.');
 const q=await client.from('records').select('id,data').eq('id',contactId).maybeSingle();
 if(q.error)throw q.error;if(!q.data)throw Error('El contacto ya no está disponible.');
 const previous=q.data.data||{},data=prepare(previous,fieldId,original,value);
 if(JSON.stringify(data)===JSON.stringify(previous))return{data,previous};
 const saved=await client.from('records').update({data}).eq('id',contactId).eq('data',JSON.stringify(previous)).select('id,data').maybeSingle();
 if(saved.error)throw saved.error;
 if(!saved.data)throw Error('El contacto cambió mientras guardabas. No se ha sobrescrito. Copia tu texto y vuelve a abrir la ficha.');
 return{data:saved.data.data,previous};
}
let session=null,timer;
const dirty=()=>!!session&&session.input.value!==session.original;
function close(){if(!session)return;session.native.classList.remove('tpfInlineNativeHidden');session.label.classList.remove('tpfInlineActiveLabel');session.box.remove();session=null;}
async function start(fieldId){
 if(!allowed())return;
 if(session){if(session.fieldId===fieldId){session.input.focus();return;}if(session.busy||dirty()){session.message.textContent='Guarda o cancela este campo antes de editar otro.';return;}close();}
 const c=contact(),native=$(fieldId),label=document.querySelector('label[for="'+fieldId+'"]'),config=fields[fieldId];
 if(!c?.id||!native||!label)return;
 const box=document.createElement('div');box.className='tpfInlineContactEdit';box.style.gridRow=native.style.gridRow;box.setAttribute('role','group');box.setAttribute('aria-label','Editar '+config.label);
 const input=document.createElement(config.multiline?'textarea':'input');input.className='tpfInlineContactInput';if(!config.multiline)input.type=config.type||'text';else input.rows=3;input.setAttribute('aria-label',config.label);
 const original=read(c.data,config);input.value=original;
 const actions=document.createElement('div'),save=document.createElement('button'),cancel=document.createElement('button'),message=document.createElement('p');
 actions.className='tpfInlineContactActions';save.type=cancel.type='button';save.textContent='✓ Guardar';save.dataset.inlineSave='';cancel.textContent='× Cancelar';cancel.dataset.inlineCancel='';message.className='tpfInlineContactMessage';message.setAttribute('role','status');
 actions.append(save,cancel);box.append(input,actions,message);native.after(box);native.classList.add('tpfInlineNativeHidden');label.classList.add('tpfInlineActiveLabel');
 const s={contactId:String(c.id),fieldId,original,input,box,native,label,message,busy:false};session=s;
 cancel.onclick=()=>{if(!s.busy){close();label.querySelector('[data-inline-field]')?.focus();}};
 save.onclick=async()=>{
  if(s.busy||session!==s||String(contact()?.id)!==s.contactId)return;
  s.busy=true;save.disabled=cancel.disabled=input.disabled=true;message.textContent='Guardando…';
  try{
   const result=await saveField({...s,value:input.value});
   if(session===s&&String(contact()?.id)===s.contactId){contact().data=result.data;native.value=read(result.data,config);close();}
   window.dispatchEvent(new CustomEvent('tpf:contact-updated',{detail:{id:s.contactId,phone:read(result.data,fields.contactPhone),previous:result.previous,data:result.data}}));
   try{await window.tpfReloadContacts?.();}catch(_){}
  }catch(error){if(session===s)message.textContent=error?.message||'No se pudo guardar. Tu texto sigue disponible para reintentar.';}
  finally{s.busy=false;save.disabled=cancel.disabled=input.disabled=false;}
 };
 box.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel.click();}else if(e.key==='Enter'&&(!config.multiline||e.ctrlKey||e.metaKey)){e.preventDefault();save.click();}});
 input.focus();try{input.setSelectionRange(input.value.length,input.value.length);}catch(_){}
}
function enhance(){
 const modal=$('contactModal');if(!modal)return;
 if(session&&(modal.classList.contains('hidden')||String(contact()?.id)!==session.contactId))close();
 for(const [id,config] of Object.entries(fields)){
  const native=$(id);if(!native)continue;
  const label=modal.querySelector('label[for="'+id+'"]');if(!label)continue;
  let pencil=label.querySelector('[data-inline-field]');
  if(!pencil){pencil=document.createElement('button');pencil.type='button';pencil.className='tpfInlineContactPencil';pencil.dataset.inlineField=id;pencil.title='Editar '+config.label;pencil.setAttribute('aria-label','Editar '+config.label);pencil.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z M14 5l5 5"/></svg>';pencil.onclick=e=>{e.preventDefault();e.stopPropagation();start(id);};label.append(pencil);}
  pencil.hidden=!allowed();if(!label.classList.contains('tpfInlineEditableLabel'))label.classList.add('tpfInlineEditableLabel');
 }
}
window.addEventListener('beforeunload',e=>{if(dirty()||session?.busy){e.preventDefault();e.returnValue='';}});
// Capture before the existing full-editor/navigation handlers.
window.addEventListener('click',e=>{
 if(!session||!e.target.closest?.('#tpfContactEditToggle,#contactClose,.nav,[data-rel-open],.cpRefBack'))return;
 if(session.busy){e.preventDefault();e.stopImmediatePropagation();session.message.textContent='Espera a que termine el guardado.';return;}
 if(dirty()&&!window.confirm('Hay cambios sin guardar en este campo. ¿Quieres descartarlos?')){e.preventDefault();e.stopImmediatePropagation();return;}close();
},true);
window.addEventListener('tpf:contact-open',()=>{close();enhance();});
window.addEventListener('tpf:contact-updated',enhance);
function install(){const modal=$('contactModal');if(!modal)return;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enhance,0);}).observe(modal,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});enhance();}
window.TPFContactInlineEdit={prepare,saveField};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
