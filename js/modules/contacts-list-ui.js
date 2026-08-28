(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
function ensureContactsToolbar(){
 const view=$('view-database'); if(!view||$('tpfContactsToolbar'))return;
 const host=view.querySelector('.pageTitle')||view.firstElementChild||view;
 const bar=document.createElement('div');
 bar.id='tpfContactsToolbar';bar.className='tpfContactsToolbar';
 bar.innerHTML=`<div class="tpfContactsSearch"><input id="tpfContactsSearch" placeholder="Buscar por nombre, DNI o teléfono"></div><button id="tpfContactsFilters" class="secondary">Filtros</button><button id="tpfContactsExport" class="secondary">Exportar</button><button id="tpfContactsAdd" class="primary">+ Agregar contacto</button><div id="tpfContactsFilterPanel" class="tpfContactsFilterPanel hidden"><label>Nombre y apellidos<input id="tpfFilterName"></label><label>DNI<input id="tpfFilterDni"></label><label>Teléfono<input id="tpfFilterPhone"></label><label>Origen<input id="tpfFilterSource"></label><label>Etiquetas<input id="tpfFilterLabels" placeholder="Filtrar por etiqueta"></label><button id="tpfContactsClearFilters" class="secondary">Limpiar filtros</button></div>`;
 host.insertAdjacentElement('afterend',bar);
 $('tpfContactsFilters').onclick=()=>$('tpfContactsFilterPanel').classList.toggle('hidden');
 $('tpfContactsAdd').onclick=()=>{const b=$('newContact')||$('databaseNew')||$('addContact');if(b)b.click();};
 $('tpfContactsExport').onclick=()=>{const b=$('exportDatabaseExcel')||$('databaseExport')||$('exportFullSheetExcel');if(b)b.click();};
 $('tpfContactsClearFilters').onclick=()=>['tpfContactsSearch','tpfFilterName','tpfFilterDni','tpfFilterPhone','tpfFilterSource','tpfFilterLabels'].forEach(id=>{if($(id))$(id).value='';});
}
M.register('contacts-list-ui',{install(){ensureContactsToolbar();document.addEventListener('click',e=>{if(e.target?.closest?.('.nav[data-view="database"]'))setTimeout(ensureContactsToolbar,0);});}});
})();
