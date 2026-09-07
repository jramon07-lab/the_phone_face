(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const digits=value=>String(value??'').replace(/\D/g,'').slice(-9);
const SEND_ACTIONS=new Set(['send_template','send_whatsapp_now','__send_whatsapp','schedule_whatsapp']);
const SAFE_RETRY=new Set(['send_template','send_whatsapp_now','__send_whatsapp']);
const state={automations:[],jobs:[],programs:[],templates:[],rows:[],loading:false,lastLoaded:0,timer:0,bound:false};

function stamp(value){const n=new Date(value||0).getTime();return Number.isFinite(n)?n:0}
function fmt(value){if(!value)return'—';try{return new Date(value).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch(_){return String(value)}}
function statusOf(source,row){
 if(source==='automation'){
  const value=norm(row.status);
  return value==='done'?'sent':value==='failed'||value==='error'?'failed':value==='running'?'sending':value==='paused'?'paused':value==='cancelled'?'cancelled':'pending';
 }
 const delivery=norm(row.whatsapp_delivery_status),status=norm(row.status);
 if(status==='cancelled'||delivery==='cancelled')return'cancelled';
 if(status==='completed'||delivery==='sent')return'sent';
 if(delivery==='sending')return'sending';
 if(delivery==='paused')return'paused';
 if(delivery==='uncertain')return'uncertain';
 if(delivery==='failed'||delivery==='error')return'failed';
 return'pending';
}
function operatorOf(auto,context){
 const direct=context?.operator||context?.operador||auto?.trigger_config?.automation_operator||auto?.trigger_config?.operator;
 if(String(direct||'').trim())return String(direct).trim();
 const text=norm(JSON.stringify([auto?.name,auto?.trigger_config,auto?.action_config]));
 if(text.includes('vodafone'))return'Vodafone';if(text.includes('masmovil'))return'MásMóvil';if(text.includes('yoigo'))return'Yoigo';
 if(/(^|\W)o2(\W|$)/.test(text))return'O2';if(text.includes('orange'))return'Orange';if(text.includes('lowi'))return'Lowi';
 return'General';
}
function contactOf(context,row){
 const data=context?.contact_data||{};
 return context?.name||context?.contact_name||data['NOMBRE Y APELLIDOS']||[data.NOMBRE,data.APELLIDOS].filter(Boolean).join(' ')||row?.customer_name||'Contacto';
}
function phoneOf(context,row){const data=context?.contact_data||{};return context?.phone||context?.contact_phone||data['TELÉFONO']||data.TELEFONO||row?.whatsapp_phone||row?.customer_phone||''}
function templateOf(config){
 if(config?.template_id){const found=state.templates.find(x=>String(x.id)===String(config.template_id));if(found)return found}
 const index=Number(config?.template_index);return Number.isInteger(index)&&index>=0?state.templates[index]||null:null;
}
function messageOf(source,row){if(source==='program')return String(row.whatsapp_message||'');const config=row.action_config||{},tpl=templateOf(config);return String(config.text||tpl?.body||'')}
function reasonOf(source,row,auto){
 if(source==='program')return row.description||row.title||'WhatsApp programado';
 const trigger={opportunity_stage:'Cambio de columna',label_assigned:'Etiqueta asignada',message_received:'WhatsApp recibido',message_contains:'Palabra recibida',unanswered:'Sin respuesta'}[auto?.trigger_type]||'Automatización';
 return `${auto?.name||'Automatización'} · ${trigger}`;
}
function makeRows(){
 const autos=new Map(state.automations.map(auto=>[String(auto.id),auto]));
 const jobs=state.jobs.filter(job=>SEND_ACTIONS.has(job.action_type)).map(job=>{const auto=autos.get(String(job.automation_id))||{},context=job.context||{};return{source:'automation',id:String(job.id),automationId:String(job.automation_id||''),eventKey:String(job.event_key||''),actionType:job.action_type,contactId:context.contact_id||'',contact:contactOf(context),phone:phoneOf(context),operator:operatorOf(auto,context),message:messageOf('automation',job),reason:reasonOf('automation',job,auto),when:job.run_at||job.created_at,status:statusOf('automation',job),error:job.error_message||'',attempts:Number(job.attempts||0),updatedAt:job.updated_at||'',raw:job,auto}});
 const programs=state.programs.map(row=>({source:'program',id:String(row.id),automationId:'',eventKey:'',actionType:'scheduled_whatsapp',contactId:row.related_record_id||'',contact:contactOf({},row),phone:phoneOf({},row),operator:operatorOf({name:[row.title,row.description].filter(Boolean).join(' ')},{}),message:messageOf('program',row),reason:reasonOf('program',row),when:row.whatsapp_scheduled_at||row.starts_at||row.created_at,status:statusOf('program',row),error:row.whatsapp_delivery_error||'',attempts:Number(row.whatsapp_attempt_count||0),updatedAt:row.updated_at||'',raw:row,auto:null}));
 const rows=[...jobs,...programs].sort((a,b)=>stamp(b.when)-stamp(a.when));
 const active=rows.filter(row=>['pending','paused','sending'].includes(row.status)),buckets=new Map();
 for(const row of active){const body=norm(row.message).replace(/\s+/g,' ').slice(0,240),phone=digits(row.phone),key=`${phone}|${body||row.automationId+'|'+row.actionType}`;if(!phone)continue;const list=buckets.get(key)||[];list.push(row);buckets.set(key,list)}
 for(const list of buckets.values())for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)if(Math.abs(stamp(list[i].when)-stamp(list[j].when))<=6*3600000){list[i].duplicate=true;list[j].duplicate=true}
 state.rows=rows;return rows;
}
function badge(status){const labels={pending:'Programado',paused:'Pausado',sending:'Enviando',sent:'Enviado',failed:'Fallido',uncertain:'Revisar antes de reenviar',cancelled:'Cancelado'};return`<span class="ccBadge ${esc(status)}">${esc(labels[status]||status)}</span>`}
function sourceLabel(row){return row.source==='automation'?'Automático':'Programado'}
function filtered(){
 const search=norm($('ccSearch')?.value),status=$('ccStatus')?.value||'',operator=$('ccOperator')?.value||'',source=$('ccSource')?.value||'';
 return state.rows.filter(row=>(!status||row.status===status)&&(!operator||row.operator===operator)&&(!source||row.source===source)&&(!search||norm(`${row.contact} ${row.phone} ${row.reason} ${row.message} ${row.error}`).includes(search)));
}
function fillOperators(){const select=$('ccOperator');if(!select)return;const value=select.value,ops=[...new Set(state.rows.map(x=>x.operator).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));select.innerHTML='<option value="">Todos los operadores</option>'+ops.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(ops.includes(value))select.value=value}
function render(){
 if(!$('ccPanel'))return;fillOperators();const rows=filtered(),today=new Date();today.setHours(0,0,0,0);const tomorrow=Date.now()+86400000;
 const counts={pending:state.rows.filter(x=>x.status==='pending'&&stamp(x.when)<=tomorrow).length,sent:state.rows.filter(x=>x.status==='sent'&&stamp(x.when)>=today.getTime()).length,failed:state.rows.filter(x=>['failed','uncertain'].includes(x.status)).length,duplicates:state.rows.filter(x=>x.duplicate).length};
 [['ccKpiPending',counts.pending],['ccKpiSent',counts.sent],['ccKpiFailed',counts.failed],['ccKpiDuplicate',counts.duplicates]].forEach(([id,value])=>{if($(id))$(id).textContent=String(value)});
 const body=$('ccRows');if(!body)return;
 if(!rows.length){body.innerHTML='<div class="ccEmpty"><b>Sin envíos</b><span>No hay registros que coincidan con los filtros.</span></div>';return}
 body.innerHTML=rows.slice(0,500).map(row=>`<article class="ccRow ${row.duplicate?'duplicate':''}">
  <div class="ccWho"><button type="button" data-cc-detail="${esc(row.source)}:${esc(row.id)}"><b>${esc(row.contact)}</b></button><span>${esc(row.phone||'Sin teléfono')} · ${esc(row.operator)}</span></div>
  <div><b>${esc(sourceLabel(row))}</b><span>${esc(row.reason)}</span></div>
  <div><b>${fmt(row.when)}</b><span>${row.duplicate?'⚠ Posible duplicado':esc(row.message?row.message.slice(0,90):'Contenido mediante plantilla')}</span></div>
  <div>${badge(row.status)}${row.error?`<span class="ccError">${esc(row.error.slice(0,110))}</span>`:''}</div>
  <div class="ccActions">${actions(row)}</div>
 </article>`).join('');
}
function actions(row,includeView=true){
 const out=includeView?[`<button type="button" class="secondary" data-cc-detail="${esc(row.source)}:${esc(row.id)}">Ver</button>`]:[];
 if(row.status==='pending')out.push(`<button type="button" data-cc-action="pause" data-cc-row="${esc(row.source)}:${esc(row.id)}">Pausar</button>`,`<button type="button" class="danger" data-cc-action="cancel" data-cc-row="${esc(row.source)}:${esc(row.id)}">Cancelar</button>`);
 if(row.status==='paused')out.push(`<button type="button" data-cc-action="resume" data-cc-row="${esc(row.source)}:${esc(row.id)}">Reanudar</button>`,`<button type="button" class="danger" data-cc-action="cancel" data-cc-row="${esc(row.source)}:${esc(row.id)}">Cancelar</button>`);
 if(row.status==='failed'&&(row.source==='program'||SAFE_RETRY.has(row.actionType)))out.push(`<button type="button" data-cc-action="retry" data-cc-row="${esc(row.source)}:${esc(row.id)}">Reintentar</button>`);
 if(row.status==='uncertain')out.push(`<button type="button" data-cc-action="manual" data-cc-row="${esc(row.source)}:${esc(row.id)}">Revisar en WhatsApp</button>`);
 return out.join('');
}
function rowByKey(key){const [source,...parts]=String(key||'').split(':');return state.rows.find(x=>x.source===source&&x.id===parts.join(':'))}
function detail(row){
 if(!row)return;$('ccDetail')?.remove();const dialog=document.createElement('dialog');dialog.id='ccDetail';dialog.className='ccDetail';dialog.innerHTML=`<div class="ccDetailHead"><div><span>${esc(sourceLabel(row))}</span><h3>${esc(row.contact)}</h3></div><button type="button" data-close>×</button></div><div class="ccDetailGrid"><div><span>Estado</span>${badge(row.status)}</div><div><span>Fecha y hora</span><b>${fmt(row.when)}</b></div><div><span>Teléfono</span><b>${esc(row.phone||'—')}</b></div><div><span>Operador</span><b>${esc(row.operator)}</b></div><div class="wide"><span>Motivo</span><b>${esc(row.reason)}</b></div><div class="wide"><span>Mensaje</span><pre>${esc(row.message||'El contenido se obtiene de la plantilla al ejecutar el envío.')}</pre></div>${row.error?`<div class="wide error"><span>Fallo registrado</span><b>${esc(row.error)}</b></div>`:''}${row.duplicate?'<div class="wide warning"><b>⚠ Hay otro envío activo con el mismo teléfono y contenido en un intervalo cercano.</b></div>':''}</div><div class="ccDetailActions">${actions(row,false)}</div>`;document.body.appendChild(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.querySelectorAll('[data-cc-action]').forEach(button=>button.onclick=async()=>{dialog.close();await act(button.dataset.ccAction,row)});dialog.showModal();
}
async function updateProgram(row,changes){let query=sb.from('agenda_items').update({...changes,updated_at:new Date().toISOString()}).eq('id',row.id);if(row.updatedAt)query=query.eq('updated_at',row.updatedAt);const result=await query.select('id').maybeSingle();if(result.error)throw result.error;if(!result.data)throw new Error('Este envío cambió en otro dispositivo. Actualiza antes de continuar.')}
async function act(action,row){
 if(!row||state.loading)return;
 if(action==='cancel'&&!confirm('¿Cancelar este envío? No se eliminará y seguirá visible en el historial.'))return;
 if(action==='retry'&&!confirm('¿Reintentar este envío ahora? Solo se permite cuando el envío anterior consta como fallido.'))return;
 if(action==='manual'){const phone=digits(row.phone);if(!phone)return alert('El contacto no tiene un teléfono válido.');window.open(`https://wa.me/34${phone}${row.message?'?text='+encodeURIComponent(row.message):''}`,'_blank','noopener,noreferrer');return}
 try{
  if(row.source==='automation'){
   if(action==='pause'){const {error}=await sb.rpc('crm_set_automation_job_pause',{p_job_id:row.id,p_paused:true});if(error)throw error}
   if(action==='resume'){const {error}=await sb.rpc('crm_set_automation_job_pause',{p_job_id:row.id,p_paused:false});if(error)throw error}
   if(action==='cancel'){const {error}=await sb.rpc('crm_cancel_automation_job',{p_job_id:row.id});if(error)throw error}
   if(action==='retry'){const {error}=await sb.rpc('crm_retry_automation_step',{p_job_id:row.id});if(error)throw error}
  }else{
   if(action==='pause')await updateProgram(row,{whatsapp_delivery_status:'paused',whatsapp_delivery_error:null});
   if(action==='resume'){const next=new Date(Math.max(Date.now()+60000,stamp(row.when)||0)).toISOString();await updateProgram(row,{status:'pending',whatsapp_delivery_status:'pending',whatsapp_delivery_error:null,whatsapp_scheduled_at:next,starts_at:next})}
   if(action==='cancel')await updateProgram(row,{status:'cancelled',whatsapp_delivery_status:'cancelled',whatsapp_delivery_error:null});
   if(action==='retry'){const next=new Date(Date.now()+60000).toISOString();await updateProgram(row,{status:'pending',whatsapp_delivery_status:'pending',whatsapp_delivery_error:null,whatsapp_scheduled_at:next,starts_at:next})}
  }
  await load(true);
 }catch(error){alert(error?.message||'No se pudo actualizar el envío.')}
}
async function load(force=false){
 if(state.loading||(!$('ccPanel')&&!force)||(!force&&Date.now()-state.lastLoaded<15000))return;state.loading=true;const note=$('ccUpdated');if(note)note.textContent='Actualizando…';
 try{
  const [automations,jobs,programs,templates]=await Promise.all([
   sb.rpc('crm_list_automations'),
   sb.from('crm_server_automation_jobs').select('id,automation_id,event_key,action_type,action_config,context,run_at,status,attempts,error_message,created_at,updated_at,completed_at').in('action_type',[...SEND_ACTIONS]).order('run_at',{ascending:false}).limit(1500),
   sb.from('agenda_items').select('id,title,description,customer_name,customer_phone,starts_at,status,related_record_id,whatsapp_phone,whatsapp_message,whatsapp_scheduled_at,whatsapp_delivery_status,whatsapp_delivery_error,whatsapp_sent_at,whatsapp_attempt_count,created_at,updated_at').eq('whatsapp_enabled',true).order('whatsapp_scheduled_at',{ascending:false}).limit(800),
   sb.from('wa_templates').select('id,name,body,category').order('name').limit(500)
  ]);
  for(const result of [automations,jobs,programs])if(result.error)throw result.error;
  state.automations=automations.data||[];state.jobs=jobs.data||[];state.programs=programs.data||[];state.templates=templates.error?[]:templates.data||[];state.lastLoaded=Date.now();makeRows();render();if(note)note.textContent=`Actualizado ${new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`;
 }catch(error){if(note)note.textContent='No se pudo actualizar';const body=$('ccRows');if(body)body.innerHTML=`<div class="ccEmpty"><b>No se pudo cargar el control de envíos</b><span>${esc(error?.message||'Inténtalo de nuevo.')}</span></div>`}
 finally{state.loading=false}
}
function css(){if($('ccStyles'))return;const style=document.createElement('style');style.id='ccStyles';style.textContent=`
.ccLaunch{white-space:nowrap}.ccPanel{position:fixed;inset:0;z-index:100500;background:#f5f7fb;overflow:auto;color:#172033}.ccShell{width:min(1420px,calc(100% - 28px));margin:18px auto 32px}.ccHead{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:13px}.ccHead h2{margin:7px 0 4px;font-size:24px}.ccHead p{margin:0;color:#667085}.ccHeadActions{display:flex;gap:8px}.ccKpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}.ccKpi{background:#fff;border:1px solid #dfe5ed;border-radius:13px;padding:13px}.ccKpi span{display:block;color:#667085;font-size:11px}.ccKpi b{display:block;margin-top:4px;font-size:22px}.ccKpi.warn b{color:#b54708}.ccKpi.bad b{color:#b42318}.ccCard{background:#fff;border:1px solid #dfe5ed;border-radius:14px;padding:14px}.ccFilters{display:grid;grid-template-columns:minmax(240px,1fr) repeat(3,minmax(140px,190px));gap:8px;margin-bottom:12px}.ccFilters input,.ccFilters select{margin:0;min-height:42px}.ccTableHead,.ccRow{display:grid;grid-template-columns:minmax(180px,1.1fr) minmax(210px,1.3fr) minmax(190px,1.1fr) minmax(150px,.8fr) minmax(190px,auto);gap:10px;align-items:center}.ccTableHead{padding:8px 10px;color:#667085;font-size:10px;font-weight:800;text-transform:uppercase}.ccRow{padding:11px 10px;border-top:1px solid #edf1f5}.ccRow.duplicate{background:#fffaf0}.ccRow>div{min-width:0}.ccRow b,.ccRow span{display:block}.ccRow span{margin-top:3px;color:#667085;font-size:10px;overflow:hidden;text-overflow:ellipsis}.ccWho button{border:0;background:transparent;padding:0;color:#145bc2;text-align:left;cursor:pointer}.ccActions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}.ccActions button{border:1px solid #cfd8e5;background:#fff;border-radius:8px;padding:7px 9px;color:#344054;font-weight:750;font-size:10px;cursor:pointer}.ccActions button:not(.secondary):not(.danger){background:#175cd3;color:#fff;border-color:#175cd3}.ccActions .danger{color:#b42318;border-color:#efc7c7}.ccBadge{display:inline-flex!important;width:max-content;padding:5px 8px;border-radius:999px;font-size:9px!important;font-weight:850}.ccBadge.pending{background:#fff4d6;color:#8a6100}.ccBadge.paused,.ccBadge.cancelled{background:#f2f4f7;color:#667085}.ccBadge.sending{background:#eaf2ff;color:#175cd3}.ccBadge.sent{background:#e9f8ef;color:#23733c}.ccBadge.failed,.ccBadge.uncertain{background:#fff0f0;color:#b42318}.ccError{color:#b42318!important}.ccEmpty{display:grid;gap:5px;text-align:center;padding:42px;color:#667085}.ccDetail{width:min(720px,calc(100% - 24px));border:0;border-radius:16px;padding:0;box-shadow:0 24px 80px #102a4c55}.ccDetail::backdrop{background:#102033aa}.ccDetailHead{display:flex;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #e5eaf0}.ccDetailHead h3{margin:4px 0 0}.ccDetailHead button{border:0;background:#eef2f6;border-radius:50%;width:34px;height:34px;font-size:22px}.ccDetailGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:18px 20px}.ccDetailGrid>div{padding:10px;border:1px solid #e6ebf1;border-radius:10px}.ccDetailGrid span{display:block;color:#667085;font-size:10px;margin-bottom:5px}.ccDetailGrid .wide{grid-column:1/-1}.ccDetailGrid pre{white-space:pre-wrap;word-break:break-word;margin:0;font:inherit}.ccDetailGrid .warning{background:#fff8e7;border-color:#efd591}.ccDetailGrid .error{background:#fff2f2;border-color:#efc7c7}.ccDetailActions{display:flex;justify-content:flex-end;gap:7px;padding:0 20px 18px}.ccDetailActions button{padding:9px 11px;border-radius:8px;border:1px solid #ccd5e1;background:#fff;font-weight:750}.ccDetailActions button:not(.secondary):not(.danger){background:#175cd3;color:#fff}.ccDetailActions .danger{color:#b42318}.ccUpdated{font-size:10px;color:#667085;align-self:center}
@media(max-width:900px){.ccKpis{grid-template-columns:1fr 1fr}.ccFilters{grid-template-columns:1fr 1fr}.ccTableHead{display:none}.ccRow{grid-template-columns:1fr 1fr}.ccActions{grid-column:1/-1;justify-content:flex-start}}
@media(max-width:560px){.ccShell{width:calc(100% - 16px);margin:8px auto 20px}.ccHead{flex-direction:column}.ccHeadActions{width:100%}.ccHeadActions button{flex:1}.ccKpis,.ccFilters,.ccRow,.ccDetailGrid{grid-template-columns:1fr}.ccDetailGrid .wide,.ccActions{grid-column:auto}.ccCard{padding:10px}}
`;document.head.appendChild(style)}
function panel(){
 if($('ccPanel'))return;$('ccDetail')?.remove();const root=document.createElement('section');root.id='ccPanel';root.className='ccPanel';root.innerHTML=`<div class="ccShell"><header class="ccHead"><div><button type="button" class="secondary" id="ccClose">← Volver</button><h2>Control de envíos</h2><p>Automatizaciones y WhatsApp programados en un único lugar. Pausar o cancelar no borra el historial.</p></div><div class="ccHeadActions"><span id="ccUpdated" class="ccUpdated"></span><button type="button" class="secondary" id="ccReload">↻ Actualizar</button></div></header><div class="ccKpis"><div class="ccKpi"><span>Por enviar en 24 horas</span><b id="ccKpiPending">0</b></div><div class="ccKpi"><span>Enviados hoy</span><b id="ccKpiSent">0</b></div><div class="ccKpi bad"><span>Fallidos o por revisar</span><b id="ccKpiFailed">0</b></div><div class="ccKpi warn"><span>Posibles duplicados activos</span><b id="ccKpiDuplicate">0</b></div></div><div class="ccCard"><div class="ccFilters"><input id="ccSearch" type="search" placeholder="Buscar contacto, teléfono, mensaje o automatización"><select id="ccStatus"><option value="">Todos los estados</option><option value="pending">Programados</option><option value="paused">Pausados</option><option value="sending">Enviando</option><option value="sent">Enviados</option><option value="failed">Fallidos</option><option value="uncertain">Por revisar</option><option value="cancelled">Cancelados</option></select><select id="ccOperator"><option value="">Todos los operadores</option></select><select id="ccSource"><option value="">Todos los tipos</option><option value="automation">Automáticos</option><option value="program">Programados manualmente</option></select></div><div class="ccTableHead"><span>Contacto</span><span>Origen y motivo</span><span>Fecha y contenido</span><span>Estado</span><span>Acciones</span></div><div id="ccRows"><div class="ccEmpty">Cargando…</div></div></div></div>`;document.body.appendChild(root);$('ccClose').onclick=close;$('ccReload').onclick=()=>load(true);['ccSearch','ccStatus','ccOperator','ccSource'].forEach(id=>{$(id).addEventListener(id==='ccSearch'?'input':'change',render)});root.onclick=event=>{const detailButton=event.target.closest('[data-cc-detail]');if(detailButton){detail(rowByKey(detailButton.dataset.ccDetail));return}const button=event.target.closest('[data-cc-action]');if(button)act(button.dataset.ccAction,rowByKey(button.dataset.ccRow))};load(true)
}
function close(){$('ccDetail')?.close();$('ccPanel')?.remove()}
function launchButton(container,label='Control de envíos'){if(!container)return;let button=container.querySelector('.ccLaunch');if(!button){button=document.createElement('button');button.type='button';button.className='primary ccLaunch';button.textContent='📨 '+label;container.appendChild(button)}button.onclick=panel}
function ensureLaunchers(){
 const autoHead=$('view-automations')?.querySelector('.pageHeader');launchButton(autoHead,'Control de envíos');
 $('view-whatsapplive')?.querySelector('.ccLaunch')?.remove();
 const waHead=$('view-whatsapp')?.querySelector('.wapHeaderActions,.pageHeader');launchButton(waHead,'Control de envíos');
}
function bind(){if(state.bound)return;state.bound=true;css();ensureLaunchers();document.addEventListener('click',event=>{if(event.target.closest?.('.nav[data-view="automations"],.nav[data-view="whatsapp"]'))setTimeout(ensureLaunchers,180)},true);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('ccPanel'))close()});const observer=new MutationObserver(()=>setTimeout(ensureLaunchers,30));observer.observe(document.body,{childList:true,subtree:true});state.timer=setInterval(()=>{if($('ccPanel'))load()},60000)}
window.TPFAutomationControlCenter={statusOf,operatorOf,makeRows,open:panel,reload:()=>load(true)};
M.register('automation-control-center',{install(){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind()}});
})();
