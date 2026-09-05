/* TPF physical module split · generated from app-core.js */
let currentContact=null;
function splitContactFullName(value){
 const full=String(value||"").trim().replace(/\s+/g," ");
 if(!full)return {first:"",last:""};
 const parts=full.split(" ");
 if(parts.length===1)return {first:parts[0],last:""};
 return {first:parts.shift(),last:parts.join(" ")};
}
function contactFullNameFromData(d){
 const first=String(contactField(d,"NOMBRE")||"").trim();
 const last=String(contactField(d,"APELLIDOS","APELLIDO")||"").trim();
 if(first||last)return [first,last].filter(Boolean).join(" ").trim();
 return String(contactField(d,"NOMBRE Y APELLIDOS","CLIENTE","CLIENTE FINAL")||"").trim();
}
function contactField(d,...names){for(const n of names){if(d[n]!==undefined&&d[n]!==null)return d[n]}return ""}
async function renderContactProfile(){
 if(!currentContact)return;
 const d=currentContact.data||{};
 const name=contactField(d,"NOMBRE Y APELLIDOS","NOMBRE","CLIENTE","CLIENTE FINAL")||"Contacto";
 const phone=contactField(d,"TELÉFONO","TELEFONO","PHONE","MOVIL");
 $("cpAvatar").textContent=name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase()||"C";
 $("cpInfo").innerHTML=`Origen: <b>${esc(currentContact.source_sheet||"")}</b>${currentContact.source_row?`<br>Fila: ${esc(currentContact.source_row)}`:""}`;

 let opps=[];
 try{
   if(!(salesCache.opportunities||[]).length)await loadSales();
   const np=String(phone||"").replace(/\D/g,"").slice(-9);
   const nn=String(name||"").trim().toLowerCase();
   opps=(salesCache.opportunities||[]).filter(o=>{
     const op=String(o.phone||"").replace(/\D/g,"").slice(-9);
     return (np&&op===np)||(nn&&String(o.client_name||"").trim().toLowerCase()===nn);
   });
 }catch(e){}
 const hydratedOpps=hydrateOpportunityStageNames(opps);
if($("cpOppTotal"))$("cpOppTotal").textContent=String(opps.length);
if($("cpOppOpen"))$("cpOppOpen").textContent=String(hydratedOpps.filter(o=>!oppIsClosed(o)).length);
if($("cpOppExpired"))$("cpOppExpired").textContent=String(hydratedOpps.filter(oppIsExpired).length);

$("cpOpportunities").innerHTML=opps.length
 ? hydratedOpps.map(o=>oppUnifiedCard(o)).join("")
 : '<div class="cpEmpty">No hay oportunidades.</div>';

 let tasks=[];
 try{
   const {data}=await sb.from("agenda_items").select("*").order("starts_at",{ascending:false}).limit(100);
   const np=String(phone||"").replace(/\D/g,"").slice(-9);
   const nn=String(name||"").trim().toLowerCase();
   tasks=(data||[]).filter(x=>{
     if(x.whatsapp_enabled || String(x.title||"").trim().toLowerCase()==="whatsapp programado") return false;
     const xp=String(x.customer_phone||x.phone||"").replace(/\D/g,"").slice(-9);
     const xn=String(x.customer_name||x.client_name||"").trim().toLowerCase();
     return String(x.related_record_id||"")===String(currentContact.id)||(np&&xp===np)||(nn&&xn===nn);
   }).slice(0,10);
 }catch(e){}
 $("cpTasks").innerHTML=tasks.length?tasks.map(t=>`<div class="cpTaskWrap">
  <button class="cpTask cpTaskButton" onclick="openContactTaskDetail('${t.id}')">
    <b>${esc(t.title||t.subject||"Recordatorio")}</b>
    <span>${t.starts_at?new Date(t.starts_at).toLocaleString("es-ES"):""}</span>
    <small>${t.status==="completed"?"Completada":"Pendiente"}</small>
  </button>
  <div class="cpTaskActions">
    <button onclick="openContactTaskDetail('${t.id}')">Editar</button>
    <button class="dangerText" onclick="deleteContactTask('${t.id}')">Eliminar</button>
  </div>
</div>`).join(""):'<div class="cpEmpty">No hay tareas pendientes.</div>';

 let waPrograms=[];
 if(contactCanUseWhatsapp()){
   try{
     const {data:waData}=await sb.from("agenda_items").select("*")
       .eq("whatsapp_enabled",true).eq("status","pending")
       .order("whatsapp_scheduled_at",{ascending:true}).limit(100);
     const np=String(phone||"").replace(/\D/g,"").slice(-9);
     waPrograms=(waData||[]).filter(x=>{
       const xp=String(x.whatsapp_phone||x.customer_phone||"").replace(/\D/g,"").slice(-9);
       return np&&xp===np;
     });
   }catch(e){}
   $("cpWhatsappPrograms").innerHTML=waPrograms.length?waPrograms.map(w=>`<div class="cpWaWrap">
     <button class="cpWaItem" onclick="openContactProgrammedWhatsapp('${w.id}')"><b>${waIsDue(w)?"Listo para enviar":"Programado"}</b><span>${esc(fmtAgendaDate(w.whatsapp_scheduled_at||w.starts_at))}</span><small>${esc(w.whatsapp_message||"Sin mensaje")}</small></button>
     <div class="cpWaActions"><button onclick="openContactProgrammedWhatsapp('${w.id}')">Editar</button><button class="dangerText" onclick="deleteContactProgrammedWhatsapp('${w.id}')">Eliminar</button></div>
   </div>`).join(""):'<div class="cpEmpty">No hay WhatsApp programados.</div>';
 }else{
   $("cpWhatsappPrograms").innerHTML="";
 }


 let activityRows=[];

 // Activity log saved explicitly
 try{
   const {data:activityData}=await sb.from("contact_activity")
     .select("*")
     .eq("contact_id",currentContact.id)
     .order("created_at",{ascending:false});
   activityRows.push(...(activityData||[]).map(a=>({
     date:a.created_at?new Date(a.created_at).toLocaleString("es-ES"):"",
     title:a.title||a.activity_type||"Actividad",
     text:a.description||"",
     type:a.activity_type||"activity",author:a
   })));
 }catch(e){}

 // Opportunities linked to this contact
 activityRows.push(...opps.map(o=>{
   const stage=(salesCache.stages||[]).find(s=>String(s.id)===String(o.stage_id));
   const closed=(o.status==="won"||o.status==="lost");
   return {
     date:o.updated_at?new Date(o.updated_at).toLocaleString("es-ES"):(o.expected_date?fmtDateOnly(o.expected_date):""),
     title:(closed?"Oportunidad cerrada · ":"Oportunidad · ")+(o.title||""),
     text:`${stage?.name||""}${o.amount!=null?" · "+fmtMoney(o.amount):""}`,
     type:closed?"opportunity_closed":"opportunity"
   };
 }));

 // Agenda tasks related to this contact
 activityRows.push(...tasks.map(t=>{
   const done=t.status==="completed";
   return {
     date:t.updated_at?new Date(t.updated_at).toLocaleString("es-ES"):(t.starts_at?new Date(t.starts_at).toLocaleString("es-ES"):""),
     title:(done?"Tarea completada · ":"Tarea · ")+(t.title||t.subject||"Recordatorio"),
     text:t.description||"",
     type:done?"task_done":"task"
   };
 }));

 activityRows.sort((a,b)=>{
   const da=Date.parse(String(a.date).replace(/(\d{2})\/(\d{2})\/(\d{4}),?/,"$3-$2-$1"))||0;
   const db=Date.parse(String(b.date).replace(/(\d{2})\/(\d{2})\/(\d{4}),?/,"$3-$2-$1"))||0;
   return db-da;
 });

 if(!activityRows.length){
   activityRows=[{date:"Ahora",title:"Ficha del contacto abierta",text:"Aún no hay actividad registrada.",type:"activity"}];
 }

 $("cpTimeline").innerHTML=activityRows.map(x=>`
   <div class="cpEvent cpEvent-${esc(x.type)}">
     <div class="cpDot"></div>
     <div class="cpEventBody">
       <small>${esc(x.date)}</small>
       <b>${esc(x.title)}</b>
       <div>${esc(x.text)}</div>
       ${x.author&&window.TPFAuthorship?window.TPFAuthorship.line(x.author,false):""}
     </div>
   </div>`).join("");
}

