(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const ACTION_NAMES={flow_v1:'Inicio de automatización',create_opportunity:'Crear oportunidad',create_task:'Crear tarea',send_template:'Enviar plantilla de WhatsApp',send_whatsapp_now:'Enviar WhatsApp',__send_whatsapp:'Enviar WhatsApp',assign_label:'Asignar etiqueta',move_opportunity:'Mover oportunidad',schedule_whatsapp:'Programar WhatsApp',record_offer_month:'Registrar oferta',record_sale_month:'Registrar venta'};
const SAFE_RETRY=new Set(['assign_label','send_template','__send_whatsapp','send_whatsapp_now','move_opportunity']);
const cache=new Map(),requests=new Map();
let dialogContact=null,timer=0,bound=false;

function ts(value){const n=new Date(value||0).getTime();return Number.isFinite(n)?n:0}
function fmt(value){if(!value)return'—';try{return new Date(value).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch(_){return String(value)}}
function rootOf(job){const context=job.context||{};if(context.flow_root)return String(context.flow_root).replace(/:flow$/,'');return String(job.event_key||job.id||'').replace(/:flow:(?:action|repeat):.*$/,'').replace(/:flow$/,'')}
function executionStatus(jobs){const statuses=jobs.map(job=>String(job.status||'').toLowerCase());if(statuses.some(x=>x==='failed'||x==='error'))return'error';if(statuses.includes('running'))return'running';if(statuses.includes('pending'))return'pending';if(statuses.includes('paused'))return'paused';if(statuses.includes('cancelled'))return'cancelled';return'completed'}
function contactName(contact){const d=contact?.data||{};return d['NOMBRE Y APELLIDOS']||[d.NOMBRE,d.APELLIDOS].filter(Boolean).join(' ')||'Contacto'}
function actionName(job){return ACTION_NAMES[job?.action_type]||job?.action_type||'Paso de automatización'}
function groupJobs(jobs,automations=[]){
 const names=new Map((automations||[]).map(row=>[String(row.id),row]));
 const groups=new Map();
 for(const job of jobs||[]){
  const automationId=String(job.automation_id||''),root=rootOf(job),key=automationId+'::'+root;
  if(!groups.has(key))groups.set(key,{key,root,automationId,automation:names.get(automationId)||{id:automationId,name:'Automatización'},jobs:[]});
  groups.get(key).jobs.push(job);
 }
 return [...groups.values()].map(item=>{
  item.jobs.sort((a,b)=>ts(a.run_at||a.created_at)-ts(b.run_at||b.created_at));
  item.status=executionStatus(item.jobs);
  const starts=item.jobs.map(job=>ts(job.context?.event_at||job.created_at||job.run_at)).filter(Boolean);item.startedAt=starts.length?Math.min(...starts):0;
  item.nextJob=item.jobs.filter(job=>String(job.status)==='pending').sort((a,b)=>ts(a.run_at)-ts(b.run_at))[0]||null;
  item.failedJob=item.jobs.find(job=>['failed','error'].includes(String(job.status||'').toLowerCase()))||null;
  item.pausedJob=item.jobs.find(job=>String(job.status)==='paused')||null;
  return item;
 }).sort((a,b)=>{
  const priority={error:0,running:1,pending:2,paused:3,completed:4,cancelled:5};
  return(priority[a.status]??9)-(priority[b.status]??9)||(b.startedAt||0)-(a.startedAt||0);
 });
}
function summarize(executions){
 const active=executions.filter(row=>['pending','running','paused'].includes(row.status));
 const scheduled=executions.flatMap(row=>row.jobs).filter(job=>String(job.status)==='pending'&&ts(job.run_at)>Date.now());
 const completed=executions.filter(row=>row.status==='completed');
 const errors=executions.filter(row=>row.status==='error');
 const next=scheduled.slice().sort((a,b)=>ts(a.run_at)-ts(b.run_at))[0]||null;
 return{active:active.length,scheduled:scheduled.length,completed:completed.length,errors:errors.length,next};
}
function badge(status){const labels={pending:'Pendiente',running:'En curso',paused:'Pausada',completed:'Completada',error:'Con error',cancelled:'Cancelada'};return`<span class="casBadge ${esc(status)}">${esc(labels[status]||status)}</span>`}
function automationLabel(item){return String(item.automation?.name||'Automatización')}
function summaryHtml(snapshot,compact=false){
 const s=snapshot.summary;
 return `<div class="casHead"><div><b>Automatizaciones</b><small>${s.active} activas · ${s.scheduled} programadas${s.errors?' · '+s.errors+' errores':''}</small></div><div class="casHeadActions"><button type="button" class="casRefresh" data-cas-refresh title="Actualizar" aria-label="Actualizar automatizaciones">↻</button><button type="button" class="casToggle" data-cas-toggle title="Plegar o desplegar" aria-label="Plegar o desplegar automatizaciones" aria-expanded="true">⌃</button></div></div>
 <div class="casPanelBody"><div class="casMetrics"><span class="active"><b>${s.active}</b> activas</span><span class="scheduled"><b>${s.scheduled}</b> programadas</span><span class="completed"><b>${s.completed}</b> completadas</span><span class="${s.errors?'errors':'clear'}"><b>${s.errors}</b> errores</span></div>
 <div class="casNext"><span>Próximo envío</span><b>${s.next?fmt(s.next.run_at):'Sin envíos pendientes'}</b></div>
 ${compact?'':`<div class="casPreview">${snapshot.executions.slice(0,3).map(item=>`<div><span>${badge(item.status)} ${esc(automationLabel(item))}</span><small>${item.nextJob?'Próximo paso: '+esc(fmt(item.nextJob.run_at)):item.failedJob?esc(item.failedJob.error_message||'Fallo registrado'):'Sin pasos pendientes'}</small></div>`).join('')||'<div class="casEmpty">Este cliente todavía no tiene automatizaciones registradas.</div>'}</div>`}
 <button type="button" class="casOpen" data-cas-open>Ver todas las automatizaciones</button></div>`;
}
function loadingHtml(){return'<div class="casHead"><b>Automatizaciones</b></div><div class="casLoading">Comprobando…</div>'}
function errorHtml(message){return`<div class="casHead"><b>Automatizaciones</b></div><div class="casLoadError">No se pudo cargar: ${esc(message||'inténtalo de nuevo')}</div><button type="button" class="casOpen" data-cas-refresh>Reintentar</button>`}

function ensureContainers(){
 const right=document.querySelector('#contactModal .cpRight');
 if(right){
  let section=$('cpAutomationStatus');
  if(!section){section=document.createElement('section');section.id='cpAutomationStatus';section.className='cpSideSection casCard';section.innerHTML=loadingHtml()}
  const offers=$('cpOffersSection');
  if(offers&&section.nextElementSibling!==offers)offers.before(section);
  else if(!offers&&section.parentElement!==right)right.prepend(section);
 }
 const waCard=$('waContactCard'),waOpp=$('waSideOpps')?.closest('.waSideSection');
 if(waCard&&waOpp&&!$('waAutomationStatus')){const section=document.createElement('section');section.id='waAutomationStatus';section.className='waSideSection casCard compact collapsed';section.innerHTML=loadingHtml();waOpp.before(section)}
}
function currentProfile(){try{return typeof currentContact!=='undefined'&&currentContact?currentContact:null}catch(_){return null}}
function currentWhatsapp(){try{return typeof waLiveState!=='undefined'&&waLiveState?.contact?waLiveState.contact:null}catch(_){return null}}
function visible(el){return !!el&&!el.classList.contains('hidden')}
function targetStillMatches(target,contactId){const current=target==='profile'?currentProfile():currentWhatsapp();return String(current?.id||'')===String(contactId)}

async function fetchSnapshot(contact,force=false){
 const id=String(contact?.id||'');if(!id)throw new Error('Contacto sin identificar');
 const saved=cache.get(id);if(!force&&saved&&Date.now()-saved.loadedAt<20000)return saved;
 if(requests.has(id))return requests.get(id);
 const request=(async()=>{
  const [automationResult,jobsResult,templatesResult]=await Promise.all([
   sb.rpc('crm_list_automations'),
   sb.from('crm_server_automation_jobs').select('id,automation_id,event_key,action_type,action_config,context,run_at,status,attempts,error_message,created_at,updated_at,completed_at').contains('context',{contact_id:id}).order('created_at',{ascending:false}).limit(500),
   sb.from('wa_templates').select('id,name,body,category').order('name').limit(500)
  ]);
  if(jobsResult.error)throw jobsResult.error;
  const executions=groupJobs(jobsResult.data||[],automationResult.error?[]:automationResult.data||[]);
  const templates=new Map((templatesResult.error?[]:templatesResult.data||[]).map(row=>[String(row.id),row]));
  const snapshot={contactId:id,contactName:contactName(contact),executions,summary:summarize(executions),templates,loadedAt:Date.now()};cache.set(id,snapshot);return snapshot;
 })();requests.set(id,request);try{return await request}finally{requests.delete(id)}
}
async function renderTarget(target,contact,force=false){
 ensureContainers();const box=$(target==='profile'?'cpAutomationStatus':'waAutomationStatus');if(!box||!contact?.id)return;
 const id=String(contact.id);box.dataset.contactId=id;if(!cache.has(id))box.innerHTML=loadingHtml();
 try{const snapshot=await fetchSnapshot(contact,force);if(!targetStillMatches(target,id)||box.dataset.contactId!==id)return;box.innerHTML=summaryHtml(snapshot,target==='whatsapp');const toggle=box.querySelector('[data-cas-toggle]'),collapsed=box.classList.contains('collapsed');if(toggle){toggle.textContent=collapsed?'⌄':'⌃';toggle.setAttribute('aria-expanded',String(!collapsed))}}
 catch(error){if(targetStillMatches(target,id)&&box.dataset.contactId===id)box.innerHTML=errorHtml(error?.message||error);M.report('contact-automation-status',error,'load '+target)}
}
function refreshVisible(force=false){
 ensureContainers();const profile=currentProfile(),wa=currentWhatsapp();
 if(profile&&visible($('contactModal')))renderTarget('profile',profile,force);
 if(wa&&visible($('waContactCard')))renderTarget('whatsapp',wa,force);
 else if(visible($('waContactCard'))&&$('waAutomationStatus')){$('waAutomationStatus').dataset.contactId='';$('waAutomationStatus').innerHTML='<div class="casHead"><b>Automatizaciones</b></div><div class="casLoading">Esperando contacto vinculado…</div>'}
}

function templatesOf(item,snapshot){
 const configs=[];for(const job of item.jobs||[]){if(job.action_type==='send_template')configs.push(job.action_config||{});for(const step of job.action_config?.steps||[])if(step?.kind==='action'&&step.action_type==='send_template')configs.push(step.config||{})}
 const seen=new Set();return configs.map(config=>{const id=String(config.template_id||''),row=snapshot.templates?.get(id)||{};return{id,name:row.name||config.template_name||id||'Plantilla de WhatsApp',body:row.body||config.body||config.text||'',category:row.category||''}}).filter(row=>{const key=row.id+'|'+row.name;if(seen.has(key))return false;seen.add(key);return true})
}
function templateRows(item,snapshot){const rows=templatesOf(item,snapshot);return rows.length?`<div class="casTemplates"><b>Mensajes configurados</b>${rows.map(row=>`<details class="casTemplate"><summary><span>Plantilla de WhatsApp</span><b>${esc(row.name)}</b><i>⌄</i></summary><div>${row.category?`<small>${esc(row.category)}</small>`:''}<p>${row.body?esc(row.body):'El contenido de esta plantilla no está disponible.'}</p></div></details>`).join('')}</div>`:''}
function detailRows(snapshot){return snapshot.executions.map((item,index)=>`<details class="casExecution ${esc(item.status)}" ${index===0&&['pending','running','error'].includes(item.status)?'open':''}><summary class="casExecutionTop"><div><b>${esc(automationLabel(item))}</b><small>${esc(fmt(item.startedAt))}</small></div><div>${badge(item.status)}<i>⌄</i></div></summary><div class="casExecutionBody"><div class="casExecutionInfo">${item.nextJob?`<span>Próximo paso</span><b>${esc(actionName(item.nextJob))} · ${esc(fmt(item.nextJob.run_at))}</b>`:item.failedJob?`<span>Fallo registrado</span><b class="error">${esc(item.failedJob.error_message||actionName(item.failedJob))}</b>`:'<span>Estado</span><b>Sin pasos pendientes</b>'}</div>${templateRows(item,snapshot)}<div class="casExecutionActions">${['pending','running'].includes(item.status)?`<button type="button" class="danger" data-cas-cancel="${esc(item.key)}">Cancelar seguimiento</button>`:''}${item.pausedJob?`<button type="button" data-cas-resume="${esc(item.pausedJob.id)}">Reanudar</button>`:''}${item.failedJob&&SAFE_RETRY.has(item.failedJob.action_type)?`<button type="button" data-cas-retry="${esc(item.failedJob.id)}">Reintentar paso</button>`:''}</div></div></details>`).join('')||'<div class="casEmpty large">No hay automatizaciones registradas para este cliente.</div>'}
function closeDialog(){$('casDialog')?.close()}
function openDialog(contact){
 const snapshot=cache.get(String(contact?.id||''));if(!snapshot)return renderTarget(visible($('contactModal'))?'profile':'whatsapp',contact,true);
 $('casDialog')?.remove();dialogContact=contact;const dialog=document.createElement('dialog');dialog.id='casDialog';dialog.className='casDialog';dialog.innerHTML=`<div class="casDialogHead"><div><span>Automatizaciones del cliente</span><h3>${esc(snapshot.contactName)}</h3></div><button type="button" data-cas-close aria-label="Cerrar">×</button></div><div class="casDialogMetrics">${summaryHtml(snapshot,true)}</div><div class="casDialogBody">${detailRows(snapshot)}</div>`;document.body.appendChild(dialog);dialog.querySelector('[data-cas-close]').onclick=closeDialog;dialog.addEventListener('close',()=>{dialog.remove();dialogContact=null});dialog.showModal();
}
async function runAction(action,value){
 const contact=dialogContact;if(!contact)return;
 let prompt='';if(action==='cancel')prompt='¿Cancelar los pasos pendientes de este seguimiento? Lo ya realizado se conservará.';if(action==='resume')prompt='¿Reanudar este paso pendiente?';if(action==='retry')prompt='¿Reintentar este paso fallido ahora?';if(prompt&&!confirm(prompt))return;
 try{
  if(action==='cancel'){const snapshot=cache.get(String(contact.id)),item=snapshot?.executions.find(row=>row.key===value);if(!item)throw new Error('La ejecución ya no está disponible');const result=await sb.rpc('crm_cancel_automation_execution',{p_automation_id:item.automationId,p_root:item.root});if(result.error)throw result.error}
  if(action==='resume'){const result=await sb.rpc('crm_set_automation_job_pause',{p_job_id:value,p_paused:false});if(result.error)throw result.error}
  if(action==='retry'){const result=await sb.rpc('crm_retry_automation_step',{p_job_id:value});if(result.error)throw result.error}
  cache.delete(String(contact.id));const snapshot=await fetchSnapshot(contact,true);const dialog=$('casDialog');if(dialog){dialog.querySelector('.casDialogMetrics').innerHTML=summaryHtml(snapshot,true);dialog.querySelector('.casDialogBody').innerHTML=detailRows(snapshot)}refreshVisible(true);
 }catch(error){alert(error?.message||'No se pudo actualizar la automatización.');M.report('contact-automation-status',error,'action '+action)}
}
function click(event){
 const toggle=event.target.closest?.('[data-cas-toggle]');if(toggle){event.preventDefault();event.stopPropagation();const card=toggle.closest('.casCard');if(card){const collapsed=card.classList.toggle('collapsed');toggle.textContent=collapsed?'⌄':'⌃';toggle.setAttribute('aria-expanded',String(!collapsed))}return}
 const refresh=event.target.closest?.('[data-cas-refresh]');if(refresh){event.preventDefault();event.stopPropagation();refreshVisible(true);return}
 const open=event.target.closest?.('[data-cas-open]');if(open){event.preventDefault();event.stopPropagation();const card=open.closest('.casCard'),contact=card?.id==='waAutomationStatus'?currentWhatsapp():currentProfile();if(contact)openDialog(contact);return}
 const cancel=event.target.closest?.('[data-cas-cancel]');if(cancel)return runAction('cancel',cancel.dataset.casCancel);
 const resume=event.target.closest?.('[data-cas-resume]');if(resume)return runAction('resume',resume.dataset.casResume);
 const retry=event.target.closest?.('[data-cas-retry]');if(retry)return runAction('retry',retry.dataset.casRetry);
}
function css(){if($('casStyles'))return;const style=document.createElement('style');style.id='casStyles';style.textContent=`
.casCard{display:block!important}.casHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}.casHead>div:first-child>b,.casHead>div:first-child>small{display:block}.casHead>div:first-child>b{font-size:14px}.casHead>div:first-child>small{margin-top:2px;color:#667085;font-size:8px}.casHeadActions{display:flex;align-items:center;gap:3px}.casRefresh,.casToggle{border:0!important;background:transparent!important;color:#667085!important;padding:3px 6px!important;min-width:0!important;font-size:15px!important}.casToggle{font-size:17px!important}.casCard.collapsed .casPanelBody{display:none}.casCard.collapsed .casHead{margin-bottom:0}.casMetrics{display:grid;grid-template-columns:1fr 1fr;gap:6px}.casMetrics>span{padding:7px 8px;border-radius:8px;background:#f2f4f7;color:#475467;font-size:9px;white-space:nowrap}.casMetrics>span b{font-size:12px}.casMetrics .active{background:#eaf2ff;color:#175cd3}.casMetrics .scheduled{background:#fff5dc;color:#8a6100}.casMetrics .completed{background:#eaf8ef;color:#23733c}.casMetrics .errors{background:#fff0f0;color:#b42318}.casNext{display:flex;justify-content:space-between;gap:8px;margin-top:9px;padding-top:9px;border-top:1px solid #edf1f5;font-size:9px}.casNext span{color:#667085}.casNext b{text-align:right}.casPreview{display:grid;gap:6px;margin-top:8px}.casPreview>div{padding:7px;border:1px solid #edf1f5;border-radius:8px}.casPreview span,.casPreview small{display:block}.casPreview span{font-size:9px;font-weight:700}.casPreview small{margin-top:4px;color:#667085;font-size:8px}.casOpen{width:100%;margin-top:8px!important;padding:7px!important;border:1px solid #cfd8e5!important;border-radius:8px!important;background:#fff!important;color:#175cd3!important;font-size:9px!important;font-weight:800!important}.casLoading,.casLoadError,.casEmpty{padding:12px;text-align:center;color:#667085;font-size:9px}.casLoadError{color:#b42318}.casBadge{display:inline-flex;padding:4px 7px;border-radius:999px;background:#f2f4f7;color:#475467;font-size:8px;font-weight:850}.casBadge.pending,.casBadge.paused{background:#fff5dc;color:#8a6100}.casBadge.running{background:#eaf2ff;color:#175cd3}.casBadge.completed{background:#eaf8ef;color:#23733c}.casBadge.error{background:#fff0f0;color:#b42318}.casDialog{width:min(780px,calc(100% - 24px));max-height:90vh;border:0;border-radius:16px;padding:0;box-shadow:0 24px 80px #102a4c55}.casDialog::backdrop{background:#102033aa}.casDialogHead{display:flex;justify-content:space-between;align-items:flex-start;padding:18px 20px;border-bottom:1px solid #e5eaf0}.casDialogHead span{font-size:10px;color:#667085}.casDialogHead h3{margin:4px 0 0}.casDialogHead button{border:0;background:#eef2f6;border-radius:50%;width:34px;height:34px;font-size:22px}.casDialogMetrics{padding:14px 20px;background:#f8fafc}.casDialogMetrics .casHead,.casDialogMetrics .casOpen{display:none}.casDialogMetrics .casMetrics{grid-template-columns:repeat(4,1fr)}.casDialogBody{display:grid;gap:9px;padding:16px 20px 22px;max-height:58vh;overflow:auto}.casExecution{border:1px solid #e4e9f0;border-radius:12px;background:#fff;overflow:hidden}.casExecution.error{border-color:#efc7c7;background:#fffafa}.casExecution>summary{list-style:none;cursor:pointer;padding:12px}.casExecution>summary::-webkit-details-marker,.casTemplate>summary::-webkit-details-marker{display:none}.casExecutionTop{display:flex;justify-content:space-between;gap:10px;align-items:center}.casExecutionTop>div:last-child{display:flex;align-items:center;gap:9px}.casExecutionTop i,.casTemplate summary i{font-style:normal;color:#98a2b3;transition:transform .18s}.casExecution[open]>.casExecutionTop i,.casTemplate[open]>summary i{transform:rotate(180deg)}.casExecutionTop small{display:block;margin-top:3px;color:#667085;font-size:9px}.casExecutionBody{padding:0 12px 12px}.casExecutionInfo{display:grid;grid-template-columns:110px 1fr;gap:8px;padding-top:10px;border-top:1px solid #edf1f5;font-size:9px}.casExecutionInfo span{color:#667085}.casExecutionInfo .error{color:#b42318}.casTemplates{margin-top:11px}.casTemplates>b{display:block;margin-bottom:6px;font-size:9px;color:#475467}.casTemplate{border:1px solid #dbe4f0;border-radius:10px;background:#f8fbff;overflow:hidden}.casTemplate+ .casTemplate{margin-top:6px}.casTemplate>summary{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;padding:9px 10px;cursor:pointer;font-size:9px}.casTemplate>summary span{color:#667085}.casTemplate>summary b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.casTemplate>div{padding:0 10px 10px;border-top:1px solid #e6edf5}.casTemplate small{display:block;margin-top:8px;color:#667085}.casTemplate p{margin:7px 0 0;padding:10px;border-radius:8px;background:#fff;color:#344054;white-space:pre-wrap;line-height:1.45;font-size:10px}.casExecutionActions{display:flex;justify-content:flex-end;gap:6px;margin-top:11px}.casExecutionActions button{padding:7px 9px;border:1px solid #cfd8e5;border-radius:8px;background:#fff;font-size:9px;font-weight:800}.casExecutionActions .danger{color:#b42318;border-color:#efc7c7}.casEmpty.large{padding:32px}
#waAutomationStatus.compact .casMetrics{grid-template-columns:repeat(2,1fr)}#waAutomationStatus.compact .casMetrics .completed{display:none}#waAutomationStatus.compact .casNext{display:grid}#waAutomationStatus.compact .casNext b{text-align:left}
@media(max-width:700px){.casDialogMetrics .casMetrics{grid-template-columns:1fr 1fr}.casExecutionInfo{grid-template-columns:1fr}.casExecutionActions{justify-content:flex-start;flex-wrap:wrap}}
`;document.head.appendChild(style)}
function bind(){if(bound)return;bound=true;css();ensureContainers();document.addEventListener('click',click,true);window.addEventListener('tpf:contact-open',()=>setTimeout(()=>refreshVisible(true),30));window.addEventListener('tpf:contact-updated',()=>setTimeout(()=>refreshVisible(true),30));const observer=new MutationObserver(()=>setTimeout(()=>refreshVisible(false),40));for(const target of [$('waSideName'),$('waContactState')])if(target)observer.observe(target,{childList:true,subtree:true});timer=setInterval(()=>{if(!document.hidden)refreshVisible(true)},30000);setTimeout(()=>refreshVisible(false),600)}
window.TPFContactAutomationStatus={rootOf,executionStatus,groupJobs,summarize,fetchSnapshot,refresh:()=>refreshVisible(true),open:contact=>openDialog(contact)};
M.register('contact-automation-status',{install(){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind()}});
})();
