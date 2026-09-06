/* Agenda detail by type — isolated enhancement. */
(()=>{
  const $id=id=>document.getElementById(id);
  const escHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const labels={Tarea:"Ficha de tarea",Llamada:"Ficha de llamada",Cita:"Ficha de cita",WhatsApp:"Ficha de WhatsApp"};
  let openMenuId=null,activeRow=null;

  function allTypes(){
    const buttons=[...document.querySelectorAll("#agendaTypeChoices [data-type]")].map(b=>({name:b.dataset.type,icon:(b.textContent||"").trim().split(/\s+/)[0]}));
    return buttons.length?buttons:[{name:"Tarea",icon:"✓"},{name:"Llamada",icon:"☎"},{name:"Cita",icon:"◷"},{name:"WhatsApp",icon:"💬"}];
  }
  function ensureEditor(){
    const title=$id("cpTaskDetailTitle");
    if(!title||$id("agendaDetailProFields"))return;
    const host=title.closest(".cpTaskFormCard");
    const type=document.createElement("div");
    type.className="agendaDetailSection";
    type.id="agendaDetailProFields";
    type.innerHTML=`
      <div class="agendaDetailSectionTitle">Tipo de recordatorio</div>
      <div id="agendaDetailTypes" class="agendaDetailTypes"></div>
      <div class="agendaDetailGrid">
        <label>Cliente<input id="agendaDetailCustomer" placeholder="Nombre del cliente"></label>
        <label>Teléfono<input id="agendaDetailPhone" inputmode="tel" placeholder="Teléfono"></label>
      </div>
      <div id="agendaDetailDynamic"></div>`;
    title.parentElement.insertBefore(type,title.parentElement.firstChild.nextSibling);
    $id("agendaDetailTypes").onclick=e=>{
      const b=e.target.closest("[data-agenda-detail-type]");
      if(!b)return;
      renderType(b.dataset.agendaDetailType,{});
    };
  }
  function renderType(type,meta={}){
    const safeType=type||"Tarea";
    $id("agendaDetailTypes").innerHTML=allTypes().map(t=>`<button type="button" data-agenda-detail-type="${escHtml(t.name)}" class="${t.name===safeType?"active":""}">${escHtml(t.icon||"•")} ${escHtml(t.name)}</button>`).join("");
    $id("agendaDetailTypes").dataset.selected=safeType;
    const d=$id("agendaDetailDynamic");
    if(safeType==="Tarea")d.innerHTML=`<div class="agendaDetailGrid"><label>Prioridad<select id="agendaDetailPriority"><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><label>Estado<select id="agendaDetailState"><option value="pending">Pendiente</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option></select></label></div>`;
    else if(safeType==="Llamada")d.innerHTML=`<div class="agendaDetailGrid"><label>Duración prevista<select id="agendaDetailDuration"><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">1 hora</option></select></label><label>Resultado<select id="agendaDetailResult"><option value="">Sin indicar</option><option value="pending">Pendiente de llamar</option><option value="answered">Atendida</option><option value="no_answer">No contesta</option><option value="callback">Volver a llamar</option></select></label></div>`;
    else if(safeType==="Cita")d.innerHTML=`<div class="agendaDetailGrid"><label>Duración<select id="agendaDetailDuration"><option value="30">30 minutos</option><option value="60">1 hora</option><option value="90">1 hora y media</option><option value="120">2 horas</option></select></label><label>Lugar<input id="agendaDetailLocation" placeholder="Tienda, dirección o videollamada"></label></div>`;
    else if(safeType==="WhatsApp")d.innerHTML=`<label>Mensaje de WhatsApp<textarea id="agendaDetailWhatsappMessage" rows="4" placeholder="Mensaje que se enviará"></textarea></label><div class="agendaDetailStatus">Estado del envío: <b id="agendaDetailDelivery">Pendiente</b></div>`;
    else d.innerHTML=`<label>Información adicional<textarea id="agendaDetailCustom" rows="3" placeholder="Datos de ${escHtml(safeType)}"></textarea></label>`;
    const set=(id,v)=>{const e=$id(id);if(e)e.value=v??""};
    set("agendaDetailPriority",meta.priority||"normal"); set("agendaDetailDuration",meta.duration||"30");
    set("agendaDetailResult",meta.result||""); set("agendaDetailLocation",meta.location||"");
    set("agendaDetailWhatsappMessage",meta.whatsapp_message||""); set("agendaDetailCustom",meta.custom||"");
    if($id("agendaDetailState"))$id("agendaDetailState").value=activeRow?.status||"pending";
    if($id("agendaDetailDelivery"))$id("agendaDetailDelivery").textContent=activeRow?.whatsapp_delivery_status||"Pendiente";
    const heading=$id("cpTaskDetailHeading");if(heading)heading.textContent=labels[safeType]||("Ficha de "+safeType.toLowerCase());
  }
  function metaFromForm(){
    const val=id=>$id(id)?.value||"";
    return {priority:val("agendaDetailPriority")||undefined,duration:val("agendaDetailDuration")||undefined,result:val("agendaDetailResult")||undefined,location:val("agendaDetailLocation")||undefined,whatsapp_message:val("agendaDetailWhatsappMessage")||undefined,custom:val("agendaDetailCustom")||undefined};
  }
  function clean(o){return Object.fromEntries(Object.entries(o).filter(([,v])=>v!==undefined&&v!==""))}

  function showTaskShell(standalone){
    const modal=$id("contactModal");
    modal?.classList.remove("hidden");
    $id("cpTaskPage")?.classList.remove("hidden");
    $id("cpTaskDetailPage")?.classList.remove("hidden");
    if(standalone){
      modal?.classList.add("tpfTaskStandalone");
      document.body.classList.add("agendaDetailOpen");
      window.TPFAgendaCompact?.detail(true);
      const columns=document.querySelector("#contactModal .cpColumns");if(columns)columns.style.display="none";
      const top=document.querySelector("#contactModal .cpTop");if(top)top.style.display="none";
    }
  }
  function cleanupTaskShell(){
    window.TPFAgendaCompact?.detail(false);
    const modal=$id("contactModal");
    modal?.classList.remove("tpfTaskStandalone");
    document.body.classList.remove("agendaDetailOpen");
    const columns=document.querySelector("#contactModal .cpColumns");if(columns)columns.style.display="";
    const top=document.querySelector("#contactModal .cpTop");if(top)top.style.display="";
  }

  const originalOpen=window.openContactTaskDetail;
  const detailVisibility=new MutationObserver(()=>{if($id("cpTaskDetailPage")?.classList.contains("hidden")&&document.body.classList.contains("agendaDetailOpen"))cleanupTaskShell()});
  if($id("cpTaskDetailPage"))detailVisibility.observe($id("cpTaskDetailPage"),{attributes:true,attributeFilter:["class"]});
  window.openContactTaskDetail=async id=>{
    if(typeof originalOpen!=="function"){alert("No está disponible la ficha de tarea.");return}
    const modal=$id("contactModal");
    const standalone=!!modal?.classList.contains("hidden")||!$id("view-agenda")?.classList.contains("hidden");
    await originalOpen(id);
    showTaskShell(standalone);
    ensureEditor();
    const {data:row,error}=await sb.from("agenda_items").select("*").eq("id",id).single();
    if(error){$id("cpTaskDetailMsg").textContent=error.message;return}
    activeRow=row;
    if(!row)return;
    $id("agendaDetailCustomer").value=row.customer_name||"";
    $id("agendaDetailPhone").value=row.customer_phone||"";
    renderType(row.agenda_type||"Tarea",row.agenda_meta||{});
    window.TPFAgendaCompact?.syncDetail(row,standalone);
  };
  window.editAgendaItem=id=>window.openContactTaskDetail(id);
  window.openAgendaItem=id=>window.openContactTaskDetail(id);

  const back=$id("cpTaskDetailBack"),originalBack=back?.onclick;
  if(back)back.onclick=async function(e){try{if(typeof originalBack==="function")await originalBack.call(this,e);else $id("cpTaskDetailPage")?.classList.add("hidden")}finally{cleanupTaskShell()}};
  const remove=$id("cpTaskDelete"),originalDelete=remove?.onclick;
  if(remove)remove.onclick=async function(e){if(typeof originalDelete==="function")await originalDelete.call(this,e);if($id("cpTaskDetailPage")?.classList.contains("hidden"))cleanupTaskShell()};

  const save=$id("cpTaskDetailSave");
  if(save)save.onclick=async()=>{
    const row=activeRow;
    if(!row)return;
    const title=$id("cpTaskDetailTitle").value.trim(),starts=$id("cpTaskDetailStarts").value;
    if(!title||!starts){$id("cpTaskDetailMsg").textContent="Escribe un asunto y una fecha/hora.";return}
    save.disabled=true;$id("cpTaskDetailMsg").textContent="Guardando…";
    const type=$id("agendaDetailTypes")?.dataset.selected||row.agenda_type||"Tarea";
    const status=$id("agendaDetailState")?.value||row.status;
    const payload={title,agenda_type:type,agenda_meta:clean(metaFromForm()),customer_name:$id("agendaDetailCustomer")?.value.trim()||null,customer_phone:$id("agendaDetailPhone")?.value.trim()||null,description:$id("cpTaskDetailNotes").value.trim()||null,starts_at:new Date(starts).toISOString(),reminder_at:$id("cpTaskDetailReminder").value?new Date($id("cpTaskDetailReminder").value).toISOString():null,notify_in_app:$id("cpTaskDetailNotifyApp").checked,notify_email:$id("cpTaskDetailNotifyEmail").checked,sync_google_calendar:$id("cpTaskDetailGoogle").checked,status};
    if(type==="WhatsApp"){payload.whatsapp_enabled=true;payload.whatsapp_phone=payload.customer_phone;payload.whatsapp_message=$id("agendaDetailWhatsappMessage")?.value.trim()||null;payload.whatsapp_scheduled_at=payload.starts_at}
    try{
      const {data,error}=await sb.from("agenda_items").update(payload).eq("id",row.id).select("*").single();
      if(error)throw error;
      activeRow=data;$id("cpTaskDetailMsg").textContent="Cambios guardados correctamente";
      $id("cpTaskDetailStatus").textContent=data.status==="completed"?"Completada":data.status==="cancelled"?"Cancelada":"Pendiente";
      $id("cpTaskMarkDone").classList.toggle("hidden",data.status==="completed");
      $id("cpTaskReopen").classList.toggle("hidden",data.status!=="completed");
      if(typeof loadAgenda==="function")await loadAgenda();
      if(document.body.classList.contains("agendaDetailOpen"))$id("cpTaskDetailBack")?.click();
    }catch(e){$id("cpTaskDetailMsg").textContent=e?.message||"No se pudieron guardar los cambios"}finally{save.disabled=false}
  };

  async function awaitPostpone(id){await window.openContactTaskDetail(id);$id("cpTaskDetailStarts")?.focus();}
  function closeMenu(){document.querySelector(".agendaPopMenu")?.remove();openMenuId=null}
  const list=$id("agendaList");
  if(list)list.onclick=e=>{
    const person=e.target.closest("[data-agenda-contact]");if(person)return window.openContact?.(person.dataset.agendaContact);
    const postpone=e.target.closest("[data-postpone-agenda]");if(postpone){awaitPostpone(postpone.dataset.postponeAgenda);return;}
    const a=e.target.closest("[data-open-agenda]"),c=e.target.closest("[data-complete-agenda]"),m=e.target.closest("[data-more-agenda]");
    if(a){closeMenu();return window.openContactTaskDetail(a.dataset.openAgenda)}
    if(c){closeMenu();return window.completeAgenda(c.dataset.completeAgenda)}
    if(!m)return;
    const id=m.dataset.moreAgenda;
    if(openMenuId===id){closeMenu();return}
    closeMenu();openMenuId=id;
    const menu=document.createElement("div");menu.className="agendaPopMenu";menu.innerHTML='<button data-agenda-edit>Editar</button><button data-agenda-cancel>Cancelar recordatorio</button><button class="danger" data-agenda-delete>Eliminar</button>';
    document.body.appendChild(menu);const b=m.getBoundingClientRect();menu.style.left=Math.min(b.left,innerWidth-215)+"px";menu.style.top=Math.min(b.bottom+5,innerHeight-menu.offsetHeight-8)+"px";
    menu.onclick=ev=>{if(ev.target.closest("[data-agenda-edit]"))window.editAgendaItem(id);else if(ev.target.closest("[data-agenda-cancel]"))window.cancelAgenda(id);else if(ev.target.closest("[data-agenda-delete]"))window.deleteAgenda(id);closeMenu()};
    setTimeout(()=>document.addEventListener("click",ev=>{if(!menu.contains(ev.target)&&ev.target!==m)closeMenu()},{once:true}),0);
  };
})();

