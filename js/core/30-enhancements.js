/* TPF physical module split · generated from app-core.js */
/* ===== Campos personalizados de Contactos ===== */
let crmCustomFieldsCache=[];
let crmCustomFieldsLoaded=false;

async function crmLoadCustomFields(){
  const {data,error}=await sb.rpc("crm_list_custom_fields");
  if(error)throw error;
  crmCustomFieldsCache=Array.isArray(data)?data:[];
  crmCustomFieldsLoaded=true;
  crmRenderCustomFieldsManager();
  crmRenderCreateCustomFields();
  if(currentContact)await crmRenderContactCustomFields(currentContact.id);
  return crmCustomFieldsCache;
}
function crmFieldTypeLabel(t){return {text:"Texto",number:"Número",date:"Fecha",phone:"Teléfono",email:"Email",select:"Desplegable",boolean:"Sí / No",textarea:"Texto largo"}[t]||t}
function crmFieldInputHtml(f,value="",prefix="cf"){
  const id=`${prefix}_${f.id}`,v=String(value??"");
  if(f.field_type==="textarea")return `<div class="customFieldControl full"><label>${esc(f.name)}</label><textarea id="${id}" rows="3">${esc(v)}</textarea></div>`;
  if(f.field_type==="select")return `<div class="customFieldControl"><label>${esc(f.name)}</label><select id="${id}"><option value=""></option>${(Array.isArray(f.options)?f.options:[]).map(o=>`<option value="${esc(o)}" ${String(o)===v?"selected":""}>${esc(o)}</option>`).join("")}</select></div>`;
  if(f.field_type==="boolean")return `<div class="customFieldControl"><label>${esc(f.name)}</label><select id="${id}"><option value=""></option><option value="Sí" ${v==="Sí"?"selected":""}>Sí</option><option value="No" ${v==="No"?"selected":""}>No</option></select></div>`;
  const type={number:"number",date:"date",phone:"tel",email:"email"}[f.field_type]||"text";
  return `<div class="customFieldControl"><label>${esc(f.name)}</label><input id="${id}" type="${type}" value="${esc(v)}"></div>`;
}
function crmRenderCreateCustomFields(){
  if(!$("dbCustomFields"))return;
  $("dbCustomFields").innerHTML=(crmCustomFieldsCache||[]).map(f=>crmFieldInputHtml(f,"","dbcf")).join("")+(crmCustomFieldsCache.length?'<div class="customFieldsImportHint full">Estos mismos campos podrán utilizarse después al importar contactos desde Excel.</div>':"");
}
async function crmRenderContactCustomFields(contactId){
  if(!$("contactCustomFields"))return;
  if(!crmCustomFieldsLoaded)try{await crmLoadCustomFields()}catch(e){}
  const {data,error}=await sb.rpc("crm_get_contact_custom_values",{p_contact_id:String(contactId)});
  if(error){$("contactCustomFields").innerHTML='<div class="small">'+esc(error.message)+'</div>';return}
  const map=new Map((data||[]).map(x=>[String(x.field_id),x.value_text||""]));
  $("contactCustomFields").innerHTML=(crmCustomFieldsCache||[]).map(f=>crmFieldInputHtml(f,map.get(String(f.id))||"","ccf")).join("")||'<div class="small">No hay campos personalizados. Pulsa Gestionar para crear uno.</div>';
}
function crmCollectCustomValues(prefix){
  return (crmCustomFieldsCache||[]).map(f=>{
    const el=$(`${prefix}_${f.id}`);
    return {field_id:f.id,value:el?String(el.value??""):""};
  });
}
async function crmSaveContactCustomValues(contactId,prefix="ccf"){
  if(!contactId||!crmCustomFieldsCache.length)return;
  const {error}=await sb.rpc("crm_set_contact_custom_values",{p_contact_id:String(contactId),p_values:crmCollectCustomValues(prefix)});
  if(error)throw error;
}
function crmRenderCustomFieldsManager(){
  if(!$("customFieldsList"))return;
  const rows=crmCustomFieldsCache||[];
  $("customFieldsEmpty").classList.toggle("hidden",rows.length>0);
  $("customFieldsList").innerHTML=rows.map((f,i)=>`<div class="customFieldRow"><div class="customFieldRowMain"><b>${esc(f.name)}</b><small>${esc(crmFieldTypeLabel(f.field_type))}${f.field_type==="select"&&Array.isArray(f.options)&&f.options.length?" · "+esc(f.options.join(", ")):""}</small></div><div class="customFieldActions"><button onclick="crmMoveCustomField('${f.id}',-1)" ${i===0?"disabled":""}>↑</button><button onclick="crmMoveCustomField('${f.id}',1)" ${i===rows.length-1?"disabled":""}>↓</button><button onclick="crmEditCustomField('${f.id}')">Editar</button><button class="danger" onclick="crmDeleteCustomField('${f.id}')">Eliminar</button></div></div>`).join("");
}
$("customFieldType").onchange=()=>$("customFieldOptionsWrap").classList.toggle("hidden",$("customFieldType").value!=="select");
$("customFieldsManageBtn").onclick=async()=>{await crmLoadCustomFields();$("customFieldsModal").classList.remove("hidden")};
if($("contactCustomFieldsManage")&&$("customFieldsManageBtn"))$("contactCustomFieldsManage").onclick=$("customFieldsManageBtn").onclick;
$("customFieldsClose").onclick=()=>$("customFieldsModal").classList.add("hidden");
$("customFieldsModal").onclick=e=>{if(e.target===$("customFieldsModal"))$("customFieldsModal").classList.add("hidden")};
$("customFieldCreate").onclick=async()=>{
 const name=$("customFieldName").value.trim(),type=$("customFieldType").value;
 if(!name){$("customFieldMsg").textContent="Escribe un nombre.";return}
 const opts=type==="select"?$("customFieldOptions").value.split(/\n/).map(x=>x.trim()).filter(Boolean):[];
 $("customFieldCreate").disabled=true;
 try{const {error}=await sb.rpc("crm_create_custom_field",{p_name:name,p_field_type:type,p_options:opts});if(error)throw error;$("customFieldName").value="";$("customFieldOptions").value="";$("customFieldMsg").textContent="Campo creado.";await crmLoadCustomFields()}catch(e){$("customFieldMsg").textContent=e.message||"No se pudo crear."}finally{$("customFieldCreate").disabled=false}
};
window.crmDeleteCustomField=async id=>{const f=crmCustomFieldsCache.find(x=>String(x.id)===String(id));if(!confirm(`¿Eliminar el campo "${f?.name||"seleccionado"}" y sus valores guardados?`))return;const {error}=await sb.rpc("crm_delete_custom_field",{p_id:id});if(error)return alert(error.message);await crmLoadCustomFields()};
window.crmEditCustomField=async id=>{
 const f=crmCustomFieldsCache.find(x=>String(x.id)===String(id));if(!f)return;
 const name=prompt("Nombre del campo",f.name);if(!name||!name.trim())return;
 let options=f.options||[];
 if(f.field_type==="select"){const o=prompt("Opciones separadas por comas",options.join(", "));if(o!==null)options=o.split(",").map(x=>x.trim()).filter(Boolean)}
 const {error}=await sb.rpc("crm_update_custom_field",{p_id:id,p_name:name.trim(),p_field_type:f.field_type,p_options:options,p_position:Number(f.field_position||0)});if(error)return alert(error.message);await crmLoadCustomFields()
};
window.crmMoveCustomField=async(id,dir)=>{
 const rows=[...crmCustomFieldsCache],i=rows.findIndex(x=>String(x.id)===String(id)),j=i+dir;if(i<0||j<0||j>=rows.length)return;
 [rows[i],rows[j]]=[rows[j],rows[i]];
 for(let k=0;k<rows.length;k++){await sb.rpc("crm_update_custom_field",{p_id:rows[k].id,p_name:rows[k].name,p_field_type:rows[k].field_type,p_options:rows[k].options||[],p_position:k})}
 await crmLoadCustomFields()
};

/* Integración con ficha de contacto */
const _openContactCustomFields=window.openContact;
window.openContact=async function(id){const r=await _openContactCustomFields(id);try{await crmLoadCustomFields()}catch(e){}return r};

/* Guardar los campos personalizados al pulsar Guardar cambios */
const _contactSaveCustomFields=$("contactSave").onclick;
$("contactSave").onclick=async function(){
  await _contactSaveCustomFields.call(this);
  if(currentContact){try{await crmSaveContactCustomValues(currentContact.id,"ccf");$("contactMsg").textContent="Contacto y campos personalizados guardados correctamente"}catch(e){$("contactMsg").textContent=e.message}}
};

/* Guardar campos personalizados de contactos nuevos. Se captura el ID recién creado. */
const _dbSaveCustomFields=$("dbSave").onclick;
$("dbSave").onclick=async function(){
  const before=await sb.from("records").select("id").eq("source_sheet","BASE DE DATOS").order("created_at",{ascending:false}).limit(1);
  await _dbSaveCustomFields.call(this);
  try{
    const {data}=await sb.from("records").select("id").eq("source_sheet","BASE DE DATOS").order("created_at",{ascending:false}).limit(1);
    const newId=data?.[0]?.id;
    const oldId=before.data?.[0]?.id;
    if(newId&&String(newId)!==String(oldId))await crmSaveContactCustomValues(newId,"dbcf");
  }catch(e){console.warn("Campos personalizados nuevo contacto",e)}
  crmRenderCreateCustomFields();
};

setTimeout(()=>crmLoadCustomFields().catch(()=>{}),1300);


/* ===== Búsqueda múltiple + exportación Excel completa ===== */
let multiSearchRowsCache=[];
let multiSearchValuesCache=[];
let multiSearchMissingCache=[];

