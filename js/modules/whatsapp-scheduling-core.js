/* TPF physical module split · generated from app-core.js */
function openWhatsappProgramsView(prefill=null){
  const nav=document.querySelector('[data-view="whatsapp"]');
  if(nav)nav.click();

  setTimeout(()=>{
    if(prefill){
      $("waCustomer").value=prefill.name||"";
      $("waPhone").value=prefill.phone||"";
      $("waMessage").value=prefill.message||"";
      if(prefill.when)$("waWhen").value=prefill.when;
      $("waCustomer").focus();
    }
  },30);
}
if($("cpScheduleWhatsapp")){
  $("cpScheduleWhatsapp").onclick=()=>{
    if(!contactCanUseWhatsapp())return;
    if(!currentContact)return;
    openWaQuick({
      phone:$("contactPhone").value.trim()
    });
    $("waQuickScheduleBox").classList.remove("hidden");
    $("waQuickWhen").value=localDateTimeValue(new Date(Date.now()+60*60*1000));
  };
}


$("waQuickClose").onclick=$("waQuickCancel").onclick=()=>{
  $("waQuickProgramId").value="";
  window.__tpfWaQuickContext=null;
  $("waQuickModal").classList.add("hidden");
};

function waQuickPad(n){return String(n).padStart(2,"0")}
function waQuickPretty(d){
  return d.toLocaleDateString("es-ES",{weekday:"short",day:"2-digit",month:"short"})+
    " · "+waQuickPad(d.getHours())+":"+waQuickPad(d.getMinutes());
}
function waQuickLocalInput(d){
  return `${d.getFullYear()}-${waQuickPad(d.getMonth()+1)}-${waQuickPad(d.getDate())}T${waQuickPad(d.getHours())}:${waQuickPad(d.getMinutes())}`;
}
function waQuickDates(){
  const now=new Date();
  const tomorrow=new Date(now); tomorrow.setDate(now.getDate()+1);
  const monday=new Date(now);
  let days=(8-now.getDay())%7; if(days===0)days=7;
  monday.setDate(now.getDate()+days);
  const week=new Date(now); week.setDate(now.getDate()+7);
  const month=new Date(now); month.setMonth(now.getMonth()+1);
  return {tomorrow,monday,week,month};
}
function refreshWaQuickLabels(){
  const q=waQuickDates();
  $("waQuickTomorrowLabel").textContent=waQuickPretty(q.tomorrow);
  $("waQuickMondayLabel").textContent=waQuickPretty(q.monday);
  $("waQuickWeekLabel").textContent=waQuickPretty(q.week);
  $("waQuickMonthLabel").textContent=waQuickPretty(q.month);
}
$("waQuickDrop").onclick=(e)=>{
  e.preventDefault();
  e.stopPropagation();
  const box=$("waQuickScheduleBox");
  const opening=box.classList.contains("hidden");
  box.classList.toggle("hidden",!opening);
  if($("waQuickCustomBox"))$("waQuickCustomBox").classList.add("hidden");
  if(opening){
    if(typeof refreshWaQuickLabels==="function")refreshWaQuickLabels();
    $("waQuickSend").textContent="Programar";
    $("waQuickSend").dataset.mode="schedule";
  }else{
    $("waQuickSend").textContent="Enviar ahora";
    $("waQuickSend").dataset.mode="send";
  }
};


