(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
const VIEWS=new Set(['dashboard','alerts','search','database','sales','import','agenda','whatsapplive','whatsapp','labels','settings','automations','users','system','trash']);
function closeDetails(){
  for(const id of ['oppDetailModal','opportunityFullPage','cpTaskDetailPage','cpTaskPage','contactModal','waQuickModal','waQuickScheduleBox','stageContextMenu'])$(id)?.classList.add('hidden');
  document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close()}catch(_){d.removeAttribute('open')}});
}
function run(fn,view){try{const result=fn?.();result?.catch?.(error=>console.warn('Navegación '+view,error))}catch(error){console.warn('Navegación '+view,error)}}
function refresh(view,nav){
  if(view==='dashboard')run(window.loadDashboard,view);
  if(view==='alerts')run(window.loadAlerts,view);
  if(view==='trash')run(window.loadTrash,view);
  if(view==='sales')run(window.loadSales,view);
  if(view==='agenda')run(window.loadAgenda,view);
  if(view==='whatsapplive')run(window.loadWhatsAppLive,view);
  if(view==='whatsapp')run(window.loadWhatsappPrograms,view);
  if(view==='labels')run(window.crmLoadLabels,view);
  if(view==='settings'){run(window.loadGoogleSettings,view);run(window.loadNotifySettings,view)}
  if(view==='automations')run(window.loadAutomations,view);
  if(view==='users')run(window.loadUsersAdmin,view);
  if(view==='system')run(window.loadSystemStatus,view);
  if(view==='database')run(window.tpfReloadContacts,view);
  if(view==='search'&&nav.dataset.sheet!==undefined){if($('searchSheet'))$('searchSheet').value=nav.dataset.sheet||'';if($('searchText'))$('searchText').value='';$('searchBtn')?.click()}
}
function open(view,nav){
  if(!VIEWS.has(view))return false;
  closeDetails();
  document.querySelectorAll('.referenceWorkspace main > section[id^="view-"]').forEach(section=>section.classList.add('hidden'));
  $('view-'+view)?.classList.remove('hidden');
  document.querySelectorAll('.referenceNav .nav').forEach(item=>item.classList.remove('active'));
  nav.classList.add('active');
  window.__tpfCurrentView=view;
  setTimeout(()=>refresh(view,nav),0);
  return true;
}
function install(){
  document.addEventListener('click',event=>{
    const nav=event.target?.closest?.('.referenceNav .nav[data-view]');
    if(!nav)return;
    const view=String(nav.dataset.view||'');
    if(view==='wa-templates-v3'||view==='wa-templates-library'||view==='wa-templates')return;
    if(!VIEWS.has(view))return;
    event.preventDefault();event.stopImmediatePropagation();open(view,nav);
  },true);
  window.openAppView=function(view){const nav=[...document.querySelectorAll('.referenceNav .nav[data-view]')].find(item=>item.dataset.view===String(view));return nav?open(String(view),nav):false};
}
M.register('navigation-recovery',{install});
})();