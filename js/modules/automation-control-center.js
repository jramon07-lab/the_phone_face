(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const digits=value=>String(value??'').replace(/\D/g,'').slice(-9);
const SEND_ACTIONS=new Set(['send_template','send_whatsapp_now','__send_whatsapp','schedule_whatsapp']);
const SAFE_RETRY=new Set(['send_template','send_whatsapp_now','__send_whatsapp']);
const state={automations:[],jobs:[],programs:[],templates:[],contactNames:new Map(),rows:[],history:[],historyTotal:0,historyOffset:0,page:1,loading:false,lastLoaded:0,timer:0,bound:false};

function stamp(value){const n=new Date(value||0).getTime();return Number.isFinite(n)?n:0}
function fmt(value){if(!value)return'—';try{return new Date(value).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Madrid',hour:'2-digit',minute:'2-digit'})}catch(_){return String(value)}}
function statusOf(source,row){
 if(source==='automation'){
  if(row.action_config?.__delivery_receipt?.idMessage)return 'sent';
  const value=norm(row.status);
  return value==='done'?'sent':value==='failed'||value==='error'?'failed':value==='running'?'sending':value==='paused'?'paused':value==='cancelled'?'cancelled':'pending';
 }
 const delivery=norm(row.whatsapp_delivery_status),status=norm(row.status);
 if(status==='cancelled'||delivery==='cancelled')return'cancelled';
 if(delivery==='sent')return'sent';
 if(status==='completed')return'uncertain';
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

function followupPreview(text,ctx,phase){const welcome=ctx?.offer_welcome===true||(!Object.hasOwn(ctx||{},'offer_welcome')&&String(ctx?.oferta_mensaje||'').includes('Te envío una oferta que puede interesarte:'));let body=String(text||'');if(welcome&&['reminder_2','reminder_5'].includes(phase))body=body.replace(/\s+de\s+\{operador\}/gi,'').replaceAll('{operador}','');return body;}
function messageOf(source,row){if(source==='program')return String(row.whatsapp_message||'');const config=row.action_config||{},tpl=templateOf(config);let text=String(config.text||tpl?.body||'');if(['reminder_2','reminder_5'].includes(config.offer_phase))text=text.replaceAll('{nombre}','{nombre_seguimiento}');text=followupPreview(text,row.context||{},config.offer_phase);return contractMessage(vars(text,row.context||{}),row.context?.contract_party)}
function reasonOf(source,row,auto){
 if(source==='program')return row.description||row.title||'WhatsApp programado';
 const trigger={opportunity_stage:'Cambio de columna',label_assigned:'Etiqueta asignada',message_received:'WhatsApp recibido',message_contains:'Palabra recibida',unanswered:'Sin respuesta'}[auto?.trigger_type]||'Automatización';
 return `${auto?.name||'Automatización'} · ${trigger}`;
}
function contactName(id,fallback){return state.contactNames.get(String(id||''))||fallback;}
async function loadContactNames(){
 const ids=[...new Set([...state.jobs.map(j=>j.context?.recipient_contact_id||j.context?.contract_party?.recipient_contact_id||j.context?.contact_id),...state.programs.map(r=>r.related_record_id)].filter(Boolean).map(String))];
 const names=new Map();
 for(let i=0;i<ids.length;i+=100){const result=await sb.from('records').select('id,data').in('id',ids.slice(i,i+100));if(result.error)throw result.error;for(const record of result.data||[]){const name=contactOf({contact_data:record.data});if(name&&name!=='Contacto')names.set(String(record.id),name);}}
 state.contactNames=names;
}
function makeRows(){
 const autos=new Map(state.automations.map(auto=>[String(auto.id),auto]));
 const jobs=state.jobs.filter(job=>SEND_ACTIONS.has(job.action_type)).map(job=>{const auto=autos.get(String(job.automation_id))||{},context=job.context||{};return{source:'automation',id:String(job.id),automationId:String(job.automation_id||''),eventKey:String(job.event_key||''),actionType:job.action_type,contactId:context.recipient_contact_id||context.contract_party?.recipient_contact_id||context.contact_id||'',contact:contactName(context.recipient_contact_id||context.contract_party?.recipient_contact_id||context.contact_id,context.contract_party?.recipient_name||context.recipient_name||contactOf(context)),phone:phoneOf(context),operator:operatorOf(auto,context),message:messageOf('automation',job),reason:reasonOf('automation',job,auto),messageKey:job.action_config?.__delivery_receipt?.idMessage||'',when:job.action_config?.__delivery_receipt?.acceptedAt||(job.status==='done'?job.completed_at:null)||job.run_at||job.created_at,status:statusOf('automation',job),error:job.error_message||'',attempts:Number(job.attempts||0),updatedAt:job.updated_at||'',raw:job,auto}});
 const programs=state.programs.map(row=>({source:'program',id:String(row.id),automationId:'',eventKey:'',actionType:'scheduled_whatsapp',contactId:row.related_record_id||'',contact:contactName(row.related_record_id,contactOf({},row)),phone:phoneOf({},row),operator:operatorOf({name:[row.title,row.description].filter(Boolean).join(' ')},{}),message:messageOf('program',row),reason:reasonOf('program',row),messageKey:row.whatsapp_provider_message_id||'',when:row.whatsapp_sent_at||row.whatsapp_scheduled_at||row.starts_at||row.created_at,status:statusOf('program',row),error:row.whatsapp_delivery_error||'',attempts:Number(row.whatsapp_attempt_count||0),updatedAt:row.updated_at||'',raw:row,auto:null}));
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
 if(period==='month')return day.slice(0,7)===today.slice(0,7);
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
 if(period==='month'){from=today.slice(0,7)+'-01';const next=new Date(from+'T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);to=next.toISOString().slice(0,10);}
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
function filtered(sourceOverride){
 const search=norm($('ccSearch')?.value),status=$('ccStatus')?.value||'',operator=$('ccOperator')?.value||'',source=sourceOverride??($('ccSource')?.value||''),period=$('ccDate')?.value||'',from=$('ccFrom')?.value||'',to=$('ccTo')?.value||'',reason=$('ccReason')?.value||'',review=$('ccReview')?.value||'';
 return state.rows.filter(row=>dateMatches(row,period,from,to)&&(!reason||reasonCategory(row)===reason)&&needsReview(row,review)&&(!status||row.status===status)&&(!operator||row.operator===operator)&&(!source||row.source===source)&&(!search||norm(`${row.contact} ${row.phone} ${row.reason} ${row.message} ${row.error}`).includes(search))).sort((a,b)=>status==='pending'||status==='paused'?stamp(a.when)-stamp(b.when):stamp(b.when)-stamp(a.when));
}
function fillOperators(){const select=$('ccOperator');if(!select)return;const value=select.value,ops=[...new Set(state.rows.map(x=>x.operator).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));select.innerHTML='<option value="">Todos los operadores</option>'+ops.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(ops.includes(value))select.value=value}
function render(){
 if(!$('ccPanel'))return;fillOperators();syncFilterUi();document.querySelectorAll('[data-cc-source]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.ccSource===$('ccSource')?.value));const c=b.querySelector('[data-count]');if(c)c.textContent=String(filtered(b.dataset.ccSource).length)});document.querySelectorAll('[data-cc-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ccPeriod===$('ccDate')?.value)));document.querySelectorAll('[data-cc-tab]').forEach(button=>{const key=button.dataset.ccTab;button.setAttribute('aria-pressed',String(key==='review'?$('ccReview')?.value==='needs':key==='all'?!$('ccStatus')?.value&&!$('ccReview')?.value:$('ccStatus')?.value===key&&!$('ccReview')?.value));});paintMonitor();const rows=filtered();
 const counts={pending:Number(state.monitor?.pending_today||0)+Number(state.monitor?.manual_pending_today||0),sent:Number(state.monitor?.sent_today||0),failed:Number(state.monitor?.failed_24h||0),duplicates:Number(state.monitor?.duplicate_pending||0)};
 [['ccKpiPending',counts.pending],['ccKpiSent',counts.sent],['ccKpiFailed',counts.failed],['ccKpiDuplicate',counts.duplicates]].forEach(([id,value])=>{if($(id))$(id).textContent=state.monitor?String(value):'—'});
 const body=$('ccRows');if(!body)return;
 if(!rows.length){$('ccPageInfo').textContent='0 resultados';$('ccPrev').disabled=true;$('ccNext').disabled=true;$('ccOlder').hidden=state.history.length>=state.historyTotal||!['','sent'].includes($('ccStatus')?.value||'');body.innerHTML='<div class="ccEmpty"><b>Sin envíos</b><span>No hay registros que coincidan con los filtros.</span></div>';return}
 state.page=Math.min(state.page,Math.max(1,Math.ceil(rows.length/30)));
 $('ccPageInfo').textContent=rows.length+(rows.length===1?' resultado':' resultados')+' · Página '+state.page+' de '+Math.max(1,Math.ceil(rows.length/30));
 $('ccPrev').disabled=state.page<=1;$('ccNext').disabled=state.page*30>=rows.length;
 $('ccOlder').hidden=state.history.length>=state.historyTotal||!['','sent'].includes($('ccStatus')?.value||'');
 body.innerHTML=rows.slice((state.page-1)*30,state.page*30).map(row=>`<article class="ccRow ${row.duplicate?'duplicate':''}">
  <div class="ccWho"><button type="button" data-cc-action="contact" data-cc-row="${esc(row.source)}:${esc(row.id)}"><b>${esc(row.contact)}</b></button><span>${esc(row.phone||'Sin teléfono')} · ${esc(row.operator)}</span></div>
  <div><b>${esc(reasonLabel(row))}</b>${sequenceWarning(row)?`<span class="ccError">${esc(sequenceWarning(row))}</span>`:''}<span class="ccMessagePreview">${esc(row.message||'Contenido mediante plantilla')}</span><button type="button" class="ccReadMessage" data-cc-message="${esc(row.source)}:${esc(row.id)}">Ver mensaje</button></div>
  <div><b>${fmt(row.when)}</b>${row.duplicate?'<span class="ccError">⚠ Posible duplicado</span>':''}</div>
  <div>${badge(row.status)}${row.error?`<span class="ccError">${esc(row.error.slice(0,110))}</span>`:''}</div>
  <div class="ccActions">${actions(row)}</div>
 </article>`).join('');
}
function canSendNow(row){return row.source==='automation'&&row.status==='pending'&&SEND_ACTIONS.has(row.actionType)&&!row.raw?.completed_at&&!row.raw?.action_config?.__delivery_receipt&&!['reminder_2','reminder_5'].includes(row.raw?.action_config?.offer_phase);}
function actions(row,includeView=true,skipEdit=false){
 if(includeView)return `<button type="button" class="secondary" data-cc-detail="${esc(row.source)}:${esc(row.id)}">Gestionar</button>`+linkedButtons(row,true,true);
 const out=[linkedButtons(row,false)];
 if(row.phone)out.push(`<button type="button" class="secondary" data-cc-action="conversation" data-cc-row="${esc(row.source)}:${esc(row.id)}">Ir a conversación</button>`);
 if(!skipEdit&&['pending','paused'].includes(row.status)&&['program','automation'].includes(row.source))out.push('<button type="button" class="secondary" data-cc-action="edit" data-cc-row="'+esc(row.source)+':'+esc(row.id)+'">Editar texto</button>');
 if(['pending','paused'].includes(row.status)&&row.source==='automation')out.push('<button type="button" class="secondary" data-cc-action="origin" data-cc-row="'+esc(row.source)+':'+esc(row.id)+'">Gestionar origen</button>');
 if(canSendNow(row))out.push('<button type="button" data-cc-action="now" data-cc-row="'+esc(row.source)+':'+esc(row.id)+'">Enviar ahora</button>');
 if(row.status==='pending')out.push(`<button type="button" data-cc-action="pause" data-cc-row="${esc(row.source)}:${esc(row.id)}">Pausar</button>`,`<button type="button" class="danger" data-cc-action="cancel" data-cc-row="${esc(row.source)}:${esc(row.id)}">Cancelar</button>`);
 if(row.status==='paused')out.push(`<button type="button" data-cc-action="resume" data-cc-row="${esc(row.source)}:${esc(row.id)}">Reanudar</button>`,`<button type="button" class="danger" data-cc-action="cancel" data-cc-row="${esc(row.source)}:${esc(row.id)}">Cancelar</button>`);
 if(row.status==='failed'&&(row.source==='program'||SAFE_RETRY.has(row.actionType)))out.push(`<button type="button" data-cc-action="retry" data-cc-row="${esc(row.source)}:${esc(row.id)}">Reintentar</button>`);
 if(row.status==='uncertain')out.push(`<button type="button" data-cc-action="manual" data-cc-row="${esc(row.source)}:${esc(row.id)}">Revisar en WhatsApp</button>`);
 return out.join('');
}
function sequenceOf(row){return {initial:'Oferta inicial · mensaje 1',reminder_2:'1.º recordatorio · mensaje 2 del flujo',reminder_5:'2.º recordatorio · mensaje 3 del flujo'}[row.raw?.action_config?.offer_phase]||'';}
function relatedSends(row){const id=row.raw?.context?.offer_instance_id;if(!id)return [];return state.rows.filter(x=>x.raw?.context?.offer_instance_id===id&&sequenceOf(x)).sort((a,b)=>{const order={initial:0,reminder_2:1,reminder_5:2};return order[a.raw.action_config.offer_phase]-order[b.raw.action_config.offer_phase]||stamp(a.when)-stamp(b.when)});}
function sequenceWarning(row){const phase=row.raw?.action_config?.offer_phase;if(!['reminder_2','reminder_5'].includes(phase))return '';const earlier=relatedSends(row).filter(x=>x.id!==row.id&&(x.raw?.action_config?.offer_phase==='initial'||phase==='reminder_5'&&x.raw?.action_config?.offer_phase==='reminder_2'));return earlier.some(x=>x.status==='paused')?'Aviso: hay un recordatorio anterior pausado. Revisa el seguimiento completo antes de continuar.':earlier.some(x=>['failed','uncertain'].includes(x.status))?'Aviso: hay un mensaje anterior con una incidencia.':'';}
function linkedButtons(row,conversation=true,compact=false){const key=esc(row.source)+':'+esc(row.id);return (!compact&&row.raw?.context?.contract_party?.holder_record_id&&row.raw.context.contract_party.holder_record_id!==row.contactId?`<button type="button" class="secondary" data-cc-action="holder" data-cc-row="${key}">Ficha del titular</button>`:'')+(!compact&&row.contactId?`<button type="button" class="secondary" data-cc-action="contact" data-cc-row="${key}">Ver ficha</button>`:'')+(row.phone?(conversation?`<button type="button" class="secondary" data-cc-action="conversation" data-cc-row="${key}">${compact?'Conversación':'Ir a conversación'}</button>`:'')+`<button type="button" class="secondary" data-cc-action="message" data-cc-row="${key}">Escribir WhatsApp</button>`:'');}
function identityDetail(row){const c=row.raw?.context||{},p=c.contract_party||{};return (p.holder_name?`<div><span>Titular del contrato</span><b>${esc(p.holder_name)}</b></div>`:'')+`<div><span>Destinatario del WhatsApp</span><b>${esc(row.contact)} · ${esc(row.phone||'Sin teléfono')}</b></div>`+(row.raw?.action_config?.__flow_guard==='no_response'?'<div class="wide"><span>Condición del flujo</span><b>Seguimiento si no hay respuesta</b></div>':'');}
function sequenceDetail(row){const rows=relatedSends(row);if(!rows.length)return '';return '<details class="wide ccOfferHistory"><summary>Historial de la oferta</summary><span>Envíos anteriores y recordatorios · el número indica el paso previsto, no los mensajes recibidos</span>'+rows.map(x=>`<p><b>${esc(sequenceOf(x))}</b> · ${badge(x.status)} · ${fmt(x.when)}</p>`).join('')+'</details>'+(sequenceWarning(row)?`<div class="wide warning">${esc(sequenceWarning(row))} «Pausar» detiene todos los recordatorios de esta oferta; «Reanudar» permite elegir cuándo continuar.</div>`:'');}
function reasonLabel(row){if(sequenceOf(row))return sequenceOf(row);const labels={offer:'Oferta',reminder:'Recordatorio de oferta',installation:'Instalación',return:'Devolución del router',followup:'Seguimiento de 3 meses',review:'Revisión de 11 meses',manual:'Mensaje programado',other:'Otro aviso'};return labels[reasonCategory(row)]||'Otro aviso'}
function rowByKey(key){const [source,...parts]=String(key||'').split(':');return state.rows.find(x=>x.source===source&&x.id===parts.join(':'))}
function detail(row,viewOnly=false){
 if(!row)return;if(!viewOnly&&row.source==='program'&&['pending','paused'].includes(row.status))return editProgram(row);$('ccDetail')?.remove();const dialog=document.createElement('dialog');dialog.id='ccDetail';dialog.className='ccDetail';dialog.innerHTML=`<div class="ccDetailHead"><div><span>${esc(sourceLabel(row))}</span><h3>${esc(row.contact)}</h3></div><button type="button" data-close aria-label="Cerrar">×</button></div><div class="ccDetailGrid"><div><span>Estado</span>${badge(row.status)}</div><div><span>Fecha y hora</span><b>${fmt(row.when)}</b></div><div><span>Teléfono</span><b>${esc(row.phone||'—')}</b></div><div><span>Operador</span><b>${esc(row.operator)}</b></div>${identityDetail(row)}${sequenceDetail(row)}<div class="wide"><span>Motivo</span><b>${esc(row.reason)}</b></div><div class="wide"><span>Mensaje</span><pre>${esc(row.message||'El contenido se obtiene de la plantilla al ejecutar el envío.')}</pre></div>${row.error?`<div class="wide error"><span>Fallo registrado</span><b>${esc(row.error)}</b></div>`:''}${row.duplicate?'<div class="wide warning"><b>⚠ Hay otro envío activo con el mismo teléfono y contenido en un intervalo cercano.</b></div>':''}</div><div class="ccDetailActions">${actions(row,false)}</div>`;document.body.appendChild(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.querySelectorAll('[data-cc-action]').forEach(button=>button.onclick=async()=>{dialog.close();await act(button.dataset.ccAction,row)});dialog.showModal();
}
function localDateTime(value){const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
async function updateProgram(row,action,text=null,when=null){
 const {data,error}=await sb.rpc('crm_control_scheduled_whatsapp',{p_id:row.id,p_expected_at:row.updatedAt,p_action:action,p_text:text,p_when:when});
 if(error)throw error;if(data==='cancelled'&&action!=='cancel')throw new Error('No se ha activado el envío: este cliente ha pedido no recibir mensajes.');
 return data;
}
function editProgram(row){
 if(row.source!=='program'||!['pending','paused'].includes(row.status))return;
 $('ccDetail')?.close();$('ccEdit')?.remove();const d=document.createElement('dialog');d.id='ccEdit';d.className='ccDetail';
 const local=localDateTime(row.when).split('T');
 d.innerHTML='<form><div class="ccDetailHead"><div><span>Programado manualmente</span><h3>'+esc(row.contact)+'</h3></div><button type="button" data-close aria-label="Cerrar">×</button></div><div class="ccDetailGrid"><div class="wide"><span>'+esc(row.phone)+' · '+esc(row.operator)+'</span>'+badge(row.status)+'</div><div class="wide ccEditFields"><label>Fecha de envío<input name="date" type="date" required value="'+esc(local[0])+'"></label><label>Hora<input name="time" type="time" required value="'+esc(local[1])+'"></label></div><label class="wide">Mensaje que recibirá el cliente<textarea name="message" rows="6" required>'+esc(row.message)+'</textarea></label><p class="wide ccDetailHint">Puedes editar el texto y la fecha antes del envío. '+(row.status==='paused'?'Al guardar, se mantendrá pausado.':'Si lo pausas, conservará el contenido.')+'</p><p class="wide" data-error role="alert"></p></div><div class="ccDetailActions">'+actions(row,false,true)+'<button type="submit" class="ccSave">Guardar cambios</button></div></form>';
 document.body.appendChild(d);d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());d.onclose=()=>d.remove();
 const dirty=()=>d.querySelector('[name=message]').value!==row.message||d.querySelector('[name=date]').value!==local[0]||d.querySelector('[name=time]').value!==local[1];
 d.querySelectorAll('[data-cc-action]').forEach(b=>b.onclick=async()=>{if(dirty()&&!confirm('Tienes cambios sin guardar. ¿Descartarlos y continuar con esta acción?'))return;d.close();await act(b.dataset.ccAction,row)});
 d.querySelector('form').onsubmit=async e=>{e.preventDefault();const buttons=[...d.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{const text=d.querySelector('[name=message]').value,when=new Date(d.querySelector('[name=date]').value+'T'+d.querySelector('[name=time]').value);if(!text.trim()||!Number.isFinite(when.getTime())||when<=new Date())throw Error('Indica un mensaje y una fecha futura.');await updateProgram(row,'edit',text,when.toISOString());d.close();await load(true);window.TPFWhatsappSendMonitor?.refresh(true);window.dispatchEvent(new CustomEvent('tpf:sales-updated'));}catch(error){d.querySelector('[data-error]').textContent=error.message||'No se pudo guardar';}finally{buttons.forEach(b=>b.disabled=false);}};
 d.showModal();
}
async function openConversation(row){
 let phone=String(row.phone||'').replace(/\D/g,'');if(phone.startsWith('00'))phone=phone.slice(2);if(phone.length===9)phone='34'+phone;
 if(!/^[1-9][0-9]{7,14}$/.test(phone))throw Error('El destinatario no tiene un teléfono válido.');
 if(typeof crmCan==='function'&&!crmCan('can_use_whatsapp'))throw Error('No tienes permiso para abrir WhatsApp.');
 const nav=document.querySelector('.nav[data-view="whatsapplive"]');if(!nav||typeof window.selectWhatsAppChat!=='function')throw Error('WhatsApp no está disponible. Actualiza la página.');
 state.savedScroll=$('ccPanel')?.scrollTop||0;$('ccDetail')?.close();$('ccEdit')?.close();nav.click();
 const header=document.querySelector('#view-whatsapplive .waLiveHeaderActions');if(header){$('ccBackFromChat')?.remove();const back=document.createElement('button');back.id='ccBackFromChat';back.className='secondary';back.textContent='← Volver a Control de envíos';back.onclick=()=>{back.remove();document.querySelector('.nav[data-view="sendcontrol"]')?.click()};header.prepend(back);}
 await window.selectWhatsAppChat(phone+'@c.us');
}
function editAutomation(row){
 if(row.source!=='automation'||!['pending','paused'].includes(row.status))return;
 $('ccDetail')?.close();$('ccEdit')?.remove();const d=document.createElement('dialog');d.id='ccEdit';d.className='ccDetail';
 d.innerHTML=`<form><div class="ccDetailHead"><div><span>Automático · Solo este envío</span><h3>${esc(row.contact)}</h3></div><button type="button" data-close aria-label="Cerrar">×</button></div><div class="ccDetailGrid"><div><span>Fecha y hora</span><b>${fmt(row.when)}</b></div><div><span>Estado</span>${badge(row.status)}</div><div class="wide"><span>${esc(row.phone)} · ${esc(row.operator)}</span></div><label class="wide">Mensaje que recibirá el cliente<textarea name="message" rows="7" maxlength="10000" required>${esc(row.message)}</textarea></label><p class="wide ccDetailHint">El cambio se aplica solo a este envío. Mantiene su fecha y su estado; no cambia la plantilla ni los próximos avisos.</p><p class="wide" data-error role="alert"></p></div><div class="ccDetailActions"><button type="button" data-close>Volver</button><button type="submit" class="ccSave">Guardar cambios</button></div></form>`;
 document.body.appendChild(d);d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());d.onclose=()=>d.remove();
 d.querySelector('form').onsubmit=async e=>{e.preventDefault();const buttons=[...d.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{const text=d.querySelector('[name=message]').value;if(!text.trim())throw Error('Escribe el mensaje.');const {data,error}=await sb.rpc('crm_edit_automation_send_text',{p_job_id:row.id,p_expected_at:row.updatedAt,p_text:text});if(error)throw error;if(data==='cancelled')throw Error('Este cliente ha pedido no recibir mensajes. El envío permanece cancelado.');d.close();await load(true);window.TPFWhatsappSendMonitor?.refresh(true);}catch(error){d.querySelector('[data-error]').textContent=error.message||'No se pudo guardar';}finally{buttons.forEach(b=>b.disabled=false);}};d.showModal();
}
async function openOrigin(row){
 const context=row.raw?.context||{},phase=row.raw?.action_config?.offer_phase||'',opId=context.opportunity_id;
 state.savedScroll=$('ccPanel')?.scrollTop||0;
 if(opId&&(/^installation/.test(context.lifecycle?.mode||'')||row.raw?.action_config?.installation_phase||phase==='router_return')&&window.TPFInstallations?.manage)return window.TPFInstallations.manage(opId);
 if(context.offer_instance_id&&window.TPFOfferFollowup?.manage){await window.TPFOfferFollowup.load();return window.TPFOfferFollowup.manage(context.offer_instance_id);}
 if(window.TPFInstallationSettings?.openOperator)throw Error('Este aviso procede de una plantilla. Puedes cambiar este envío con «Editar texto»; la plantilla general se edita en Configuración.');
 throw Error('No se pudo abrir el origen de este envío.');
}
async function act(action,row){
 if(!row)return;
 if(action==='holder'||action==='contact'){try{const contactId=action==='holder'?row.raw?.context?.contract_party?.holder_record_id:row.contactId;if(!contactId)throw Error('Este envío no tiene una ficha vinculada. No se buscará por teléfono para evitar confundir personas.');if(typeof window.openContact!=='function')throw Error('La ficha no está disponible. Actualiza la página.');state.savedScroll=$('ccPanel')?.scrollTop||0;$('ccDetail')?.close();$('ccEdit')?.close();return await window.openContact(contactId);}catch(error){alert(error.message);return}}
 if(action==='message'){try{if(!window.TPFLinkedActions?.open)throw Error('El editor de WhatsApp no está disponible. Actualiza la página.');return await window.TPFLinkedActions.open('message',{phone:row.phone,name:row.contact,contactId:row.raw?.context?.recipient_contact_id||row.raw?.context?.contract_party?.recipient_contact_id||row.contactId||null});}catch(error){alert(error.message);return}}
 if(action==='conversation'){try{return await openConversation(row)}catch(error){alert(error.message);return}}
 if(action==='edit')return row.source==='automation'?editAutomation(row):editProgram(row);
 if(action==='origin'){try{return await openOrigin(row)}catch(error){alert(error.message);return}}
 if(state.loading)return;
 if(action==='resume'&&row.source==='automation'&&['reminder_2','reminder_5'].includes(row.raw?.action_config?.offer_phase)){try{if(!window.TPFOfferResume?.choose)throw Error('El selector de reanudación no está disponible. Actualiza la página.');const result=await window.TPFOfferResume.choose(row.raw.context.offer_instance_id,sb);if(result){await load(true);window.TPFWhatsappSendMonitor?.refresh(true);}return;}catch(error){alert(error.message);return}}
 if(action==='pause'&&row.source==='automation'&&['reminder_2','reminder_5'].includes(row.raw?.action_config?.offer_phase)&&!confirm('¿Pausar todos los recordatorios de esta oferta? No se enviará ninguno hasta que reanudes el seguimiento.'))return;
 if(action==='resume'&&!confirm('¿Reanudar este envío? Si su fecha ya pasó, quedará pendiente para enviarse a partir de un minuto.'))return;
 if(action==='cancel'&&!confirm('¿Cancelar este envío? No se eliminará y seguirá visible en el historial.'))return;
 if(action==='retry'&&!confirm('¿Reintentar este envío ahora? Solo se permite cuando el envío anterior consta como fallido.'))return;
 if(action==='now'){if(!canSendNow(row))return alert('Actualiza el envío antes de continuar.');if(!window.TPFOutsideHours)return alert('Actualiza la página para confirmar el horario.');if(!window.TPFOutsideHours.nextWindow()&&!confirm('¿Enviar ahora este mensaje a '+row.contact+'? Se adelantará el envío programado, sin duplicarlo.'))return;}
 if(action==='manual'){const phone=digits(row.phone);if(!phone)return alert('El contacto no tiene un teléfono válido.');window.open(`https://wa.me/34${phone}${row.message?'?text='+encodeURIComponent(row.message):''}`,'_blank','noopener,noreferrer');return}
 try{
  if(row.source==='automation'){
   if(action==='now'){const {data,error}=await sb.rpc('crm_send_automation_now',{p_job_id:row.id,p_expected_at:row.updatedAt});if(error)throw error;if(data?.status!=='pending')throw Error('El envío se ha detenido. Revisa su estado.');}
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
  state.automations=automations.data||[];state.jobs=jobs.data||[];state.programs=programs.data||[];state.templates=templates.error?[]:templates.data||[];await loadContactNames();state.lastLoaded=Date.now();makeRows();render();if(note)note.textContent=`Actualizado ${new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`;
 }catch(error){if(note)note.textContent='No se pudo actualizar';const body=$('ccRows');if(body)body.innerHTML=`<div class="ccEmpty"><b>No se pudo cargar el control de envíos</b><span>${esc(error?.message||'Inténtalo de nuevo.')}</span></div>`}
 finally{state.loading=false;if($('ccPanel')&&state.historyScope!==historyScope())refreshHistory();}
}
async function loadOlder(){
 const button=$('ccOlder');if(!button||state.loading)return;button.disabled=true;
 try{const {data,error}=await sb.rpc('crm_whatsapp_sent_history_filtered',{...historyArgs(),p_offset:state.history.length,p_limit:200});if(error)throw error;state.history.push(...(data?.rows||[]));state.historyTotal=data?.total||0;makeRows();render();}catch(error){alert(error.message||'No se pudo cargar el historial');}finally{button.disabled=false;}
}
function css(){if($('ccStyles'))return;const style=document.createElement('style');style.id='ccStyles';style.textContent=`
.ccPanel [hidden]{display:none!important}.ccMoreFilters{border:1px solid #dfe5ed;border-radius:10px;margin-bottom:8px}.ccMoreFilters summary{padding:10px 12px;font-weight:750;cursor:pointer}.ccExtraFilters{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:12px;padding:0 12px 12px}.ccExtraFilters label{font-size:11px;font-weight:750;color:#475467}.ccExtraFilters select,.ccExtraFilters input{width:100%;box-sizing:border-box;margin:6px 0 0;min-height:40px}.ccRange{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:12px}.ccFilterTools{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:4px 0 12px;font-size:11px;color:#667085}.ccFilterTools button{white-space:nowrap}.ccFilterTools button:disabled{opacity:.5}.ccDetailActions{flex-wrap:wrap}.ccDetailActions .ccSave{margin-left:auto}.ccEditFields{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ccEditFields label{font-size:11px;color:#667085}.ccDetail form textarea{resize:vertical;min-height:140px;line-height:1.6}.ccDetailHint{font-size:11px;color:#667085;margin:0}.ccDetailGrid label.wide{color:#667085;font-size:11px}.ccDetailGrid label.wide textarea{font-size:14px;color:#172033}.ccMonitorNote{color:#667085;font-size:11px;line-height:1.5}.ccMonitorNote:empty{display:none}.ccPagination{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding-top:16px}.ccDetail textarea,.ccDetail input{box-sizing:border-box;width:100%;margin-top:8px}.ccDetail [data-error]{color:#b42318}.ccLaunch{white-space:nowrap}.ccPanel{position:relative;height:calc(100dvh - 64px);overflow:auto;overflow-anchor:none;background:#f5f7fb;overscroll-behavior:contain;color:#172033}.ccShell{width:min(1420px,calc(100% - 28px));margin:0 auto 32px;padding-top:0}.ccHead{position:sticky;top:0;z-index:4;display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin:0 -8px 13px;padding:14px 8px 12px;background:#f5f7fb;border-bottom:1px solid #dfe5ed;box-shadow:0 7px 14px rgba(23,32,51,.05)}.ccHead h2{margin:0;font-size:21px}.ccTitleRow{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.ccHeadActions{flex-wrap:wrap;justify-content:flex-end}.ccTabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.ccTabs button{border:1px solid #dfe5ed;border-radius:8px;background:#f5f7fb;color:#475467;padding:8px 12px;font-weight:700;cursor:pointer}.ccTabs button[aria-pressed=true]{background:#eaf2ff;color:#175cd3;border-color:#91b6ef}.ccHead p{margin:0;color:#667085}.ccHeadActions{display:flex;gap:8px}.ccKpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:12px}.ccKpi{background:#fff;border:1px solid #dfe5ed;border-radius:13px;padding:13px}.ccKpi span{display:block;color:#667085;font-size:11px}.ccKpi b{display:block;margin-top:4px;font-size:22px}.ccKpi.warn b{color:#b54708}.ccKpi.bad b{color:#b42318}.ccCard{background:#fff;border:1px solid #dfe5ed;border-radius:14px;padding:14px}.ccFilters{display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:12px}.ccFilters input,.ccFilters select{margin:0;min-height:42px}.ccTableHead,.ccRow{display:grid;grid-template-columns:minmax(110px,1fr) minmax(170px,1.65fr) 112px 82px 180px;gap:10px;align-items:start}.ccTableHead{padding:8px 10px;color:#667085;font-size:10px;font-weight:800;text-transform:uppercase}.ccRow{padding:11px 10px;border-top:1px solid #edf1f5}.ccRow.duplicate{background:#fffaf0}.ccRow>div{min-width:0}.ccRow b,.ccRow span{display:block}.ccRow span{margin-top:3px;color:#667085;font-size:10px;overflow:hidden;text-overflow:ellipsis}.ccWho button{border:0;background:transparent;padding:0;color:#145bc2;text-align:left;cursor:pointer}.ccActions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}.ccActions button{border:1px solid #cfd8e5;background:#fff;border-radius:8px;padding:7px 9px;color:#344054;font-weight:750;font-size:10px;cursor:pointer}.ccActions button:not(.secondary):not(.danger){background:#175cd3;color:#fff;border-color:#175cd3}.ccActions .danger{color:#b42318;border-color:#efc7c7}.ccBadge{display:inline-flex!important;width:max-content;padding:5px 8px;border-radius:999px;font-size:9px!important;font-weight:850}.ccBadge.pending{background:#fff4d6;color:#8a6100}.ccBadge.paused,.ccBadge.cancelled{background:#f2f4f7;color:#667085}.ccBadge.sending{background:#eaf2ff;color:#175cd3}.ccBadge.sent{background:#e9f8ef;color:#23733c}.ccBadge.failed,.ccBadge.uncertain{background:#fff0f0;color:#b42318}.ccError{color:#b42318!important}.ccEmpty{display:grid;gap:5px;text-align:center;padding:42px;color:#667085}.ccDetail{width:min(720px,calc(100% - 24px));border:0;border-radius:16px;padding:0;box-shadow:0 24px 80px #102a4c55}.ccDetail::backdrop{background:#102033aa}.ccDetailHead{display:flex;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #e5eaf0}.ccDetailHead h3{margin:4px 0 0}.ccDetailHead button{border:0;background:#eef2f6;border-radius:50%;width:34px;height:34px;font-size:22px}.ccDetailGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:18px 20px}.ccOfferHistory{padding:10px;border:1px solid #e6ebf1;border-radius:10px}.ccOfferHistory summary{cursor:pointer;color:#175cd3;font-weight:700}.ccOfferHistory[open] summary{margin-bottom:10px}.ccDetailGrid>div{padding:10px;border:1px solid #e6ebf1;border-radius:10px}.ccDetailGrid span{display:block;color:#667085;font-size:10px;margin-bottom:5px}.ccDetailGrid .wide{grid-column:1/-1}.ccDetailGrid pre{white-space:pre-wrap;word-break:break-word;margin:0;font:inherit}.ccDetailGrid .warning{background:#fff8e7;border-color:#efd591}.ccDetailGrid .error{background:#fff2f2;border-color:#efc7c7}.ccDetailActions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px;padding:0 20px 18px}.ccDetailActions button{padding:9px 11px;border-radius:8px;border:1px solid #ccd5e1;background:#fff;font-weight:750}.ccDetailActions button:not(.secondary):not(.danger){background:#175cd3;color:#fff}.ccDetailActions .danger{color:#b42318}.ccUpdated{font-size:10px;color:#667085;align-self:center}
@media(max-width:900px){.ccExtraFilters{grid-template-columns:1fr 1fr}.ccHeadActions{flex-wrap:wrap}.ccKpis{grid-template-columns:1fr 1fr}.ccFilters{grid-template-columns:1fr 1fr}.ccTableHead{display:none}.ccRow{grid-template-columns:1fr 1fr}.ccActions{grid-column:1/-1;justify-content:flex-start}}
@media(max-width:560px){.ccExtraFilters,.ccRange{grid-template-columns:1fr}.ccFilterTools{align-items:flex-start;flex-direction:column}.ccShell{width:calc(100% - 16px);margin:0 auto 20px}.ccHead{flex-direction:column}.ccHeadActions{width:100%}.ccHeadActions button{flex:1}.ccKpis,.ccFilters,.ccRow,.ccDetailGrid{grid-template-columns:1fr}.ccDetailGrid .wide,.ccActions{grid-column:auto}.ccCard{padding:10px}}

.ccTitleRow{flex:1;flex-wrap:nowrap}.ccTitleRow h2{white-space:nowrap}.ccTitleRow #ccSearch{width:260px;min-width:160px;max-width:100%;margin:0;height:36px;padding:8px 10px;font-size:12px;border-radius:8px;border:1px solid #d0d9e7;background:white}.ccHead{align-items:center}.ccHeadActions{flex-wrap:nowrap;align-items:center}.ccUpdated{display:none}.ccOptions{position:relative}.ccOptions>summary{list-style:none;cursor:pointer;border:1px solid #d0d9e7;background:white;border-radius:8px;font-size:12px;font-weight:650;padding:9px 12px;white-space:nowrap}.ccOptions>summary:after{content:' ▾'}.ccOptions>summary::-webkit-details-marker{display:none}.ccOptionsBody{position:absolute;top:calc(100% + 8px);right:0;width:min(540px,calc(100vw - 40px));max-height:70vh;overflow:auto;background:white;box-shadow:0 16px 40px #17233a24;border:1px solid #dfe5ed;border-radius:12px;padding:14px;z-index:10}.ccOptionsBody .ccKpis{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.ccOptionsBody .ccKpi{padding:10px}.ccOptionsBody .ccKpi b{font-size:18px}.ccOptionsBody .ccExtraFilters{grid-template-columns:repeat(2,minmax(0,1fr));padding:0;margin:14px 0}.ccSourceTabs button{font-size:13px;padding:10px 15px}.ccSourceTabs [data-count]{display:inline-block;margin-left:7px;background:#e5edf8;border-radius:5px;padding:2px 5px;font-size:11px}.ccDateTools{display:flex;justify-content:space-between;align-items:center;gap:12px}.ccDateTabs{margin:0}.ccDateTabs button{font-size:11px;padding:7px 10px}.ccDateTools label{font-size:11px;color:#667085;display:flex;align-items:center;gap:7px}.ccDateTools select{margin:0;height:35px;font-size:12px;min-width:125px} .ccMessagePreview{display:-webkit-box!important;-webkit-line-clamp:3;-webkit-box-orient:vertical;white-space:normal;overflow:hidden!important;overflow-wrap:anywhere;font-size:11px!important;line-height:1.45;max-height:4.35em}.ccReadMessage{border:0;background:transparent;color:#175cd3;padding:3px 0;margin-top:3px;font-size:11px;font-weight:700;cursor:pointer}.ccReadMessage:hover{text-decoration:underline}.ccRow .ccActions{justify-content:flex-start}.ccRow .ccWho{padding-top:2px}.ccRow>div:nth-child(3) b{font-size:12px}.ccRange{margin:10px 0}.ccFilterTools{padding-top:9px}.ccSourceTabs{margin-bottom:12px}
body:has(.nav[data-view="sendcontrol"].active) .referenceTopbar{display:none!important}
body:has(.nav[data-view="sendcontrol"].active) .ccPanel{height:100dvh}
.ccTopFilters{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.ccTopFilters .ccSourceTabs{margin:0}
.ccTopFilters .ccDateTools{margin-left:auto;flex-wrap:wrap;justify-content:flex-end}
@media(max-width:700px){.ccTopFilters .ccDateTools{width:100%;margin-left:0;justify-content:space-between}.ccTopFilters .ccDateTabs{flex-wrap:wrap}}

@media(max-width:1100px){.ccTitleRow{flex-wrap:wrap}.ccTitleRow #ccSearch{width:230px}.ccHeadActions{flex-wrap:wrap}}
@media(max-width:560px){.ccTitleRow{width:100%;gap:8px}.ccTitleRow #ccSearch{width:100%;flex-basis:100%}.ccTitleRow h2{font-size:19px}.ccDateTools{align-items:flex-start;flex-wrap:wrap}.ccDateTabs{gap:4px}.ccOptionsBody{right:0;width:calc(100vw - 40px)}.ccOptionsBody .ccKpis{grid-template-columns:repeat(2,minmax(0,1fr))}.ccOptionsBody .ccExtraFilters{grid-template-columns:1fr}.ccHeadActions{justify-content:flex-end}.ccSourceTabs button{font-size:12px;padding:9px}.ccHead{position:relative}}
`;document.head.appendChild(style)}
function syncFilterUi(){
 const period=$('ccDate')?.value||'';
 if($('ccRange'))$('ccRange').hidden=period!=='range';
 const labels=[];
 for(const id of ['ccStatus','ccOperator','ccSource','ccDate','ccReason','ccReview']){const el=$(id);if(el?.value){const label=el.options?.[el.selectedIndex]?.textContent||el.value;labels.push(label);}}
 if($('ccSearch')?.value.trim())labels.push('Búsqueda: '+$('ccSearch').value.trim());
 if(period==='range'&&($('ccFrom')?.value||$('ccTo')?.value))labels.push(($('ccFrom').value||'Sin inicio')+' → '+($('ccTo').value||'Sin fin'));
 if($('ccFilterSummary'))$('ccFilterSummary').textContent=labels.join(' · ')||'Todos los envíos';
 const count=['ccOperator','ccReason','ccReview'].filter(id=>$(id)?.value).length;
 if($('ccFilterCount'))$('ccFilterCount').textContent=count?' · '+count+(count===1?' activo':' activos'):'';
 if(period==='range'&&$('ccFrom').value&&$('ccTo').value&&$('ccFrom').value>$('ccTo').value)$('ccFilterSummary').textContent='Revisa el intervalo: la fecha inicial debe ser anterior a la final.';
}
function clearFilters(){for(const id of ['ccSearch','ccStatus','ccOperator','ccSource','ccDate','ccReason','ccReview','ccFrom','ccTo']){if($(id))$(id).value='';}$('ccStatus').value='pending';$('ccSource').value='automation';$('ccDate').value='month';state.page=1;render();refreshHistory();}
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
 const nav=document.querySelector('.nav[data-view="sendcontrol"]');if(nav&&!nav.classList.contains('active')){state.returnView=document.querySelector('.nav.active')?.dataset.view||'dashboard';nav.click();return} const existing=$('ccPanel');if(existing){$('view-sendcontrol')?.classList.remove('hidden');const scroll=state.savedScroll??existing.scrollTop;existing.scrollTop=scroll;requestAnimationFrame(()=>{existing.scrollTop=scroll});load();return} $('ccDetail')?.remove();const root=document.createElement('section');root.id='ccPanel';root.className='ccPanel';root.innerHTML=`<div class="ccShell"><header class="ccHead"><div class="ccTitleRow"><button type="button" class="secondary" id="ccClose">← Volver</button><h2>Control de envíos</h2><input id="ccSearch" type="search" aria-label="Buscar envíos" placeholder="Buscar cliente, teléfono o mensaje"></div><div class="ccHeadActions"><span id="ccUpdated" class="ccUpdated"></span><button type="button" class="secondary" id="ccReload">↻ Actualizar</button><details class="ccOptions" id="ccMoreFilters"><summary>Más opciones<span id="ccFilterCount"></span></summary><div class="ccOptionsBody"><div class="ccKpis"><div class="ccKpi"><span>Pendientes hoy</span><b id="ccKpiPending">0</b></div><div class="ccKpi"><span>Enviados hoy</span><b id="ccKpiSent">0</b></div><div class="ccKpi bad"><span>Fallos en 24 horas</span><b id="ccKpiFailed">0</b></div><div class="ccKpi warn"><span>Posibles duplicados pendientes</span><b id="ccKpiDuplicate">0</b></div><div class="ccKpi"><span>Recordatorios sin respuesta</span><b id="ccKpiUnanswered">—</b></div></div><div class="ccExtraFilters"><label>Operador<select id="ccOperator"><option value="">Todos los operadores</option></select></label><label>Tipo<select id="ccSource"><option value="">Todos los tipos</option><option value="automation" selected>Automáticos</option><option value="program">Programados manualmente</option><option value="history">Otros WhatsApp enviados</option></select></label><label>Fecha<select id="ccDate"><option value="">Cualquier fecha</option><option value="today">Hoy</option><option value="tomorrow">Mañana</option><option value="week">Esta semana</option><option value="month" selected>Este mes</option><option value="range">Elegir intervalo</option></select></label><label>Motivo<select id="ccReason"><option value="">Todos los motivos</option><option value="offer">Oferta</option><option value="reminder">Recordatorio de oferta</option><option value="installation">Instalación</option><option value="return">Devolución del router</option><option value="followup">Seguimiento de 3 meses</option><option value="review">Revisión de 11 meses</option><option value="manual">Programado manualmente</option><option value="other">Otros</option></select></label><label>Necesitan revisión<select id="ccReview"><option value="">Todos</option><option value="needs">Solo necesitan revisión</option><option value="failed">Fallidos o inciertos</option><option value="duplicates">Posibles duplicados</option><option value="overdue">Pendientes vencidos</option></select></label></div><button type="button" class="secondary" id="ccPauseEngine" disabled>Pausar automatizaciones</button><p class="ccMonitorNote">Los contadores reflejan registros del CRM. No indican denuncias ni garantizan que WhatsApp no restrinja la cuenta.</p></div></details></div></header><p id="ccMonitorNote" class="ccMonitorNote"></p><div class="ccCard"><div class="ccTopFilters"><div class="ccSourceTabs ccTabs" role="group" aria-label="Origen de los envíos"><button data-cc-source="program">Programados por mí <span data-count>0</span></button><button data-cc-source="automation">Automáticos <span data-count>0</span></button></div><div class="ccDateTools"><div class="ccTabs ccDateTabs" role="group" aria-label="Fecha de los envíos"><button data-cc-period="today">Hoy</button><button data-cc-period="week">Esta semana</button><button data-cc-period="month">Este mes</button><button data-cc-period="range">Elegir fechas</button></div><label>Estado<select id="ccStatus"><option value="">Todos los estados</option><option value="pending" selected>Pendientes</option><option value="paused">Pausados</option><option value="sending">Enviando</option><option value="sent">Enviados</option><option value="failed">Fallidos</option><option value="uncertain">Por revisar</option><option value="cancelled">Cancelados</option></select></label></div></div><div id="ccRange" class="ccRange" hidden><label>Desde<input id="ccFrom" type="date"></label><label>Hasta<input id="ccTo" type="date"></label></div><div class="ccFilterTools"><span id="ccFilterSummary"></span><button class="secondary" id="ccClear">Limpiar filtros</button></div><div class="ccTableHead"><span>Contacto</span><span>Qué se manda</span><span>Cuándo</span><span>Estado</span><span>Acciones</span></div><div id="ccRows"><div class="ccEmpty">Cargando…</div></div><div class="ccPagination"><button id="ccPrev">← Anterior</button><span id="ccPageInfo"></span><button id="ccNext">Siguiente →</button><button id="ccOlder" hidden>Cargar enviados anteriores</button></div></div></div>`;($('view-sendcontrol')||document.querySelector('.referenceWorkspace main')).appendChild(root);root.scrollTop=0;$('ccClose').onclick=close;$('ccClear').onclick=clearFilters;$('ccPauseEngine').onclick=pauseEngine;$('ccReload').onclick=()=>load(true);['ccSearch','ccStatus','ccOperator','ccSource','ccDate','ccReason','ccReview','ccFrom','ccTo'].forEach(id=>{$(id).addEventListener(id==='ccSearch'?'input':'change',()=>{if(id==='ccReview'&&$(id).value)$('ccStatus').value='';state.page=1;render();if(['ccDate','ccFrom','ccTo'].includes(id))refreshHistory();})});$('ccPrev').onclick=()=>{state.page=Math.max(1,state.page-1);render()};$('ccNext').onclick=()=>{state.page++;render()};$('ccOlder').onclick=loadOlder;root.onclick=event=>{const sourceButton=event.target.closest('[data-cc-source]');if(sourceButton){$('ccSource').value=sourceButton.dataset.ccSource;state.page=1;render();return}const dateButton=event.target.closest('[data-cc-period]');if(dateButton){$('ccDate').value=dateButton.dataset.ccPeriod;state.page=1;render();refreshHistory();return}const tab=event.target.closest('[data-cc-tab]');if(tab){const value=tab.dataset.ccTab;$('ccStatus').value=['review','all'].includes(value)?'':value;$('ccReview').value=value==='review'?'needs':'';state.page=1;render();return}const messageButton=event.target.closest('[data-cc-message]');if(messageButton){detail(rowByKey(messageButton.dataset.ccMessage),true);return}const detailButton=event.target.closest('[data-cc-detail]');if(detailButton){detail(rowByKey(detailButton.dataset.ccDetail));return}const button=event.target.closest('[data-cc-action]');if(button)act(button.dataset.ccAction,rowByKey(button.dataset.ccRow))};load(true)
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




