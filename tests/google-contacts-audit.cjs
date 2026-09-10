const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('js/modules/google-contacts-audit.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const contacts=fs.readFileSync('js/modules/contacts-list-ui.js','utf8');
const mobile=fs.readFileSync('js/mobile-app.js','utf8');

assert.match(html,/id="googleContactsAuditBtn"/,'debe existir el acceso a la comparación');
assert.match(html,/google-contacts-audit\.js\?v=20260910-readonly-audit-2/,'debe cargar el comparador con versión nueva');
assert.match(source,/padding:14px 0 42px/,'el botón debe quedar separado de la insignia flotante de pruebas');
assert.match(html,/runtime\.js\?v=20260910-google-audit-1/,'debe renovar los módulos de búsqueda');
assert.match(fs.readFileSync('js/modules/runtime.js','utf8'),/contacts-list-ui\.js'\?'20260910-nickname-search-1'/,'debe renovar el buscador de PC');
assert.match(fs.readFileSync('movil/index.html','utf8'),/mobile-app\.js\?v=20260910-nickname-search-1/,'debe renovar el buscador móvil');
assert.match(source,/people\/me\/connections/,'debe leer todos los contactos de Google');
assert.match(source,/nextPageToken/,'debe recorrer todas las páginas de Google');
assert.match(source,/\.range\(from,from\+size-1\)/,'debe recorrer todos los contactos del CRM');
for(const kind of ['match','conflict','crm_only','google_only','duplicate'])assert.match(source,new RegExp(kind));
assert.match(source,/Poner “\$\{google\.name\}” como apodo/,'debe proponer conservar el nombre antiguo como apodo');
assert.doesNotMatch(source,/\.insert\(|\.update\(|\.delete\(|method:\s*['"](?:POST|PATCH|DELETE)/,'la comprobación debe ser estrictamente de solo lectura');
assert.match(contacts,/r\.fullName,r\.nickname,r\.dni/,'el buscador de PC debe incluir el apodo');
assert.match(mobile,/contact\?\.fullName,contact\?\.nickname,contact\?\.dni/,'el buscador móvil debe incluir el apodo');

console.log('PASS Google Contacts: comparación completa de solo lectura y búsqueda por apodo');
