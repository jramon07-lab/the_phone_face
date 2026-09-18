'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=file=>fs.readFileSync(file,'utf8');

const index=read('index.html');
const runtime=read('js/modules/runtime.js');
const sales=read('js/core/20-main.js');
const salesUi=read('js/modules/sales-list-ui.js');
const dateEditor=read('js/modules/sales-list-inline-date.js');
const contacts=read('js/modules/contacts-list-ui.js');
const actions=read('js/modules/contacts-actions-plus.js');
const summary=read('js/modules/contact-desktop-layout.js');

for(const file of [
  'api/google-contacts.js','js/modules/google-contacts-full-sync.js','js/modules/contact-google-inline.js',
  'js/modules/contact-automation-status.js','js/modules/offers-pro.js','js/modules/whatsapp-green-core.js',
  'js/modules/whatsapp-performance-max.js','js/modules/contacts-lock-final.js'
])assert.ok(fs.existsSync(file),`La integración no puede eliminar ${file}`);

assert.match(index,/salesListActionsHead/,'La cabecera de Ventas debe reservar una columna real de acciones.');
assert.match(sales,/class="salesListDateInput"/,'La fecha debe ser un campo editable en Lista.');
assert.match(sales,/class="salesListAction"/,'Los tres puntos deben ocupar una celda de acciones real.');
assert.doesNotMatch(sales,/<div class="salesListRow" onclick=/,'Solo el título debe abrir la oportunidad.');
assert.match(salesUi,/salesListTitle/,'La apertura de oportunidad sigue ligada al título.');
assert.match(dateEditor,/dd\/mm\/aaaa/,'La edición de fecha debe admitir escritura en formato español.');
assert.match(dateEditor,/sales_opportunities/,'La fecha debe guardarse en la oportunidad correcta.');
assert.match(dateEditor,/event\.stopPropagation\(\)/,'Editar la fecha no puede abrir la oportunidad.');
assert.match(contacts,/r\.nickname\?`<span class="tpfContactNickname"/,'El contacto muestra el apodo antes que el correo.');
assert.match(actions,/Enviar oferta/,'El menú de tres puntos de contactos debe permitir enviar oferta.');
assert.match(actions,/Gestionar etiquetas/,'El menú de tres puntos de contactos debe abrir etiquetas.');
assert.match(actions,/Crear oportunidad/,'El menú de tres puntos de contactos debe crear oportunidades.');
assert.match(summary,/makeSummaryGroup\(root,'automation','Automatizaciones'/,'Automatizaciones debe tener su desplegable propio.');
assert.match(summary,/makeSummaryGroup\(root,'offers','Ofertas y seguimiento',\[offers\]\)/,'Ofertas y seguimiento debe quedar separado y cerrado al inicio.');
assert.match(runtime,/contacts-actions-plus\.js/,'El menú ampliado debe cargarse después de los módulos de contactos.');
assert.match(runtime,/sales-list-inline-date\.js/,'El editor de fechas debe cargar en Ventas.');

console.log('Selective 05c integration checks passed');