window.deleteContactProgrammedWhatsapp=async(id)=>{
 if(!confirm("¿Eliminar este WhatsApp programado?"))return;
 const {error}=await sb.from("agenda_items").delete().eq("id",id);
 if(error){alert(error.message);return;}
 if(typeof loadWhatsappPrograms==="function")loadWhatsappPrograms();
 if(currentContact)await renderContactProfile();
};
window.openContactProgrammedWhatsapp=async(id)=>{
  const {data,error}=await sb.from("agenda_items").select("*").eq("id",id).maybeSingle();
  if(error||!data){alert(error?.message||"No se encontró el WhatsApp.");return;}

  openWaQuick({
    programId:data.id,
    phone:data.whatsapp_phone||data.customer_phone||"",
    message:data.whatsapp_message||""
  });

  // Abrir directamente el editor nuevo.
  $("waQuickScheduleBox").classList.remove("hidden");
  $("waQuickCustomBox").classList.remove("hidden");
  $("waQuickSend").textContent="Programar";
  $("waQuickSend").dataset.mode="schedule";

  const raw=data.whatsapp_scheduled_at||data.starts_at;
  const d=raw?new Date(raw):new Date(Date.now()+3600000);

  if(typeof waPad2==="function" && typeof waRenderCalendar==="function"){
    waCalSelected=new Date(d.getFullYear(),d.getMonth(),d.getDate());
    waCalView=new Date(d.getFullYear(),d.getMonth(),1);

    if($("waQuickDateText") && typeof waPrettyDate==="function"){
      $("waQuickDateText").textContent=waPrettyDate(waCalSelected);
    }

    if($("waQuickTime")){
      let mins=Math.round(d.getMinutes()/5)*5;
      let hh=d.getHours();
      if(mins===60){mins=0;hh=(hh+1)%24;}
      $("waQuickTime").value=waPad2(hh)+":"+waPad2(mins);
    }

    if(typeof waSyncCustomWhen==="function")waSyncCustomWhen();
    waRenderCalendar();
  }else if($("waQuickWhen")){
    $("waQuickWhen").value=raw?localDateTimeValue(raw):"";
  }

  $("waQuickMsg").textContent="Editando WhatsApp programado.";
};

