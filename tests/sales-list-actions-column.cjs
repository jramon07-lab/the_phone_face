const assert=require('assert');
const fs=require('fs');

const index=fs.readFileSync('index.html','utf8');
const main=fs.readFileSync('js/core/20-main.js','utf8');
const styles=fs.readFileSync('js/modules/contacts-sales.js','utf8');
const ui=fs.readFileSync('js/modules/sales-list-ui.js','utf8');

assert.match(index,/salesListActionsHead/,'La cabecera de Lista debe reservar la columna de acciones.');
assert.match(main,/class="salesListAction"><button type="button" class="tpfListMenuBtn"/,'Cada fila de Lista debe crear sus acciones como una celda real.');
assert.match(main,/>•••<\/button>/,'El menú de acciones debe ser visible en cada oportunidad.');
assert.match(styles,/minmax\(270px,1\.65fr\).*150px 44px!important/,'La cuadrícula debe conservar espacio para Fecha y acciones.');
assert.match(styles,/\.salesListAction\{display:flex!important/,'La celda de acciones no puede quedar oculta.');
assert.match(ui,/__tpfSalesListUiLoaded/,'La lista no debe instalarse dos veces.');

console.log('PASS sales-list-actions-column.cjs');
