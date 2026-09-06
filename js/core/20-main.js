/* TPF physical module split · generated from app-core.js */
const PERM_LABELS={
 can_view_dashboard:"Ver Dashboard comercial",
 can_view_alerts:"Ver Centro de avisos",
 can_view_liquidacion:"Ver Liquidación",
 can_view_data:"Ver Data",
 can_view_clawback:"Ver Clawback",
 can_view_ajustes:"Ver Ajustes",
 can_view_database:"Ver Contactos",
 can_create_database:"Crear contactos",
 can_edit_records:"Editar registros/contactos",
 can_delete_records:"Eliminar registros/contactos",
 can_use_whatsapp:"Usar WhatsApp",
 can_schedule_whatsapp:"Programar WhatsApp",
 can_manage_templates:"Gestionar plantillas",
 can_view_sales:"Ver Panel de ventas",
 can_edit_sales:"Editar oportunidades/ventas",
 can_manage_sales_fields:"Gestionar columnas/campos de ventas",
 can_manage_imports:"Importar Excel",
 can_view_agenda:"Ver Agenda",
 can_manage_agenda:"Gestionar Agenda y tareas",
 can_use_advanced_search:"Usar búsqueda múltiple y cruces",
 can_export_excel:"Exportar a Excel",
 can_manage_labels:"Gestionar etiquetas",
 can_manage_automations:"Gestionar automatizaciones",
 can_manage_custom_fields:"Gestionar campos personalizados",
 can_manage_goals:"Gestionar objetivos comerciales",
 can_view_settings:"Ver Configuración",
 can_manage_users:"Gestionar usuarios y permisos"
};
let adminUsers=[];

async function loadUsersAdmin(){
 const {data,error}=await sb.rpc("admin_list_users_permissions");
 if(error){$("userMsg").textContent=error.message;return}
 adminUsers=data||[];
 $("userSelect").innerHTML=adminUsers.filter(u=>!u.is_admin).map(u=>`<option value="${u.user_id}">${esc(u.display_name||u.email)} · ${esc(u.email)}</option>`).join("");
 renderSelectedUserPerms();
}
$("userSelect").onchange=renderSelectedUserPerms;

function renderSelectedUserPerms(){
 const id=$("userSelect").value;
 const u=adminUsers.find(x=>x.user_id===id);
 if(!u){$("permGrid").innerHTML="";return}
 const groups=[
   ["General",["can_view_dashboard","can_view_alerts","can_view_settings"]],
   ["Datos",["can_view_liquidacion","can_view_data","can_view_clawback","can_view_ajustes","can_view_database","can_create_database","can_edit_records","can_delete_records"]],
   ["WhatsApp",["can_use_whatsapp","can_schedule_whatsapp","can_manage_templates"]],
   ["Ventas y agenda",["can_view_sales","can_edit_sales","can_manage_sales_fields","can_view_agenda","can_manage_agenda","can_manage_goals"]],
   ["Herramientas",["can_manage_imports","can_use_advanced_search","can_export_excel","can_manage_labels","can_manage_automations","can_manage_custom_fields"]],
   ["Administración",["can_manage_users"]]
 ];
 $("permGrid").innerHTML=groups.map(([title,keys])=>`<div class="permGroup"><h4>${esc(title)}</h4>${keys.map(key=>`
   <label class="permItem">
     <input type="checkbox" data-perm="${key}" ${u[key]?"checked":""}>
     <span>${esc(PERM_LABELS[key]||key)}</span>
   </label>`).join("")}</div>`).join("");
 $("permGrid").querySelectorAll("input[data-perm]").forEach(ch=>{
   ch.onchange=async()=>{
     const {error}=await sb.rpc("admin_set_user_permission",{target_user:id,permission_name:ch.dataset.perm,allowed:ch.checked});
     if(error){alert(error.message);ch.checked=!ch.checked;return}
     const uu=adminUsers.find(x=>x.user_id===id);if(uu)uu[ch.dataset.perm]=ch.checked;
     $("userMsg").textContent="Permiso actualizado";
   };
 });
}
async function setAllVisiblePermissions(value){
 const id=$("userSelect").value;if(!id)return;
 const boxes=[...$("permGrid").querySelectorAll("input[data-perm]")];
 for(const ch of boxes){
   if(ch.checked===value)continue;
   const {error}=await sb.rpc("admin_set_user_permission",{target_user:id,permission_name:ch.dataset.perm,allowed:value});
   if(error){alert(error.message);return}
   ch.checked=value;const uu=adminUsers.find(x=>x.user_id===id);if(uu)uu[ch.dataset.perm]=value;
 }
 $("userMsg").textContent=value?"Todos los permisos activados":"Todos los permisos desactivados";
}
$("permEnableAll").onclick=()=>setAllVisiblePermissions(true);
$("permDisableAll").onclick=()=>setAllVisiblePermissions(false);

$("loadDataFields").onclick=async()=>{
 const id=$("userSelect").value;if(!id)return;
 const {data,error}=await sb.from("records").select("data").eq("source_sheet","DATA").limit(20);
 if(error){alert(error.message);return}
 const fields=[...new Set((data||[]).flatMap(r=>Object.keys(r.data||{})))].sort();
 $("fieldPerms").innerHTML=fields.map(f=>`
   <label style="display:block;padding:7px 0">
     <input type="checkbox" data-field="${esc(f)}" checked style="width:auto;margin-right:8px">${esc(f)}
   </label>`).join("");
 $("fieldPerms").querySelectorAll("input[data-field]").forEach(ch=>{
   ch.onchange=async()=>{
     const {error}=await sb.rpc("admin_set_field_permission",{target_user:id,sheet_name:"DATA",column_name:ch.dataset.field,allowed:ch.checked});
     if(error){alert(error.message);ch.checked=!ch.checked;}
   };
 });
};


const salesScrollEl=$("salesScroll");
if(salesScrollEl){
  salesScrollEl.addEventListener("wheel",(e)=>{
    if(Math.abs(e.deltaY)>Math.abs(e.deltaX) && !e.shiftKey){
      if(salesScrollEl.scrollWidth>salesScrollEl.clientWidth && Math.abs(e.deltaY)>0){
        if((e.deltaY>0 && salesScrollEl.scrollLeft<salesScrollEl.scrollWidth-salesScrollEl.clientWidth) ||
           (e.deltaY<0 && salesScrollEl.scrollLeft>0)){
          e.preventDefault();
          salesScrollEl.scrollLeft+=e.deltaY;
        }
      }
    }
  },{passive:false});
}


$("salesSearch").oninput=renderSales;
$("salesStageFilter").onchange=renderSales;
$("salesSort").onchange=renderSales;
$("salesReload").onclick=loadSales;
document.addEventListener("click",e=>{
 if(e.target?.id==="salesHelpVisual")$("salesHelpBox")?.scrollIntoView({behavior:"smooth",block:"center"});
 if(e.target?.id==="salesConfigVisual"){const q=document.querySelector('.nav[data-view="settings"]');if(q)q.click();}
 if(e.target?.id==="quickNewField")$("newField")?.click();
});

window.moveOpp=async(id,stage)=>{
  const {error}=await sb.from("sales_opportunities").update({stage_id:stage,position:0}).eq("id",id);
  if(error)alert(error.message);
  else{
    await runOpportunityAutomations(id);
    loadSales();
  }
};
window.deleteOpp=async(id)=>{
  if(!confirm("¿Eliminar esta oportunidad?"))return;
  const {error}=await sb.rpc("delete_sales_opportunity",{opportunity_id:id});
  if(error)alert(error.message);else loadSales();
};
window.editOpp=async(id)=>{
  const o=(salesCache.opportunities||[]).find(x=>x.id===id);
  if(!o)return;
  const title=prompt("Título",o.title||""); if(title===null)return;
  const client=prompt("Cliente",o.client_name||""); if(client===null)return;
  const phone=prompt("Teléfono",o.phone||""); if(phone===null)return;
  const amount=prompt("Importe",o.amount??""); if(amount===null)return;
  const date=prompt("Fecha prevista (AAAA-MM-DD)",o.expected_date||""); if(date===null)return;
  const notes=prompt("Notas",o.notes||""); if(notes===null)return;
  const payload={title,client_name:client||null,phone:phone||null,
    amount:amount?Number(String(amount).replace(",",".")):null,
    expected_date:date||null,notes:notes||null};
  const {error}=await sb.from("sales_opportunities").update(payload).eq("id",id);
  if(error)alert(error.message);else loadSales();
};

function opportunityCustomEntries(o){
  const raw=o?.custom_values||o?.custom_fields||o?.fields||{};
  if(!raw)return [];
  if(Array.isArray(raw)){
    return raw.map((v,i)=>[v?.label||v?.name||("Campo "+(i+1)),v?.value??v]).filter(x=>x[1]!==undefined);
  }
  if(typeof raw==="object"){
    return Object.entries(raw);
  }
  return [];
}

const SALES_OPERATORS=[
  ["Vodafone",/\bvodafone\b/i],
  ["Orange",/\borange\b/i],
  ["Yoigo",/\byoigo\b/i],
  ["O2",/(?:^|\s)o2(?:\s|$)/i],
  ["MásMóvil",/\b(?:m[aá]s\s*m[oó]vil|masmovil)\b/i],
  ["Movistar",/\bmovistar\b/i],
  ["Jazztel",/\bjazztel\b/i],
  ["Lowi",/\blowi\b/i],
  ["Digi",/\bdigi\b/i],
  ["Pepephone",/\bpepephone\b/i],
  ["Simyo",/\bsimyo\b/i],
  ["Finetwork",/\b(?:finetwork|fi network)\b/i],
  ["Lebara",/\blebara\b/i]
];
function salesOperatorFromTitle(title){
  return SALES_OPERATORS.find(([,pattern])=>pattern.test(String(title||"")))?.[0]||"";
}
function salesOperatorField(){
  return (salesCache.fields||[]).find(f=>String(f.label||f.field_key||"").trim().toLowerCase()==="operador");
}
function syncOperatorPreview(){
  const value=salesOperatorFromTitle($("oppModalTitle")?.value);
  const item=[...document.querySelectorAll("#oppCustomFieldsView .oppCustomItem")]
    .find(x=>String(x.querySelector("span")?.textContent||"").trim().toLowerCase()==="operador");
  if(item?.querySelector("strong"))item.querySelector("strong").textContent=value||"Se completará al detectar el operador en el título";
}
function renderOpportunityCustomFields(values=[]){
  const byId=new Map((values||[]).map(v=>[String(v.field_id),v.value]));
  const fields=salesCache.fields||[];
  $("oppCustomFieldsView").innerHTML=fields.length
    ? fields.map(f=>`<div class="oppCustomItem"><span>${esc(f.label||f.field_key)}</span><strong>${esc(byId.get(String(f.id))??"")}</strong></div>`).join("")
    : '<div class="small oppNoCustom">No hay campos personalizados creados.</div>';
  syncOperatorPreview();
}
async function loadOpportunityCustomFields(opportunityId){
  const {data,error}=await sb.from("sales_custom_values").select("field_id,value").eq("opportunity_id",opportunityId);
  if(error)throw error;
  if(String($("oppModalId")?.value)===String(opportunityId))renderOpportunityCustomFields(data||[]);
}
async function saveDetectedOperator(opportunityId,title){
  const field=salesOperatorField();
  const operator=salesOperatorFromTitle(title);
  if(!opportunityId||!field?.id)return;
  const {error}=await sb.from("sales_custom_values").upsert({
    opportunity_id:opportunityId,
    field_id:field.id,
    value:operator||null
  },{onConflict:"opportunity_id,field_id"});
  if(error)throw error;
}

let oppContactSearchTimer=null;
function salesContactValue(d,...keys){
  for(const key of keys){
    const value=d?.[key];
    if(value!==undefined&&value!==null&&String(value).trim())return String(value).trim();
  }
  return "";
}
function mapSalesContact(row){
  const d=row?.data||{};
  return {
    data:d,
    id:String(row?.id||""),
    name:salesContactValue(d,"NOMBRE Y APELLIDOS","CLIENTE","CLIENTE FINAL")||[salesContactValue(d,"NOMBRE"),salesContactValue(d,"APELLIDOS","APELLIDO")].filter(Boolean).join(" ")||"Contacto",
    phone:salesContactValue(d,"TELÉFONO","TELEFONO","PHONE","MOVIL"),
    dni:salesContactValue(d,"DNI / NIF","DNI","NIF")
  };
}
async function searchOpportunityContacts(term){
  const box=$("oppContactMatches");
  if(!box)return;
  const q=String(term||"").trim();
  if(q.length<2){box.classList.add("hidden");box.innerHTML="";return}
  const results=await Promise.all(["BASE DE DATOS","DATA"].map(sheet=>
    sb.rpc("search_records",{search_text:q,sheet_filter:sheet,result_limit:8})
  ));
  const rows=[];
  results.forEach(({data})=>(data||[]).forEach(row=>{if(!rows.some(x=>String(x.id)===String(row.id)))rows.push(row)}));
  const contacts=rows.slice(0,10).map(mapSalesContact);
  box.innerHTML=contacts.length?contacts.map(c=>`<button type="button" class="oppContactMatch" data-contact-id="${esc(c.id)}"><b>${esc(c.name)}</b><span>${esc(c.phone||"Sin teléfono")}${c.dni?" · "+esc(c.dni):""}</span></button>`).join(""):'<div class="small oppContactNoMatch">No hay contactos coincidentes.</div>';
  box.classList.remove("hidden");
  box.querySelectorAll(".oppContactMatch").forEach((button,index)=>button.onclick=()=>selectOpportunityContact(contacts[index]));
}
function selectOpportunityContact(contact){
  pendingOpportunityRecordId=contact.id||null;
  window.TPFContactParty?.mountOpportunity(contact.data?.TPF_TITULAR);
  $("oppModalClient").value=contact.name||"";
  $("oppModalPhone").value=contact.phone||"";
  $("oppModalDni").value=contact.dni||"";
  $("oppModalOpenContact").dataset.recordId=contact.id||"";
  $("oppContactMatches").classList.add("hidden");
}
function scheduleOpportunityContactSearch(value){
  clearTimeout(oppContactSearchTimer);
  oppContactSearchTimer=setTimeout(()=>searchOpportunityContacts(value).catch(e=>console.warn("Búsqueda de contacto",e)),220);
}
[$("oppModalClient"),$("oppModalPhone"),$("oppModalDni")].filter(Boolean).forEach(input=>input.addEventListener("input",()=>scheduleOpportunityContactSearch(input.value)));
$("oppModalTitle")?.addEventListener("input",syncOperatorPreview);
document.addEventListener("click",e=>{if(!e.target.closest(".opportunityContactSearchLabel,#oppModalClient,#oppModalPhone"))$("oppContactMatches")?.classList.add("hidden")});


async function findContactRecordForOpportunity(o){
  if(!o)return null;
  const phone=String(o.phone||"").replace(/\D/g,"").slice(-9);
  const name=String(o.client_name||"").trim().toLowerCase();

  // Load likely contact records. Keep to DATA and CONTACTOS for the CRM contact profile.
  const {data,error}=await sb.from("records")
    .select("id,source_sheet,source_row,data")
    .in("source_sheet",["DATA","BASE DE DATOS"])
    .limit(1000);
  if(error)throw error;

  const rows=data||[];
  const field=(d,...names)=>{
    for(const n of names){
      if(d?.[n]!==undefined && d?.[n]!==null && String(d[n]).trim()!=="")return d[n];
    }
    return "";
  };

  const enriched=rows.map(r=>{
    const d=r.data||{};
    return {
      row:r,
      phone:String(field(d,"TELÉFONO","TELEFONO","PHONE","MOVIL")).replace(/\D/g,"").slice(-9),
      name:String(field(d,"NOMBRE Y APELLIDOS","NOMBRE","CLIENTE","CLIENTE FINAL")).trim().toLowerCase()
    };
  });

  // Phone is the strongest match.
  if(phone){
    const p=enriched.find(x=>x.phone===phone);
    if(p)return p.row;
  }
  if(name){
    const n=enriched.find(x=>x.name===name);
    if(n)return n.row;
  }
  return null;
}

