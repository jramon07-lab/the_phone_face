const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('js/modules/automation-control-center.js','utf8');
const context={window:{TPFModules:{register(){}}}};
vm.runInNewContext(source,context,{filename:'automation-control-center.js'});

const api=context.window.TPFAutomationControlCenter;
assert(api,'debe publicar el controlador del centro de envíos');
assert.equal(api.statusOf('automation',{status:'pending'}),'pending');
assert.equal(api.statusOf('automation',{status:'paused'}),'paused');
assert.equal(api.statusOf('automation',{status:'done'}),'sent');
assert.equal(api.statusOf('program',{status:'pending',whatsapp_delivery_status:'uncertain'}),'uncertain');
assert.equal(api.statusOf('program',{status:'completed',whatsapp_delivery_status:'sent'}),'sent');
assert.equal(api.operatorOf({name:'Seguimiento O2'},{}),'O2');
assert.equal(api.operatorOf({name:'Revisión MásMóvil'},{}),'MásMóvil');

assert.match(source,/crm_set_automation_job_pause/,'debe pausar y reanudar de forma controlada');
assert.match(source,/crm_cancel_automation_job/,'debe cancelar sin borrar el historial');
assert.match(source,/crm_retry_automation_step/,'debe reutilizar el reintento seguro y deduplicado');
assert.match(source,/Posibles duplicados activos/,'debe señalar posibles duplicados');
assert.match(source,/Resultado incierto|Revisar antes de reenviar/,'debe impedir reenvíos ciegos');
assert.doesNotMatch(source,/\.delete\(/,'el centro no debe borrar trabajos ni mensajes');

const sql=fs.readFileSync('db/proposals/automation_control_center.sql','utf8');
assert.match(sql,/user_id\s*=\s*auth\.uid\(\)/,'los controles deben limitarse al propietario');
assert.match(sql,/status in \('pending','paused'\)/,'solo se cancelan trabajos que aún no se enviaron');
assert.match(sql,/grant execute .* to authenticated/i,'las funciones deben exigir sesión autenticada');
assert.match(sql,/revoke all .* from public, anon/i,'las funciones no deben quedar públicas');

console.log('PASS automation control center: estados, seguridad, duplicados y acciones sin borrado');
