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
 if(typeof window.waCreateOpportunityFromSide==='function')return window.waCreateOpportunityFromSide();
}
function createTask(){
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 if(typeof openContactTaskPage==='function')return openContactTaskPage();
 if(typeof window.waCreateTaskFromSide==='function')return window.waCreateTaskFromSide();
}
function taskIdFromNode(node){
 const row=node?.closest?.('[data-task-id],[data-agenda-id],[data-id],.waSideItem')||node;
 const dataId=row?.dataset?.taskId||row?.dataset?.agendaId||row?.dataset?.id||'';
 if(dataId)return dataId;
 const attrs=[];
 for(const el of [node,row,...(row?.querySelectorAll?.('[onclick],[data-task-id],[data-agenda-id],[data-id]')||[])]){
   if(!el)continue;
   const d=el.dataset?.taskId||el.dataset?.agendaId||el.dataset?.id||'';if(d)return d;
   attrs.push(el.getAttribute?.('onclick')||'');
 }
 for(const oc of attrs){
   const m=String(oc).match(/(?:openContactTaskDetail|openAgendaItem|editAgendaItem)\(['\"]?([^'\"),]+)[^)]*\)/);if(m)return m[1];
   const uuid=String(oc).match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);if(uuid)return uuid[0];
 }
 return '';
}
async function openTaskId(id){
 if(!id)return;
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 $('contactModal')?.classList.remove('hidden');
 $('cpTaskPage')?.classList.add('hidden');
 if(typeof window.openContactTaskDetail==='function')return window.openContactTaskDetail(id);
}
async function viewTasks(){
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 const rows=[...($('waSideTasks')?.querySelectorAll?.('.waSideItem,[data-task-id],[data-agenda-id],[data-id]')||[])];
 for(const row of rows){const id=taskIdFromNode(row);if(id)return openTaskId(id)}
}
async function viewOpps(){
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 const first=$('waSideOpps')?.querySelector('[data-opp-id]');
 const id=first?.dataset.oppId;
 if(id&&typeof window.openOpportunityCard==='function')return window.openOpportunityCard(id);
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
   opps.dataset.tpfReuse='1';opps.addEventListener('click',e=>{if(e.target.closest('select,input'))return;const card=e.target.closest('[data-opp-id]');const id=card?.dataset.oppId;if(id&&typeof window.openOpportunityCard==='function'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();window.openOpportunityCard(id)}},true);
 }
}
function capture(e){
 const t=e.target;
 if(t?.closest?.('#waSideNewOpp')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();createOpp();return}
 if(t?.closest?.('#waSideNewTask')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();createTask();return}
 if(t?.closest?.('#waSideViewOpps')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();viewOpps();return}
 if(t?.closest?.('#waSideViewTasks')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();viewTasks();return}
 const taskBox=t?.closest?.('#waSideTasks');
 if(taskBox){
   const txt=String(t?.textContent||'').trim().toLowerCase();
   const button=t?.closest?.('button,a');
   const row=t?.closest?.('.waSideItem,[data-task-id],[data-agenda-id],[data-id]');
   if(row && (!button || /editar|ver/.test(txt))){const id=taskIdFromNode(t);if(id){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openTaskId(id);return}}
 }
}
M.register('whatsapp-contact-reuse',{install(){bind();document.addEventListener('click',capture,true);document.addEventListener('click',e=>{if(e.target.closest?.('.waChatRow,#waSideOpenContact,#waSideCreateContact'))setTimeout(bind,80)},true);setInterval(bind,1200)}});
})();