window.openSalesOpportunityContact=async(id)=>{
  const o=(salesCache.opportunities||[]).find(x=>String(x.id)===String(id));
  if(!o)return;

  try{
    const rec=await findContactRecordForOpportunity(o);
    if(!rec){
      alert("No encuentro un contacto en DATA o CONTACTOS que coincida con este cliente.");
      return;
    }

    // Guardar exactamente la oportunidad actual antes de abrir el cliente.
    const wasEdit=!$("oppDetailModal")?.classList.contains("hidden");
    tpfRememberScreen({type:wasEdit?"oppEdit":"oppView",id:o.id,mainView:tpfMainViewNow(),mainScroll:document.querySelector(".referenceWorkspace main")?.scrollTop||0,salesLeft:$("salesScroll")?.scrollLeft||0,salesTop:$("salesScroll")?.scrollTop||0,salesViewTop:$("view-sales")?.scrollTop||0});
    window.__tpfSkipNextScreenPush=true;
    window.__returnSalesOpportunityId=null;
    if($("oppDetailModal"))$("oppDetailModal").classList.add("hidden");
    if($("opportunityFullPage"))$("opportunityFullPage").classList.add("hidden");

    await openContact(rec.id);
    if($("contactClose")){
      $("contactClose").textContent="← Volver a la oportunidad";
      $("contactClose").title="Volver a "+(o.title||"la oportunidad");
    }
  }catch(e){
    alert(e?.message||"No se pudo abrir la ficha del contacto.");
  }
};


let opportunityModalOrigin=null;
let __oppKeepPreparedOrigin=false;

function captureOpportunityModalOrigin(){
  // The opportunity editor is an overlay. Keep a fresh snapshot for every
  // opening instead of reusing the last section/chat that happened to open it.
  if(typeof tpfCurrentScreen==="function"){
    opportunityModalOrigin={type:"screen",screen:tpfCurrentScreen()};
    return opportunityModalOrigin;
  }
  try{
    if(!$("view-sales")?.classList.contains("hidden")){
      opportunityModalOrigin={
        type:"sales",
        view:salesCurrentView||"board",
        left:$("salesScroll")?.scrollLeft||0
      };
      return;
    }
    if(!$("opportunityFullPage")?.classList.contains("hidden")){
      opportunityModalOrigin={type:"full",oppId:currentFullOpportunity?.id||null};
      return;
    }
    if(!$("view-whatsapplive")?.classList.contains("hidden")){
      opportunityModalOrigin={
        type:"whatsapp",
        chatId:waLiveState?.selected?.id||null,
        contactId:waLiveState?.contact?.id||null
      };
      return;
    }
    if(!$("contactModal")?.classList.contains("hidden")){
      opportunityModalOrigin={type:"contact",contactId:currentContact?.id||null};
      return;
    }
    opportunityModalOrigin={type:"generic"};
  }catch(_){
    opportunityModalOrigin={type:"generic"};
  }
  return opportunityModalOrigin;
}

async function restoreOpportunityModalOrigin(){
  const origin=opportunityModalOrigin;
  opportunityModalOrigin=null;

  if(origin?.type==="screen" && origin.screen && typeof tpfRestoreScreen==="function"){
    await tpfRestoreScreen(origin.screen);
    return true;
  }

  if(origin?.type==="sales"){
    document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
    $("view-sales")?.classList.remove("hidden");
    setSalesView(origin.view||"board");
    requestAnimationFrame(()=>{
      if($("salesScroll"))$("salesScroll").scrollLeft=Number(origin.left||0);
    });
    return true;
  }

  if(origin?.type==="full"){
    $("opportunityFullPage")?.classList.remove("hidden");
    return true;
  }

  if(origin?.type==="whatsapp"){
    // Normalmente basta con quitar el modal: WhatsApp sigue debajo.
    // Si se cambió de vista por cualquier motivo, volver a WhatsApp.
    if($("view-whatsapplive")?.classList.contains("hidden")){
      document.querySelector('.nav[data-view="whatsapplive"]')?.click();
      await new Promise(r=>setTimeout(r,80));
    }
    if(origin.chatId && String(waLiveState?.selected?.id||"")!==String(origin.chatId)){
      try{await selectWhatsAppChat(origin.chatId)}catch(_){}
    }
    return true;
  }

  if(origin?.type==="contact" && origin.contactId){
    $("contactModal")?.classList.remove("hidden");
    if(!currentContact || String(currentContact.id)!==String(origin.contactId)){
      try{await openContact(origin.contactId)}catch(_){}
    }
    return true;
  }

  try{
    if(typeof tpfBackExactly==="function")return await tpfBackExactly();
  }catch(_){}
  return false;
}

async function refreshOpportunityEverywhere(){
  try{await loadSales()}catch(e){console.warn("loadSales",e)}
  try{
    if(waLiveState?.contact){
      const phone=waNormalizePhone(waLiveState.selected?.id||"");
      await loadWaContactSideData(waLiveState.contact,phone);
    }
  }catch(e){console.warn("WhatsApp opp refresh",e)}
  try{
    if(currentContact && typeof renderContactProfile==="function"){
      await renderContactProfile();
    }
  }catch(e){console.warn("Contact opp refresh",e)}
}

async function deleteOpportunityVerified(id){
  const {error}=await sb.rpc("delete_sales_opportunity",{opportunity_id:id});
  if(error)throw error;

  // Verificación real: no consideramos éxito hasta confirmar que ya no existe.
  const check=await sb.from("sales_opportunities").select("id").eq("id",id).maybeSingle();
  if(check?.error)throw check.error;
  if(check?.data){
    throw new Error("La oportunidad sigue existiendo después del borrado.");
  }

  // Retirada inmediata de caché para que no reaparezca mientras refresca.
  if(salesCache?.opportunities){
    salesCache.opportunities=salesCache.opportunities.filter(o=>String(o.id)!==String(id));
  }
}

window.openOpportunityCard=(id)=>{
  if(!__oppKeepPreparedOrigin)captureOpportunityModalOrigin();
  __oppKeepPreparedOrigin=false;
  pendingOpportunityRecordId=null;
  const o=(salesCache.opportunities||[]).find(x=>String(x.id)===String(id));
  if(!o)return;
  $("oppModalSave").textContent="Guardar cambios";
  $("oppModalDelete").classList.remove("hidden");
  $("oppModalId").value=o.id||"";
  window.TPFContactParty?.mountOpportunity(o.contract_party);
  $("oppModalHeading").textContent=o.title||"Ficha de oportunidad";
  $("oppModalTitle").value=o.title||"";
  $("oppModalClient").value=o.client_name||"";
  $("oppModalPhone").value=o.phone||"";
  $("oppModalDni").value="";
  $("oppModalOpenContact").dataset.recordId=o.record_id||"";
  pendingOpportunityRecordId=o.record_id||null;
  $("oppModalAmount").value=o.amount??"";
  $("oppModalDate").value=o.expected_date||"";
  $("oppModalNotes").value=o.notes||"";

  $("oppModalStage").innerHTML=(salesCache.stages||[]).map(s=>
    `<option value="${s.id}" ${String(s.id)===String(o.stage_id)?"selected":""}>${esc(s.name)}</option>`
  ).join("");

  renderOpportunityCustomFields();
  loadOpportunityCustomFields(o.id).catch(e=>console.warn("Campos de oportunidad",e));
  if(o.record_id){
    sb.from("records").select("id,data").eq("id",o.record_id).maybeSingle().then(({data})=>{
      if(data && String($("oppModalId")?.value)===String(o.id))$("oppModalDni").value=mapSalesContact(data).dni;
    });
  }

  const stage=(salesCache.stages||[]).find(s=>String(s.id)===String(o.stage_id));
  const meta=[];
  if(stage?.name)meta.push(`Columna actual: ${stage.name}`);
  if(o.created_at)meta.push(`Creada: ${new Date(o.created_at).toLocaleString("es-ES")}`);
  if(o.updated_at)meta.push(`Actualizada: ${new Date(o.updated_at).toLocaleString("es-ES")}`);
  $("oppMetaInfo").textContent=meta.join(" · ");

  $("oppDetailModal").classList.remove("hidden");
};


if($("oppModalOpenContact"))$("oppModalOpenContact").onclick=async(e)=>{
  e.preventDefault();
  e.stopPropagation();
  const id=$("oppModalId").value;
  const recordId=$("oppModalOpenContact").dataset.recordId;
  if(recordId)await openContact(recordId);
  else if(id)await openSalesOpportunityContact(id);
};

async function refreshOpportunitySideAfterChange(){
  try{
    if(!waLiveState?.contact)return;
    const phone=waNormalizePhone(waLiveState.selected?.id||"");
    await loadWaContactSideData(waLiveState.contact,phone);
  }catch(e){console.warn("Refresco lateral de oportunidades",e)}
}

async function closeOpportunityCard(){
  $("oppDetailModal").classList.add("hidden");
  await restoreOpportunityModalOrigin();
}
window.tpfCloseOpportunityCard=closeOpportunityCard;
window.tpfCaptureOpportunityOrigin=captureOpportunityModalOrigin;
$("oppModalClose").onclick=async(e)=>{
  e?.preventDefault?.();
  e?.stopPropagation?.();
  await closeOpportunityCard();
};
$("oppModalCloseX").onclick=async(e)=>{
  e?.preventDefault?.();
  e?.stopPropagation?.();
  await closeOpportunityCard();
};
$("oppDetailModal").onclick=async(e)=>{
  // Solo cerrar si se pulsa el fondo, nunca al hacer clic dentro de la tarjeta.
  if(e.target!==$("oppDetailModal"))return;
  await closeOpportunityCard();
};

$("oppModalSave").onclick=async()=>{
  const id=$("oppModalId").value;
  const title=$("oppModalTitle").value.trim();
  if(!title){alert("El título es obligatorio.");return}

  const newStage=$("oppModalStage").value;
  const stage=(salesCache.stages||[]).find(s=>String(s.id)===String(newStage));
  if(!stage){alert("Selecciona una columna.");return}

  const payload={
    title,
    client_name:$("oppModalClient").value.trim()||null,
    phone:$("oppModalPhone").value.trim()||null,
    amount:$("oppModalAmount").value!==""?Number($("oppModalAmount").value):null,
    expected_date:$("oppModalDate").value||null,
    notes:$("oppModalNotes").value.trim()||null,
    stage_id:stage.id,
    record_id:pendingOpportunityRecordId||null
  };

  $("oppModalSave").disabled=true;
  try{
    payload.contract_party=window.TPFContactRelations
      ?await window.TPFContactRelations.prepareOpportunity(payload)
      :window.TPFContactParty.readOpportunity();
    if(!id){
      const {data:created,error}=await sb.from("sales_opportunities").insert({
        pipeline_id:stage.pipeline_id,
        stage_id:stage.id,
        record_id:pendingOpportunityRecordId||null,
        ...payload
      }).select("id").single();
      if(error)throw error;
      pendingOpportunityRecordId=null;
      await saveDetectedOperator(created?.id,title);
      await runOpportunityAutomations(created?.id);
    }else{
      const current=(salesCache.opportunities||[]).find(x=>String(x.id)===String(id));
      const {data:saved,error}=await sb.from("sales_opportunities").update(payload).eq("id",id).select("*").single();
      if(error)throw error;

      if(saved && salesCache?.opportunities){
        salesCache.opportunities=salesCache.opportunities.map(o=>String(o.id)===String(id)?saved:o);
      }
      await saveDetectedOperator(id,title);

      if(current && String(current.stage_id)!==String(newStage)){
        const {error:moveError}=await sb.from("sales_opportunities").update({position:0}).eq("id",id);
        if(moveError)throw moveError;
        await runOpportunityAutomations(id);
      }
    }

    await refreshOpportunityEverywhere();
    await closeOpportunityCard();
  }catch(e){
    alert(e?.message||"No se pudo guardar la oportunidad.");
  }finally{
    $("oppModalSave").disabled=false;
  }
};

$("oppModalDelete").onclick=async(e)=>{
  e?.preventDefault?.();
  e?.stopPropagation?.();

  const id=$("oppModalId").value;
  const title=$("oppModalTitle").value.trim()||"esta oportunidad";
  if(!id)return;
  if(!confirm(`¿Eliminar definitivamente "${title}"?`))return;

  $("oppModalDelete").disabled=true;
  try{
    await deleteOpportunityVerified(id);
    await refreshOpportunityEverywhere();
    await closeOpportunityCard();
  }catch(err){
    alert(err?.message||"No se pudo eliminar la oportunidad.");
  }finally{
    $("oppModalDelete").disabled=false;
  }
};

/* Mantener compatibilidad: cualquier acción antigua de editar abre ahora la ficha completa */
window.editOpp=(id)=>openOpportunityCard(id);

window.newOppInStage=async(stageId)=>{
  const stage=(salesCache.stages||[]).find(s=>String(s.id)===String(stageId));
  if(!stage)return;

  captureOpportunityModalOrigin();
  pendingOpportunityRecordId=null;

  $("oppModalId").value="";
  window.TPFContactParty?.mountOpportunity();
  $("oppModalHeading").textContent="Nueva oportunidad";
  $("oppModalTitle").value="";
  $("oppModalClient").value="";
  $("oppModalPhone").value="";
  $("oppModalDni").value="";
  $("oppModalOpenContact").dataset.recordId="";
  $("oppModalAmount").value="";
  $("oppModalDate").value="";
  $("oppModalNotes").value="";
  $("oppModalStage").innerHTML=(salesCache.stages||[]).map(s=>
    `<option value="${s.id}" ${String(s.id)===String(stage.id)?"selected":""}>${esc(s.name)}</option>`
  ).join("");

  $("oppCustomFieldsView").innerHTML=(salesCache.fields||[]).length
    ? (salesCache.fields||[]).map(f=>`<div class="oppCustomItem"><span>${esc(f.label)}</span><strong>Se podrá completar al guardar</strong></div>`).join("")
    : '<div class="small oppNoCustom">No hay campos personalizados creados.</div>';
  syncOperatorPreview();

  $("oppMetaInfo").textContent="Creando nueva oportunidad";
  $("oppModalSave").textContent="Crear oportunidad";
  $("oppModalDelete").classList.add("hidden");
  $("oppDetailModal").classList.remove("hidden");
};
$("newOpp").onclick=async()=>{
  const stage=(salesCache.stages||[])[0];
  if(!stage){alert("No hay columnas creadas");return}
  return newOppInStage(stage.id);
};
$("newStage").onclick=async()=>{
 const name=prompt("Nombre de la nueva columna");
 if(!name)return;
 const {error}=await sb.rpc("add_sales_stage",{stage_name:name});
 $("salesMsg").textContent=error?error.message:"Columna creada";
 if(!error)loadSales();
};
$("newField").onclick=async()=>{
 const label=prompt("Nombre del nuevo campo");
 if(!label)return;
 const type=prompt("Tipo: text, number, currency, date, phone, email, textarea","text")||"text";
 const {error}=await sb.rpc("add_sales_custom_field",{field_label:label,field_type:type});
 $("salesMsg").textContent=error?error.message:"Campo creado";
 if(!error)loadSales();
};


window.createOppFromRecord=async(payload)=>{
 const c=typeof payload==="string"?JSON.parse(payload):payload;
 const {data:stages,error}=await sb.from("sales_stages").select("id,pipeline_id,name").order("position").limit(50);
 if(error||!stages?.length){alert(error?.message||"No hay columnas de ventas");return}
 const title=prompt("Título de la oportunidad","Oportunidad - "+(c.name||"Cliente")); if(!title)return;
 const amount=prompt("Importe","")||"";
 const date=prompt("Fecha prevista (AAAA-MM-DD)","")||"";
 const notes=prompt("Notas","")||"";
 const stageName=prompt("Columna inicial",stages[0].name)||stages[0].name;
 const stage=stages.find(s=>s.name.toLowerCase()===stageName.toLowerCase())||stages[0];
 const {error:e}=await sb.from("sales_opportunities").insert({
   pipeline_id:stage.pipeline_id,stage_id:stage.id,record_id:c.id||null,title,
   client_name:c.name||null,phone:c.phone||null,
   amount:amount?Number(String(amount).replace(",",".")):null,expected_date:date||null,notes:notes||null
 });
 if(e)alert(e.message);else alert("Oportunidad creada");
};