async function saveQuickWhatsappSchedule(date){
  if($("waQuickSend")){$("waQuickSend").disabled=true;$("waQuickSend").dataset.prevText=$("waQuickSend").textContent;$("waQuickSend").textContent="Guardando...";}
  if($("waQuickMsg"))$("waQuickMsg").textContent="Guardando...";
  const phone=$("waQuickPhone").value.trim();
  const message=$("waQuickMessage").value.trim();
  const programId=$("waQuickProgramId").value.trim();

  if(!phone){
    $("waQuickMsg").textContent="Introduce un teléfono.";
    return;
  }

  const iso=date.toISOString();

  if(programId){
    const {error}=await sb.from("agenda_items").update({
      customer_phone:phone,
      starts_at:iso,
      whatsapp_phone:phone,
      whatsapp_message:message||null,
      whatsapp_scheduled_at:iso,
      status:"pending"
    }).eq("id",programId);

    if(error){
      $("waQuickMsg").textContent=error.message;
      return;
    }
    $("waQuickMsg").textContent="WhatsApp reprogramado";
  }else{
    const {data:{user}}=await sb.auth.getUser();
    const row={
      title:"WhatsApp programado",
      description:null,
      customer_name:currentContact?$("contactName").value.trim():null,
      customer_phone:phone,
      starts_at:iso,
      assigned_to:user?.id||null,
      status:"pending",
      whatsapp_enabled:true,
      whatsapp_phone:phone,
      whatsapp_message:message||null,
      whatsapp_scheduled_at:iso
    };
    const {error}=await sb.from("agenda_items").insert(row);
    if(error){
      $("waQuickMsg").textContent=error.message;
      return;
    }
    $("waQuickMsg").textContent="WhatsApp programado";
  }

  $("waQuickScheduleBox").classList.add("hidden");
  setTimeout(()=>$("waQuickModal").classList.add("hidden"),350);
  if(typeof loadWhatsappPrograms==="function")await loadWhatsappPrograms();
  if(currentContact)await renderContactProfile();
  if($("waQuickSend")){$("waQuickSend").disabled=false;$("waQuickSend").textContent=$("waQuickSend").dataset.prevText||"Programar";}
}

document.querySelectorAll("[data-wa-quick]").forEach(btn=>{
  btn.onclick=(e)=>{
    e.preventDefault();
    e.stopPropagation();
    const type=btn.dataset.waQuick;

    if(type==="custom"){
      $("waQuickCustomBox").classList.remove("hidden");
      const cd=new Date(Date.now()+3600000); cd.setMinutes(Math.ceil(cd.getMinutes()/5)*5,0,0);
      waCalSelected=new Date(cd.getFullYear(),cd.getMonth(),cd.getDate());
      waCalView=new Date(cd.getFullYear(),cd.getMonth(),1);
      $("waQuickDateText").textContent=waPrettyDate(waCalSelected);
      $("waQuickTime").value=waPad2(cd.getHours())+":"+waPad2(cd.getMinutes());
      waSyncCustomWhen(); waRenderCalendar();
      if(!$("waQuickWhen").value && typeof waQuickLocalInput==="function"){
        $("waQuickWhen").value=waQuickLocalInput(new Date(Date.now()+60*60*1000));
      }
      $("waQuickSend").textContent="Programar";
      $("waQuickSend").dataset.mode="schedule";
      return;
    }

    if(typeof waQuickDates==="function"){
      const q=waQuickDates();
      const date=q[type];
      if(date && typeof waQuickLocalInput==="function"){
        $("waQuickWhen").value=waQuickLocalInput(date);
        document.querySelectorAll("[data-wa-quick]").forEach(x=>x.classList.remove("waQuickSelected"));
        btn.classList.add("waQuickSelected");
        $("waQuickSend").textContent="Programar";
        $("waQuickSend").dataset.mode="schedule";
      }
    }
  };
});

$("waQuickCustomSave").onclick=(e)=>{
  e.preventDefault();
  e.stopPropagation();

  // Asegura que la fecha y la hora elegidas queden unidas.
  if(typeof waSyncCustomWhen==="function")waSyncCustomWhen();

  const when=$("waQuickWhen").value;
  if(!when){
    $("waQuickMsg").textContent="Selecciona fecha y hora.";
    return;
  }

  $("waQuickSend").textContent="Programar";
  $("waQuickSend").dataset.mode="schedule";
  $("waQuickMsg").textContent="Fecha y hora seleccionadas.";

  // Cierra Personalizar y el desplegable, dejando visible el botón Programar.
  $("waQuickCustomBox").classList.add("hidden");
  $("waQuickCalendar").classList.add("hidden");
  $("waQuickScheduleBox").classList.add("hidden");
};

