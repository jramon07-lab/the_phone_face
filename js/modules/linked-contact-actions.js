/* Shared desktop navigation. Opening the composer never sends a message. */
(function(){
'use strict';
function phoneDigits(value){let p=String(value||'').replace(/\D/g,'');if(p.startsWith('00'))p=p.slice(2);if(p.length===9)p='34'+p;if(!/^[1-9][0-9]{7,14}$/.test(p))throw Error('Este contacto no tiene un teléfono válido.');return p;}
let origin=null;
function capture(){return {screen:window.tpfCaptureCurrentScreen?.(),scroll:[...document.querySelectorAll('.referenceWorkspace main,[id^="view-"],#tpfContactsRows,#agendaList')].map(el=>({el,top:el.scrollTop,left:el.scrollLeft})),historyLength:window.__TPF_HISTORY?.length};}
async function back(){if(!origin)return;const saved=origin;await window.tpfRestoreCapturedScreen(saved.screen);const restore=()=>saved.scroll.forEach(({el,top,left})=>{if(el.isConnected){el.scrollTop=top;el.scrollLeft=left;}});restore();requestAnimationFrame(restore);setTimeout(restore,150);if(Array.isArray(window.__TPF_HISTORY)&&saved.historyLength!=null)window.__TPF_HISTORY.splice(saved.historyLength);origin=null;document.getElementById('tpfLinkedReturn')?.remove();}
async function open(kind,contact){
 if(typeof crmCan==='function'&&!crmCan('can_use_whatsapp'))throw Error('No tienes permiso para abrir WhatsApp.');
 const phone=phoneDigits(contact.phone);
 if(kind==='message'){const fn=window.openWaQuick||(typeof openWaQuick==='function'?openWaQuick:null);if(!fn)throw Error('El editor de WhatsApp no está disponible. Actualiza la página.');return fn({phone,name:contact.name||'Cliente',contactId:contact.contactId||null});}
 if(kind!=='conversation')throw Error('Acción no disponible.');
 const nav=document.querySelector('.nav[data-view="whatsapplive"]');if(!nav||typeof window.selectWhatsAppChat!=='function'||typeof window.tpfRestoreCapturedScreen!=='function')throw Error('La conversación no está disponible. Actualiza la página.');
 origin=capture();nav.click();
 let button=document.getElementById('tpfLinkedReturn');if(!button){button=document.createElement('button');button.id='tpfLinkedReturn';button.type='button';button.className='secondary';button.textContent='← Volver a la lista';button.onclick=()=>back().catch(error=>alert(error.message));const header=document.querySelector('#view-whatsapplive .waLiveHeaderActions')||document.getElementById('view-whatsapplive');header.prepend(button);}
 try{await window.selectWhatsAppChat(phone+'@c.us');}catch(error){await back();throw error;}
}
window.TPFLinkedActions={open,back,phoneDigits};
const style=document.createElement('style');style.textContent='#view-dashboard .tdTaskText{min-width:0;display:flex;flex-direction:column;gap:5px}#view-dashboard .tdTaskText>*{white-space:pre-wrap!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:anywhere;max-height:none!important;-webkit-line-clamp:unset!important}#view-dashboard .tdTaskText .tdLink{text-align:left;width:fit-content;padding:0}#view-dashboard .tdTaskLinkedActions{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;max-width:260px}.tpfMoreMenu{max-height:calc(100dvh - 16px);overflow-y:auto}.agendaActions{flex-wrap:wrap}.agendaItemTitle>small{white-space:pre-wrap!important;overflow:visible!important;overflow-wrap:anywhere;text-overflow:clip!important;max-height:none!important}@media(max-width:900px){#view-dashboard .tdTaskRow{grid-template-columns:auto minmax(0,1fr)!important}#view-dashboard .tdTaskDate,#view-dashboard .tdTaskLinkedActions{grid-column:2;justify-content:flex-start}.agendaItemState{min-width:0}.agendaActions button{white-space:normal}}';document.head.appendChild(style);
})();
