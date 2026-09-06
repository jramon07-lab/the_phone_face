const assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../js/modules/contact-document-scanner.js'),'utf8');
assert(!source.includes('orientCanvas('));
assert(!source.includes('orientationWorker'));
const build=source.slice(source.indexOf("$('[data-build]').onclick"),source.indexOf("$('[data-back]').onclick"));
assert(!build.includes('await readExpiry()'));
assert(source.includes('DNI detectado. Pulsa Preparar PDF.'));
console.log('PASS scanner remains fast until an explicit expiry request');
