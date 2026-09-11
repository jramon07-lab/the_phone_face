const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
const start=source.indexOf('async function waPollOnce()');
const lease=source.indexOf('if(!waOwnRuntimeLease',start);
assert.ok(start>0&&lease>start,'No se encontró el sondeo de WhatsApp');
const guard=source.slice(start,lease);
const poll=source.slice(start,source.indexOf('\nfunction startWaPolling()',start));

assert.match(guard,/document\.hidden\?60000:30000/,'Una pestaña oculta consulta como máximo una vez por minuto');
assert.match(guard,/view-whatsapplive/,'El sondeo debe distinguir si WhatsApp está visible');
assert.match(guard,/now-waLastBackgroundPollAt<backgroundDelay/,'Fuera de WhatsApp se respeta el intervalo adaptado de 30 o 60 segundos');
assert.ok(poll.indexOf('document.hidden')<poll.indexOf('waOwnRuntimeLease'),'La visibilidad se comprueba antes de reservar el sondeo');

console.log('WhatsApp background polling is throttled while preserving delayed notifications');
