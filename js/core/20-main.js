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

  // `record_id` is the explicit link chosen when the opportunity is created.
  // Resolve it first: the fallback below is intentionally bounded to 1,000
  // records, so a name/phone search can otherwise miss the linked contact (or
  // open somebody else with the same details) in a large database.
  const linkedContactId=o.record_id||o.contact_id||o.related_record_id||null;
  if(linkedContactId){
    const {data,error}=await sb.from("records")
      .select("id,source_sheet,source_row,data")
      .eq("id",linkedContactId)
      .maybeSingle();
    if(error)throw error;
    // A missing explicit link must never open another person with similar data.
    return data||null;
  }

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

async function tpfCreateOpportunityGuarded(payload,pipelineId,allowDuplicate=false){
  const {data,error}=await sb.rpc('crm_create_opportunity_guarded',{p_pipeline_id:pipelineId,p_stage_id:payload.stage_id,p_record_id:payload.record_id||null,p_title:payload.title,p_client_name:payload.client_name||null,p_phone:payload.phone||null,p_amount:payload.amount??null,p_expected_date:payload.expected_date||null,p_notes:payload.notes||null,p_contract_party:payload.contract_party||null,p_allow_duplicate:allowDuplicate});
  if(error&&String(error.message||'').includes('DUPLICATE_OPPORTUNITY:')){
    if(confirm('Ya existe una oportunidad abierta con el mismo cliente y título. ¿Seguro que quieres crear otra?'))return tpfCreateOpportunityGuarded(payload,pipelineId,true);
    throw new Error('No se creó: abre la oportunidad existente.');
  }
  if(error)throw error;return{id:data};
}

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
      const created=await tpfCreateOpportunityGuarded(payload,stage.pipeline_id);
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
 try{
   await tpfCreateOpportunityGuarded({stage_id:stage.id,record_id:c.id||null,title,client_name:c.name||null,phone:c.phone||null,amount:amount?Number(String(amount).replace(",",".")):null,expected_date:date||null,notes:notes||null},stage.pipeline_id);
   alert("Oportunidad creada");
 }catch(e){alert(e?.message||'No se pudo crear la oportunidad');}
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


let googleContactsState={connected:false,email:"",canManage:false,loading:true,error:""},googleContactsStatusRetries=0;
function googleContactsConnected(){return !!googleContactsState.connected}
function googleContactsEmail(){return String(googleContactsState.email||"").trim()}
async function googleContactsHeaders(){const {data}=await sb.auth.getSession(),token=data?.session?.access_token;if(!token)throw new Error("Inicia sesión en el CRM.");return {"Authorization":"Bearer "+token,"Content-Type":"application/json"}}
async function googleContactsServer(action,options={}){const res=await fetch("/api/google-contacts?action="+encodeURIComponent(action),{...options,headers:{...(await googleContactsHeaders()),...(options.headers||{})}}),body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body.error||"No se pudo conectar con Google Contacts.");return body}
async function loadGoogleContactsStatus(){try{const status=await googleContactsServer("status");googleContactsState={connected:!!status.connected,email:status.email||"",canManage:!!status.canManage,loading:false,error:""};googleContactsStatusRetries=0}catch(error){googleContactsState={connected:false,email:"",canManage:false,loading:false,error:String(error?.message||"No se pudo comprobar la conexión.")};if(googleContactsStatusRetries<2){googleContactsStatusRetries++;setTimeout(loadGoogleContactsStatus,1500)}}updateGoogleContactsUI();window.dispatchEvent(new CustomEvent("tpf:google-contacts-changed"));return googleContactsState}

function updateGoogleContactsUI(){
  const connected=googleContactsConnected();
  if($("googleContactsStatus"))$("googleContactsStatus").textContent=googleContactsState.loading?"Comprobando…":connected?("Conectado en los dos PCs"+(googleContactsEmail()?" · "+googleContactsEmail():"")):(googleContactsState.error?"No se pudo comprobar: "+googleContactsState.error:"No conectado");
  if($("connectGoogleContacts"))$("connectGoogleContacts").classList.toggle("hidden",connected);
  if($("disconnectGoogleContacts"))$("disconnectGoogleContacts").classList.toggle("hidden",!connected||!googleContactsState.canManage);
}
async function connectGoogleContacts(selectAccount=false){
  const result=await googleContactsServer("authorize",{method:"POST",body:JSON.stringify({selectAccount:!!selectAccount})});
  if(!result.url)throw new Error("Google no devolvió la autorización.");window.location.assign(result.url);
}
async function disconnectGoogleContacts(){
  if(!confirm("¿Desconectar Google Contacts para los dos PCs? No se borrará ningún contacto."))return;
  await googleContactsServer("disconnect",{method:"POST",body:"{}"});await loadGoogleContactsStatus();
}
if($("connectGoogleContacts"))$("connectGoogleContacts").onclick=()=>connectGoogleContacts(true).catch(e=>alert(e.message));
if($("disconnectGoogleContacts"))$("disconnectGoogleContacts").onclick=()=>disconnectGoogleContacts().catch(e=>alert(e.message));
window.addEventListener("load",loadGoogleContactsStatus);