function excelSafeSheetName(name){
  return String(name||"Hoja").replace(/[\\\/\?\*\[\]:]/g," ").slice(0,31)||"Hoja";
}
function excelAllColumns(rows){
  const keys=[];
  (rows||[]).forEach(r=>Object.keys(r.data||{}).forEach(k=>{if(!keys.includes(k))keys.push(k)}));
  return keys;
}
function buildExcelWorksheetFromRows(rows,includeSearchValue=false){
  const keys=excelAllColumns(rows);
  const headers=[...(includeSearchValue?["Valor buscado"]:[]),"Origen",...keys];
  const data=[headers];
  (rows||[]).forEach(r=>{
    data.push([
      ...(includeSearchValue?[r.__searched_value||""]:[]),
      r.source_sheet||"",
      ...keys.map(k=>r.data?.[k]??"")
    ]);
  });
  const ws=XLSX.utils.aoa_to_sheet(data);
  ws["!cols"]=headers.map((h,i)=>{
    let max=String(h||"").length;
    for(let r=1;r<data.length;r++)max=Math.max(max,String(data[r][i]??"").length);
    return {wch:Math.min(Math.max(max+2,11),45)};
  });
  if(headers.length)ws["!autofilter"]={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:Math.max(data.length-1,0),c:headers.length-1}})};
  // Freeze top row when supported by Excel viewers.
  ws["!freeze"]={xSplit:0,ySplit:1,topLeftCell:"A2",activePane:"bottomLeft",state:"frozen"};
  return ws;
}
function downloadRowsExcel(rows,filename,includeSearchValue=false){
  if(typeof XLSX==="undefined"){alert("No se ha podido cargar el módulo de Excel.");return}
  if(!rows?.length){alert("No hay datos para exportar.");return}
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,buildExcelWorksheetFromRows(rows,includeSearchValue),"Resultados");
  XLSX.writeFile(wb,filename,{compression:true});
}
function timestampFile(){
  const d=new Date(),p=n=>String(n).padStart(2,"0");
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
function visibleSheetToInternal(sheet){
  return String(sheet||"").toUpperCase()==="CONTACTOS"?"BASE DE DATOS":sheet;
}
function internalSheetToVisible(sheet){
  return String(sheet||"").toUpperCase()==="BASE DE DATOS"?"CONTACTOS":sheet;
}

/* Exportar SIEMPRE todas las columnas de los resultados, aunque algunas estén ocultas en pantalla. */
function exportCurrentSearchAllColumns(){
  const rows=$("searchSheet").value?lastSearchRows:lastUnifiedRows;
  downloadRowsExcel(rows,`Resultados_ThePhoneFace_${timestampFile()}.xlsx`,false);
}
$("exportSearchExcel").onclick=exportCurrentSearchAllColumns;

/* Hacer visible exportar resultados también en búsquedas de una sola hoja. */
const _searchBtnExcelBase=$("searchBtn").onclick;
$("searchBtn").onclick=async function(){
  await _searchBtnExcelBase.call(this);
  const rows=$("searchSheet").value?lastSearchRows:lastUnifiedRows;
  $("exportSearchExcel").classList.toggle("hidden",!rows?.length);
};

/* Exportación completa de una sección usando paginación de Supabase. */
async function fetchAllRowsForSource(source){
  const internal=visibleSheetToInternal(source);
  const pageSize=1000,all=[];
  for(let from=0;;from+=pageSize){
    const {data,error}=await sb.from("records").select("id,source_sheet,data").eq("source_sheet",internal).range(from,from+pageSize-1);
    if(error)throw error;
    const chunk=data||[];all.push(...chunk);
    if(chunk.length<pageSize)break;
    if(all.length>=50000){throw new Error("La hoja supera 50.000 filas. Exporta por partes para evitar bloquear el navegador.")}
  }
  return all;
}
$("exportFullSheetExcel").onclick=async()=>{
  let source=$("searchSheet").value;
  if(!source){
    const choice=prompt("Escribe la sección a exportar: LIQUIDACION, DATA, CLAWBACK, AJUSTES, VENTAS o CONTACTOS","LIQUIDACION");
    if(!choice)return;source=choice.trim().toUpperCase();
  }
  $("exportFullSheetExcel").disabled=true;$("exportFullSheetExcel").textContent="Preparando Excel…";
  try{
    const rows=await fetchAllRowsForSource(source);
    if(!rows.length){alert(`No hay datos en ${source}.`);return}
    downloadRowsExcel(rows,`${internalSheetToVisible(source)}_COMPLETO_${timestampFile()}.xlsx`,false);
  }catch(e){alert(e.message||"No se pudo exportar la hoja.")}
  finally{$("exportFullSheetExcel").disabled=false;$("exportFullSheetExcel").textContent="Exportar hoja completa"}
};

/* Búsqueda múltiple */
function parseMultiSearchValues(){
  const raw=$("multiSearchValues").value;
  return [...new Set(raw.split(/[\n\r\t,;]+/).map(x=>x.trim()).filter(Boolean))];
}
function selectedMultiSheets(){
  return [...document.querySelectorAll(".multiSearchSheets input:checked")].map(x=>x.value);
}
$("multiSearchBtn").onclick=()=>{$("multiSearchModal").classList.remove("hidden");$("multiSearchValues").focus()};
$("multiSearchClose").onclick=()=>$("multiSearchModal").classList.add("hidden");
$("multiSearchModal").onclick=e=>{if(e.target===$("multiSearchModal"))$("multiSearchModal").classList.add("hidden")};
$("multiSearchClear").onclick=()=>{$("multiSearchValues").value="";$("multiSearchMsg").textContent=""};

async function runSearchBatch(values,sheets){
  const rows=[],found=new Set();
  // Lotes pequeños para no saturar Supabase.
  const jobs=[];
  for(const value of values){
    for(const source of sheets){
      jobs.push({value,source});
    }
  }
  for(let i=0;i<jobs.length;i+=6){
    const batch=jobs.slice(i,i+6);
    const results=await Promise.all(batch.map(async j=>{
      try{
        const {data,error}=await sb.rpc("search_records",{search_text:j.value,sheet_filter:j.source,result_limit:250});
        if(error)throw error;
        return {j,data:data||[]};
      }catch(error){return {j,data:[],error}}
    }));
    for(const r of results){
      for(const row of r.data){
        const key=`${row.id}::${r.j.value}`;
        if(!rows.some(x=>x.__multi_key===key)){
          rows.push({...row,__searched_value:r.j.value,__multi_key:key});
        }
        found.add(r.j.value);
      }
    }
    $("multiSearchMsg").textContent=`Buscando… ${Math.min(i+6,jobs.length)} de ${jobs.length} comprobaciones`;
    await new Promise(r=>setTimeout(r,0));
  }
  return {rows,found};
}
async function renderMultiSearchResults(rows,values,found){
  multiSearchRowsCache=rows||[];
  multiSearchValuesCache=values||[];
  multiSearchMissingCache=values.filter(v=>!found.has(v));

  const keys=excelAllColumns(rows);
  $("multiSearchSummaryText").innerHTML=`<b>${rows.length} coincidencias</b> · ${values.length-multiSearchMissingCache.length} valores encontrados de ${values.length}`;
  $("multiSearchMissing").innerHTML=
    (values.filter(v=>found.has(v)).map(v=>`<span class="multiFoundChip">✓ ${esc(v)}</span>`).join(""))+
    (multiSearchMissingCache.map(v=>`<span class="multiMissingChip">No encontrado: ${esc(v)}</span>`).join(""));

  $("multiSearchHead").innerHTML="<tr><th>Valor buscado</th><th>Origen</th>"+keys.map(k=>`<th>${esc(k)}</th>`).join("")+"<th>Acciones</th></tr>";
  $("multiSearchRows").innerHTML=rows.map(r=>`<tr><td><b>${esc(r.__searched_value||"")}</b></td><td><span class="sourceBadge">${esc(internalSheetToVisible(r.source_sheet||""))}</span></td>${keys.map(k=>`<td>${esc(r.data?.[k]??"")}</td>`).join("")}<td>${searchRowActions(r)}</td></tr>`).join("");
  $("multiSearchResults").classList.remove("hidden");
  $("searchSingleResults").classList.add("hidden");$("searchUnifiedResults").classList.add("hidden");$("searchGroupedResults").classList.add("hidden");
}
$("multiSearchRun").onclick=async()=>{
  const values=parseMultiSearchValues(),sheets=selectedMultiSheets();
  if(!values.length){$("multiSearchMsg").textContent="Pega al menos un DNI, transacción o identificador.";return}
  if(!sheets.length){$("multiSearchMsg").textContent="Marca al menos una sección.";return}
  $("multiSearchRun").disabled=true;$("multiSearchMsg").textContent=`Preparando ${values.length} valores…`;
  try{
    const {rows,found}=await runSearchBatch(values,sheets);
    await renderMultiSearchResults(rows,values,found);
    $("multiSearchModal").classList.add("hidden");
  }catch(e){$("multiSearchMsg").textContent=e.message||"No se pudo completar la búsqueda."}
  finally{$("multiSearchRun").disabled=false}
};
$("multiSearchExport").onclick=()=>{
  if(!multiSearchRowsCache.length)return alert("No hay resultados para exportar.");
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,buildExcelWorksheetFromRows(multiSearchRowsCache,true),"Encontrados");
  if(multiSearchMissingCache.length){
    const ws2=XLSX.utils.aoa_to_sheet([["No encontrados"],...multiSearchMissingCache.map(x=>[x])]);
    ws2["!cols"]=[{wch:35}];
    XLSX.utils.book_append_sheet(wb,ws2,"No encontrados");
  }
  XLSX.writeFile(wb,`Busqueda_Multiple_ThePhoneFace_${timestampFile()}.xlsx`,{compression:true});
};


/* ===== Cruce automático DNI / transacciones ===== */
let crossSearchMatrix=[];
let crossSearchDetailRows=[];

function parseCrossValues(){
  return [...new Set($("crossSearchValues").value.split(/[\n\r\t,;]+/).map(x=>x.trim()).filter(Boolean))];
}
$("crossSearchBtn").onclick=()=>{$("crossSearchModal").classList.remove("hidden");$("crossSearchValues").focus()};
$("crossSearchClose").onclick=()=>$("crossSearchModal").classList.add("hidden");
$("crossSearchModal").onclick=e=>{if(e.target===$("crossSearchModal"))$("crossSearchModal").classList.add("hidden")};
$("crossSearchClear").onclick=()=>{$("crossSearchValues").value="";$("crossSearchMsg").textContent=""};

