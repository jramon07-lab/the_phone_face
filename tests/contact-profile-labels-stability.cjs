'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');

const profile=fs.readFileSync('js/modules/contact-profile.js','utf8');
assert.doesNotMatch(profile,/syncContactLabelSelection/,'El selector no debe reconstruirse desde su propio observador.');
assert.doesNotMatch(profile,/tpfContactLabelsSelected/,'La ficha no debe crear chips dinámicos dentro del modal de etiquetas.');
assert.match(profile,/choices\.addEventListener\('change',e=>\{if\(e\.target\.matches\('input\[type="checkbox"\]'\)\)filterContactLabels\(\);\}\);/);

const green=fs.readFileSync('api/green.js','utf8');
assert.match(green,/if \(!\/\^\\d\{10,15\}@c\\\.us\$\/\.test\(chatId\)\)/,'Los avatares inválidos deben cortarse antes de GREEN-API.');

console.log('PASS contact-profile-labels-stability.cjs');
