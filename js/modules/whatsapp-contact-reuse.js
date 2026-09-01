(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
function contact(){try{return waLiveState?.contact||null}catch(_){return null}}
async function openProfile(){const c=contact();if(!c)return alert('Primero vincula este chat con un contacto.');if(typeof window.openContact==='function')return window.openContact(c.id)}
async function openEdit(){const c=contact();if(!c)return alert('Primero vincula este chat con un contacto.');await openProfile();setTimeout(()=>$('tpfContactEditToggle')?.click(),40)}
async function createOpp(){const c=contact();if(!c)return alert('Primero vincula este chat con un contacto.');await openProfile();setTimeout(()=>$('cpNewOpp')?.click(),40)}
async function createTask(){const c=contact();if(!c)return alert('Primero vincula este chat con un contacto.');await openProfile();setTimeout(()=>$('cpNewTask')?.click(),40)}
async function viewOpps(){const c=contact();if(!c)return;await openProfile();setTimeout(()=>document.querySelector('#contactModal .cpTabs span:nth-child(3)')?.click(),40)}
async function viewTasks(){const c=contact();if(!c)return;await openProfile();setTimeout(()=>document.querySelector('#contactModal .cpTabs span:nth-child(4)')?.click(),40)}
function ensureEditButton(){
 const open=$('waSideOpenContact');if(!open)return;
 let edit=$('waSideEditContact');
 if(!edit){edit=document.createElement('button');edit.id='waSideEditContact';edit.type='button';edit.className='secondary full hidden';edit.textContent='Editar datos';open.insertAdjacentElement('afterend',edit)}
 const found=!!contact();edit.classList.toggle('hidden',!found);edit.style.display=found?'block':'none';edit.onclick=openEdit;
}
function bind(){
 const open=$('waSideOpenContact');if(open)open.onclick=openProfile;
 const addOpp=$('waSideNewOpp');if(addOpp)addOpp.onclick=createOpp;
 const addTask=$('waSideNewTask');if(addTask)addTask.onclick=createTask;
 const viewO=$('waSideViewOpps');if(viewO)viewO.onclick=viewOpps;
 const viewT=$('waSideViewTasks');if(viewT)viewT.onclick=viewTasks;
 ensureEditButton();
 const opps=$('waSideOpps');if(opps&&opps.dataset.tpfReuse!=='1'){
   opps.dataset.tpfReuse='1';opps.addEventListener('click',e=>{if(e.target.closest('button,select,input,a'))return;const card=e.target.closest('[data-opp-id]');const id=card?.dataset.oppId;if(id&&typeof window.openOpportunityCard==='function'){e.preventDefault();e.stopPropagation();window.openOpportunityCard(id)}});
 }
}
M.register('whatsapp-contact-reuse',{install(){bind();document.addEventListener('click',e=>{if(e.target.closest?.('.waChatRow,#waSideOpenContact,#waSideCreateContact'))setTimeout(bind,80)},true);setInterval(bind,1200)}});
})();
