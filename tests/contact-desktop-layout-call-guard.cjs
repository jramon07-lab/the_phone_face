'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('js/modules/contact-desktop-layout.js','utf8');
assert.doesNotMatch(source,/\bupdateCall\s*\(/,'La ficha no puede llamar a una función inexistente al abrirse.');
assert.match(source,/window\.addEventListener\('tpf:contact-open',[\s\S]*?refreshPhoto\(\)/,'La apertura de ficha debe conservar la actualización de foto sin interrumpir los controles.');
console.log('PASS: la ficha abre sin función de llamada inexistente');
