const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/modules/google-contacts-audit.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const contacts=fs.readFileSync('js/modules/contacts-list-ui.js','utf8');
const mobile=fs.readFileSync('js/mobile-app.js','utf8');

assert.match(html,/id="googleContactsAuditBtn"/,'debe existir el acceso a la comparación');
assert.match(html,/google-contacts-audit\.js\?v=20260911-duplicate-detail-1/,'debe cargar el comparador con versión nueva');
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
assert.match(source,/sessionStorage\.setItem\(REVIEW_KEY/,'las decisiones deben guardarse solo en la sesión local');
assert.match(source,/Elegir datos/,'los datos diferentes deben permitir elegir manualmente');
assert.doesNotMatch(source,/Marcar para aprobar/,'los datos diferentes no deben aprobar una propuesta sin elegir los campos');
assert.match(source,/Marcar para crear/,'los contactos solo CRM deben poder prepararse para crear');
assert.match(source,/Ver comparación/,'debe mostrar el detalle antes de decidir');
assert.match(source,/Ignorar/,'debe permitir ignorar una propuesta');
assert.match(source,/function duplicateInfo/,'debe conservar todas las coincidencias relacionadas');
assert.match(source,/gcaDuplicateRows/,'el detalle debe listar todos los registros relacionados');
assert.match(source,/registros en CRM/,'debe explicar qué dato provoca la duplicidad');
assert.match(source,/Confirmar duplicado/,'debe permitir confirmar el duplicado localmente');
assert.match(source,/No es duplicado/,'debe permitir descartar un falso positivo localmente');
assert.doesNotMatch(source,/Aplicar cambios/,'esta fase no debe ofrecer aplicar cambios reales');
assert.match(source,/body\.querySelectorAll\('\[data-gca-action\]'\)/,'cada acción visible debe enlazarse directamente después de dibujar la tabla');
assert.match(source,/\.gcaModal #gcaContent\{flex:1 1 auto;min-height:0;overflow:hidden;display:flex/,'el contenido debe caber dentro del modal');
assert.match(source,/\.gcaTableWrap\{flex:1 1 auto;min-height:0;overflow:auto/,'la tabla debe permitir desplazamiento vertical y horizontal');
assert.match(source,/Array\.isArray\(raw\)/,'el detalle debe distinguir listas de valores simples como el nombre');
assert.doesNotMatch(source,/contact\?\.\[key\]\?\.length\?contact\[key\]\.join/,'el detalle no debe intentar unir un nombre como si fuera una lista');
assert.match(source,/Guardar elección sin aplicar/,'debe guardar una elección local explícita');
assert.match(source,/data-gca-choice/,'debe permitir editar manualmente cada valor final');
assert.match(source,/data-gca-pick/,'debe permitir escoger rápidamente el valor del CRM o Google');
assert.match(source,/first\(data,'DNI \/ NIF','DNI','NIF'\)/,'debe cargar el DNI o NIF del CRM');
assert.match(source,/personFields:'names,nicknames,emailAddresses,phoneNumbers,userDefined,metadata'/,'debe leer campos personalizados de Google');
assert.match(source,/documento de identidad/,'debe reconocer el DNI guardado como campo personalizado de Google');
assert.match(source,/\['DNI \/ NIF final','dni'\]/,'debe permitir revisar manualmente el DNI');
assert.match(source,/Buscar nombre, apodo, DNI o teléfono/,'debe permitir buscar por DNI');
assert.match(contacts,/r\.fullName,r\.nickname,r\.dni/,'el buscador de PC debe incluir el apodo');
assert.match(mobile,/contact\?\.fullName,contact\?\.nickname,contact\?\.dni/,'el buscador móvil debe incluir el apodo');

const elements={googleContactsAuditBtn:{}};
const context={
 window:{TPFModules:{register(_name,module){module.install()}}},
 document:{readyState:'complete',head:{appendChild(element){elements[element.id]=element}},getElementById(id){return elements[id]||null},createElement(){return{id:'',textContent:''}}},
 sessionStorage:{getItem(){return null},setItem(){}},
 URLSearchParams,Date,Map,Set,JSON,String,Array,Object,RegExp,Number,Math
};
vm.createContext(context);vm.runInContext(source,context);
const compare=context.window.TPFGoogleContactsAudit.compare;
const crm=[
 {id:'c1',name:'Mari Mari',nickname:'',dni:'',phones:['600026443'],emails:[]},
 {id:'c2',name:'María duplicada',nickname:'',dni:'',phones:['600026443'],emails:[]}
];
const google=[{id:'g1',name:'Mari Mari',nickname:'',dni:'',phones:['600026443'],emails:[]}];
const duplicateRows=compare(crm,google);
assert.equal(duplicateRows.length,1,'un mismo grupo duplicado debe aparecer una sola vez');
assert.equal(duplicateRows[0].kind,'duplicate');
assert.equal(duplicateRows[0].duplicates.crm.length,2,'debe conservar todos los candidatos del CRM');
assert.equal(duplicateRows[0].duplicates.google.length,1,'debe conservar todos los candidatos de Google');
assert.match(duplicateRows[0].duplicates.reasons[0],/Teléfono 600026443: 2 registros en CRM/,'debe explicar el origen exacto del duplicado');

console.log('PASS Google Contacts: comparación completa de solo lectura y búsqueda por apodo');
