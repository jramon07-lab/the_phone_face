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
  const connector=window.__tpfWhatsappContactConnectorState;
  if(connector?.profileOrigin?.chatId===origin?.chatId)connector.profileOrigin=null;
}
function begin(origin){
  const chatId=String(origin?.chatId||currentChatId()||'');
  state.origin=chatId?{chatId}:null;
  return state.origin;
}
function hasOrigin(){return !!state.origin?.chatId}
async function finish(){
  const origin=state.origin;if(!origin)return;
  state.origin=null;
  await restoreWhatsapp(origin);
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
    const connectorOrigin=window.__tpfWhatsappContactConnectorState?.profileOrigin;
    state.origin=whatsappVisible()?{chatId:currentChatId()}:connectorOrigin?.chatId?{chatId:String(connectorOrigin.chatId)}:state.origin;
    return;
  }
  if(!state.origin)return;
  if(target.closest('#tpfContactsCreateClose,#tpfContactsCreateCancel')){
    if(!isEditContactModal())return;
    const origin=state.origin;
    // A later capture handler can keep an unsaved editor open. Only restore
    // WhatsApp after the editor has actually accepted and completed closing.
    setTimeout(()=>{
      if(isEditContactModal()||state.origin!==origin)return;
      finish();
    },0);
  }
  if(target.closest('.nav[data-view]')&&!target.closest('.nav[data-view="whatsapplive"]'))state.origin=null;
}
window.TPFWhatsappContactEditBack={begin,hasOrigin,restore:finish};
M.register('whatsapp-contact-edit-back',{install(){
  if(state.bound)return;state.bound=true;
  window.addEventListener('click',capture,true);
  window.addEventListener('tpf:contact-updated',()=>{if(hasOrigin())finish()});
}});
})();
