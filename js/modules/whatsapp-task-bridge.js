(function(){
'use strict';
function prepare(){
  if(!window.waLiveState?.contact)return false;
  window.currentContact=window.waLiveState.contact;
  const d=window.currentContact.data||{};
  const field=(...names)=>{for(const n of names){if(d[n]!=null&&String(d[n]).trim())return d[n]}return ''};
  const name=field('NOMBRE Y APELLIDOS','NOMBRE','CLIENTE','CLIENTE FINAL')||window.waLiveState.selected?.name||'Contacto';
  const phone=field('TELÉFONO','TELEFONO','TEL','MÓVIL','MOVIL','PHONE')||String(window.waLiveState.selected?.id||'').replace(/@.*$/,'').replace(/\D/g,'');
  const nameEl=document.getElementById('contactName'),phoneEl=document.getElementById('contactPhone');
  if(nameEl)nameEl.value=name;if(phoneEl)phoneEl.value=phone;
  return true;
}
async function refresh(){
  try{if(window.waLiveState?.contact&&typeof window.loadWaContactSideData==='function'){const p=String(window.waLiveState.selected?.id||'').replace(/@.*$/,'').replace(/\D/g,'');await window.loadWaContactSideData(window.waLiveState.contact,p)}}catch(_){}
}
window.waCreateTaskFromSide=function(){if(!prepare())return alert('Primero vincula este chat con un contacto.');if(typeof window.openContactTaskPage==='function')window.openContactTaskPage()};
document.addEventListener('click',function(e){
  const edit=e.target.closest?.('#waSideTasks .waSideItem');if(!edit)return;
  const call=edit.getAttribute('onclick')||'';const m=call.match(/openContactTaskDetail\(['"]([^'"]+)/);if(!m)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();prepare();if(typeof window.openContactTaskDetail==='function')window.openContactTaskDetail(m[1]);
},true);
const save=document.getElementById('cpTaskSave');if(save)save.addEventListener('click',()=>setTimeout(refresh,700));
const detailSave=document.getElementById('cpTaskDetailSave');if(detailSave)detailSave.addEventListener('click',()=>setTimeout(refresh,400));
})();