async function crossSearchRecordsSource(value,source){
  try{
    const {data,error}=await sb.rpc("search_records",{search_text:value,sheet_filter:source,result_limit:250});
    if(error)throw error;
    return data||[];
  }catch(e){return []}
}
let crossSalesCache=null;
async function crossLoadSalesCache(){
  if(Array.isArray(crossSalesCache))return crossSalesCache;
  try{
    const {data,error}=await sb.from("sales_opportunities").select("*");
    if(error)throw error;
    crossSalesCache=data||[];
  }catch(e){crossSalesCache=[]}
  return crossSalesCache;
}
async function crossSearchSales(value){
  const clean=String(value||"").trim().toLowerCase();
  const digits=clean.replace(/\D/g,"");
  const rows=await crossLoadSalesCache();
  return rows.filter(o=>{
    const hay=[o.title,o.client_name,o.phone,o.notes,o.id,o.record_id]
      .map(x=>String(x||"").toLowerCase());
    if(hay.some(x=>x.includes(clean)))return true;
    if(digits.length>=6)return hay.some(x=>x.replace(/\D/g,"").includes(digits));
    return false;
  });
}
async function crossSearchOne(value){
  const [liq,data,claw,ajustes,ventas]=await Promise.all([
    crossSearchRecordsSource(value,"LIQUIDACION"),
    crossSearchRecordsSource(value,"DATA"),
    crossSearchRecordsSource(value,"CLAWBACK"),
    crossSearchRecordsSource(value,"AJUSTES"),
    crossSearchSales(value)
  ]);
  return {value,LIQUIDACION:liq,DATA:data,CLAWBACK:claw,AJUSTES:ajustes,VENTAS:ventas};
}
function crossCell(list,value,source){
  if(!list?.length)return '<span class="crossNo">—</span>';
  return `<span class="crossCount">${list.length}</span><button class="crossActionBtn" onclick="crossShowDetails('${String(value).replaceAll("'","\\'")}','${source}')">Ver</button>`;
}
function renderCrossSearch(){
  $("crossSearchHead").innerHTML="<tr><th>DNI / Transacción</th><th>Ventas</th><th>Liquidación</th><th>Data</th><th>Clawback</th><th>Ajustes</th><th>Total</th></tr>";
  $("crossSearchRows").innerHTML=crossSearchMatrix.map(r=>{
    const total=r.VENTAS.length+r.LIQUIDACION.length+r.DATA.length+r.CLAWBACK.length+r.AJUSTES.length;
    return `<tr><td><b>${esc(r.value)}</b></td>
      <td>${crossCell(r.VENTAS,r.value,"VENTAS")}</td>
      <td>${crossCell(r.LIQUIDACION,r.value,"LIQUIDACION")}</td>
      <td>${crossCell(r.DATA,r.value,"DATA")}</td>
      <td>${crossCell(r.CLAWBACK,r.value,"CLAWBACK")}</td>
      <td>${crossCell(r.AJUSTES,r.value,"AJUSTES")}</td>
      <td><span class="${total?"crossOk":"crossNo"}">${total||"0"}</span></td></tr>`;
  }).join("");
  const found=crossSearchMatrix.filter(r=>r.VENTAS.length+r.LIQUIDACION.length+r.DATA.length+r.CLAWBACK.length+r.AJUSTES.length>0).length;
  $("crossSearchSummaryText").innerHTML=`<b>${found}</b> valores con coincidencias de <b>${crossSearchMatrix.length}</b> comprobados`;
  $("crossSearchResults").classList.remove("hidden");
  $("multiSearchResults").classList.add("hidden");$("searchSingleResults").classList.add("hidden");$("searchUnifiedResults").classList.add("hidden");$("searchGroupedResults").classList.add("hidden");
}
window.crossShowDetails=async(value,source)=>{
  const row=crossSearchMatrix.find(x=>x.value===value);if(!row)return;
  if(source==="VENTAS"){
    const sales=row.VENTAS||[];
    alert(sales.map(o=>`${o.client_name||o.title||"Venta"} · ${o.phone||""} · ${crmMoney?crmMoney(o.amount||0):o.amount||""}`).join("\n")||"Sin resultados");
    return;
  }
  const rows=row[source]||[];
  if(!rows.length)return;
  // Reutiliza la tabla de búsqueda normal para mostrar todas las columnas.
  $("searchText").value=value;$("searchSheet").value=source;
  $("crossSearchResults").classList.add("hidden");
  $("searchSingleResults").classList.remove("hidden");
  await renderSearchResults(rows);
  $("exportSearchExcel").classList.remove("hidden");
};

$("crossSearchRun").onclick=async()=>{
  const values=parseCrossValues();
  if(!values.length){$("crossSearchMsg").textContent="Pega al menos un DNI o transacción.";return}
  $("crossSearchRun").disabled=true;
  crossSalesCache=null;
  crossSearchMatrix=[];crossSearchDetailRows=[];
  try{
    for(let i=0;i<values.length;i+=4){
      const batch=values.slice(i,i+4);
      const rows=await Promise.all(batch.map(crossSearchOne));
      crossSearchMatrix.push(...rows);
      $("crossSearchMsg").textContent=`Comprobados ${Math.min(i+4,values.length)} de ${values.length}`;
      await new Promise(r=>setTimeout(r,0));
    }
    renderCrossSearch();
    $("crossSearchModal").classList.add("hidden");
  }catch(e){$("crossSearchMsg").textContent=e.message||"No se pudo completar el cruce."}
  finally{$("crossSearchRun").disabled=false}
};

$("crossSearchExport").onclick=()=>{
  if(!crossSearchMatrix.length)return alert("No hay datos para exportar.");
  if(typeof XLSX==="undefined")return alert("No se ha podido cargar Excel.");
  const wb=XLSX.utils.book_new();

  // Resumen matrix
  const summary=[["DNI / Transacción","Ventas","Liquidación","Data","Clawback","Ajustes","Total"]];
  crossSearchMatrix.forEach(r=>{
    const total=r.VENTAS.length+r.LIQUIDACION.length+r.DATA.length+r.CLAWBACK.length+r.AJUSTES.length;
    summary.push([r.value,r.VENTAS.length,r.LIQUIDACION.length,r.DATA.length,r.CLAWBACK.length,r.AJUSTES.length,total]);
  });
  const ws=XLSX.utils.aoa_to_sheet(summary);
  ws["!cols"]=[{wch:28},{wch:12},{wch:14},{wch:10},{wch:12},{wch:12},{wch:10}];
  ws["!autofilter"]={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:summary.length-1,c:6}})};
  XLSX.utils.book_append_sheet(wb,ws,"Resumen");

  // Separate tabs by source, keeping all columns.
  const sources=["LIQUIDACION","DATA","CLAWBACK","AJUSTES"];
  for(const src of sources){
    const rows=[];
    crossSearchMatrix.forEach(r=>(r[src]||[]).forEach(x=>rows.push({...x,__searched_value:r.value})));
    if(rows.length)XLSX.utils.book_append_sheet(wb,buildExcelWorksheetFromRows(rows,true),excelSafeSheetName(src));
  }

  const sales=[];
  crossSearchMatrix.forEach(r=>(r.VENTAS||[]).forEach(o=>sales.push({
    "Valor buscado":r.value,"Cliente":o.client_name||"","Título":o.title||"","Teléfono":o.phone||"",
    "Importe":o.amount||0,"Fecha prevista":o.expected_date||"","Notas":o.notes||"","ID":o.id||""
  })));
  if(sales.length){
    const wsSales=XLSX.utils.json_to_sheet(sales);
    wsSales["!cols"]=[{wch:25},{wch:28},{wch:30},{wch:18},{wch:14},{wch:16},{wch:35},{wch:28}];
    XLSX.utils.book_append_sheet(wb,wsSales,"VENTAS");
  }

  const missing=crossSearchMatrix.filter(r=>!(r.VENTAS.length+r.LIQUIDACION.length+r.DATA.length+r.CLAWBACK.length+r.AJUSTES.length)).map(r=>[r.value]);
  if(missing.length){
    const wsMiss=XLSX.utils.aoa_to_sheet([["No encontrados"],...missing]);
    wsMiss["!cols"]=[{wch:30}];
    XLSX.utils.book_append_sheet(wb,wsMiss,"No encontrados");
  }
  XLSX.writeFile(wb,`Cruce_DNI_Transacciones_${timestampFile()}.xlsx`,{compression:true});
};


/* ===== Permisos ampliados para todos los módulos nuevos ===== */
function crmCan(key){
  return !!(perms?.is_admin || perms?.[key]);
}
function crmShowNav(selector,allowed){
  document.querySelectorAll(selector).forEach(el=>el.style.display=allowed?"block":"none");
}
function crmApplyExpandedPermissions(){
  // Navegación principal
  crmShowNav('.nav[data-view="dashboard"]',crmCan("can_view_dashboard"));
  crmShowNav('.nav[data-view="alerts"]',crmCan("can_view_alerts"));
  crmShowNav('.nav[data-view="sales"]',crmCan("can_view_sales")||crmCan("can_edit_sales"));
  crmShowNav('.nav[data-view="database"]',crmCan("can_view_database"));
  crmShowNav('.nav[data-view="import"]',crmCan("can_manage_imports"));
  crmShowNav('.nav[data-view="agenda"]',crmCan("can_view_agenda")||crmCan("can_manage_agenda"));
  crmShowNav('.nav[data-view="whatsapplive"]',crmCan("can_use_whatsapp"));
  crmShowNav('.nav[data-view="whatsapp"]',crmCan("can_schedule_whatsapp"));
  crmShowNav('.nav[data-view="labels"]',crmCan("can_manage_labels"));
  crmShowNav('.nav[data-view="automations"]',crmCan("can_manage_automations"));
  crmShowNav('.nav[data-view="settings"]',crmCan("can_view_settings"));
  crmShowNav('.nav[data-view="users"]',crmCan("can_manage_users"));
  crmShowNav('.nav[data-view="system"]',!!perms?.is_admin);

  // Acceso por hoja
  document.querySelectorAll('.nav[data-view="search"][data-sheet]').forEach(n=>{
    const s=String(n.dataset.sheet||"").toUpperCase();
    const map={LIQUIDACION:"can_view_liquidacion",DATA:"can_view_data",CLAWBACK:"can_view_clawback",AJUSTES:"can_view_ajustes"};
    n.style.display=crmCan(map[s]||"can_use_advanced_search")?"block":"none";
  });

  // Herramientas avanzadas de búsqueda y Excel
  ["multiSearchBtn","crossSearchBtn"].forEach(id=>{if($(id))$(id).style.display=crmCan("can_use_advanced_search")?"inline-flex":"none"});
  ["exportSearchExcel","exportFullSheetExcel","multiSearchExport","crossSearchExport"].forEach(id=>{if($(id))$(id).style.display=crmCan("can_export_excel")?"inline-flex":"none"});

  // Gestión específica
  ["customFieldsManageBtn","contactCustomFieldsManage"].forEach(id=>{if($(id))$(id).style.display=crmCan("can_manage_custom_fields")?"inline-flex":"none"});
  if($("dashGoalEdit"))$("dashGoalEdit").style.display=crmCan("can_manage_goals")?"inline-flex":"none";
  ["waAddTagSide","waTagChat"].forEach(id=>{if($(id))$(id).style.display=crmCan("can_manage_labels")?"inline-flex":"none"});

  // Acciones de Contactos
  if($("dbSave"))$("dbSave").style.display=crmCan("can_create_database")?"inline-flex":"none";
  if($("contactSave"))$("contactSave").style.display=crmCan("can_edit_records")?"inline-flex":"none";
  if($("contactDelete"))$("contactDelete").style.display=crmCan("can_delete_records")?"inline-flex":"none";

  // WhatsApp / plantillas
  if($("waTemplateBtn"))$("waTemplateBtn").style.display=(crmCan("can_use_whatsapp")&&crmCan("can_manage_templates"))?"inline-flex":"none";
  if($("waScheduleBtn"))$("waScheduleBtn").style.display=crmCan("can_schedule_whatsapp")?"inline-flex":"none";
}
window.crmApplyExpandedPermissions=crmApplyExpandedPermissions;