$("waQuickSend").onclick=async()=>{
  const phone=$("waQuickPhone").value.trim();
  const message=$("waQuickMessage").value.trim();
  const programId=$("waQuickProgramId")?.value?.trim()||"";
  const mode=$("waQuickSend").dataset.mode||"send";

  if(!phone){
    $("waQuickMsg").textContent="Introduce un teléfono.";
    return;
  }

  // MODO PROGRAMAR: guardar/reprogramar en vez de abrir WhatsApp.
  if(mode==="schedule"){
    let when=$("waQuickWhen")?.value||"";

    // Si no se ha abierto Personalizar y no hay fecha elegida,
    // usamos mañana a la misma hora como valor por defecto.
    if(!when){
      const d=new Date();
      d.setDate(d.getDate()+1);
      if(typeof waQuickLocalInput==="function"){
        when=waQuickLocalInput(d);
        if($("waQuickWhen"))$("waQuickWhen").value=when;
      }
    }

    if(!when){
      $("waQuickMsg").textContent="Selecciona una fecha y hora.";
      return;
    }

    if(typeof saveQuickWhatsappSchedule==="function"){
      await saveQuickWhatsappSchedule(new Date(when));
      return;
    }

    $("waQuickMsg").textContent="No se pudo guardar la programación.";
    return;
  }

  // MODO ENVIAR AHORA.
  const p=typeof waDigits==="function" ? waDigits(phone) : String(phone).replace(/\D/g,"");
  if(!p){
    $("waQuickMsg").textContent="Teléfono no válido.";
    return;
  }

  const url="https://wa.me/"+p+(message?"?text="+encodeURIComponent(message):"");
  window.open(url,"_blank","noopener,noreferrer");

  if(programId){
    setTimeout(async()=>{
      if(confirm("¿Quieres marcar este WhatsApp programado como completado?")){
        const {error}=await sb.from("agenda_items").update({status:"completed"}).eq("id",programId);
        if(error)alert(error.message);
        else{
          if(typeof loadWhatsappPrograms==="function")loadWhatsappPrograms();
          if(currentContact && typeof renderContactProfile==="function")await renderContactProfile();
        }
      }
    },500);
  }
};