window.createAgendaFromRecord=async(payload)=>{
 const c=typeof payload==="string"?JSON.parse(payload):payload;
 if(!(perms?.is_admin||perms?.can_manage_agenda)){alert("No tienes permiso para crear recordatorios");return}
 const title=prompt("Asunto / recordatorio","Llamar a "+(c.name||"cliente")); if(!title)return;
 const when=prompt("Fecha y hora (AAAA-MM-DDTHH:MM)",""); if(!when)return;
 const notes=prompt("Notas","")||"";
 const {data:{user}}=await sb.auth.getUser();
 const {error}=await sb.from("agenda_items").insert({
   title,description:notes||null,customer_name:c.name||null,customer_phone:c.phone||null,
   starts_at:new Date(when).toISOString(),assigned_to:user?.id||null,
   related_record_id:c.id||null,status:"pending"
 });
 if(error)alert(error.message);else alert("Recordatorio creado");
};

window.showRelated=async(id)=>{
 const {data,error}=await sb.rpc("contact_related_items",{contact_id:id});
 if(error){alert(error.message);return}
 const opps=data?.opportunities||[], ag=data?.agenda||[];
 const text=[
   `Oportunidades: ${opps.length}`,
   ...opps.slice(0,10).map(o=>`• ${o.title} · ${o.client_name||""} · ${o.amount||0} €`),
   "",
   `Agenda: ${ag.length}`,
   ...ag.slice(0,10).map(a=>`• ${a.title} · ${a.starts_at?new Date(a.starts_at).toLocaleString("es-ES"):""}`)
 ].join("\n");
 alert(text);
};


async function loadGoogleSettings(){
  if($("settingsSearchSource")){
    await loadSettingsSearchUsers();
    await renderSettingsSearchColumns();
  }
  try{
    const {data,error}=await sb.from("app_settings").select("key,value").in("key",[
      "google_calendar_sync","google_contacts_sync","google_contacts_dedupe","google_contacts_update"
    ]);
    if(error)return;
    const map=Object.fromEntries((data||[]).map(x=>[x.key,x.value]));
    if($("settingGoogleCalendar"))$("settingGoogleCalendar").checked=!!map.google_calendar_sync;
    if($("settingGoogleContacts"))$("settingGoogleContacts").checked=!!map.google_contacts_sync;
    if($("settingGoogleDedup"))$("settingGoogleDedup").checked=map.google_contacts_dedupe!==false;
    if($("settingGoogleUpdate"))$("settingGoogleUpdate").checked=map.google_contacts_update!==false;
  }catch(e){}
}
if($("saveGoogleSettings"))$("saveGoogleSettings").onclick=async()=>{
  const rows=[
    {key:"google_calendar_sync",value:$("settingGoogleCalendar").checked},
    {key:"google_contacts_sync",value:$("settingGoogleContacts").checked},
    {key:"google_contacts_dedupe",value:$("settingGoogleDedup").checked},
    {key:"google_contacts_update",value:$("settingGoogleUpdate").checked}
  ];
  const {error}=await sb.from("app_settings").upsert(rows,{onConflict:"key"});
  $("googleSettingsMsg").textContent=error?error.message:"Ajustes guardados";
};

function selectedAgendaReminderMinutes(){
  return [...document.querySelectorAll(".agendaReminderPreset:checked")].map(x=>Number(x.value));
}


const GOOGLE_CLIENT_ID='494265592765-53v3qg685qp06fh47vl1n2cbbbu5h4nk.apps.googleusercontent.com';
const GOOGLE_CONTACTS_SCOPE="https://www.googleapis.com/auth/contacts";
let googleContactsToken=sessionStorage.getItem("tpf_google_contacts_token")||"";
let googleTokenClient=null;

function updateGoogleContactsUI(){
  const connected=!!googleContactsToken;
  if($("googleContactsStatus"))$("googleContactsStatus").textContent=connected?"Conectado":"No conectado";
  if($("connectGoogleContacts"))$("connectGoogleContacts").classList.toggle("hidden",connected);
  if($("disconnectGoogleContacts"))$("disconnectGoogleContacts").classList.toggle("hidden",!connected);
}
function initGoogleContacts(){
  if(!window.google?.accounts?.oauth2)return false;
  if(!googleTokenClient){
    googleTokenClient=google.accounts.oauth2.initTokenClient({
      client_id:GOOGLE_CLIENT_ID,
      scope:GOOGLE_CONTACTS_SCOPE,
      callback:(resp)=>{
        if(resp.error){alert("Google: "+resp.error);return}
        googleContactsToken=resp.access_token||"";
        sessionStorage.setItem("tpf_google_contacts_token",googleContactsToken);
        updateGoogleContactsUI();
      }
    });
  }
  return true;
}
async function connectGoogleContacts(){
  if(!initGoogleContacts()){
    setTimeout(connectGoogleContacts,700);return;
  }
  googleTokenClient.requestAccessToken({prompt:googleContactsToken?"":"consent"});
}
function disconnectGoogleContacts(){
  const token=googleContactsToken;
  googleContactsToken="";
  sessionStorage.removeItem("tpf_google_contacts_token");
  updateGoogleContactsUI();
  if(token&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(token,()=>{});
}
if($("connectGoogleContacts"))$("connectGoogleContacts").onclick=connectGoogleContacts;
if($("disconnectGoogleContacts"))$("disconnectGoogleContacts").onclick=disconnectGoogleContacts;
window.addEventListener("load",()=>{initGoogleContacts();updateGoogleContactsUI();});

function normGooglePhone(v){return String(v||"").replace(/\D/g,"").replace(/^34(?=\d{9}$)/,"");}
async function googleApi(path,options={}){
  if(!googleContactsToken)throw new Error("Google Contacts no está conectado.");
  const res=await fetch("https://people.googleapis.com/v1/"+path,{
    ...options,
    headers:{"Authorization":"Bearer "+googleContactsToken,"Content-Type":"application/json",...(options.headers||{})}
  });
  if(res.status===401){disconnectGoogleContacts();throw new Error("La sesión de Google ha caducado. Vuelve a conectar Google Contacts.");}
  const body=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(body?.error?.message||"Error de Google Contacts");
  return body;
}
async function findGoogleDuplicate(phone,email){
  if(!googleContactsToken)return null;
  const query=(email||phone||"").trim();
  if(!query)return null;
  const p=new URLSearchParams({query,readMask:"names,emailAddresses,phoneNumbers",pageSize:"10"});
  const data=await googleApi("people:searchContacts?"+p.toString());
  const targetPhone=normGooglePhone(phone), targetEmail=String(email||"").trim().toLowerCase();
  return (data.results||[]).find(x=>{
    const person=x.person||{};
    const phones=(person.phoneNumbers||[]).map(p=>normGooglePhone(p.value));
    const emails=(person.emailAddresses||[]).map(e=>String(e.value||"").toLowerCase());
    return (targetPhone&&phones.includes(targetPhone))||(targetEmail&&emails.includes(targetEmail));
  })||null;
}
async function createGoogleContact(name,phone,email){
  const duplicate=await findGoogleDuplicate(phone,email);
  if(duplicate)return {duplicate:true,person:duplicate.person};
  const parts=String(name||"").trim().split(/\s+/);
  const givenName=parts.shift()||"";
  const familyName=parts.join(" ");
  const body={
    names:[{givenName,familyName,displayName:String(name||"").trim()}],
    phoneNumbers:phone?[{value:phone,type:"mobile"}]:[],
    emailAddresses:email?[{value:email,type:"work"}]:[]
  };
  const person=await googleApi("people:createContact?personFields=names,emailAddresses,phoneNumbers",{method:"POST",body:JSON.stringify(body)});
  return {duplicate:false,person};
}


/* Rueda normal: subir/bajar desde cualquier punto del Panel de ventas.
   No modifica el desplazamiento horizontal existente del tablero. */
document.addEventListener("wheel",(e)=>{
  const salesView=$("view-sales");
  if(!salesView || salesView.classList.contains("hidden"))return;

  /* No interferir con campos, desplegables, modales ni con el scroll horizontal del tablero */
  if(e.target.closest("input, textarea, select, .modalBack, #contactModal, .contactProfileBack"))return;
  if(e.target.closest("#salesScroll"))return;

  e.preventDefault();
  window.scrollBy({top:e.deltaY,left:0,behavior:"auto"});
},{passive:false});


let automationRules=[];

async function loadAutomations(){
  const canManage=perms?.is_admin||perms?.can_manage_sales_fields;
  if(!canManage)return;

  if(!(salesCache.stages||[]).length){
    try{await loadSales()}catch(e){}
  }
  $("autoStage").innerHTML=(salesCache.stages||[]).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("");

  const {data,error}=await sb.from("automation_rules")
    .select("id,name,active,trigger_stage_id,delay_days,reminder_title,created_at")
    .order("created_at",{ascending:false});
  if(error){$("autoMsg").textContent=error.message;return}
  automationRules=data||[];
  renderAutomations();
}
function renderAutomations(){
  $("automationEmpty").style.display=automationRules.length?"none":"block";
  $("automationList").innerHTML=automationRules.map(r=>{
    const stage=(salesCache.stages||[]).find(s=>String(s.id)===String(r.trigger_stage_id));
    return `<div class="automationRule ${r.active?"":"automationDisabled"}">
      <div class="automationRuleMain">
        <div class="automationBolt">⚡</div>
        <div>
          <b>${esc(r.name)}</b>
          <div class="small">Cuando entra en <strong>${esc(stage?.name||"Columna")}</strong> → Agenda: ${esc(r.reminder_title)} · ${r.delay_days===0?"mismo día":r.delay_days+" día"+(r.delay_days===1?"":"s")+" después"}</div>
        </div>
      </div>
      <div class="automationActions">
        <label class="automationSwitch">
          <input type="checkbox" ${r.active?"checked":""} onchange="toggleAutomation('${r.id}',this.checked)">
          <span>${r.active?"Activa":"Inactiva"}</span>
        </label>
        <button class="danger" onclick="deleteAutomation('${r.id}')">Eliminar</button>
      </div>
    </div>`;
  }).join("");
}
$("autoCreate").onclick=async()=>{
  const stageId=$("autoStage").value;
  const name=$("autoName").value.trim();
  const title=$("autoReminderTitle").value.trim()||"Seguimiento comercial";
  const days=Number($("autoDelay").value||0);
  if(!stageId){$("autoMsg").textContent="Selecciona una columna.";return}
  if(!name){$("autoMsg").textContent="Pon un nombre a la automatización.";return}
  $("autoCreate").disabled=true;
  const {error}=await sb.from("automation_rules").insert({
    name,active:true,trigger_type:"stage_enter",trigger_stage_id:stageId,
    action_type:"create_agenda_reminder",delay_days:days,reminder_title:title
  });
  $("autoCreate").disabled=false;
  if(error){$("autoMsg").textContent=error.message;return}
  $("autoName").value="";
  $("autoMsg").textContent="Automatización creada";
  loadAutomations();
};
$("autoReload").onclick=loadAutomations;
window.toggleAutomation=async(id,active)=>{
  const {error}=await sb.from("automation_rules").update({active}).eq("id",id);
  if(error)alert(error.message);else loadAutomations();
};
window.deleteAutomation=async(id)=>{
  const r=automationRules.find(x=>String(x.id)===String(id));
  if(!confirm(`¿Eliminar la automatización "${r?.name||""}"?`))return;
  const {error}=await sb.from("automation_rules").delete().eq("id",id);
  if(error)alert(error.message);else loadAutomations();
};
async function runOpportunityAutomations(opportunityId){
  // The current server trigger crm_server_opportunity_stage_trigger handles
  // inserts and stage changes. The retired automation_rules table is empty
  // and its runner is deliberately not executable by authenticated clients.
  // Preserve callers without replaying or enqueueing any work from the browser.
  return opportunityId ? { delegated_to_server: true } : undefined;
}

loadSession();


if($("waFilter"))$("waFilter").onchange=loadWhatsappPrograms;
if($("waSearch"))$("waSearch").oninput=loadWhatsappPrograms;
if($("waReload"))$("waReload").onclick=loadWhatsappPrograms;
document.querySelectorAll('[data-view="whatsapp"]').forEach(btn=>{
  btn.addEventListener("click",()=>setTimeout(loadWhatsappPrograms,0));
});

document.addEventListener("keydown",e=>{
  if(e.key==="Escape" && !$("waQuickModal")?.classList.contains("hidden")){
    $("waQuickModal").classList.add("hidden");
  }
});


async function detectTelegramChat(){
  const msg=$("notifyMsg");
  if(msg)msg.textContent="Buscando tu mensaje en Telegram...";
  try{
    const r=await fetch("/api/telegram?action=chat-id",{cache:"no-store"});
    const j=await r.json();
    if(!r.ok||!j.ok)throw new Error(j.error||"No se pudo detectar el Chat ID.");
    $("notifyTelegramChatId").value=String(j.chat_id||"");
    const chatId=String(j.chat_id||"");
    $("notifyTelegramChatId").value=chatId;
    teamNotifyPrefs={...teamNotifyPrefs,telegram_chat_id:chatId};
    localStorage.setItem("tpf_team_notification_settings",JSON.stringify(teamNotifyPrefs));
    try{await sb.from("app_settings").upsert({key:"team_notification_settings",value:teamNotifyPrefs},{onConflict:"key"});}catch(_){}
    if(msg)msg.textContent="Telegram conectado correctamente.";
  }catch(e){
    if(msg)msg.textContent=e.message||String(e);
  }
}
async function sendTelegramTest(){
  const msg=$("notifyMsg");
  const chatId=($("notifyTelegramChatId")?.value||"").trim();
  if(!chatId){
    if(msg)msg.textContent="Primero pulsa “Detectar mi Telegram”.";
    return;
  }
  if(msg)msg.textContent="Enviando mensaje de prueba...";
  try{
    const r=await fetch("/api/telegram",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        action:"test",
        chat_id:chatId,
        text:"🔔 The Phone Face\nNotificaciones de Telegram conectadas correctamente."
      })
    });
    const j=await r.json();
    if(!r.ok||!j.ok)throw new Error(j.error||"No se pudo enviar la prueba.");
    if(msg)msg.textContent="Prueba enviada. Comprueba Telegram.";
  }catch(e){
    if(msg)msg.textContent=e.message||String(e);
  }
}
if($("notifyDetectTelegram"))$("notifyDetectTelegram").onclick=detectTelegramChat;
if($("notifyTelegramTest"))$("notifyTelegramTest").onclick=sendTelegramTest;


const WA_MONTHS_ES=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
let waCalView=new Date(),waCalSelected=null;
function waPad2(n){return String(n).padStart(2,"0")}
function waDateISO(d){return d.getFullYear()+"-"+waPad2(d.getMonth()+1)+"-"+waPad2(d.getDate())}
function waPrettyDate(d){return waPad2(d.getDate())+"/"+waPad2(d.getMonth()+1)+"/"+d.getFullYear()}
function waFillTimes(){const s=$("waQuickTime");if(!s||s.options.length)return;let o=document.createElement("option");o.value="";o.textContent="--:--";s.appendChild(o);for(let h=0;h<24;h++)for(let m=0;m<60;m+=5){let v=waPad2(h)+":"+waPad2(m),x=document.createElement("option");x.value=v;x.textContent=v;s.appendChild(x)}}
function waSyncCustomWhen(){if(waCalSelected&&$("waQuickTime").value)$("waQuickWhen").value=waDateISO(waCalSelected)+"T"+$("waQuickTime").value}
function waRenderCalendar(){const box=$("waCalDays");if(!box)return;box.innerHTML="";$("waCalMonth").textContent=WA_MONTHS_ES[waCalView.getMonth()].replace(/^./,c=>c.toUpperCase())+" "+waCalView.getFullYear();const y=waCalView.getFullYear(),mo=waCalView.getMonth(),first=new Date(y,mo,1),mi=(first.getDay()+6)%7,start=new Date(y,mo,1-mi);for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const b=document.createElement("button");b.type="button";b.textContent=d.getDate();if(d.getMonth()!=mo)b.classList.add("other");if(waCalSelected&&waDateISO(d)==waDateISO(waCalSelected))b.classList.add("selected");b.onclick=e=>{e.preventDefault();e.stopPropagation();waCalSelected=new Date(d.getFullYear(),d.getMonth(),d.getDate());waCalView=new Date(d.getFullYear(),d.getMonth(),1);$("waQuickDateText").textContent=waPrettyDate(waCalSelected);waRenderCalendar();$("waQuickCalendar").classList.add("hidden");waSyncCustomWhen()};box.appendChild(b)}}
waFillTimes();
$("waQuickDateBtn").onclick=e=>{e.preventDefault();e.stopPropagation();$("waQuickCalendar").classList.toggle("hidden");waRenderCalendar()};
$("waCalPrev").onclick=e=>{e.preventDefault();e.stopPropagation();waCalView=new Date(waCalView.getFullYear(),waCalView.getMonth()-1,1);waRenderCalendar()};
$("waCalNext").onclick=e=>{e.preventDefault();e.stopPropagation();waCalView=new Date(waCalView.getFullYear(),waCalView.getMonth()+1,1);waRenderCalendar()};
$("waQuickTime").onchange=waSyncCustomWhen;
$("waQuickCustomCancel").onclick=e=>{e.preventDefault();e.stopPropagation();$("waQuickCustomBox").classList.add("hidden")};