function contactCanUseWhatsapp(){
  const source=String(currentContact?.source_sheet||"").trim().toUpperCase();
  return source==="DATA" || source==="CONTACTOS";
}
function applyWhatsappVisibilityForContact(){
  const allowed=contactCanUseWhatsapp();
  if($("contactWhatsapp"))$("contactWhatsapp").style.display=allowed?"":"none";
  if($("cpScheduleWhatsapp"))$("cpScheduleWhatsapp").style.display=allowed?"":"none";
  if($("cpWhatsappPrograms")){
    const section=$("cpWhatsappPrograms").closest(".cpSideSection");
    if(section)section.style.display=allowed?"":"none";
  }
}
window.openContact=async(id)=>{
 tpfRememberScreen();
 const {data,error}=await sb.from("records").select("id,source_sheet,source_row,data").eq("id",id).single();
 if(error){alert(error.message);return}
 currentContact=data; const d=data.data||{};
 if(!window.__returnSalesOpportunityId && $("contactClose")){
   $("contactClose").textContent="← Volver";
   $("contactClose").title="";
 }
 applyWhatsappVisibilityForContact();
 {
 const fullName=contactFullNameFromData(d);
 const fallback=splitContactFullName(fullName);
 $("contactFirstName").value=String(contactField(d,"NOMBRE")||fallback.first||"").trim();
 $("contactLastName").value=String(contactField(d,"APELLIDOS","APELLIDO")||fallback.last||"").trim();
 $("contactName").value=[$("contactFirstName").value,$("contactLastName").value].filter(Boolean).join(" ").trim();
}
 $("contactPhone").value=contactField(d,"TELÉFONO","TELEFONO","PHONE","MOVIL");
 $("contactDni").value=contactField(d,"DNI / NIF","DNI","NIF");
 $("contactEmail").value=contactField(d,"EMAIL","Email","email");
 $("contactNotes").value=contactField(d,"NOTAS","NOTES","OBSERVACIONES");
 $("contactMeta").textContent=`Origen: ${data.source_sheet||""}${data.source_row?" · Fila "+data.source_row:""}`;
 $("contactMsg").textContent="";
 $("contactModal").classList.remove("hidden");
 await renderContactProfile();
};
$("contactClose").onclick=async()=>{if(!await tpfBackExactly())$("contactModal").classList.add("hidden")};
function openWaQuick(prefill={}){
  window.__tpfWaQuickContext={
    phone:prefill.phone||"",
    name:prefill.name||"",
    dni:prefill.dni||"",
    contactId:prefill.contactId||null
  };
  $("waQuickProgramId").value=prefill.programId||"";
  $("waQuickPhone").value=prefill.phone||"";
  $("waQuickMessage").value=prefill.message||"";
  $("waQuickChannel").value="normal";
  $("waQuickScheduleBox").classList.add("hidden");
  $("waQuickWhen").value=prefill.when||"";
  $("waQuickMsg").textContent="";
  $("waQuickSend").textContent="Enviar ahora";
  $("waQuickSend").dataset.mode="send";
  $("waQuickModal").classList.remove("hidden");
}

if($("cpSideNewWhatsapp"))$("cpSideNewWhatsapp").onclick=()=>{
  if(!contactCanUseWhatsapp())return;
  if(!currentContact)return;
  openWaQuick({phone:$("contactPhone").value.trim()});
  $("waQuickScheduleBox").classList.remove("hidden");
  $("waQuickWhen").value=localDateTimeValue(new Date(Date.now()+60*60*1000));
};
$("contactWhatsapp").onclick=()=>{
  if(!contactCanUseWhatsapp())return;
  const phone=$("contactPhone").value.trim();
  if(!phone){alert("Este contacto no tiene teléfono");return}
  openWaQuick({
    phone,
    name:$("contactName").value.trim()
  });
};
function cpRecord(){return JSON.stringify({id:currentContact?.id,name:$("contactName").value,phone:$("contactPhone").value})}

let pendingOpportunityRecordId=null;

function openContactNewOpportunity(){
  captureOpportunityModalOrigin();
  if(!currentContact)return;

  const stages=salesCache.stages||[];
  if(!stages.length){
    alert("No hay columnas creadas en el Panel de ventas.");
    return;
  }

  const name=$("contactName").value.trim()||"Contacto";
  const phone=$("contactPhone").value.trim()||"";
  const stage=stages[0];

  pendingOpportunityRecordId=currentContact.id;

  $("oppModalSave").textContent="Crear oportunidad";
  $("oppModalDelete").classList.add("hidden");
  $("oppModalId").value="";
  $("oppModalHeading").textContent="Nueva oportunidad";
  $("oppModalTitle").value="Oportunidad - "+name;
  $("oppModalClient").value=name;
  $("oppModalPhone").value=phone;
  $("oppModalAmount").value="";
  $("oppModalDate").value="";
  $("oppModalNotes").value="";
  $("oppModalStage").innerHTML=stages.map(s=>
    `<option value="${s.id}" ${String(s.id)===String(stage.id)?"selected":""}>${esc(s.name)}</option>`
  ).join("");

  $("oppCustomFieldsView").innerHTML=
    '<div class="small oppNoCustom">Completa los datos de la nueva oportunidad.</div>';
  $("oppMetaInfo").textContent="Contacto: "+name;

  $("oppDetailModal").classList.remove("hidden");
  setTimeout(()=>$("oppModalTitle")?.focus(),50);
}

if($("cpNewOpp"))$("cpNewOpp").onclick=openContactNewOpportunity;if($("cpSideNewOpp"))$("cpSideNewOpp").onclick=openContactNewOpportunity;