function notifyPrefsKey(){
  return "tpf_notify_browser_"+(window.__tpfUserId||"anonymous");
}
function getBrowserNotifyPrefs(){
  try{return JSON.parse(localStorage.getItem(notifyPrefsKey())||"{}")||{}}catch(e){return{}}
}
let teamNotifyPrefs={
  whatsapp_telegram:false,
  agenda_telegram:false,
  telegram_chat_id:""
};
async function loadTeamNotifyPrefs(){
  try{
    const {data,error}=await sb.from("app_settings").select("value").eq("key","team_notification_settings").maybeSingle();
    if(error)throw error;
    if(data?.value && typeof data.value==="object") teamNotifyPrefs={...teamNotifyPrefs,...data.value};
  }catch(e){
    try{
      const local=JSON.parse(localStorage.getItem("tpf_team_notification_settings")||"{}");
      teamNotifyPrefs={...teamNotifyPrefs,...local};
    }catch(_){}
  }
  return teamNotifyPrefs;
}
async function loadNotifySettings(){
  if(!$('notifyWhatsappBrowser'))return;
  const b=getBrowserNotifyPrefs();
  await loadTeamNotifyPrefs();
  $("notifyWhatsappBrowser").checked=!!b.whatsapp_browser;
  $("notifyAgendaBrowser").checked=!!b.agenda_browser;
  $("notifyWhatsappTelegram").checked=!!teamNotifyPrefs.whatsapp_telegram;
  $("notifyAgendaTelegram").checked=!!teamNotifyPrefs.agenda_telegram;
  $("notifyTelegramChatId").value=teamNotifyPrefs.telegram_chat_id||"";
  if($('notifyRequestPermission')){
    const ok=("Notification" in window && Notification.permission==="granted");
    $("notifyRequestPermission").textContent=ok?"Notificaciones permitidas ✓":"Permitir notificaciones en este PC";
  }
}
if($('notifyRequestPermission'))$('notifyRequestPermission').onclick=async()=>{
  if(!("Notification" in window)){
    $("notifyMsg").textContent="Este navegador no admite notificaciones.";
    return;
  }
  const permission=await Notification.requestPermission();
  $("notifyMsg").textContent=permission==="granted"?"Notificaciones activadas en este PC.":"No se concedió permiso.";
  await loadNotifySettings();
};
if($('notifySave'))$('notifySave').onclick=async()=>{
  const browserPrefs={
    whatsapp_browser:$("notifyWhatsappBrowser").checked,
    agenda_browser:$("notifyAgendaBrowser").checked
  };
  const shared={
    whatsapp_telegram:$("notifyWhatsappTelegram").checked,
    agenda_telegram:$("notifyAgendaTelegram").checked,
    telegram_chat_id:$("notifyTelegramChatId").value.trim()
  };
  if((shared.whatsapp_telegram||shared.agenda_telegram)&&!shared.telegram_chat_id){
    $("notifyMsg").textContent="Primero detecta o introduce el Chat ID de Telegram.";
    return;
  }
  localStorage.setItem(notifyPrefsKey(),JSON.stringify(browserPrefs));
  localStorage.setItem("tpf_team_notification_settings",JSON.stringify(shared));
  teamNotifyPrefs={...shared};
  $("notifyMsg").textContent="Guardando...";
  try{
    const {error}=await sb.from("app_settings").upsert({key:"team_notification_settings",value:shared},{onConflict:"key"});
    if(error)throw error;
    $("notifyMsg").textContent="Notificaciones guardadas correctamente.";
    setTimeout(()=>{try{if(typeof checkAllNotifications==="function")checkAllNotifications();}catch(e){console.warn(e)}},500);
  }catch(e){
    $("notifyMsg").textContent="Guardadas en este PC. No se pudo guardar la configuración común: "+(e?.message||e);
  }
};


const notifiedWhatsappIds=new Set();
const notifiedAgendaIds=new Set();

function tpfTelegramOwnerId(){
  let id=localStorage.getItem("tpf_telegram_owner_id");
  if(!id){
    id=(crypto?.randomUUID?.()||("browser-"+Date.now()+"-"+Math.random().toString(36).slice(2)));
    localStorage.setItem("tpf_telegram_owner_id",id);
  }
  return id;
}

async function readCentralTelegramState(deliveryKey){
  try{
    const {data,error}=await sb.from("app_settings")
      .select("value")
      .eq("key",deliveryKey)
      .maybeSingle();
    if(error)throw error;
    return data?.value||null;
  }catch(e){
    console.warn("No se pudo leer estado central Telegram",e);
    return null;
  }
}

async function writeCentralTelegramState(deliveryKey,value){
  const {error}=await sb.from("app_settings")
    .upsert({key:deliveryKey,value},{onConflict:"key"});
  if(error)throw error;
}

async function claimCentralTelegram(deliveryKey){
  const owner=tpfTelegramOwnerId();
  const now=Date.now();
  const current=await readCentralTelegramState(deliveryKey);

  if(current?.status==="sent") return {ok:false,status:"sent"};

  // Si otro PC ya tiene reservado este aviso, no duplicar.
  if(current?.owner_id && current.owner_id!==owner){
    return {ok:false,status:current.status||"claimed"};
  }

  // Si este mismo PC está esperando un reintento, respetar la espera.
  if(current?.owner_id===owner && current?.next_at && now<Number(current.next_at)){
    return {ok:false,status:"waiting"};
  }

  // Primera reserva: INSERT, no UPSERT. La clave única evita dos propietarios simultáneos.
  if(!current){
    const value={
      status:"claimed",
      owner_id:owner,
      attempt:0,
      claimed_at:now,
      next_at:0
    };
    const {error}=await sb.from("app_settings").insert({key:deliveryKey,value});
    if(error){
      // Si otro PC ganó la carrera, simplemente no enviamos.
      return {ok:false,status:"claimed_elsewhere"};
    }
    return {ok:true,state:value};
  }

  // Reintento: solo puede hacerlo el mismo propietario.
  return {ok:true,state:current};
}

