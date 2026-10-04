(function(){
'use strict';
const $=id=>document.getElementById(id);
let homeSlot=null,searchWrap=null;
function mount(){
 const view=$('view-dashboard'),bar=view?.querySelector('.tdCommandActions');
 const open=view&&!view.classList.contains('hidden')&&!$('app')?.classList.contains('hidden');
 if(!open||!bar){restore();return}
 let menu=$('tdQuickActions');
 if(!menu){
  menu=document.createElement('details');menu.id='tdQuickActions';menu.className='tdQuickActions';
  const summary=document.createElement('summary');summary.textContent='＋ Acciones rápidas';menu.appendChild(summary);
  const items=document.createElement('div');items.className='tdQuickItems';menu.appendChild(items);
  const quick=bar.querySelector('.tdHeroQuick');if(quick){while(quick.firstChild)items.appendChild(quick.firstChild);quick.remove()}
  bar.prepend(menu);
  menu.addEventListener('click',e=>{if(e.target.closest('button'))menu.open=false});
 }
 const monitor=$('waSendMonitor');if(monitor&&!menu.contains(monitor))menu.querySelector('.tdQuickItems').appendChild(monitor);
 searchWrap=document.querySelector('.globalSearchWrap');
 if(searchWrap&&!bar.contains(searchWrap)){
  if(!homeSlot){homeSlot=document.createComment('global search home');searchWrap.before(homeSlot)}
  bar.prepend(searchWrap);$('globalSearch').placeholder='🔎 Buscar cliente, DNI o teléfono…';
 }
 document.body.classList.add('tpfHomeCompact');
}
function restore(){
 if(searchWrap&&homeSlot?.parentNode&&!homeSlot.parentNode.contains(searchWrap))homeSlot.after(searchWrap);
 document.body.classList.remove('tpfHomeCompact');
 const menu=$('tdQuickActions');if(menu)menu.open=false;
}
document.addEventListener('click',e=>{const nav=e.target.closest('.nav[data-view]');if(nav&&nav.dataset.view!=='dashboard')restore();const menu=$('tdQuickActions');if(menu&&!menu.contains(e.target))menu.open=false},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('tdQuickActions')?.removeAttribute('open')}});
setInterval(mount,700);mount();
})();
