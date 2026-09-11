'use strict';

const crypto=require('crypto');
const DEFAULT_DELIVERY_WINDOW_MS=90*1000;

const clean=value=>String(value??'').trim();
const asTime=value=>{const time=new Date(value||0).getTime();return Number.isFinite(time)?time:0};

function deliveryKey(taskId,kind='main',at=''){
  const stamp=asTime(at);
  return `telegram_delivery_agenda_${kind}_${clean(taskId)}${stamp?`_${stamp.toString(36)}`:''}`;
}

function notificationMoments(task){
  const moments=[];
  const main=asTime(task?.starts_at);
  const extra=asTime(task?.reminder_at);
  if(extra&&extra!==main)moments.push({kind:'extra',at:extra});
  if(main)moments.push({kind:'main',at:main});
  return moments;
}

function dueDeliveries(tasks,{enabledAt,now=Date.now(),windowMs=DEFAULT_DELIVERY_WINDOW_MS}={}){
  const floor=Math.max(asTime(enabledAt),now-Math.max(1000,Number(windowMs)||DEFAULT_DELIVERY_WINDOW_MS));
  return (tasks||[]).flatMap(task=>{
    if(clean(task?.status).toLowerCase()!=='pending'||task?.whatsapp_enabled===true)return[];
    return notificationMoments(task)
      .filter(moment=>moment.at>=floor&&moment.at<=now)
      .map(moment=>({...moment,task,key:deliveryKey(task.id,moment.kind,moment.at)}));
  }).sort((a,b)=>a.at-b.at||a.key.localeCompare(b.key));
}

function deliverySignature(item){
  const task=item?.task||{};
  return [
    clean(item?.kind).toLowerCase(),asTime(item?.at),
    clean(task.title).toLowerCase(),clean(task.customer_name).toLowerCase(),
    clean(task.customer_phone).replace(/\D/g,''),clean(task.description).toLowerCase()
  ].join('|');
}

function madridDateTime(value){
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return'';
  return new Intl.DateTimeFormat('es-ES',{
    timeZone:'Europe/Madrid',day:'2-digit',month:'2-digit',year:'numeric',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).format(date).replace(',', ' ·');
}

function recordDni(record){
  const data=record?.data||{};
  return clean(data['DNI / NIF']||data['DNI/NIF']||data.DNI||data.NIF);
}

function taskMessage(task,{kind='main',dni=''}={}){
  const lines=[kind==='extra'?'⏰ Segundo recordatorio':'📅 Tarea de The Phone Face'];
  if(task?.title)lines.push('',clean(task.title));
  if(task?.customer_name)lines.push(`Cliente: ${clean(task.customer_name)}`);
  if(task?.customer_phone)lines.push(`Teléfono: ${clean(task.customer_phone)}`);
  if(dni)lines.push(`DNI/NIF: ${clean(dni)}`);
  const at=kind==='extra'?(task?.reminder_at||task?.starts_at):task?.starts_at;
  if(at)lines.push(`Fecha y hora: ${madridDateTime(at)}`);
  if(task?.description)lines.push(`Notas: ${clean(task.description)}`);
  return lines.join('\n');
}

function callbackData(taskId,action='complete',value=''){
  return ['tpf','task',clean(action),clean(value),clean(taskId)].filter(Boolean).join(':');
}
function parseCallbackData(value){
  const match=/^tpf:task:(complete|postpone|date|menu|snooze|day):(?:(1h|1d|7d|[1-7]):)?([0-9a-z-]{1,40})$/i.exec(clean(value));
  return match?{action:match[1].toLowerCase(),value:clean(match[2]).toLowerCase(),taskId:match[3]}:null;
}
function callbackTaskId(value){
  return parseCallbackData(value)?.taskId||'';
}
function initialKeyboard(taskId){
  return {inline_keyboard:[
    [{text:'✅ Completar',callback_data:callbackData(taskId,'complete')}],
    [
      {text:'⏰ Posponer',callback_data:callbackData(taskId,'postpone')},
      {text:'📅 Cambiar fecha',callback_data:callbackData(taskId,'date')}
    ]
  ]};
}
function postponeKeyboard(taskId){
  return {inline_keyboard:[
    [{text:'En 1 hora',callback_data:callbackData(taskId,'snooze','1h')}],
    [{text:'Mañana, misma hora',callback_data:callbackData(taskId,'snooze','1d')}],
    [{text:'En 1 semana',callback_data:callbackData(taskId,'snooze','7d')}],
    [{text:'↩️ Volver',callback_data:callbackData(taskId,'menu')}]
  ]};
}
function dateKeyboard(taskId,now=Date.now()){
  const formatter=new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',weekday:'short',day:'2-digit',month:'2-digit'});
  const buttons=Array.from({length:7},(_,index)=>{const offset=index+1;return({
    text:offset===1?'Mañana':formatter.format(new Date(now+offset*86400000)).replace('.',''),
    callback_data:callbackData(taskId,'day',String(offset))
  })});
  return {inline_keyboard:[buttons.slice(0,2),buttons.slice(2,4),buttons.slice(4,6),buttons.slice(6),[{text:'↩️ Volver',callback_data:callbackData(taskId,'menu')}]]};
}
function postponedAt(choice,now=Date.now()){
  if(choice==='1h')return new Date(now+3600000).toISOString();
  if(choice==='1d')return moveToMadridDay(now,1,now);
  if(choice==='7d')return moveToMadridDay(now,7,now);
  return'';
}
function madridParts(value){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
  return Object.fromEntries(parts.filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)]));
}
function madridOffsetMinutes(value){
  const date=new Date(value),parts=madridParts(date);
  return (Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute)-date.getTime())/60000;
}
function moveToMadridDay(startsAt,offsetDays,now=Date.now()){
  const original=madridParts(startsAt||now);
  const base=madridParts(now);
  const targetDay=new Date(Date.UTC(base.year,base.month-1,base.day+Number(offsetDays||0),original.hour,original.minute));
  let utc=targetDay.getTime()-madridOffsetMinutes(targetDay)*60000;
  utc=targetDay.getTime()-madridOffsetMinutes(utc)*60000;
  return new Date(utc).toISOString();
}
function webhookSecret(secret){return crypto.createHash('sha256').update(clean(secret)).digest('hex')}

module.exports={DEFAULT_DELIVERY_WINDOW_MS,deliveryKey,notificationMoments,dueDeliveries,deliverySignature,madridDateTime,recordDni,taskMessage,callbackData,parseCallbackData,callbackTaskId,initialKeyboard,postponeKeyboard,dateKeyboard,postponedAt,moveToMadridDay,webhookSecret};
