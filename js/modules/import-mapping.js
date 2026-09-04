/* Importador guiado de Contactos y Oportunidades. Mantiene intacto el importador histórico. */
(()=>{
 const q=id=>document.getElementById(id), clean=v=>String(v??"").trim();
 const norm=v=>clean(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
 const digits=v=>clean(v).replace(/\D/g,"").replace(/^34(?=\d{9}$)/,"").slice(-9);
 const dni=v=>clean(v).toUpperCase().replace(/[^A-Z0-9]/g,"");
 const email=v=>clean(v).toLowerCase();
 const slug=v=>norm(v).replace(/\s+/g,"_").slice(0,54)||"campo";
 const escHtml=v=>typeof esc==="function"?esc(v):clean(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
 const synonyms={
  contact:{
   first_name:["nombre","first name"],last_name:["apellidos","apellido","last name"],full_name:["nombre y apellidos","nombre completo","cliente","contacto"],
   phone:["telefono","teléfono","telefono 1","teléfono 1","movil","móvil","phone","celular"],dni:["dni","nif","nif nit","dni nif","documento"],email:["email","correo","correo electronico","correo electrónico","correo electronico 1","correo electrónico 1"],
   notes:["notas","nota","observaciones","comentarios"]
  },
  opportunity:{
   title:["titulo","título","oportunidad","nombre oportunidad","asunto"],client_name:["cliente","nombre cliente","contacto","nombre y apellidos"],
   phone:["telefono","teléfono","movil","móvil","phone"],dni:["dni","nif","dni nif"],email:["email","correo","correo electronico","correo electrónico"],
   amount:["importe","cantidad","valor","precio","amount"],expected_date:["fecha prevista","fecha cierre","cierre esperado","fecha","expected date"],
   stage:["estado","etapa","columna","fase","stage"],notes:["notas","nota","observaciones","comentarios"]
  }
 };
 const labels={contact:{first_name:"Nombre",last_name:"Apellidos",full_name:"Nombre completo",phone:"Teléfono",dni:"DNI / NIF",email:"Correo",notes:"Notas"},opportunity:{title:"Título",client_name:"Cliente",phone:"Teléfono",dni:"DNI del contacto",email:"Correo del contacto",amount:"Importe",expected_date:"Fecha prevista",stage:"Estado / columna",notes:"Notas"}};
 let state=null, legacyPreview=null, legacyRun=null;

 function isGuided(){return ["BASE DE DATOS","OPORTUNIDADES"].includes(q("destination")?.value)}
 function guess(header,type){const n=norm(header), group=synonyms[type];for(const [key,list] of Object.entries(group))if(list.some(x=>norm(x)===n))return key;return "custom"}
 function options(type,selected){return '<option value="ignore">No importar</option>'+Object.entries(labels[type]).map(([v,l])=>`<option value="${v}" ${selected===v?"selected":""}>${escHtml(l)}</option>`).join("")+`<option value="custom" ${selected==="custom"?"selected":""}>Campo adicional</option>`}
 function ensureUi(){
  if(q("importMapping"))return;
  const box=document.createElement("div");box.id="importMapping";box.className="hidden";
  box.innerHTML=`<style>
   #importMapping{margin-top:16px;border-top:1px solid #e5e7eb;padding-top:14px}#importMapping.hidden{display:none}
   .importSummary{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:12px 0}.importSummary div{padding:10px;border:1px solid #e5e7eb;border-radius:10px;background:#fafafa}.importSummary b{display:block;font-size:20px}.importWarn{color:#a15c00}
   .importMapGrid{display:grid;grid-template-columns:minmax(160px,1fr) minmax(180px,1fr);gap:8px;align-items:center}.importMapGrid label{font-weight:600}.importMapGrid select{width:100%}.importHelp{margin:8px 0;color:#475467}.importErrors{color:#b42318;white-space:pre-line}
  </style><h3>Asignar columnas del Excel</h3><p class="small importHelp">Revisa la asignación automática. Las columnas adicionales se conservarán como campos personalizados.</p><div id="importMapGrid" class="importMapGrid"></div><div id="importSummary" class="importSummary"></div><div id="importErrors" class="small importErrors"></div>`;
  q("importInfo").parentNode.appendChild(box);
 }
 function readMapped(raw,key){for(const [h,target] of Object.entries(state.mapping))if(target===key&&clean(raw[h]))return clean(raw[h]);return ""}
 function extraValues(raw){const out={};for(const [h,target] of Object.entries(state.mapping))if(target==="custom"&&clean(raw[h])!=="")out[h]=raw[h];return out}
 function contactData(raw){
  const first=readMapped(raw,"first_name"),last=readMapped(raw,"last_name"),full=readMapped(raw,"full_name")||[first,last].filter(Boolean).join(" ");
  return {...raw,"NOMBRE":first||full,"APELLIDOS":last,"NOMBRE Y APELLIDOS":full,"TELÉFONO":readMapped(raw,"phone"),"DNI / NIF":readMapped(raw,"dni"),"EMAIL":readMapped(raw,"email"),"NOTAS":readMapped(raw,"notes")};
 }
 async function allContacts(){let out=[];for(let from=0;;from+=1000){const {data,error}=await sb.from("records").select("id,data").eq("source_sheet","BASE DE DATOS").range(from,from+999);if(error)throw error;out.push(...(data||[]));if((data||[]).length<1000)break}return out}
 function contactKeys(data){return {phone:digits(data["TELÉFONO"]||data.TELEFONO||data.MOVIL),dni:dni(data["DNI / NIF"]||data.DNI||data.NIF),email:email(data.EMAIL||data.Email)}}
 async function analyse(){
  if(!state)return;const errors=[];let duplicates=0;state.duplicateRows=new Set();
  if(state.type==="contact"){
   const existing=await allContacts(), seen=new Set();existing.forEach(r=>{const k=contactKeys(r.data||{});Object.entries(k).forEach(([t,v])=>v&&seen.add(t+":"+v))});
   state.rawRows.forEach((raw,i)=>{const d=contactData(raw),k=contactKeys(d);if(!clean(d["NOMBRE Y APELLIDOS"])&&!k.phone&&!k.dni&&!k.email)errors.push(`Fila ${i+2}: falta nombre, teléfono, DNI o correo.`);const hit=Object.entries(k).some(([t,v])=>v&&seen.has(t+":"+v));if(hit){duplicates++;state.duplicateRows.add(i)}else Object.entries(k).forEach(([t,v])=>v&&seen.add(t+":"+v))});
  }else state.rawRows.forEach((raw,i)=>{if(!readMapped(raw,"title"))errors.push(`Fila ${i+2}: falta el título de la oportunidad.`)});
  const custom=Object.entries(state.mapping).filter(([,v])=>v==="custom").length;
  state.errors=errors;q("importSummary").innerHTML=`<div><b>${state.rawRows.length}</b>filas encontradas</div><div><b>${state.rawRows.length-duplicates-errors.length}</b>listas para importar</div><div class="importWarn"><b>${duplicates}</b>duplicados (se omitirán)</div><div><b>${errors.length}</b>filas con error</div><div><b>${custom}</b>campos adicionales</div>`;
  q("importErrors").textContent=errors.slice(0,8).join("\n")+(errors.length>8?`\n… y ${errors.length-8} más.`:"");
  renderPreview();q("runImport").disabled=!state.rawRows.length||state.rawRows.length===duplicates+errors.length;
 }
 function renderPreview(){
  const headers=state.headers.slice(0,12);q("previewHead").innerHTML="<tr>"+headers.map(h=>`<th>${escHtml(h)}</th>`).join("")+"</tr>";
  q("previewRows").innerHTML=state.rawRows.slice(0,10).map((r,i)=>`<tr ${state.duplicateRows.has(i)?'style="opacity:.55" title="Duplicado: se omitirá"':""}>${headers.map(h=>`<td>${escHtml(r[h])}</td>`).join("")}</tr>`).join("");
 }
 async function preview(){
  const f=q("excelFile").files[0];if(!f){alert("Selecciona un Excel");return}q("runImport").disabled=true;q("importInfo").textContent="Leyendo Excel…";
  const data=await f.arrayBuffer(),wb=XLSX.read(new Uint8Array(data),{type:"array",raw:false,cellDates:true});const dest=q("destination").value;
  const target=wb.SheetNames.find(n=>norm(n)===norm(dest)||dest==="BASE DE DATOS"&&["contactos","base de datos"].includes(norm(n))||dest==="OPORTUNIDADES"&&["oportunidades","ventas"].includes(norm(n)))||wb.SheetNames[0];
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[target],{header:1,defval:"",raw:false,blankrows:false});const hi=typeof findHeader==="function"?findHeader(rows):0;
  const headers=(rows[hi]||[]).map((h,i)=>clean(h)||`Columna ${i+1}`), rawRows=rows.slice(hi+1).filter(r=>r.some(v=>clean(v))).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??""])));
  const type=dest==="BASE DE DATOS"?"contact":"opportunity",mapping=Object.fromEntries(headers.map(h=>[h,rawRows.some(r=>clean(r[h])!=="")?guess(h,type):"ignore"]));
  state={file:f.name,sheet:target,type,headers,rawRows,mapping,duplicateRows:new Set(),errors:[]};ensureUi();q("importMapping").classList.remove("hidden");
  q("importMapGrid").innerHTML=headers.map((h,i)=>`<label for="importMap_${i}">${escHtml(h)}</label><select id="importMap_${i}" data-header="${escHtml(h)}">${options(type,mapping[h])}</select>`).join("");
  q("importMapGrid").querySelectorAll("select").forEach(s=>s.onchange=()=>{state.mapping[s.dataset.header]=s.value;analyse().catch(e=>q("importErrors").textContent=e.message)});
  q("importInfo").textContent=`${rawRows.length} filas en “${target}”. Revisa la asignación antes de confirmar.`;await analyse();
 }
 function validRows(){return state.rawRows.map((raw,i)=>({raw,i})).filter(x=>!state.duplicateRows.has(x.i)&&!state.errors.some(e=>e.startsWith(`Fila ${x.i+2}:`)))}
 async function ensureContactFields(names){
  const {data,error}=await sb.rpc("crm_list_custom_fields");if(error)throw error;let fields=data||[];
  for(const name of names)if(!fields.some(f=>norm(f.name)===norm(name))){const {error:e}=await sb.rpc("crm_create_custom_field",{p_name:name,p_field_type:"text",p_options:[]});if(e)throw e}
  const again=await sb.rpc("crm_list_custom_fields");if(again.error)throw again.error;return new Map((again.data||[]).map(f=>[norm(f.name),f]));
 }
 async function importContacts(rows){
  const customNames=Object.entries(state.mapping).filter(([,v])=>v==="custom").map(([h])=>h), fields=await ensureContactFields(customNames);let done=0;
  for(const {raw,i} of rows){const payload={source_sheet:"BASE DE DATOS",source_row:i+2,data:contactData(raw)};const {data,error}=await sb.from("records").insert(payload).select("id").single();if(error)throw error;
   const values=Object.entries(extraValues(raw)).map(([name,value])=>({field_id:fields.get(norm(name))?.id,value:clean(value)})).filter(x=>x.field_id&&x.value!=="");if(values.length){const saved=await sb.rpc("crm_set_contact_custom_values",{p_contact_id:String(data.id),p_values:values});if(saved.error)throw saved.error}done++;progress(done,rows.length)}
  if(typeof crmLoadCustomFields==="function")await crmLoadCustomFields();
 }
 async function ensureSalesFields(names){
  let r=await sb.from("sales_custom_fields").select("id,label,field_key").eq("active",true);if(r.error)throw r.error;let fields=r.data||[];
  for(const name of names)if(!fields.some(f=>norm(f.label)===norm(name))){const a=await sb.rpc("add_sales_custom_field",{field_label:name,field_type:"text"});if(a.error)throw a.error}
  r=await sb.from("sales_custom_fields").select("id,label,field_key").eq("active",true);if(r.error)throw r.error;return new Map((r.data||[]).map(f=>[norm(f.label),f]));
 }
 function number(v){const s=clean(v).replace(/\s/g,"").replace(/\.(?=\d{3}(?:\D|$))/g,"").replace(",", ".").replace(/[^0-9.-]/g,"");const n=Number(s);return Number.isFinite(n)?n:null}
 function date(v){const s=clean(v);if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);return m?`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`:null}
 async function importOpportunities(rows){
  const st=await sb.from("sales_stages").select("id,pipeline_id,name").eq("active",true).order("position");if(st.error||!st.data?.length)throw st.error||new Error("No hay columnas de ventas activas.");
  const contacts=await allContacts(), contactMap=new Map();contacts.forEach(r=>{const k=contactKeys(r.data||{});Object.entries(k).forEach(([t,v])=>v&&contactMap.set(t+":"+v,r.id))});
  const customNames=Object.entries(state.mapping).filter(([,v])=>v==="custom").map(([h])=>h),fields=await ensureSalesFields(customNames);let done=0;
  for(const {raw} of rows){const stageName=norm(readMapped(raw,"stage")),stage=st.data.find(s=>norm(s.name)===stageName)||st.data[0],p=digits(readMapped(raw,"phone")),d=dni(readMapped(raw,"dni")),e=email(readMapped(raw,"email")),recordId=contactMap.get("dni:"+d)||contactMap.get("phone:"+p)||contactMap.get("email:"+e)||null;
   const payload={pipeline_id:stage.pipeline_id,stage_id:stage.id,record_id:recordId,title:readMapped(raw,"title"),client_name:readMapped(raw,"client_name")||null,phone:readMapped(raw,"phone")||null,amount:number(readMapped(raw,"amount")),expected_date:date(readMapped(raw,"expected_date")),notes:readMapped(raw,"notes")||null};
   const ins=await sb.from("sales_opportunities").insert(payload).select("id").single();if(ins.error)throw ins.error;const vals=Object.entries(extraValues(raw)).map(([name,value])=>({opportunity_id:ins.data.id,field_id:fields.get(norm(name))?.id,value:clean(value)})).filter(x=>x.field_id&&x.value!=="");if(vals.length){const vr=await sb.from("sales_custom_values").upsert(vals);if(vr.error)throw vr.error}done++;progress(done,rows.length)}
  if(typeof loadSales==="function")await loadSales();
 }
 function progress(done,total){q("importBar").style.width=`${done/total*100}%`;q("importInfo").textContent=`Importados ${done} / ${total}`}
 async function run(){
  if(!(perms?.is_admin||perms?.can_manage_imports)){alert("Sin permiso");return}if(!state)return;await analyse();const rows=validRows();if(!rows.length){alert("No hay filas válidas nuevas para importar.");return}
  if(!confirm(`¿Importar ${rows.length} filas válidas en ${state.type==="contact"?"Contactos":"Oportunidades"}? Los duplicados y errores se omitirán.`))return;
  q("runImport").disabled=true;try{if(state.type==="contact")await importContacts(rows);else await importOpportunities(rows);q("importInfo").textContent=`Importación terminada: ${rows.length} registros nuevos. Las columnas adicionales se han conservado.`;state=null;q("importMapping").classList.add("hidden")}catch(e){q("importInfo").textContent="Importación detenida: "+(e.message||e);q("runImport").disabled=false}
 }
 function bind(){ensureUi();legacyPreview=q("previewImport").onclick;legacyRun=q("runImport").onclick;q("previewImport").onclick=e=>isGuided()?preview().catch(err=>{q("importInfo").textContent="No se pudo leer el Excel: "+err.message}):legacyPreview?.call(q("previewImport"),e);q("runImport").onclick=e=>isGuided()?run():legacyRun?.call(q("runImport"),e);q("destination").addEventListener("change",()=>{state=null;q("importMapping").classList.add("hidden");q("runImport").disabled=true;q("previewHead").innerHTML="";q("previewRows").innerHTML=""})}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
 window.TPFImportMapping={norm,guess,digits,contactKeys,number,date};
})();
