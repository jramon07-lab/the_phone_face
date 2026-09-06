const assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../js/modules/contact-document-scanner.js'),'utf8');
assert(!source.includes('orientCanvas('));
assert(!source.includes('orientationWorker'));
assert(source.includes("pages.every(p=>p.detected)&&$('[data-kind]').value==='dni')await task(build)"));
const build=source.slice(source.indexOf('async function build()'),source.indexOf("$('[data-build]').onclick"));
assert(build.includes("if($('[data-kind]').value==='dni')await readExpiry()"));
console.log('PASS scanner prepares a detected DNI PDF and expiry automatically');
