/* Agenda Pro — compatible with the existing agenda_items model. */
const AGENDA_DEFAULT_TYPES=[{name:"Tarea",icon:"✓",color:"#155eef"},{name:"Llamada",icon:"☎",color:"#7f56d9"},{name:"Cita",icon:"◷",color:"#eaaa08"},{name:"WhatsApp",icon:"💬",color:"#16a34a"}];
let agendaTypes=[...AGENDA_DEFAULT_TYPES],agendaSelectedType="Tarea",agendaSearchTimer,agendaDateFilter="all";
function fmtAgendaDate(v){return v?new Date(v).toLocaleString("es-ES",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):""}
function agendaStatusLabel(s){return s==="completed"?"Completado":s==="cancelled"?"Cancelado":"Pendiente"}
function whatsappDigits(phone){let p=String(phone||"").replace(/\D/g,"");if(p.startsWith("00"))p=p.slice(2);if(p.length===9)p="34"+p;return p}
function whatsappDue(row){if(!row?.whatsapp_enabled)return false;const when=row.whatsapp_scheduled_at||row.starts_at;return !when||new Date(when)<=new Date()}
function dayKey(v){const d=new Date(v);return d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate()}
function startDay(d=new Date()){return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
function isToday(v){return dayKey(v)===dayKey(new Date())}
function isOverdue(r){return r.status==="pending"&&new Date(r.starts_at)<new Date()}
function typeFor(r){return agendaTypes.find(t=>t.name.toLowerCase()===String(r.agenda_type||"Tarea").toLowerCase())||AGENDA_DEFAULT_TYPES[0]}
async function loadAgendaTypes(){const {data}=await sb.from("app_settings").select("value").eq("key","agenda_types").maybeSingle();const a=Array.isArray(data?.value)?data.value.filter(t=>t?.name&&t?.icon&&t?.color).slice(0,30):[];agendaTypes=a.length?a:[...AGENDA_DEFAULT_TYPES];if(!agendaTypes.some(t=>t.name===agendaSelectedType))agendaSelectedType=agendaTypes[0].name;renderTypeChoices();renderTypeManager()}
async function saveAgendaTypes(){const {error}=await sb.from("app_settings").upsert({key:"agenda_types",value:agendaTypes,updated_at:new Date().toISOString()},{onConflict:"key"});if(error)throw error;renderTypeChoices();renderTypeManager();loadAgenda()}
function renderTypeChoices(){const e=$("agendaTypeChoices");if(e)e.innerHTML=agendaTypes.map(t=>`<button type="button" data-type="${esc(t.name)}" class="${t.name===agendaSelectedType?"active":""}" style="--type-color:${esc(t.color)}">${esc(t.icon)} ${esc(t.name)}</button>`).join("")}
function renderTypeManager(){const e=$("agendaTypeList");if(e)e.innerHTML=agendaTypes.map((t,i)=>`<div class="agendaTypeRow"><span class="agendaTypeDot" style="background:${esc(t.color)}">${esc(t.icon)}</span><b>${esc(t.name)}</b><button class="secondary" data-remove-type="${i}" ${agendaTypes.length<2?"disabled":""}>Quitar</button></div>`).join("")}
window.sendAgendaWhatsapp=id=>{const r=(window.__agendaRows||[]).find(x=>String(x.id)===String(id));if(!r)return;const p=whatsappDigits(r.whatsapp_phone||r.customer_phone);if(!p)return alert("Esta tarea no tiene teléfono de WhatsApp.");window.open("https://wa.me/"+p+(r.whatsapp_message?"?text="+encodeURIComponent(r.whatsapp_message):""),"_blank","noopener,noreferrer")};
function agendaSearchText(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()}
function agendaSearchDigits(v){return String(v||"").replace(/\D/g,"").slice(-9)}
function agendaContactValues(row){const d=row?.data||{};return {id:String(row?.id||""),name:d["NOMBRE Y APELLIDOS"]||d.NOMBRE||d.CLIENTE||"",phone:d["TELÉFONO"]||d.TELEFONO||d.PHONE||""}}
function visibleRows(rows,contacts=[]){
  const raw=String($("agendaSearch")?.value||"").trim(),q=agendaSearchText(raw);
  if(!q)return rows;
  const matchedContacts=(contacts||[]).map(agendaContactValues),queryDigits=agendaSearchDigits(raw);
  return rows.filter(r=>{
    if([r.title,r.customer_name,r.customer_phone,r.description,r.agenda_type].some(v=>agendaSearchText(v).includes(q)))return true;
    const phone=agendaSearchDigits(r.customer_phone),name=agendaSearchText(r.customer_name),recordId=String(r.related_record_id||"");
    return matchedContacts.some(c=>(recordId&&c.id===recordId)||(phone&&phone===agendaSearchDigits(c.phone))||(name&&name===agendaSearchText(c.name))||(queryDigits&&agendaSearchDigits(c.phone).includes(queryDigits)));
  })
}
function groupName(r){const d=startDay(new Date(r.starts_at)),t=startDay(),m=new Date(t);m.setDate(t.getDate()+1);return +d===+t?"Hoy":+d===+m?"Mañana":d<t?"Vencidos":"Próximos"}
function renderItem(a){const t=typeFor(a),d=new Date(a.starts_at),state=a.status==="completed"?"completed":isOverdue(a)?"overdue":"";return `<article class="agendaItem"><time class="agendaTime">${d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</time><span class="agendaTypeIcon" style="--type-color:${esc(t.color)}">${esc(t.icon)}</span><div class="agendaItemTitle"><b>${esc(a.title)}</b><small>${esc(t.name)}${a.description?" · "+esc(a.description):""}</small></div><div class="agendaItemPerson"><b>${esc(a.customer_name||"Sin cliente")}</b><small>${esc(a.customer_phone||"")}</small></div><div class="agendaItemState"><span class="agendaBadge ${state}">${state==="overdue"?"Vencido":agendaStatusLabel(a.status)}</span><div class="agendaActions"><button data-open-agenda="${esc(a.id)}">Abrir</button>${a.status==="pending"?`<button class="agendaDone" data-complete-agenda="${esc(a.id)}">✓ Completar</button>`:""}<button class="agendaMore" data-more-agenda="${esc(a.id)}" aria-label="Más acciones">•••</button></div></div></article>`}
function renderList(rows){const groups=rows.reduce((a,r)=>((a[groupName(r)]||=[]).push(r),a),{});$("agendaList").innerHTML=["Vencidos","Hoy","Mañana","Próximos"].filter(k=>groups[k]?.length).map(k=>`<section class="agendaGroup"><h3 class="agendaGroupTitle">${k}<span>${groups[k].length} recordatorio${groups[k].length===1?"":"s"}</span></h3>${groups[k].map(renderItem).join("")}</section>`).join("")}
function renderCalendar(rows){const n=new Date(),f=new Date(n.getFullYear(),n.getMonth(),1),s=new Date(f);s.setDate(f.getDate()-((f.getDay()+6)%7));let days="";for(let i=0;i<42;i++){const d=new Date(s);d.setDate(s.getDate()+i);const rs=rows.filter(r=>dayKey(r.starts_at)===dayKey(d));days+=`<div class="agendaDay ${d.getMonth()!==n.getMonth()?"muted":""} ${isToday(d)?"today":""}"><b>${d.getDate()}</b>${rs.slice(0,3).map(r=>`<span class="agendaDayEvent">${new Date(r.starts_at).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})} ${esc(r.title)}</span>`).join("")}${rs.length>3?`<small>+${rs.length-3} más</small>`:""}</div>`}$("agendaCalendar").innerHTML=`<h3 class="agendaMonthTitle">${n.toLocaleDateString("es-ES",{month:"long",year:"numeric"})}</h3><div class="agendaCalendarGrid">${["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(x=>`<div class="agendaCalendarHead">${x}</div>`).join("")}${days}</div>`}
function updateStats(a){$("agendaStatToday").textContent=a.filter(r=>isToday(r.starts_at)).length;$("agendaStatPending").textContent=a.filter(r=>r.status==="pending").length;$("agendaStatOverdue").textContent=a.filter(isOverdue).length;$("agendaStatCompleted").textContent=a.filter(r=>r.status==="completed").length}
function agendaDateRange(period,now=new Date()){
  if(period==="all")return null;
  if(period==="today"){const start=startDay(now),end=new Date(start);end.setDate(end.getDate()+1);return {start,end}}
  if(period==="tomorrow"){const start=startDay(now);start.setDate(start.getDate()+1);const end=new Date(start);end.setDate(end.getDate()+1);return {start,end}}
  if(period==="week"){const start=startDay(now);start.setDate(start.getDate()-((start.getDay()+6)%7));const end=new Date(start);end.setDate(end.getDate()+7);return {start,end}}
  if(period==="month"){return {start:new Date(now.getFullYear(),now.getMonth(),1),end:new Date(now.getFullYear(),now.getMonth()+1,1)}}
  return null
}
function syncAgendaFilterUi(){
  const periods={all:"Cualquier fecha",today:"Hoy",tomorrow:"Mañana",week:"Esta semana",month:"Este mes"};
  const statuses={all:"Todos los estados",pending:"Pendientes",overdue:"Vencidos",completed:"Completados",cancelled:"Cancelados"};
  document.querySelectorAll("#agendaQuickFilters [data-agenda-period]").forEach(b=>{
    const active=b.dataset.agendaPeriod===agendaDateFilter;
    b.classList.toggle("active",active);
    b.setAttribute("aria-pressed",String(active));
  });
  const status=$("agendaFilter")?.value||"pending";
  if($("agendaFilterSummary"))$("agendaFilterSummary").textContent=(statuses[status]||status)+" · "+(periods[agendaDateFilter]||periods.all);
}
async function loadAgenda(){
  if(!(perms?.is_admin||perms?.can_view_agenda||perms?.can_manage_agenda))return;
  const status=$("agendaFilter")?.value||"pending",now=new Date(),range=agendaDateRange(agendaDateFilter,now);
  let q=sb.from("agenda_items").select("*").or("whatsapp_enabled.is.null,whatsapp_enabled.eq.false").order("starts_at",{ascending:true}).limit(300);
  if(status==="pending")q=q.eq("status","pending");
  else if(status==="completed")q=q.eq("status","completed");
  else if(status==="cancelled")q=q.eq("status","cancelled");
  else if(status==="overdue")q=q.eq("status","pending").lt("starts_at",now.toISOString());
  if(range)q=q.gte("starts_at",range.start.toISOString()).lt("starts_at",range.end.toISOString());
  syncAgendaFilterUi();
  const searchText=String($("agendaSearch")?.value||"").trim();
  const contactSearch=searchText.length>=2?sb.rpc("search_records",{search_text:searchText,sheet_filter:"BASE DE DATOS",result_limit:100}):Promise.resolve({data:[]});
  const [one,two,contacts]=await Promise.all([q,sb.from("agenda_items").select("id,status,starts_at").or("whatsapp_enabled.is.null,whatsapp_enabled.eq.false").limit(1000),contactSearch]);
  if(one.error){$("agendaList").innerHTML=`<div class="agendaEmpty">${esc(one.error.message)}</div>`;return}
  const rows=visibleRows(one.data||[],contacts?.data||[]);
  window.__agendaRows=one.data||[];
  updateStats(two.data||[]);
  $("agendaEmpty").style.display=rows.length?"none":"block";
  renderList(rows);renderCalendar(rows)
}
$("agendaFilter").onchange=loadAgenda;
$("agendaRefresh").onclick=loadAgenda;
$("agendaSearch").oninput=()=>{clearTimeout(agendaSearchTimer);agendaSearchTimer=setTimeout(loadAgenda,180)};
$("agendaQuickFilters").onclick=e=>{const b=e.target.closest("[data-agenda-period]");if(!b)return;agendaDateFilter=b.dataset.agendaPeriod;loadAgenda()};
$("agendaListView").onclick=()=>{$("agendaList").classList.remove("hidden");$("agendaCalendar").classList.add("hidden");$("agendaListView").classList.add("active");$("agendaCalendarView").classList.remove("active")};
$("agendaCalendarView").onclick=()=>{$("agendaList").classList.add("hidden");$("agendaCalendar").classList.remove("hidden");$("agendaCalendarView").classList.add("active");$("agendaListView").classList.remove("active")};
function setAgendaComposer(open){const card=$("agendaCreateCard");card.classList.toggle("open",open);card.setAttribute("aria-hidden",String(!open));document.body.classList.toggle("agendaComposerOpen",open);if(open){card.scrollTop=0;setTimeout(()=>$("agendaTitle")?.focus(),30)}}
$("agendaOpenCreate").onclick=()=>setAgendaComposer(true);$("agendaOpenCreateToolbar").onclick=()=>setAgendaComposer(true);$("agendaCloseCreate").onclick=()=>setAgendaComposer(false);document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("agendaCreateCard")?.classList.contains("open"))setAgendaComposer(false)});
$("agendaStats").onclick=e=>{const b=e.target.closest("[data-agenda-filter]");if(!b)return;const value=b.dataset.agendaFilter;if(value==="today"){agendaDateFilter="today";$("agendaFilter").value="all"}else{agendaDateFilter="all";$("agendaFilter").value=value}loadAgenda()};
document.querySelectorAll('.nav[data-view="agenda"]').forEach(n=>n.addEventListener("click",()=>{if(window.__TPF_RESTORING)return;requestAnimationFrame(()=>{const sc=document.querySelector(".referenceWorkspace main");if(sc)sc.scrollTop=0})}));
$("agendaTypeChoices").onclick=e=>{const b=e.target.closest("[data-type]");if(b){agendaSelectedType=b.dataset.type;renderTypeChoices()}};
$("agendaManageTypes").onclick=()=>$("agendaTypeModal").classList.remove("hidden");$("agendaCloseTypes").onclick=()=>$("agendaTypeModal").classList.add("hidden");
$("agendaAddType").onclick=async()=>{const name=$("agendaNewTypeName").value.trim();if(!name)return;if(agendaTypes.some(t=>t.name.toLowerCase()===name.toLowerCase()))return alert("Ese tipo ya existe.");agendaTypes.push({name,icon:$("agendaNewTypeIcon").value,color:$("agendaNewTypeColor").value});await saveAgendaTypes();$("agendaNewTypeName").value=""};
$("agendaTypeList").onclick=async e=>{const b=e.target.closest("[data-remove-type]");if(b){agendaTypes.splice(Number(b.dataset.removeType),1);await saveAgendaTypes()}};
$("agendaList").onclick=e=>{const a=e.target.closest("[data-open-agenda]"),c=e.target.closest("[data-complete-agenda]"),m=e.target.closest("[data-more-agenda]");if(a)return openAgendaItem(a.dataset.openAgenda);if(c)return completeAgenda(c.dataset.completeAgenda);if(m){document.querySelector(".agendaPopMenu")?.remove();const id=m.dataset.moreAgenda,menu=document.createElement("div");menu.className="agendaPopMenu";menu.innerHTML='<button data-agenda-edit>Editar</button><button data-agenda-cancel>Cancelar recordatorio</button><button class="danger" data-agenda-delete>Eliminar</button>';document.body.appendChild(menu);const box=m.getBoundingClientRect();menu.style.left=Math.min(box.left,innerWidth-210)+"px";menu.style.top=(box.bottom+5)+"px";menu.onclick=ev=>{if(ev.target.closest("[data-agenda-edit]"))editAgendaItem(id);if(ev.target.closest("[data-agenda-cancel]"))cancelAgenda(id);if(ev.target.closest("[data-agenda-delete]"))deleteAgenda(id);menu.remove()}}};
$("agendaCustomer").oninput=()=>{delete $("agendaCustomer").dataset.contactId;clearTimeout(agendaSearchTimer);agendaSearchTimer=setTimeout(async()=>{const q=$("agendaCustomer").value.trim(),box=$("agendaCustomerResults");if(q.length<2){box.innerHTML="";return}const {data}=await sb.rpc("search_records",{search_text:q,sheet_filter:"BASE DE DATOS",result_limit:8});box.__rows=data||[];box.innerHTML=(data||[]).map((r,i)=>{const d=r.data||{},name=d["NOMBRE Y APELLIDOS"]||d.NOMBRE||d.CLIENTE||"Cliente",phone=d["TELÉFONO"]||d.TELEFONO||"",dni=d["DNI / NIF"]||d.DNI||"";return `<button type="button" class="agendaCustomerResult" data-customer-result="${i}"><b>${esc(name)}</b><small>${esc(phone)} ${esc(dni)}</small></button>`}).join("")},220)};
$("agendaCustomerResults").onclick=e=>{const b=e.target.closest("[data-customer-result]");if(!b)return;const r=$("agendaCustomerResults").__rows[Number(b.dataset.customerResult)]||{},d=r.data||{};$("agendaCustomer").value=d["NOMBRE Y APELLIDOS"]||d.NOMBRE||d.CLIENTE||"";$("agendaCustomer").dataset.contactId=r.id||"";$("agendaPhone").value=d["TELÉFONO"]||d.TELEFONO||"";$("agendaCustomerResults").innerHTML=""};
$("agendaSave").onclick=async()=>{const btn=$("agendaSave"),msg=$("agendaMsg");tpfSetSaving(btn,msg);if(!(perms?.is_admin||perms?.can_manage_agenda)){alert("No tienes permiso para crear recordatorios.");return tpfResetSaving(btn,msg)}const title=$("agendaTitle").value.trim(),starts=$("agendaStarts").value;if(!title||!starts){msg.textContent="Escribe un asunto y una fecha/hora.";return tpfResetSaving(btn,msg)}const {data:{user}}=await sb.auth.getUser(),row={title,agenda_type:agendaSelectedType,description:$("agendaDescription").value.trim()||null,customer_name:$("agendaCustomer").value.trim()||null,customer_phone:$("agendaPhone").value.trim()||null,related_record_id:$("agendaCustomer").dataset.contactId||null,starts_at:new Date(starts).toISOString(),reminder_at:$("agendaReminder").value?new Date($("agendaReminder").value).toISOString():null,assigned_to:user?.id||null,status:"pending",reminder_minutes:selectedAgendaReminderMinutes(),notify_in_app:$("agendaNotifyApp")?.checked??true,notify_email:$("agendaNotifyEmail")?.checked??false,sync_google_calendar:$("agendaSyncGoogle")?.checked??false};const {error}=await sb.from("agenda_items").insert(row);if(error)return tpfShowSaveError(btn,msg,error);["agendaTitle","agendaDescription","agendaCustomer","agendaPhone","agendaStarts","agendaReminder"].forEach(id=>$(id).value="");delete $("agendaCustomer").dataset.contactId;setAgendaComposer(false);await loadAgenda();tpfResetSaving(btn,msg,"Recordatorio guardado.")};
window.completeAgenda=async id=>{const {error}=await sb.from("agenda_items").update({status:"completed"}).eq("id",id);if(error)alert(error.message);else loadAgenda()};
window.cancelAgenda=async id=>{const {error}=await sb.from("agenda_items").update({status:"cancelled"}).eq("id",id);if(error)alert(error.message);else loadAgenda()};
window.deleteAgenda=async id=>{if(!confirm("¿Eliminar este recordatorio?"))return;const {error}=await sb.from("agenda_items").delete().eq("id",id);if(error)alert(error.message);else loadAgenda()};
loadAgendaTypes().catch(renderTypeChoices);
