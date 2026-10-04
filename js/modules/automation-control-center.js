(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const digits=value=>String(value??'').replace(/\D/g,'').slice(-9);
const SEND_ACTIONS=new Set(['send_template','send_whatsapp_now','__send_whatsapp','schedule_whatsapp']);
const SAFE_RETRY=new Set(['send_template','send_whatsapp_now','__send_whatsapp']);
const state={automations:[],jobs:[],programs:[],templates:[],rows:[],history:[],historyTotal:0,historyOffset:0,page:1,loading:false,lastLoaded:0,timer:0,bound:false};

function stamp(value){const n=new Date(value||0).getTime();return Number.isFinite(n)?n:0}
function fmt(value){if(!value)return'—';try{return new Date(value).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch(_){return String(value)}}
function statusOf(source,row){
 if(source==='automation'){
  if(row.action_config?.__delivery_receipt?.idMessage)return 'sent';
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
function contactVar(ctx,key){const data=ctx?.contact_data&&typeof ctx.contact_data==="object"?ctx.contact_data:{};const wanted=String(key||"").trim().toLowerCase();for(const [k,v] of Object.entries(data)){if(String(k).trim().toLowerCase()===wanted)return String(v??"");}return "";}
function firstName(ctx){
  const explicit=String(ctx?.contract_party?.recipient_first_name||ctx?.recipient_first_name||"").trim();if(explicit)return explicit;
  const party=ctx?.contract_party;
  if(party?.recipient==="holder")return String(party.holder_first_name||"").trim()||String(party.recipient_name||ctx?.name||"").trim().split(/\s+/)[0]||"cliente";
  // A separate manager must never inherit the customer's first name.
  if(ctx?.recipient_contact_id&&ctx.recipient_contact_id!==ctx.contact_id)return String(ctx?.name||"").trim().split(/\s+/)[0]||"cliente";
  return String(ctx?.contact_data?.NOMBRE||"").trim()||String(ctx?.name||"").trim().split(/\s+/)[0]||"cliente";
}
function vars(text,ctx){return String(text||"")
  .replaceAll("{{contacto.nombre}}",String(ctx?.name||""))
  .replaceAll("{{contacto.telefono}}",String(ctx?.phone||""))
  .replace(/\{\{contacto\.([^}]+)\}\}/gi,(_m,k)=>contactVar(ctx,k))
  .replace(/\{contacto\.([^}]+)\}/gi,(_m,k)=>contactVar(ctx,k))
  .replaceAll("{nombre}",String(ctx?.name||""))
  .replaceAll("{nombre_seguimiento}",firstName(ctx))
  .replaceAll("{dni}",String(ctx?.dni||""))
  .replaceAll("{telefono}",String(ctx?.phone||""))
  .replaceAll("{oferta_mensaje}",String(ctx?.oferta_mensaje||""))
  .replaceAll("{operador}",String(ctx?.operator||""))
  .replaceAll("{precio_total}",String(ctx?.precio_total||""))
  .replaceAll("{mensaje}",String(ctx?.message||""));}
function contractMessage(text,party){
 const body=String(text||'');if(!body.trim()||!party)return body;
 const holder=String(party.holder_name||'').replace(/\s+/g,' ').trim();
 const different=party.holder_record_id&&party.recipient_contact_id?party.holder_record_id!==party.recipient_contact_id:party.same===false&&party.recipient==='contact';
 if(!different||!holder)return body;
 const reference='Sobre el contrato de '+holder+'.';
 if(body.includes(reference))return body;
 const firstBreak=body.indexOf('\n');
 return /^Hola\b/i.test(body)&&firstBreak>=0?body.slice(0,firstBreak)+'\n'+reference+body.slice(firstBreak):reference+'\n\n'+body;
}

function messageOf(source,row){if(source==='program')return String(row.whatsapp_message||'');const config=row.action_config||{},tpl=templateOf(config);let text=String(config.text||tpl?.body||'');if(['reminder_2','reminder_5'].includes(config.offer_phase))text=text.replaceAll('{nombre}','{nombre_seguimiento}');return contractMessage(vars(text,row.context||{}),row.context?.contract_party)}
function reasonOf(source,row,auto){
 if(source==='program')return row.description||row.title||'WhatsApp programado';
 const trigger={opportunity_stage:'Cambio de columna',label_assigned:'Etiqueta asignada',message_received:'WhatsApp recibido',message_contains:'Palabra recibida',unanswered:'Sin respuesta'}[auto?.trigger_type]||'Automatización';
 return `${auto?.name||'Automatización'} · ${trigger}`;
}
function makeRows(){
 const autos=new Map(state.automations.map(auto=>[String(auto.id),auto]));
 const jobs=state.jobs.filter(job=>SEND_ACTIONS.has(job.action_type)).map(job=>{const auto=autos.get(String(job.automation_id))||{},context=job.context||{};return{source:'automation',id:String(job.id),automationId:String(job.automation_id||''),eventKey:String(job.event_key||''),actionType:job.action_type,contactId:context.contact_id||'',contact:contactOf(context),phone:phoneOf(context),operator:operatorOf(auto,context),message:messageOf('automation',job),reason:reasonOf('automation',job,auto),messageKey:job.action_config?.__delivery_receipt?.idMessage||'',when:job.action_config?.__delivery_receipt?.acceptedAt||(job.status==='done'?job.completed_at:null)||job.run_at||job.created_at,status:statusOf('automation',job),error:job.error_message||'',attempts:Number(job.attempts||0),updatedAt:job.updated_at||'',raw:job,auto}});
 const programs=state.programs.map(row=>({source:'program',id:String(row.id),automationId:'',eventKey:'',actionType:'scheduled_whatsapp',contactId:row.related_record_id||'',contact:contactOf({},row),phone:phoneOf({},row),operator:operatorOf({name:[row.title,row.description].filter(Boolean).join(' ')},{}),message:messageOf('program',row),reason:reasonOf('program',row),messageKey:row.whatsapp_provider_message_id||'',when:row.whatsapp_sent_at||row.whatsapp_scheduled_at||row.starts_at||row.created_at,status:statusOf('program',row),error:row.whatsapp_delivery_error||'',attempts:Number(row.whatsapp_attempt_count||0),updatedAt:row.updated_at||'',raw:row,auto:null}));
 const history=state.history.map(r=>{const job=r.source==='automation'?state.jobs.find(j=>String(j.id)===String(r.id)):null,auto=job?autos.get(String(job.automation_id))||{}:null;return {source:r.source,id:r.id,messageKey:r.message_key,contact:r.contact||r.phone||'Contacto',phone:r.phone,operator:r.operator||'General',message:r.message,reason:job?reasonOf('automation',job,auto):r.reason,when:r.sent_at,status:'sent',contactId:r.contact_id,error:'',raw:job||{},auto};});
 const seen=new Set(),rows=[...history,...jobs,...programs].filter(row=>{if(!row.messageKey)return true;if(seen.has(row.messageKey))return false;seen.add(row.messageKey);return true});
 rows.sort((a,b)=>stamp(b.when)-stamp(a.when));
 const active=rows.filter(row=>['pending','paused','sending'].includes(row.status)),buckets=new Map();
 for(const row of active){const body=norm(row.message).replace(/\s+/g,' ').slice(0,240),phone=digits(row.phone),key=`${phone}|${body||row.automationId+'|'+row.actionType}`;if(!phone)continue;const list=buckets.get(key)||[];list.push(row);buckets.set(key,list)}
 for(const list of buckets.values())for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)if(Math.abs(stamp(list[i].when)-stamp(list[j].when))<=6*3600000){list[i].duplicate=true;list[j].duplicate=true}
 state.rows=rows;return rows;
}
function badge(status){const labels={pending:'Programado',paused:'Pausado',sending:'Enviando',sent:'Enviado',failed:'Fallido',uncertain:'Revisar antes de reenviar',cancelled:'Cancelado'};return`<span class="ccBadge ${esc(status)}">${esc(labels[status]||status)}</span>`}
function sourceLabel(row){return row.source==='automation'?'Automático':row.source==='program'?'Programado manualmente':'WhatsApp enviado'}
function reasonCategory(row){
 const phase=norm(row.raw?.action_config?.offer_phase),mode=norm(row.raw?.context?.lifecycle?.mode),name=norm(row.auto?.name||row.reason);
 if(phase==='initial'||phase==='initial_offer')return 'offer';
 if(phase==='router_return'||/devolucion|router_return/.test(name))return 'return';
 if(/reminder_|recordatorio|seguimiento general/.test(phase+' '+name))return 'reminder';
 if(/11 meses|11m|revision anual/.test(name))return 'review';
 if(/3 meses|3m/.test(name))return 'followup';
 if(/installation|instalacion|tramitacion/.test(mode+' '+name)||mode==='after_sale'&&phase==='')return 'installation';
 if(mode==='offer'||phase==='initial'||/oferta/.test(name))return 'offer';
 return row.source==='program'?'manual':'other';
}
function madridDay(value){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));const get=k=>parts.find(p=>p.type===k)?.value;return get('year')+'-'+get('month')+'-'+get('day');}
function shiftDay(key,days){const d=new Date(key+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function dateMatches(row,period,from,to,now=Date.now()){
 if(!period)return true;if(!row.when||!Number.isFinite(new Date(row.when).getTime()))return false;const day=madridDay(row.when),today=madridDay(now);
 if(period==='today')return day===today;
 if(period==='tomorrow')return day===shiftDay(today,1);
 if(period==='week'){const weekday=new Date(today+'T12:00:00Z').getUTCDay(),start=shiftDay(today,-((weekday+6)%7));return day>=start&&day<=shiftDay(start,6);}
 if(period==='range')return (!from||day>=from)&&(!to||day<=to)&&(!from||!to||from<=to);
 return true;
}
function madridBoundary(key){
 const value=new Date(key+'T00:00:00Z'),zone=new Intl.DateTimeFormat('en',{timeZone:'Europe/Madrid',timeZoneName:'shortOffset'}).formatToParts(value).find(p=>p.type==='timeZoneName')?.value||'GMT';
 const match=zone.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/),offset=match?(match[1]==='-'?-1:1)*(Number(match[2])*60+Number(match[3]||0)):0;
 return new Date(value.getTime()-offset*60000).toISOString();
}
function historyArgs(now=Date.now()){
 const period=$('ccDate')?.value||'',today=madridDay(now);let from=null,to=null;
 if(period==='today'){from=today;to=shiftDay(today,1);}
 if(period==='tomorrow'){from=shiftDay(today,1);to=shiftDay(today,2);}
 if(period==='week'){const weekday=new Date(today+'T12:00:00Z').getUTCDay();from=shiftDay(today,-((weekday+6)%7));to=shiftDay(from,7);}
 if(period==='range'){from=$('ccFrom')?.value||null;to=$('ccTo')?.value?shiftDay($('ccTo').value,1):null;}
 return {p_from:from?madridBoundary(from):null,p_to:to?madridBoundary(to):null};
}
function historyScope(){return JSON.stringify(historyArgs());}
async function refreshHistory(){
 const revision=state.historyRevision=(state.historyRevision||0)+1,scope=historyScope();
 try{const {data,error}=await sb.rpc('crm_whatsapp_sent_history_filtered',{...historyArgs(),p_offset:0,p_limit:200});if(error)throw error;if(revision!==state.historyRevision||!$('ccPanel'))return;state.history=data?.rows||[];state.historyTotal=data?.total||0;state.historyScope=scope;state.page=1;makeRows();render();}
 catch(error){if(revision===state.historyRevision)alert(error.message||'No se pudo filtrar el historial');}
}
function needsReview(row,filter,now=Date.now()){
 const failed=['failed','uncertain'].includes(row.status),duplicate=!!row.duplicate,overdue=row.status==='pending'&&stamp(row.when)<now;
 return !filter||filter==='needs'&&(failed||duplicate||overdue)||filter==='failed'&&failed||filter==='duplicates'&&duplicate||filter==='overdue'&&overdue;
}
function filtered(){
 const search=norm($('ccSearch')?.value),status=$('ccStatus')?.value||'',operator=$('ccOperator')?.value||'',source=$('ccSource')?.value||'',period=$('ccDate')?.value||'',from=$('ccFrom')?.value||'',to=$('ccTo')?.value||'',reason=$('ccReason')?.value||'',review=$('ccReview')?.value||'';
 return state.rows.filter(row=>dateMatches(row,period,from,to)&&(!reason||reasonCategory(row)===reason)&&needsReview(row,review)&&(!status||row.status===status)&&(!operator||row.operator===operator)&&(!source||row.source===source)&&(!search||norm(`${row.contact} ${row.phone} ${row.reason} ${row.message} ${row.error}`).includes(search))).sort((a,b)=>status==='pending'||status==='paused'?stamp(a.when)-stamp(b.when):stamp(b.when)-stamp(a.when));
}
function fillOperators(){const select=$('ccOperator');if(!select)return;const value=select.value,ops=[...new Set(state.rows.map(x=>x.operator).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));select.innerHTML='<option value="">Todos los operadores</option>'+ops.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(ops.includes(value))select.value=value}
function render(){
 if(!$('ccPanel'))return;fillOperators();syncFilterUi();document.querySelectorAll('[data-cc-tab]').forEach(button=>{const key=button.dataset.ccTab;button.setAttribute('aria-pressed',String(key==='review'?$('ccReview')?.value==='needs':key==='all'?!$('ccStatus')?.value&&!$('ccReview')?.value:$('ccStatus')?.value===key&&!$('ccReview')?.value));});paintMonitor();const rows=filtered();
 const counts={pending:Number(state.monitor?.pending_today||0)+Number(state.monitor?.manual_pending_today||0),sent:Number(state.monitor?.sent_today||0),failed:Number(state.monitor?.failed_24h||0),duplicates:Number(state.monitor?.duplicate_pending||0)};
 [['ccKpiPending',counts.pending],['ccKpiSent',counts.sent],['ccKpiFailed',counts.failed],['ccKpiDuplicate',counts.duplicates]].forEach(([id,value])=>{if($(id))$(id).textContent=state.monitor?String(value):'—'});
 const body=$('ccRows');if(!body)return;
 if(!rows.length){$('ccPageInfo').textContent='0 resultados';$('ccPrev').disabled=true;$('ccNext').disabled=true;$('ccOlder').hidden=state.history.length>=state.historyTotal||!['','sent'].includes($('ccStatus')?.value||'');body.innerHTML='<div class="ccEmpty"><b>Sin envíos</b><span>No hay registros que coincidan con los filtros.</span></div>';return}
 state.page=Math.min(state.page,Math.max(1,Math.ceil(rows.length/30)));
 $('ccPageInfo').textContent=rows.length+(rows.length===1?' resultado':' resultados')+' · Página '+state.page+' de '+Math.max(1,Math.ceil(rows.length/30));
 $('ccPrev').disabled=state.page<=1;$('ccNext').disabled=state.page*30>=rows.length;
 $('ccOlder').hidden=state.history.length>=state.historyTotal||!['','sent'].includes($('ccStatus')?.value||'');
 body.innerHTML=rows.slice((state.page-1)*30,state.page*30).map(row=>`<article class="ccRow ${row.duplicate?'duplicate':''}">
  <div class="ccWho"><button type="button" data-cc-detail="${esc(row.source)}:${esc(row.id)}"><b>${esc(row.contact)}</b></button><span>${esc(row.phone||'Sin teléfono')} · ${esc(row.operator)}</span></div>
  <div><b>${esc(sourceLabel(row))}</b><span>${esc(row.reason)}</span></div>
  <div><b>${fmt(row.when)}</b><span>${row.duplicate?'⚠ Posible duplicado':esc(row.message?row.message.slice(0,90):'Contenido mediante plantilla')}</span></div>
  <div>${badge(row.status)}${row.error?`<span class="ccError">${esc(row.error.slice(0,110))}</span>`:''}</div>
  <div class="ccActions">${actions(row)}</div>
 </article>`).join('');
}
function actions(row,includeView=true){
 const out=includeView?[`<button type="button" class="secondary" data-cc-detail="${esc(row.source)}:${esc(row.id)}">Ver</button>`]:[];
 if(['pending','paused'].includes(row.status)&&row.source==='program')out.push('<button type="button" class="secondary" data-cc-action="edit" data-cc-row="'+esc(row.source)+':'+esc(row.id)+'">Editar</button>');
 if(['pending','paused'].includes(row.status)&&row.source==='automation')out.push('<button type="button" class="secondary" data-cc-action="origin" data-cc-row="'+esc(row.source)+':'+esc(row.id)+'">Gestionar origen</button>');
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
function localDateTime(value){const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
async function updateProgram(row,action,text=null,when=null){
 const {data,error}=await sb.rpc('crm_control_scheduled_whatsapp',{p_id:row.id,p_expected_at:row.updatedAt,p_action:action,p_text:text,p_when:when});
 if(error)throw error;if(data==='cancelled'&&action!=='cancel')throw new Error('No se ha activado el envío: este cliente ha pedido no recibir mensajes.');
 return data;
}
function editProgram(row){
 $('ccDetail')?.close();$('ccEdit')?.remove();const d=document.createElement('dialog');d.id='ccEdit';d.className='ccDetail';
 d.innerHTML='<form><div class="ccDetailHead"><div><span>Programado manualmente · '+esc(row.status==='paused'?'Se mantendrá pausado':'Pendiente')+'</span><h3>Editar envío</h3></div><button type="button" data-close aria-label="Cerrar">×</button></div><div class="ccDetailGrid"><div class="wide"><b>'+esc(row.contact)+' · '+esc(row.phone)+'</b></div><label class="wide">Mensaje<textarea name="message" rows="7" required>'+esc(row.message)+'</textarea></label><label class="wide">Fecha y hora<input name="when" type="datetime-local" required value="'+esc(localDateTime(row.when))+'"></label><p class="wide" data-error role="alert"></p></div><div class="ccDetailActions"><button type="button" data-close>Volver</button><button type="submit">Guardar cambios</button></div></form>';
 document.body.appendChild(d);d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());d.onclose=()=>d.remove();
 d.querySelector('form').onsubmit=async e=>{e.preventDefault();const button=d.querySelector('[type=submit]');button.disabled=true;try{const text=d.querySelector('[name=message]').value,when=new Date(d.querySelector('[name=when]').value);if(!text.trim()||!Number.isFinite(when.getTime())||when<=new Date())throw Error('Indica un mensaje y una fecha futura.');await updateProgram(row,'edit',text,when.toISOString());d.close();await load(true);window.dispatchEvent(new CustomEvent('tpf:sales-updated'));}catch(error){d.querySelector('[data-error]').textContent=error.message||'No se pudo guardar';}finally{button.disabled=false;}};
 d.showModal();
}
async function openOrigin(row){
 const context=row.raw?.context||{},phase=row.raw?.action_config?.offer_phase||'',opId=context.opportunity_id;
 close();
 if(opId&&(/^installation/.test(context.lifecycle?.mode||'')||row.raw?.action_config?.installation_phase||phase==='router_return')&&window.TPFInstallations?.manage)return window.TPFInstallations.manage(opId);
 if(context.offer_instance_id&&window.TPFOfferFollowup?.manage){await window.TPFOfferFollowup.load();return window.TPFOfferFollowup.manage(context.offer_instance_id);}
 if(window.TPFInstallationSettings?.openOperator){window.TPFInstallationSettings.openOperator(row.operator);document.querySelector('.nav[data-view="settings"]')?.click();return;}
 throw Error('No se pudo abrir el origen de este envío.');
}
async function act(action,row){
 if(!row||state.loading)return;
 if(action==='edit')return editProgram(row);
 if(action==='origin'){try{return await openOrigin(row)}catch(error){alert(error.message);return}}
 if(action==='resume'&&!confirm('¿Reanudar este envío? Si su fecha ya pasó, quedará pendiente para enviarse a partir de un minuto.'))return;
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
   await updateProgram(row,action);
  }
  await load(true);window.TPFWhatsappSendMonitor?.refresh(true);window.dispatchEvent(new CustomEvent('tpf:sales-updated'));
 }catch(error){alert(error?.message||'No se pudo actualizar el envío.')}
}
async function readAll(factory){
 const rows=[];for(let offset=0;;offset+=1000){const r=await factory().range(offset,offset+999);if(r.error)return r;rows.push(...(r.data||[]));if((r.data||[]).length<1000)return {data:rows};}
}
async function load(force=false){
 if(state.loading||(!$('ccPanel')&&!force)||(!force&&Date.now()-state.lastLoaded<15000))return;state.loading=true;const requestedScope=historyScope();const note=$('ccUpdated');if(note)note.textContent='Actualizando…';
 try{
  const [automations,jobs,programs,templates,history,monitor]=await Promise.all([
   sb.rpc('crm_list_automations'),
   readAll(()=>sb.from('crm_server_automation_jobs').select('id,automation_id,event_key,action_type,action_config,context,run_at,status,attempts,error_message,created_at,updated_at,completed_at').in('action_type',[...SEND_ACTIONS]).order('id',{ascending:true})),
   readAll(()=>sb.from('agenda_items').select('id,title,description,customer_name,customer_phone,starts_at,status,related_record_id,whatsapp_phone,whatsapp_message,whatsapp_scheduled_at,whatsapp_delivery_status,whatsapp_delivery_error,whatsapp_sent_at,whatsapp_provider_message_id,whatsapp_attempt_count,created_at,updated_at').eq('whatsapp_enabled',true).order('id',{ascending:true})),
   sb.from('wa_templates').select('id,name,body,category').order('name').limit(500),
   sb.rpc('crm_whatsapp_sent_history_filtered',{...historyArgs(),p_offset:0,p_limit:200}),sb.rpc('crm_whatsapp_send_monitor')
  ]);
  for(const result of [automations,jobs,programs,history])if(result.error)throw result.error;
  state.historyScope=requestedScope;state.history=history.data?.rows||[];state.historyTotal=history.data?.total||0;state.monitor=monitor.error?null:monitor.data;
  state.automations=automations.data||[];state.jobs=jobs.data||[];state.programs=programs.data||[];state.templates=templates.error?[]:templates.data||[];state.lastLoaded=Date.now();makeRows();render();if(note)note.textContent=`Actualizado ${new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`;
 }catch(error){if(note)note.textContent='No se pudo actualizar';const body=$('ccRows');if(body)body.innerHTML=`<div class="ccEmpty"><b>No se pudo cargar el control de envíos</b><span>${esc(error?.message||'Inténtalo de nuevo.')}</span></div>`}
 finally{state.loading=false;if($('ccPanel')&&state.historyScope!==historyScope())refreshHistory();}
}
async function loadOlder(){
 const button=$('ccOlder');if(!button||state.loading)return;button.disabled=true;
 try{const {data,error}=await sb.rpc('crm_whatsapp_sent_history_filtered',{...historyArgs(),p_offset:state.history.length,p_limit:200});if(error)throw error;state.history.push(...(data?.rows||[]));state.historyTotal=data?.total||0;makeRows();render();}catch(error){alert(error.message||'No se pudo cargar el historial');}finally{button.disabled=false;}
}
function css(){if($('ccStyles'))return;const style=document.createElement('style');style.id='ccStyles';style.textContent=`
.ccPanel [hidden]{display:none!important}.ccMoreFilters{border:1px solid #dfe5ed;border-radius:10px;margin-bottom:8px}.ccMoreFilters summary{padding:10px 12px;font-weight:750;cursor:pointer}.ccExtraFilters{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:12px;padding:0 12px 12px}.ccExtraFilters label{font-size:11px;font-weight:750;color:#475467}.ccExtraFilters select,.ccExtraFilters input{width:100%;box-sizing:border-box;margin:6px 0 0;min-height:40px}.ccRange{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:12px}.ccFilterTools{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:4px 0 12px;font-size:11px;color:#667085}.ccFilterTools button{white-space:nowrap}.ccMonitorNote{color:#667085;font-size:11px;line-height:1.5}.ccMonitorNote:empty{display:none}.ccPagination{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding-top:16px}.ccDetail textarea,.ccDetail input{box-sizing:border-box;width:100%;margin-top:8px}.ccDetail [data-error]{color:#b42318}.ccLaunch{white-space:nowrap}.ccPanel{position:relative;height:calc(100dvh - 64px);overflow:auto;overflow-anchor:none;background:#f5f7fb;overscroll-behavior:contain;color:#172033}.ccShell{width:min(1420px,calc(100% - 28px));margin:0 auto 32px;padding-top:0}.ccHead{position:sticky;top:0;z-index:4;display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin:0 -8px 13px;padding:14px 8px 12px;background:#f5f7fb;border-bottom:1px solid #dfe5ed;box-shadow:0 7px 14px rgba(23,32,51,.05)}.ccHead h2{margin:0;font-size:21px}.ccTitleRow{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.ccHeadActions{flex-wrap:wrap;justify-content:flex-end}.ccTabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.ccTabs button{border:1px solid #dfe5ed;border-radius:8px;background:#f5f7fb;color:#475467;padding:8px 12px;font-weight:700;cursor:pointer}.ccTabs button[aria-pressed=true]{background:#eaf2ff;color:#175cd3;border-color:#91b6ef}.ccHead p{margin:0;color:#667085}.ccHeadActions{display:flex;gap:8px}.ccKpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:12px}.ccKpi{background:#fff;border:1px solid #dfe5ed;border-radius:13px;padding:13px}.ccKpi span{display:block;color:#667085;font-size:11px}.ccKpi b{display:block;margin-top:4px;font-size:22px}.ccKpi.warn b{color:#b54708}.ccKpi.bad b{color:#b42318}.ccCard{background:#fff;border:1px solid #dfe5ed;border-radius:14px;padding:14px}.ccFilters{display:grid;grid-template-columns:minmax(240px,1fr) repeat(3,minmax(100px,150px));gap:8px;margin-bottom:12px}.ccFilters input,.ccFilters select{margin:0;min-height:42px}.ccTableHead,.ccRow{display:grid;grid-template-columns:minmax(140px,1.1fr) minmax(155px,1.3fr) minmax(145px,1.1fr) minmax(105px,.8fr) minmax(165px,auto);gap:10px;align-items:center}.ccTableHead{padding:8px 10px;color:#667085;font-size:10px;font-weight:800;text-transform:uppercase}.ccRow{padding:11px 10px;border-top:1px solid #edf1f5}.ccRow.duplicate{background:#fffaf0}.ccRow>div{min-width:0}.ccRow b,.ccRow span{display:block}.ccRow span{margin-top:3px;color:#667085;font-size:10px;overflow:hidden;text-overflow:ellipsis}.ccWho button{border:0;background:transparent;padding:0;color:#145bc2;text-align:left;cursor:pointer}.ccActions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}.ccActions button{border:1px solid #cfd8e5;background:#fff;border-radius:8px;padding:7px 9px;color:#344054;font-weight:750;font-size:10px;cursor:pointer}.ccActions button:not(.secondary):not(.danger){background:#175cd3;color:#fff;border-color:#175cd3}.ccActions .danger{color:#b42318;border-color:#efc7c7}.ccBadge{display:inline-flex!important;width:max-content;padding:5px 8px;border-radius:999px;font-size:9px!important;font-weight:850}.ccBadge.pending{background:#fff4d6;color:#8a6100}.ccBadge.paused,.ccBadge.cancelled{background:#f2f4f7;color:#667085}.ccBadge.sending{background:#eaf2ff;color:#175cd3}.ccBadge.sent{background:#e9f8ef;color:#23733c}.ccBadge.failed,.ccBadge.uncertain{background:#fff0f0;color:#b42318}.ccError{color:#b42318!important}.ccEmpty{display:grid;gap:5px;text-align:center;padding:42px;color:#667085}.ccDetail{width:min(720px,calc(100% - 24px));border:0;border-radius:16px;padding:0;box-shadow:0 24px 80px #102a4c55}.ccDetail::backdrop{background:#102033aa}.ccDetailHead{display:flex;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #e5eaf0}.ccDetailHead h3{margin:4px 0 0}.ccDetailHead button{border:0;background:#eef2f6;border-radius:50%;width:34px;height:34px;font-size:22px}.ccDetailGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:18px 20px}.ccDetailGrid>div{padding:10px;border:1px solid #e6ebf1;border-radius:10px}.ccDetailGrid span{display:block;color:#667085;font-size:10px;margin-bottom:5px}.ccDetailGrid .wide{grid-column:1/-1}.ccDetailGrid pre{white-space:pre-wrap;word-break:break-word;margin:0;font:inherit}.ccDetailGrid .warning{background:#fff8e7;border-color:#efd591}.ccDetailGrid .error{background:#fff2f2;border-color:#efc7c7}.ccDetailActions{display:flex;justify-content:flex-end;gap:7px;padding:0 20px 18px}.ccDetailActions button{padding:9px 11px;border-radius:8px;border:1px solid #ccd5e1;background:#fff;font-weight:750}.ccDetailActions button:not(.secondary):not(.danger){background:#175cd3;color:#fff}.ccDetailActions .danger{color:#b42318}.ccUpdated{font-size:10px;color:#667085;align-self:center}
@media(max-width:900px){.ccExtraFilters{grid-template-columns:1fr 1fr}.ccHeadActions{flex-wrap:wrap}.ccKpis{grid-template-columns:1fr 1fr}.ccFilters{grid-template-columns:1fr 1fr}.ccTableHead{display:none}.ccRow{grid-template-columns:1fr 1fr}.ccActions{grid-column:1/-1;justify-content:flex-start}}
@media(max-width:560px){.ccExtraFilters,.ccRange{grid-template-columns:1fr}.ccFilterTools{align-items:flex-start;flex-direction:column}.ccShell{width:calc(100% - 16px);margin:0 auto 20px}.ccHead{flex-direction:column}.ccHeadActions{width:100%}.ccHeadActions button{flex:1}.ccKpis,.ccFilters,.ccRow,.ccDetailGrid{grid-template-columns:1fr}.ccDetailGrid .wide,.ccActions{grid-column:auto}.ccCard{padding:10px}}
`;document.head.appendChild(style)}
function syncFilterUi(){
 const period=$('ccDate')?.value||'';
 if($('ccRange'))$('ccRange').hidden=period!=='range';
 const labels=[];
 for(const id of ['ccStatus','ccOperator','ccSource','ccDate','ccReason','ccReview']){const el=$(id);if(el?.value){const label=el.options?.[el.selectedIndex]?.textContent||el.value;labels.push(label);}}
 if($('ccSearch')?.value.trim())labels.push('Búsqueda: '+$('ccSearch').value.trim());
 if(period==='range'&&($('ccFrom')?.value||$('ccTo')?.value))labels.push(($('ccFrom').value||'Sin inicio')+' → '+($('ccTo').value||'Sin fin'));
 if($('ccFilterSummary'))$('ccFilterSummary').textContent=labels.join(' · ')||'Todos los envíos';
 const count=['ccDate','ccReason','ccReview'].filter(id=>$(id)?.value).length;
 if($('ccFilterCount'))$('ccFilterCount').textContent=count?' · '+count+' activos':'';
 if(period==='range'&&$('ccFrom').value&&$('ccTo').value&&$('ccFrom').value>$('ccTo').value)$('ccFilterSummary').textContent='Revisa el intervalo: la fecha inicial debe ser anterior a la final.';
}
function clearFilters(){for(const id of ['ccSearch','ccStatus','ccOperator','ccSource','ccDate','ccReason','ccReview','ccFrom','ccTo']){if($(id))$(id).value='';}state.page=1;render();refreshHistory();}
function paintMonitor(){
 const d=state.monitor,button=$('ccPauseEngine');if(!button)return;
 button.disabled=!d;button.hidden=!d;button.textContent=d?.enabled===false?'Reanudar automatizaciones':'Pausar automatizaciones';
 if($('ccKpiUnanswered'))$('ccKpiUnanswered').textContent=d?String(d.unanswered_reminders||0):'—';
 const notes=[];if(d?.enabled===false)notes.push('Motor de automatizaciones pausado.');if(d?.failed_24h>0)notes.push('Hay envíos fallidos en las últimas 24 horas.');if(d?.duplicate_pending>0)notes.push('Revisa los posibles duplicados pendientes.');if(d?.daily_average>=5&&d.sent_today>2*d.daily_average)notes.push('Hoy se supera el doble de la media diaria de los 7 días anteriores ('+d.daily_average+').');
 if($('ccMonitorNote'))$('ccMonitorNote').textContent=notes.join(' ');
}
async function pauseEngine(){
 if(state.loading||!state.monitor)return;const paused=state.monitor.enabled===true;
 if(!confirm(paused?'¿Pausar el motor de automatizaciones? Los envíos manuales seguirán disponibles y los mensajes ya en envío pueden completarse.':'¿Reanudar el motor de automatizaciones? Se procesarán los pendientes, incluidos los vencidos.'))return;
 const button=$('ccPauseEngine');button.disabled=true;
 try{const {error}=await sb.rpc('crm_whatsapp_pause_engine',{p_paused:paused});if(error)throw error;await load(true);await window.TPFWhatsappSendMonitor?.refresh(true);}catch(error){alert(error.message||'No se pudo cambiar el motor');}finally{if(button.isConnected)button.disabled=false;}
}
function panel(){
 const nav=document.querySelector('.nav[data-view="sendcontrol"]');if(nav&&!nav.classList.contains('active')){state.returnView=document.querySelector('.nav.active')?.dataset.view||'dashboard';nav.click();return} const existing=$('ccPanel');if(existing){$('view-sendcontrol')?.classList.remove('hidden');const scroll=state.savedScroll??existing.scrollTop;existing.scrollTop=scroll;requestAnimationFrame(()=>{existing.scrollTop=scroll});load();return} $('ccDetail')?.remove();const root=document.createElement('section');root.id='ccPanel';root.className='ccPanel';root.innerHTML=`<div class="ccShell"><header class="ccHead"><div class="ccTitleRow"><button type="button" class="secondary" id="ccClose">← Volver</button><h2>Control de envíos</h2></div><div class="ccHeadActions"><span id="ccUpdated" class="ccUpdated"></span><button type="button" class="secondary" id="ccReload">↻ Actualizar</button><button type="button" class="secondary" id="ccPauseEngine" disabled>Pausar automatizaciones</button></div></header><div class="ccKpis"><div class="ccKpi"><span>Pendientes hoy</span><b id="ccKpiPending">0</b></div><div class="ccKpi"><span>Enviados hoy</span><b id="ccKpiSent">0</b></div><div class="ccKpi bad"><span>Fallos en 24 horas</span><b id="ccKpiFailed">0</b></div><div class="ccKpi warn"><span>Posibles duplicados pendientes</span><b id="ccKpiDuplicate">0</b></div><div class="ccKpi"><span>Recordatorios sin respuesta</span><b id="ccKpiUnanswered">—</b></div></div><p id="ccMonitorNote" class="ccMonitorNote"></p><div class="ccCard"><div class="ccTabs" role="group" aria-label="Estado de los envíos"><button data-cc-tab="pending">Pendientes</button><button data-cc-tab="paused">Pausados</button><button data-cc-tab="sent">Enviados</button><button data-cc-tab="review">Por revisar</button><button data-cc-tab="all">Todos</button></div><div class="ccFilters"><input id="ccSearch" type="search" placeholder="Buscar contacto, teléfono, mensaje o automatización"><select id="ccStatus"><option value="">Todos los estados</option><option value="pending" selected>Pendientes</option><option value="paused">Pausados</option><option value="sending">Enviando</option><option value="sent">Enviados</option><option value="failed">Fallidos</option><option value="uncertain">Por revisar</option><option value="cancelled">Cancelados</option></select><select id="ccOperator"><option value="">Todos los operadores</option></select><select id="ccSource"><option value="">Todos los tipos</option><option value="automation">Automáticos</option><option value="program">Programados manualmente</option><option value="history">Otros WhatsApp enviados</option></select></div><details class="ccMoreFilters" id="ccMoreFilters"><summary>Más filtros<span id="ccFilterCount"></span></summary><div class="ccExtraFilters"><label>Fecha<select id="ccDate"><option value="">Cualquier fecha</option><option value="today">Hoy</option><option value="tomorrow">Mañana</option><option value="week">Esta semana</option><option value="range">Elegir intervalo</option></select></label><label>Motivo<select id="ccReason"><option value="">Todos los motivos</option><option value="offer">Oferta</option><option value="reminder">Recordatorio de oferta</option><option value="installation">Instalación</option><option value="return">Devolución del router</option><option value="followup">Seguimiento de 3 meses</option><option value="review">Revisión de 11 meses</option><option value="manual">Programado manualmente</option><option value="other">Otros</option></select></label><label>Necesitan revisión<select id="ccReview"><option value="">Todos</option><option value="needs">Solo necesitan revisión</option><option value="failed">Fallidos o inciertos</option><option value="duplicates">Posibles duplicados</option><option value="overdue">Pendientes vencidos</option></select></label><div id="ccRange" class="ccRange" hidden><label>Desde<input id="ccFrom" type="date"></label><label>Hasta<input id="ccTo" type="date"></label></div></div></details><div class="ccFilterTools"><span id="ccFilterSummary"></span><button class="secondary" id="ccClear">Limpiar filtros</button></div><div class="ccTableHead"><span>Contacto</span><span>Origen y motivo</span><span>Fecha y contenido</span><span>Estado</span><span>Acciones</span></div><div id="ccRows"><div class="ccEmpty">Cargando…</div></div><div class="ccPagination"><button id="ccPrev">← Anterior</button><span id="ccPageInfo"></span><button id="ccNext">Siguiente →</button><button id="ccOlder" hidden>Cargar enviados anteriores</button></div></div><p class="ccMonitorNote">Cuenta mensajes registrados en el CRM. Los pendientes incluyen envíos preparados y pueden aumentar al avanzar las automatizaciones. Estos datos no indican denuncias ni garantizan que WhatsApp no restrinja la cuenta.</p></div>`;($('view-sendcontrol')||document.querySelector('.referenceWorkspace main')).appendChild(root);root.scrollTop=0;$('ccClose').onclick=close;$('ccClear').onclick=clearFilters;$('ccPauseEngine').onclick=pauseEngine;$('ccReload').onclick=()=>load(true);['ccSearch','ccStatus','ccOperator','ccSource','ccDate','ccReason','ccReview','ccFrom','ccTo'].forEach(id=>{$(id).addEventListener(id==='ccSearch'?'input':'change',()=>{if(id==='ccReview'&&$(id).value)$('ccStatus').value='';state.page=1;render();if(['ccDate','ccFrom','ccTo'].includes(id))refreshHistory();})});$('ccPrev').onclick=()=>{state.page=Math.max(1,state.page-1);render()};$('ccNext').onclick=()=>{state.page++;render()};$('ccOlder').onclick=loadOlder;root.onclick=event=>{const tab=event.target.closest('[data-cc-tab]');if(tab){const value=tab.dataset.ccTab;$('ccStatus').value=['review','all'].includes(value)?'':value;$('ccReview').value=value==='review'?'needs':'';state.page=1;render();return}const detailButton=event.target.closest('[data-cc-detail]');if(detailButton){detail(rowByKey(detailButton.dataset.ccDetail));return}const button=event.target.closest('[data-cc-action]');if(button)act(button.dataset.ccAction,rowByKey(button.dataset.ccRow))};load(true)
}
function close(){state.savedScroll=$('ccPanel')?.scrollTop||0;$('ccEdit')?.close();$('ccDetail')?.close();const view=state.returnView||'dashboard';document.querySelector('.nav[data-view="'+view+'"]')?.click()}
function launchButton(container,label='Control de envíos'){if(!container)return;let button=container.querySelector('.ccLaunch');if(!button){button=document.createElement('button');button.type='button';button.className='primary ccLaunch';button.textContent='📨 '+label;container.appendChild(button)}button.onclick=panel}
function ensureLaunchers(){
 const autoHead=$('view-automations')?.querySelector('.pageHeader');launchButton(autoHead,'Control de envíos');
 $('view-whatsapplive')?.querySelector('.ccLaunch')?.remove();
 const waHead=$('view-whatsapp')?.querySelector('.wapHeaderActions,.pageHeader');launchButton(waHead,'Control de envíos');
}
function bind(){if(state.bound)return;state.bound=true;css();document.addEventListener('click',event=>{const target=event.target.closest?.('.nav[data-view]');if(target&&target.dataset.view!=='sendcontrol'&&$('view-sendcontrol')&&!$('view-sendcontrol').classList.contains('hidden'))state.savedScroll=$('ccPanel')?.scrollTop||0;},true);const nav=document.querySelector('.nav[data-view="sendcontrol"]');if(nav){const navigate=nav.onclick;nav.onclick=()=>{navigate?.();$('view-sendcontrol')?.classList.remove('hidden');panel()};}ensureLaunchers();document.addEventListener('click',event=>{if(event.target.closest?.('.nav[data-view="automations"],.nav[data-view="whatsapp"]'))setTimeout(ensureLaunchers,180)},true);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('view-sendcontrol')&&!$('view-sendcontrol').classList.contains('hidden')&&!document.querySelector('dialog[open]'))close()});let launcherTimer=null;const observer=new MutationObserver(()=>{if(launcherTimer!==null)return;launcherTimer=setTimeout(()=>{launcherTimer=null;ensureLaunchers()},60)});for(const id of ['view-automations','view-whatsapp','view-whatsapplive']){const root=$(id);if(root)observer.observe(root,{childList:true,subtree:true})}state.timer=setInterval(()=>{if($('view-sendcontrol')&&!$('view-sendcontrol').classList.contains('hidden'))load()},60000)}
window.TPFAutomationControlCenter={statusOf,operatorOf,makeRows,open:panel,reload:()=>load(true)};
M.register('automation-control-center',{install(){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind()}});
})();