// Evitar acceso directo a vistas sin permiso mediante manipulación del DOM.
const _openAppViewPermissions=window.openAppView;
window.openAppView=function(view){
  const rule={
    dashboard:"can_view_dashboard",alerts:"can_view_alerts",database:"can_view_database",
    sales:"can_view_sales",import:"can_manage_imports",agenda:"can_view_agenda",
    whatsapplive:"can_use_whatsapp",whatsapp:"can_schedule_whatsapp",
    labels:"can_manage_labels",automations:"can_manage_automations",
    settings:"can_view_settings",users:"can_manage_users"
  }[view];
  if(rule&&!crmCan(rule)){alert("No tienes permiso para acceder a esta sección.");return}
  return _openAppViewPermissions? _openAppViewPermissions(view):undefined;
};

// Proteger acciones sensibles aunque se intente dispararlas manualmente.
if($("multiSearchBtn")){const f=$("multiSearchBtn").onclick;$("multiSearchBtn").onclick=function(e){if(!crmCan("can_use_advanced_search"))return alert("No tienes permiso para búsqueda múltiple.");return f?.call(this,e)}}
if($("crossSearchBtn")){const f=$("crossSearchBtn").onclick;$("crossSearchBtn").onclick=function(e){if(!crmCan("can_use_advanced_search"))return alert("No tienes permiso para cruces.");return f?.call(this,e)}}
if($("exportFullSheetExcel")){const f=$("exportFullSheetExcel").onclick;$("exportFullSheetExcel").onclick=function(e){if(!crmCan("can_export_excel"))return alert("No tienes permiso para exportar.");return f?.call(this,e)}}
if($("customFieldsManageBtn")){const f=$("customFieldsManageBtn").onclick;$("customFieldsManageBtn").onclick=function(e){if(!crmCan("can_manage_custom_fields"))return alert("No tienes permiso para gestionar campos personalizados.");return f?.call(this,e)}}
if($("dashGoalEdit")){const f=$("dashGoalEdit").onclick;$("dashGoalEdit").onclick=function(e){if(!crmCan("can_manage_goals"))return alert("No tienes permiso para gestionar objetivos.");return f?.call(this,e)}}


/* ===== Control de visibilidad por permisos actualizado ===== */
function applyCurrentPermissions(){
 const admin=!!perms?.is_admin;
 const show=(selector,allowed)=>{const el=document.querySelector(selector);if(el)el.style.display=(admin||allowed)?"block":"none"};
 show('[data-view="dashboard"]',perms?.can_view_dashboard);
 show('[data-view="alerts"]',perms?.can_view_alerts);
 document.querySelectorAll('.nav[data-view="search"]').forEach(n=>{
   const s=String(n.dataset.sheet||"").toUpperCase();
   let ok=true;
   if(s==="LIQUIDACION")ok=perms?.can_view_liquidacion;
   else if(s==="DATA")ok=perms?.can_view_data;
   else if(s==="CLAWBACK")ok=perms?.can_view_clawback;
   else if(s==="AJUSTES")ok=perms?.can_view_ajustes;
   n.style.display=(admin||ok)?"block":"none";
 });
 show('[data-view="database"]',perms?.can_view_database);
 show('[data-view="sales"]',perms?.can_view_sales);
 show('[data-view="import"]',perms?.can_manage_imports);
 show('[data-view="agenda"]',perms?.can_view_agenda||perms?.can_manage_agenda);
 show('[data-view="whatsapplive"]',perms?.can_use_whatsapp);
 show('[data-view="whatsapp"]',perms?.can_schedule_whatsapp);
 show('[data-view="labels"]',perms?.can_manage_labels);
 show('[data-view="automations"]',perms?.can_manage_automations);
 show('[data-view="settings"]',perms?.can_view_settings);
 show('[data-view="users"]',perms?.can_manage_users);
 show('[data-view="system"]',admin);

 if($("customFieldsManageBtn"))$("customFieldsManageBtn").style.display=(admin||perms?.can_manage_custom_fields)?"inline-block":"none";
 if($("contactCustomFieldsManage"))$("contactCustomFieldsManage").style.display=(admin||perms?.can_manage_custom_fields)?"inline-block":"none";
 if($("dashGoalEdit"))$("dashGoalEdit").style.display=(admin||perms?.can_manage_goals)?"inline-block":"none";
 if($("exportSearchExcel"))$("exportSearchExcel").dataset.permBlocked=(!admin&&!perms?.can_export_excel)?"1":"0";
 if($("exportFullSheetExcel"))$("exportFullSheetExcel").style.display=(admin||perms?.can_export_excel)?"inline-block":"none";
 if($("multiSearchBtn"))$("multiSearchBtn").style.display=(admin||perms?.can_use_advanced_search)?"inline-block":"none";
 if($("crossSearchBtn"))$("crossSearchBtn").style.display=(admin||perms?.can_use_advanced_search)?"inline-block":"none";
}
const _enterAppPermissions=enterApp;
enterApp=async function(user){const r=await _enterAppPermissions(user);applyCurrentPermissions();return r};


/* ===== Refuerzo final de permisos de acciones ===== */
function crmGuardClick(id,perm,msg){
  const el=$(id); if(!el||el.dataset.crmGuarded==="1")return;
  const original=el.onclick;
  el.onclick=function(e){
    if(!crmCan(perm)){alert(msg||"No tienes permiso para realizar esta acción.");return}
    return original?.call(this,e);
  };
  el.dataset.crmGuarded="1";
}
function crmApplyActionGuards(){
  crmGuardClick("dbSave","can_create_database","No tienes permiso para crear contactos.");
  crmGuardClick("contactSave","can_edit_records","No tienes permiso para editar contactos.");
  crmGuardClick("contactDelete","can_delete_records","No tienes permiso para eliminar contactos.");
  crmGuardClick("waTemplateBtn","can_manage_templates","No tienes permiso para gestionar plantillas.");
  crmGuardClick("waTemplateSave","can_manage_templates","No tienes permiso para guardar plantillas.");
  crmGuardClick("oppModalSave","can_edit_sales","No tienes permiso para editar oportunidades.");
  crmGuardClick("oppModalDelete","can_edit_sales","No tienes permiso para eliminar oportunidades.");
  crmGuardClick("newOpp","can_edit_sales","No tienes permiso para crear oportunidades.");
  crmGuardClick("newStage","can_manage_sales_fields","No tienes permiso para gestionar columnas de ventas.");
}
setTimeout(()=>{crmApplyExpandedPermissions();crmApplyActionGuards()},300);


/* ===== Navegación uniforme Volver ===== */
const CRM_BACK_TARGETS=[
  ["crossSearchModal","crossSearchClose"],["multiSearchModal","multiSearchClose"],
  ["customFieldsModal","customFieldsClose"],["goalModal","goalModalClose"],
  ["contactLabelsModal","contactLabelsClose"],["waAnalyticsModal","waAnalyticsClose"],
  ["waFilePreviewModal","waFilePreviewClose"],["waMsgActionModal","waMsgActionClose"],
  ["waMediaModal","waMediaClose"],["waTemplateModal","waTemplateClose"],
  ["waQuickModal","waQuickClose"],["oppDetailModal","oppModalClose"],
  ["contactModal","contactClose"]
];
function crmBackFromOpenLayer(){
  for(const [layerId,buttonId] of CRM_BACK_TARGETS){
    const layer=$(layerId);
    if(layer&&!layer.classList.contains("hidden")){
      const btn=$(buttonId);
      if(btn){btn.click();return true}
      layer.classList.add("hidden");return true;
    }
  }
  if($("opportunityFullPage")&&!$("opportunityFullPage").classList.contains("hidden")){
    $("oppFullBack")?.click();return true;
  }
  return false;
}
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&crmBackFromOpenLayer()){e.preventDefault();e.stopPropagation()}
});
window.crmBackFromOpenLayer=crmBackFromOpenLayer;


/* ===== Resumen de ventas desplegable ===== */
(function(){
  const toggle=$("salesSummaryToggle"),panel=$("salesSummaryPanel"),chev=$("salesSummaryChevron");
  if(!toggle||!panel)return;
  const key="tpf_sales_summary_open";
  const apply=open=>{
    panel.classList.toggle("hidden",!open);
    toggle.setAttribute("aria-expanded",open?"true":"false");
    if(chev)chev.textContent=open?"⌃":"⌄";
    try{localStorage.setItem(key,open?"1":"0")}catch(e){}
  };
  let initial=true;
  try{const v=localStorage.getItem(key);if(v!==null)initial=v==="1"}catch(e){}
  apply(initial);
  toggle.onclick=()=>apply(panel.classList.contains("hidden"));
})();

async function refreshSalesCollapsibleGoal(){
  if(!$("salesSummaryGoal"))return;
  try{
    const start=new Date();start.setDate(1);start.setHours(0,0,0,0);
    const month=start.toISOString().slice(0,10);
    const {data,error}=await sb.rpc("crm_get_month_goal",{p_month:month});
    if(error)throw error;
    const target=Number(data?.[0]?.target_amount||0);
    const stages=salesCache?.stages||[],opps=salesCache?.opportunities||[];
    const stageName=id=>(stages.find(s=>String(s.id)===String(id))?.name||"").toLowerCase();
    const won=opps.filter(o=>/ganad|cerrad.*gan|won/.test(stageName(o.stage_id)));
    const wonAmount=won.reduce((s,o)=>s+Number(o.amount||0),0);
    $("salesSummaryGoal").textContent=target?`${fmtMoney(wonAmount)} / ${fmtMoney(target)}`:"Sin objetivo";
    if($("salesSummaryProgressBar"))$("salesSummaryProgressBar").style.width=target?Math.min(100,Math.round(wonAmount/target*100))+"%":"0%";
  }catch(e){
    $("salesSummaryGoal").textContent="—";
  }
}
const _renderSalesSummaryCollapsible=renderSales;
renderSales=function(){
  const r=_renderSalesSummaryCollapsible.apply(this,arguments);
  setTimeout(refreshSalesCollapsibleGoal,0);
  return r;
};

/* ---- script inline extraído ---- */

