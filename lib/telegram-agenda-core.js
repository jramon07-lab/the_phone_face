'use strict';

const crypto=require('crypto');

const clean=value=>String(value??'').trim();
const asTime=value=>{const time=new Date(value||0).getTime();return Number.isFinite(time)?time:0};

function deliveryKey(taskId,kind='main'){
  return `telegram_delivery_agenda_${kind}_${clean(taskId)}`;
}

function notificationMoments(task){
  const moments=[];
  const main=asTime(task?.starts_at);
  const extra=asTime(task?.reminder_at);
  if(extra&&extra!==main)moments.push({kind:'extra',at:extra});
  if(main)moments.push({kind:'main',at:main});
  return moments;
}

function dueDeliveries(tasks,{enabledAt,now=Date.now()}={}){
  const floor=asTime(enabledAt);
  return (tasks||[]).flatMap(task=>{
    if(clean(task?.status).toLowerCase()!=='pending'||task?.whatsapp_enabled===true)return[];
    return notificationMoments(task)
      .filter(moment=>moment.at>=floor&&moment.at<=now)
      .map(moment=>({...moment,task,key:deliveryKey(task.id,moment.kind)}));
  }).sort((a,b)=>a.at-b.at||a.key.localeCompare(b.key));
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

function callbackData(taskId){return `tpf:task:complete:${clean(taskId)}`}
function callbackTaskId(value){
  const match=/^tpf:task:complete:([0-9a-z-]{1,40})$/i.exec(clean(value));
  return match?.[1]||'';
}
function webhookSecret(secret){return crypto.createHash('sha256').update(clean(secret)).digest('hex')}

module.exports={deliveryKey,notificationMoments,dueDeliveries,madridDateTime,recordDni,taskMessage,callbackData,callbackTaskId,webhookSecret};