async function sendTelegramNotification(type,row){
  await loadTeamNotifyPrefs();
  const chatId=String(teamNotifyPrefs.telegram_chat_id||"").trim();
  if(!chatId)return false;

  const enabled = type==="whatsapp"
    ? !!teamNotifyPrefs.whatsapp_telegram
    : !!teamNotifyPrefs.agenda_telegram;
  if(!enabled)return false;

  const deliveryKey="telegram_delivery_"+type+"_"+String(row.id);
  const claim=await claimCentralTelegram(deliveryKey);
  if(!claim.ok){
    return claim.status==="sent";
  }

  let state=claim.state||{};
  let text="";
  if(type==="whatsapp"){
    text="💬 The Phone Face\nWhatsApp listo para enviar";
    if(row.customer_name)text+="\nCliente: "+row.customer_name;
    if(row.whatsapp_phone||row.customer_phone)text+="\nTeléfono: "+(row.whatsapp_phone||row.customer_phone);
    if(row.whatsapp_message)text+="\nMensaje: "+row.whatsapp_message;
    if(row.whatsapp_scheduled_at||row.starts_at){
      text+="\nHora: "+fmtAgendaDate(row.whatsapp_scheduled_at||row.starts_at);
    }
  }else{
    text="🔔 The Phone Face\nRecordatorio de Agenda";
    if(row.title)text+="\n"+row.title;
    if(row.customer_name)text+="\nCliente: "+row.customer_name;
    if(row.starts_at)text+="\nHora: "+fmtAgendaDate(row.starts_at);
    if(row.description)text+="\nNotas: "+row.description;
  }

  try{
    const r=await fetch("/api/telegram",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        action:"send",
        chat_id:chatId,
        text
      })
    });
    const j=await r.json();
    if(!r.ok||!j.ok)throw new Error(j.error||"No se pudo enviar Telegram.");

    await writeCentralTelegramState(deliveryKey,{
      status:"sent",
      owner_id:tpfTelegramOwnerId(),
      attempt:Number(state.attempt||0)+1,
      sent_at:Date.now(),
      next_at:0,
      message_id:j.message_id||null
    });
    return true;
  }catch(e){
    const retryDelays=[60000,300000,900000]; // 1, 5 y 15 min
    const attempt=Math.min(Number(state.attempt||0)+1,retryDelays.length);
    const isFinal=attempt>=retryDelays.length;
    const nextAt=isFinal?0:(Date.now()+retryDelays[attempt-1]);

    try{
      await writeCentralTelegramState(deliveryKey,{
        status:isFinal?"error":"pending",
        owner_id:tpfTelegramOwnerId(),
        attempt,
        next_at:nextAt,
        last_error:e?.message||String(e),
        updated_at:Date.now()
      });
    }catch(writeErr){
      console.warn("No se pudo guardar el reintento Telegram",writeErr);
    }

    console.warn("Telegram notification error",e);
    return false;
  }
}



