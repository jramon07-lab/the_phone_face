'use strict';

const DELIVERY_WINDOW_MS=5*60*1000;
const SEND_ACTIONS=new Set(['send_template','send_whatsapp_now','__send_whatsapp']);
const clean=value=>String(value??'').trim();
const asTime=value=>{const time=new Date(value||0).getTime();return Number.isFinite(time)?time:0};

function madridParts(value){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
  return Object.fromEntries(parts.filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)]));
}
function madridOffsetMinutes(value){
  const date=new Date(value),parts=madridParts(date);
  return (Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute)-date.getTime())/60000;
}
function zonedToUtc(year,month,day,hour=0,minute=0){
  const target=Date.UTC(year,month-1,day,hour,minute);let utc=target-madridOffsetMinutes(target)*60000;
  utc=target-madridOffsetMinutes(utc)*60000;return new Date(utc);
}
function madridDay(value=Date.now()){
  const p=madridParts(value),start=zonedToUtc(p.year,p.month,p.day),end=zonedToUtc(p.year,p.month,p.day+1);
  return {key:`${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`,start:start.toISOString(),end:end.toISOString(),hour:p.hour,minute:p.minute};
}
function madridDateTime(value){
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return'';
  return new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date).replace(',',' ·');
}
function manualAt(row){return row?.whatsapp_scheduled_at||row?.starts_at||''}
function dueManual(rows,{enabledAt,now=Date.now(),windowMs=DELIVERY_WINDOW_MS}={}){
  const floor=Math.max(asTime(enabledAt),now-Math.max(1000,Number(windowMs)||DELIVERY_WINDOW_MS));
  return (rows||[]).filter(row=>row?.whatsapp_enabled===true&&clean(row.status).toLowerCase()==='pending'&&!['sent','failed'].includes(clean(row.whatsapp_delivery_status).toLowerCase())&&asTime(manualAt(row))>=floor&&asTime(manualAt(row))<=now);
}
function deliveryKey(kind,id,at=''){const stamp=asTime(at);return `telegram_delivery_${kind}_${clean(id)}${stamp?`_${stamp.toString(36)}`:''}`}
function manualMessage(row){
  const lines=['💬 WhatsApp programado','',`Cliente: ${clean(row?.customer_name)||'Sin nombre'}`,`Teléfono: ${clean(row?.whatsapp_phone||row?.customer_phone)||'Sin teléfono'}`];
  if(manualAt(row))lines.push(`Fecha y hora: ${madridDateTime(manualAt(row))}`);
  lines.push(`Mensaje: ${clean(row?.whatsapp_message)||'Sin mensaje'}`);return lines.join('\n');
}
function jobMessage(job,templates=new Map()){
  const config=job?.action_config||{},context=job?.context||{},template=templates.get(String(config.template_id||''));
  return clean(config.text||config.message||template?.body||template?.name)||'No se pudo recuperar el texto del mensaje';
}
function failureMessage(job,templates=new Map()){
  const context=job?.context||{};return [
    '🚨 Error al enviar WhatsApp','',
    `Cliente: ${clean(context.contact_name||context.customer_name||context.name)||'Sin nombre'}`,
    `Teléfono: ${clean(context.phone||context.customer_phone)||'Sin teléfono'}`,
    `Mensaje: ${jobMessage(job,templates)}`,
    `Motivo: ${clean(job?.error_message)||'Error sin detalle'}`
  ].join('\n');
}
function money(value){const amount=Number(value);return Number.isFinite(amount)?new Intl.NumberFormat('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}).format(amount)+' €/mes':''}
function businessMessage(event){
  const payload=event?.payload||{},titles={offer_sent:'💰 Oferta enviada',offer_accepted:'✅ Oferta aceptada',sale_processed:'📄 Venta tramitada',sale_won:'🏆 Venta ganada',sale_lost:'❌ Venta perdida',offer_cancelled:'🛑 Oferta cancelada'};
  const lines=[titles[clean(event?.event_type)]||'💰 Cambio en oferta','',`Cliente: ${clean(payload.client_name)||'Sin nombre'}`,`Teléfono: ${clean(payload.phone)||'Sin teléfono'}`];
  if(clean(payload.operator))lines.push(`Operador: ${clean(payload.operator)}`);
  if(clean(payload.offer_name))lines.push(`Oferta: ${clean(payload.offer_name)}`);
  if(money(payload.total_price))lines.push(`Importe: ${money(payload.total_price)}`);
  return lines.join('\n');
}
function followupMessage(event,offer={},opportunity={}){
  const type=clean(event?.event_type),payload=event?.payload||{},titles={followup_sent:'🔄 Seguimiento enviado',verification_deferred:'⏳ Seguimiento aplazado',delivery_deferred:'⏳ Seguimiento aplazado',pre_send_blocked:'⏸ Seguimiento detenido',followup_paused:'⏸ Seguimiento pausado',followup_resumed:'▶️ Seguimiento reactivado'};
  const lines=[titles[type]||'🔄 Cambio en seguimiento','',`Cliente: ${clean(payload.client_name||opportunity.client_name)||'Sin nombre'}`,`Teléfono: ${clean(payload.phone||opportunity.phone)||'Sin teléfono'}`];
  if(clean(payload.operator||offer.operator))lines.push(`Operador: ${clean(payload.operator||offer.operator)}`);
  if(clean(payload.offer_name||offer.offer_name))lines.push(`Oferta: ${clean(payload.offer_name||offer.offer_name)}`);
  if(clean(event?.detail))lines.push(`Detalle: ${clean(event.detail)}`);
  return lines.join('\n');
}
function automaticJobs(rows,status){return(rows||[]).filter(row=>SEND_ACTIONS.has(clean(row?.action_type))&&clean(row?.status).toLowerCase()===status)}
function dailySummary({dayKey,sent=0,manualPending=0,errors=0}){
  const [year,month,day]=clean(dayKey).split('-');return [
    `📊 Resumen diario · ${day}/${month}/${year}`,'',
    `✅ WhatsApp automáticos enviados: ${Number(sent)||0}`,
    `💬 WhatsApp manuales pendientes: ${Number(manualPending)||0}`,
    `🚨 Errores de envío: ${Number(errors)||0}`
  ].join('\n');
}
function shouldSendDaily(now=Date.now(),hour=20,minute=30){const day=madridDay(now);return {...day,due:day.hour>hour||(day.hour===hour&&day.minute>=minute)}}

module.exports={DELIVERY_WINDOW_MS,SEND_ACTIONS,madridDay,madridDateTime,manualAt,dueManual,deliveryKey,manualMessage,jobMessage,failureMessage,businessMessage,followupMessage,automaticJobs,dailySummary,shouldSendDaily};
