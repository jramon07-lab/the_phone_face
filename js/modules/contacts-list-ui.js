(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const byId=id=>document.getElementById(id);
const safe=v=>String(v??'');
const esc=v=>safe(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>safe(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const digits=v=>safe(v).replace(/\D/g,'');
function localSpanishPhone(value){
 const raw=safe(value).trim(),numeric=raw.replace(/\D/g,'');
 const local=numeric.startsWith('0034')?numeric.slice(4):numeric.startsWith('34')?numeric.slice(2):'';
 return /^[6789]\d{8}$/.test(local)?local:raw;
}
const SOURCES=['BASE DE DATOS','DATA','CONTACTOS'];
const PAGE_SIZES=[10,25,50,100];
const state={rows:[],filtered:[],selected:new Set(),labels:[],labelsByContact:new Map(),labelsAllLoaded:false,labelsLoadPromise:null,page:1,pageSize:25,loading:false,editingId:'',filters:{q:'',name:'',dni:'',phone:'',source:'',label:''}};

function allowed(permission){
  try{return typeof perms==='undefined'||!!perms?.is_admin||!!perms?.[permission];}catch(_){return true;}
}
function field(d,...names){for(const n of names){const v=d?.[n];if(v!==undefined&&v!==null&&safe(v).trim()!=='')return v;}return '';}
function splitFullName(value){const s=safe(value).trim().replace(/\s+/g,' ');if(!s)return {first:'',last:''};const p=s.split(' ');return {first:p.shift()||'',last:p.join(' ')};}
function mapRecord(r){
  const d=r?.data||{};
  let first=safe(field(d,'NOMBRE')).trim();
  let last=safe(field(d,'APELLIDOS','APELLIDO')).trim();
  const legacy=safe(field(d,'NOMBRE Y APELLIDOS','CLIENTE','CLIENTE FINAL')).trim();
  if(!first&&!last&&legacy){const x=splitFullName(legacy);first=x.first;last=x.last;}
  const fullName=[first,last].filter(Boolean).join(' ').trim()||legacy||'Contacto';
  return {
    id:safe(r.id),source:safe(r.source_sheet||'BASE DE DATOS'),sourceRow:r.source_row??'',createdAt:r.created_at||'',updatedAt:r.updated_at||'',data:d,
    first,last,fullName,nickname:safe(field(d,'APODO','Apodo','ALIAS')).trim(),
    phone:safe(field(d,'TELÉFONO','TELEFONO','PHONE','MOVIL')).trim(),
    dni:safe(field(d,'DNI / NIF','DNI','NIF')).trim(),
    email:safe(field(d,'EMAIL','Email','email')).trim(),
    bank:safe(field(d,'BANCO','Banco','bank')).trim(),
    notes:safe(field(d,'NOTAS','NOTES')).trim(),
    observations:safe(field(d,'OBSERVACIONES','OBSERVACION','Observaciones')).trim()
  };
}
function initials(r){return (safe(r.first).charAt(0)+safe(r.last||r.fullName.split(' ').slice(1).join(' ')).charAt(0)).toUpperCase()||'C';}
function labelColor(i){return ['blue','green','purple','orange','pink','teal'][i%6];}
function labelName(x){return safe(x?.name||x?.label_name||x?.label||'Etiqueta');}
function labelId(x){return safe(x?.id||x?.label_id||x?.value||'');}

function ensureStyles(){
 if(byId('tpfContactsListStyles'))return;
 const s=document.createElement('style');s.id='tpfContactsListStyles';s.textContent=`
 #view-database.tpfContactsEnhanced{padding:0!important;background:#f5f7fb!important;min-height:calc(100vh - 74px)}
 #view-database.tpfContactsEnhanced>.card.tpfContactsLegacy{display:none!important}
 .tpfContactsApp{padding:22px;max-width:1680px;margin:0 auto;color:#172033}
 .tpfContactsHeader{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:16px}
 .tpfContactsTitle h2{margin:0;font-size:30px;line-height:1.1;color:#14213d}.tpfContactsTitle p{margin:6px 0 0;color:#6b7280;font-size:13px}
 .tpfContactsHeaderActions{display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end}.tpfContactsHeaderActions button{min-height:40px;border-radius:9px}
 .tpfContactsPrimary{background:#0f9f91!important;border-color:#0f9f91!important;color:#fff!important}.tpfContactsPrimary:hover{background:#0b867b!important}
 .tpfContactsStats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}.tpfContactsStat{background:#fff;border:1px solid #e4e8f0;border-radius:12px;padding:13px 15px;box-shadow:0 3px 12px #1720330a}.tpfContactsStat span{display:block;color:#7a8496;font-size:11px;text-transform:uppercase;letter-spacing:.05em}.tpfContactsStat b{display:block;font-size:24px;margin-top:3px;color:#16213a}
 .tpfContactsToolbar{display:flex;gap:9px;align-items:center;background:#fff;border:1px solid #e4e8f0;border-radius:12px;padding:11px 12px;margin-bottom:14px;box-shadow:0 3px 12px #1720330a;position:relative}.tpfContactsSearch{flex:1;min-width:220px;position:relative}.tpfContactsSearch:before{content:'⌕';position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#8690a2;font-size:19px}.tpfContactsSearch input{width:100%;height:40px;padding-left:38px!important;border-radius:9px!important;background:#f9fafc!important}.tpfContactsToolbar button{height:40px;border-radius:9px;white-space:nowrap}
 .tpfContactsExportWrap{position:relative}.tpfContactsExportMenu{position:absolute;right:0;top:46px;width:245px;background:#fff;border:1px solid #dfe4ec;border-radius:10px;padding:7px;box-shadow:0 16px 36px #1720332b;z-index:60}.tpfContactsExportMenu button{width:100%;height:auto!important;padding:10px 11px!important;text-align:left;background:transparent!important;border:0!important;color:#263248!important;display:block}.tpfContactsExportMenu button:hover{background:#f1f5f9!important}.tpfContactsExportMenu button:disabled{opacity:.45}
 .tpfContactsBody{display:grid;grid-template-columns:250px minmax(0,1fr);gap:14px;align-items:start}.tpfContactsFilters{background:#fff;border:1px solid #e4e8f0;border-radius:12px;padding:15px;box-shadow:0 3px 12px #1720330a;position:sticky;top:12px}.tpfContactsFiltersHead{display:flex;align-items:center;justify-content:space-between;margin-bottom:11px}.tpfContactsFiltersHead b{font-size:14px}.tpfContactsFilters label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#6f7a8e;margin:0 0 11px}.tpfContactsFilters input,.tpfContactsFilters select{display:block;width:100%;height:39px;margin-top:5px;border-radius:8px!important;font-size:13px}.tpfContactsFilters .tpfClear{width:100%;margin-top:3px}.tpfContactsMobileClose{display:none!important}
 .tpfContactsContent{min-width:0}.tpfContactsBulk{display:none;align-items:center;gap:9px;background:#e8f7f5;border:1px solid #bce6e1;border-radius:10px;padding:9px 11px;margin-bottom:10px}.tpfContactsBulk.show{display:flex}.tpfContactsBulk .spacer{flex:1}
 .tpfContactsTableCard{background:#fff;border:1px solid #e4e8f0;border-radius:12px;box-shadow:0 3px 12px #1720330a;overflow:hidden}.tpfContactsTableScroll{overflow:auto;max-height:calc(100vh - 330px);min-height:310px}.tpfContactsTable{width:100%;border-collapse:collapse;min-width:900px}.tpfContactsTable thead{position:sticky;top:0;z-index:4;background:#f8fafc}.tpfContactsTable th{padding:11px 12px;border-bottom:1px solid #e2e7ef;color:#6c778b;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap}.tpfContactsTable td{padding:10px 12px;border-bottom:1px solid #edf0f5;font-size:13px;vertical-align:middle}.tpfContactsTable tbody tr:hover{background:#f8fbfd}.tpfContactsTable tbody tr.selected{background:#edf9f7}.tpfContactsTable input[type=checkbox]{width:16px;height:16px}.tpfContactIdentity{display:flex;align-items:center;gap:10px;min-width:230px}.tpfContactAvatar{width:35px;height:35px;border-radius:50%;display:grid;place-items:center;background:#e8eef9;color:#315a9c;font-weight:800;font-size:12px;flex:0 0 auto}.tpfContactNameBtn{border:0!important;background:transparent!important;padding:0!important;text-align:left;color:#172033!important;font-weight:700;display:block;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tpfContactNameBtn:hover{text-decoration:underline}.tpfContactEmail{display:block;color:#7d8798;font-size:11px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tpfContactPencil{border:0!important;background:transparent!important;padding:5px!important;min-width:0!important;color:#7a8496!important}.tpfContactPencil:hover{background:#eaf0f7!important}.tpfSourceBadge{display:inline-block;padding:4px 8px;border-radius:999px;background:#f0f3f8;color:#556176;font-size:11px;white-space:nowrap}.tpfLabelChip{display:inline-block;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700;margin:1px 3px 1px 0;white-space:nowrap}.tpfLabelChip.blue{background:#e7f0ff;color:#2762ad}.tpfLabelChip.green{background:#e3f7ec;color:#18834c}.tpfLabelChip.purple{background:#f0e8ff;color:#7545b8}.tpfLabelChip.orange{background:#fff0df;color:#b66519}.tpfLabelChip.pink{background:#fde8f2;color:#b13d75}.tpfLabelChip.teal{background:#def5f2;color:#117b70}.tpfContactActions{display:flex;gap:5px;align-items:center;justify-content:flex-end}.tpfContactActions button{width:34px;height:34px;min-width:34px;padding:0!important;border-radius:8px!important;background:#fff!important;border:1px solid #dde3ec!important;color:#526078!important}.tpfContactActions button:hover{background:#eef5f7!important;color:#0d857a!important;border-color:#a7d7d1!important}
 .tpfContactsEmpty{padding:55px 20px;text-align:center;color:#788397}.tpfContactsLoading{padding:55px 20px;text-align:center;color:#617087}.tpfContactsPager{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 13px;background:#fbfcfe;border-top:1px solid #e6eaf0;color:#6e788a;font-size:12px}.tpfContactsPagerControls{display:flex;align-items:center;gap:7px}.tpfContactsPager select{width:auto;height:33px}.tpfContactsPager button{width:34px;height:33px;padding:0!important;min-width:34px}.tpfContactsCards{display:none}
 .tpfContactsToast{position:fixed;right:18px;bottom:18px;z-index:95000;max-width:380px;background:#17233d;color:#fff;padding:12px 15px;border-radius:10px;box-shadow:0 18px 44px #0004;font-size:13px}.tpfContactsToast.error{background:#9b2737}
 .tpfContactsModalBack{position:fixed;inset:0;z-index:90000;background:#0c1628a6;display:grid;place-items:center;padding:18px}.tpfContactsModal{width:min(760px,100%);max-height:92vh;background:#fff;border-radius:15px;box-shadow:0 25px 70px #0005;overflow:hidden;display:flex;flex-direction:column}.tpfContactsModalHead{display:flex;align-items:center;justify-content:space-between;padding:17px 19px;border-bottom:1px solid #e4e8ef}.tpfContactsModalHead h3{margin:0}.tpfContactsModalBody{padding:18px 19px;overflow:auto}.tpfContactsFormGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.tpfContactsFormGrid label{font-size:11px;font-weight:700;text-transform:uppercase;color:#6c778a}.tpfContactsFormGrid input,.tpfContactsFormGrid textarea{display:block;width:100%;margin-top:5px}.tpfContactsFormGrid .full{grid-column:1/-1}.tpfContactsLabelChoices{display:flex;gap:7px;flex-wrap:wrap;margin-top:7px}.tpfContactsLabelChoice{display:flex!important;align-items:center;gap:5px;background:#f3f6fa;border:1px solid #e0e5ed;border-radius:999px;padding:6px 9px;font-size:12px!important;text-transform:none!important}.tpfContactsLabelChoice input{width:auto!important;margin:0!important}.tpfContactsModalActions{display:flex;justify-content:flex-end;gap:9px;padding:13px 19px;border-top:1px solid #e4e8ef}.tpfContactsModalMsg{min-height:20px;margin-top:8px;color:#a12c3b;font-size:12px}
 @media(max-width:900px){.tpfContactsApp{padding:14px}.tpfContactsStats{grid-template-columns:repeat(2,minmax(0,1fr))}.tpfContactsBody{grid-template-columns:1fr}.tpfContactsFilters{position:fixed;left:10px;right:10px;top:78px;z-index:80000;max-height:calc(100vh - 95px);overflow:auto;display:none;box-shadow:0 22px 65px #0005}.tpfContactsFilters.open{display:block}.tpfContactsMobileClose{display:inline-flex!important}.tpfContactsTableScroll{max-height:none}}
 @media(max-width:720px){#view-database.tpfContactsEnhanced{min-height:100vh}.tpfContactsHeader{align-items:center}.tpfContactsTitle h2{font-size:24px}.tpfContactsHeaderActions .desktopOnly{display:none}.tpfContactsToolbar{flex-wrap:wrap}.tpfContactsSearch{flex-basis:100%;min-width:100%}.tpfContactsToolbar button{flex:1}.tpfContactsStats{grid-template-columns:repeat(2,minmax(0,1fr))}.tpfContactsStat b{font-size:20px}.tpfContactsTableCard{border-radius:10px}.tpfContactsTableScroll{display:none}.tpfContactsCards{display:block}.tpfContactCard{padding:13px;border-bottom:1px solid #e6eaf0}.tpfContactCard:last-child{border-bottom:0}.tpfContactCardTop{display:flex;gap:10px;align-items:flex-start}.tpfContactCardMain{min-width:0;flex:1}.tpfContactCardName{display:flex;gap:5px;align-items:center}.tpfContactCardMeta{display:grid;gap:3px;color:#697489;font-size:12px;margin:7px 0}.tpfContactCardLabels{margin:6px 0}.tpfContactCardActions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.tpfContactCardActions button{height:39px;border-radius:8px}.tpfContactsPager{flex-wrap:wrap}.tpfContactsFormGrid{grid-template-columns:1fr}.tpfContactsModalBack{padding:8px}.tpfContactsModal{max-height:98vh;border-radius:12px}.tpfContactsModalActions{position:sticky;bottom:0;background:#fff}}
 `;document.head.appendChild(s);
}

function showToast(message,error=false){
 let box=byId('tpfContactsToast');if(!box){box=document.createElement('div');box.id='tpfContactsToast';box.className='tpfContactsToast';document.body.appendChild(box);}box.textContent=message;box.classList.toggle('error',!!error);box.style.display='block';clearTimeout(window.__tpfContactsToast);window.__tpfContactsToast=setTimeout(()=>{box.style.display='none';},3600);
}
function setStatus(text,error=false){const el=byId('tpfContactsStatus');if(el){el.textContent=text||'';el.style.color=error?'#a12c3b':'';}}

function buildUi(){
 const view=byId('view-database');if(!view||byId('tpfContactsApp'))return;
 ensureStyles();view.classList.add('tpfContactsEnhanced');
 const legacy=[...view.children].find(x=>x.classList?.contains('card'));if(legacy)legacy.classList.add('tpfContactsLegacy');
 const app=document.createElement('div');app.id='tpfContactsApp';app.className='tpfContactsApp';app.innerHTML=`
  <div class="tpfContactsHeader">
   <div class="tpfContactsTitle"><h2>Contactos</h2><p>Gestiona clientes, datos, etiquetas y comunicaciones desde un único lugar.</p></div>
   <div class="tpfContactsHeaderActions"><button id="tpfContactsFields" class="secondary desktopOnly">⚙ Campos</button><button id="tpfContactsRefresh" class="secondary">↻ Actualizar</button><button id="tpfContactsAdd" class="primary tpfContactsPrimary">＋ Agregar contacto</button></div>
  </div>
  <div class="tpfContactsStats"><div class="tpfContactsStat"><span>Total contactos</span><b id="tpfContactsTotal">—</b></div><div class="tpfContactsStat"><span>Con teléfono</span><b id="tpfContactsWithPhone">—</b></div><div class="tpfContactsStat"><span>Con DNI</span><b id="tpfContactsWithDni">—</b></div><div class="tpfContactsStat"><span>Etiquetas</span><b id="tpfContactsLabelsCount">—</b></div></div>
  <div class="tpfContactsToolbar"><div class="tpfContactsSearch"><input id="tpfContactsSearch" placeholder="Buscar por nombre, DNI o teléfono"></div><button id="tpfContactsFiltersToggle" class="secondary">☷ Filtros</button><div class="tpfContactsExportWrap"><button id="tpfContactsExport" class="secondary">⇩ Exportar</button><div id="tpfContactsExportMenu" class="tpfContactsExportMenu hidden"><button data-export="all">Todos los contactos</button><button data-export="filtered">Contactos filtrados</button><button data-export="selected" id="tpfExportSelected">Contactos seleccionados</button></div></div><span id="tpfContactsStatus" class="small"></span></div>
  <div class="tpfContactsBody">
   <aside id="tpfContactsFilters" class="tpfContactsFilters"><div class="tpfContactsFiltersHead"><b>Filtros</b><button id="tpfContactsFiltersClose" class="secondary tpfContactsMobileClose">Cerrar</button></div><label>Nombre y apellidos<input id="tpfFilterName"></label><label>DNI<input id="tpfFilterDni"></label><label>Teléfono<input id="tpfFilterPhone"></label><label>Origen<select id="tpfFilterSource"><option value="">Todos</option></select></label><label>Etiquetas<select id="tpfFilterLabel"><option value="">Todas</option></select></label><button id="tpfContactsClearFilters" class="secondary tpfClear">Limpiar filtros</button></aside>
   <div class="tpfContactsContent"><div id="tpfContactsBulk" class="tpfContactsBulk"><b id="tpfContactsSelectedCount">0 seleccionados</b><button id="tpfBulkExport" class="secondary">Exportar selección</button><span class="spacer"></span><button id="tpfBulkClear" class="secondary">Quitar selección</button></div><div class="tpfContactsTableCard"><div class="tpfContactsTableScroll"><table class="tpfContactsTable"><thead><tr><th><input id="tpfSelectPage" type="checkbox" aria-label="Seleccionar página"></th><th>Nombre y apellidos</th><th>DNI</th><th>Teléfono</th><th>Origen</th><th>Etiquetas</th><th style="text-align:right">Acciones</th></tr></thead><tbody id="tpfContactsRows"></tbody></table></div><div id="tpfContactsCards" class="tpfContactsCards"></div><div id="tpfContactsEmpty" class="tpfContactsEmpty hidden">No hay contactos que coincidan con los filtros.</div><div id="tpfContactsLoading" class="tpfContactsLoading">Cargando contactos…</div><div class="tpfContactsPager"><div><span id="tpfContactsRange">—</span></div><div class="tpfContactsPagerControls"><span>Filas</span><select id="tpfContactsPageSize">${PAGE_SIZES.map(n=>`<option value="${n}" ${n===25?'selected':''}>${n}</option>`).join('')}</select><button id="tpfContactsPrev" class="secondary">‹</button><b id="tpfContactsPageInfo">1 / 1</b><button id="tpfContactsNext" class="secondary">›</button></div></div></div></div>
  </div>`;
 view.prepend(app);buildCreateModal();bindUi();
}

function buildCreateModal(){
 if(byId('tpfContactsCreateBack'))return;
 const back=document.createElement('div');back.id='tpfContactsCreateBack';back.className='tpfContactsModalBack hidden';back.innerHTML=`<div class="tpfContactsModal"><div class="tpfContactsModalHead"><div><h3>Agregar contacto</h3><div class="small">Crea el contacto con todos sus datos principales.</div></div><button id="tpfContactsCreateClose" class="secondary">← Volver</button></div><div class="tpfContactsModalBody"><div class="tpfContactsFormGrid"><label>Nombre<input id="tpfCreateFirst"></label><label>Apellidos<input id="tpfCreateLast"></label><label>Apodo<input id="tpfCreateNickname" placeholder="Cómo quieres identificarlo"></label><label>Teléfono<input id="tpfCreatePhone" inputmode="tel" autocomplete="tel-national"></label><label>DNI / NIF<input id="tpfCreateDni"></label><label>Correo electrónico<input id="tpfCreateEmail" type="email"></label><label class="full">Banco / IBAN<input id="tpfCreateBank" maxlength="34" placeholder="ES00 0000 0000 0000 0000 0000"></label><label class="full">Notas<textarea id="tpfCreateNotes" rows="3"></textarea></label><label class="full">Observaciones<textarea id="tpfCreateObs" rows="3"></textarea></label><label class="full">Etiquetas<div id="tpfCreateLabels" class="tpfContactsLabelChoices"><span class="small">Cargando etiquetas…</span></div></label></div><div id="tpfContactsCreateMsg" class="tpfContactsModalMsg"></div></div><div class="tpfContactsModalActions"><button id="tpfContactsCreateCancel" class="secondary">Cancelar</button><button id="tpfContactsCreateSave" class="primary tpfContactsPrimary">Crear contacto</button></div></div>`;document.body.appendChild(back);
}

function bindUi(){
 document.addEventListener('click',e=>{const pencil=e.target.closest?.('.tpfContactPencil');if(!pencil)return;const r=rowById(pencil.dataset.id||pencil.closest('[data-contact-id]')?.dataset.contactId);if(!r)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openEdit(r);},true);
 byId('tpfContactsSearch').addEventListener('input',e=>{state.filters.q=e.target.value;state.page=1;applyAndRender();});
 [['tpfFilterName','name'],['tpfFilterDni','dni'],['tpfFilterPhone','phone']].forEach(([id,key])=>byId(id).addEventListener('input',e=>{state.filters[key]=e.target.value;state.page=1;applyAndRender();}));
 byId('tpfFilterSource').addEventListener('change',e=>{state.filters.source=e.target.value;state.page=1;applyAndRender();});
 byId('tpfFilterLabel').addEventListener('change',async e=>{state.filters.label=e.target.value;state.page=1;if(e.target.value&&!state.labelsAllLoaded){setStatus('Cargando etiquetas de contactos…');await loadAllContactLabels();setStatus('');}applyAndRender();});
 byId('tpfContactsRefresh').onclick=()=>loadContacts(true);
 byId('tpfContactsFields').onclick=()=>byId('customFieldsManageBtn')?.click();
 byId('tpfContactsAdd').onclick=openCreate;
 byId('tpfContactsFiltersToggle').onclick=()=>byId('tpfContactsFilters').classList.toggle('open');
 byId('tpfContactsFiltersClose').onclick=()=>byId('tpfContactsFilters').classList.remove('open');
 byId('tpfContactsClearFilters').onclick=clearFilters;
 byId('tpfContactsExport').onclick=e=>{e.stopPropagation();byId('tpfContactsExportMenu').classList.toggle('hidden');};
 byId('tpfContactsExportMenu').addEventListener('click',e=>{const b=e.target.closest('[data-export]');if(b)exportContacts(b.dataset.export);});
 byId('tpfBulkExport').onclick=()=>exportContacts('selected');byId('tpfBulkClear').onclick=()=>{state.selected.clear();renderList();};
 byId('tpfContactsPageSize').onchange=e=>{state.pageSize=Number(e.target.value)||25;state.page=1;renderList();};
 byId('tpfContactsPrev').onclick=()=>{if(state.page>1){state.page--;renderList();}};byId('tpfContactsNext').onclick=()=>{const pages=Math.max(1,Math.ceil(state.filtered.length/state.pageSize));if(state.page<pages){state.page++;renderList();}};
 byId('tpfSelectPage').onchange=e=>selectCurrentPage(e.target.checked);
 byId('tpfContactsRows').addEventListener('click',handleListAction);byId('tpfContactsRows').addEventListener('change',handleSelectionChange);byId('tpfContactsCards').addEventListener('click',handleListAction);byId('tpfContactsCards').addEventListener('change',handleSelectionChange);
 document.addEventListener('click',e=>{if(!e.target.closest('.tpfContactsExportWrap'))byId('tpfContactsExportMenu')?.classList.add('hidden');const nav=e.target.closest?.('.nav[data-view="database"]');if(nav)setTimeout(()=>{buildUi();loadContacts(false);},40);if(e.target.closest?.('#contactSave,#contactDelete,#dbSave'))setTimeout(()=>loadContacts(true),1200);},true);
 byId('tpfContactsCreateClose').onclick=closeCreate;byId('tpfContactsCreateCancel').onclick=closeCreate;byId('tpfContactsCreateBack').addEventListener('click',e=>{if(e.target===byId('tpfContactsCreateBack'))closeCreate();});byId('tpfContactsCreateSave').onclick=createContact;
 byId('tpfCreatePhone').addEventListener('change',e=>{e.target.value=localSpanishPhone(e.target.value);});
}

async function fetchAllContacts(){
 const out=[],size=1000;let extended=true;
 for(let from=0;;from+=size){
  let q=sb.from('records').select(extended?'id,source_sheet,source_row,data,created_at,updated_at':'id,source_sheet,source_row,data').in('source_sheet',SOURCES).range(from,from+size-1);
 let res=await q;if(res.error&&extended){extended=false;from-=size;continue;}if(res.error)throw res.error;const chunk=res.data||[];out.push(...chunk);if(chunk.length<size)break;
  if(from>0&&from%10000===0)await new Promise(resolve=>setTimeout(resolve,0));
 }
 return out.map(mapRecord).sort((a,b)=>safe(b.updatedAt||b.createdAt).localeCompare(safe(a.updatedAt||a.createdAt))||a.fullName.localeCompare(b.fullName,'es'));
}
async function loadGlobalLabels(){
 try{let rows;if(typeof window.crmLoadLabels==='function')rows=await window.crmLoadLabels();else if(typeof crmLoadLabels==='function')rows=await crmLoadLabels();else{const r=await sb.rpc('crm_list_labels');if(r.error)throw r.error;rows=r.data;}state.labels=Array.isArray(rows)?rows:[];}catch(e){state.labels=[];console.warn('Etiquetas contactos',e);}renderLabelOptions();return state.labels;
}
async function getContactLabels(id){
 if(state.labelsByContact.has(id))return state.labelsByContact.get(id);let rows=[];try{if(typeof window.crmGetContactLabels==='function')rows=await window.crmGetContactLabels(id);else if(typeof crmGetContactLabels==='function')rows=await crmGetContactLabels(id);else{const r=await sb.rpc('crm_get_contact_labels',{p_contact_id:id});if(r.error)throw r.error;rows=r.data;}rows=Array.isArray(rows)?rows:[];}catch(e){rows=[];}state.labelsByContact.set(id,rows);return rows;
}
async function loadContacts(force=false){
 if(state.loading)return;if(!force&&state.rows.length){applyAndRender();return;}state.loading=true;byId('tpfContactsLoading')?.classList.remove('hidden');byId('tpfContactsEmpty')?.classList.add('hidden');setStatus('Actualizando…');
 try{const [rows]=await Promise.all([fetchAllContacts(),loadGlobalLabels()]);state.rows=rows;state.labelsByContact.clear();state.labelsAllLoaded=false;state.selected=new Set([...state.selected].filter(id=>rows.some(r=>r.id===id)));renderSources();applyAndRender();setStatus(`${rows.length} contactos cargados`);}
 catch(e){setStatus(e?.message||'No se pudieron cargar los contactos',true);M.report?.('contacts-list-ui',e,'loadContacts');showToast(e?.message||'No se pudieron cargar los contactos',true);}
 finally{state.loading=false;byId('tpfContactsLoading')?.classList.add('hidden');}
}
function renderSources(){const el=byId('tpfFilterSource');if(!el)return;const cur=state.filters.source;const values=[...new Set(state.rows.map(x=>x.source).filter(Boolean))].sort();el.innerHTML='<option value="">Todos</option>'+values.map(x=>`<option value="${esc(x)}">${esc(x==='BASE DE DATOS'?'Contactos':x)}</option>`).join('');el.value=cur;}
function renderLabelOptions(){const el=byId('tpfFilterLabel');if(el){const cur=state.filters.label;el.innerHTML='<option value="">Todas</option>'+state.labels.map(x=>`<option value="${esc(labelId(x))}">${esc(labelName(x))}</option>`).join('');el.value=cur;}const box=byId('tpfCreateLabels');if(box)box.innerHTML=state.labels.length?state.labels.map((x,i)=>`<label class="tpfContactsLabelChoice"><input type="checkbox" value="${esc(labelId(x))}"><span class="tpfLabelChip ${labelColor(i)}">${esc(labelName(x))}</span></label>`).join(''):'<span class="small">No hay etiquetas creadas.</span>';byId('tpfContactsLabelsCount')&&(byId('tpfContactsLabelsCount').textContent=String(state.labels.length));}
function applyFilters(){
 const f=state.filters,q=norm(f.q),name=norm(f.name),dni=norm(f.dni),phone=digits(f.phone);state.filtered=state.rows.filter(r=>{
  if(q&&!norm([r.fullName,r.dni,r.phone,r.email,r.bank,r.source].join(' ')).includes(q))return false;if(name&&!norm(r.fullName).includes(name))return false;if(dni&&!norm(r.dni).includes(dni))return false;if(phone&&!digits(r.phone).includes(phone))return false;if(f.source&&r.source!==f.source)return false;if(f.label){const ls=state.labelsByContact.get(r.id)||[];if(!ls.some(x=>labelId(x)===f.label))return false;}return true;
 });const pages=Math.max(1,Math.ceil(state.filtered.length/state.pageSize));if(state.page>pages)state.page=pages;
}
function applyAndRender(){applyFilters();renderStats();renderList();}
function renderStats(){if(!byId('tpfContactsTotal'))return;byId('tpfContactsTotal').textContent=String(state.rows.length);byId('tpfContactsWithPhone').textContent=String(state.rows.filter(x=>x.phone).length);byId('tpfContactsWithDni').textContent=String(state.rows.filter(x=>x.dni).length);byId('tpfContactsLabelsCount').textContent=String(state.labels.length);}
function currentPageRows(){const start=(state.page-1)*state.pageSize;return state.filtered.slice(start,start+state.pageSize);}
function labelsHtml(id){const rows=state.labelsByContact.get(id);if(!rows)return '<span class="small">…</span>';if(!rows.length)return '<span class="small">Sin etiquetas</span>';return rows.slice(0,3).map((x,i)=>`<span class="tpfLabelChip ${labelColor(i)}">${esc(labelName(x))}</span>`).join('')+(rows.length>3?`<span class="small">+${rows.length-3}</span>`:'');}
function renderList(){
 const rows=currentPageRows(),tbody=byId('tpfContactsRows'),cards=byId('tpfContactsCards');if(!tbody||!cards)return;
 tbody.innerHTML=rows.map(r=>`<tr data-contact-id="${esc(r.id)}" class="${state.selected.has(r.id)?'selected':''}"><td><input class="tpfContactSelect" type="checkbox" data-id="${esc(r.id)}" ${state.selected.has(r.id)?'checked':''}></td><td><div class="tpfContactIdentity"><span class="tpfContactAvatar">${esc(initials(r))}</span><div><button class="tpfContactNameBtn" data-action="open" data-id="${esc(r.id)}">${esc(r.fullName)}</button>${r.email?`<span class="tpfContactEmail">${esc(r.email)}</span>`:''}</div><button class="tpfContactPencil" data-action="open" data-id="${esc(r.id)}" title="Editar ficha">✎</button></div></td><td>${esc(r.dni||'—')}</td><td>${esc(r.phone||'—')}</td><td><span class="tpfSourceBadge">${esc(r.source==='BASE DE DATOS'?'Contactos':r.source)}</span></td><td>${labelsHtml(r.id)}</td><td><div class="tpfContactActions"><button data-action="whatsapp" data-id="${esc(r.id)}" title="Enviar WhatsApp">◉</button><button data-action="schedule" data-id="${esc(r.id)}" title="Programar WhatsApp">◷</button><button data-action="open" data-id="${esc(r.id)}" title="Abrir ficha">›</button></div></td></tr>`).join('');
 cards.innerHTML=rows.map(r=>`<article class="tpfContactCard ${state.selected.has(r.id)?'selected':''}" data-contact-id="${esc(r.id)}"><div class="tpfContactCardTop"><input class="tpfContactSelect" type="checkbox" data-id="${esc(r.id)}" ${state.selected.has(r.id)?'checked':''}><span class="tpfContactAvatar">${esc(initials(r))}</span><div class="tpfContactCardMain"><div class="tpfContactCardName"><button class="tpfContactNameBtn" data-action="open" data-id="${esc(r.id)}">${esc(r.fullName)}</button><button class="tpfContactPencil" data-action="open" data-id="${esc(r.id)}">✎</button></div><div class="tpfContactCardMeta"><span>DNI: ${esc(r.dni||'—')}</span><span>Teléfono: ${esc(r.phone||'—')}</span><span>Origen: ${esc(r.source==='BASE DE DATOS'?'Contactos':r.source)}</span></div><div class="tpfContactCardLabels">${labelsHtml(r.id)}</div><div class="tpfContactCardActions"><button class="secondary" data-action="whatsapp" data-id="${esc(r.id)}">◉ WhatsApp</button><button class="secondary" data-action="schedule" data-id="${esc(r.id)}">◷ Programar</button></div></div></div></article>`).join('');
 const empty=byId('tpfContactsEmpty');empty.classList.toggle('hidden',rows.length>0||state.loading);const start=state.filtered.length?(state.page-1)*state.pageSize+1:0,end=Math.min(state.page*state.pageSize,state.filtered.length),pages=Math.max(1,Math.ceil(state.filtered.length/state.pageSize));byId('tpfContactsRange').textContent=`${start}–${end} de ${state.filtered.length}`;byId('tpfContactsPageInfo').textContent=`${state.page} / ${pages}`;byId('tpfContactsPrev').disabled=state.page<=1;byId('tpfContactsNext').disabled=state.page>=pages;const all=rows.length&&rows.every(r=>state.selected.has(r.id));byId('tpfSelectPage').checked=!!all;updateBulk();hydrateVisibleLabels(rows);
}
async function hydrateVisibleLabels(rows){const missing=rows.filter(r=>!state.labelsByContact.has(r.id));if(!missing.length)return;await Promise.all(missing.map(r=>getContactLabels(r.id)));if(currentPageRows().some(r=>missing.some(m=>m.id===r.id)))renderListNoHydrate();}
function renderListNoHydrate(){const rows=currentPageRows(),tbody=byId('tpfContactsRows'),cards=byId('tpfContactsCards');if(!tbody||!cards)return;const scroll=tbody.parentElement?.parentElement?.scrollTop||0;tbody.querySelectorAll('tr').forEach(tr=>{const id=tr.dataset.contactId,cell=tr.children[5];if(cell)cell.innerHTML=labelsHtml(id);});cards.querySelectorAll('[data-contact-id]').forEach(card=>{const box=card.querySelector('.tpfContactCardLabels');if(box)box.innerHTML=labelsHtml(card.dataset.contactId);});if(tbody.parentElement?.parentElement)tbody.parentElement.parentElement.scrollTop=scroll;}
async function loadAllContactLabels(){if(state.labelsAllLoaded)return;if(state.labelsLoadPromise)return state.labelsLoadPromise;state.labelsLoadPromise=(async()=>{let cursor=0;const workers=Array.from({length:Math.min(8,Math.max(1,state.rows.length))},async()=>{while(cursor<state.rows.length){const r=state.rows[cursor++];if(!state.labelsByContact.has(r.id))await getContactLabels(r.id);}});await Promise.all(workers);state.labelsAllLoaded=true;})();try{await state.labelsLoadPromise;}finally{state.labelsLoadPromise=null;}}
function updateBulk(){const bar=byId('tpfContactsBulk'),n=state.selected.size;bar.classList.toggle('show',n>0);byId('tpfContactsSelectedCount').textContent=`${n} seleccionado${n===1?'':'s'}`;byId('tpfExportSelected').disabled=n===0;}
function selectCurrentPage(on){currentPageRows().forEach(r=>on?state.selected.add(r.id):state.selected.delete(r.id));renderList();}
function handleSelectionChange(e){const cb=e.target.closest('.tpfContactSelect');if(!cb)return;cb.checked?state.selected.add(cb.dataset.id):state.selected.delete(cb.dataset.id);renderList();}
function rowById(id){return state.rows.find(x=>x.id===safe(id));}
function handleListAction(e){const b=e.target.closest('[data-action]');if(!b)return;const r=rowById(b.dataset.id);if(!r)return;e.preventDefault();if(b.dataset.action==='open')openProfile(r);else if(b.dataset.action==='edit')openEdit(r);else if(b.dataset.action==='whatsapp')openWhatsapp(r,false);else if(b.dataset.action==='schedule')openWhatsapp(r,true);}
async function openProfile(r){try{if(typeof window.openContact==='function')await window.openContact(r.id);else if(typeof openContact==='function')await openContact(r.id);else throw new Error('La ficha de contacto no está disponible.');}catch(e){showToast(e?.message||'No se pudo abrir la ficha',true);}}
function openWhatsapp(r,schedule){if(!r.phone)return showToast('Este contacto no tiene teléfono.',true);if(!allowed(schedule?'can_schedule_whatsapp':'can_use_whatsapp'))return showToast('No tienes permiso para esta acción.',true);const fn=window.openWaQuick||(typeof openWaQuick==='function'?openWaQuick:null);if(!fn)return showToast('WhatsApp no está disponible.',true);fn({phone:r.phone,name:r.fullName,dni:r.dni,contactId:r.id});if(schedule)setTimeout(()=>{const drop=byId('waQuickDrop');if(drop)drop.click();else byId('waQuickScheduleBox')?.classList.remove('hidden');},40);}
function clearFilters(){state.filters={q:'',name:'',dni:'',phone:'',source:'',label:''};['tpfContactsSearch','tpfFilterName','tpfFilterDni','tpfFilterPhone'].forEach(id=>{if(byId(id))byId(id).value='';});if(byId('tpfFilterSource'))byId('tpfFilterSource').value='';if(byId('tpfFilterLabel'))byId('tpfFilterLabel').value='';state.page=1;applyAndRender();}
function timestamp(){const d=new Date(),p=n=>safe(n).padStart(2,'0');return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;}
function exportContacts(scope){if(!allowed('can_export_excel'))return showToast('No tienes permiso para exportar.',true);let rows=scope==='selected'?state.rows.filter(r=>state.selected.has(r.id)):scope==='filtered'?state.filtered:state.rows;if(!rows.length)return showToast('No hay contactos para exportar.',true);if(typeof XLSX==='undefined')return showToast('No se ha cargado el módulo de Excel.',true);const data=rows.map(r=>({Nombre:r.first,Apellidos:r.last,'Nombre y apellidos':r.fullName,DNI:r.dni,Teléfono:r.phone,Email:r.email,Banco:r.bank,Notas:r.notes,Observaciones:r.observations,Origen:r.source==='BASE DE DATOS'?'Contactos':r.source,Etiquetas:(state.labelsByContact.get(r.id)||[]).map(labelName).join(', ')}));const ws=XLSX.utils.json_to_sheet(data);ws['!cols']=[18,26,34,16,16,30,20,35,35,18,32].map(wch=>({wch}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Contactos');XLSX.writeFile(wb,`Contactos_ThePhoneFace_${timestamp()}.xlsx`,{compression:true});byId('tpfContactsExportMenu').classList.add('hidden');}

async function openCreate(){if(!allowed('can_create_database'))return showToast('No tienes permiso para crear contactos.',true);state.editingId='';await loadGlobalLabels();const back=byId('tpfContactsCreateBack');delete back.dataset.editId;back.querySelector('h3').textContent='Agregar contacto';back.querySelector('.tpfContactsModalHead .small').textContent='Crea el contacto con todos sus datos principales.';byId('tpfContactsCreateSave').textContent='Crear contacto';['tpfCreateFirst','tpfCreateLast','tpfCreateNickname','tpfCreatePhone','tpfCreateEmail','tpfCreateDni','tpfCreateBank','tpfCreateNotes','tpfCreateObs'].forEach(id=>{const el=byId(id);if(el)el.value='';});byId('tpfCreateLabels').querySelectorAll('input').forEach(x=>x.checked=false);byId('tpfContactsCreateMsg').textContent='';back.classList.remove('hidden');setTimeout(()=>byId('tpfCreateFirst').focus(),20);}
async function openEdit(r){
 await loadGlobalLabels();state.editingId=r.id;
 const values={tpfCreateFirst:r.first,tpfCreateLast:r.last,tpfCreateNickname:r.nickname,tpfCreatePhone:r.phone,tpfCreateEmail:r.email,tpfCreateDni:r.dni,tpfCreateBank:r.bank,tpfCreateNotes:r.notes,tpfCreateObs:r.observations};
 Object.entries(values).forEach(([id,value])=>{const el=byId(id);if(el)el.value=value||'';});
 const labels=await getContactLabels(r.id),ids=new Set(labels.map(labelId));
 byId('tpfCreateLabels').querySelectorAll('input').forEach(x=>x.checked=ids.has(x.value));
 byId('tpfContactsCreateMsg').textContent='';
 const back=byId('tpfContactsCreateBack');back.dataset.editId=r.id;back.querySelector('h3').textContent='Editar contacto';back.querySelector('.tpfContactsModalHead .small').textContent='Modifica los datos reales del contacto.';byId('tpfContactsCreateSave').textContent='Guardar cambios';back.classList.remove('hidden');
}
function closeCreate(){const back=byId('tpfContactsCreateBack');back.classList.add('hidden');state.editingId='';delete back.dataset.editId;back.querySelector('h3').textContent='Agregar contacto';back.querySelector('.tpfContactsModalHead .small').textContent='Crea el contacto con todos sus datos principales.';byId('tpfContactsCreateSave').textContent='Crear contacto';}
async function createContact(){
 const btn=byId('tpfContactsCreateSave'),msg=byId('tpfContactsCreateMsg'),editing=state.editingId,row=editing?rowById(editing):null;
 const first=byId('tpfCreateFirst').value.trim(),last=byId('tpfCreateLast').value.trim(),nickname=byId('tpfCreateNickname')?.value.trim()||'',phone=localSpanishPhone(byId('tpfCreatePhone').value),email=byId('tpfCreateEmail').value.trim(),dni=byId('tpfCreateDni').value.trim(),bank=byId('tpfCreateBank').value.trim(),notes=byId('tpfCreateNotes').value.trim(),obs=byId('tpfCreateObs').value.trim();
 if(!first&&!last)return msg.textContent='Escribe el nombre o los apellidos.';
 byId('tpfCreatePhone').value=phone;btn.disabled=true;msg.textContent='Guardando…';
 try{
  const full=[first,last].filter(Boolean).join(' ').trim(),data={...(row?.data||{}),'NOMBRE':first,'APELLIDOS':last,'NOMBRE Y APELLIDOS':full,'APODO':nickname,'TELÉFONO':phone,'DNI / NIF':dni,'DNI':dni,'EMAIL':email,'BANCO':bank,'NOTAS':notes,'OBSERVACIONES':obs};
  let id='';
  if(editing){const res=await sb.from('records').update({data}).eq('id',editing).select('id').single();if(res.error)throw res.error;id=res.data.id;}
  else{const dup=await sb.rpc('find_possible_duplicate_contact',{phone_text:phone||null,dni_text:dni||null,email_text:email||null});if(dup.error)throw dup.error;if((dup.data||[]).length&&!confirm('Hay un posible contacto duplicado. ¿Quieres crearlo igualmente?')){msg.textContent='Creación cancelada.';return;}const res=await sb.from('records').insert({source_sheet:'BASE DE DATOS',data}).select('id').single();if(res.error)throw res.error;id=res.data.id;}
  const ids=[...byId('tpfCreateLabels').querySelectorAll('input:checked')].map(x=>x.value),lr=await sb.rpc('crm_set_contact_labels',{p_contact_id:id,p_label_ids:ids});if(lr.error)throw lr.error;
  const origin=byId('tpfContactsCreateBack')?.dataset?.origin||'';closeCreate();showToast(editing?'Contacto guardado correctamente.':'Contacto creado correctamente.');await loadContacts(true);
  try{window.dispatchEvent(new CustomEvent(editing?'tpf:contact-updated':'tpf:contact-created',{detail:{id,phone,origin}}));}catch(_){}
 }catch(e){msg.textContent=e?.message||(editing?'No se pudo guardar el contacto.':'No se pudo crear el contacto.');M.report?.('contacts-list-ui',e,editing?'updateContact':'createContact');}
 finally{btn.disabled=false;}
}

M.register('contacts-list-ui',{install(){buildUi();if(!byId('view-database')?.classList.contains('hidden'))loadContacts(false);window.tpfReloadContacts=()=>loadContacts(true);}});
})();