(function(){
  const byId=(id)=>document.getElementById(id);
  let finalOrigin={type:"generic",chatId:null,contactId:null};

  function captureFinalOrigin(){
    try{
      if(!byId("view-whatsapplive")?.classList.contains("hidden")){
        finalOrigin={
          type:"whatsapp",
          chatId:(typeof waLiveState!=="undefined" ? waLiveState?.selected?.id : null)||null,
          contactId:(typeof waLiveState!=="undefined" ? waLiveState?.contact?.id : null)||null
        };
      }else if(!byId("contactModal")?.classList.contains("hidden")){
        finalOrigin={
          type:"contact",
          chatId:null,
          contactId:(typeof currentContact!=="undefined" ? currentContact?.id : null)||null
        };
      }else if(finalOrigin.type!=="whatsapp" && finalOrigin.type!=="contact"){
        finalOrigin={type:"generic",chatId:null,contactId:null};
      }
    }catch(_){}
  }

  const oldOpenFull=window.openOpportunityFull;
  if(typeof oldOpenFull==="function"){
    window.openOpportunityFull=async function(id){
      captureFinalOrigin();
      return oldOpenFull.call(this,id);
    };
  }

  const oldOpenCard=window.openOpportunityCard;
  if(typeof oldOpenCard==="function"){
    window.openOpportunityCard=function(id){
      if(finalOrigin.type==="generic")captureFinalOrigin();
      return oldOpenCard.call(this,id);
    };
  }

  async function finalReturn(){
    byId("opportunityFullPage")?.classList.add("hidden");
    byId("oppDetailModal")?.classList.add("hidden");

    if(finalOrigin.type==="whatsapp"){
      if(byId("view-whatsapplive")?.classList.contains("hidden")){
        document.querySelector('.nav[data-view="whatsapplive"]')?.click();
        await new Promise(r=>setTimeout(r,120));
      }
      if(finalOrigin.chatId && typeof selectWhatsAppChat==="function"){
        if(String((typeof waLiveState!=="undefined" ? waLiveState?.selected?.id : "")||"")!==String(finalOrigin.chatId)){
          try{await selectWhatsAppChat(finalOrigin.chatId)}catch(_){}
        }
      }
      return;
    }

    if(finalOrigin.type==="contact" && finalOrigin.contactId && typeof openContact==="function"){
      try{await openContact(finalOrigin.contactId)}catch(_){}
      return;
    }

    try{
      if(typeof tpfBackExactly==="function")await tpfBackExactly();
    }catch(_){}
  }

  async function finalRefreshEverywhere(){
    try{if(typeof loadSales==="function")await loadSales()}catch(_){}
    try{
      if(typeof waLiveState!=="undefined" && waLiveState?.contact && typeof loadWaContactSideData==="function"){
        const phone=typeof waNormalizePhone==="function" ? waNormalizePhone(waLiveState.selected?.id||"") : "";
        await loadWaContactSideData(waLiveState.contact,phone);
      }
    }catch(_){}
    try{
      if(typeof currentContact!=="undefined" && currentContact && typeof renderContactProfile==="function"){
        await renderContactProfile();
      }
    }catch(_){}
  }

  async function finalDelete(id,title){
    if(!id)return false;
    if(!confirm(`¿Eliminar definitivamente "${title||"Oportunidad"}"?`))return false;

    if(typeof sb==="undefined" || !sb)throw new Error("No hay conexión con la base de datos.");

    const {error}=await sb.rpc("delete_sales_opportunity",{opportunity_id:id});
    if(error)throw error;

    const check=await sb.from("sales_opportunities").select("id").eq("id",id).maybeSingle();
    if(check?.error)throw check.error;
    if(check?.data)throw new Error("La oportunidad sigue existiendo después del borrado.");

    if(typeof salesCache!=="undefined" && salesCache?.opportunities){
      salesCache.opportunities=salesCache.opportunities.filter(o=>String(o.id)!==String(id));
    }

    await finalRefreshEverywhere();
    return true;
  }

  const back=byId("oppFullBack");
  if(back){
    back.onclick=async function(e){
      e.preventDefault();
      e.stopPropagation();
      await finalReturn();
    };
  }

  const fullDelete=byId("oppFullDelete");
  if(fullDelete){
    fullDelete.onclick=async function(e){
      e.preventDefault();
      e.stopPropagation();
      if(typeof currentFullOpportunity==="undefined" || !currentFullOpportunity)return;
      fullDelete.disabled=true;
      try{
        const ok=await finalDelete(currentFullOpportunity.id,currentFullOpportunity.title||"Oportunidad");
        if(ok){
          currentFullOpportunity=null;
          await finalReturn();
        }
      }catch(err){
        alert(err?.message||"No se pudo eliminar la oportunidad.");
      }finally{
        fullDelete.disabled=false;
      }
    };
  }

  const modalBack=byId("oppModalClose");
  if(modalBack){
    modalBack.onclick=async function(e){
      e.preventDefault();
      e.stopPropagation();
      await finalReturn();
    };
  }

  const modalDelete=byId("oppModalDelete");
  if(modalDelete){
    modalDelete.onclick=async function(e){
      e.preventDefault();
      e.stopPropagation();
      const id=byId("oppModalId")?.value||"";
      const title=byId("oppModalTitle")?.value?.trim()||"Oportunidad";
      if(!id)return;
      modalDelete.disabled=true;
      try{
        const ok=await finalDelete(id,title);
        if(ok)await finalReturn();
      }catch(err){
        alert(err?.message||"No se pudo eliminar la oportunidad.");
      }finally{
        modalDelete.disabled=false;
      }
    };
  }
})();

/* ---- script inline extraído ---- */

(function(){
  const byId=(id)=>document.getElementById(id);

  async function refreshAllOpportunityViews(){
    try{if(typeof loadSales==="function")await loadSales()}catch(_){}
    try{
      if(typeof waLiveState!=="undefined" && waLiveState?.contact && typeof loadWaContactSideData==="function"){
        const phone=typeof waNormalizePhone==="function"
          ? waNormalizePhone(waLiveState.selected?.id||"")
          : "";
        await loadWaContactSideData(waLiveState.contact,phone);
      }
    }catch(_){}
    try{
      if(typeof currentContact!=="undefined" && currentContact && typeof renderContactProfile==="function"){
        await renderContactProfile();
      }
    }catch(_){}
  }

  async function deleteOpportunityOneWay(id,title){
    if(!id)throw new Error("No se ha encontrado el ID de la oportunidad.");
    if(typeof sb==="undefined" || !sb)throw new Error("No hay conexión con Supabase.");

    const label=String(title||"Oportunidad");
    if(!confirm(`¿Eliminar definitivamente "${label}"?`))return false;

    // 1) Borrado DIRECTO. Pedimos que devuelva la fila eliminada.
    const direct=await sb
      .from("sales_opportunities")
      .delete()
      .eq("id",id)
      .select("id");

    if(direct?.error)throw direct.error;

    let deleted=Array.isArray(direct?.data) && direct.data.some(x=>String(x.id)===String(id));

    // 2) Si por cualquier motivo el DELETE directo no devolvió fila,
    // usamos el RPC existente y volvemos a verificar.
    if(!deleted){
      const rpc=await sb.rpc("delete_sales_opportunity",{opportunity_id:id});
      if(rpc?.error)throw rpc.error;

      const check=await sb
        .from("sales_opportunities")
        .select("id")
        .eq("id",id)
        .maybeSingle();

      if(check?.error)throw check.error;
      deleted=!check?.data;
    }

    if(!deleted){
      throw new Error("Supabase no ha eliminado la oportunidad.");
    }

    // Quitar de la caché inmediatamente.
    if(typeof salesCache!=="undefined" && salesCache?.opportunities){
      salesCache.opportunities=salesCache.opportunities.filter(
        o=>String(o.id)!==String(id)
      );
    }

    await refreshAllOpportunityViews();
    return true;
  }

  // TARJETAS WhatsApp / ficha cliente / otros listados.
  window.oppUnifiedDelete=async function(id,title){
    try{
      return await deleteOpportunityOneWay(id,title);
    }catch(err){
      alert(err?.message||"No se pudo eliminar la oportunidad.");
      return false;
    }
  };

  // Panel de ventas antiguo.
  window.deleteOpp=async function(id){
    const o=(typeof salesCache!=="undefined" && salesCache?.opportunities||[])
      .find(x=>String(x.id)===String(id));
    try{
      return await deleteOpportunityOneWay(id,o?.title||"Oportunidad");
    }catch(err){
      alert(err?.message||"No se pudo eliminar la oportunidad.");
      return false;
    }
  };

  // MODAL de editar oportunidad.
  const modalDelete=byId("oppModalDelete");
  if(modalDelete){
    modalDelete.onclick=async function(e){
      e.preventDefault();
      e.stopPropagation();

      const id=byId("oppModalId")?.value||"";
      const title=byId("oppModalTitle")?.value?.trim()||"Oportunidad";
      if(!id)return;

      modalDelete.disabled=true;
      try{
        const ok=await deleteOpportunityOneWay(id,title);
        if(ok){
          byId("oppDetailModal")?.classList.add("hidden");
          // El origen queda debajo; no tocamos Volver de v13.
        }
      }catch(err){
        alert(err?.message||"No se pudo eliminar la oportunidad.");
      }finally{
        modalDelete.disabled=false;
      }
    };
  }

  // FICHA COMPLETA de oportunidad.
  const fullDelete=byId("oppFullDelete");
  if(fullDelete){
    fullDelete.onclick=async function(e){
      e.preventDefault();
      e.stopPropagation();

      if(typeof currentFullOpportunity==="undefined" || !currentFullOpportunity)return;
      const id=currentFullOpportunity.id;
      const title=currentFullOpportunity.title||"Oportunidad";

      fullDelete.disabled=true;
      try{
        const ok=await deleteOpportunityOneWay(id,title);
        if(ok){
          currentFullOpportunity=null;
          byId("opportunityFullPage")?.classList.add("hidden");
          // Pulsamos el mismo Volver que YA funciona en v13.
          const back=byId("oppFullBack");
          if(back && typeof back.onclick==="function"){
            await back.onclick(new Event("click"));
          }
        }
      }catch(err){
        alert(err?.message||"No se pudo eliminar la oportunidad.");
      }finally{
        fullDelete.disabled=false;
      }
    };
  }
})();

/* ---- script inline extraído ---- */

