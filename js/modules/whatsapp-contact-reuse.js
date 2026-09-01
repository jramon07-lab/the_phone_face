(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
function contact(){try{return waLiveState?.contact||null}catch(_){return null}}
function prepare(){try{return typeof waPrepareCurrentContactForCrm==='function'&&waPrepareCurrentContactForCrm()}catch(_){return false}}
async function openProfile(){const c=contact();if(!c)return alert('Primero vincula este chat con un contacto.');if(typeof window.openContact==='function')return window.openContact(c.id)}
async function openEdit(){const c=contact();if(!c)return alert('Primero vincula este chat con un contacto.');await openProfile();setTimeout(()=>$('tpfContactEditToggle')?.click(),60)}
async function createOpp(){
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 try{if(!(salesCache?.stages||[]).length&&typeof loadSales==='function')await loadSales()}catch(_){}
 if(typeof openContactNewOpportunity==='function')return openContactNewOpportunity();
 $('cpNewOpp')?.click();
}
function createTask(){
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 if(typeof openContactTaskPage==='function')return openContactTaskPage();
 $('cpNewTask')?.click();
}
async function viewOpps(){
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 const first=$('waSideOpps')?.querySelector('[data-opp-id]');
 const id=first?.dataset.oppId;
 if(id&&typeof window.openOpportunityCard==='function')return window.openOpportunityCard(id);
 await openProfile();
}
function taskIdFromNode(node){
 const row=node?.closest?.('[data-task-id],[data-id],.waSideItem');
 const dataId=row?.dataset?.taskId||row?.dataset?.id||'';
 if(dataId)return dataId;
 const oc=row?.getAttribute?.('onclick')||node?.getAttribute?.('onclick')||'';
 const m=oc.match(/openContactTaskDetail\(['\"]([^'\"]+)['\"]\)/);
 return m?.[1]||'';
}
async function openTaskId(id){
 if(!id)return;
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 $('contactModal')?.classList.remove('hidden');
 $('cpTaskPage')?.classList.add('hidden');
 if(typeof window.openContactTaskDetail==='function')return window.openContactTaskDetail(id);
}
async function viewTasks(){
 const first=$('waSideTasks')?.querySelector('.waSideItem,[data-task-id],[data-id]');
 const id=taskIdFromNode(first);
 if(id)return openTaskId(id);
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 if(typeof openContactTaskPage==='function')return openContactTaskPage();
}
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
   opps.dataset.tpfReuse='1';opps.addEventListener('click',e=>{if(e.target.closest('select,input'))return;const card=e.target.closest('[data-opp-id]');const id=card?.dataset.oppId;if(id&&typeof window.openOpportunityCard==='function'){e.preventDefault();e.stopPropagation();window.openOpportunityCard(id)}});
 }
 const tasks=$('waSideTasks');if(tasks&&tasks.dataset.tpfReuse!=='1'){
   tasks.dataset.tpfReuse='1';tasks.addEventListener('click',e=>{
     const row=e.target.closest('.waSideItem,[data-task-id],[data-id]');if(!row)return;
     const id=taskIdFromNode(e.target);if(!id)return;
     const text=String(e.target.textContent||'').trim().toLowerCase();
     if(e.target.closest('button')&&!/editar|ver/.test(text))return;
     e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openTaskId(id);
   },true);
 }
}
M.register('whatsapp-contact-reuse',{install(){bind();document.addEventListener('click',e=>{if(e.target.closest?.('.waChatRow,#waSideOpenContact,#waSideCreateContact'))setTimeout(bind,80)},true);setInterval(bind,1200)}});
})();