function normGooglePhone(v){return String(v||"").replace(/\D/g,"").replace(/^34(?=\d{9}$)/,"");}
async function googleApi(path,options={}){
  if(!googleContactsConnected())throw new Error("Google Contacts no está conectado.");
  let payload=options.body;try{payload=typeof payload==="string"?JSON.parse(payload):payload}catch(_){payload={}}
  return googleContactsServer("proxy",{method:"POST",body:JSON.stringify({path,method:options.method||"GET",body:payload||{}})});
}
async function findGoogleDuplicate(phone,email){
  if(!googleContactsConnected())return null;
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
function contactDisplayCase(value){
  const text=String(value||"").trim().replace(/\s+/g," ");
  if(!text||text!==text.toLocaleUpperCase("es-ES"))return text;
  return text.toLocaleLowerCase("es-ES").replace(/(^|[\s'-])\p{L}/gu,c=>c.toLocaleUpperCase("es-ES"));
}
window.TPFContactDisplayCase=contactDisplayCase;
function googleContactNameCase(value){return contactDisplayCase(value)}
async function createGoogleContact(name,phone,email,nickname="",options={}){
  const forceNew=options?.forceNew===true;
  const duplicate=forceNew?null:await findGoogleDuplicate(phone,email);
  if(duplicate)return {duplicate:true,person:duplicate.person};
  const suppliedFirst=googleContactNameCase(options?.first??options?.givenName??""),suppliedLast=googleContactNameCase(options?.last??options?.familyName??"");
  const normalizedName=googleContactNameCase(name),normalizedNickname=googleContactNameCase(nickname),parts=normalizedName.split(/\s+/);
  const givenName=suppliedFirst||parts.shift()||"";
  const familyName=(suppliedFirst||suppliedLast)?suppliedLast:parts.join(" ");
  const displayName=[givenName,familyName].filter(Boolean).join(" ")||normalizedName;
  const body={
    names:[{givenName,familyName,displayName}],
    nicknames:normalizedNickname?[{value:normalizedNickname,type:"DEFAULT"}]:[],
    phoneNumbers:phone?[{value:phone,type:"mobile"}]:[],
    emailAddresses:email?[{value:email,type:"work"}]:[]
  };
  const person=await googleApi("people:createContact?personFields=names,nicknames,emailAddresses,phoneNumbers",{method:"POST",body:JSON.stringify(body)});
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
    const changedChat=String(teamNotifyPrefs.telegram_chat_id||"")!==chatId;
    teamNotifyPrefs={...teamNotifyPrefs,telegram_chat_id:chatId,...(changedChat?{
      telegram_forum_enabled:false,
      agenda_telegram_thread_id:null,
      whatsapp_telegram_thread_id:null,
      offers_telegram_thread_id:null,
      followups_telegram_thread_id:null,
      incidents_telegram_thread_id:null,
      daily_summary_telegram_thread_id:null
    }:{})};
    localStorage.setItem("tpf_team_notification_settings",JSON.stringify(teamNotifyPrefs));
    try{await sb.from("app_settings").upsert({key:"team_notification_settings",value:teamNotifyPrefs},{onConflict:"key"});}catch(_){}
    if(j.chat_type==="supergroup"&&j.is_forum){
      if(msg)msg.textContent="Grupo con apartados detectado. Pulsa “Preparar apartados”.";
    }else if(msg){
      msg.textContent="Se ha detectado el chat privado. Para usar apartados, detecta el grupo con Temas activados.";
    }
  }catch(e){
    if(msg)msg.textContent=e.message||String(e);
  }
}
async function prepareTelegramTopics(){
  const msg=$("notifyMsg");
  const chatId=($("notifyTelegramChatId")?.value||"").trim();
  if(!chatId){
    if(msg)msg.textContent="Primero detecta el grupo privado de Telegram.";
    return;
  }
  if(!confirm("Se crearán los 6 apartados en el grupo privado de Telegram. ¿Continuar?"))return;
  if(msg)msg.textContent="Preparando apartados en Telegram...";
  try{
    const r=await fetch("/api/telegram",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        action:"setup-forum",
        chat_id:chatId,
        topics:{
          whatsapp:teamNotifyPrefs.whatsapp_telegram_thread_id,
          offers:teamNotifyPrefs.offers_telegram_thread_id,
          followups:teamNotifyPrefs.followups_telegram_thread_id,
          incidents:teamNotifyPrefs.incidents_telegram_thread_id,
          daily:teamNotifyPrefs.daily_summary_telegram_thread_id
        }
      })
    });
    const j=await r.json();
    if(!r.ok||!j.ok)throw new Error(j.error||"No se pudieron preparar los apartados.");
    teamNotifyPrefs={...teamNotifyPrefs,
      telegram_chat_id:chatId,
      telegram_forum_enabled:j.complete!==false,
      agenda_telegram_thread_id:null,
      whatsapp_telegram_thread_id:j.topics?.whatsapp||null,
      offers_telegram_thread_id:j.topics?.offers||null,
      followups_telegram_thread_id:j.topics?.followups||null,
      incidents_telegram_thread_id:j.topics?.incidents||null,
      daily_summary_telegram_thread_id:j.topics?.daily||null
    };
    localStorage.setItem("tpf_team_notification_settings",JSON.stringify(teamNotifyPrefs));
    const {error}=await sb.from("app_settings").upsert({key:"team_notification_settings",value:teamNotifyPrefs},{onConflict:"key"});
    if(error)throw error;
    if($("notifyTelegramForumStatus"))$("notifyTelegramForumStatus").textContent=j.complete!==false
      ? "Apartados de Telegram preparados ✓"
      : "Faltan algunos apartados; puedes volver a pulsar Preparar apartados.";
    if(msg)msg.textContent=j.complete!==false
      ? "Los 6 apartados ya están preparados en Telegram."
      : "Se crearon algunos apartados. Pulsa de nuevo para completar los que faltan.";
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
        message_thread_id:teamNotifyPrefs.agenda_telegram_thread_id,
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
if($("notifyTelegramTopics"))$("notifyTelegramTopics").onclick=prepareTelegramTopics;
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

if($("salesFullBackBtn"))$("salesFullBackBtn").onclick=()=>document.querySelector('[data-view="search"]')?.click();

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
function updateStageSelectAllUi(){
  document.querySelectorAll(".stageSelectAll").forEach(cb=>{
    const ids=(salesCache.opportunities||[])
      .filter(o=>String(o.stage_id)===String(cb.dataset.stageId))
      .map(o=>String(o.id));
    const selected=ids.filter(id=>selectedSalesOpportunityIds.has(id)).length;
    cb.checked=ids.length>0&&selected===ids.length;
    cb.indeterminate=selected>0&&selected<ids.length;
  });
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
    <div class="salesListRow" data-opp-id="${esc(o.id||'')}">
      <div><input type="checkbox" class="salesListCheck" data-opp-id="${o.id}" onclick="event.stopPropagation();toggleSalesOpportunitySelection('${o.id}',this.checked)"></div>
      <button type="button" class="salesListTitle" onclick="event.stopPropagation();openOpportunityCard('${o.id}')">${esc(o.title||"Oportunidad")}</button>
      <div>${o.client_name?`<button type="button" class="salesClientLink" onclick="event.stopPropagation();openSalesOpportunityContact('${o.id}')">${esc(o.client_name)}</button>`:"—"}</div>
      <div class="tpfSalesDni" data-record-id="${esc(o.record_id||'')}" style="user-select:text;-webkit-user-select:text;cursor:text">${esc(window.TPFContactParty?.opportunityIdentity(o).dni||'—')}</div>
      <div class="tpfSalesPhone" style="user-select:text;-webkit-user-select:text;cursor:text">${esc(o.phone||"—")}</div>
      <div>${esc(fmtMoney(o.amount||0))}</div>
      <div>
        <select onclick="event.stopPropagation()" onchange="event.stopPropagation();moveOpp('${o.id}',this.value)">
          ${stages.map(s=>`<option value="${s.id}" ${String(s.id)===String(o.stage_id)?"selected":""}>${esc(s.name)}</option>`).join("")}
        </select>
      </div>
      <div class="salesListDate"><input type="text" class="salesListDateInput" data-opp-id="${esc(o.id||'')}" data-original-date="${esc(o.expected_date||'')}" value="${esc(o.expected_date?fmtDateOnly(o.expected_date):'')}" placeholder="dd/mm/aaaa" inputmode="numeric" aria-label="Fecha de oportunidad"></div>
      <div class="salesListAction"><button type="button" class="tpfListMenuBtn" aria-label="Acciones de ${esc(o.title||'Oportunidad')}" title="Acciones">•••</button></div>
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
