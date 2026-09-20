/* Compact contacts workspace. Reuse native controls and their existing handlers. */
(function(){
'use strict';
const $=id=>document.getElementById(id);let full=false,menu,more;
function closeMenu(){if(menu)menu.hidden=true;more?.setAttribute('aria-expanded','false');}
function toggleFull(on){full=on;document.body.classList.toggle('tpfContactsOnly',full);$('tpfContactsApp')?.classList.toggle('tpfContactsFull',full);$('tpfContactsExpand')?.setAttribute('aria-pressed',String(full));if($('tpfContactsExpand'))$('tpfContactsExpand').textContent=full?'↙ Salir de pantalla completa':'⛶ Pantalla completa';}
function mount(){
 const app=$('tpfContactsApp'),head=app?.querySelector('.tpfContactsHeaderActions');if(!app||!head)return;
 if(!more){
  const expand=document.createElement('button');expand.id='tpfContactsExpand';expand.type='button';expand.className='secondary';expand.textContent='⛶ Pantalla completa';expand.setAttribute('aria-pressed','false');expand.onclick=()=>toggleFull(!full);
  more=document.createElement('button');more.id='tpfContactsMore';more.type='button';more.textContent='⋯';more.className='secondary';more.setAttribute('aria-label','Más opciones de contactos');more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','tpfContactsTools');
  menu=document.createElement('div');menu.id='tpfContactsTools';menu.hidden=true;menu.setAttribute('aria-label','Herramientas de contactos');
  more.onclick=e=>{e.stopPropagation();menu.hidden=!menu.hidden;more.setAttribute('aria-expanded',String(!menu.hidden));};head.append(expand,more,menu);
  // Any asynchronously mounted utility is adopted with its own event listeners.
  new MutationObserver(adopt).observe(head,{childList:true});
 }
 adopt();
 function adopt(){for(const node of [...head.children]){if(node===more||node===menu||node.id==='tpfContactsAdd'||node.id==='tpfContactsExpand')continue;menu.appendChild(node);}const exp=app.querySelector('.tpfContactsExportWrap');if(exp&&exp.parentElement!==menu)menu.appendChild(exp);}
}
function scheduleInMenu(root){
 const m=root?.matches?.('.tpfMoreMenu')?root:null;if(!m||m.querySelector('[data-list-schedule]'))return;
 const id=m.dataset.ownerId;if(!id)return;const b=document.createElement('button');b.type='button';b.dataset.listSchedule=id;b.textContent='Programar WhatsApp';b.onclick=e=>{e.stopPropagation();m.remove();const row=[...document.querySelectorAll('#tpfContactsRows tr')].find(r=>r.dataset.contactId===id);row?.querySelector('[data-action="schedule"]')?.click();};m.insertBefore(b,m.querySelector('.danger'));
}
function install(){mount();new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes){if(n.nodeType!==1)continue;if(n.id==='tpfContactsApp'||n.querySelector?.('#tpfContactsApp'))mount();scheduleInMenu(n);}}).observe(document.body,{childList:true,subtree:true});
 document.addEventListener('click',e=>{if(!e.target.closest?.('#tpfContactsTools,#tpfContactsMore'))closeMenu();const nav=e.target.closest?.('.nav');if(nav&&nav.dataset.view!=='database')toggleFull(false);});
 window.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(menu&&!menu.hidden){e.preventDefault();e.stopImmediatePropagation();closeMenu();more.focus();return;}if(full&&!document.querySelector('.tpfOpportunityPicker')&&!$('contactModal')?.matches(':not(.hidden)')&&!$('oppDetailModal')?.matches(':not(.hidden)')){e.preventDefault();e.stopImmediatePropagation();toggleFull(false);}},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