async function checkAllNotifications(){
  const browserPrefs=getBrowserNotifyPrefs();
  await loadTeamNotifyPrefs();

  const browserAllowed=("Notification" in window && Notification.permission==="granted");
  const now=new Date().toISOString();

  try{
    // WHATSAPP PROGRAMADOS
    if(browserPrefs.whatsapp_browser || teamNotifyPrefs.whatsapp_telegram){
      const {data}=await sb.from("agenda_items").select("*")
        .eq("status","pending")
        .limit(100);
      const dueWhatsapp=(data||[]).filter(row=>{
        const when=row.whatsapp_scheduled_at||((row.whatsapp_enabled===true)?row.starts_at:null);
        return row.whatsapp_enabled===true && when && new Date(when)<=new Date(now);
      });

      for(const row of dueWhatsapp){
        const id=String(row.id);

        if(browserPrefs.whatsapp_browser && browserAllowed && !notifiedWhatsappIds.has(id)){
          notifiedWhatsappIds.add(id);
          const n=new Notification("WhatsApp listo para enviar",{
            body:(row.customer_name?row.customer_name+" · ":"")+
              (row.whatsapp_message||"Tienes un WhatsApp programado pendiente.")
          });
          n.onclick=()=>{
            window.focus();
            document.querySelector('[data-view="whatsapp"]')?.click();
            n.close();
          };
        }

        if(teamNotifyPrefs.whatsapp_telegram){
          await sendTelegramNotification("whatsapp",row);
        }
      }
    }

    // AGENDA
    if(browserPrefs.agenda_browser || teamNotifyPrefs.agenda_telegram){
      const {data}=await sb.from("agenda_items").select("*")
        .eq("status","pending")
        .limit(100);
      const dueAgenda=(data||[]).filter(row=>{
        return row.whatsapp_enabled!==true && row.starts_at && new Date(row.starts_at)<=new Date(now);
      });

      for(const row of dueAgenda){
        const id=String(row.id);

        if(browserPrefs.agenda_browser && browserAllowed && !notifiedAgendaIds.has(id)){
          notifiedAgendaIds.add(id);
          const n=new Notification("Recordatorio de Agenda",{
            body:(row.customer_name?row.customer_name+" · ":"")+
              (row.title||"Tienes un recordatorio pendiente.")
          });
          n.onclick=()=>{
            window.focus();
            document.querySelector('[data-view="agenda"]')?.click();
            n.close();
          };
        }

        if(teamNotifyPrefs.agenda_telegram){
          await sendTelegramNotification("agenda",row);
        }
      }
    }
  }catch(e){
    console.warn("Notification checker error",e);
  }
}

setInterval(()=>{try{checkAllNotifications()}catch(e){console.warn("Notification timer",e)}},60000);
setTimeout(()=>{try{checkAllNotifications()}catch(e){console.warn("Notification startup",e)}},5000);