/* Agenda-only compact shells. Existing fields and handlers are retained. */
(()=>{
 const $=id=>document.getElementById(id);
 let createState=null,detailState=null,focusOrigin=null;
 function rememberMove(state,node,parent){if(!node)return;state.moves.push({node,parent:node.parentNode,next:node.nextSibling});parent.appendChild(node)}
 function restore(state){if(!state)return;state.moves.reverse().forEach(({node,parent,next})=>parent?.insertBefore(node,next?.parentNode===parent?next:null));state.extra.forEach(node=>node.remove())}
 function reminder(state,id){
  const input=$(id),box=id==="agendaReminder"?input?.parentElement:input?.closest("label");if(!box)return;
  const label=document.createElement("label");label.className="agendaExtraCheck";
  const check=document.createElement("input");check.type="checkbox";check.checked=!!input.value;label.append(check,document.createTextNode(" Añadir otro aviso"));box.before(label);state.extra.push(label);
  let previous=input.value;
  const sync=()=>{box.classList.toggle("agendaOptionalHidden",!check.checked)};
  check.onchange=()=>{if(!check.checked){previous=input.value;input.value=""}else input.value=previous;input.__tpfSyncFromHidden?.();sync()};
  sync();state.reminder={check,box,input,sync};
 }
 function options(state,host,nodes){
  const details=document.createElement("details");details.className="agendaCompactOptions";
  const summary=document.createElement("summary");summary.textContent="Más opciones";details.appendChild(summary);host.appendChild(details);state.extra.push(details);
  nodes.filter(Boolean).forEach(n=>rememberMove(state,n,details));
 }
 function create(open){
  if(!open){if(createState){const state=createState;state.reminder?.box.classList.remove("agendaOptionalHidden");restore(state);state.parent.insertBefore(state.card,state.next?.parentNode===state.parent?state.next:null);state.back.remove();createState=null;focusOrigin?.focus?.();}return}
  const card=$("agendaCreateCard");if(createState||card?.dataset.contactDialog==="true"||$("view-agenda")?.classList.contains("hidden"))return;
  focusOrigin=document.activeElement;
  const state={card,parent:card.parentNode,next:card.nextSibling,moves:[],extra:[]};createState=state;
  const back=document.createElement("div");back.className="agendaCompactBackdrop";back.setAttribute("role","dialog");back.setAttribute("aria-modal","true");back.setAttribute("aria-label","Crear tarea");state.back=back;
  const head=card.querySelector(".agendaComposerHead"),save=$("agendaSave"),msg=$("agendaMsg");
  const body=document.createElement("div");body.className="agendaCompactBody";
  const footer=document.createElement("div");footer.className="agendaCompactFooter";
  [...card.children].filter(n=>n!==head&&n!==save&&n!==msg).forEach(n=>rememberMove(state,n,body));
  card.append(body,footer);state.extra.push(body,footer);
  const cancel=document.createElement("button");cancel.type="button";cancel.className="secondary";cancel.textContent="Cancelar";cancel.onclick=()=>window.TPFAgendaComposer.close();footer.appendChild(cancel);
  rememberMove(state,msg,footer);rememberMove(state,save,footer);
  const dni=document.createElement("small");dni.id="agendaCompactDni";dni.className="agendaCompactDni";$("agendaPhone").after(dni);state.extra.push(dni);
  options(state,body,[$("agendaCreateDetails"),$("agendaManageTypes"),body.querySelector('label[for="agendaDescription"]'),$("agendaDescription"),body.querySelector(".agendaOptions")]);
  reminder(state,"agendaReminder");
  back.appendChild(card);document.body.appendChild(back);refreshCreateDni();
 }
 async function refreshCreateDni(){
  const node=$("agendaCompactDni");if(!node)return;
  node.textContent="DNI/NIF: —";
  const id=$("agendaCustomer")?.dataset.contactId;
  if(!id){node.textContent="Selecciona un contacto para ver su DNI";return}
  const record=await agendaResolveContact({related_record_id:id});
  if(node.isConnected&&$("agendaCustomer")?.dataset.contactId===id)node.textContent="DNI/NIF: "+(agendaDni(record)||"Sin DNI");
 }
 function detail(open){
  if(!open){if(detailState){detailState.reminder?.box.classList.remove("agendaOptionalHidden");restore(detailState);detailState=null;}return}
  if(detailState)return;
  const page=$("cpTaskDetailPage"),state={moves:[],extra:[]};detailState=state;
  rememberMove(state,page,$("contactModal"));
  const footer=document.createElement("div");footer.className="agendaCompactFooter";page.appendChild(footer);state.extra.push(footer);
  rememberMove(state,$("cpTaskDetailBack"),footer);rememberMove(state,$("cpTaskDetailSave"),footer);
 }
 async function syncDetail(row,standalone){
  if(!standalone||!detailState)return;
  const state=detailState;
  if(!state.reminder)reminder(state,"cpTaskDetailReminder");
  state.reminder.check.checked=!!$("cpTaskDetailReminder").value;state.reminder.sync();
  let dni=$("agendaDetailDni");if(!dni){dni=document.createElement("small");dni.id="agendaDetailDni";$("agendaDetailPhone").parentElement.appendChild(dni);state.extra.push(dni);}
  dni.textContent="DNI/NIF: —";
  if(!state.options){const host=$("cpTaskDetailTitle").closest(".cpTaskFormCard"),notes=$("cpTaskDetailNotes");options(state,host,[$("agendaDetailDynamic"),notes.previousElementSibling,notes,host.querySelector(".cpTaskOptions")]);state.options=true;}
  const record=await agendaResolveContact(row);
  if(dni.isConnected&&$("cpTaskDetailId")?.value===String(row.id))dni.textContent="DNI/NIF: "+(agendaDni(record)||"Sin DNI");
 }
 document.addEventListener("click",e=>{if(e.target.closest("#agendaCustomerResults"))setTimeout(refreshCreateDni,0)});
 $("agendaCustomer")?.addEventListener("input",refreshCreateDni);
 document.addEventListener("keydown",e=>{
  const dialog=createState?.back||(!document.body.classList.contains("agendaDetailOpen")?null:$("cpTaskDetailPage"));if(!dialog)return;
  if(e.key==="Escape"&&detailState){e.preventDefault();$("cpTaskDetailBack")?.click();}
  if(e.key!=="Tab")return;
  const nodes=[...dialog.querySelectorAll("button,input,select,textarea,summary,[tabindex]")].filter(n=>!n.disabled&&n.tabIndex>=0&&n.getClientRects().length);
  const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
 });
 window.TPFAgendaCompact={create,detail,syncDetail};
 const composerVisibility=new MutationObserver(()=>{if(createState&&!$("agendaCreateCard").classList.contains("open"))create(false)});
 if($("agendaCreateCard"))composerVisibility.observe($("agendaCreateCard"),{attributes:true,attributeFilter:["class"]});
})();
