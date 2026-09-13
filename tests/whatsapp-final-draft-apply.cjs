'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('js/modules/whatsapp-final-draft-review.js','utf8');
assert.match(source,/Descargar copia de las listas/,'debe exigir una copia antes de aplicar');
assert.match(source,/backupPrepared/,'la copia debe ser condición para guardar');
assert.match(source,/buildReport\(sourceDraft\)/,'debe volver a comprobar antes de guardar');
assert.match(source,/row\.status==='Listo'/,'solo las filas listas se pueden aplicar');
assert.match(source,/eq\('data',JSON\.stringify\(row\.data\|\|\{\}\)\)/,'cada guardado debe proteger cambios simultáneos');
assert.match(source,/No se unirán contactos/,'la confirmación debe excluir uniones');
assert.match(source,/NOMBRE=final\.first/,'debe guardar nombre separado');
assert.match(source,/APELLIDOS=final\.last/,'debe guardar apellidos separados');

const context={window:{TPFModules:{register(_name,def){def.install()}}},document:{getElementById(){return null},querySelector(){return null}},MutationObserver:class{observe(){}},console};
vm.createContext(context);vm.runInContext(source,context);
assert.deepEqual(JSON.parse(JSON.stringify(context.window.TPFWhatsappFinalDraftReview.splitName('  Ana   López García '))),{first:'Ana',last:'López García'});
assert.deepEqual(JSON.parse(JSON.stringify(context.window.TPFWhatsappFinalDraftReview.splitName('Ana'))),{first:'Ana',last:''});
console.log('PASS WhatsApp draft apply: copia, nueva comprobación, solo listas y guardado protegido');
