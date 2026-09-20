(function(){
'use strict';
if(window.TPFCopyData)return;
const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></svg>';
const clean=value=>String(value??'').trim();
const empty=value=>!clean(value)||/^(—|-|sin (tel[eé]fono|dni|nif|correo|notas|observaciones|indicar|datos).*|no disponible)$/i.test(clean(value));
const fieldIds={contactName:'nombre',contactFirstName:'nombre',contactLastName:'apellidos',contactPhone:'teléfono',contactDni:'DNI / NIF',contactEmail:'correo',contactBank:'IBAN',contactNotes:'notas',contactObservations:'observaciones',tpfCreateFirst:'nombre',tpfCreateLast:'apellidos',tpfCreateNickname:'apodo',tpfCreatePhone:'teléfono',tpfCreateDni:'DNI / NIF',tpfCreateEmail:'correo',tpfCreateBank:'IBAN',tpfCreateNotes:'notas',tpfCreateObs:'observaciones',oppModalClient:'nombre',oppModalPhone:'teléfono',oppModalNotes:'notas de oportunidad',waInternalNote:'nota interna'};
const textSelectors=[['[data-crm-summary="dni"]','DNI / NIF'],['[data-crm-summary="phone"]','teléfono'],['[data-crm-summary="holder"],[data-crm-summary="manager"],[data-crm-contact="name"]','nombre'],['[data-crm-summary="notes"],[data-crm-contact="notes"]','notas'],['[data-crm-contact="observations"]','observaciones'],['#waSidePhone,#waSidePhoneDetail','teléfono'],['#waSideDni,.tpfSalesDni','DNI / NIF'],['.tpfContactEmail','correo'],['#tpfContactsRows tr[data-contact-id]>td:nth-child(3)','DNI / NIF'],['#tpfContactsRows tr[data-contact-id]>td:nth-child(4)','teléfono'],['.salesPhoneLink,.salesClientPhone,#salesListRows .salesContact>div:first-child','teléfono']];
const targets=new WeakMap(),buttons=new WeakMap();let scheduled=false;
function valueOf(target){
 if('value'in target)return clean(target.value);
 const clone=target.cloneNode(true);clone.querySelectorAll?.('.tpfCopyButton,[data-rel-copy]').forEach(x=>x.remove());
 return clean(clone.textContent).replace(/^(DNI(?:\s*\/\s*NIF)?|Tel[eé]fono|Correo|IBAN):\s*/i,'');
}
function attach(target,label){
 if(!target||target.type==='password'||target.type==='hidden'||target.closest('button,a,[contenteditable="true"]'))return;
 let button=targets.get(target);
 if(button&&!button.isConnected){targets.delete(target);button=null;}
 if(!button){
  const field=target.matches('input,textarea'),labelNode=field?(target.labels?.[0]||target.closest('label')||(target.previousElementSibling?.tagName==='LABEL'?target.previousElementSibling:null)):null;
  if(field&&!labelNode)return;
  button=document.createElement('button');button.type='button';button.className='tpfCopyButton';button.innerHTML=icon;button.title='Copiar '+label;button.setAttribute('aria-label',button.title);buttons.set(button,{target,label});targets.set(target,button);
  if(field){labelNode.classList.add('tpfCopyLabel');if(target.parentElement===labelNode)labelNode.insertBefore(button,target);else labelNode.append(button);}
  else {button.classList.add('tpfCopyInline');target.append(button);}
 }
 const hidden=empty(valueOf(target));if(button.hidden!==hidden)button.hidden=hidden;
}
function fieldLabel(input){
 if(fieldIds[input.id])return fieldIds[input.id];
 const label=input.labels?.[0];if(!label)return '';
 const clone=label.cloneNode(true);clone.querySelectorAll('input,textarea,select,button,.small').forEach(x=>x.remove());const text=clean(clone.textContent);
 return /^(tel[eé]fono(?: whatsapp)?|m[oó]vil|dni(?:\s*\/\s*nif)?|nif|correo(?: electr[oó]nico)?|e-?mail|iban|banco(?:\s*\/\s*iban)?|apodo|observaciones|notas(?: de (?:la |esta )?(?:oportunidad|ficha))?)\s*:?(?:\s*\*)?$/i.test(text)?text:'';
}
function scan(){
 scheduled=false;
 for(const input of document.querySelectorAll('input:not([type="password"]):not([type="hidden"]),textarea')){const label=fieldLabel(input);if(label)attach(input,label);}
 for(const [selector,label]of textSelectors)document.querySelectorAll(selector).forEach(node=>attach(node,label));
 document.querySelectorAll('.tpfContactCardMeta>span').forEach(node=>{if(/^(DNI|Tel[eé]fono):/.test(node.textContent))attach(node,node.textContent.split(':')[0]);});
}
function schedule(){if(scheduled)return;scheduled=true;setTimeout(scan,100);}
async function copy(value){
 if(empty(value))return false;
 if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(value);return true;}catch(_){}}
 const previous=document.activeElement,field=document.createElement('textarea');field.value=value;field.readOnly=true;field.style.cssText='position:fixed;left:-10000px;top:0';document.body.append(field);field.select();let ok=false;
 try{ok=document.execCommand('copy');}finally{field.remove();previous?.focus?.({preventScroll:true});}
 return ok;
}
window.addEventListener('click',async event=>{
 const button=event.target.closest?.('.tpfCopyButton'),entry=button&&buttons.get(button);if(!entry)return;
 event.preventDefault();event.stopImmediatePropagation();
 const value=valueOf(entry.target);if(empty(value))return;button.disabled=true;
 const ok=await copy(value);button.disabled=false;button.dataset.copied=String(ok);button.title=ok?'Copiado':'No se pudo copiar. Selecciona el dato para copiarlo.';button.setAttribute('aria-label',button.title);
 let status=document.getElementById('tpfCopyStatus');if(!status){status=document.createElement('span');status.id='tpfCopyStatus';status.className='tpfCopyStatus';status.setAttribute('role','status');document.body.append(status);}status.textContent=ok?'Copiado':'No se pudo copiar';
 setTimeout(()=>{if(button.isConnected){delete button.dataset.copied;button.title='Copiar '+entry.label;button.setAttribute('aria-label',button.title);}status.textContent='';},1800);
},true);
new MutationObserver(records=>{if(records.some(record=>record.type==='childList'&&(targets.has(record.target)||[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1&&!node.matches?.('.tpfCopyButton,.tpfCopyStatus')))||record.type==='attributes'&&record.target.matches?.('.modalBack,.tpfContactsModalBack,#contactModal')))schedule();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
document.addEventListener('input',schedule,true);
for(const event of ['tpf:contact-open','tpf:contact-updated','tpf:contacts-rendered','tpf:opportunity-party-preview'])window.addEventListener(event,schedule);
window.TPFCopyData={valueOf,empty,copy};scan();
})();
