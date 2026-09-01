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
 if(typeof window.waCreateOpportunityFromSide==='function')return window.waCreateOpportunityFromSide();
 try{if(!(salesCache?.stages||[]).length&&typeof loadSales==='function')await loadSales()}catch(_){}
 if(typeof openContactNewOpportunity==='function')return openContactNewOpportunity();
}
function createTask(){
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 $('contactModal')?.classList.remove('hidden');
 if(typeof window.waCreateTaskFromSide==='function')return window.waCreateTaskFromSide();
 if(typeof openContactTaskPage==='function')return openContactTaskPage();
}
async function openTaskId(id){
 if(!id)return;
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 const modal=$('contactModal');if(modal)modal.classList.remove('hidden');
 $('cpTaskPage')?.classList.add('hidden');
 $('cpTaskDetailPage')?.classList.add('hidden');
 if(typeof window.openContactTaskDetail==='function')return window.openContactTaskDetail(id);
}
function taskIdFromNode(node){
 const row=node?.closest?.('[data-task-id],[data-agenda-id],[data-id],.waSideItem,.cpTaskWrap,.tpfTaskCard')||node;
 for(const el of [node,row,...(row?.querySelectorAll?.('[onclick],[data-task-id],[data-agenda-id],[data-id]')||[])]){
   if(!el)continue;
   const d=el.dataset?.taskId||el.dataset?.agendaId||el.dataset?.id||'';if(d)return d;
   const oc=String(el.getAttribute?.('onclick')||'');
   const m=oc.match(/(?:openContactTaskDetail|openAgendaItem|editAgendaItem)\(['\"]?([^'\"),]+)[^)]*\)/);if(m)return m[1];
   const uuid=oc.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);if(uuid)return uuid[0];
 }
 return '';
}
async function resolveTaskId(node){
 const direct=taskIdFromNode(node);if(direct)return direct;
 const c=contact();if(!c)return '';
 const card=node?.closest?.('#waSideTasks > *, .waSideItem, [class*=Task], [class*=task]')||node?.parentElement;
 const title=String(card?.querySelector?.('b,strong,h4,h3')?.textContent||'').trim();
 const phone=String(c.data?.['TELÉFONO']||c.data?.TELEFONO||c.data?.PHONE||'').replace(/\D/g,'').slice(-9);
 try{
   let q=sb.from('agenda_items').select('id,title,customer_phone,related_record_id,status,starts_at').eq('status','pending').order('starts_at',{ascending:true}).limit(50);
   const r=await q;if(r.error)throw r.error;
   const rows=(r.data||[]).filter(x=>String(x.related_record_id||'')===String(c.id)||(phone&&String(x.customer_phone||'').replace(/\D/g,'').slice(-9)===phone));
   if(title){const exact=rows.find(x=>String(x.title||'').trim()===title);if(exact)return exact.id}
   return rows[0]?.id||'';
 }catch(_){return ''}
}
async function viewTasks(){
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 const id=await resolveTaskId($('waSideTasks'));
 if(id)return openTaskId(id);
}
async function viewOpps(){
 if(!prepare())return alert('Primero vincula este chat con un contacto.');
 const first=$('waSideOpps')?.querySelector('[data-opp-id]');
 const id=first?.dataset.oppId;
 if(id){
   if(typeof window.openOpportunityFull==='function')return window.openOpportunityFull(id);
   if(typeof window.openOpportunityCard==='function')return window.openOpportunityCard(id);
 }
}
function replaceButton(id,handler){
 const old=$(id);if(!old)return null;
 if(old.dataset.tpfNativeReuse==='1'){old.onclick=handler;return old}
 const clone=old.cloneNode(true);clone.dataset.tpfNativeReuse='1';clone.removeAttribute('onclick');clone.onclick=e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();handler()};old.replaceWith(clone);return clone;
}
function ensureEditButton(){
 const open=$('waSideOpenContact');if(!open)return;
 let edit=$('waSideEditContact');
 if(!edit){edit=document.createElement('button');edit.id='waSideEditContact';edit.type='button';edit.className='secondary full hidden';edit.textContent='Editar datos';open.insertAdjacentElement('afterend',edit)}
 const found=!!contact();edit.classList.toggle('hidden',!found);edit.style.display=found?'block':'none';edit.onclick=e=>{e?.preventDefault?.();e?.stopPropagation?.();openEdit()};
}
function bind(){
 replaceButton('waSideOpenContact',openProfile);
 replaceButton('waSideNewOpp',createOpp);
 replaceButton('waSideNewTask',createTask);
 replaceButton('waSideViewOpps',viewOpps);
 replaceButton('waSideViewTasks',viewTasks);
 ensureEditButton();
 const opps=$('waSideOpps');if(opps&&opps.dataset.tpfReuse!=='1'){
   opps.dataset.tpfReuse='1';opps.addEventListener('click',e=>{if(e.target.closest('select,input'))return;const card=e.target.closest('[data-opp-id]');const id=card?.dataset.oppId;if(!id)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(typeof window.openOpportunityFull==='function')window.openOpportunityFull(id);else window.openOpportunityCard?.(id)},true);
 }
}
async function capture(e){
 const t=e.target;
 if(t?.closest?.('#waSideNewOpp')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();createOpp();return}
 if(t?.closest?.('#waSideNewTask')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();createTask();return}
 if(t?.closest?.('#waSideViewOpps')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();viewOpps();return}
 if(t?.closest?.('#waSideViewTasks')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();viewTasks();return}
 if(t?.closest?.('#waSideTasks')){
   const txt=String(t?.closest?.('button,a')?.textContent||t?.textContent||'').trim().toLowerCase();
   if(/editar|ver\s*\/\s*editar/.test(txt)){
     e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
     const id=await resolveTaskId(t);if(id)openTaskId(id);return;
   }
   const row=t?.closest?.('.waSideItem,[data-task-id],[data-agenda-id],[data-id]');
   if(row&&!t.closest('button,a')){const id=await resolveTaskId(t);if(id){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openTaskId(id)}}
 }
}
M.register('whatsapp-contact-reuse',{install(){bind();document.addEventListener('click',capture,true);document.addEventListener('click',e=>{if(e.target.closest?.('.waChatRow,#waSideCreateContact'))setTimeout(bind,80)},true);setInterval(bind,800)}});
})();
