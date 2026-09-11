'use strict';
const assert=require('assert');
const fs=require('fs');
const T=require('../lib/telegram-agenda-core');

const tasks=[
 {id:'a1',status:'pending',title:'Llamar',customer_name:'Ana',customer_phone:'600000001',starts_at:'2026-09-20T08:00:00.000Z',reminder_at:null,whatsapp_enabled:false},
 {id:'a2',status:'pending',title:'Cita',starts_at:'2026-09-20T10:00:00.000Z',reminder_at:'2026-09-20T07:00:00.000Z',whatsapp_enabled:false},
 {id:'done',status:'completed',starts_at:'2026-09-20T08:00:00.000Z'},
 {id:'wa',status:'pending',starts_at:'2026-09-20T08:00:00.000Z',whatsapp_enabled:true}
];
let due=T.dueDeliveries(tasks,{enabledAt:'2026-09-20T06:00:00.000Z',now:new Date('2026-09-20T08:00:30.000Z').getTime()});
assert.deepEqual(due.map(x=>[x.task.id,x.kind]),[['a2','extra'],['a1','main']]);
due=T.dueDeliveries(tasks,{enabledAt:'2026-09-20T08:00:01.000Z',now:new Date('2026-09-20T11:00:00.000Z').getTime()});
assert.deepEqual(due.map(x=>[x.task.id,x.kind]),[['a2','main']],'La activación no recupera avisos antiguos');
assert.equal(T.deliveryKey('a1','main'),'telegram_delivery_agenda_main_a1');
assert.equal(T.callbackData('a1'),'tpf:task:complete:a1');
assert.equal(T.callbackTaskId('tpf:task:complete:a1'),'a1');
assert.equal(T.callbackTaskId('delete:a1'),'');
const text=T.taskMessage(tasks[0],{dni:'12345678Z'});
for(const wanted of ['📅 Tarea de The Phone Face','Llamar','Cliente: Ana','Teléfono: 600000001','DNI/NIF: 12345678Z','Fecha y hora: 20/09/2026 · 10:00'])assert(text.includes(wanted),wanted);
assert.equal(T.recordDni({data:{'DNI / NIF':' 12345678Z '}}),'12345678Z');
assert.match(T.webhookSecret('secret'),/^[a-f0-9]{64}$/);
const vercel=JSON.parse(fs.readFileSync(require.resolve('../vercel.json'),'utf8'));
assert(vercel.crons.some(row=>row.path==='/api/telegram-agenda'&&row.schedule==='* * * * *'),'El servidor debe comprobar la agenda cada minuto');
const browser=fs.readFileSync(require.resolve('../js/modules/whatsapp-scheduling-core.js'),'utf8');
const agendaBlock=browser.slice(browser.indexOf('// AGENDA'),browser.indexOf('setInterval',browser.indexOf('// AGENDA')));
assert(!agendaBlock.includes('sendTelegramNotification("agenda"'),'El navegador no debe duplicar el Telegram del servidor');
console.log('PASS Telegram Agenda: fecha exacta, segundo aviso opcional, exclusiones, contenido, botón y secreto webhook.');
