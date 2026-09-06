/* Agenda Pro — compatible with the existing agenda_items model. */
const AGENDA_DEFAULT_TYPES=[{name:"Tarea",icon:"✓",color:"#155eef"},{name:"Llamada",icon:"☎",color:"#7f56d9"},{name:"Cita",icon:"◷",color:"#eaaa08"},{name:"WhatsApp",icon:"💬",color:"#16a34a"}];
let agendaTypes=[...AGENDA_DEFAULT_TYPES],agendaSelectedType="Tarea",agendaSearchTimer,agendaDateFilter="all",agendaComposerContext=null,agendaComposerMounts=[],agendaCalendarMonth=new Date(),agendaRenderedRows=[],agendaContactCache=new Map(),agendaLoadVersion=0;
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
function renderTypeChoices(){const e=$("agendaTypeChoices");if(e)e.innerHTML=agendaTypes.map(t=>`<button type="button" data-type="${esc(t.name)}" class="${t.name===agendaSelectedType?"active":""}" style="--type-color:${esc(t.color)}">${esc(t.icon)} ${esc(t.name)}</button>`).join("");renderAgendaCreateDetails()}
function renderTypeManager(){const e=$("agendaTypeList");if(e)e.innerHTML=agendaTypes.map((t,i)=>`<div class="agendaTypeRow"><span class="agendaTypeDot" style="background:${esc(t.color)}">${esc(t.icon)}</span><b>${esc(t.name)}</b><button class="secondary" data-remove-type="${i}" ${agendaTypes.length<2?"disabled":""}>Quitar</button></div>`).join("")}
function agendaTypeKey(value){return agendaSearchText(value).replace(/\s+/g,"")}
function ensureAgendaCreateDetails(){
  let host=$("agendaCreateDetails");
  if(host)return host;
  const choices=$("agendaTypeChoices");
  if(!choices)return null;
  host=document.createElement("div");host.id="agendaCreateDetails";host.className="agendaCreateDetails";
  choices.insertAdjacentElement("afterend",host);
  return host
}
function renderAgendaCreateDetails(meta={}){
  const host=ensureAgendaCreateDetails();if(!host)return;
  const key=agendaTypeKey(agendaSelectedType);
  if(key==="tarea")host.innerHTML='<div class="agendaTwo"><div><label for="agendaCreatePriority">Prioridad</label><select id="agendaCreatePriority"><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></div></div>';
  else if(key==="llamada")host.innerHTML='<div class="agendaTwo"><div><label for="agendaCreateDuration">Duración prevista</label><select id="agendaCreateDuration"><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">1 hora</option></select></div><div><label for="agendaCreateResult">Resultado</label><select id="agendaCreateResult"><option value="">Pendiente de llamar</option><option value="answered">Atendida</option><option value="no_answer">No contesta</option><option value="callback">Volver a llamar</option></select></div></div>';
  else if(key==="cita")host.innerHTML='<div class="agendaTwo"><div><label for="agendaCreateDuration">Duración</label><select id="agendaCreateDuration"><option value="30">30 minutos</option><option value="60">1 hora</option><option value="90">1 hora y media</option><option value="120">2 horas</option></select></div><div><label for="agendaCreateLocation">Lugar</label><input id="agendaCreateLocation" placeholder="Tienda, dirección o videollamada"></div></div>';
  else if(key==="whatsapp")host.innerHTML='<label for="agendaCreateWhatsappMessage">Mensaje de WhatsApp</label><textarea id="agendaCreateWhatsappMessage" rows="4" placeholder="Mensaje que se enviará"></textarea>';
  else host.innerHTML=`<label for="agendaCreateCustom">Información de ${esc(agendaSelectedType)}</label><textarea id="agendaCreateCustom" rows="3" placeholder="Añade los datos específicos de este tipo"></textarea>`;
  const set=(id,value)=>{const node=$(id);if(node&&value!=null)node.value=String(value)};
  set("agendaCreatePriority",meta.priority||"normal");set("agendaCreateDuration",meta.duration||"30");
  set("agendaCreateResult",meta.result||"");set("agendaCreateLocation",meta.location||"");
  set("agendaCreateWhatsappMessage",meta.whatsapp_message||"");set("agendaCreateCustom",meta.custom||"")
}
function agendaCreateMeta(){
  const value=id=>$(id)?.value?.trim?.()||"";
  const meta={priority:value("agendaCreatePriority"),duration:value("agendaCreateDuration"),result:value("agendaCreateResult"),location:value("agendaCreateLocation"),whatsapp_message:value("agendaCreateWhatsappMessage"),custom:value("agendaCreateCustom")};
  return Object.fromEntries(Object.entries(meta).filter(([,v])=>v!==""))
}
function selectAgendaType(type,meta={}){
  const wanted=String(type||"").trim(),found=agendaTypes.find(t=>agendaTypeKey(t.name)===agendaTypeKey(wanted));
  agendaSelectedType=found?.name||agendaTypes[0]?.name||"Tarea";renderTypeChoices();renderAgendaCreateDetails(meta)
}
window.sendAgendaWhatsapp=id=>{const r=(window.__agendaRows||[]).find(x=>String(x.id)===String(id));if(!r)return;const p=whatsappDigits(r.whatsapp_phone||r.customer_phone);if(!p)return alert("Esta tarea no tiene teléfono de WhatsApp.");window.open("https://wa.me/"+p+(r.whatsapp_message?"?text="+encodeURIComponent(r.whatsapp_message):""),"_blank","noopener,noreferrer")};
function agendaSearchText(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()}
function agendaSearchDigits(v){return String(v||"").replace(/\D/g,"").slice(-9)}
function agendaContactValues(row){const d=row?.data||{};return {id:String(row?.id||""),name:d["NOMBRE Y APELLIDOS"]||[d.NOMBRE,d.APELLIDOS].filter(Boolean).join(" ")||d.CLIENTE||"",phone:d["TELÉFONO"]||d.TELEFONO||d.PHONE||""}}
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
function renderItem(a){const t=typeFor(a),d=new Date(a.starts_at),state=a.status==="completed"?"completed":isOverdue(a)?"overdue":"";return `<article class="agendaItem"><time class="agendaTime">${d.toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"numeric"})}<small>${d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</small></time><span class="agendaTypeIcon" style="--type-color:${esc(t.color)}">${esc(a.status==="completed"?"✓":t.name==="Tarea"?"○":t.icon)}</span><div class="agendaItemTitle"><b>${esc(a.title)}</b><small>${esc(t.name)}${a.description?" · "+esc(a.description):""}</small></div><div class="agendaItemPerson">${a.__contact?`<button class="agendaContactLink" data-agenda-contact="${esc(a.__contact.id)}">${esc(a.customer_name||agendaContactValues(a.__contact).name)}</button>`:`<b>${esc(a.customer_name||"Sin cliente")}</b>`}<small>${esc(a.customer_phone||"")}</small><small>DNI/NIF: ${esc(agendaDni(a.__contact)||"Sin DNI")}</small></div><div class="agendaItemState"><span class="agendaBadge ${state}">${state==="overdue"?"Vencido":agendaStatusLabel(a.status)}</span><div class="agendaActions"><button data-open-agenda="${esc(a.id)}">Abrir</button>${a.status==="pending"?`<button data-postpone-agenda="${esc(a.id)}">Posponer</button><button class="agendaDone" data-complete-agenda="${esc(a.id)}">✓ Completar</button>`:""}<button class="agendaMore" data-more-agenda="${esc(a.id)}" aria-label="Más acciones">•••</button></div></div></article>`}
function renderList(rows){const groups=rows.reduce((a,r)=>((a[groupName(r)]||=[]).push(r),a),{});$("agendaList").innerHTML=["Vencidos","Hoy","Mañana","Próximos"].filter(k=>groups[k]?.length).map(k=>`<section class="agendaGroup"><h3 class="agendaGroupTitle">${k}<span>${groups[k].length} recordatorio${groups[k].length===1?"":"s"}</span></h3>${groups[k].map(renderItem).join("")}</section>`).join("")}
function renderCalendar(rows){
 agendaRenderedRows=rows;
 const n=agendaCalendarMonth,f=new Date(n.getFullYear(),n.getMonth(),1),s=new Date(f);s.setDate(f.getDate()-((f.getDay()+6)%7));
 let days="";
 for(let i=0;i<42;i++){const d=new Date(s);d.setDate(s.getDate()+i);const rs=rows.filter(r=>dayKey(r.starts_at)===dayKey(d));
 days+=`<div class="agendaDay ${d.getMonth()!==n.getMonth()?"muted":""} ${isToday(d)?"today":""}" data-agenda-day="${agendaLocalDateTime(d).slice(0,10)}"><button class="agendaDayNumber" data-agenda-day="${agendaLocalDateTime(d).slice(0,10)}" aria-label="Crear tarea el ${d.toLocaleDateString("es-ES")}">${d.getDate()}</button>${rs.map(r=>`<button class="agendaDayEvent" data-open-agenda="${esc(r.id)}">${new Date(r.starts_at).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})} ${esc(r.title)}<small>${esc(r.customer_name||"Sin cliente")}</small></button>`).join("")}</div>`;
 }
 $("agendaCalendar").innerHTML=`<div class="agendaMonthNav"><button data-agenda-month="-1" aria-label="Mes anterior">←</button><h3 class="agendaMonthTitle">${n.toLocaleDateString("es-ES",{month:"long",year:"numeric"})}</h3><button data-agenda-month="1" aria-label="Mes siguiente">→</button><button data-agenda-month="today">Hoy</button></div><div class="agendaCalendarGrid">${["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(x=>`<div class="agendaCalendarHead">${x}</div>`).join("")}${days}</div>`;
}
function agendaDni(record){const d=record?.data||{};return d["DNI / NIF"]||d["DNI/NIF"]||d.DNI||d.NIF||""}
async function agendaResolveContact(row){
 const id=String(row.related_record_id||""),phone=agendaSearchDigits(row.customer_phone);
 const key=id||phone;if(!key)return null;
 if(agendaContactCache.has(key))return agendaContactCache.get(key);
 const request=(async()=>{try{
  if(id){const r=await sb.from("records").select("id,data").eq("id",id).eq("source_sheet","BASE DE DATOS").maybeSingle();return r.error?null:r.data;}
  if(phone.length!==9)return null;
  const r=await sb.rpc("search_records",{search_text:phone,sheet_filter:"BASE DE DATOS",result_limit:20});
  const hits=(r.data||[]).filter(c=>agendaSearchDigits(agendaContactValues(c).phone)===phone);
  return !r.error&&r.data?.length<20&&hits.length===1?hits[0]:null;
 }catch(e){console.warn("Agenda: no se pudo consultar el contacto",e);return null;}})();
 agendaContactCache.set(key,request);return request;
}
$("agendaCalendar").onclick=e=>{
 const task=e.target.closest("[data-open-agenda]");if(task)return window.openAgendaItem(task.dataset.openAgenda);
 const nav=e.target.closest("[data-agenda-month]");if(nav){const v=nav.dataset.agendaMonth;agendaCalendarMonth=v==="today"?new Date():new Date(agendaCalendarMonth.getFullYear(),agendaCalendarMonth.getMonth()+Number(v),1);agendaDateFilter="all";return loadAgenda();}
 const day=e.target.closest("[data-agenda-day]");if(day)window.openAgendaComposer({startsAt:day.dataset.agendaDay+"T10:00"});
};
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
  const revision=++agendaLoadVersion;
  const status=$("agendaFilter")?.value||"pending",now=new Date();let range=agendaDateRange(agendaDateFilter,now);
  if(agendaDateFilter==="all"&&!$("agendaCalendar").classList.contains("hidden")){const start=new Date(agendaCalendarMonth.getFullYear(),agendaCalendarMonth.getMonth(),1);start.setDate(start.getDate()-((start.getDay()+6)%7));const end=new Date(start);end.setDate(end.getDate()+42);range={start,end};}
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
  if(revision!==agendaLoadVersion)return;
  if(one.error){$("agendaList").innerHTML=`<div class="agendaEmpty">${esc(one.error.message)}</div>`;return}
  const rows=visibleRows(one.data||[],contacts?.data||[]);
  agendaContactCache.clear();await Promise.all(rows.map(async row=>{row.__contact=await agendaResolveContact(row)}));
  if(revision!==agendaLoadVersion)return;
  window.__agendaRows=one.data||[];
  updateStats(two.data||[]);
  $("agendaEmpty").style.display=rows.length?"none":"block";
  renderList(rows);renderCalendar(rows)
}
$("agendaFilter").onchange=loadAgenda;
$("agendaRefresh").onclick=loadAgenda;
$("agendaSearch").oninput=()=>{clearTimeout(agendaSearchTimer);agendaSearchTimer=setTimeout(loadAgenda,180)};
$("agendaQuickFilters").onclick=e=>{const b=e.target.closest("[data-agenda-period]");if(!b)return;agendaDateFilter=b.dataset.agendaPeriod;loadAgenda()};
$("agendaListView").onclick=()=>{$("agendaList").classList.remove("hidden");$("agendaCalendar").classList.add("hidden");$("agendaListView").classList.add("active");$("agendaCalendarView").classList.remove("active");loadAgenda()};
$("agendaCalendarView").onclick=()=>{$("agendaList").classList.add("hidden");$("agendaCalendar").classList.remove("hidden");$("agendaCalendarView").classList.add("active");$("agendaListView").classList.remove("active");loadAgenda()};
function agendaLocalDateTime(value){const d=value instanceof Date?value:new Date(value);if(Number.isNaN(d.getTime()))return"";const p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}
// Calendar shortcuts use local dates and keep the selected time editable.
function agendaQuickDate(kind,now=new Date()){
  const date=new Date(now.getTime());
  if(kind==='tomorrow')date.setDate(date.getDate()+1);
  else if(kind==='monday')date.setDate(date.getDate()+((1-date.getDay()+7)%7||7));
  date.setHours(10,0,0,0);return date;
}
document.getElementById('agendaDateShortcuts')?.addEventListener('click',event=>{
  const button=event.target.closest('[data-agenda-quick-date]');if(!button)return;
  const input=document.getElementById('agendaStarts');
  input.value=agendaLocalDateTime(agendaQuickDate(button.dataset.agendaQuickDate));
  input.__tpfSyncFromHidden?.();input.dispatchEvent(new Event('change',{bubbles:true}));
});
function mountAgendaComposerOverlay(enable){
  if(enable&&!agendaComposerMounts.length){
    [$("agendaCreateCard"),$("agendaTypeModal")].filter(Boolean).forEach(node=>{agendaComposerMounts.push({node,parent:node.parentNode,next:node.nextSibling});document.body.appendChild(node)});
    $("agendaCreateCard")?.setAttribute("data-agenda-overlay","true")
  }else if(!enable&&agendaComposerMounts.length){
    agendaComposerMounts.splice(0).forEach(({node,parent,next})=>{if(parent)parent.insertBefore(node,next&&next.parentNode===parent?next:null)});
    $("agendaCreateCard")?.removeAttribute("data-agenda-overlay")
  }
}
function setAgendaComposer(open){window.TPFAgendaCompact?.create(open);const card=$("agendaCreateCard");card.classList.toggle("open",open);card.setAttribute("aria-hidden",String(!open));window.dispatchEvent(new CustomEvent("tpf:editor-baseline",{detail:{root:card}}));document.body.classList.toggle("agendaComposerOpen",open);if(open){card.scrollTop=0;setTimeout(()=>$("agendaTitle")?.focus(),30)}else{$("agendaTypeModal")?.classList.add("hidden");mountAgendaComposerOverlay(false)}}
function resetAgendaComposer(){
  ["agendaTitle","agendaDescription","agendaCustomer","agendaPhone","agendaStarts","agendaReminder"].forEach(id=>{const node=$(id);if(node)node.value=""});
  delete $("agendaCustomer")?.dataset.contactId;document.querySelectorAll(".agendaReminderPreset").forEach(box=>box.checked=false);
  if($("agendaNotifyApp"))$("agendaNotifyApp").checked=true;if($("agendaNotifyEmail"))$("agendaNotifyEmail").checked=false;if($("agendaSyncGoogle"))$("agendaSyncGoogle").checked=false;
  selectAgendaType("Tarea",{});$("agendaStarts")?.__tpfSyncFromHidden?.();$("agendaReminder")?.__tpfSyncFromHidden?.()
}
let agendaEditingRow=null;
function fillAgendaComposer(prefill={}){
  resetAgendaComposer();
  if(!agendaEditingRow)prefill={...(window.TPFAgendaDefaults?.get()||{}),...prefill};
  const set=(id,value)=>{const node=$(id);if(node&&value!=null)node.value=String(value)};
  set("agendaTitle",prefill.title||"");set("agendaDescription",prefill.description||prefill.notes||"");
  set("agendaCustomer",prefill.customerName||prefill.customer_name||"");set("agendaPhone",prefill.phone||prefill.customerPhone||prefill.customer_phone||"");
  set("agendaStarts",prefill.startsAt||prefill.starts_at?agendaLocalDateTime(prefill.startsAt||prefill.starts_at):agendaLocalDateTime(agendaQuickDate("today")));
  set("agendaReminder",prefill.reminderAt||prefill.reminder_at?agendaLocalDateTime(prefill.reminderAt||prefill.reminder_at):"");
  const contactId=prefill.contactId||prefill.related_record_id;if(contactId)$("agendaCustomer").dataset.contactId=String(contactId);
  if($("agendaNotifyApp"))$("agendaNotifyApp").checked=prefill.notifyInApp??prefill.notify_in_app??true;
  if($("agendaNotifyEmail"))$("agendaNotifyEmail").checked=prefill.notifyEmail??prefill.notify_email??false;
  if($("agendaSyncGoogle"))$("agendaSyncGoogle").checked=prefill.syncGoogle??prefill.sync_google_calendar??false;
  const minutes=new Set((prefill.reminderMinutes||prefill.reminder_minutes||[]).map(String));document.querySelectorAll(".agendaReminderPreset").forEach(box=>box.checked=minutes.has(String(box.value)));
  selectAgendaType(prefill.type||prefill.agenda_type||"Tarea",prefill.meta||prefill.agenda_meta||{});
  $("agendaStarts")?.__tpfSyncFromHidden?.();$("agendaReminder")?.__tpfSyncFromHidden?.()
}
function runAgendaComposerCallback(name,payload){const fn=agendaComposerContext?.[name];agendaComposerContext=null;if(typeof fn==="function")Promise.resolve(fn(payload)).catch(err=>console.warn("Agenda: retorno del compositor",err))}
function closeAgendaComposer(){setAgendaComposer(false);runAgendaComposerCallback("onCancel")}
window.openAgendaComposer=(prefill={},returnOrigin={})=>{agendaEditingRow=returnOrigin.row||null;agendaComposerContext=returnOrigin||{};if(prefill.overlay||returnOrigin?.overlay)mountAgendaComposerOverlay(true);fillAgendaComposer(prefill);setAgendaComposer(true);syncAgendaEditor();return true};
window.TPFAgendaComposer={open:window.openAgendaComposer,close(options={}){if(options.silent){agendaComposerContext=null;setAgendaComposer(false)}else closeAgendaComposer()},selectType:selectAgendaType};
$("agendaOpenCreate").onclick=()=>{agendaEditingRow=null;agendaComposerContext=null;fillAgendaComposer({});setAgendaComposer(true);syncAgendaEditor()};$("agendaOpenCreateToolbar").onclick=()=>{agendaEditingRow=null;agendaComposerContext=null;fillAgendaComposer({});setAgendaComposer(true);syncAgendaEditor()};$("agendaCloseCreate").onclick=closeAgendaComposer;document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("agendaCreateCard")?.classList.contains("open"))closeAgendaComposer()});
$("agendaStats").onclick=e=>{const b=e.target.closest("[data-agenda-filter]");if(!b)return;const value=b.dataset.agendaFilter;if(value==="today"){agendaDateFilter="today";$("agendaFilter").value="all"}else{agendaDateFilter="all";$("agendaFilter").value=value}loadAgenda()};
document.querySelectorAll('.nav[data-view="agenda"]').forEach(n=>n.addEventListener("click",()=>{if(window.__TPF_RESTORING)return;requestAnimationFrame(()=>{const sc=document.querySelector(".referenceWorkspace main");if(sc)sc.scrollTop=0})}));
$("agendaTypeChoices").onclick=e=>{const b=e.target.closest("[data-type]");if(b)selectAgendaType(b.dataset.type,{})};
$("agendaManageTypes").onclick=()=>$("agendaTypeModal").classList.remove("hidden");$("agendaCloseTypes").onclick=()=>$("agendaTypeModal").classList.add("hidden");
$("agendaAddType").onclick=async()=>{const name=$("agendaNewTypeName").value.trim();if(!name)return;if(agendaTypes.some(t=>t.name.toLowerCase()===name.toLowerCase()))return alert("Ese tipo ya existe.");agendaTypes.push({name,icon:$("agendaNewTypeIcon").value,color:$("agendaNewTypeColor").value});await saveAgendaTypes();$("agendaNewTypeName").value=""};
$("agendaTypeList").onclick=async e=>{const b=e.target.closest("[data-remove-type]");if(b){agendaTypes.splice(Number(b.dataset.removeType),1);await saveAgendaTypes()}};
$("agendaList").onclick=e=>{const a=e.target.closest("[data-open-agenda]"),c=e.target.closest("[data-complete-agenda]"),m=e.target.closest("[data-more-agenda]");if(a)return openAgendaItem(a.dataset.openAgenda);if(c)return completeAgenda(c.dataset.completeAgenda);if(m){document.querySelector(".agendaPopMenu")?.remove();const id=m.dataset.moreAgenda,menu=document.createElement("div");menu.className="agendaPopMenu";menu.innerHTML='<button data-agenda-edit>Editar</button><button data-agenda-cancel>Cancelar recordatorio</button><button class="danger" data-agenda-delete>Eliminar</button>';document.body.appendChild(menu);const box=m.getBoundingClientRect();menu.style.left=Math.min(box.left,innerWidth-210)+"px";menu.style.top=(box.bottom+5)+"px";menu.onclick=ev=>{if(ev.target.closest("[data-agenda-edit]"))editAgendaItem(id);if(ev.target.closest("[data-agenda-cancel]"))cancelAgenda(id);if(ev.target.closest("[data-agenda-delete]"))deleteAgenda(id);menu.remove()}}};
$("agendaCustomer").oninput=()=>{delete $("agendaCustomer").dataset.contactId;clearTimeout(agendaSearchTimer);agendaSearchTimer=setTimeout(async()=>{const q=$("agendaCustomer").value.trim(),box=$("agendaCustomerResults");if(q.length<2){box.innerHTML="";return}const {data}=await sb.rpc("search_records",{search_text:q,sheet_filter:"BASE DE DATOS",result_limit:8});box.__rows=data||[];box.innerHTML=(data||[]).map((r,i)=>{const d=r.data||{},name=d["NOMBRE Y APELLIDOS"]||d.NOMBRE||d.CLIENTE||"Cliente",phone=d["TELÉFONO"]||d.TELEFONO||"",dni=d["DNI / NIF"]||d.DNI||"";return `<button type="button" class="agendaCustomerResult" data-customer-result="${i}"><b>${esc(name)}</b><small>${esc(phone)} ${esc(dni)}</small></button>`}).join("")},220)};
$("agendaCustomerResults").onclick=e=>{const b=e.target.closest("[data-customer-result]");if(!b)return;const r=$("agendaCustomerResults").__rows[Number(b.dataset.customerResult)]||{},d=r.data||{};$("agendaCustomer").value=d["NOMBRE Y APELLIDOS"]||d.NOMBRE||d.CLIENTE||"";$("agendaCustomer").dataset.contactId=r.id||"";$("agendaPhone").value=d["TELÉFONO"]||d.TELEFONO||"";$("agendaCustomerResults").innerHTML=""};
function syncAgendaEditor(){
  const card=$("agendaCreateCard"),heading=card.querySelector('.agendaComposerHead h2,.agendaComposerHead h3');
  if(heading)heading.textContent=agendaEditingRow?'Editar recordatorio':'Crear recordatorio';
  $("agendaSave").textContent=agendaEditingRow?'Guardar cambios':'Crear tarea';
  let status=$("agendaEditStatus");if(!status){const label=document.createElement('label');label.textContent='Estado';status=document.createElement('select');status.id='agendaEditStatus';status.innerHTML='<option value="pending">Pendiente</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option>';label.appendChild(status);($("agendaCreateDetails")||card).after(label);}
  status.parentElement.hidden=!agendaEditingRow;status.value=agendaEditingRow?.status||'pending';
  $("agendaMsg").textContent='';
}
window.TPFRefreshTasks=async()=>{
  const jobs=[];
  if(typeof loadAgenda==='function'&&!$("view-agenda")?.classList.contains('hidden'))jobs.push(loadAgenda());
  if(typeof currentContact!=='undefined'&&currentContact&&!$("contactModal")?.classList.contains('hidden'))jobs.push(renderContactProfile());
  if(typeof loadWaContactSideData==='function'&&!$("view-whatsapplive")?.classList.contains('hidden'))jobs.push(loadWaContactSideData());
  const results=await Promise.allSettled(jobs);for(const r of results)if(r.status==='rejected')console.warn('No se pudo actualizar una vista de tareas',r.reason);
  window.dispatchEvent(new CustomEvent('tpf:tasks-changed'));
};
$("agendaSave").onclick=async()=>{
  const btn=$("agendaSave"),msg=$("agendaMsg");if(btn.disabled)return;
  const editing=agendaEditingRow,context=agendaComposerContext;
  tpfSetSaving(btn,msg);
  try{
    const {data:{user}}=await sb.auth.getUser(),meta=agendaCreateMeta();
    const row={title:$("agendaTitle").value.trim(),agenda_type:agendaSelectedType,agenda_meta:meta,description:$("agendaDescription").value,customer_name:$("agendaCustomer").value,customer_phone:$("agendaPhone").value,related_record_id:$("agendaCustomer").dataset.contactId||null,starts_at:$("agendaStarts").value,reminder_at:$("agendaReminder").value||null,status:editing?$("agendaEditStatus").value:'pending',reminder_minutes:selectedAgendaReminderMinutes(),notify_in_app:$("agendaNotifyApp")?.checked??true,notify_email:$("agendaNotifyEmail")?.checked??false,sync_google_calendar:$("agendaSyncGoogle")?.checked??false};
    if(agendaTypeKey(agendaSelectedType)==='whatsapp'){row.whatsapp_enabled=true;row.whatsapp_phone=row.customer_phone;row.whatsapp_message=meta.whatsapp_message||null;row.whatsapp_scheduled_at=row.starts_at;}
    const saved=await window.TPFTaskModel.save(sb,row,{id:editing?.id,previous:editing||{},canManage:!!(perms?.is_admin||perms?.can_manage_agenda),userId:user?.id,allowScheduled:true});
    agendaComposerContext=null;agendaEditingRow=null;resetAgendaComposer();setAgendaComposer(false);
    tpfResetSaving(btn,msg,'Recordatorio guardado.');
    const refresh=await Promise.allSettled([Promise.resolve().then(()=>context?.onSaved?.(saved)),window.TPFRefreshTasks()]);
    if(refresh.some(r=>r.status==='rejected'))console.warn('La tarea se guardó, pero no se pudo actualizar una vista.');
  }catch(error){tpfShowSaveError(btn,msg,error);}
};
window.completeAgenda=async id=>{const {error}=await sb.from("agenda_items").update({status:"completed"}).eq("id",id);if(error)alert(error.message);else window.TPFRefreshTasks()};
window.cancelAgenda=async id=>{const {error}=await sb.from("agenda_items").update({status:"cancelled"}).eq("id",id);if(error)alert(error.message);else window.TPFRefreshTasks()};
window.deleteAgenda=async id=>{if(!confirm("¿Eliminar este recordatorio?"))return;const {error}=await sb.from("agenda_items").delete().eq("id",id);if(error)alert(error.message);else window.TPFRefreshTasks()};
loadAgendaTypes().catch(renderTypeChoices);

for(const name of ['tpf:contact-updated','tpf:contact-created','tpf:contacts-loaded'])window.addEventListener(name,()=>{window.TPFRecordLinks.invalidate(sb);agendaContactCache.clear();});
