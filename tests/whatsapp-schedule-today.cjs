const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('js/modules/whatsapp-schedule-direct-v3.js','utf8');
const runtime=fs.readFileSync('js/modules/runtime.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(source,/\['Hoy',today\]/,'debe ofrecer el acceso rápido Hoy');
assert.match(source,/function nextHalfHour/,'Hoy debe comenzar en la siguiente media hora');
assert.match(source,/for\(let minutes=0;minutes<24\*60;minutes\+=30\)/,'las horas deben avanzar en intervalos de 30 minutos');
assert.match(source,/dateValue===today[\s\S]*<=now\.getTime\(\)/,'Hoy no debe mostrar horas pasadas');
assert.match(source,/<select id="tpfS3time"/,'la hora debe mostrarse como desplegable');
assert.match(source,/Elige la hora en intervalos de 30 minutos/);
assert.match(runtime,/whatsapp-schedule-direct-v3\.js'\?'20260910-today-time-1'/);
assert.match(index,/runtime\.js\?v=20260910-schedule-today-1/);

console.log('PASS Programar WhatsApp: Hoy y selector de horas futuras cada 30 minutos');
