const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('js/modules/whatsapp-ui-fixes.js','utf8');
const start=source.indexOf('const STATUS_SWEEP_MS=');
const end=source.indexOf('async function hydrateStatuses',start);
assert.ok(start>0&&end>start,'No se encontró el selector de estados de WhatsApp');

const context={
  Date,
  Map,
  Set,
  waMessageDirection:message=>message.direction,
  waMessageTimestamp:message=>message.timestamp
};
vm.createContext(context);
vm.runInContext(source.slice(start,end)+';this.pick=statusCandidates;this.checked=statusChecked;this.pending=statusPending;',context);

const now=Date.now();
const history=Array.from({length:30},(_,index)=>({
  idMessage:`message-${index}`,
  direction:'out',
  timestamp:index,
  __realStatus:index===5?'read':'sent'
}));

let batch=Array.from(context.pick(history,now),message=>message.idMessage);
assert.deepEqual(batch,['message-29','message-28'],'La primera comprobación prioriza los mensajes recientes');

batch.forEach(id=>context.checked.set(id,now));
batch=Array.from(context.pick(history,now),message=>message.idMessage);
assert.deepEqual(batch,['message-27','message-26'],'Una nueva pintura rota a otros mensajes y no repite siempre los dos últimos');

for(const message of history)context.checked.set(message.idMessage,now);
assert.equal(context.pick(history,now).length,0,'El enfriamiento evita nuevas llamadas durante el mismo minuto');
assert.equal(source.includes('.slice(-12)'),false,'Los mensajes cargados no deben quedar fuera por un límite fijo de doce');
assert.match(source,/wrapRenderer\(\).*hydrateStatuses\(false\)/s,'Repintar no debe forzar consultas repetidas');

console.log('WhatsApp status refresh rotates fairly without repeated requests');
