const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('js/modules/whatsapp-programs-pro.js','utf8');
const html=fs.readFileSync('index.html','utf8');

assert.match(html,/id="waNewProgram"/,'debe existir un acceso compacto para crear mensajes');
assert.match(html,/id="waProgramsBack"[\s\S]*← Volver/,'debe permitir volver a las conversaciones');
assert.match(source,/openAppView\('whatsapplive'\)/,'volver debe abrir WhatsApp');
assert.match(html,/wapHeaderActions[\s\S]*ccLaunch[\s\S]*Control de envíos/,'el control de envíos debe estar visible en la cabecera');
assert.match(html,/id="wapKpiDue"/,'debe mostrar mensajes listos para enviar');
assert.match(html,/data-wap-filter="paused"/,'debe filtrar los envíos pausados');
assert.match(html,/id="wapPagination"/,'debe paginar la lista');
assert.match(source,/const PAGE_SIZE=20/,'debe limitar cada página a 20 registros');
assert.match(source,/className='wapMenuTrigger'/,'debe compactar las acciones en un botón de menú');
assert.match(source,/className='wapMenuPortal'/,'el menú debe mostrarse fuera de la tabla para evitar recortes');
assert.match(source,/position:fixed;z-index:250000/,'el menú debe permanecer visible sobre el contenedor desplazable');
assert.match(source,/Ver mensaje completo/,'el menú debe permitir revisar el mensaje');
assert.match(source,/getBoundingClientRect/,'el menú debe colocarse junto al botón pulsado');
assert.match(html,/whatsapp-programs-pro\.js\?v=20260910-actions-menu-1/,'debe invalidar la versión anterior del menú');
assert.match(source,/openDetail/,'debe permitir consultar el mensaje completo');
assert.match(source,/wapComposer.*hidden/,'el formulario debe estar plegado inicialmente');
assert.match(source,/window\.loadWhatsappPrograms/,'debe reutilizar la carga de datos existente');
assert.doesNotMatch(source,/\.delete\(/,'la mejora visual no debe borrar registros');

console.log('PASS WhatsApp programados profesional: resumen, filtros, detalle y paginación');
