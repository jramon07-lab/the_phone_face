const assert=require('node:assert/strict');
const fs=require('node:fs');
const runtime=fs.readFileSync('js/modules/runtime.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const direct=['contact-label-picker.js','sales-list-ui.js','labels-modern-ui.js','offers-pro.js','contact-desktop-layout.js','contact-summary-accordion.js'];
for(const file of direct){
  assert.match(index,new RegExp(file.replace('.', '\\.')),'El módulo debe tener una carga canónica en index.html: '+file);
  assert.doesNotMatch(runtime,new RegExp("'"+file.replace('.', '\\.')+"'"),'No puede cargarse dos veces desde runtime: '+file);
}
assert.doesNotMatch(runtime,/setTimeout\(\(\)=>\{load\('contact-desktop-layout/,'No debe existir una segunda carga diferida de la ficha.');
console.log('PASS runtime-single-loader.cjs');