(function(){
  const BACK_MAP={"contactClose": "contactModal", "cpTaskBack": "cpTaskPage", "cpTaskDetailBack": "cpTaskDetailPage", "oppFullBack": "opportunityFullPage", "waQuickClose": "waQuickModal", "waQuickCancel": "waQuickModal", "salesFullBackBtn": "view-sales", "waTemplateClose": "waTemplateModal", "waMediaClose": "waMediaModal", "waMsgActionClose": "waMsgActionModal", "waFilePreviewClose": "waFilePreviewModal", "waAnalyticsClose": "waAnalyticsModal", "oppModalCloseX": "oppDetailModal", "oppModalClose": "oppDetailModal", "contactLabelsClose": "contactLabelsModal", "goalModalClose": "goalModal", "customFieldsClose": "customFieldsModal", "multiSearchClose": "multiSearchModal", "crossSearchClose": "crossSearchModal"};
  const sealed={};

  function fallbackBack(buttonId,layerId){
    // Principal/detail pages: use the CRM's exact navigation history first.
    if(["contactClose","cpTaskBack","cpTaskDetailBack","salesFullBackBtn"].includes(buttonId)){
      if(typeof tpfBackExactly==="function"){
        return Promise.resolve(tpfBackExactly()).then(ok=>{
          if(ok)return true;
          const layer=document.getElementById(layerId);
          if(layer)layer.classList.add("hidden");
          return true;
        });
      }
    }

    const layer=document.getElementById(layerId);
    if(layer){
      layer.classList.add("hidden");
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }

  Object.entries(BACK_MAP).forEach(([buttonId,layerId])=>{
    const btn=document.getElementById(buttonId);
    if(!btn)return;

    // Capture the handler that is active AFTER every legacy CRM script.
    // This preserves special behaviours such as Opportunity -> exact WhatsApp chat.
    const activeHandler=btn.onclick;
    sealed[buttonId]=typeof activeHandler==="function";

    btn.onclick=async function(ev){
      ev?.preventDefault?.();
      ev?.stopPropagation?.();

      let result;
      if(typeof activeHandler==="function"){
        try{
          result=await activeHandler.call(btn,ev);
        }catch(err){
          console.error("Volver "+buttonId,err);
          result=undefined;
        }
      }

      // If the screen/modal stayed open, execute a deterministic fallback.
      const layer=document.getElementById(layerId);
      const stillOpen=layer && !layer.classList.contains("hidden");
      if(stillOpen){
        await fallbackBack(buttonId,layerId);
      }
      return result;
    };
    btn.dataset.tpfBackAudited="v15";
  });

  window.__TPF_BACK_AUDIT={
    version:"v15",
    expected:Object.keys(BACK_MAP).length,
    bound:Object.keys(BACK_MAP).filter(id=>document.getElementById(id)?.dataset.tpfBackAudited==="v15"),
    inheritedHandlers:sealed
  };
})();

/* ---- script inline extraído ---- */

(function(){
  const byId=(id)=>document.getElementById(id);
  let contactReturnToWhatsApp=null;

  function captureWhatsAppOrigin(){
    try{
      if(!byId("view-whatsapplive")?.classList.contains("hidden") && typeof waLiveState!=="undefined"){
        return {
          chatId:waLiveState?.selected?.id||null,
          contactId:waLiveState?.contact?.id||null
        };
      }
    }catch(_){}
    return null;
  }

  async function returnExactlyToWhatsApp(origin){
    if(!origin)return false;

    byId("contactModal")?.classList.add("hidden");
    byId("opportunityFullPage")?.classList.add("hidden");
    byId("oppDetailModal")?.classList.add("hidden");

    const waView=byId("view-whatsapplive");
    if(waView?.classList.contains("hidden")){
      document.querySelector('.nav[data-view="whatsapplive"]')?.click();
      await new Promise(r=>setTimeout(r,120));
    }

    if(origin.chatId && typeof selectWhatsAppChat==="function"){
      const current=(typeof waLiveState!=="undefined" ? waLiveState?.selected?.id : null);
      if(String(current||"")!==String(origin.chatId)){
        try{await selectWhatsAppChat(origin.chatId)}catch(_){}
      }
    }
    return true;
  }

  // WhatsApp -> Ver ficha completa -> Volver al mismo chat
  const oldOpenMatched=window.openWaMatchedContact;
  window.openWaMatchedContact=async function(){
    const origin=captureWhatsAppOrigin();
    if(origin)contactReturnToWhatsApp=origin;
    if(typeof oldOpenMatched==="function"){
      return oldOpenMatched.apply(this,arguments);
    }
  };

  const sideOpen=byId("waSideOpenContact");
  if(sideOpen){
    sideOpen.onclick=async function(e){
      e?.preventDefault?.();
      e?.stopPropagation?.();
      const origin=captureWhatsAppOrigin();
      if(origin)contactReturnToWhatsApp=origin;
      if(typeof waLiveState==="undefined" || !waLiveState?.contact)return;
      await openContact(waLiveState.contact.id);
    };
  }

  const contactBack=byId("contactClose");
  if(contactBack){
    const oldContactBack=contactBack.onclick;
    contactBack.onclick=async function(e){
      e?.preventDefault?.();
      e?.stopPropagation?.();

      if(contactReturnToWhatsApp){
        const origin=contactReturnToWhatsApp;
        contactReturnToWhatsApp=null;
        await returnExactlyToWhatsApp(origin);
        return;
      }

      if(typeof oldContactBack==="function"){
        return oldContactBack.call(contactBack,e);
      }
      byId("contactModal")?.classList.add("hidden");
    };
  }

  async function refreshOpportunityViews(){
    try{if(typeof loadSales==="function")await loadSales()}catch(_){}
    try{
      if(typeof waLiveState!=="undefined" && waLiveState?.contact && typeof loadWaContactSideData==="function"){
        const phone=typeof waNormalizePhone==="function"
          ? waNormalizePhone(waLiveState.selected?.id||"")
          : "";
        await loadWaContactSideData(waLiveState.contact,phone);
      }
    }catch(_){}
    try{
      if(typeof currentContact!=="undefined" && currentContact && typeof renderContactProfile==="function"){
        await renderContactProfile();
      }
    }catch(_){}
  }

  async function deleteOpportunityV18(id,title){
    if(!id)throw new Error("No se ha encontrado la oportunidad.");
    if(typeof sb==="undefined" || !sb)throw new Error("No hay conexión con Supabase.");
    if(!confirm(`¿Eliminar definitivamente "${title||"Oportunidad"}"?`))return false;

    const {data,error}=await sb.rpc("crm_delete_sales_opportunity_v2",{p_opportunity_id:id});
    if(error)throw error;
    if(data!==true)throw new Error("Supabase no ha eliminado la oportunidad.");

    const check=await sb.from("sales_opportunities").select("id").eq("id",id).maybeSingle();
    if(check?.error)throw check.error;
    if(check?.data)throw new Error("La oportunidad sigue existiendo después del borrado.");

    if(typeof salesCache!=="undefined" && salesCache?.opportunities){
      salesCache.opportunities=salesCache.opportunities.filter(o=>String(o.id)!==String(id));
    }

    await refreshOpportunityViews();
    return true;
  }

  window.oppUnifiedDelete=async function(id,title){
    try{
      return await deleteOpportunityV18(id,title);
    }catch(err){
      alert(err?.message||"No se pudo eliminar la oportunidad.");
      return false;
    }
  };

  window.deleteOpp=async function(id){
    const o=(typeof salesCache!=="undefined" && salesCache?.opportunities||[])
      .find(x=>String(x.id)===String(id));
    try{
      return await deleteOpportunityV18(id,o?.title||"Oportunidad");
    }catch(err){
      alert(err?.message||"No se pudo eliminar la oportunidad.");
      return false;
    }
  };

  const modalDelete=byId("oppModalDelete");
  if(modalDelete){
    modalDelete.onclick=async function(e){
      e?.preventDefault?.();
      e?.stopPropagation?.();
      const id=byId("oppModalId")?.value||"";
      const title=byId("oppModalTitle")?.value?.trim()||"Oportunidad";
      if(!id)return;
      modalDelete.disabled=true;
      try{
        if(await deleteOpportunityV18(id,title)){
          byId("oppDetailModal")?.classList.add("hidden");
        }
      }catch(err){
        alert(err?.message||"No se pudo eliminar la oportunidad.");
      }finally{
        modalDelete.disabled=false;
      }
    };
  }

  const fullDelete=byId("oppFullDelete");
  if(fullDelete){
    fullDelete.onclick=async function(e){
      e?.preventDefault?.();
      e?.stopPropagation?.();
      if(typeof currentFullOpportunity==="undefined" || !currentFullOpportunity)return;

      const id=currentFullOpportunity.id;
      const title=currentFullOpportunity.title||"Oportunidad";
      fullDelete.disabled=true;
      try{
        if(await deleteOpportunityV18(id,title)){
          currentFullOpportunity=null;
          byId("opportunityFullPage")?.classList.add("hidden");
        }
      }catch(err){
        alert(err?.message||"No se pudo eliminar la oportunidad.");
      }finally{
        fullDelete.disabled=false;
      }
    };
  }

  window.__TPF_V18_VIDEO_FIX={
    delete_rpc:"crm_delete_sales_opportunity_v2",
    contact_back:"explicit_whatsapp_origin"
  };
})();

/* ---- script inline extraído ---- */

(function(){
  const previousDelete=window.oppUnifiedDelete;
  window.oppUnifiedDelete=async function(id,title){
    let resolvedTitle=title;
    if(!resolvedTitle){
      try{
        const o=(typeof salesCache!=="undefined" && salesCache?.opportunities||[])
          .find(x=>String(x.id)===String(id));
        resolvedTitle=o?.title||"Oportunidad";
      }catch(_){
        resolvedTitle="Oportunidad";
      }
    }
    return previousDelete(id,resolvedTitle);
  };
})();

/* ---- script inline extraído ---- */

(function(){
  const workingDelete=window.oppUnifiedDelete;

  async function fetchOpportunityRow(id){
    if(typeof sb==="undefined" || !sb)throw new Error("No hay conexión con Supabase.");
    const {data,error}=await sb
      .from("sales_opportunities")
      .select("*")
      .eq("id",id)
      .maybeSingle();
    if(error)throw error;
    return data||null;
  }

  async function ensureTrashCopy(id,title){
    const row=await fetchOpportunityRow(id);
    if(!row)throw new Error("No se ha encontrado la oportunidad para enviarla a la papelera.");

    // Evitar duplicar la misma oportunidad en papelera si se pulsa dos veces.
    const existing=await sb
      .from("crm_trash")
      .select("id")
      .eq("entity_type","opportunity")
      .eq("entity_id",id)
      .order("deleted_at",{ascending:false})
      .limit(1);

    if(existing?.error)throw existing.error;
    if(existing?.data?.length)return row;

    const {error}=await sb.from("crm_trash").insert({
      entity_type:"opportunity",
      entity_id:id,
      label:row.title||title||"Oportunidad",
      payload:{opportunity:row}
    });
    if(error)throw error;

    // Verificación real de que la copia quedó en papelera.
    const verify=await sb
      .from("crm_trash")
      .select("id")
      .eq("entity_type","opportunity")
      .eq("entity_id",id)
      .order("deleted_at",{ascending:false})
      .limit(1);

    if(verify?.error)throw verify.error;
    if(!verify?.data?.length)throw new Error("No se pudo guardar la oportunidad en la papelera.");

    return row;
  }

  window.oppUnifiedDelete=async function(id,title){
    try{
      // Primero garantizar copia recuperable.
      await ensureTrashCopy(id,title);

      // Después usar exactamente el borrado v19 que ya ha sido probado en uso real.
      const ok=await workingDelete(id,title);

      if(!ok){
        // Si el usuario cancela el confirm del borrado, retirar la copia preventiva
        // para no dejar una falsa eliminación en papelera.
        try{
          const check=await fetchOpportunityRow(id);
          if(check){
            await sb
              .from("crm_trash")
              .delete()
              .eq("entity_type","opportunity")
              .eq("entity_id",id);
          }
        }catch(_){}
      }
      return ok;
    }catch(err){
      alert(err?.message||"No se pudo enviar la oportunidad a la papelera.");
      return false;
    }
  };

  // Los demás puntos de borrado pasan también por la misma ruta.
  window.deleteOpp=async function(id){
    let title="Oportunidad";
    try{
      const o=(typeof salesCache!=="undefined" && salesCache?.opportunities||[])
        .find(x=>String(x.id)===String(id));
      title=o?.title||title;
    }catch(_){}
    return window.oppUnifiedDelete(id,title);
  };

  const modalDelete=document.getElementById("oppModalDelete");
  if(modalDelete){
    modalDelete.onclick=async function(e){
      e?.preventDefault?.();
      e?.stopPropagation?.();
      const id=document.getElementById("oppModalId")?.value||"";
      const title=document.getElementById("oppModalTitle")?.value?.trim()||"Oportunidad";
      if(!id)return;
      modalDelete.disabled=true;
      try{
        const ok=await window.oppUnifiedDelete(id,title);
        if(ok)document.getElementById("oppDetailModal")?.classList.add("hidden");
      }finally{
        modalDelete.disabled=false;
      }
    };
  }

  const fullDelete=document.getElementById("oppFullDelete");
  if(fullDelete){
    fullDelete.onclick=async function(e){
      e?.preventDefault?.();
      e?.stopPropagation?.();
      if(typeof currentFullOpportunity==="undefined" || !currentFullOpportunity)return;
      const id=currentFullOpportunity.id;
      const title=currentFullOpportunity.title||"Oportunidad";
      fullDelete.disabled=true;
      try{
        const ok=await window.oppUnifiedDelete(id,title);
        if(ok){
          currentFullOpportunity=null;
          document.getElementById("opportunityFullPage")?.classList.add("hidden");
        }
      }finally{
        fullDelete.disabled=false;
      }
    };
  }
})();

/* ---- script inline extraído ---- */

(function(){
  window.waViewOpportunitiesFromSide=async function(){
    if(typeof waLiveState==="undefined" || !waLiveState?.contact)return;

    // Reuse the exact, already-working WhatsApp -> full contact origin capture.
    if(typeof window.openWaMatchedContact==="function"){
      await window.openWaMatchedContact();
    }else{
      await openContact(waLiveState.contact.id);
    }

    // Once the same contact page is open, switch only to Opportunities.
    setTimeout(()=>{
      document.querySelector('.cpTabs span:nth-child(3)')?.click();
    },50);
  };
})();

/* ---- script inline extraído ---- */

(function(){
  async function openWhatsAppOpportunitiesWithReturn(){
    if(typeof waLiveState==="undefined" || !waLiveState?.contact)return;

    // Use the flow already proven to remember the exact WhatsApp chat.
    if(typeof window.openWaMatchedContact==="function"){
      await window.openWaMatchedContact();
    }else{
      await openContact(waLiveState.contact.id);
    }

    // Then open Opportunities inside that same contact record.
    setTimeout(()=>{
      document.querySelector('.cpTabs span:nth-child(3)')?.click();
    },50);
  }

  window.waViewOpportunitiesFromSide=openWhatsAppOpportunitiesWithReturn;

  // CRITICAL FIX: rebind the actual button, because it still held
  // the old function reference from the original app initialization.
  const btn=document.getElementById("waSideViewOpps");
  if(btn){
    btn.onclick=async function(e){
      e?.preventDefault?.();
      e?.stopPropagation?.();
      await openWhatsAppOpportunitiesWithReturn();
    };
    btn.dataset.tpfViewOppsBack="v22";
  }
})();

/* ---- script inline extraído ---- */

(function(){
  const byId=id=>document.getElementById(id);
  const pad=n=>String(n).padStart(2,"0");
  const MONTHS=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

  /* ---------- util picker ---------- */
  function parseLocal(v){
    const m=String(v||"").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    return m?{y:+m[1],m:+m[2]-1,d:+m[3],h:+m[4],min:+m[5]}:null;
  }
  function showDate(v){
    if(!v)return "Seleccionar fecha";
    const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m?`${m[3]}/${m[2]}/${m[1]}`:"Seleccionar fecha";
  }
  function installPicker(hiddenId,prefix,label){
    const hidden=byId(hiddenId);
    if(!hidden || byId(prefix+"Wrap"))return;
    hidden.type="hidden";

    const parent=hidden.parentElement;
    const oldLabel=parent?.querySelector("label.small");
    if(oldLabel)oldLabel.style.display="none";

    const wrap=document.createElement("div");
    wrap.id=prefix+"Wrap";
    wrap.className="tpfPickerGrid";
    wrap.innerHTML=`
      <div class="tpfPickerDate">
        <span class="tpfPickerLabel">${label}</span>
        <button type="button" class="tpfPickerDateBtn" id="${prefix}DateBtn"><span>Seleccionar fecha</span><span>▣</span></button>
        <div class="tpfCalendar" id="${prefix}Cal"></div>
      </div>
      <div><span class="tpfPickerLabel">Hora</span><select id="${prefix}Hour"></select></div>
      <div><span class="tpfPickerLabel">Minutos</span><select id="${prefix}Minute"></select></div>`;
    parent.appendChild(wrap);

    const hour=byId(prefix+"Hour"), minute=byId(prefix+"Minute");
    hour.innerHTML=Array.from({length:24},(_,i)=>`<option value="${i}">${pad(i)}</option>`).join("");
    minute.innerHTML=Array.from({length:60},(_,i)=>`<option value="${i}">${pad(i)}</option>`).join("");

    let dateValue="", shown=new Date();

    function syncFromHidden(){
      const p=parseLocal(hidden.value);
      if(p){
        dateValue=`${p.y}-${pad(p.m+1)}-${pad(p.d)}`;
        hour.value=String(p.h); minute.value=String(p.min); shown=new Date(p.y,p.m,1);
      }else{
        const n=new Date(); dateValue=""; hour.value=String(n.getHours()); minute.value=String(n.getMinutes()); shown=new Date(n.getFullYear(),n.getMonth(),1);
      }
      byId(prefix+"DateBtn").querySelector("span").textContent=showDate(dateValue);
    }
    function syncToHidden(){
      hidden.value=dateValue?`${dateValue}T${pad(hour.value)}:${pad(minute.value)}`:"";
    }
    function renderCalendar(){
      const cal=byId(prefix+"Cal"), y=shown.getFullYear(), mo=shown.getMonth();
      const start=(new Date(y,mo,1).getDay()+6)%7, days=new Date(y,mo+1,0).getDate(), prevDays=new Date(y,mo,0).getDate();
      const sel=dateValue?dateValue.split("-").map(Number):null;
      let cells="";
      for(let i=0;i<42;i++){
        let cy=y,cm=mo,cd,muted=false;
        if(i<start){cd=prevDays-start+i+1;cm--;muted=true;if(cm<0){cm=11;cy--}}
        else if(i>=start+days){cd=i-(start+days)+1;cm++;muted=true;if(cm>11){cm=0;cy++}}
        else cd=i-start+1;
        const selected=sel&&sel[0]===cy&&sel[1]===cm+1&&sel[2]===cd;
        cells+=`<button type="button" class="tpfCalDay${muted?" muted":""}${selected?" selected":""}" data-y="${cy}" data-m="${cm}" data-d="${cd}">${cd}</button>`;
      }
      cal.innerHTML=`
        <div class="tpfCalHead"><button data-prev="1">‹</button><span>${MONTHS[mo]} de ${y}</span><button data-next="1">›</button></div>
        <div class="tpfCalWeek"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
        <div class="tpfCalGrid">${cells}</div>
        <div class="tpfCalFoot"><button data-clear="1">Borrar</button><button data-today="1">Hoy</button></div>`;
      cal.querySelector("[data-prev]").onclick=()=>{shown=new Date(y,mo-1,1);renderCalendar()};
      cal.querySelector("[data-next]").onclick=()=>{shown=new Date(y,mo+1,1);renderCalendar()};
      cal.querySelector("[data-clear]").onclick=()=>{dateValue="";syncToHidden();byId(prefix+"DateBtn").querySelector("span").textContent="Seleccionar fecha";cal.classList.remove("open")};
      cal.querySelector("[data-today]").onclick=()=>{const n=new Date();dateValue=`${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`;shown=new Date(n.getFullYear(),n.getMonth(),1);syncToHidden();byId(prefix+"DateBtn").querySelector("span").textContent=showDate(dateValue);cal.classList.remove("open")};
      cal.querySelectorAll(".tpfCalDay").forEach(b=>b.onclick=()=>{dateValue=`${b.dataset.y}-${pad(Number(b.dataset.m)+1)}-${pad(b.dataset.d)}`;shown=new Date(Number(b.dataset.y),Number(b.dataset.m),1);syncToHidden();byId(prefix+"DateBtn").querySelector("span").textContent=showDate(dateValue);cal.classList.remove("open")});
    }

    byId(prefix+"DateBtn").onclick=()=>{renderCalendar();byId(prefix+"Cal").classList.toggle("open")};
    hour.onchange=syncToHidden; minute.onchange=syncToHidden;
    hidden.__tpfSyncFromHidden=syncFromHidden; hidden.__tpfSyncToHidden=syncToHidden;
    syncFromHidden();
  }

  /* ---------- WhatsApp task origin ---------- */
  let waTaskOrigin=null;
  function captureWaOrigin(){
    try{
      if(!byId("view-whatsapplive")?.classList.contains("hidden") && typeof waLiveState!=="undefined"){
        return {chatId:waLiveState?.selected?.id||null,contactId:waLiveState?.contact?.id||null};
      }
    }catch(_){}
    return null;
  }
  async function returnWaOrigin(){
    const origin=waTaskOrigin; waTaskOrigin=null;
    if(!origin)return false;
    byId("cpTaskPage")?.classList.add("hidden");
    byId("cpTaskDetailPage")?.classList.add("hidden");
    const modal=byId("contactModal"); modal?.classList.add("hidden"); modal?.classList.remove("tpfTaskStandalone");
    const cols=document.querySelector("#contactModal .cpColumns"), top=document.querySelector("#contactModal .cpTop");
    if(cols)cols.style.display=""; if(top)top.style.display="";
    if(byId("view-whatsapplive")?.classList.contains("hidden")){
      document.querySelector('.nav[data-view="whatsapplive"]')?.click();
      await new Promise(r=>setTimeout(r,120));
    }
    if(origin.chatId && typeof selectWhatsAppChat==="function"){
      const current=(typeof waLiveState!=="undefined"?waLiveState?.selected?.id:null);
      if(String(current||"")!==String(origin.chatId)){try{await selectWhatsAppChat(origin.chatId)}catch(_){}}
    }
    return true;
  }

  function openTaskStandalone(){
    const modal=byId("contactModal"), cols=document.querySelector("#contactModal .cpColumns"), top=document.querySelector("#contactModal .cpTop");
    modal?.classList.remove("hidden"); modal?.classList.add("tpfTaskStandalone");
    if(cols)cols.style.display="none"; if(top)top.style.display="none";
    byId("cpTaskPage")?.classList.remove("hidden");
    byId("cpTaskStarts")?.__tpfSyncFromHidden?.();
    byId("cpTaskReminder")?.__tpfSyncFromHidden?.();
  }

  /* ---------- WhatsApp tasks rendering ---------- */
  function taskExpired(task){if(!task?.starts_at||String(task.status)!=="pending")return false;const d=new Date(task.starts_at);return Number.isFinite(d.getTime())&&d.getTime()<Date.now()}
  function taskDate(task){try{return task?.starts_at?new Date(task.starts_at).toLocaleString("es-ES",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"Sin fecha"}catch(_){return "Sin fecha"}}
  function taskCard(task){
    const overdue=taskExpired(task), id=String(task.id||""), title=typeof esc==="function"?esc(task.title||"Tarea"):(task.title||"Tarea"), notes=typeof esc==="function"?esc(task.description||""):(task.description||"");
    return `<div class="waTaskCard${overdue?" overdue":""}">
      <div class="waTaskTop"><b class="waTaskTitle">${title}</b><span class="waTaskBadge${overdue?" overdue":""}">${overdue?"VENCIDA":"PENDIENTE"}</span></div>
      <div class="waTaskMeta">🗓️ ${taskDate(task)}</div>${notes?`<div class="waTaskNotes">${notes}</div>`:""}
      <div class="waTaskActions">
        <button onclick="event.stopPropagation();waTaskEdit('${id}')">Editar</button>
        <button class="complete" onclick="event.stopPropagation();waTaskComplete('${id}')">Completar</button>
        <button class="danger" onclick="event.stopPropagation();waTaskDelete('${id}')">Eliminar</button>
      </div></div>`;
  }
  async function fetchWaTasks(){
    if(typeof waLiveState==="undefined"||!waLiveState?.contact)return [];
    const phone=typeof waNormalizePhone==="function"?waNormalizePhone(waLiveState.selected?.id||""):"", suffix=phone.slice(-9);
    let q=sb.from("agenda_items").select("*").eq("status","pending").order("starts_at",{ascending:true}).limit(40);
    if(suffix)q=q.ilike("customer_phone",`%${suffix}%`);
    const {data,error}=await q;if(error)throw error;return data||[];
  }
  async function renderWaTasks(){
    const box=byId("waSideTasks");if(!box)return;
    try{
      const rows=await fetchWaTasks(), expired=rows.filter(taskExpired).length;
      if(byId("waSideTaskCount"))byId("waSideTaskCount").textContent=String(rows.length);
      box.innerHTML=rows.length?`<div class="waTaskSummary"><div class="waTaskStat"><span>Pendientes</span><b>${rows.length}</b></div><div class="waTaskStat expired"><span>Vencidas</span><b>${expired}</b></div></div>${rows.map(taskCard).join("")}`:'<div class="small">Sin tareas pendientes</div>';
      byId("waSideViewTasks")?.classList.toggle("hidden",rows.length===0);
    }catch(err){console.warn("Tareas WhatsApp",err)}
  }
  async function refreshTasks(){
    try{await renderWaTasks()}catch(_){}
    try{if(typeof loadAgenda==="function")await loadAgenda()}catch(_){}
    try{if(typeof currentContact!=="undefined"&&currentContact&&typeof renderContactProfile==="function")await renderContactProfile()}catch(_){}
  }

  const oldWaSide=window.loadWaContactSideData;
  if(typeof oldWaSide==="function"){
    window.loadWaContactSideData=async function(){const r=await oldWaSide.apply(this,arguments);await renderWaTasks();return r}
  }

  window.waTaskEdit=async id=>{waTaskOrigin=captureWaOrigin();if(typeof waPrepareCurrentContactForCrm==="function")waPrepareCurrentContactForCrm();await openContactTaskDetail(id)};
  window.waTaskComplete=async id=>{try{const {error}=await sb.from("agenda_items").update({status:"completed"}).eq("id",id);if(error)throw error;await refreshTasks()}catch(err){alert(err?.message||"No se pudo completar la tarea.")}};
  window.waTaskDelete=async id=>{
    if(!confirm("¿Eliminar esta tarea? Se enviará a la Papelera."))return;
    try{
      const {data:task,error:rerr}=await sb.from("agenda_items").select("*").eq("id",id).maybeSingle();if(rerr)throw rerr;if(!task)throw new Error("No se ha encontrado la tarea.");
      if(typeof archiveToTrash==="function"){const ok=await archiveToTrash("agenda",id,task.title||"Tarea",{agenda:task});if(!ok)throw new Error("No se pudo guardar en Papelera.")}
      const {error}=await sb.from("agenda_items").delete().eq("id",id);if(error)throw error;
      await refreshTasks();
    }catch(err){alert(err?.message||"No se pudo eliminar la tarea.")}
  };

  /* ---------- instalar pickers ---------- */
  installPicker("cpTaskStarts","tpfTaskStart","Fecha");
  installPicker("cpTaskReminder","tpfTaskReminder","Fecha");
  installPicker("agendaStarts","tpfAgendaStarts","Fecha");
  installPicker("agendaReminder","tpfAgendaReminder","Avisarme desde");

  /* ---------- WhatsApp + nueva tarea ---------- */
  const addBtn=byId("waSideNewTask");
  if(addBtn){
    addBtn.onclick=function(e){
      e?.preventDefault?.();e?.stopPropagation?.();
      if(typeof waLiveState==="undefined"||!waLiveState?.contact){alert("Primero vincula este chat con un contacto.");return}
      if(typeof waPrepareCurrentContactForCrm==="function"&&!waPrepareCurrentContactForCrm()){alert("Primero vincula este chat con un contacto.");return}
      waTaskOrigin=captureWaOrigin();
      openContactTaskPage();
      setTimeout(openTaskStandalone,0);
    };
  }

  /* ---------- Ver tareas desde WhatsApp ---------- */
  window.waViewTasksFromSide=async function(){
    if(typeof waLiveState==="undefined"||!waLiveState?.contact)return;
    if(typeof window.openWaMatchedContact==="function")await window.openWaMatchedContact(); else await openContact(waLiveState.contact.id);
    setTimeout(()=>document.querySelector('.cpTabs span:nth-child(4)')?.click(),50);
  };
  const viewBtn=byId("waSideViewTasks");if(viewBtn)viewBtn.onclick=async e=>{e?.preventDefault?.();e?.stopPropagation?.();await window.waViewTasksFromSide()};

  /* ---------- Back tarea ---------- */
  for(const id of ["cpTaskBack","cpTaskDetailBack"]){
    const btn=byId(id);if(!btn)continue;
    const old=btn.onclick;
    btn.onclick=async function(e){
      e?.preventDefault?.();e?.stopPropagation?.();
      if(waTaskOrigin){await returnWaOrigin();return}
      if(typeof old==="function")return old.call(btn,e);
    };
  }

  /* ---------- Save nueva tarea ---------- */
  const taskSave=byId("cpTaskSave");
  if(taskSave&&typeof taskSave.onclick==="function"){
    const old=taskSave.onclick;
    taskSave.onclick=async function(e){
      byId("cpTaskStarts")?.__tpfSyncToHidden?.();byId("cpTaskReminder")?.__tpfSyncToHidden?.();
      const origin=waTaskOrigin, result=await old.call(taskSave,e);
      await refreshTasks();
      const msg=String(byId("cpTaskMsg")?.textContent||"").toLowerCase();
      const failed=msg.includes("error")||msg.includes("no tienes permiso")||msg.includes("escribe un asunto")||msg.includes("no se pudo");
      if(origin&&!failed)await returnWaOrigin();
      return result;
    };
  }

  /* ---------- Save/edit/completar/reabrir ---------- */
  for(const id of ["cpTaskDetailSave","cpTaskMarkDone","cpTaskReopen"]){
    const btn=byId(id);if(!btn||typeof btn.onclick!=="function")continue;
    const old=btn.onclick;
    btn.onclick=async function(e){const r=await old.call(btn,e);await refreshTasks();return r}
  }

  /* ---------- Delete detalle a papelera ---------- */
  const detailDelete=byId("cpTaskDelete");
  if(detailDelete){
    detailDelete.onclick=async function(e){
      e?.preventDefault?.();e?.stopPropagation?.();
      if(typeof currentContactTask==="undefined"||!currentContactTask)return;
      const task={...currentContactTask};
      if(!confirm(`¿Eliminar "${task.title||"Tarea"}"? Se enviará a la Papelera.`))return;
      try{
        if(typeof archiveToTrash==="function"){const ok=await archiveToTrash("agenda",task.id,task.title||"Tarea",{agenda:task});if(!ok)throw new Error("No se pudo guardar en Papelera.")}
        const {error}=await sb.from("agenda_items").delete().eq("id",task.id);if(error)throw error;
        currentContactTask=null;byId("cpTaskDetailPage")?.classList.add("hidden");await refreshTasks();if(waTaskOrigin)await returnWaOrigin();
      }catch(err){if(byId("cpTaskDetailMsg"))byId("cpTaskDetailMsg").textContent=err?.message||"No se pudo eliminar la tarea."}
    };
  }

  /* ---------- Agenda: antes de guardar sincronizar hidden ---------- */
  const agendaSave=byId("agendaSave");
  if(agendaSave&&typeof agendaSave.onclick==="function"){
    const old=agendaSave.onclick;
    agendaSave.onclick=async function(e){
      byId("agendaStarts")?.__tpfSyncToHidden?.();byId("agendaReminder")?.__tpfSyncToHidden?.();
      const r=await old.call(agendaSave,e);
      setTimeout(()=>{byId("agendaStarts")?.__tpfSyncFromHidden?.();byId("agendaReminder")?.__tpfSyncFromHidden?.()},0);
      return r;
    };
  }

  setTimeout(()=>renderWaTasks().catch(()=>{}),250);
})();

/* ---- script inline extraído ---- */

(function(){
  document.addEventListener("click",function(e){
    var btn=e.target.closest&&e.target.closest(".tpfPickerDateBtn");
    var keep=null;
    if(btn){
      var wrap=btn.closest(".tpfPickerDate");
      keep=wrap&&wrap.querySelector(".tpfCalendar");
    }
    document.querySelectorAll(".tpfCalendar.open").forEach(function(cal){
      if(cal!==keep)cal.classList.remove("open");
    });
  },true);
})();

/* ---- script inline extraído ---- */
