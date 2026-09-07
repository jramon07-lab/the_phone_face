'use strict';
const assert=require('node:assert');
const fs=require('node:fs');

const legacy=fs.readFileSync('js/modules/automations-pro-v2.js','utf8');
const finalUi=fs.readFileSync('js/modules/automations-pro-v2-fix.js','utf8');
const runtime=fs.readFileSync('js/modules/runtime.js','utf8');
const browserSpec=fs.readFileSync('tests/e2e/crm-visual.spec.js','utf8');

assert.match(finalUi,/window\.__tpfAutomationsFinalUi=true/,'la interfaz final debe declarar que es la propietaria de los metadatos');
assert.match(legacy,/if\(window\.__tpfAutomationsFinalUi\|\|!viewVisible\(\)\)return/,'el decorador antiguo no debe reescribir la interfaz final');
assert.match(legacy,/if\(meta\.innerHTML!==html\)meta\.innerHTML=html/,'el modo de reserva también debe ser idempotente');
assert.match(runtime,/automations-pro-v2\.js'\|\|file==='automations-pro-v2-fix\.js'\?'20260907-idle-stable-1'/,'el navegador debe recibir los módulos corregidos sin reutilizar caché');
assert.match(browserSpec,/row\.dataset\.afId&&row\.querySelector\('\.afOperator'\)&&row\.querySelector\('\[data-ac-cancel-all\]'\)/,'la prueba de reposo debe comenzar después de todos los controles iniciales');

console.log('automation idle stability guard ok');
