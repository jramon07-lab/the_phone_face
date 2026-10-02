'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{},document:{},Intl,Date,console};vm.createContext(context);vm.runInContext(fs.readFileSync('js/modules/router-return.js','utf8'),context);
const api=context.window.TPFRouterReturn;
const base='Hola Ana 👋\n\nCuando te instalen la fibra, avísanos. Si tienes algún problema, llámanos.\n\n⚠️ Activa Netflix solo cuando tu línea ya esté en Vodafone.\n\n📦 Las instrucciones para devolver el router anterior pueden tardar hasta 15 días.';
for(const old of ['Yoigo','MásMóvil']){const text=api.message(base,old);assert.match(text,/código por SMS/);assert.match(text,/Correos/);assert.match(text,/hasta 15 días/);assert.match(text,/Activa Netflix/);assert.match(text,/Cuando te instalen/);assert.equal((text.match(/📦/g)||[]).length,1);}
assert.equal(api.message(base,'Yoigo'),api.message(base,'MásMóvil'));
const o2=api.message(base,'O2');assert.match(o2,/tienda Movistar/);assert.doesNotMatch(o2,/SMS|15 días|Correos/);
const vodafone=api.message(base,'Vodafone');assert.match(vodafone,/instrucciones/);assert.match(vodafone,/unos 15 días/);assert.match(vodafone,/Correos/);assert.doesNotMatch(vodafone,/SMS/);
assert.doesNotMatch(api.message(base,'Ninguno'),/📦|router/);assert.match(api.message(base,'Ninguno'),/Netflix/);
assert.equal(api.madridIso('2030-07-02T10:00'),'2030-07-02T08:00:00.000Z');
assert.equal(api.madridIso('2030-01-02T10:00'),'2030-01-02T09:00:00.000Z');
assert.throws(()=>api.madridIso('2030-03-31T02:30'),/hora no existe/);
assert.throws(()=>api.madridIso('2020-01-01T10:00'),/futuras/);
assert.equal(api.nextDaySlot(Date.parse('2026-10-02T07:31:00Z')),'2026-10-03T10:00');
assert.equal(api.nextDaySlot(Date.parse('2026-10-02T07:00:00Z')),'2026-10-03T09:00');
assert.equal(api.nextDaySlot(Date.parse('2026-10-24T08:14:00Z')),'2026-10-25T10:30');
console.log('Router return: grouped operators, Netflix preserved, no-router option and Madrid scheduling verified.');