$("waQuickCustomCancel").onclick=(e)=>{
  e.preventDefault();
  e.stopPropagation();
  $("waQuickCustomBox").classList.add("hidden");
  $("waQuickCalendar").classList.add("hidden");
  $("waQuickScheduleBox").classList.add("hidden");
  $("waQuickSend").textContent="Enviar ahora";
  $("waQuickSend").dataset.mode="send";
  $("waQuickMsg").textContent="";
};


function tpfSetSaving(button,msgEl,text="Guardando..."){
  if(button){button.dataset.prevText=button.textContent;button.disabled=true;button.textContent=text;}
  if(msgEl)msgEl.textContent=text;
}
function tpfResetSaving(button,msgEl,message=""){
  if(button){button.disabled=false;button.textContent=button.dataset.prevText||button.textContent;}
  if(msgEl)msgEl.textContent=message;
}
function tpfShowSaveError(button,msgEl,error){
  if(button){button.disabled=false;button.textContent=button.dataset.prevText||button.textContent;}
  const message="No se ha guardado. "+(error?.message||error||"Comprueba la conexión y vuelve a intentarlo.");
  if(msgEl)msgEl.textContent=message;
  else alert(message);
}
async function tpfVerifyRow(table,id){
  if(!id)return false;
  try{
    const {data,error}=await sb.from(table).select("id").eq("id",id).maybeSingle();
    return !error && !!data;
  }catch(e){return false}
}



function telegramDeliveryStatus(type,id){
  return "";
}


let currentFullOpportunity=null;

if($("salesFullBackBtn"))tpfSetBackButton($("salesFullBackBtn"),()=>document.querySelector('[data-view="search"]')?.click());

function oppVal(v){return (v===null||v===undefined||v==="")?"—":esc(String(v))}

let opportunityReturnContext=null;

function rememberOpportunityReturnContext(){
  try{
    opportunityReturnContext={
      view: !$("view-whatsapplive")?.classList.contains("hidden") ? "whatsapp" : "other",
      chatId: waLiveState?.selected?.id || null,
      contactId: waLiveState?.contact?.id || currentContact?.id || null
    };
  }catch(_){
    opportunityReturnContext={view:"other",chatId:null,contactId:null};
  }
}

async function returnFromOpportunityExactly(){
  const ctx=opportunityReturnContext;
  $("opportunityFullPage")?.classList.add("hidden");

  if(ctx?.view==="whatsapp"){
    // Volver a WhatsApp sin recargar toda la aplicación.
    try{
      if(typeof openWhatsAppLive==="function") await openWhatsAppLive();
      else document.querySelector('.nav[data-view="whatsapplive"]')?.click();
    }catch(_){}

    if(ctx.chatId){
      try{
        await selectWhatsAppChat(ctx.chatId);
      }catch(_){}
    }
    return;
  }

  // Fallback al sistema anterior de vuelta exacta.
  try{
    if(typeof tpfBackExactly==="function"){
      const ok=await tpfBackExactly();
      if(ok)return;
    }
  }catch(_){}
}

window.openOpportunityFull=async(id)=>{
  rememberOpportunityReturnContext();
  tpfRememberScreen();
  let data=(salesCache.opportunities||[]).find(o=>String(o.id)===String(id));
  if(!data){
    const r=await sb.from("sales_opportunities").select("*").eq("id",id).maybeSingle();
    if(r.error||!r.data){alert(r.error?.message||"No se encontró la oportunidad.");return;}
    data=r.data;
  }

  currentFullOpportunity=data;
  const stage=(salesCache.stages||[]).find(s=>String(s.id)===String(data.stage_id));
  const stageName=stage?.name||"Sin estado";
  const contactId=data.record_id||data.contact_id||data.customer_id||"";
  const contactName=data.client_name||data.contact_name||data.customer_name||"Sin contacto";

  $("oppFullTitle").textContent=data.title||"Oportunidad";
  $("oppFullContent").innerHTML=`
    <div class="oppReadHeader">
      <div>
        <span class="oppReadEyebrow">OPORTUNIDAD</span>
        <h2>${oppVal(data.title||"Oportunidad")}</h2>
      </div>
      <span class="oppReadStage">${oppVal(stageName)}</span>
    </div>

    <div class="oppGrid">
      <div class="oppField">
        <span>Cliente</span>
        ${contactId
          ? `<button class="oppContactLink" onclick="returnToContactFromOpportunity('${contactId}','${data.id}')">${oppVal(contactName)}</button>`
          : `<strong>${oppVal(contactName)}</strong>`}
      </div>
      <div class="oppField"><span>Teléfono</span><strong>${oppVal(data.phone)}</strong></div>
      <div class="oppField"><span>Importe</span><strong>${oppVal(data.amount!=null?fmtMoney(data.amount):"")}</strong></div>
      <div class="oppField"><span>Estado / columna</span><strong>${oppVal(stageName)}</strong></div>
      <div class="oppField"><span>Fecha prevista</span><strong>${oppVal(data.expected_date?fmtDateOnly(data.expected_date):"")}</strong></div>
      <div class="oppField"><span>Última actualización</span><strong>${oppVal(data.updated_at?new Date(data.updated_at).toLocaleString("es-ES"):"")}</strong></div>
    </div>

    ${data.notes?`<div class="oppField oppReadNotes"><span>Notas</span><strong>${oppVal(data.notes)}</strong></div>`:""}
  `;

  $("opportunityFullPage").classList.remove("hidden");
};

window.returnToContactFromOpportunity=async(contactId,oppId)=>{
  tpfRememberScreen({type:"oppView",id:oppId,mainView:tpfMainViewNow(),mainScroll:document.querySelector(".referenceWorkspace main")?.scrollTop||0,salesLeft:$("salesScroll")?.scrollLeft||0,salesTop:$("salesScroll")?.scrollTop||0,salesViewTop:$("view-sales")?.scrollTop||0});
  window.__tpfSkipNextScreenPush=true;
  window.__returnSalesOpportunityId=null;
  $("opportunityFullPage").classList.add("hidden");
  await openContact(contactId);
  if($("contactClose")){
    $("contactClose").textContent="← Volver a la oportunidad";
    $("contactClose").title="Volver a la oportunidad";
  }
};

window.openOpportunityContact=async(contactId)=>{
  $("opportunityFullPage").classList.add("hidden");
  if(typeof openContactProfile==="function"){await openContactProfile(contactId);return;}
  if(typeof openContact==="function"){await openContact(contactId);return;}
  alert("No se pudo abrir la ficha del contacto.");
};

if($("oppFullBack"))$("oppFullBack").onclick=returnFromOpportunityExactly;
if($("oppFullEdit"))$("oppFullEdit").onclick=()=>{
  if(!currentFullOpportunity)return;
  captureOpportunityModalOrigin();
  __oppKeepPreparedOrigin=true;
  $("opportunityFullPage").classList.add("hidden");
  openOpportunityCard(currentFullOpportunity.id);
};
if($("oppFullDelete"))$("oppFullDelete").onclick=async()=>{
  if(!currentFullOpportunity)return;
  const id=currentFullOpportunity.id;
  const title=currentFullOpportunity.title||"Oportunidad";
  if(!confirm(`¿Eliminar definitivamente "${title}"?`))return;
  try{
    await deleteOpportunityVerified(id);
    await refreshOpportunityEverywhere();
    currentFullOpportunity=null;
    await returnFromOpportunityExactly();
  }catch(err){
    alert(err?.message||"No se pudo eliminar la oportunidad.");
  }
};

/* Navegación Oportunidad -> Ficha completa -> Oportunidad */
let opportunityReturnState = null;

window.openOpportunityContact = async(contactId)=>{
  if(!contactId) return;
  opportunityReturnState = currentFullOpportunity ? {...currentFullOpportunity} : null;
  $("opportunityFullPage")?.classList.add("hidden");

  // Abrir la ficha completa real ya existente en la aplicación.
  if(typeof openContactProfile==="function"){
    await openContactProfile(contactId);
  }else if(typeof openContact==="function"){
    await openContact(contactId);
  }else{
    alert("No se pudo abrir la ficha del contacto."); return;
  }

  // En la ficha completa, "Salir" vuelve a la oportunidad de origen.
  setTimeout(()=>{
    const candidates=[...document.querySelectorAll("button,a")];
    const exit=candidates.find(el=>{
      const t=(el.textContent||"").trim().toLowerCase();
      return t==="salir" || t==="← salir" || t.includes("salir");
    });
    if(exit && opportunityReturnState){
      if(!exit.dataset.oppReturnBound){
        exit.dataset.oppReturnBound="1";
        exit.addEventListener("click",(ev)=>{
          if(!opportunityReturnState) return;
          ev.preventDefault();
          ev.stopImmediatePropagation();
          const op=opportunityReturnState;
          opportunityReturnState=null;
          if(typeof closeContactProfile==="function") closeContactProfile();
          document.querySelectorAll('[id*="contact"][class*="full"], [id*="contact"][class*="profile"]').forEach(x=>{
            if(x.id!=="opportunityFullPage") x.classList.add("hidden");
          });
          openOpportunityFull(op.id);
        },true);
      }
    }
  },100);
};


function initSalesNavigation(){
  const sc=$("salesScroll"), left=$("salesScrollLeft"), right=$("salesScrollRight");
  const rail=$("salesMiniRail"), thumb=$("salesMiniThumb");
  if(!sc||!left||!right||!rail||!thumb)return;

  const step=()=>Math.max(280,Math.floor(sc.clientWidth*.72));
  left.onclick=()=>sc.scrollBy({left:-step(),behavior:"smooth"});
  right.onclick=()=>sc.scrollBy({left:step(),behavior:"smooth"});

  // Rueda / trackpad en cualquier parte del Panel de ventas:
  // arriba-abajo = scroll vertical; izquierda-derecha = scroll horizontal.
  const salesView=$("view-sales");
  if(salesView){
    let pendingX=0;
    let pendingY=0;
    let wheelRAF=0;

    function flushSalesWheel(){
      wheelRAF=0;

      if(Math.abs(pendingX)>0.01){
        sc.scrollLeft+=pendingX;
      }
      if(Math.abs(pendingY)>0.01){
        salesView.scrollTop+=pendingY;
      }

      pendingX=0;
      pendingY=0;
    }

    salesView.addEventListener("wheel",e=>{
      const target=e.target;
      if(target.closest("#contactModal, .contactProfileBack, .modalBack"))return;

      // Respetar solo elementos que realmente tengan scroll interno propio.
      const nativeScrollable=target.closest("textarea,[data-native-scroll]");
      if(nativeScrollable){
        const el=nativeScrollable;
        const canY=el.scrollHeight>el.clientHeight;
        const top=el.scrollTop<=0;
        const bottom=el.scrollTop+el.clientHeight>=el.scrollHeight-1;

        if(canY && ((e.deltaY<0&&!top)||(e.deltaY>0&&!bottom))){
          return;
        }
      }

      let dx=e.deltaX||0;
      let dy=e.deltaY||0;

      // Shift + rueda = horizontal, compatible con ratones sin rueda lateral.
      if(e.shiftKey && Math.abs(dx)<1){
        dx=dy;
        dy=0;
      }

      // No elegimos eje: cada delta mueve su dirección.
      // Amplificamos un poco X porque muchos ratones envían un delta horizontal pequeño.
      if(Math.abs(dx)>0.01){
        pendingX+=dx*1.45;
      }

      if(Math.abs(dy)>0.01){
        pendingY+=dy;
      }

      // Si llega movimiento, evitamos que el navegador robe el gesto.
      if(Math.abs(dx)>0.01 || Math.abs(dy)>0.01){
        e.preventDefault();
      }

      if(!wheelRAF){
        wheelRAF=requestAnimationFrame(flushSalesWheel);
      }
    },{passive:false});
  }

  // Click-and-drag anywhere on empty board area.
  let dragging=false,startX=0,startLeft=0;
  sc.addEventListener("mousedown",e=>{
    if(e.target.closest("button,input,select,textarea,.opp"))return;
    dragging=true;startX=e.clientX;startLeft=sc.scrollLeft;sc.classList.add("dragging");
  });
  window.addEventListener("mousemove",e=>{
    if(!dragging)return;
    sc.scrollLeft=startLeft-(e.clientX-startX);
  });
  window.addEventListener("mouseup",()=>{dragging=false;sc.classList.remove("dragging")});

  function syncMini(){
    const total=sc.scrollWidth, visible=sc.clientWidth;
    const ratio=Math.min(1,visible/Math.max(total,1));
    const railW=rail.clientWidth;
    const thumbW=Math.max(50,railW*ratio);
    const maxThumb=Math.max(0,railW-thumbW);
    const maxScroll=Math.max(1,total-visible);
    thumb.style.width=thumbW+"px";
    thumb.style.transform=`translateX(${maxThumb*(sc.scrollLeft/maxScroll)}px)`;
    left.disabled=sc.scrollLeft<=2;
    right.disabled=sc.scrollLeft>=maxScroll-2;
  }
  sc.addEventListener("scroll",syncMini);
  window.addEventListener("resize",syncMini);

  rail.onclick=e=>{
    if(e.target===thumb)return;
    const rect=rail.getBoundingClientRect();
    const pct=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
    sc.scrollTo({left:(sc.scrollWidth-sc.clientWidth)*pct,behavior:"smooth"});
  };

  let td=false,tx=0,tStart=0;
  thumb.addEventListener("mousedown",e=>{e.preventDefault();td=true;tx=e.clientX;tStart=sc.scrollLeft});
  window.addEventListener("mousemove",e=>{
    if(!td)return;
    const railW=rail.clientWidth, thumbW=thumb.offsetWidth;
    const maxThumb=Math.max(1,railW-thumbW);
    const maxScroll=Math.max(1,sc.scrollWidth-sc.clientWidth);
    sc.scrollLeft=tStart+(e.clientX-tx)*(maxScroll/maxThumb);
  });
  window.addEventListener("mouseup",()=>td=false);


  // Arrastre libre en cualquier zona vacía del Panel:
  // mover el ratón en diagonal desplaza horizontal y vertical simultáneamente.
  if(salesView){
    let panelDrag=false;
    let panelStartX=0;
    let panelStartY=0;
    let startScrollX=0;
    let startScrollY=0;

    salesView.addEventListener("pointerdown",e=>{
      if(e.pointerType==="mouse" && e.button!==0)return;
      if(e.target.closest("button,input,select,textarea,.opp,.stageHead,a"))return;

      panelDrag=true;
      panelStartX=e.clientX;
      panelStartY=e.clientY;
      startScrollX=sc.scrollLeft;
      startScrollY=salesView.scrollTop;
      salesView.classList.add("dragging");
      salesView.setPointerCapture?.(e.pointerId);
    });

    salesView.addEventListener("pointermove",e=>{
      if(!panelDrag)return;
      const dx=e.clientX-panelStartX;
      const dy=e.clientY-panelStartY;

      sc.scrollLeft=startScrollX-dx;
      salesView.scrollTop=startScrollY-dy;
    });

    const stopPanelDrag=e=>{
      if(!panelDrag)return;
      panelDrag=false;
      salesView.classList.remove("dragging");
      try{salesView.releasePointerCapture?.(e.pointerId)}catch(_){}
    };

    salesView.addEventListener("pointerup",stopPanelDrag);
    salesView.addEventListener("pointercancel",stopPanelDrag);
  }

  setTimeout(syncMini,100);
}
setTimeout(initSalesNavigation,300);



if($("salesOptionsToggle"))$("salesOptionsToggle").onclick=()=>{
  const panel=$("salesOptionsPanel");
  const opening=panel.classList.contains("hidden");
  panel.classList.toggle("hidden",!opening);
  $("salesOptionsToggle").textContent=opening?"Opciones del panel ▴":"Opciones del panel ▾";
  setTimeout(()=>window.dispatchEvent(new Event("resize")),50);
};