function waDigits(phone){
  let p=String(phone||"").replace(/\D/g,"");
  if(p.startsWith("00"))p=p.slice(2);
  if(p.length===9)p="34"+p;
  return p;
}
function waIsDue(row){
  const when=row.whatsapp_scheduled_at||row.starts_at;
  return !when || new Date(when).getTime()<=Date.now();
}
async function loadWhatsappPrograms(){
  if(!$("waRows"))return;
  const {data,error}=await sb.from("agenda_items")
    .select("*")
    .eq("whatsapp_enabled",true)
    .order("whatsapp_scheduled_at",{ascending:true})
    .limit(300);

  if(error){
    $("waRows").innerHTML=`<tr><td colspan="6">${esc(error.message)}</td></tr>`;
    return;
  }

  let rows=data||[];
  const filter=$("waFilter")?.value||"pending";
  const term=($("waSearch")?.value||"").trim().toLowerCase();

  rows=rows.filter(a=>{
    const due=waIsDue(a);
    if(filter==="pending" && a.status!=="pending")return false;
    if(filter==="due" && !(a.status==="pending"&&due))return false;
    if(filter==="future" && !(a.status==="pending"&&!due))return false;
    if(filter==="completed" && a.status!=="completed")return false;
    if(filter==="cancelled" && a.status!=="cancelled")return false;

    if(term){
      const hay=[a.customer_name,a.whatsapp_phone,a.customer_phone,a.whatsapp_message]
        .some(v=>String(v||"").toLowerCase().includes(term));
      if(!hay)return false;
    }
    return true;
  });

  window.__waRows=rows;
  $("waEmpty").style.display=rows.length?"none":"block";
  if($("waReload"))$("waReload").textContent=rows.length?`Actualizar (${rows.length})`:"Actualizar";
  $("waRows").innerHTML=rows.map(a=>{
    const due=waIsDue(a);
    const status=a.status==="completed"?"Enviado / completado":
      a.status==="cancelled"?"Cancelado":
      due?"Listo para enviar":"Programado";

    return `<tr>
      <td>${esc(fmtAgendaDate(a.whatsapp_scheduled_at||a.starts_at))}</td>
      <td>${esc(a.customer_name||"")}</td>
      <td>${esc(a.whatsapp_phone||a.customer_phone||"")}</td>
      <td class="waMessageCell">${esc(a.whatsapp_message||"")}</td>
      <td><span class="${due&&a.status==="pending"?"waReady":"waPending"}">${esc(status)}</span></td>
      <td>
        ${a.status==="pending"&&due?`<button class="agendaWaSend" onclick="sendProgrammedWhatsapp('${a.id}')">Enviar WhatsApp</button> `:""}
        ${a.status==="pending"?`<button class="secondary" onclick="editProgrammedWhatsapp('${a.id}')">Editar</button> `:""}
        ${a.status==="pending"?`<button class="secondary" onclick="cancelProgrammedWhatsapp('${a.id}')">Cancelar</button> `:""}
        <button class="secondary" onclick="deleteProgrammedWhatsapp('${a.id}')">Eliminar</button>
      </td>
    </tr>`;
  }).join("");
}
$("waSave").onclick=async()=>{
  const editId=$("waEditId").value;
  const phone=$("waPhone").value.trim();
  const when=$("waWhen").value;
  const message=$("waMessage").value.trim();

  if(!phone||!when||!message){
    $("waMsg").textContent="Completa teléfono, fecha/hora y mensaje.";
    return;
  }

  const iso=new Date(when).toISOString();
  const base={
    customer_name:$("waCustomer").value.trim()||null,
    customer_phone:phone,
    starts_at:iso,
    status:"pending",
    whatsapp_enabled:true,
    whatsapp_phone:phone,
    whatsapp_message:message,
    whatsapp_scheduled_at:iso
  };

  let error=null;

  if(editId){
    ({error}=await sb.from("agenda_items").update(base).eq("id",editId));
  }else{
    const {data:{user}}=await sb.auth.getUser();
    ({error}=await sb.from("agenda_items").insert({
      title:"WhatsApp programado",
      description:null,
      assigned_to:user?.id||null,
      ...base
    }));
  }

  if(error){
    $("waMsg").textContent=error.message;
    return;
  }

  $("waMsg").textContent=editId?"WhatsApp actualizado":"WhatsApp programado";
  ["waEditId","waCustomer","waPhone","waWhen","waMessage"].forEach(id=>$(id).value="");
  $("waSave").textContent="Programar WhatsApp";
  loadWhatsappPrograms();
};

window.editProgrammedWhatsapp=async(id)=>{
  await openContactProgrammedWhatsapp(id);
};

window.sendProgrammedWhatsapp=(id)=>{
  const row=(window.__waRows||[]).find(x=>String(x.id)===String(id));
  if(!row)return;
  const p=waDigits(row.whatsapp_phone||row.customer_phone);
  if(!p){alert("No hay teléfono.");return}
  const url="https://wa.me/"+p+"?text="+encodeURIComponent(row.whatsapp_message||"");
  window.open(url,"_blank","noopener,noreferrer");

  setTimeout(async()=>{
    if(confirm("¿Quieres marcar este WhatsApp como completado después de enviarlo?")){
      const {error}=await sb.from("agenda_items").update({status:"completed"}).eq("id",id);
      if(error)alert(error.message); else loadWhatsappPrograms();
    }
  },500);
};
window.cancelProgrammedWhatsapp=async(id)=>{
  const {error}=await sb.from("agenda_items").update({status:"cancelled"}).eq("id",id);
  if(error)alert(error.message); else loadWhatsappPrograms();
};
window.deleteProgrammedWhatsapp=async(id)=>{
  if(!confirm("¿Eliminar este WhatsApp programado?"))return;
  const {error}=await sb.from("agenda_items").delete().eq("id",id);
  if(error)alert(error.message); else loadWhatsappPrograms();
};
