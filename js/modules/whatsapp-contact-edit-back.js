(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
const state=window.__tpfWaContactEditBackState||(window.__tpfWaContactEditBackState={origin:null,bound:false});

function whatsappVisible(){
  const view=$('view-whatsapplive');
  return !!view&&!view.classList.contains('hidden');
}
function currentChatId(){
  try{return String(waLiveState?.selected?.id||'')}catch(_){return ''}
}
async function restoreWhatsapp(origin){
  $('tpfContactsCreateBack')?.classList.add('hidden');
  $('contactModal')?.classList.add('hidden');
  const view=$('view-whatsapplive');
  if(view?.classList.contains('hidden')){
    const nav=document.querySelector('.nav[data-view="whatsapplive"]');
    if(nav){nav.dataset.tpfBackNavigation='1';nav.click();delete nav.dataset.tpfBackNavigation;}
    await new Promise(r=>setTimeout(r,80));
  }
  if(origin?.chatId){
    let selected='';
    try{selected=String(waLiveState?.selected?.id||'')}catch(_){}
    if(selected!==origin.chatId&&typeof window.selectWhatsAppChat==='function'){
      try{await window.selectWhatsAppChat(origin.chatId)}catch(_){}
    }
  }
}
function isEditContactModal(){
  const back=$('tpfContactsCreateBack');
  if(!back||back.classList.contains('hidden'))return false;
  const title=String(back.querySelector('.tpfContactsModalHead h3')?.textContent||'').trim().toLowerCase();
  return title==='editar contacto';
}
function capture(e){
  const target=e.target;if(!target?.closest)return;
  if(target.closest('#tpfContactEditToggle')){
    state.origin=whatsappVisible()?{chatId:currentChatId()}:null;
    return;
  }
  if(!state.origin)return;
  if(target.closest('#tpfContactsCreateClose,#tpfContactsCreateCancel')){
    if(!isEditContactModal())return;
    const origin=state.origin;state.origin=null;
    setTimeout(()=>restoreWhatsapp(origin),0);
  }
  if(target.closest('.nav[data-view]')&&!target.closest('.nav[data-view="whatsapplive"]'))state.origin=null;
}
M.register('whatsapp-contact-edit-back',{install(){
  if(state.bound)return;state.bound=true;
  window.addEventListener('click',capture,true);
}});
})();
