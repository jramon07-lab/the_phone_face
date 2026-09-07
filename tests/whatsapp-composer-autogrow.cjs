const fs=require('fs');
const assert=require('assert');
const source=fs.readFileSync('js/modules/whatsapp-composer-autogrow.js','utf8');
const runtime=fs.readFileSync('js/modules/runtime.js','utf8');
assert(source.includes('MAX_HEIGHT=144'),'El compositor debe tener un alto máximo');
assert(source.includes("input.addEventListener('input'"),'El compositor debe reaccionar mientras se escribe');
assert(source.includes("input.style.height='auto'"),'El compositor debe recalcular su altura');
assert(source.includes('[350,1200,2500]'),'El compositor debe recuperar su tamaño incluso tras un envío lento');
assert(runtime.includes("'whatsapp-composer-autogrow.js'"),'El módulo debe cargarse en runtime');
