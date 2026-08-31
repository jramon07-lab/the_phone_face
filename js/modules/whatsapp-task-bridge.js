(function(){
'use strict';
function prepare(){
  if(typeof waLiveState==='undefined'||!waLiveState?.contact)return false;
  currentContact=waLiveState.contact;
  const d=currentContact.data||{};
  const field=(...names)=>{for(const n of names){if(d[n]!=null&&String(d[n]).trim())return d[n]}return ''};
  const name=field('NOMBRE Y APELLIDOS','NOMBRE','CLIENTE','CLIENTE FINAL')||waLiveState.selected?.name||'Contacto';
  const phone=field('TELÉFONO','TELEFONO','TEL','MÓVIL','MOVIL','PHONE')||String(waLiveState.selected?.id||'').replace(/@.*$/,'').replace(/\D/g,'');
  const nameEl=document.getElementById('contactName'),phoneEl=document.getElementById('contactPhone');
  if(nameEl)nameEl.value=name;if(phoneEl)phoneEl.value=phone;
  return true;
}
async function refresh(){
  try{
    if(typeof waLiveState!=='undefined'&&waLiveState?.contact&&typeof loadWaContactSideData==='function'){
      const p=String(waLiveState.selected?.id||'').replace(/@.*$/,'').replace(/\D/g,'');
      await loadWaContactSideData(waLiveState.contact,p);
    }
  }catch(_){}
}
window.waCreateTaskFromSide=function(){
  if(!prepare())return alert('Primero vincula este chat con un contacto.');
  if(typeof openContactTaskPage==='function')openContactTaskPage();
};
document.addEventListener('click',function(e){
  const item=e.target.closest?.('#waSideTasks .waSideItem');if(!item)return;
  const call=item.getAttribute('onclick')||'';const m=call.match(/openContactTaskDetail\(['"]([^'"]+)/);if(!m)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  if(!prepare())return;
  if(typeof openContactTaskDetail==='function')openContactTaskDetail(m[1]);
},true);
const add=document.getElementById('waSideNewTask');if(add)add.onclick=window.waCreateTaskFromSide;
const save=document.getElementById('cpTaskSave');if(save)save.addEventListener('click',()=>setTimeout(refresh,700));
const detailSave=document.getElementById('cpTaskDetailSave');if(detailSave)detailSave.addEventListener('click',()=>setTimeout(refresh,400));
})();