if($("salesHelpVisual"))$("salesHelpVisual").onclick=()=>{
  $("salesHelpBox")?.classList.toggle("hidden");
};

if($("salesConfigVisual"))$("salesConfigVisual").onclick=()=>{
  $("salesOptionsPanel")?.classList.remove("hidden");
};




function ensureSalesColumnVerticalScroll(){
  const board=$("salesBoard");
  if(!board)return;
  [...board.children].forEach(stage=>{
    if(!(stage instanceof HTMLElement))return;
    stage.style.height="100%";
    stage.style.maxHeight="100%";
    stage.style.minHeight="0";
    stage.style.display="flex";
    stage.style.flexDirection="column";
    stage.style.overflow="hidden";

    // Find the direct child that contains opportunity cards / add button.
    const kids=[...stage.children].filter(x=>x instanceof HTMLElement);
    const body=kids.find(x=>
      x.querySelector?.(".opp") ||
      x.querySelector?.("[draggable='true']") ||
      x.textContent?.includes("Añadir oportunidad") ||
      x.textContent?.includes("Sin oportunidades")
    );
    if(body){
      body.style.flex="1 1 auto";
      body.style.minHeight="0";
      body.style.overflowY="auto";
      body.style.overflowX="hidden";
      body.style.overscrollBehavior="contain";
    }
  });
}
const salesScrollObserver=new MutationObserver(()=>requestAnimationFrame(ensureSalesColumnVerticalScroll));
if($("salesBoard"))salesScrollObserver.observe($("salesBoard"),{childList:true,subtree:true});
window.addEventListener("resize",ensureSalesColumnVerticalScroll);
setTimeout(ensureSalesColumnVerticalScroll,100);
setTimeout(ensureSalesColumnVerticalScroll,500);



const selectedSalesOpportunityIds=new Set();
let salesCurrentView="board";

function getSalesOpportunityById(id){
  return (salesCache.opportunities||[]).find(o=>String(o.id)===String(id));
}
function updateSalesBulkUi(){
  const count=selectedSalesOpportunityIds.size;
  if($("salesSelectedCount"))$("salesSelectedCount").textContent=count+" seleccionada"+(count===1?"":"s");
  if($("salesBulkMove"))$("salesBulkMove").disabled=!count;
  if($("salesBulkDelete"))$("salesBulkDelete").disabled=!count;

  const all=(salesCache.opportunities||[]);
  if($("salesSelectAll")){
    $("salesSelectAll").checked=all.length>0 && count===all.length;
    $("salesSelectAll").indeterminate=count>0 && count<all.length;
  }

  updateStageSelectAllUi();

  document.querySelectorAll(".salesOppCheck,.salesListCheck").forEach(cb=>{
    cb.checked=selectedSalesOpportunityIds.has(String(cb.dataset.oppId));
  });
}
window.toggleSalesOpportunitySelection=(id,checked)=>{
  id=String(id);
  if(checked)selectedSalesOpportunityIds.add(id);
  else selectedSalesOpportunityIds.delete(id);
  updateSalesBulkUi();
};

if($("salesSelectAll"))$("salesSelectAll").onchange=()=>{
  selectedSalesOpportunityIds.clear();
  if($("salesSelectAll").checked){
    (salesCache.opportunities||[]).forEach(o=>selectedSalesOpportunityIds.add(String(o.id)));
  }
  updateSalesBulkUi();
};

function refreshSalesBulkStages(){
  if(!$("salesBulkStage"))return;
  const current=$("salesBulkStage").value;
  $("salesBulkStage").innerHTML='<option value="">Mover a...</option>'+
    (salesCache.stages||[]).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("");
  if((salesCache.stages||[]).some(s=>String(s.id)===String(current)))$("salesBulkStage").value=current;
}

async function moveSelectedSalesOpportunities(){
  const target=$("salesBulkStage")?.value;
  if(!target){alert("Selecciona una columna de destino.");return}
  const ids=[...selectedSalesOpportunityIds];
  if(!ids.length)return;
  if(!confirm(`¿Mover ${ids.length} oportunidad${ids.length===1?"":"es"} a la columna seleccionada?`))return;

  $("salesBulkMove").disabled=true;
  try{
    for(const id of ids){
      const {error}=await sb.from("sales_opportunities").update({stage_id:target,position:0}).eq("id",id);
      if(error)throw error;
    }
    selectedSalesOpportunityIds.clear();
    await loadSales();
  }catch(e){
    alert("No se pudieron mover todas las oportunidades. "+(e?.message||e));
  }finally{
    updateSalesBulkUi();
  }
}

async function deleteSelectedSalesOpportunities(){
  const ids=[...selectedSalesOpportunityIds];
  if(!ids.length)return;
  if(!confirm(`¿Eliminar definitivamente ${ids.length} oportunidad${ids.length===1?"":"es"}?`))return;

  $("salesBulkDelete").disabled=true;
  try{
    const {error}=await sb.from("sales_opportunities").delete().in("id",ids);
    if(error)throw error;
    selectedSalesOpportunityIds.clear();
    await loadSales();
  }catch(e){
    alert("No se pudieron eliminar. "+(e?.message||e));
  }finally{
    updateSalesBulkUi();
  }
}
if($("salesBulkMove"))$("salesBulkMove").onclick=moveSelectedSalesOpportunities;
if($("salesBulkDelete"))$("salesBulkDelete").onclick=deleteSelectedSalesOpportunities;

function renderSalesList(){
  if(!$("salesListRows"))return;
  const stages=salesCache.stages||[];
  const stageName=id=>stages.find(s=>String(s.id)===String(id))?.name||"";
  const rows=salesCache.opportunities||[];

  $("salesListRows").innerHTML=rows.length?rows.map(o=>`
    <div class="salesListRow" onclick="openOpportunityCard('${o.id}')">
      <div><input type="checkbox" class="salesListCheck" data-opp-id="${o.id}" onclick="event.stopPropagation();toggleSalesOpportunitySelection('${o.id}',this.checked)"></div>
      <div class="salesListTitle">${esc(o.title||"Oportunidad")}</div>
      <div>${o.client_name?`<button type="button" class="salesClientLink" onclick="event.stopPropagation();openSalesOpportunityContact('${o.id}')">${esc(o.client_name)}</button>`:"—"}</div>
      <div class="tpfSalesDni" data-record-id="${esc(o.record_id||'')}">${esc(window.TPFContactParty?.opportunityIdentity(o).dni||'—')}</div>
      <div>${esc(o.phone||"—")}</div>
      <div>${esc(fmtMoney(o.amount||0))}</div>
      <div>
        <select onclick="event.stopPropagation()" onchange="event.stopPropagation();moveOpp('${o.id}',this.value)">
          ${stages.map(s=>`<option value="${s.id}" ${String(s.id)===String(o.stage_id)?"selected":""}>${esc(s.name)}</option>`).join("")}
        </select>
      </div>
      <div>${o.expected_date?esc(fmtDateOnly(o.expected_date)):"—"}</div>
    </div>`).join("")
    : '<div class="cpEmpty" style="padding:20px">No hay oportunidades.</div>';

  updateSalesBulkUi();
}

function setSalesView(mode){
  salesCurrentView=mode==="list"?"list":"board";
  const isList=salesCurrentView==="list";
  $("salesListView")?.classList.toggle("hidden",!isList);
  document.querySelector(".salesBoardViewport")?.classList.toggle("hidden",isList);
  $("salesViewBoard")?.classList.toggle("activeViewBtn",!isList);
  $("salesViewList")?.classList.toggle("activeViewBtn",isList);
  if(isList)renderSalesList();
  try{localStorage.setItem("tpf_sales_view",salesCurrentView)}catch(e){}
}
if($("salesViewBoard"))$("salesViewBoard").onclick=()=>setSalesView("board");
if($("salesViewList"))$("salesViewList").onclick=()=>setSalesView("list");

setTimeout(()=>{
  let saved="board";
  try{saved=localStorage.getItem("tpf_sales_view")||"board"}catch(e){}
  setSalesView(saved);
},100);



function refreshVisibleSalesStateFilter(){
  const sel=$("salesVisibleStateFilter");
  if(!sel)return;
  const current=sel.value;
  sel.innerHTML='<option value="">Todos los estados</option>'+
    (salesCache.stages||[]).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("");
  if((salesCache.stages||[]).some(s=>String(s.id)===String(current)))sel.value=current;
}

function applyVisibleSalesStateFilter(){
  const selected=String($("salesVisibleStateFilter")?.value||"");

  // Tablero: ocultar las columnas que no correspondan al estado elegido.
  const board=$("salesBoard");
  if(board){
    [...board.children].forEach(stageEl=>{
      if(!(stageEl instanceof HTMLElement))return;
      const stageId=String(stageEl.dataset.stageId||stageEl.getAttribute("data-stage-id")||"");
      // Fallback: match stage by visible heading text.
      let matches=!selected;
      if(selected){
        if(stageId) matches=stageId===selected;
        else{
          const wanted=(salesCache.stages||[]).find(s=>String(s.id)===selected);
          const text=(stageEl.textContent||"").toLowerCase();
          matches=!!wanted && text.includes(String(wanted.name||"").toLowerCase());
        }
      }
      stageEl.style.display=matches?"":"none";
    });
  }

  // Lista: ocultar filas cuyo estado no corresponda.
  document.querySelectorAll("#salesListRows .salesListRow").forEach(row=>{
    const id=row.querySelector(".salesListCheck")?.dataset.oppId;
    const opp=getSalesOpportunityById(id);
    row.style.display=(!selected || String(opp?.stage_id)===selected)?"":"none";
  });
}

if($("salesVisibleStateFilter"))$("salesVisibleStateFilter").onchange=()=>{
  applyVisibleSalesStateFilter();
};

const salesFilterObserver=new MutationObserver(()=>requestAnimationFrame(applyVisibleSalesStateFilter));
if($("salesBoard"))salesFilterObserver.observe($("salesBoard"),{childList:true,subtree:true});
if($("salesListRows"))salesFilterObserver.observe($("salesListRows"),{childList:true,subtree:true});

setTimeout(()=>{
  refreshVisibleSalesStateFilter();
  applyVisibleSalesStateFilter();
},150);



/* No capturar la rueda del ratón en el tablero: el navegador debe hacer
   scroll vertical normal aunque el puntero esté encima de una oportunidad. */
if($("salesBoard")){
  $("salesBoard").addEventListener("wheel", function(e){
    if(Math.abs(e.deltaY) >= Math.abs(e.deltaX)){
      window.scrollBy({top:e.deltaY, left:0, behavior:"auto"});
      e.preventDefault();
    }
  }, {passive:false, capture:true});
}



function installDefinitiveSalesScroll(){
  const sc=$("salesScroll");
  if(!sc || sc.dataset.definitiveScroll==="1")return;
  sc.dataset.definitiveScroll="1";

  sc.addEventListener("wheel",e=>{
    const stage=e.target.closest(".stage");
    const dx=Number(e.deltaX||0);
    const dy=Number(e.deltaY||0);

    // Stop all older wheel handlers from fighting this one.
    e.preventDefault();
    e.stopImmediatePropagation();

    // Shift + normal wheel = horizontal, for a standard mouse.
    if(e.shiftKey){
      sc.scrollLeft += (Math.abs(dx)>0.1 ? dx : dy) * 1.25;
      return;
    }

    // True horizontal gesture / horizontal wheel.
    if(Math.abs(dx) > Math.abs(dy)*0.65 && Math.abs(dx)>1){
      sc.scrollLeft += dx * 1.35;
      return;
    }

    // Vertical wheel: scroll the column under the mouse.
    if(stage){
      stage.scrollTop += dy;

      // If this column is already at its limit and there's a meaningful X delta,
      // still allow horizontal motion.
      const maxY=Math.max(0,stage.scrollHeight-stage.clientHeight);
      const atLimit=(dy<0 && stage.scrollTop<=0) || (dy>0 && stage.scrollTop>=maxY-1);
      if(atLimit && Math.abs(dx)>1) sc.scrollLeft += dx*1.35;
      return;
    }

    // If pointer is between columns, vertical wheel scrolls the first visible column
    // with overflow; horizontal still works through deltaX.
    if(Math.abs(dx)>1){
      sc.scrollLeft += dx*1.35;
    }else{
      const visible=[...sc.querySelectorAll(".stage")].find(s=>s.scrollHeight>s.clientHeight+2);
      if(visible) visible.scrollTop += dy;
    }
  },{passive:false,capture:true});
}

function normalizeSalesStages(){
  const board=$("salesBoard");
  if(!board)return;
  [...board.querySelectorAll(":scope > .stage")].forEach(stage=>{
    stage.style.height="100%";
    stage.style.maxHeight="100%";
    stage.style.minHeight="0";
    stage.style.overflowY="auto";
    stage.style.overflowX="hidden";
  });
}
const definitiveSalesObserver=new MutationObserver(()=>requestAnimationFrame(normalizeSalesStages));
if($("salesBoard"))definitiveSalesObserver.observe($("salesBoard"),{childList:true});
setTimeout(()=>{normalizeSalesStages();installDefinitiveSalesScroll()},50);
setTimeout(()=>{normalizeSalesStages();installDefinitiveSalesScroll()},500);



function installFinalSalesMouseNavigation(){
  const sc=$("salesScroll");
  if(!sc || sc.dataset.finalMouseNav==="1")return;
  sc.dataset.finalMouseNav="1";

  sc.addEventListener("wheel",e=>{
    const stage=e.target.closest(".stage");
    const dx=Number(e.deltaX||0);
    const dy=Number(e.deltaY||0);

    e.preventDefault();
    e.stopImmediatePropagation();

    // Standard mouse: Shift + wheel always moves left/right.
    if(e.shiftKey){
      sc.scrollLeft += (Math.abs(dx)>0.5 ? dx : dy) * 1.7;
      return;
    }

    // Mouse/trackpad with real horizontal delta:
    // don't require it to dominate the vertical delta too strongly.
    if(Math.abs(dx)>=2){
      sc.scrollLeft += dx * 1.7;

      // If the gesture also contains a meaningful vertical component,
      // keep the column moving vertically too.
      if(stage && Math.abs(dy)>=4){
        stage.scrollTop += dy;
      }
      return;
    }

    // Ordinary wheel: vertical inside the column under the pointer.
    if(stage){
      stage.scrollTop += dy;
      return;
    }

    // Between columns: use the nearest visible scrollable column.
    const stages=[...sc.querySelectorAll(".stage")];
    const visible=stages.find(s=>{
      const r=s.getBoundingClientRect();
      const sr=sc.getBoundingClientRect();
      return r.right>sr.left && r.left<sr.right && s.scrollHeight>s.clientHeight+2;
    });
    if(visible)visible.scrollTop += dy;
  },{passive:false,capture:true});
}
setTimeout(installFinalSalesMouseNavigation,20);
setTimeout(installFinalSalesMouseNavigation,300);



window.toggleStageSelection=(stageId,checked)=>{
  const ids=(salesCache.opportunities||[])
    .filter(o=>String(o.stage_id)===String(stageId))
    .map(o=>String(o.id));

  for(const id of ids){
    if(checked) selectedSalesOpportunityIds.add(id);
    else selectedSalesOpportunityIds.delete(id);
  }

  updateSalesBulkUi();
  updateStageSelectAllUi();
};

function updateStageSelectAllUi(){
  document.querySelectorAll(".stageSelectAll").forEach(cb=>{
    const stageId=String(cb.dataset.stageId||"");
    const ids=(salesCache.opportunities||[])
      .filter(o=>String(o.stage_id)===stageId)
      .map(o=>String(o.id));

    const selected=ids.reduce((n,id)=>n+(selectedSalesOpportunityIds.has(id)?1:0),0);
    cb.checked=ids.length>0 && selected===ids.length;
    cb.indeterminate=selected>0 && selected<ids.length;
  });
}



let activeStageMenuId=null;

window.openStageMenu=(ev,stageId)=>{
  activeStageMenuId=String(stageId);
  const menu=$("stageContextMenu");
  const r=ev.currentTarget.getBoundingClientRect();
  menu.style.left=Math.min(r.left,window.innerWidth-230)+"px";
  menu.style.top=(r.bottom+6)+"px";
  menu.classList.remove("hidden");
};

function closeStageContextMenu(){
  $("stageContextMenu")?.classList.add("hidden");
}
document.addEventListener("click",closeStageContextMenu);
window.addEventListener("resize",closeStageContextMenu);
window.addEventListener("scroll",closeStageContextMenu,true);