function localDateTimeValue(date){
  const d=new Date(date);
  const pad=n=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function openContactTaskPage(){
  tpfRememberScreen();
  if(!currentContact)return;
  const name=$("contactName").value.trim()||"Contacto";
  const phone=$("contactPhone").value.trim();
  $("cpTaskTitle").value="Llamar a "+name;
  $("cpTaskStarts").value=localDateTimeValue(new Date(Date.now()+60*60*1000));
  $("cpTaskReminder").value="";
  $("cpTaskNotes").value="";
  $("cpTaskNotifyApp").checked=true;
  $("cpTaskNotifyEmail").checked=false;
  $("cpTaskGoogle").checked=false;
  $("cpTaskMsg").textContent="";
  $("cpTaskContactLabel").textContent=`Tarea para ${name}`;
  $("cpTaskContactName").textContent=name;
  $("cpTaskContactPhone").textContent=phone||"Sin teléfono";
  $("cpTaskPage").classList.remove("hidden");
}
if($("cpNewTask"))$("cpNewTask").onclick=openContactTaskPage;if($("cpSideNewTask"))$("cpSideNewTask").onclick=openContactTaskPage;
$("cpTaskBack").onclick=async()=>{if(!await tpfBackExactly())$("cpTaskPage").classList.add("hidden")};


$("cpTaskSave").onclick=async()=>{
  if(!currentContact)return;
  if(!(perms?.is_admin||perms?.can_manage_agenda)){
    $("cpTaskMsg").textContent="No tienes permiso para crear recordatorios.";
    return;
  }
  const title=$("cpTaskTitle").value.trim();
  const starts=$("cpTaskStarts").value;
  if(!title||!starts){
    $("cpTaskMsg").textContent="Escribe un asunto y una fecha/hora.";
    return;
  }
  const {data:{user}}=await sb.auth.getUser();
  const row={
    title,
    description:$("cpTaskNotes").value.trim()||null,
    customer_name:$("contactName").value.trim()||null,
    customer_phone:$("contactPhone").value.trim()||null,
    starts_at:new Date(starts).toISOString(),
    reminder_at:$("cpTaskReminder").value?new Date($("cpTaskReminder").value).toISOString():null,
    assigned_to:user?.id||null,
    related_record_id:currentContact.id,
    status:"pending",
    reminder_minutes:[],
    notify_in_app:$("cpTaskNotifyApp").checked,
    notify_email:$("cpTaskNotifyEmail").checked,
    sync_google_calendar:$("cpTaskGoogle").checked
  };

  $("cpTaskSave").disabled=true;
  $("cpTaskMsg").textContent="Guardando...";
  try{
    const {data:createdTask,error}=await sb.from("agenda_items").insert(row).select("id,title").single();
    if(error)throw error;
    await logContactActivity(currentContact.id,"task_created","Tarea creada",createdTask?.title||title);
    $("cpTaskMsg").textContent="Tarea creada correctamente";
    await renderContactProfile();
    await loadAgenda();
    setTimeout(()=>$("cpTaskPage").classList.add("hidden"),450);
  }catch(e){
    $("cpTaskMsg").textContent=e?.message||"No se pudo crear la tarea.";
  }finally{
    $("cpTaskSave").disabled=false;
  }
};


let currentContactTask=null;


window.deleteContactTask=async(id)=>{
  if(!confirm("¿Eliminar esta tarea?"))return;
  const {data:trashAgenda}=await sb.from("agenda_items").select("*").eq("id",id).maybeSingle();
  if(trashAgenda)await archiveToTrash("agenda",id,trashAgenda.title||"Recordatorio",{agenda:trashAgenda});
  const {error}=await sb.from("agenda_items").delete().eq("id",id);
  if(error){alert(error.message);return;}
  if(currentContact && typeof renderContactProfile==="function")await renderContactProfile();
  if(typeof loadAgenda==="function")loadAgenda();
};
window.openContactTaskDetail=async(id)=>{
  tpfRememberScreen();
  const {data,error}=await sb.from("agenda_items").select("*").eq("id",id).single();
  if(error){alert(error.message);return}
  currentContactTask=data;
  $("cpTaskDetailId").value=data.id||"";
  $("cpTaskDetailHeading").textContent=data.title||"Tarea";
  $("cpTaskDetailTitle").value=data.title||"";
  $("cpTaskDetailStarts").value=data.starts_at?localDateTimeValue(data.starts_at):"";
  $("cpTaskDetailReminder").value=data.reminder_at?localDateTimeValue(data.reminder_at):"";
  $("cpTaskDetailNotes").value=data.description||"";
  $("cpTaskDetailNotifyApp").checked=data.notify_in_app!==false;
  $("cpTaskDetailNotifyEmail").checked=!!data.notify_email;
  $("cpTaskDetailGoogle").checked=!!data.sync_google_calendar;
  $("cpTaskDetailContactName").textContent=data.customer_name||"Contacto";
  $("cpTaskDetailContactPhone").textContent=data.customer_phone||"Sin teléfono";
  const done=data.status==="completed";
  $("cpTaskDetailStatus").textContent=done?"Completada":"Pendiente";
  $("cpTaskMarkDone").classList.toggle("hidden",done);
  $("cpTaskReopen").classList.toggle("hidden",!done);
  $("cpTaskDetailMsg").textContent="";
  $("cpTaskDetailPage").classList.remove("hidden");
};

$("cpTaskDetailBack").onclick=async()=>{if(!await tpfBackExactly())$("cpTaskDetailPage").classList.add("hidden")};

$("cpTaskDetailSave").onclick=async()=>{
  if(!currentContactTask)return;
  const title=$("cpTaskDetailTitle").value.trim();
  const starts=$("cpTaskDetailStarts").value;
  if(!title||!starts){
    $("cpTaskDetailMsg").textContent="Escribe un asunto y una fecha/hora.";
    return;
  }
  $("cpTaskDetailSave").disabled=true;
  try{
    const {error}=await sb.from("agenda_items").update({
      title,
      description:$("cpTaskDetailNotes").value.trim()||null,
      starts_at:new Date(starts).toISOString(),
      reminder_at:$("cpTaskDetailReminder").value?new Date($("cpTaskDetailReminder").value).toISOString():null,
      notify_in_app:$("cpTaskDetailNotifyApp").checked,
      notify_email:$("cpTaskDetailNotifyEmail").checked,
      sync_google_calendar:$("cpTaskDetailGoogle").checked
    }).eq("id",currentContactTask.id);
    if(error)throw error;
    $("cpTaskDetailMsg").textContent="Cambios guardados";
    await renderContactProfile();
    await loadAgenda();
  }catch(e){
    $("cpTaskDetailMsg").textContent=e?.message||"No se pudo guardar la tarea.";
  }finally{
    $("cpTaskDetailSave").disabled=false;
  }
};

$("cpTaskMarkDone").onclick=async()=>{
  if(!currentContactTask)return;
  const {error}=await sb.from("agenda_items").update({status:"completed"}).eq("id",currentContactTask.id);
  if(error){$("cpTaskDetailMsg").textContent=error.message;return}
  currentContactTask.status="completed";
  if(currentContact)await logContactActivity(currentContact.id,"task_done","Tarea completada",currentContactTask.title||"");
  $("cpTaskDetailStatus").textContent="Completada";
  $("cpTaskMarkDone").classList.add("hidden");
  $("cpTaskReopen").classList.remove("hidden");
  await renderContactProfile();
  await loadAgenda();
};

$("cpTaskReopen").onclick=async()=>{
  if(!currentContactTask)return;
  const {error}=await sb.from("agenda_items").update({status:"pending"}).eq("id",currentContactTask.id);
  if(error){$("cpTaskDetailMsg").textContent=error.message;return}
  currentContactTask.status="pending";
  if(currentContact)await logContactActivity(currentContact.id,"task_reopened","Tarea reabierta",currentContactTask.title||"");
  $("cpTaskDetailStatus").textContent="Pendiente";
  $("cpTaskMarkDone").classList.remove("hidden");
  $("cpTaskReopen").classList.add("hidden");
  await renderContactProfile();
  await loadAgenda();
};

$("cpTaskDelete").onclick=async()=>{
  if(!currentContactTask)return;
  const title=$("cpTaskDetailTitle").value.trim()||"esta tarea";
  if(!confirm(`¿Eliminar definitivamente "${title}"?`))return;
  const {error}=await sb.from("agenda_items").delete().eq("id",currentContactTask.id);
  if(error){$("cpTaskDetailMsg").textContent=error.message;return}
  if(currentContact)await logContactActivity(currentContact.id,"task_deleted","Tarea eliminada",currentContactTask.title||"");
  $("cpTaskDetailPage").classList.add("hidden");
  currentContactTask=null;
  await renderContactProfile();
  await loadAgenda();
};

$("cpAddNote").onclick=()=>{
  $("cpNoteComposer").classList.remove("hidden");
  $("cpNoteText").focus();
};
$("cpNoteCancel").onclick=()=>{
  $("cpNoteComposer").classList.add("hidden");
  $("cpNoteText").value="";
  $("cpNoteMsg").textContent="";
};
$("cpNoteSave").onclick=async()=>{
  if(!currentContact)return;
  const text=$("cpNoteText").value.trim();
  if(!text){$("cpNoteMsg").textContent="Escribe una nota.";return}
  const {data:{user}}=await sb.auth.getUser();
  const {error}=await sb.from("contact_activity").insert({
    contact_id:currentContact.id,
    activity_type:"note",
    title:"Nota",
    description:text,
    created_by:user?.id||null
  });
  if(error){$("cpNoteMsg").textContent=error.message;return}
  $("cpNoteText").value="";
  $("cpNoteComposer").classList.add("hidden");
  await renderContactProfile();
};
["contactFirstName","contactLastName"].forEach(id=>{
 const el=$(id);
 if(el)el.addEventListener("input",()=>{
   $("contactName").value=[$("contactFirstName").value.trim(),$("contactLastName").value.trim()].filter(Boolean).join(" ");
   const initials=[$("contactFirstName").value,$("contactLastName").value].filter(Boolean).map(x=>x.trim().charAt(0)).join("").slice(0,2).toUpperCase();
   if($("cpAvatar"))$("cpAvatar").textContent=initials||"C";
 });
});
$("contactSave").onclick=async()=>{
  const __btn=$("contactSave"); const __msg=$("contactMsg")||$("dbMsg"); tpfSetSaving(__btn,__msg);
 if(!currentContact)return;
 const oldData={...(currentContact.data||{})};
 const oldDni=contactField(oldData,"DNI / NIF","DNI","NIF").trim();
 const isBaseDatos=String(currentContact.source_sheet||"").trim().toUpperCase()==="BASE DE DATOS";

 const newFirstName=$("contactFirstName").value.trim();
 const newLastName=$("contactLastName").value.trim();
 const newName=[newFirstName,newLastName].filter(Boolean).join(" ").trim();
 $("contactName").value=newName;
 const newPhone=$("contactPhone").value.trim();
 const newDni=$("contactDni").value.trim();
 const newEmail=$("contactEmail").value.trim();
 const newNotes=$("contactNotes").value.trim();

 let affected=1;

 if(isBaseDatos && oldDni){
   const {data,error}=await sb.rpc("update_records_by_dni",{
     old_dni:oldDni,
     new_name:newName,
     new_phone:newPhone,
     new_dni:newDni,
     new_email:newEmail,
     new_notes:newNotes
   });
   if(error){tpfShowSaveError(__btn,__msg,error);return;}
   affected=Number(data||0)||1;
 }else{
   const d={...oldData};

   // Mantener las claves originales cuando sea posible para no alterar hojas externas.
   if("NOMBRE Y APELLIDOS" in d || isBaseDatos) d["NOMBRE Y APELLIDOS"]=newName;
   else if("NOMBRE" in d) d["NOMBRE"]=newName;
   else if("CLIENTE" in d) d["CLIENTE"]=newName;
   else if("CLIENTE FINAL" in d) d["CLIENTE FINAL"]=newName;
   else d["NOMBRE Y APELLIDOS"]=newName;
   // Contactos propios: conservar también Nombre y Apellidos separados.
   if(isBaseDatos || "NOMBRE" in d || "APELLIDOS" in d){
     d["NOMBRE"]=newFirstName;
     d["APELLIDOS"]=newLastName;
     d["NOMBRE Y APELLIDOS"]=newName;
   }

   if("TELÉFONO" in d || isBaseDatos) d["TELÉFONO"]=newPhone;
   else if("TELEFONO" in d) d["TELEFONO"]=newPhone;
   else if("PHONE" in d) d["PHONE"]=newPhone;
   else if("MOVIL" in d) d["MOVIL"]=newPhone;
   else d["TELÉFONO"]=newPhone;

   if("DNI / NIF" in d || isBaseDatos) d["DNI / NIF"]=newDni;
   else if("DNI" in d) d["DNI"]=newDni;
   else if("NIF" in d) d["NIF"]=newDni;
   else d["DNI / NIF"]=newDni;

   if("EMAIL" in d || !("Email" in d) && !("email" in d)) d["EMAIL"]=newEmail;
   else if("Email" in d) d["Email"]=newEmail;
   else d["email"]=newEmail;

   if("NOTAS" in d || !("NOTES" in d) && !("OBSERVACIONES" in d)) d["NOTAS"]=newNotes;
   else if("NOTES" in d) d["NOTES"]=newNotes;
   else d["OBSERVACIONES"]=newNotes;

   const {error}=await sb.from("records").update({data:d}).eq("id",currentContact.id);
   if(error){tpfShowSaveError(__btn,__msg,error);return;}
   currentContact.data=d;
 }

 const displayData={...oldData,
   "NOMBRE":newFirstName,
   "APELLIDOS":newLastName,
   "NOMBRE Y APELLIDOS":newName,
   "TELÉFONO":newPhone,
   "DNI / NIF":newDni,
   "EMAIL":newEmail,
   "NOTAS":newNotes
 };

 const changed=[];
 const fields=[
   ["NOMBRE Y APELLIDOS","Nombre / Apellidos"],
   ["TELÉFONO","Teléfono"],
   ["DNI / NIF","DNI / NIF"],
   ["EMAIL","Email"],
   ["NOTAS","Notas"]
 ];
 for(const [key,label] of fields){
   const oldVal = key==="NOMBRE Y APELLIDOS" ? contactField(oldData,"NOMBRE Y APELLIDOS","NOMBRE","CLIENTE","CLIENTE FINAL")
                : key==="TELÉFONO" ? contactField(oldData,"TELÉFONO","TELEFONO","PHONE","MOVIL")
                : key==="DNI / NIF" ? contactField(oldData,"DNI / NIF","DNI","NIF")
                : key==="EMAIL" ? contactField(oldData,"EMAIL","Email","email")
                : contactField(oldData,"NOTAS","NOTES","OBSERVACIONES");
   if(String(oldVal??"")!==String(displayData[key]??"")) changed.push(label);
 }

 if(isBaseDatos) currentContact.data=displayData;

 if(isBaseDatos && affected>1){
   $("contactMsg").textContent=`Contacto actualizado en ${affected} registros de Contactos con el mismo DNI`;
 }else{
   $("contactMsg").textContent="Contacto actualizado correctamente";
 }

 if(changed.length){
   await logContactActivity(
     currentContact.id,
     "contact_updated",
     (isBaseDatos && affected>1)?`Contacto modificado en ${affected} registros de Contactos`:"Contacto modificado",
     "Campos modificados: "+changed.join(", ")
   );
 }
 await renderContactProfile();
 $("searchBtn").click();
  tpfResetSaving(__btn,__msg,"Guardado correctamente.");
};
$("contactDelete").onclick=async()=>{
 if(!currentContact)return; const name=$("contactName").value||"este contacto";
 if(!confirm(`¿Seguro que quieres eliminar a ${name}? Esta acción no se puede deshacer.`))return;
 await archiveToTrash("contact",currentContact.id,name,{record:currentContact});
 const {error}=await sb.from("records").delete().eq("id",currentContact.id);
 if(error){$("contactMsg").textContent=error.message;return}
 $("contactModal").classList.add("hidden"); currentContact=null; $("searchBtn").click();
};

async function checkDuplicate(){
 const phone=$("dbPhone").value.trim(), dni=$("dbDni").value.trim(), email=$("dbEmail").value.trim();
 if(!phone&&!dni&&!email){$("duplicateInfo").innerHTML="";return []}
 const {data,error}=await sb.rpc("find_possible_duplicate_contact",{phone_text:phone||null,dni_text:dni||null,email_text:email||null});
 if(error){$("dbMsg").textContent=error.message;return []}
 const rows=data||[];
 $("duplicateInfo").innerHTML=rows.length?`<div class="duplicateBox"><b>Posible contacto duplicado</b><br>${rows.map(r=>{
   const d=r.data||{}; const n=d["NOMBRE Y APELLIDOS"]||d["NOMBRE"]||d["CLIENTE"]||"Contacto";
   return `${esc(n)} · ${esc(d["TELÉFONO"]||d["TELEFONO"]||"")} <button class="secondary" onclick="showRelated('${r.id}')">Abrir relación</button>`;
 }).join("<br>")}</div>`:"";
 return rows;
}
$("dbCheck").onclick=checkDuplicate;
$("dbSave").onclick=async()=>{
  const __btn=$("dbSave"); const __msg=$("dbMsg")||$("contactMsg"); tpfSetSaving(__btn,__msg);
 const dup=await checkDuplicate();
 if(dup.length&&!confirm("Hay un posible duplicado. ¿Quieres crear el contacto igualmente?"))return;
 const firstName=$("dbFirstName").value.trim();
 const lastName=$("dbLastName").value.trim();
 const fullName=[firstName,lastName].filter(Boolean).join(" ").trim();
 const obj={"NOMBRE":firstName,"APELLIDOS":lastName,"NOMBRE Y APELLIDOS":fullName,"TELÉFONO":$("dbPhone").value,"DNI / NIF":$("dbDni").value,"EMAIL":$("dbEmail").value,"NOTAS":$("dbNotes").value};
 const {data,error}=await sb.from("records").insert({source_sheet:"BASE DE DATOS",data:obj}).select("id").single();
 $("dbMsg").textContent=error?error.message:"Guardado correctamente";
 if(!error){
   const savedName=obj["NOMBRE Y APELLIDOS"], savedPhone=obj["TELÉFONO"], savedEmail=obj["EMAIL"];
   try{
     const {data:gs}=await sb.from("app_settings").select("value").eq("key","google_contacts_sync").maybeSingle();
     if(gs?.value===true){
       if(!googleContactsToken){
         $("dbMsg").textContent="Guardado en The Phone Face. Conecta Google Contacts para sincronizarlo.";
       }else{
         const gr=await createGoogleContact(savedName,savedPhone,savedEmail);
         $("dbMsg").textContent=gr.duplicate?"Guardado. Ya existía en Google Contacts.":"Guardado también en Google Contacts.";
       }
     }
   }catch(e){
     $("dbMsg").textContent="Guardado en The Phone Face. Google: "+(e.message||"no se pudo sincronizar");
   }
   ["dbFirstName","dbLastName","dbPhone","dbDni","dbEmail","dbNotes"].forEach(id=>$(id).value="");
   $("duplicateInfo").innerHTML="";
   if(confirm("Contacto creado. ¿Quieres crear una oportunidad para este contacto?")){
     createOppFromRecord(JSON.stringify({id:data.id,name:obj["NOMBRE Y APELLIDOS"],phone:obj["TELÉFONO"]}));
   }
 }
  tpfResetSaving(__btn,__msg,"Guardado correctamente.");
};

let salesCache={stages:[],opportunities:[],fields:[]};

function salesFilteredOpps(){
  const term=($("salesSearch")?.value||"").trim().toLowerCase();
  const stageFilter=$("salesStageFilter")?.value||"";
  const sort=$("salesSort")?.value||"position";
  let rows=[...(salesCache.opportunities||[])];
  if(term){
    rows=rows.filter(o=>[o.title,o.client_name,o.phone,o.notes]
      .some(v=>String(v||"").toLowerCase().includes(term)));
  }
  if(stageFilter) rows=rows.filter(o=>o.stage_id===stageFilter);
  rows.sort((a,b)=>{
    if(sort==="amount_desc") return Number(b.amount||0)-Number(a.amount||0);
    if(sort==="amount_asc") return Number(a.amount||0)-Number(b.amount||0);
    if(sort==="date_asc") return String(a.expected_date||"9999-12-31").localeCompare(String(b.expected_date||"9999-12-31"));
    if(sort==="date_desc") return String(b.expected_date||"").localeCompare(String(a.expected_date||""));
    return Number(a.position||0)-Number(b.position||0);
  });
  return rows;
}
function fmtMoney(v){return Number(v||0).toLocaleString("es-ES",{style:"currency",currency:"EUR"})}
function fmtDateOnly(v){
  if(!v)return "";
  const [y,m,d]=String(v).split("-");
  return d&&m&&y?`${d}/${m}/${y}`:v;
}
function renderSales(){
  const stages=salesCache.stages||[];
  const opps=salesFilteredOpps();
  const all=salesCache.opportunities||[];
  const totalOpen=all.filter(o=>o.status!=="won"&&o.status!=="lost").length;
  const totalAmount=all.reduce((s,o)=>s+Number(o.amount||0),0);

  $("salesSummary").innerHTML=[
    ["Oportunidades",all.length],
    ["Abiertas",totalOpen],
    ["Valor total",fmtMoney(totalAmount)],
    ["Columnas",stages.length]
  ].map(([l,v])=>`<div class="salesStat">${esc(l)}<b>${esc(v)}</b></div>`).join("");
  // Resumen desplegable
  try{
    const openOpps=all.filter(o=>o.status!=="won"&&o.status!=="lost");
    const forecast=openOpps.reduce((s,o)=>s+Number(o.amount||0),0);
    if($("salesSummaryForecast"))$("salesSummaryForecast").textContent=fmtMoney(forecast);
    if($("salesSummaryForecastCount"))$("salesSummaryForecastCount").textContent=`${openOpps.length} oportunidades abiertas`;
    if($("salesSummaryStages"))$("salesSummaryStages").innerHTML=stages.map(s=>{
      const rows=all.filter(o=>String(o.stage_id)===String(s.id));
      const amount=rows.reduce((sum,o)=>sum+Number(o.amount||0),0);
      return `<span class="salesSummaryStageChip"><b>${esc(s.name)}</b> ${rows.length} · ${esc(fmtMoney(amount))}</span>`;
    }).join("")||'<span class="small">Sin columnas.</span>';
  }catch(e){}

  $("salesStageFilter").innerHTML='<option value="">Todas las columnas</option>'+
    stages.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("");

  $("customFieldsStrip").innerHTML=(salesCache.fields||[]).length
    ? (salesCache.fields||[]).map(f=>`<span class="fieldChip">${esc(f.label)} · ${esc(f.field_type)}</span>`).join("")
    : '<span class="small">Aún no hay campos personalizados.</span>';

  $("salesBoard").innerHTML=stages.map(s=>{
    const stageOpps=opps.filter(o=>o.stage_id===s.id);
    const amount=stageOpps.reduce((sum,o)=>sum+Number(o.amount||0),0);
    return `<div class="stage" data-stage="${s.id}">
      <div class="stageHead">
        <div class="stageTitleWrap">
          <div class="stageTitle">${esc(s.name)}</div>
          <div class="stageMeta">${stageOpps.length} oportunidades · ${esc(fmtMoney(amount))}</div>
          <label class="stageSelectAllLabel">
            <input type="checkbox" class="stageSelectAll" data-stage-id="${s.id}" onclick="event.stopPropagation();toggleStageSelection('${s.id}',this.checked)">
            Seleccionar todas
          </label>
        </div>
        <button class="stageMenu" title="Opciones" onclick="event.stopPropagation();openStageMenu(event,'${s.id}')">•••</button>
      </div>
      ${stageOpps.length?stageOpps.map(o=>`<div class="opp" data-opp-id="${o.id}" onclick="openOpportunityCard('${o.id}')" title="Abrir ficha">
        <div class="oppTop">
          <input type="checkbox" class="salesOppCheck" data-opp-id="${o.id}" onclick="event.stopPropagation();toggleSalesOpportunitySelection('${o.id}',this.checked)">
          <div class="oppTitle">${esc(o.title)}</div>
          <button class="oppMenu" onclick="event.stopPropagation();openOpportunityCard('${o.id}')" title="Abrir ficha">•••</button>
        </div>
        <div class="oppInfo">
          ${o.client_name?`<div><span class="label">Cliente:</span> <button type="button" class="salesClientLink" onclick="event.stopPropagation();openSalesOpportunityContact('${o.id}')">${esc(o.client_name)}</button></div>`:""}
          ${o.phone?`<div><span class="label">Teléfono:</span> ${esc(o.phone)}</div>`:""}
          ${o.expected_date?`<div><span class="label">Fecha:</span> ${esc(fmtDateOnly(o.expected_date))}</div>`:""}
          ${o.notes?`<div><span class="label">Notas:</span> ${esc(o.notes)}</div>`:""}
        </div>
        <div class="oppFooter">
          <span class="oppAmount">${esc(fmtMoney(o.amount||0))}</span>
          <select onclick="event.stopPropagation()" onchange="event.stopPropagation();moveOpp('${o.id}',this.value)">
            ${stages.map(x=>`<option value="${x.id}" ${x.id===o.stage_id?"selected":""}>${esc(x.name)}</option>`).join("")}
          </select>
        </div>
      </div>`).join(""):`<div class="emptyStage">Sin oportunidades</div>`}
      <button class="secondary" style="width:100%;margin-top:8px" onclick="newOppInStage('${s.id}')">+ Añadir oportunidad</button>
    </div>`;
  }).join("");
  refreshSalesBulkStages();
  refreshVisibleSalesStateFilter();
  updateSalesBulkUi();
  setTimeout(applyVisibleSalesStateFilter,0);
  if(salesCurrentView==="list")renderSalesList();

}

async function loadSales(){
 const {data,error}=await sb.rpc("sales_board");
 if(error){$("salesBoard").innerHTML=esc(error.message);return}
 salesCache={stages:data?.stages||[],opportunities:data?.opportunities||[],fields:data?.fields||[]};
 window.dispatchEvent(new CustomEvent('tpf:sales-updated',{detail:{opportunities:salesCache.opportunities}}));
 renderSales();
}
window.moveOpp=async(id,stage)=>{const {error}=await sb.from("sales_opportunities").update({stage_id:stage,position:0}).eq("id",id);if(error)alert(error.message);else loadSales()};

window.deleteOpp=async(id)=>{
 if(!confirm("¿Eliminar esta oportunidad?"))return;
 const opp=(salesCache.opportunities||[]).find(x=>String(x.id)===String(id));
 if(opp)await archiveToTrash("opportunity",id,opp.title||"Oportunidad",{opportunity:opp});
 const {error}=await sb.rpc("delete_sales_opportunity",{opportunity_id:id});
 if(error)alert(error.message);else loadSales();
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

$("newOpp").onclick=async()=>{
 const title=prompt("Título de la oportunidad");if(!title)return;
 const client=prompt("Cliente")||"";const phone=prompt("Teléfono")||"";const amount=prompt("Importe")||"";
 const {data:stages}=await sb.from("sales_stages").select("id,pipeline_id").order("position").limit(1);
 if(!stages?.length)return;
 const {error}=await sb.from("sales_opportunities").insert({pipeline_id:stages[0].pipeline_id,stage_id:stages[0].id,title,client_name:client,phone,amount:amount?Number(amount.replace(",",".")):null});
 if(error)alert(error.message);else loadSales();
};

function findHeader(rows){
 for(let i=0;i<Math.min(20,rows.length);i++)if((rows[i]||[]).filter(v=>String(v??"").trim()).length>=2)return i;return 0;
}
$("previewImport").onclick=()=>{
 const f=$("excelFile").files[0];if(!f){alert("Selecciona un Excel");return}
 const r=new FileReader();r.onload=e=>{
  const wb=XLSX.read(new Uint8Array(e.target.result),{type:"array",raw:false});
  let ws=null;
  const dest=$("destination").value;
  const fileBaseName=String(f.name||"").replace(/\.[^.]+$/,"").trim();
  const addFileNameField=["AJUSTES","CLAWBACK"].includes(String(dest).trim().toUpperCase());

  const target=wb.SheetNames.find(n=>n.trim().toUpperCase()===dest)||wb.SheetNames[0];
  ws=wb.Sheets[target];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:false,blankrows:false});
  const hi=findHeader(rows);
  importHeaders=(rows[hi]||[]).map((h,i)=>String(h||"").trim()||"Columna "+(i+1));

  if(addFileNameField && !importHeaders.includes("ARCHIVO")) importHeaders.push("ARCHIVO");

  importRows=rows.slice(hi+1).filter(row=>row.some(v=>String(v??"").trim())).map((row,idx)=>{
    const data=Object.fromEntries(
      importHeaders
        .filter(h=>h!=="ARCHIVO")
        .map((h,i)=>[h,row[i]??""])
    );
    if(addFileNameField) data["ARCHIVO"]=fileBaseName;
    return {source_sheet:dest,source_row:hi+2+idx,data};
  });

  $("importInfo").textContent=addFileNameField
    ? `${importRows.length} registros encontrados en hoja ${target}. Se añadirá ARCHIVO = ${fileBaseName} a todas las filas.`
    : `${importRows.length} registros encontrados en hoja ${target}. Se muestran los primeros 10.`;

  $("previewHead").innerHTML="<tr>"+importHeaders.slice(0,12).map(h=>"<th>"+esc(h)+"</th>").join("")+"</tr>";
  $("previewRows").innerHTML=importRows.slice(0,10).map(x=>"<tr>"+importHeaders.slice(0,12).map(h=>"<td>"+esc(x.data[h])+"</td>").join("")+"</tr>").join("");
  $("runImport").disabled=!importRows.length;
 };r.readAsArrayBuffer(f);
};
$("runImport").onclick=async()=>{
 if(!(perms?.is_admin||perms?.can_manage_imports)){alert("Sin permiso");return}
 if(!confirm(`¿Importar ${importRows.length} registros en ${$("destination").value}?`))return;
 $("runImport").disabled=true; let done=0; const size=200;
 for(let i=0;i<importRows.length;i+=size){
   const batch=importRows.slice(i,i+size);
   const {error}=await sb.from("records").insert(batch);
   if(error){alert("Error en lote: "+error.message);$("runImport").disabled=false;return}
   done+=batch.length;$("importBar").style.width=(done/importRows.length*100)+"%";$("importInfo").textContent=`Importados ${done} / ${importRows.length}`;
 }
 $("importInfo").textContent=`Importación terminada: ${done} registros.`;importRows=[];$("runImport").disabled=true;
};

