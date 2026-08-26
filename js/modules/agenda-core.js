/* TPF physical module split · generated from app-core.js */
function fmtAgendaDate(value){
  if(!value)return "";
  const d=new Date(value);
  return d.toLocaleString("es-ES",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function agendaStatusLabel(s){
  return s==="completed"?"Completado":s==="cancelled"?"Cancelado":"Pendiente";
}

function whatsappDigits(phone){
  let p=String(phone||"").replace(/\D/g,"");
  if(p.startsWith("00"))p=p.slice(2);
  if(p.length===9)p="34"+p;
  return p;
}
function whatsappDue(row){
  if(!row?.whatsapp_enabled)return false;
  const when=row.whatsapp_scheduled_at||row.starts_at;
  if(!when)return true;
  return new Date(when).getTime()<=Date.now();
}
window.sendAgendaWhatsapp=(id)=>{
  const row=(window.__agendaRows||[]).find(x=>String(x.id)===String(id));
  if(!row)return;
  const p=whatsappDigits(row.whatsapp_phone||row.customer_phone);
  if(!p){alert("Esta tarea no tiene teléfono de WhatsApp.");return}
  const text=String(row.whatsapp_message||"").trim();
  const url="https://wa.me/"+p+(text?"?text="+encodeURIComponent(text):"");
  window.open(url,"_blank","noopener,noreferrer");
};

async function loadAgenda(){
  if(!(perms?.is_admin||perms?.can_view_agenda||perms?.can_manage_agenda))return;
  let q=sb.from("agenda_items").select("*").or("whatsapp_enabled.is.null,whatsapp_enabled.eq.false").order("starts_at",{ascending:true}).limit(300);
  const filter=$("agendaFilter")?.value||"pending";
  const now=new Date();
  if(filter==="pending") q=q.eq("status","pending");
  if(filter==="completed") q=q.eq("status","completed");
  if(filter==="today"){
    const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const end=new Date(start);end.setDate(end.getDate()+1);
    q=q.gte("starts_at",start.toISOString()).lt("starts_at",end.toISOString());
  }
  if(filter==="week"){
    const end=new Date(now);end.setDate(end.getDate()+7);
    q=q.gte("starts_at",now.toISOString()).lte("starts_at",end.toISOString()).eq("status","pending");
  }
  const {data,error}=await q;
  if(error){$("agendaRows").innerHTML=`<tr><td colspan="7">${esc(error.message)}</td></tr>`;return}
  const rows=data||[];
  window.__agendaRows=rows;
  $("agendaEmpty").style.display=rows.length?"none":"block";
  $("agendaRows").innerHTML=rows.map(a=>`<tr>
    <td>${esc(fmtAgendaDate(a.starts_at))}</td>
    <td><b>${esc(a.title)}</b></td>
    <td>${esc(a.customer_name||"")}</td>
    <td>${esc(a.customer_phone||"")}</td>
    <td>${esc(a.description||"")}</td>
    <td>${esc(agendaStatusLabel(a.status))}</td>
    <td>
      <button class="secondary" onclick="openAgendaItem('${a.id}')">Abrir</button>
      <button class="secondary" onclick="editAgendaItem('${a.id}')">Editar</button>
      ${a.status==="pending"?`<button class="secondary" onclick="completeAgenda('${a.id}')">Completar</button> `:""}
      ${a.status==="pending"?`<button class="secondary" onclick="cancelAgenda('${a.id}')">Cancelar</button> `:""}
      ${(perms?.is_admin||perms?.can_manage_agenda)?`<button class="danger" onclick="deleteAgenda('${a.id}')">Eliminar</button>`:""}
    </td>
  </tr>`).join("");
}
$("agendaFilter").onchange=loadAgenda;
$("agendaRefresh").onclick=loadAgenda;

$("agendaSave").onclick=async()=>{
  const __btn=$("agendaSave"); const __msg=$("agendaMsg"); tpfSetSaving(__btn,__msg);
  if(!(perms?.is_admin||perms?.can_manage_agenda)){alert("No tienes permiso para crear recordatorios.");return}
  const title=$("agendaTitle").value.trim();
  const starts=$("agendaStarts").value;
  if(!title||!starts){$("agendaMsg").textContent="Escribe un asunto y una fecha/hora.";return}
  const {data:{user}}=await sb.auth.getUser();
  const mins=selectedAgendaReminderMinutes();
  const row={
    title,
    description:$("agendaDescription").value.trim()||null,
    customer_name:$("agendaCustomer").value.trim()||null,
    customer_phone:$("agendaPhone").value.trim()||null,
    starts_at:new Date(starts).toISOString(),
    reminder_at:$("agendaReminder").value?new Date($("agendaReminder").value).toISOString():null,
    assigned_to:user?.id||null,
    status:"pending",
    reminder_minutes:mins,
    notify_in_app:$("agendaNotifyApp")?.checked??true,
    notify_email:$("agendaNotifyEmail")?.checked??false,
    sync_google_calendar:$("agendaSyncGoogle")?.checked??false
  };
  const {error}=await sb.from("agenda_items").insert(row);
  if(error){tpfShowSaveError(__btn,__msg,error);return;}
  $("agendaMsg").textContent="Recordatorio guardado";
  ["agendaTitle","agendaDescription","agendaCustomer","agendaPhone","agendaStarts","agendaReminder"].forEach(id=>$(id).value="");
  loadAgenda();
  tpfResetSaving(__btn,__msg,"Recordatorio guardado.");
};

window.completeAgenda=async(id)=>{
  const {error}=await sb.from("agenda_items").update({status:"completed"}).eq("id",id);
  if(error)alert(error.message);else loadAgenda();
};
window.cancelAgenda=async(id)=>{
  const {error}=await sb.from("agenda_items").update({status:"cancelled"}).eq("id",id);
  if(error)alert(error.message);else loadAgenda();
};
window.deleteAgenda=async(id)=>{
  if(!confirm("¿Eliminar este recordatorio?"))return;
  const {error}=await sb.from("agenda_items").delete().eq("id",id);
  if(error)alert(error.message);else loadAgenda();
};
