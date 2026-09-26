'use strict';
const DEFAULTS={enabled:false,message:'Hola, gracias por escribir a Phone House Albolote. Ahora estamos fuera de horario. Te responderemos en cuanto volvamos a abrir.',schedule:[[],[['10:00','14:00'],['17:30','20:30']],[['10:00','14:00'],['17:30','20:30']],[['10:00','14:00'],['17:30','20:30']],[['10:00','14:00'],['17:30','20:30']],[['10:00','14:00'],['17:30','20:30']],[['10:00','14:00']]]};
const minutes=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
function validate(value){
 if(typeof value?.enabled!=='boolean')throw Error('Indica si la respuesta está activa.');
 const message=String(value.message||'').trim();if(!message||message.length>1500)throw Error('El mensaje debe tener entre 1 y 1500 caracteres.');
 const schedule=value.schedule;if(!Array.isArray(schedule)||schedule.length!==7)throw Error('Revisa los siete días.');
 let total=0;
 for(const day of schedule){if(!Array.isArray(day)||day.length>2)throw Error('Se permiten dos franjas por día.');let end=-1;for(const span of day){if(!Array.isArray(span)||span.length!==2||!span.every(x=>typeof x==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x))||minutes(span[0])>=minutes(span[1])||minutes(span[0])<end)throw Error('Las franjas deben estar ordenadas y no solaparse.');end=minutes(span[1]);total++;}}
 if(!total)throw Error('Añade al menos una franja de apertura.');
 return {enabled:value.enabled,message,schedule};
}
function localParts(date){const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute)};}
// A closure is identified by its last closing time in Madrid, including weekends/DST.
function closure(date,schedule){const p=localParts(date),day=new Date(p.date+'T12:00:00Z'),weekday=day.getUTCDay();if(schedule[weekday].some(([a,b])=>p.minute>=minutes(a)&&p.minute<minutes(b)))return null;for(let back=0;back<8;back++){const d=new Date(day.getTime()-back*86400000),spans=schedule[d.getUTCDay()];for(let i=spans.length-1;i>=0;i--){const end=spans[i][1];if(back||minutes(end)<=p.minute)return d.toISOString().slice(0,10)+'T'+end;}}return null;}
function eligible(row,now,enabledSince){const ts=Number(row.ts)>1e12?Number(row.ts)/1000:Number(row.ts);const age=now.getTime()/1000-ts;return row.direction==='in'&&/^\d{8,15}@c\.us$/.test(row.chat_id)&&age>=-30&&age<=300&&ts>=Date.parse(enabledSince)/1000&&['textMessage','extendedTextMessage'].includes(row.type_message)&&!['me interesa','no me interesa','quiero otra oferta','más opciones','volver','otro motivo','stop','baja'].includes(String(row.text_content||'').trim().toLowerCase());}
module.exports={DEFAULTS,validate,closure,eligible};
