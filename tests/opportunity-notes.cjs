'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};vm.runInNewContext(fs.readFileSync('js/modules/opportunity-notes.js','utf8'),context);
const N=context.window.TPFOpportunityNotes,origin='Oferta creada desde el configurador';
for(const value of ['', 'Llamar mañana\nNo borrar la segunda línea.', '  Texto con espacios  ', '<script>alert(1)</script>', 'Oferta creada desde el configurador por Ana']){
 assert.equal(N.split(value).internal,value);assert.equal(N.split(value).origin,'');assert.equal(N.merge(value,N.split(value).internal),value);
}
for(const value of [origin,origin+'.',origin+'\nNota personal',origin+'\n\nNota personal\ncon dos líneas',origin+'\r\n\r\nNota']){
 const parts=N.split(value);assert(parts.origin);assert.equal(N.merge(value,parts.internal),value,'Opening and saving unchanged notes must be lossless');
}
const input={value:'',dataset:{}};N.fill(input,origin+'\n\nLlamar mañana');assert.equal(input.value,'Llamar mañana');assert.equal(N.read(input),origin+'\n\nLlamar mañana');
assert.equal(input.readOnly,true);input.value='Borrado accidental';assert.equal(N.read(input),origin+'\n\nLlamar mañana','Locked notes must not be overwritten');N.restore(input);assert.equal(input.value,'Llamar mañana');N.protect(input,false);
input.value='Nueva anotación\nRespetar saltos';assert.equal(N.read(input),origin+'\n\nNueva anotación\nRespetar saltos');
input.value='';assert.match(N.validate(input),/no se pueden dejar vacías/);N.restore(input);assert.equal(N.read(input),origin+'\n\nLlamar mañana');assert.equal(input.readOnly,true);
N.fill(input,'');N.protect(input,false);input.value='Nota de otra oportunidad';assert.equal(N.read(input),'Nota de otra oportunidad','Switching opportunities clears the old origin');
console.log('PASS: lossless note separation, explicit edits, clear, multiline and switched opportunities.');