function openNewOpportunityInStage(stageId){
  const stage=(salesCache.stages||[]).find(s=>String(s.id)===String(stageId));
  if(!stage){alert("No encuentro esta columna.");return;}

  $("oppModalSave").textContent="Crear oportunidad";
  $("oppModalDelete").classList.add("hidden");
  $("oppModalId").value="";
  window.TPFContactParty?.mountOpportunity();
  $("oppModalHeading").textContent="Nueva oportunidad";
  $("oppModalTitle").value="";
  $("oppModalClient").value="";
  $("oppModalPhone").value="";
  $("oppModalDni").value="";
  $("oppModalOpenContact").dataset.recordId="";
  pendingOpportunityRecordId=null;
  $("oppModalAmount").value="";
  $("oppModalDate").value="";
  $("oppModalNotes").value="";
  $("oppModalStage").innerHTML=(salesCache.stages||[]).map(s=>
    `<option value="${s.id}" ${String(s.id)===String(stageId)?"selected":""}>${esc(s.name)}</option>`
  ).join("");
  $("oppCustomFieldsView").innerHTML='<div class="small oppNoCustom">Completa los datos de la nueva oportunidad.</div>';
  $("oppMetaInfo").textContent="Se creará en la columna: "+stage.name;
  $("oppDetailModal").classList.remove("hidden");
  setTimeout(()=>$("oppModalTitle")?.focus(),50);
}

function bindStageContextMenuActions(){
  const newOppBtn=$("stageMenuNewOpp");
  const newStageBtn=$("stageMenuNewStage");
  const renameBtn=$("stageMenuRename");
  if(!newOppBtn||!newStageBtn||!renameBtn)return;

  newOppBtn.onclick=()=>{
    const stageId=activeStageMenuId;
    closeStageContextMenu();
    openNewOpportunityInStage(stageId);
  };

  newStageBtn.onclick=async()=>{
    closeStageContextMenu();
    const name=prompt("Nombre de la nueva columna");
    if(!name?.trim())return;

    const {error}=await sb.rpc("add_sales_stage",{stage_name:name.trim()});
    if(error){
      alert("No se pudo crear la columna: "+error.message);
      return;
    }
    await loadSales();
  };

  renameBtn.onclick=async()=>{
    const id=activeStageMenuId;
    const stage=(salesCache.stages||[]).find(s=>String(s.id)===String(id));
    closeStageContextMenu();
    if(!stage)return;

    const name=prompt("Nuevo nombre de la columna",stage.name||"");
    if(!name?.trim() || name.trim()===stage.name)return;

    const {error}=await sb.from("sales_stages")
      .update({name:name.trim()})
      .eq("id",id);

    if(error){
      alert("No se pudo cambiar el nombre: "+error.message);
      return;
    }
    await loadSales();
  };
}

// El menú está al final del body, así que enlazamos cuando ya existe.
if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",bindStageContextMenuActions,{once:true});
}else{
  bindStageContextMenuActions();
}




window.moveContactOpportunityStage=async(id,stageId)=>{
  const select=document.querySelector(`.cpOppAdvancedCard[data-opp-id="${CSS.escape(String(id))}"] select`);
  if(select)select.disabled=true;
  try{
    const {error}=await sb.from("sales_opportunities")
      .update({stage_id:stageId,position:0})
      .eq("id",id);
    if(error)throw error;

    const opp=(salesCache.opportunities||[]).find(o=>String(o.id)===String(id));
    if(opp)opp.stage_id=stageId;

    if(typeof renderContactProfile==="function"){
      try{await renderContactProfile()}catch(_){}
    }
    if(typeof loadSales==="function")loadSales();
  }catch(e){
    alert("No se pudo cambiar de columna: "+(e?.message||e));
    if(typeof loadSales==="function")loadSales();
  }finally{
    if(select)select.disabled=false;
  }
};



let __contactOpportunityReturnId=null;

window.openContactOpportunityFromProfile=(oppId)=>{
  __contactOpportunityReturnId=currentContact?.id||null;
  openOpportunityCard(oppId);
};

function restoreContactAfterOpportunity(){
  const contactId=__contactOpportunityReturnId;
  __contactOpportunityReturnId=null;
  if(!contactId)return false;

  // Keep / restore the full contact profile.
  const contactModal=$("contactModal");
  if(contactModal)contactModal.classList.remove("hidden");

  // If for any reason the contact profile was left, reload the same contact.
  if(!currentContact || String(currentContact.id)!==String(contactId)){
    setTimeout(()=>openContact(contactId),0);
  }
  return true;
}


window.addEventListener("error",(ev)=>console.error("TPF runtime error:",ev.error||ev.message));
window.addEventListener("unhandledrejection",(ev)=>console.error("TPF promise error:",ev.reason));

/* ===== CRM mejoras completas ===== */
let crmAlertsCache=[];

window.openAppView=function(view){
  const n=[...document.querySelectorAll(".nav")].find(x=>x.dataset.view===view);
  if(n){n.click();return}
};

function localDateKey(d=new Date()){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function daysSince(v){ if(!v)return 999; return Math.floor((Date.now()-new Date(v).getTime())/86400000); }
function oppIsExpired(o){return !!o.expected_date && o.expected_date<localDateKey() && !["won","ganada","ganado","closed","cerrada"].includes(String(o.status||"").toLowerCase())}
function oppIsOpen(o){return !oppIsExpired(o) && !["won","ganada","ganado","lost","perdida","closed","cerrada"].includes(String(o.status||"").toLowerCase())}
function stageLooksWon(name){return /ganad|cerrad.*gan|venta|contratad/i.test(String(name||""))}

function localTrashRead(){
  try{return JSON.parse(localStorage.getItem("tpf_crm_trash_fallback")||"[]")}catch(e){return []}
}
function localTrashWrite(rows){
  try{localStorage.setItem("tpf_crm_trash_fallback",JSON.stringify(rows||[]));return true}catch(e){return false}
}
function localAuditRead(){
  try{return JSON.parse(localStorage.getItem("tpf_crm_audit_fallback")||"[]")}catch(e){return []}
}
function localAuditWrite(rows){
  try{localStorage.setItem("tpf_crm_audit_fallback",JSON.stringify((rows||[]).slice(0,200)));return true}catch(e){return false}
}

async function archiveToTrash(entityType,entityId,label,payload){
  const row={
    id:"local-"+Date.now()+"-"+Math.random().toString(36).slice(2,8),
    entity_type:entityType,
    entity_id:entityId||null,
    label:label||entityType,
    payload:payload||{},
    deleted_at:new Date().toISOString(),
    expires_at:new Date(Date.now()+30*86400000).toISOString()
  };
  try{
    const {error}=await sb.from("crm_trash").insert({
      entity_type:row.entity_type,
      entity_id:row.entity_id,
      label:row.label,
      payload:row.payload
    });
    if(error)throw error;
    await auditAction(entityType,entityId,"delete","Enviado a papelera",{label});
    return true;
  }catch(e){
    console.warn("Papelera Supabase no disponible; usando copia local.",e?.message||e);
    const rows=localTrashRead();
    rows.unshift(row);
    const ok=localTrashWrite(rows);
    await auditAction(entityType,entityId,"delete","Enviado a papelera local",{label});
    return ok;
  }
}
async function auditAction(entityType,entityId,action,summary,details={}){
  const row={
    id:"local-audit-"+Date.now()+"-"+Math.random().toString(36).slice(2,8),
    entity_type:entityType,
    entity_id:entityId||null,
    action,
    summary,
    details,
    created_at:new Date().toISOString()
  };
  try{
    const {error}=await sb.from("crm_audit_log").insert({
      entity_type:row.entity_type,
      entity_id:row.entity_id,
      action:row.action,
      summary:row.summary,
      details:row.details
    });
    if(error)throw error;
  }catch(e){
    const rows=localAuditRead();
    rows.unshift(row);
    localAuditWrite(rows);
  }
}

async function loadCrmData(){
  const [oppR,stageR,taskR,recR,actR]=await Promise.all([
    sb.from("sales_opportunities").select("*").order("updated_at",{ascending:false}).limit(1000),
    sb.from("sales_stages").select("*").eq("active",true).order("position"),
    sb.from("agenda_items").select("*").order("starts_at",{ascending:true}).limit(500),
    sb.from("records").select("id,source_sheet,data,created_at,updated_at").eq("source_sheet","BASE DE DATOS").limit(5000),
    sb.from("crm_audit_log").select("*").order("created_at",{ascending:false}).limit(20)
  ]);
  const localActivity=localAuditRead();
  const activity=actR.error ? localActivity : [...(actR.data||[]),...localActivity].sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||""))).slice(0,50);
  return {opps:oppR.data||[],stages:stageR.data||[],tasks:taskR.data||[],records:recR.data||[],activity};
}

function buildAlerts(data){
  const today=localDateKey(), alerts=[];
  data.opps.forEach(o=>{
    if(oppIsExpired(o)) alerts.push({type:"expired",severity:"red",title:o.title||"Oportunidad vencida",sub:`${o.client_name||"Sin cliente"} · Fecha ${fmtDateOnly(o.expected_date)}`,oppId:o.id,date:o.expected_date});
    else if(o.expected_date===today) alerts.push({type:"today",severity:"amber",title:o.title||"Oportunidad para hoy",sub:o.client_name||"Sin cliente",oppId:o.id,date:o.expected_date});
    if(oppIsOpen(o)&&daysSince(o.updated_at)>=3) alerts.push({type:"stale",severity:"amber",title:o.title||"Oportunidad sin seguimiento",sub:`${o.client_name||"Sin cliente"} · ${daysSince(o.updated_at)} días sin cambios`,oppId:o.id,date:o.updated_at});
  });
  data.tasks.filter(t=>String(t.status||"pending")==="pending").forEach(t=>{
    const k=t.starts_at?String(t.starts_at).slice(0,10):"";
    if(k<today)alerts.push({type:"expired",severity:"red",title:t.title||"Tarea atrasada",sub:`Tarea · ${t.customer_name||""}`,taskId:t.id,date:k});
    else if(k===today)alerts.push({type:"today",severity:"amber",title:t.title||"Tarea para hoy",sub:t.customer_name||"Agenda",taskId:t.id,date:k});
  });
  return alerts.sort((a,b)=>(a.severity==="red"?0:1)-(b.severity==="red"?0:1));
}

async function loadDashboard(){
  try{
    const d=await loadCrmData(), today=localDateKey();
    const open=d.opps.filter(oppIsOpen), expired=d.opps.filter(oppIsExpired);
    const amount=d.opps.reduce((s,o)=>s+Number(o.amount||0),0);
    const wonStageIds=new Set(d.stages.filter(s=>stageLooksWon(s.name)).map(s=>s.id));
    const won=d.opps.filter(o=>wonStageIds.has(o.stage_id)||/won|ganad/i.test(String(o.status||""))).length;
    const pending=d.tasks.filter(t=>String(t.status||"pending")==="pending");
    const todayTasks=pending.filter(t=>String(t.starts_at||"").slice(0,10)===today).length;
    $("mOppTotal").textContent=d.opps.length;$("mOppAmount").textContent=fmtMoney(amount);
    $("mOppOpen").textContent=open.length;$("mOppExpired").textContent=expired.length;
    $("mTasks").textContent=pending.length;$("mTasksToday").textContent=todayTasks?`${todayTasks} para hoy`:"Ninguna para hoy";
    $("mContacts").textContent=d.records.length;$("mConversion").textContent=d.opps.length?`${Math.round(won/d.opps.length*100)}%`:"0%";
    crmAlertsCache=buildAlerts(d); updateAlertBadge();
    $("dashAlerts").innerHTML=crmAlertsCache.slice(0,6).map(a=>`<div class="dashItem"><div class="dashItemMain"><b>${esc(a.title)}</b><small>${esc(a.sub)}</small></div><div class="itemActionPack"><span class="pill ${a.severity}">${a.type==="expired"?"Vencida":a.type==="stale"?"Sin seguimiento":"Hoy"}</span>${renderCrmActions(a)}</div></div>`).join("")||'<div class="small">Todo al día. No hay avisos prioritarios.</div>';
    const counts=d.stages.map(s=>({name:s.name,count:d.opps.filter(o=>o.stage_id===s.id).length})); const mx=Math.max(1,...counts.map(x=>x.count));
    $("dashFunnel").innerHTML=counts.map(x=>`<div class="funnelRow"><span>${esc(x.name)}</span><div class="funnelBar"><div class="funnelFill" style="width:${Math.max(3,x.count/mx*100)}%"></div></div><b>${x.count}</b></div>`).join("")||'<div class="small">No hay columnas.</div>';
    $("dashActivity").innerHTML=d.activity.slice(0,8).map(a=>`<div class="dashItem"><div class="dashItemMain"><b>${esc(a.summary||a.action)}</b><small>${new Date(a.created_at).toLocaleString("es-ES")}</small></div><div class="itemActionPack"><span class="pill">${esc(a.entity_type)}</span>${renderAuditActions(a)}</div></div>`).join("")||'<div class="small">La actividad nueva aparecerá aquí.</div>';
  }catch(e){console.error(e);$("dashAlerts").innerHTML=`<div class="small">${esc(e.message||"No se pudo cargar el resumen")}</div>`}
}
function updateAlertBadge(){const el=$("navAlertCount");if(el)el.textContent=crmAlertsCache.length}

async function loadAlerts(){
  const d=await loadCrmData(); crmAlertsCache=buildAlerts(d); updateAlertBadge(); renderAlerts("all");
}
function renderAlerts(filter){
  const arr=filter==="all"?crmAlertsCache:crmAlertsCache.filter(a=>a.type===filter);
  $("alertsList").innerHTML=arr.map(a=>{
    const entityLabel=a.oppId?"Oportunidad":a.taskId?"Tarea":"Aviso";
    const entityClass=a.oppId?"entityOpportunity":a.taskId?"entityTask":"entityNotice";
    return `<div class="alertItem" data-type="${a.type}">
      <div class="alertMain">
        <div class="alertTitleRow">
          <span class="entityBadge ${entityClass}">${entityLabel}</span>
          <b>${esc(a.title)}</b>
        </div>
        <small>${esc(a.sub)}</small>
      </div>
      <div class="alertActions">
        <span class="pill ${a.severity}">${a.type==="expired"?"Vencida":a.type==="stale"?"Sin seguimiento":"Hoy"}</span>
        ${renderCrmActions(a)}
      </div>
    </div>`;
  }).join("")||'<div class="alertItem"><div><b>Sin avisos</b><small>No hay elementos en este filtro.</small></div></div>';
}
document.querySelectorAll("[data-alert-filter]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-alert-filter]").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderAlerts(b.dataset.alertFilter)});
$("alertsRefresh").onclick=loadAlerts;$("dashRefresh").onclick=loadDashboard;
$("dashNewOpp").onclick=()=>{openAppView("sales");setTimeout(()=>$("newOpp")?.click(),150)};

