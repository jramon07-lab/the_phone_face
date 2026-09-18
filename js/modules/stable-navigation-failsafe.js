(function(){
'use strict';
const $=id=>document.getElementById(id);
const views=new Set(['dashboard','alerts','search','database','sales','import','agenda','whatsapplive','whatsapp','labels','settings','automations','users','system','trash']);
function call(fn,view){
  try{const result=fn?.();result?.catch?.(error=>console.error('[TPF nav]',view,error));}
  catch(error){console.error('[TPF nav]',view,error);}
}
function navigate(nav,event){
  const view=String(nav?.dataset?.view||'');
  if(!views.has(view))return;
  event?.preventDefault?.();
  event?.stopPropagation?.();
  document.querySelectorAll('.referenceWorkspace main > section[id^="view-"]').forEach(section=>section.classList.add('hidden'));
  $('view-'+view)?.classList.remove('hidden');
  document.querySelectorAll('.referenceNav .nav').forEach(item=>item.classList.remove('active'));
  nav.classList.add('active');
  $('waQuickModal')?.classList.add('hidden');
  $('waQuickScheduleBox')?.classList.add('hidden');
  document.querySelectorAll('dialog[open]').forEach(dialog=>{try{dialog.close()}catch(_){dialog.removeAttribute('open')}});
  window.__tpfCurrentView=view;
  if(view==='search'&&nav.dataset.sheet!==undefined){
    if($('searchSheet'))$('searchSheet').value=nav.dataset.sheet||'';
    if(nav.dataset.sheet&&$('searchText'))$('searchText').value='';
    if(nav.dataset.sheet)$('searchBtn')?.click();
  }
  const loaders={dashboard:'loadDashboard',alerts:'loadAlerts',trash:'loadTrash',whatsapplive:'loadWhatsAppLive',sales:'loadSales',agenda:'loadAgenda',whatsapp:'loadWhatsappPrograms',automations:'loadAutomations',users:'loadUsersAdmin',system:'loadSystemStatus'};
  if(view==='labels')call(window.crmLoadLabels,view);
  else if(view==='settings'){call(window.loadGoogleSettings,view);call(window.loadNotifySettings,view);}
  else call(window[loaders[view]],view);
}
function bind(){
  document.querySelectorAll('.referenceNav .nav[data-view]').forEach(nav=>{
    const view=String(nav.dataset.view||'');
    if(!views.has(view))return;
    nav.onclick=event=>navigate(nav,event);
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
else bind();
setTimeout(bind,200);
setTimeout(bind,1200);
})();