async function loadTrash(){
  let remote=[];
  let remoteOk=false;
  try{
    const {data,error}=await sb.from("crm_trash").select("*").order("deleted_at",{ascending:false}).limit(300);
    if(error)throw error;
    remote=data||[];
    remoteOk=true;
  }catch(e){
    console.warn("Papelera remota no disponible.",e?.message||e);
  }

  const local=localTrashRead().filter(x=>!x.expires_at || new Date(x.expires_at)>new Date());
  if(local.length!==localTrashRead().length)localTrashWrite(local);

  const rows=[...remote,...local].sort((a,b)=>String(b.deleted_at||"").localeCompare(String(a.deleted_at||"")));
  $("trashList").innerHTML=rows.map(x=>`<div class="trashItem"><div><b>${esc(x.label||x.entity_type)}</b><div class="trashMeta">${esc(x.entity_type)} · eliminado ${new Date(x.deleted_at).toLocaleString("es-ES")} · se conserva hasta ${new Date(x.expires_at||Date.now()+30*86400000).toLocaleDateString("es-ES")}${String(x.id).startsWith("local-")?" · copia local":""}</div></div><div><button class="secondary" onclick="restoreTrash('${x.id}')">Restaurar</button><button class="danger" onclick="purgeTrash('${x.id}')">Eliminar definitivamente</button></div></div>`).join("")||'<div class="small">La papelera está vacía.</div>';
}
window.restoreTrash=async(id)=>{
  let x=null;
  let isLocal=String(id).startsWith("local-");
  if(isLocal){
    x=localTrashRead().find(r=>String(r.id)===String(id));
  }else{
    const r=await sb.from("crm_trash").select("*").eq("id",id).maybeSingle();
    if(r.error){alert(r.error.message);return}
    x=r.data;
  }
  if(!x){alert("No encuentro este elemento en la papelera.");return}

  try{
    if(x.entity_type==="contact"&&x.payload?.record){
      const r={...x.payload.record,id:x.entity_id||x.payload.record.id};
      const {error}=await sb.from("records").insert(r); if(error)throw error;
    }else if(x.entity_type==="opportunity"&&x.payload?.opportunity){
      const r={...x.payload.opportunity,id:x.entity_id||x.payload.opportunity.id};
      const {error}=await sb.from("sales_opportunities").insert(r); if(error)throw error;
    }else if(x.entity_type==="agenda"&&x.payload?.agenda){
      const r={...x.payload.agenda,id:x.entity_id||x.payload.agenda.id};
      const {error}=await sb.from("agenda_items").insert(r); if(error)throw error;
    }else throw new Error("Este elemento no tiene datos restaurables.");

    if(isLocal){
      localTrashWrite(localTrashRead().filter(r=>String(r.id)!==String(id)));
    }else{
      const {error}=await sb.from("crm_trash").delete().eq("id",id); if(error)throw error;
    }
    await auditAction(x.entity_type,x.entity_id,"restore","Restaurado desde papelera",{label:x.label});
    window.TPFRecordLinks?.invalidate(sb);
    if(x.entity_type==="contact"){
      await window.tpfReloadContacts?.();
      window.dispatchEvent(new CustomEvent('tpf:contact-created',{detail:{id:x.entity_id}}));
    }else if(x.entity_type==="opportunity")await loadSales();
    else if(x.entity_type==="agenda")await window.TPFRefreshTasks?.();
    await loadTrash();
  }catch(e){alert(e?.message||"No se pudo restaurar")}
};
window.purgeTrash=async(id)=>{
  if(!confirm("¿Eliminar definitivamente? Esta acción no se puede deshacer."))return;
  if(String(id).startsWith("local-")){
    localTrashWrite(localTrashRead().filter(r=>String(r.id)!==String(id)));
    loadTrash();
    return;
  }
  const {error}=await sb.from("crm_trash").delete().eq("id",id);
  if(error)alert(error.message);else loadTrash();
};
$("trashRefresh").onclick=loadTrash;

let globalSearchTimer=null;
$("globalSearch").addEventListener("input",()=>{
  clearTimeout(globalSearchTimer);const q=$("globalSearch").value.trim();
  if(q.length<2){$("globalSearchResults").classList.add("hidden");return}
  globalSearchTimer=setTimeout(async()=>{
    const {data}=await sb.rpc("search_records",{search_text:q||null,sheet_filter:"BASE DE DATOS",result_limit:8});
    const rows=(data||[]).slice(0,8);
    $("globalSearchResults").innerHTML=rows.map(r=>{const d=r.data||{};const name=d["NOMBRE Y APELLIDOS"]||d["NOMBRE"]||d["CLIENTE"]||"Contacto";const phone=d["TELÉFONO"]||d["TELEFONO"]||"";const dni=d["DNI / NIF"]||d["DNI"]||"";return `<div class="gsr"><div class="gsrMain" onclick="openGlobalContact('${r.id}')"><b>${esc(name)}</b><small>${esc(phone)} ${dni?"· "+esc(dni):""}</small></div><div class="gsrActions"><button class="secondary miniAction" onclick="event.stopPropagation();openGlobalContact('${r.id}')">Abrir</button><button class="secondary miniAction" onclick="event.stopPropagation();openGlobalContact('${r.id}')">Editar</button></div></div>`}).join("")||'<div class="gsr"><small>Sin resultados</small></div>';
    $("globalSearchResults").classList.remove("hidden");
  },220);
});
window.openGlobalContact=async(id)=>{
  const current=tpfVisibleMainView();
  const top=window.__tpfNavStack[window.__tpfNavStack.length-1];
  if(current && top!==current)window.__tpfNavStack.push(current);
  $("globalSearchResults").classList.add("hidden");
  $("globalSearch").value="";
  await openContact(id);
};
document.addEventListener("click",e=>{if(!e.target.closest(".globalSearchWrap"))$("globalSearchResults")?.classList.add("hidden")});

$("backupJson").onclick=async()=>{
  const btn=$("backupJson");
  const msg=$("backupMsg");
  btn.disabled=true;
  if(msg)msg.textContent="Preparando copia completa...";
  try{
    const base=await loadCrmData();

    async function safeTable(table){
      try{
        const {data,error}=await sb.from(table).select("*");
        if(error)throw error;
        return {ok:true,data:data||[]};
      }catch(error){
        return {ok:false,data:[],error:error?.message||String(error)};
      }
    }

    const tableNames=[
      "crm_labels",
      "crm_contact_labels",
      "crm_custom_fields",
      "crm_contact_custom_values",
      "crm_automations",
      "sales_custom_fields",
      "sales_custom_values",
      "app_settings"
    ];

    const results=await Promise.all(tableNames.map(async name=>[name,await safeTable(name)]));
    const extras=Object.fromEntries(results);

    const backup={
      format:"THE_PHONE_FACE_FULL_BACKUP",
      version:2,
      exported_at:new Date().toISOString(),
      core:{
        contacts:base.records||[],
        opportunities:base.opps||[],
        agenda:base.tasks||[]
      },
      crm:{
        labels:extras.crm_labels,
        contact_labels:extras.crm_contact_labels,
        custom_fields:extras.crm_custom_fields,
        contact_custom_values:extras.crm_contact_custom_values,
        automations:extras.crm_automations,
        sales_custom_fields:extras.sales_custom_fields,
        sales_custom_values:extras.sales_custom_values,
        app_settings:extras.app_settings
      }
    };

    const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=`the-phone-face-backup-completo-${localDateKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);

    const failed=results.filter(([,r])=>!r.ok).map(([name])=>name);
    if(msg)msg.textContent=failed.length
      ? `Copia creada. Aviso: no se pudieron incluir ${failed.join(", ")}.`
      : "Copia completa creada correctamente.";
  }catch(e){
    if(msg)msg.textContent=e?.message||"No se pudo crear la copia.";
  }finally{
    btn.disabled=false;
  }
};
$("backupCsv").onclick=async()=>{
  const {data=[]}=await sb.from("sales_opportunities").select("*").order("created_at");
  const cols=["title","client_name","phone","amount","expected_date","status","notes","created_at","updated_at"];
  const csv=[cols.join(";"),...data.map(r=>cols.map(c=>`"${String(r[c]??"").replaceAll('"','""')}"`).join(";"))].join("\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`oportunidades-${localDateKey()}.csv`;a.click();URL.revokeObjectURL(a.href);
};

// Audit important actions without blocking normal workflow.
const __origMoveOpp=window.moveOpp;
window.moveOpp=async function(id,stage){await __origMoveOpp(id,stage);auditAction("opportunity",id,"move","Oportunidad movida",{stage_id:stage})};

setTimeout(()=>{ if(!$("app").classList.contains("hidden")) loadDashboard(); },1200);



function renderCrmActions(a){
  if(a.oppId){
    return `<button class="secondary miniAction" onclick="openOpportunityFull('${a.oppId}')">Abrir</button>
            <button class="secondary miniAction" onclick="openOpportunityCard('${a.oppId}')">Editar</button>
            <button class="danger miniAction" onclick="deleteOpp('${a.oppId}')">Eliminar</button>`;
  }
  if(a.taskId){
    return `<button class="secondary miniAction" onclick="openAlertTask('${a.taskId}')">Abrir</button>
            <button class="secondary miniAction" onclick="editAlertTask('${a.taskId}')">Editar</button>
            <button class="danger miniAction" onclick="deleteAlertTask('${a.taskId}')">Eliminar</button>`;
  }
  return "";
}

function renderAuditActions(a){
  const id=a.entity_id||"";
  const type=String(a.entity_type||"").toLowerCase();
  if(!id)return "";
  if(type==="opportunity"){
    return `<button class="secondary miniAction" onclick="openOpportunityWithHistory('${id}')">Abrir</button>
            <button class="secondary miniAction" onclick="openOpportunityCard('${id}')">Editar</button>
            <button class="danger miniAction" onclick="deleteOpp('${id}')">Eliminar</button>`;
  }
  if(type==="agenda"||type==="task"){
    return `<button class="secondary miniAction" onclick="openContactTaskDetail('${id}')">Abrir</button>
            <button class="secondary miniAction" onclick="openContactTaskDetail('${id}')">Editar</button>
            <button class="danger miniAction" onclick="deleteAgenda('${id}')">Eliminar</button>`;
  }
  if(type==="contact"){
    return `<button class="secondary miniAction" onclick="openContact('${id}')">Abrir</button>
            <button class="secondary miniAction" onclick="openContact('${id}')">Editar</button>`;
  }
  return "";
}

// En la agenda añadimos también Abrir y Editar de forma explícita.
window.openAgendaItem=async(id)=>openContactTaskDetail(id);
window.editAgendaItem=async(id)=>openContactTaskDetail(id);



/* ===== Navegación "Volver" real en toda la aplicación ===== */
window.__tpfNavStack = window.__tpfNavStack || [];
window.__tpfCurrentView = window.__tpfCurrentView || "dashboard";

function tpfVisibleMainView(){
  const views=["dashboard","alerts","search","database","sales","import","agenda","whatsapplive","whatsapp","settings","automations","users","trash"];
  return views.find(v=>!$("view-"+v)?.classList.contains("hidden")) || window.__tpfCurrentView || "dashboard";
}

function tpfPushView(view){
  const current=tpfVisibleMainView();
  if(current && current!==view){
    const top=window.__tpfNavStack[window.__tpfNavStack.length-1];
    if(top!==current)window.__tpfNavStack.push(current);
  }
  window.__tpfCurrentView=view;
}

window.tpfGoBack=()=>{
  const previous=window.__tpfNavStack.pop();
  if(previous){
    const nav=[...document.querySelectorAll(".nav")].find(n=>n.dataset.view===previous);
    if(nav){
      nav.dataset.tpfBackNavigation="1";
      nav.click();
      delete nav.dataset.tpfBackNavigation;
      return true;
    }
  }
  return false;
};

function tpfSetBackButton(btn,fallback){
  if(!btn)return;
  btn.textContent="← Volver";
  btn.onclick=()=>{
    if(!tpfGoBack() && typeof fallback==="function")fallback();
  };
}



window.openOpportunityWithHistory=(id)=>{
  const current=tpfVisibleMainView();
  const top=window.__tpfNavStack[window.__tpfNavStack.length-1];
  if(current && top!==current)window.__tpfNavStack.push(current);
  openOpportunityFull(id);
};



function closeOpenDetailScreensForNavigation(){
  // Opportunity views
  $("opportunityFullPage")?.classList.add("hidden");
  $("oppDetailModal")?.classList.add("hidden");

  // Contact profile
  $("contactModal")?.classList.add("hidden");

  // Contact task subpages / details
  $("cpTaskPage")?.classList.add("hidden");
  $("cpTaskDetailPage")?.classList.add("hidden");

  // WhatsApp quick modal
  $("waQuickModal")?.classList.add("hidden");
  $("waQuickScheduleBox")?.classList.add("hidden");

  // Any contextual popovers
  $("stageContextMenu")?.classList.add("hidden");

  // Clear temporary return states so a later screen doesn't unexpectedly reopen.
  window.__returnSalesOpportunityId=null;
  window.__contactOpportunityReturnId=null;
  if(typeof opportunityReturnState!=="undefined") opportunityReturnState=null;
}



window.__taskOpenedFromAlerts=false;

window.openAlertTask=async(id)=>{
  if(typeof window.openContactTaskDetail!=="function"){
    alert("No está disponible la ficha de tarea.");return;
  }
  return window.openContactTaskDetail(id,{
    overlay:true,
    onSaved:async()=>{
      if(typeof loadAlerts==="function")await loadAlerts();
      if(typeof loadDashboard==="function")await loadDashboard();
    }
  });
};
window.editAlertTask=async(id)=>{
  await window.openAlertTask(id);
  $("agendaTitle")?.focus();
};

window.deleteAlertTask=async(id)=>{
  if(!confirm("¿Eliminar esta tarea?"))return;
  const {data:task}=await sb.from("agenda_items").select("*").eq("id",id).maybeSingle();
  if(task && typeof archiveToTrash==="function"){
    await archiveToTrash("agenda",id,task.title||"Tarea",{agenda:task});
  }
  const {error}=await sb.from("agenda_items").delete().eq("id",id);
  if(error){alert(error.message);return}
  if(window.__taskOpenedFromAlerts){
    window.__taskOpenedFromAlerts=false;
    $("cpTaskDetailPage")?.classList.add("hidden");
    $("cpTaskPage")?.classList.add("hidden");
    $("contactModal")?.classList.add("hidden");
    const columns=document.querySelector("#contactModal .cpColumns");
    if(columns)columns.style.display="";
    const top=document.querySelector("#contactModal .cpTop");
    if(top)top.style.display="";
  }
  await loadAlerts();
  if(typeof loadDashboard==="function")loadDashboard();
  if(typeof loadAgenda==="function")loadAgenda();
};



window.tpfBackEverywhere=async function(source){
  // Close only the screen that invoked back.
  if(source==="taskDetail"){
    $("cpTaskDetailPage")?.classList.add("hidden");
    if(window.__taskOpenedFromAlerts){
      window.__taskOpenedFromAlerts=false;
      $("cpTaskPage")?.classList.add("hidden");
      $("contactModal")?.classList.add("hidden");
      const columns=document.querySelector("#contactModal .cpColumns");
      if(columns)columns.style.display="";
      const top=document.querySelector("#contactModal .cpTop");
      if(top)top.style.display="";
      const alertsNav=[...document.querySelectorAll(".nav")].find(n=>n.dataset.view==="alerts");
      if(alertsNav){alertsNav.dataset.tpfBackNavigation="1";alertsNav.click();delete alertsNav.dataset.tpfBackNavigation}
      return;
    }
    // Normal task-detail flow: back to contact task list / contact.
    $("cpTaskPage")?.classList.add("hidden");
    if(!$("contactModal")?.classList.contains("hidden"))return;
  }

  if(source==="taskNew"){
    $("cpTaskPage")?.classList.add("hidden");
    if(!$("contactModal")?.classList.contains("hidden"))return;
  }

  if(source==="contact"){
    const oppId=window.__returnSalesOpportunityId;
    $("contactModal")?.classList.add("hidden");
    if(oppId){
      window.__returnSalesOpportunityId=null;
      setTimeout(()=>openOpportunityFull(oppId),20);
      return;
    }
  }

  if(source==="opportunity"){
    $("opportunityFullPage")?.classList.add("hidden");
  }

  // Existing main-view history is the safest source of truth.
  if(typeof tpfGoBack==="function" && tpfGoBack())return;

  // Safe fallback: Panel de ventas for opportunity, otherwise Inicio.
  const fallbackView=source==="opportunity"?"sales":"dashboard";
  const nav=[...document.querySelectorAll(".nav")].find(n=>n.dataset.view===fallbackView);
  nav?.click();
};



/* ===== Historial real de pantallas ===== */
window.__tpfDetailHistory=[];
window.__tpfRestoringScreen=false;
window.__tpfSkipNextScreenPush=false;

function tpfMainViewNow(){
  const views=["dashboard","alerts","search","database","sales","import","agenda","whatsapplive","whatsapp","settings","automations","users","trash"];
  return views.find(v=>!$("view-"+v)?.classList.contains("hidden")) || window.__tpfCurrentView || "dashboard";
}

function tpfCaptureExactScreen(){
  const base={
    mainView:tpfMainViewNow(),
    mainScroll:document.querySelector(".referenceWorkspace main")?.scrollTop||0,
    salesLeft:$("salesScroll")?.scrollLeft||0,
    salesTop:$("salesScroll")?.scrollTop||0,
    salesViewTop:$("view-sales")?.scrollTop||0
  };

  if(!$("cpTaskDetailPage")?.classList.contains("hidden")){
    return {...base,type:"taskDetail",id:currentContactTask?.id||$("cpTaskDetailId")?.value||null,contactId:currentContact?.id||null,fromAlerts:!!window.__taskOpenedFromAlerts};
  }
  if(!$("cpTaskPage")?.classList.contains("hidden")){
    return {...base,type:"taskNew",contactId:currentContact?.id||null};
  }
  if(!$("contactModal")?.classList.contains("hidden")){
    return {...base,type:"contact",id:currentContact?.id||null};
  }
  if(!$("oppDetailModal")?.classList.contains("hidden")){
    return {...base,type:"oppEdit",id:$("oppModalId")?.value||null};
  }
  if(!$("opportunityFullPage")?.classList.contains("hidden")){
    return {...base,type:"oppView",id:currentFullOpportunity?.id||null};
  }
  return {...base,type:"main"};
}

function tpfScreenKey(s){
  return [s.type,s.id||"",s.contactId||"",s.mainView||""].join("|");
}

window.tpfRememberScreen=function(forcedState){
  if(window.__tpfRestoringScreen)return;
  if(window.__tpfSkipNextScreenPush){window.__tpfSkipNextScreenPush=false;return}
  const state=forcedState||tpfCaptureExactScreen();
  const last=window.__tpfDetailHistory[window.__tpfDetailHistory.length-1];
  if(!last || tpfScreenKey(last)!==tpfScreenKey(state)){
    window.__tpfDetailHistory.push(state);
    if(window.__tpfDetailHistory.length>40)window.__tpfDetailHistory.shift();
  }
};

function tpfCloseExactDetails(){
  $("oppDetailModal")?.classList.add("hidden");
  $("opportunityFullPage")?.classList.add("hidden");
  $("cpTaskDetailPage")?.classList.add("hidden");
  $("cpTaskPage")?.classList.add("hidden");
  $("contactModal")?.classList.add("hidden");
  const columns=document.querySelector("#contactModal .cpColumns");
  if(columns)columns.style.display="";
  const top=document.querySelector("#contactModal .cpTop");
  if(top)top.style.display="";
  window.__taskOpenedFromAlerts=false;
}

async function tpfOpenMainWithoutHistory(view){
  const nav=[...document.querySelectorAll(".nav")].find(n=>n.dataset.view===view);
  if(nav){
    nav.dataset.tpfBackNavigation="1";
    nav.click();
    delete nav.dataset.tpfBackNavigation;
  }
}

async function tpfRestoreExactScreen(state){
  if(!state)return false;
  window.__tpfRestoringScreen=true;
  try{
    tpfCloseExactDetails();
    await tpfOpenMainWithoutHistory(state.mainView||"dashboard");

    if(state.type==="contact" && state.id){
      await openContact(state.id);
    }else if(state.type==="oppView" && state.id){
      await openOpportunityFull(state.id);
    }else if(state.type==="oppEdit" && state.id){
      openOpportunityCard(state.id);
    }else if(state.type==="taskNew"){
      if(state.contactId && (!currentContact || String(currentContact.id)!==String(state.contactId))){
        await openContact(state.contactId);
      }else{
        $("contactModal")?.classList.remove("hidden");
      }
      openContactTaskPage();
    }else if(state.type==="taskDetail" && state.id){
      if(state.contactId){
        if(!currentContact || String(currentContact.id)!==String(state.contactId))await openContact(state.contactId);
        else $("contactModal")?.classList.remove("hidden");
      }else if(state.fromAlerts){
        $("contactModal")?.classList.remove("hidden");
        $("cpTaskPage")?.classList.remove("hidden");
        window.__taskOpenedFromAlerts=true;
      }
      await openContactTaskDetail(state.id);
    }

    setTimeout(()=>{
      const main=document.querySelector(".referenceWorkspace main");
      if(main)main.scrollTop=state.mainScroll||0;
      if($("salesScroll")){
        $("salesScroll").scrollLeft=state.salesLeft||0;
        $("salesScroll").scrollTop=state.salesTop||0;
      }
      if($("view-sales"))$("view-sales").scrollTop=state.salesViewTop||0;
    },80);
    return true;
  }finally{
    window.__tpfRestoringScreen=false;
  }
}

window.tpfBackExactly=async function(){
  const state=window.__tpfDetailHistory.pop();
  if(state)return await tpfRestoreExactScreen(state);

  // Si no hay detalle previo, usar el historial de secciones ya existente.
  if(typeof tpfGoBack==="function" && tpfGoBack())return true;
  return false;
};



/* ==========================================================
   NAVEGACIÓN ÚNICA Y AUTORITATIVA
   Sustituye todos los historiales anteriores.
   ========================================================== */
window.__TPF_HISTORY = [];
window.__TPF_RESTORING = false;

function tpfMainViewId(){
  const views=["dashboard","alerts","search","database","sales","import","agenda","whatsapplive","whatsapp","settings","automations","users","trash"];
  return views.find(v=>{
    const el=$("view-"+v);
    return el && !el.classList.contains("hidden");
  }) || "dashboard";
}

function tpfWhatsappSnapshot(mainView){
  if(mainView!=="whatsapplive")return {waChatId:null,waContactId:null};
  try{
    return {
      waChatId:(typeof waLiveState!=="undefined" ? waLiveState?.selected?.id : null)||null,
      waContactId:(typeof waLiveState!=="undefined" ? waLiveState?.contact?.id : null)||null
    };
  }catch(_){
    return {waChatId:null,waContactId:null};
  }
}

function tpfCurrentScreen(){
  const mainView=tpfMainViewId();
  const whatsapp=tpfWhatsappSnapshot(mainView);
  const base={
    mainView,
    mainScroll:document.querySelector(".referenceWorkspace main")?.scrollTop||0,
    salesLeft:$("salesScroll")?.scrollLeft||0,
    salesTop:$("salesScroll")?.scrollTop||0,
    salesPageTop:$("view-sales")?.scrollTop||0,
    salesMode:typeof salesCurrentView!=="undefined" ? salesCurrentView||"board" : "board",
    ...whatsapp
  };

  if($("cpTaskDetailPage") && !$("cpTaskDetailPage").classList.contains("hidden")){
    return {...base,type:"taskDetail",id:currentContactTask?.id||$("cpTaskDetailId")?.value||null,contactId:currentContact?.id||null};
  }
  if($("cpTaskPage") && !$("cpTaskPage").classList.contains("hidden")){
    return {...base,type:"taskNew",contactId:currentContact?.id||null};
  }
  if($("contactModal") && !$("contactModal").classList.contains("hidden")){
    return {...base,type:"contact",id:currentContact?.id||null};
  }
  if($("oppDetailModal") && !$("oppDetailModal").classList.contains("hidden")){
    return {...base,type:"oppEdit",id:$("oppModalId")?.value||null};
  }
  if($("opportunityFullPage") && !$("opportunityFullPage").classList.contains("hidden")){
    return {...base,type:"oppView",id:currentFullOpportunity?.id||null};
  }
  return {...base,type:"main"};
}

function tpfScreenKey(s){
  return [s.type||"",s.id||"",s.contactId||"",s.mainView||"",s.waChatId||"",s.waContactId||""].join("|");
}

function tpfPushCurrentScreen(){
  if(window.__TPF_RESTORING)return;
  const s=tpfCurrentScreen();
  const last=window.__TPF_HISTORY[window.__TPF_HISTORY.length-1];
  if(!last || tpfScreenKey(last)!==tpfScreenKey(s)){
    window.__TPF_HISTORY.push(s);
    if(window.__TPF_HISTORY.length>50)window.__TPF_HISTORY.shift();
  }
}

/* Las llamadas antiguas pasan a usar ESTE único historial. */
window.tpfRememberScreen=function(forcedState){
  if(window.__TPF_RESTORING)return;
  const s=forcedState||tpfCurrentScreen();
  const last=window.__TPF_HISTORY[window.__TPF_HISTORY.length-1];
  if(!last || tpfScreenKey(last)!==tpfScreenKey(s)){
    window.__TPF_HISTORY.push(s);
    if(window.__TPF_HISTORY.length>50)window.__TPF_HISTORY.shift();
  }
};

function tpfCloseAllDetails(){
  $("oppDetailModal")?.classList.add("hidden");
  $("opportunityFullPage")?.classList.add("hidden");
  $("cpTaskDetailPage")?.classList.add("hidden");
  $("cpTaskPage")?.classList.add("hidden");
  $("contactModal")?.classList.add("hidden");
  $("waQuickModal")?.classList.add("hidden");
  $("waQuickScheduleBox")?.classList.add("hidden");
  $("stageContextMenu")?.classList.add("hidden");

  const columns=document.querySelector("#contactModal .cpColumns");
  if(columns)columns.style.display="";
  const top=document.querySelector("#contactModal .cpTop");
  if(top)top.style.display="";

  window.__returnSalesOpportunityId=null;
  window.__contactOpportunityReturnId=null;
  window.__taskOpenedFromAlerts=false;
  if(typeof opportunityReturnState!=="undefined")opportunityReturnState=null;
  opportunityModalOrigin=null;
  __oppKeepPreparedOrigin=false;
}

async function tpfShowMainView(view){
  const nav=[...document.querySelectorAll(".nav")].find(n=>n.dataset.view===view);
  if(!nav)return;

  nav.dataset.tpfRouterRestore="1";
  nav.click();
  delete nav.dataset.tpfRouterRestore;
}

async function tpfRestoreWhatsappSnapshot(s){
  if(s?.mainView!=="whatsapplive")return;
  const chatId=String(s.waChatId||"");
  const contactId=String(s.waContactId||"");

  if(chatId && typeof window.selectWhatsAppChat==="function"){
    let selected="";
    try{selected=String(waLiveState?.selected?.id||"")}catch(_){}
    if(selected!==chatId){
      try{await window.selectWhatsAppChat(chatId)}catch(err){console.warn("Restaurar chat de WhatsApp",err)}
    }
  }

  if(contactId){
    let selectedContact="";
    try{selectedContact=String(waLiveState?.contact?.id||"")}catch(_){}
    if(selectedContact!==contactId && typeof window.matchWaContact==="function"){
      try{await window.matchWaContact()}catch(err){console.warn("Restaurar contacto de WhatsApp",err)}
    }
  }
}

async function tpfRestoreScreen(s){
  if(!s)return false;
  // Returning from a child editor to the already mounted desktop contact
  // does not require exposing the main view or refetching the same customer.
  const contactLayer=$("contactModal");
  if(s.type==="contact" && s.id && window.matchMedia("(min-width:1024px)").matches &&
     contactLayer?.classList.contains("tpfContactDesktop") && !contactLayer.classList.contains("hidden") &&
     String(currentContact?.id||"")===String(s.id)){
    ["oppDetailModal","opportunityFullPage","cpTaskDetailPage","cpTaskPage"].forEach(id=>$(id)?.classList.add("hidden"));
    const columns=contactLayer.querySelector(".cpColumns"),top=contactLayer.querySelector(".cpTop");
    if(columns)columns.style.display="";
    if(top)top.style.display="";
    return true;
  }
  window.__TPF_RESTORING=true;
  try{
    tpfCloseAllDetails();
    await tpfShowMainView(s.mainView||"dashboard");
    await tpfRestoreWhatsappSnapshot(s);

    if(s.mainView==="sales" && typeof setSalesView==="function"){
      setSalesView(s.salesMode||"board");
    }

    if(s.type==="contact" && s.id){
      await openContact(s.id);
    }
    else if(s.type==="oppView" && s.id){
      await openOpportunityFull(s.id);
    }
    else if(s.type==="oppEdit" && s.id){
      openOpportunityCard(s.id);
    }
    else if(s.type==="taskNew"){
      if(s.contactId){
        await openContact(s.contactId);
      }
      openContactTaskPage();
    }
    else if(s.type==="taskDetail" && s.id){
      if(s.contactId){
        await openContact(s.contactId);
      }else{
        $("contactModal")?.classList.remove("hidden");
        $("cpTaskPage")?.classList.remove("hidden");
      }
      await openContactTaskDetail(s.id);
    }

    setTimeout(()=>{
      const main=document.querySelector(".referenceWorkspace main");
      if(main)main.scrollTop=s.mainScroll||0;
      if($("salesScroll")){
        $("salesScroll").scrollLeft=s.salesLeft||0;
        $("salesScroll").scrollTop=s.salesTop||0;
      }
      if($("view-sales"))$("view-sales").scrollTop=s.salesPageTop||0;
    },60);

    return true;
  }finally{
    window.__TPF_RESTORING=false;
  }
}

window.tpfCaptureCurrentScreen=function(){return {...tpfCurrentScreen()}};
window.tpfRestoreCapturedScreen=async function(state){return await tpfRestoreScreen(state)};

window.tpfBackExactly=async function(){
  const previous=window.__TPF_HISTORY.pop();
  if(previous){
    return await tpfRestoreScreen(previous);
  }

  // Sin historial: simplemente cerrar el detalle actual.
  tpfCloseAllDetails();
  return false;
};

/* Desactivar los sistemas antiguos de back para que no compitan. */
window.tpfGoBack=function(){ return false; };
window.tpfBackEverywhere=async function(){ return await tpfBackExactly(); };

/* Menú lateral:
   guarda la pantalla exacta actual, cierra detalles y navega.
   Si estamos restaurando historial, NO vuelve a guardarla. */
document.querySelectorAll(".nav").forEach(n=>{
  const old=n.onclick;
  n.onclick=function(ev){
    const restoring=window.__TPF_RESTORING || n.dataset.tpfRouterRestore==="1";
    if(!restoring)tpfPushCurrentScreen();

    tpfCloseAllDetails();

    if(typeof old==="function"){
      return old.call(this,ev);
    }
  };
});

/* Volver de todas las pantallas: SOLO usa el historial único. */
if($("contactClose"))$("contactClose").onclick=async()=>{await tpfBackExactly()};
if($("cpTaskDetailBack"))$("cpTaskDetailBack").onclick=async()=>{await tpfBackExactly()};
if($("cpTaskBack"))$("cpTaskBack").onclick=async()=>{await tpfBackExactly()};
if($("oppFullBack"))$("oppFullBack").onclick=async()=>{await tpfBackExactly()};
if($("salesFullBackBtn"))$("salesFullBackBtn").onclick=async()=>{await tpfBackExactly()};

/* Abrir cliente desde oportunidad:
   forzar que la pantalla anterior sea ESA oportunidad concreta. */
window.returnToContactFromOpportunity=async function(contactId,oppId){
  if(!window.__TPF_RESTORING){
    const current=tpfCurrentScreen();
    const state={
      ...current,
      type:"oppView",
      id:oppId
    };
    const last=window.__TPF_HISTORY[window.__TPF_HISTORY.length-1];
    if(!last || tpfScreenKey(last)!==tpfScreenKey(state))window.__TPF_HISTORY.push(state);
  }
  $("opportunityFullPage")?.classList.add("hidden");
  await openContact(contactId);
  if($("contactClose"))$("contactClose").textContent="← Volver";
};

/* Abrir cliente desde el modal de oportunidad. */
window.openSalesOpportunityContact=async function(id){
  const o=(salesCache.opportunities||[]).find(x=>String(x.id)===String(id));
  if(!o)return;
  try{
    const rec=await findContactRecordForOpportunity(o);
    if(!rec){
      alert("No encuentro un contacto que coincida con este cliente.");
      return;
    }

    if(!window.__TPF_RESTORING){
      const wasEdit=$("oppDetailModal") && !$("oppDetailModal").classList.contains("hidden");
      const state={
        ...tpfCurrentScreen(),
        type:wasEdit?"oppEdit":"oppView",
        id:o.id
      };
      const last=window.__TPF_HISTORY[window.__TPF_HISTORY.length-1];
      if(!last || tpfScreenKey(last)!==tpfScreenKey(state)){
        window.__TPF_HISTORY.push(state);
      }
    }

    $("oppDetailModal")?.classList.add("hidden");
    $("opportunityFullPage")?.classList.add("hidden");

    await openContact(rec.id);
    if($("contactClose"))$("contactClose").textContent="← Volver";
  }catch(e){
    alert(e?.message||"No se pudo abrir la ficha del contacto.");
  }
};

/* Editar desde vista de oportunidad:
   guardar la vista como anterior. */
if($("oppFullEdit"))$("oppFullEdit").onclick=()=>{
  if(!currentFullOpportunity)return;
  captureOpportunityModalOrigin();
  __oppKeepPreparedOrigin=true;
  $("opportunityFullPage")?.classList.add("hidden");
  openOpportunityCard(currentFullOpportunity.id);
};
