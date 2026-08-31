/* TPF physical module split · generated from app-core.js */
/* ===== WhatsApp GREEN-API ===== */
let waLiveState={
  chats:[],
  selected:null,
  history:[],
  filter:"all",
  contact:null,
  poll:null,
  loading:false,
  pollBusy:false,
  avatars:{},
  avatarPending:{},
  livePreview:{},
  notifiedIds:new Set(),
  unread:(()=>{try{return JSON.parse(localStorage.getItem("tpf_wa_unread")||"{}")||{}}catch(e){return {}}})()
};

function waNormalizePhone(chatId){
  return String(chatId||"").replace(/@.*$/,"").replace(/\D/g,"");
}
function waPhoneVariants(phone){
  const p=String(phone||"").replace(/\D/g,"");
  const v=new Set([p]);
  if(p.startsWith("34"))v.add(p.slice(2)); else if(p.length===9)v.add("34"+p);
  return [...v].filter(Boolean);
}
function waInitials(name){
  const s=String(name||"W").trim();
  return s.split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase()||"W";
}
function waSaveUnread(){try{localStorage.setItem("tpf_wa_unread",JSON.stringify(waLiveState.unread||{}))}catch(e){}}
function waUnreadCount(chatId){return Math.max(0,Number(waLiveState.unread?.[String(chatId||"")]||0))}
function waSetUnread(chatId,n){const id=String(chatId||"");if(!id)return;waLiveState.unread[id]=Math.max(0,Number(n||0));waSaveUnread()}
function waIncUnread(chatId){const id=String(chatId||"");if(!id)return;waSetUnread(id,waUnreadCount(id)+1)}


function waChatServerPreview(c){
  try{
    const lm=c?.lastMessage;
    if(lm && typeof lm==="object"){
      const t=waMessageText(lm);
      if(t)return t;
      const mi=waMediaInfo(lm);
      if(mi?.kind==="image")return "📷 Foto";
      if(mi?.kind==="video")return "🎥 Vídeo";
      if(mi?.kind==="audio")return "🎵 Audio";
      if(mi?.kind==="document")return "📎 Documento";
    }
    const vals=[c?.lastMessageText,c?.message,c?.text,c?.lastText];
    for(const v of vals){
      if(typeof v==="string" && v.trim())return v.trim();
    }
  }catch(_){}
  return "";
}
function waChatServerUnread(c){
  const vals=[
    c?.unreadCount,
    c?.unreadMessagesCount,
    c?.unreadMessages,
    c?.countUnread,
    c?.unread
  ];
  for(const v of vals){
    const n=Number(v);
    if(Number.isFinite(n)&&n>0)return Math.floor(n);
  }
  return 0;
}

function waLivePreviewText(msg){
  if(!msg)return "";
  const t=waMessageText(msg);
  if(t)return t;
  const info=waMediaInfo(msg);
  if(info?.kind==="image")return "📷 Foto";
  if(info?.kind==="video")return "🎥 Vídeo";
  if(info?.kind==="audio")return "🎵 Audio";
  if(info?.kind==="document")return "📎 Documento";
  return "Nuevo mensaje";
}
function waRememberLivePreview(chatId,msg){
  const id=String(chatId||""); if(!id||!msg)return;
  waLiveState.livePreview[id]={
    idMessage:String(msg?.idMessage||""),
    text:waLivePreviewText(msg),
    timestamp:waMessageTimestamp(msg)||Math.floor(Date.now()/1000),
    outgoing:waMessageDirection(msg)==="out"
  };
}
function waBrowserNotifyIncoming(chatId,msg,body){
  try{
    const id=String(msg?.idMessage||body?.idMessage||"");
    if(id && waLiveState.notifiedIds.has(id))return;
    if(id)waLiveState.notifiedIds.add(id);
    if(waLiveState.notifiedIds.size>200){
      waLiveState.notifiedIds=new Set([...waLiveState.notifiedIds].slice(-100));
    }

    const chat=(waLiveState.chats||[]).find(c=>String(c.id)===String(chatId));
    const name=chat?.name || body?.senderData?.senderName || waNormalizePhone(chatId) || "WhatsApp";
    const preview=waLivePreviewText(msg);

    // Aviso dentro del CRM, siempre.
    let box=document.getElementById("waIncomingToast");
    if(!box){
      box=document.createElement("div");
      box.id="waIncomingToast";
      box.style.cssText="position:fixed;right:18px;top:18px;z-index:20000;max-width:360px;background:#fff;border:1px solid #dfe5ea;border-radius:12px;box-shadow:0 14px 40px #0003;padding:12px 14px;font:13px system-ui;cursor:pointer;display:none";
      document.body.appendChild(box);
    }
    box.innerHTML=`<b style="display:block;margin-bottom:3px">💬 ${esc(name)}</b><span>${esc(preview)}</span>`;
    box.style.display="block";
    box.onclick=()=>{box.style.display="none"; try{document.querySelector('[data-view="whatsapplive"]')?.click()}catch(_){}; setTimeout(()=>selectWhatsAppChat(chatId),120)};
    clearTimeout(window.__waToastTimer);
    window.__waToastTimer=setTimeout(()=>{box.style.display="none"},7000);

    // Notificación del sistema si el usuario la tiene permitida.
    const prefs=getBrowserNotifyPrefs?.()||{};
    if("Notification" in window && Notification.permission==="granted" && prefs.whatsapp_browser){
      const n=new Notification(`WhatsApp · ${name}`,{body:preview});
      n.onclick=()=>{window.focus(); n.close(); try{document.querySelector('[data-view="whatsapplive"]')?.click()}catch(_){}; setTimeout(()=>selectWhatsAppChat(chatId),150)};
    }
  }catch(e){console.warn("WhatsApp notification",e)}
}

function waTime(ts){
  if(!ts)return "";
  const d=new Date(Number(ts)<1e12?Number(ts)*1000:ts);
  if(Number.isNaN(d.getTime()))return "";
  const today=new Date();
  if(d.toDateString()===today.toDateString())return d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
  return d.toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit"});
}
function waMessageText(m){
  const md=m?.messageData||{};
  const raw = md?.textMessageData?.textMessage
    || md?.extendedTextMessageData?.text
    || md?.fileMessageData?.caption
    || m?.textMessage
    || m?.caption
    || m?.message
    || "";
  const s=String(raw||"").trim();
  // Nunca mostrar nombres de variables, tokens ni textos técnicos internos
  // como si fueran mensajes de WhatsApp.
  if(/^(GREEN_API_(TOKEN|INSTANCE_ID|ID_INSTANCE|IDINSTANCE|API_TOKEN|TOKEN_INSTANCE|API_URL|MEDIA_URL))$/i.test(s))return "";
  if(/^process\.env\./i.test(s))return "";
  if(/GREEN-API no está disponible en esta función de Vercel/i.test(s))return "";
  return s;
}
function waMessageDirection(m){
  const t=String(m?.type||m?.typeMessage||m?.typeWebhook||"").toLowerCase();
  if(t.includes("outgoing"))return "out";
  if(t.includes("incoming"))return "in";
  if(m?.outgoing===true)return "out";
  if(m?.outgoing===false)return "in";
  return "in";
}
function waMessageTimestamp(m){
  return m?.timestamp||m?.sendAt||m?.time||m?.createdAt||0;
}
function waMediaUrl(m){
  return m?.messageData?.fileMessageData?.downloadUrl||m?.downloadUrl||m?.urlFile||"";
}
function waMediaInfo(m){
  const md=m?.messageData||{};
  const fd=md?.fileMessageData||m?.fileMessageData||{};
  const quoted=md?.quotedMessage||{};
  const type=String(
    md?.typeMessage||m?.typeMessage||m?.messageType||m?.typeWebhook||""
  ).toLowerCase();
  const mime=String(fd?.mimeType||m?.mimeType||quoted?.mimeType||"").toLowerCase();
  const name=String(fd?.fileName||m?.fileName||quoted?.fileName||"").trim();
  const rawCaption=String(fd?.caption||m?.caption||"").trim();
  const caption=/^(GREEN_API_|process\.env\.)/i.test(rawCaption)?"":rawCaption;
  const url=String(
    fd?.downloadUrl||fd?.urlFile||m?.downloadUrl||m?.urlFile||
    md?.downloadUrl||md?.urlFile||""
  ).trim();
  const thumb=String(
    fd?.jpegThumbnail||m?.jpegThumbnail||md?.jpegThumbnail||""
  ).trim();
  let kind="file";
  if(type.includes("image")||type.includes("sticker")||mime.startsWith("image/"))kind="image";
  else if(type.includes("video")||mime.startsWith("video/"))kind="video";
  else if(type.includes("audio")||type.includes("voice")||mime.startsWith("audio/"))kind="audio";
  else if(type.includes("document")||type.includes("file"))kind="document";
  return {type,mime,name,caption,url,thumb,kind};
}
function waMediaHtml(info,idMessage){
  const id=esc(String(idMessage||""));
  const u=info.url?esc(info.url):"";
  const cap=info.caption?`<div class="waMediaCaption">${esc(info.caption)}</div>`:"";
  const dl=(url,name)=>url?`<button class="waDownloadBtn" type="button" onclick="waDownloadFile('${String(url).replaceAll("'","\'")}','${String(name||"archivo").replaceAll("'","\'")}','${String(idMessage||"").replaceAll("'","\'")}')">⇩ Descargar</button>`:"";
  if(info.kind==="image"){
    const src=u||(info.thumb?`data:image/jpeg;base64,${esc(info.thumb)}`:"");
    if(src)return `<a href="${u||src}" target="_blank" rel="noopener"><img class="waMediaImage" src="${src}" loading="lazy" alt="Imagen de WhatsApp"></a>${cap}${dl(u||src,info.name||"imagen.jpg")}`;
  }
  if(info.kind==="video"&&u)return `<video class="waMediaVideo" controls preload="metadata" src="${u}"></video>${cap}${dl(u,info.name||"video.mp4")}`;
  if(info.kind==="audio"&&u)return `<audio class="waMediaAudio" controls preload="metadata" src="${u}"></audio>${cap}${dl(u,info.name||"audio")}`;
  if((info.kind==="document"||info.kind==="file")&&u){
    const nm=info.name||"Documento";
    return `<a class="waDocCard" href="${u}" target="_blank" rel="noopener"><span class="waDocIcon">📄</span><span class="waDocText"><b>${esc(nm)}</b><small>${esc(info.mime||"Abrir archivo")}</small></span></a>${cap}${dl(u,nm)}`;
  }
  return `<div class="waMediaLoading" data-wa-media-id="${id}">Cargando ${info.kind==="image"?"foto":info.kind==="video"?"vídeo":info.kind==="audio"?"audio":"archivo"}…</div>${cap}`;
}
const waMediaCache=new Map();
const waMediaPending=new Set();

async function hydrateWaMedia(){
  const chatId=waLiveState.selected?.id;
  if(!chatId)return;
  const nodes=[...document.querySelectorAll('#waMessages [data-wa-media-id]')];
  for(const node of nodes){
    const idMessage=String(node.dataset.waMediaId||"");
    if(!idMessage)continue;
    const key=`${chatId}::${idMessage}`;

    if(waMediaCache.has(key)){
      const cached=waMediaCache.get(key);
      if(cached){
        const msg=(waLiveState.history||[]).find(x=>String(x?.idMessage||"")===idMessage);
        if(msg){
          msg.messageData=msg.messageData||{};
          msg.messageData.fileMessageData=msg.messageData.fileMessageData||{};
          msg.messageData.fileMessageData.downloadUrl=cached;
        }
        renderWaMessages(false);
        return;
      }
      node.className="waMediaUnavailable";
      node.textContent="Archivo no disponible";
      node.removeAttribute("data-wa-media-id");
      continue;
    }

    if(waMediaPending.has(key))continue;
    waMediaPending.add(key);
    try{
      const r=await waApi("file",{chatId,idMessage});
      const url=String(r?.downloadUrl||"").trim();
      waMediaCache.set(key,url||null);
      if(!url)throw new Error("Archivo no disponible");

      const msg=(waLiveState.history||[]).find(x=>String(x?.idMessage||"")===idMessage);
      if(msg){
        msg.messageData=msg.messageData||{};
        msg.messageData.fileMessageData=msg.messageData.fileMessageData||{};
        msg.messageData.fileMessageData.downloadUrl=url;
      }
      renderWaMessages(false);
      return; // render recrea nodos, siguiente pasada continúa
    }catch(e){
      waMediaCache.set(key,null);
      node.className="waMediaUnavailable";
      node.textContent="Archivo no disponible";
      node.removeAttribute("data-wa-media-id");
    }finally{
      waMediaPending.delete(key);
    }
  }
}
function waApplyAvatar(el,url,initials){
  if(!el)return;
  if(url){el.classList.add("hasPhoto");el.style.backgroundImage=`url("${String(url).replaceAll('"','%22')}")`;el.textContent="";}
  else{el.classList.remove("hasPhoto");el.style.backgroundImage="";el.textContent=initials||"W";}
}
async function waLoadAvatar(chatId){
  const id=String(chatId||"");
  if(!id)return "";
  if(Object.prototype.hasOwnProperty.call(waLiveState.avatars,id))return waLiveState.avatars[id];
  if(waLiveState.avatarPending[id])return waLiveState.avatarPending[id];
  waLiveState.avatarPending[id]=(async()=>{
    try{
      const r=await waApi("avatar",{chatId:id});
      const url=String((r.base64Avatar?`data:image/jpeg;base64,${r.base64Avatar}`:"")||r.urlAvatar||"");
      waLiveState.avatars[id]=url;
      return url;
    }catch(e){waLiveState.avatars[id]="";return ""}
    finally{delete waLiveState.avatarPending[id]}
  })();
  return waLiveState.avatarPending[id];
}
async function hydrateWaAvatars(chatIds=[]){
  const ids=[...new Set(chatIds.map(String).filter(Boolean))].slice(0,60);
  let cursor=0;
  async function worker(){
    while(cursor<ids.length){
      const id=ids[cursor++];
      const url=await waLoadAvatar(id);
      document.querySelectorAll(`[data-wa-avatar-id="${CSS.escape(id)}"]`).forEach(el=>waApplyAvatar(el,url,el.dataset.waInitials||"W"));
    }
  }
  await Promise.all(Array.from({length:Math.min(5,ids.length)},worker));
}

async function waApi(action,payload={}){
  const opts={headers:{"Content-Type":"application/json"}};
  let url="/api/green?action="+encodeURIComponent(action);
  if(action==="chats"||action==="state"||action==="summary"||action==="notification"||action==="notifications"){
    opts.method="GET";
  }else{
    opts.method="POST";
    opts.body=JSON.stringify(payload);
  }
  const r=await fetch(url,opts);
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.ok===false)throw new Error(j.error||`Error ${r.status}`);
  return j;
}


function waApplySummaryChats(chats){
  waLiveState.chats=Array.isArray(chats)?chats:[];
  for(const c of waLiveState.chats){
    if(!c?._lastMessage || !c?.id)continue;
    const id=String(c.id);
    const incomingTs=Number(waMessageTimestamp(c._lastMessage)||0);
    const current=waLiveState.livePreview[id]||null;
    const currentTs=Number(current?.timestamp||0);
    // Un resumen/diario atrasado nunca puede pisar un mensaje más nuevo
    // recibido en tiempo real.
    if(!current || incomingTs>=currentTs){
      waRememberLivePreview(id,c._lastMessage);
    }
  }
}
async function waRefreshHybridSummary(){
  try{
    const r=await waApi("summary");
    waApplySummaryChats(r.chats);
    if(!$("view-whatsapplive")?.classList.contains("hidden"))renderWhatsAppChats();
  }catch(e){console.warn("WhatsApp hybrid summary",e)}
}

async function loadWhatsAppLive(){
  if(waLiveState.loading)return;
  waLiveState.loading=true;
  try{
    $("waLiveStatus").textContent="Conectando…";
    $("waLiveStatus").className="waLiveStatus";
    const [state,summaryR]=await Promise.all([waApi("state"),waApi("summary")]);
    const st=String(state.state||state.data?.stateInstance||state.stateInstance||"").toLowerCase();
    const connected=st==="authorized"||st==="online"||st==="connected";
    $("waLiveStatus").textContent=connected?"Conectado":"Estado: "+(st||"desconocido");
    $("waLiveStatus").className="waLiveStatus "+(connected?"ok":"error");
    waApplySummaryChats(summaryR.chats);
    renderWhatsAppChats();

    if(waLiveState.selected){
      const still=waLiveState.chats.find(c=>c.id===waLiveState.selected.id);
      if(still)waLiveState.selected={...waLiveState.selected,...still};
      await loadWaHistory(false);
    }
    startWaPolling();
    // Activa la recepción por cola HTTP solo si la instancia aún no la tiene activada.
    waApi("ensure").catch(()=>{});
  }catch(e){
    $("waLiveStatus").textContent="Error de conexión";
    $("waLiveStatus").className="waLiveStatus error";
    $("waLiveChats").innerHTML=`<div class="waLiveEmpty">${esc(e.message||"No se pudo conectar")}</div>`;
  }finally{waLiveState.loading=false}
}

function renderWhatsAppChats(){
  const q=String($("waLiveSearch")?.value||"").toLowerCase().trim();
  let rows=waLiveState.chats||[];
  if(waLiveState.filter==="groups")rows=rows.filter(c=>String(c.id||"").includes("@g.us"));
  if(waLiveState.filter==="contacts")rows=rows.filter(c=>String(c.id||"").includes("@c.us"));
  if(waLiveState.filter==="unread")rows=rows.filter(c=>waUnreadCount(c.id)>0);
  if(q)rows=rows.filter(c=>String(c.name||c.id||"").toLowerCase().includes(q)||waNormalizePhone(c.id).includes(q.replace(/\D/g,"")));

  $("waLiveChats").innerHTML=rows.map(c=>{
    const active=waLiveState.selected?.id===c.id?" active":"";
    const name=c.name||waNormalizePhone(c.id)||"WhatsApp";
    const initials=waInitials(name);
    const avatar=waLiveState.avatars[String(c.id||"")]||"";
    const avStyle=avatar?` style="background-image:url('${esc(avatar)}')"`:"";
    const live=waLiveState.livePreview[String(c.id||"")]||null;
    const hybridLast=c?._lastMessage||null;
    const serverPreview=waChatServerPreview(c);
    const hybridPreview=hybridLast?waLivePreviewText(hybridLast):"";
    const preview=(live?.text||hybridPreview||serverPreview||(String(c.id||"").includes("@g.us")?"Grupo":""));
    const previewTime=live?.timestamp||waMessageTimestamp(hybridLast)||c.lastMessageTime||c.lastMessageTimestamp||c.timestamp||c.lastActivityTime;
    const unread=Math.max(waUnreadCount(c.id),waChatServerUnread(c));
    return `<div class="waChatRow${active}${unread?" waHasUnread":""}" onclick="selectWhatsAppChat('${String(c.id).replaceAll("'","\\'")}')">
      <div class="waAvatar${avatar?" hasPhoto":""}" data-wa-avatar-id="${esc(c.id)}" data-wa-initials="${esc(initials)}"${avStyle}>${avatar?"":esc(initials)}</div>
      <div class="waChatRowMain">
        <div class="waChatRowTop"><b>${esc(name)}</b><span>${esc(waTime(previewTime))}</span></div>
        <div class="waChatPreviewLine"><div class="waChatPreview">${esc(preview)}</div>${unread?`<span class="waUnreadBadge">${unread>99?"99+":unread}</span>`:""}</div>
      </div>
    </div>`;
  }).join("")||'<div class="waLiveEmpty">No hay conversaciones en este filtro.</div>';
  setTimeout(()=>hydrateWaAvatars(rows.map(c=>c.id)),20);
}

window.selectWhatsAppChat=async(chatId)=>{
  const chat=(waLiveState.chats||[]).find(c=>c.id===chatId)||{id:chatId};
  waLiveState.selected=chat;
  waSetUnread(chatId,0);
  renderWhatsAppChats();
  try{localStorage.setItem("tpf_wa_unread",JSON.stringify(waLiveState.unread||{}))}catch(_){}
  waApi("read",{chatId}).catch(()=>{});
  $("waChatEmpty").classList.add("hidden");
  $("waChatActive").classList.remove("hidden");
  const name=chat.name||waNormalizePhone(chat.id)||"WhatsApp";
  $("waChatName").textContent=name;
  $("waChatPhone").textContent=String(chat.id||"").includes("@g.us")?"Grupo":("+"+waNormalizePhone(chat.id));
  const initials=waInitials(name);
  $("waChatAvatar").dataset.waAvatarId=chat.id; $("waChatAvatar").dataset.waInitials=initials; waApplyAvatar($("waChatAvatar"),waLiveState.avatars[chat.id]||"",initials);
  $("waSideAvatar").dataset.waAvatarId=chat.id; $("waSideAvatar").dataset.waInitials=initials; waApplyAvatar($("waSideAvatar"),waLiveState.avatars[chat.id]||"",initials);
  waLoadAvatar(chat.id).then(url=>{waApplyAvatar($("waChatAvatar"),url,initials);waApplyAvatar($("waSideAvatar"),url,initials)});
  $("waSideName").textContent=name;
  $("waSidePhone").textContent=String(chat.id||"").includes("@g.us")?"Grupo":("+"+waNormalizePhone(chat.id));
  $("waContactEmpty").classList.add("hidden");
  $("waContactCard").classList.remove("hidden");

  await Promise.all([loadWaHistory(true),matchWaContact()]);
};

async function loadWaHistory(scrollBottom=true){
  if(!waLiveState.selected)return;
  try{
    const r=await waApi("history",{chatId:waLiveState.selected.id,count:100});
    const nextHistory=Array.isArray(r.messages)?r.messages:[];
    if(waStableSig(nextHistory)!==waStableSig(waLiveState.history)){
      waLiveState.history=nextHistory;
      renderWaMessages(scrollBottom);
    }else if(scrollBottom){
      const box=$("waMessages"); if(box)box.scrollTop=box.scrollHeight;
    }
  }catch(e){
    $("waMessages").innerHTML=`<div class="waLiveEmpty">${esc(e.message)}</div>`;
  }
}
function renderWaMessages(scrollBottom){
  const box=$("waMessages");
  const rows=[...(waLiveState.history||[])].sort((a,b)=>Number(waMessageTimestamp(a)||0)-Number(waMessageTimestamp(b)||0));
  box.innerHTML=rows.map(m=>{
    const dir=waMessageDirection(m);
    const text=waMessageText(m);
    const info=waMediaInfo(m);
    const typeLooksMedia=/(image|sticker|video|audio|voice|document|file)/i.test(info.type||"");
    const isMedia=Boolean(info.url||info.thumb||typeLooksMedia);
    const mediaHtml=isMedia?waMediaHtml(info,m?.idMessage):"";
    const rawType=String(info.type||m?.messageData?.typeMessage||m?.typeMessage||"").toLowerCase();
    if(!isMedia&&!text&&(rawType==="textmessage"||rawType==="extendedtextmessage"))return "";
    const body=!isMedia&&text?esc(text):(!isMedia?esc(`[${info.type||m?.messageData?.typeMessage||m?.typeMessage||"Mensaje"}]`):"");
    const cls=isMedia?" hasMedia":"";
    return `<div class="waMsg ${dir}"><div class="waBubble${cls}">${mediaHtml||body}${isMedia&&text&&!info.caption?`<div class="waMediaCaption">${esc(text)}</div>`:""}<div class="waMsgMeta">${esc(waTime(waMessageTimestamp(m)))}</div></div></div>`;
  }).join("")||'<div class="waLiveEmpty">No hay mensajes disponibles en este chat.</div>';
  setTimeout(hydrateWaMedia,30);
  if(scrollBottom)setTimeout(()=>{box.scrollTop=box.scrollHeight},80);
}

async function matchWaContact(){
  const chat=waLiveState.selected;
  waLiveState.contact=null;
  $("waOpenContactTop").classList.add("hidden");
  $("waCreateContactTop").classList.add("hidden");
  $("waSideOpenContact").classList.add("hidden");
  $("waSideCreateContact").classList.add("hidden");
  $("waSideOpps").innerHTML="";
  $("waSideTasks").innerHTML="";
  $("waSideOppCount").textContent="0";
  $("waSideTaskCount").textContent="0";
  $("waSideNotes").textContent="—";
  $("waSideIdentity")?.classList.add("hidden");
  if($("waSideDni"))$("waSideDni").textContent="—";
  if($("waSidePhoneDetail"))$("waSidePhoneDetail").textContent="—";
  $("waSideViewOpps")?.classList.add("hidden");
  $("waSideViewTasks")?.classList.add("hidden");

  if(!chat||String(chat.id||"").includes("@g.us")){
    $("waContactState").textContent="Los grupos no se vinculan automáticamente con una ficha de cliente.";
    return;
  }

  const phone=waNormalizePhone(chat.id);
  let found=null;
  for(const q of waPhoneVariants(phone)){
    try{
      const {data}=await sb.rpc("search_records",{search_text:q,sheet_filter:"BASE DE DATOS",result_limit:10});
      if(Array.isArray(data)&&data.length){found=data[0];break}
    }catch(e){}
  }

  if(!found){
    $("waContactState").innerHTML='<span class="pill amber">No está en Contactos</span>';
    
    $("waSideCreateContact").classList.remove("hidden");
    return;
  }

  waLiveState.contact=found;
  const d=found.data||{};
  const nm=contactField(d,"NOMBRE Y APELLIDOS","NOMBRE","CLIENTE","CLIENTE FINAL")||chat.name||"Contacto";
  $("waSideName").textContent=nm;
  const dni=contactField(d,"DNI / NIF","DNI","NIF","CIF","DOCUMENTO","DOCUMENTO IDENTIDAD")||"—";
  const phoneShown=contactField(d,"TELÉFONO","TELEFONO","TEL","MÓVIL","MOVIL","PHONE")||phone||"—";
  if($("waSideDni"))$("waSideDni").textContent=dni;
  if($("waSidePhoneDetail"))$("waSidePhoneDetail").textContent=phoneShown;
  $("waSideIdentity")?.classList.remove("hidden");
  $("waContactState").innerHTML='<span class="pill green">Contacto encontrado</span>';
  $("waOpenContactTop").classList.remove("hidden");
  $("waSideOpenContact").classList.remove("hidden");
  $("waSideNotes").textContent=contactField(d,"NOTAS","NOTES","OBSERVACIONES")||"—";

  await loadWaContactSideData(found,phone);
}


function oppStageName(o){
  if(o?.stage_name)return String(o.stage_name);
  const st=(salesCache?.stages||[]).find(s=>String(s.id)===String(o?.stage_id||o?.stageId));
  return String(st?.name||o?.stage||o?.status_name||"");
}
function oppIsClosed(o){
  const s=(oppStageName(o)+" "+String(o?.status||"")+" "+String(o?.result||"")).toLowerCase();
  return /(ganad|perdid|cerrad|finaliz|complet|won|lost)/.test(s);
}
function oppIsExpired(o){
  if(!o?.expected_date || oppIsClosed(o))return false;
  const d=new Date(String(o.expected_date).slice(0,10)+"T23:59:59");
  return Number.isFinite(d.getTime()) && d.getTime()<Date.now();
}
function oppUnifiedSummary(opps){
  const rows=hydrateOpportunityStageNames(opps||[]);
  const open=rows.filter(o=>!oppIsClosed(o)).length;
  const expired=rows.filter(oppIsExpired).length;
  return `<div class="oppUnifiedSummary">
    <div class="oppUnifiedStat"><span>Abiertas</span><b>${open}</b></div>
    <div class="oppUnifiedStat expired"><span>Vencidas</span><b>${expired}</b></div>
  </div>`;
}
async function oppUnifiedRefresh(){
  try{await loadSales()}catch(_){}
  try{await refreshOpportunitySideAfterChange()}catch(_){}
  try{
    if(waLiveState?.contact){
      const phone=waNormalizePhone(waLiveState.selected?.id||"");
      await loadWaContactSideData(waLiveState.contact,phone);
    }
  }catch(_){}
  try{if(currentContact && typeof renderContactProfile==="function")await renderContactProfile()}catch(_){}
}
window.oppUnifiedChangeStage=async function(id,stageId){
  if(!id||!stageId)return;
  const {error}=await sb.from("sales_opportunities").update({stage_id:stageId,position:0}).eq("id",id);
  if(error){alert(error.message);return}
  try{await runOpportunityAutomations(id)}catch(_){}
  await oppUnifiedRefresh();
};
window.oppUnifiedDelete=async function(id,title){
  if(!id)return;
  const label=String(title||"Oportunidad");
  if(!confirm(`¿Eliminar "${label}"?`))return;

  try{
    const opp=(salesCache.opportunities||[]).find(x=>String(x.id)===String(id));
    if(opp && typeof archiveToTrash==="function"){
      try{await archiveToTrash("opportunity",id,opp.title||"Oportunidad",{opportunity:opp})}catch(_){}
    }

    // Intento principal: RPC existente del CRM.
    let error=null;
    try{
      const r=await sb.rpc("delete_sales_opportunity",{opportunity_id:id});
      error=r?.error||null;
    }catch(e){error=e}

    // Respaldo: borrado directo si el RPC no eliminó.
    if(error){
      const r2=await sb.from("sales_opportunities").delete().eq("id",id);
      if(r2?.error)throw r2.error;
    }else{
      // Verificar que ya no exista; si aún existe, borrar directo.
      const chk=await sb.from("sales_opportunities").select("id").eq("id",id).maybeSingle();
      if(chk?.data){
        const r2=await sb.from("sales_opportunities").delete().eq("id",id);
        if(r2?.error)throw r2.error;
      }
    }

    // Refresco en todos los lugares donde aparece la oportunidad.
    try{await loadSales()}catch(_){}
    try{
      if(waLiveState?.contact){
        const phone=waNormalizePhone(waLiveState.selected?.id||"");
        await loadWaContactSideData(waLiveState.contact,phone);
      }
    }catch(_){}
    try{
      if(currentContact && typeof renderContactProfile==="function"){
        await renderContactProfile();
      }
    }catch(_){}

    // Si se borró desde la vista completa, volver al origen exacto.
    if(!$("opportunityFullPage")?.classList.contains("hidden")){
      await returnFromOpportunityExactly();
    }
  }catch(e){
    alert(e?.message||"No se pudo eliminar la oportunidad.");
  }
};

function oppUnifiedCard(o,{compact=false}={}){
  if(!o)return "";
  const title=esc(o.title||"Oportunidad");
  const client=esc(o.client_name||o.client||o.contact_name||"Sin cliente");
  const amount=esc(fmtMoney(o.amount||0));
  const date=esc(o.expected_date?fmtDateOnly(o.expected_date):"Sin fecha");
  const notes=esc(String(o.notes||"").trim());
  const stageName=oppStageName(o);
  const overdue=oppIsExpired(o);
  const stages=(salesCache?.stages||[]);
  const stageOptions=stages.map(s=>`<option value="${esc(s.id)}" ${String(s.id)===String(o.stage_id)?"selected":""}>${esc(s.name)}</option>`).join("");

  return `<div class="oppUnifiedCard${compact?" compact":""}${overdue?" overdue":""}" data-opp-id="${esc(o.id||"")}">
    <div class="oppUnifiedTop">
      <b class="oppUnifiedTitle">${title}</b>
      ${overdue?`<span class="oppUnifiedOverdue">VENCIDA</span>`:(stageName?`<span class="oppUnifiedStage">${esc(stageName)}</span>`:"")}
    </div>
    <div class="oppUnifiedClient">👤 ${client}</div>
    <div class="oppUnifiedAmount">${amount}</div>
    <div class="oppUnifiedMeta">
      <span>🗓️ Cierre esperado: <strong class="${overdue?"dangerText":""}">${date}</strong></span>
    </div>
    ${notes?`<div class="oppUnifiedNotes">${notes}</div>`:""}
    <div class="oppUnifiedStageControl">
      <label>Columna / estado</label>
      <select onchange="event.stopPropagation();oppUnifiedChangeStage('${esc(o.id||"")}',this.value)">
        ${stageOptions}
      </select>
    </div>
    <div class="oppUnifiedActions">
      <button type="button" onclick="event.stopPropagation();openOpportunityFull('${esc(o.id||"")}')">Ver / editar</button>
      <button type="button" class="danger" onclick="event.stopPropagation();oppUnifiedDelete('${esc(o.id||"")}')">Eliminar</button>
    </div>
  </div>`;
}

function hydrateOpportunityStageNames(opps){
  const stages=salesCache?.stages||[];
  return (opps||[]).map(o=>{
    if(o.stage_name)return o;
    const st=stages.find(s=>String(s.id)===String(o.stage_id||o.stageId));
    return st?{...o,stage_name:st.name}:o;
  });
}


async function loadWaContactSideData(rec,phone){
  try{
    const [oppR,taskR]=await Promise.all([
      sb.from("sales_opportunities").select("*").or(`record_id.eq.${rec.id},phone.ilike.%${phone.slice(-9)}%`).order("updated_at",{ascending:false}).limit(20),
      sb.from("agenda_items").select("*").eq("status","pending").ilike("customer_phone",`%${phone.slice(-9)}%`).order("starts_at",{ascending:true}).limit(20)
    ]);
    const opps=oppR.data||[],tasks=taskR.data||[];
    $("waSideOppCount").textContent=opps.length;
    $("waSideTaskCount").textContent=tasks.length;
    $("waSideOpps").innerHTML=opps.length
      ? oppUnifiedSummary(opps)+hydrateOpportunityStageNames(opps).map(o=>oppUnifiedCard(o,{compact:true})).join("")
      : '<div class="small">Sin oportunidades</div>';
    $("waSideTasks").innerHTML=tasks.map(t=>`<div class="waSideItem" onclick="openContactTaskDetail('${t.id}')"><b>${esc(t.title||"Tarea")}</b><small>${esc(t.starts_at?new Date(t.starts_at).toLocaleString("es-ES"):"Sin fecha")}</small></div>`).join("")||'<div class="small">Sin tareas pendientes</div>';
    $("waSideViewOpps")?.classList.remove("hidden");
    $("waSideViewTasks")?.classList.remove("hidden");
  }catch(e){
    console.warn("Datos laterales WhatsApp",e);
  }
}


function waPrepareCurrentContactForCrm(){
  const rec=waLiveState.contact;
  if(!rec)return false;
  currentContact=rec;
  const d=rec.data||{};
  const name=contactField(d,"NOMBRE Y APELLIDOS","NOMBRE","CLIENTE","CLIENTE FINAL")||waLiveState.selected?.name||"Contacto";
  const phone=contactField(d,"TELÉFONO","TELEFONO","TEL","MÓVIL","MOVIL","PHONE")||waNormalizePhone(waLiveState.selected?.id||"");
  if($("contactName"))$("contactName").value=name;
  if($("contactPhone"))$("contactPhone").value=phone;
  if($("contactDni"))$("contactDni").value=contactField(d,"DNI / NIF","DNI","NIF","CIF","DOCUMENTO","DOCUMENTO IDENTIDAD")||"";
  if($("contactNotes"))$("contactNotes").value=contactField(d,"NOTAS","NOTES","OBSERVACIONES")||"";
  return true;
}
window.waCreateOpportunityFromSide=async()=>{
  if(!waPrepareCurrentContactForCrm())return alert("Primero vincula este chat con un contacto.");
  if(!(salesCache?.stages||[]).length){
    try{await loadSales()}catch(e){}
  }
  openContactNewOpportunity();
};
window.waCreateTaskFromSide=()=>{
  if(!waPrepareCurrentContactForCrm())return alert("Primero vincula este chat con un contacto.");
  openContactTaskPage();
};
window.waViewOpportunitiesFromSide=async()=>{
  if(!waLiveState.contact)return;
  await openContact(waLiveState.contact.id);
  setTimeout(()=>document.querySelector('.cpTabs span:nth-child(3)')?.click(),50);
};
window.waViewTasksFromSide=async()=>{
  if(!waLiveState.contact)return;
  await openContact(waLiveState.contact.id);
  setTimeout(()=>document.querySelector('.cpTabs span:nth-child(4)')?.click(),50);
};

window.openWaMatchedContact=async()=>{
  if(!waLiveState.contact)return;
  await openContact(waLiveState.contact.id);
};


if($("waSideNewOpp"))$("waSideNewOpp").onclick=waCreateOpportunityFromSide;
if($("waSideNewTask"))$("waSideNewTask").onclick=waCreateTaskFromSide;
if($("waSideViewOpps"))$("waSideViewOpps").onclick=waViewOpportunitiesFromSide;
if($("waSideViewTasks"))$("waSideViewTasks").onclick=waViewTasksFromSide;

window.createWaContact=async()=>{
  const chat=waLiveState.selected;
  if(!chat)return;
  const phone=waNormalizePhone(chat.id);
  const suggested=chat.name||"Nuevo contacto";
  const name=prompt("Nombre del contacto",suggested);
  if(name===null)return;
  const payload={
    "NOMBRE Y APELLIDOS":name.trim()||suggested,
    "TELÉFONO":phone
  };
  try{
    const {data,error}=await sb.from("records").insert({source_sheet:"BASE DE DATOS",data:payload}).select("*").single();
    if(error)throw error;
    waLiveState.contact=data;
    await matchWaContact();
    alert("Contacto creado correctamente.");
  }catch(e){alert(e.message||"No se pudo crear el contacto.")}
};

function waNotificationToHistory(body){
  if(!body||typeof body!=="object")return null;
  const type=String(body.typeWebhook||"");
  if(!["incomingMessageReceived","outgoingMessageReceived","outgoingAPIMessageReceived"].includes(type))return null;
  return {
    type:type==="incomingMessageReceived"?"incoming":"outgoing",
    idMessage:body.idMessage||"",
    timestamp:body.timestamp||Math.floor(Date.now()/1000),
    outgoing:type!=="incomingMessageReceived",
    messageData:body.messageData||{},
    senderData:body.senderData||{}
  };
}

function waNotificationChatId(body){
  return String(body?.senderData?.chatId||body?.chatId||"");
}

function waPushLiveMessage(msg,scrollBottom=true){
  if(!msg)return;
  const id=String(msg.idMessage||"");
  if(id&&waLiveState.history.some(x=>String(x?.idMessage||"")===id))return;
  waLiveState.history.push(msg);
  renderWaMessages(scrollBottom);
}

async function sendWaLiveMessage(){
  const chat=waLiveState.selected;
  const text=$("waComposerText").value.trim();
  if(!chat||!text)return;
  $("waComposerSend").disabled=true;
  $("waComposerMsg").textContent="Enviando…";
  try{
    const r=await waApi("send",{chatId:chat.id,message:text});
    $("waComposerText").value="";
    $("waComposerMsg").textContent="Enviado";
    const localMsg={
      type:"outgoing",
      outgoing:true,
      idMessage:r.idMessage||("local-"+Date.now()),
      timestamp:Math.floor(Date.now()/1000),
      messageData:{typeMessage:"textMessage",textMessageData:{textMessage:text}},
      statusMessage:"sent",
      sendByApi:true
    };
    waPushLiveMessage(localMsg,true);
    waRememberLivePreview(chat.id,localMsg);
    renderWhatsAppChats();
    setTimeout(()=>{$("waComposerMsg").textContent=""},1800);
  }catch(e){
    $("waComposerMsg").textContent=e.message||"No se pudo enviar.";
  }finally{$("waComposerSend").disabled=false}
}

let waLastHistoryFallback=0;
function waStableSig(v){try{return JSON.stringify(v||[])}catch(_){return ""}}

let waPreviewCursor=0;
let waLastPreviewSweep=0;
let waPreviewPrimed=false;
let waLastHybridSummary=0;
const waReadSuppressUntil={};
const waProcessedMessageIds=new Set();
const waSessionStartedAt=Math.floor(Date.now()/1000);
const waLastReadAt=(()=>{
  try{return JSON.parse(localStorage.getItem("tpf_wa_last_read_at")||"{}")||{}}
  catch(_){return {}}
})();
function waSetLastReadAt(chatId,ts=Math.floor(Date.now()/1000)){
  const id=String(chatId||""); if(!id)return;
  waLastReadAt[id]=Number(ts||0);
  try{localStorage.setItem("tpf_wa_last_read_at",JSON.stringify(waLastReadAt))}catch(_){}
}
function waShouldCountIncoming(chatId,msg){
  const id=String(chatId||""); if(!id||!msg)return false;
  const mid=String(msg?.idMessage||"");
  if(mid){
    if(waProcessedMessageIds.has(mid))return false;
    waProcessedMessageIds.add(mid);
    if(waProcessedMessageIds.size>1000){
      waProcessedMessageIds.clear();
      waProcessedMessageIds.add(mid);
    }
  }
  const ts=Number(waMessageTimestamp(msg)||0);
  const lastRead=Number(waLastReadAt[id]||0);

  // Nunca contar mensajes anteriores a la última lectura.
  if(lastRead && ts && ts<=lastRead)return false;

  // Al arrancar el CRM, no convertir toda la cola histórica en "no leídos".
  // Solo empezamos a contar eventos recientes de esta sesión.
  if(!lastRead && ts && ts<waSessionStartedAt-5)return false;

  return true;
}

async function waRefreshRecentPreviews(){
  const chats=waLiveState.chats||[];
  if(!chats.length)return;

  // Prioriza los chats visibles/recientes. GREEN-API Business permite consultar
  // historial; el servidor lo hace secuencialmente para máxima fiabilidad.
  const batch=[];
  if(waLiveState.selected?.id)batch.push(waLiveState.selected.id);
  for(const c of chats){
    const id=String(c?.id||"");
    if(id&&!batch.includes(id))batch.push(id);
    if(batch.length>=10)break;
  }

  const r=await waApi("previews",{chatIds:batch});
  const rows=Array.isArray(r?.previews)?r.previews:[];
  let changed=false;

  for(const row of rows){
    const chatId=String(row?.chatId||"");
    const msg=row?.message;
    if(!chatId||!msg)continue;

    const nextId=String(msg?.idMessage||"");
    const nextText=waLivePreviewText(msg);
    const nextTs=waMessageTimestamp(msg)||0;
    const prev=waLiveState.livePreview[chatId]||null;
    const prevId=String(prev?.idMessage||"");

    if(!prev || nextId!==prevId || nextText!==prev.text || nextTs!==prev.timestamp){
      // Solo contar como nuevo después de haber establecido la foto inicial
      // del chat. Si es entrante y el chat no está abierto, suma no leído.
      if(waPreviewPrimed && nextId && nextId!==prevId && waMessageDirection(msg)==="in"){
        if(!waLiveState.selected||chatId!==waLiveState.selected.id||document.hidden){
          waIncUnread(chatId);
          waBrowserNotifyIncoming(chatId,msg,{});
        }else{
          waApi("read",{chatId}).catch(()=>{});
        }
      }
      waRememberLivePreview(chatId,msg);
      changed=true;

      if(waLiveState.selected&&chatId===waLiveState.selected.id&&nextId){
        const already=(waLiveState.history||[]).some(x=>String(x?.idMessage||"")===nextId);
        if(!already)waPushLiveMessage(msg,true);
      }
    }
  }

  waPreviewPrimed=true;
  if(changed && !$("view-whatsapplive")?.classList.contains("hidden")){
    renderWhatsAppChats();
  }
}

async function waPollOnce(){
  if(waLiveState.pollBusy)return;
  waLiveState.pollBusy=true;
  try{
    const r=await waApi("notifications");
    const bodies=Array.isArray(r?.notifications)?r.notifications:(r?.notification?[r.notification]:[]);
    let touched=false;

    for(const body of bodies){
      if(!body)continue;
      const chatId=waNotificationChatId(body);
      const msg=waNotificationToHistory(body);
      if(!msg||!chatId)continue;

      const webhookType=String(body?.typeWebhook||"");
      const direction=waMessageDirection(msg);

      // CUALQUIER mensaje real (entrante o saliente) actualiza el preview
      // de la lista inmediatamente.
      waRememberLivePreview(chatId,msg);
      try{waTrackDirection(chatId,msg)}catch(_){}
      touched=true;

      if(webhookType==="incomingMessageReceived" || direction==="in"){
        const suppressUntil=Number(waReadSuppressUntil[chatId]||0);
        const isOpen=waLiveState.selected&&chatId===waLiveState.selected.id&&!document.hidden;

        if(isOpen || Date.now()<suppressUntil){
          waSetUnread(chatId,0);
          waSetLastReadAt(chatId,Math.max(Math.floor(Date.now()/1000),Number(waMessageTimestamp(msg)||0)));
          waApi("read",{chatId}).catch(()=>{});
        }else if(waShouldCountIncoming(chatId,msg)){
          waIncUnread(chatId);
          waBrowserNotifyIncoming(chatId,msg,body);
        }
      }

      // Mensaje saliente desde teléfono o API: waTrackDirection ya registra
      // lastOutgoingAt. Eso hace desaparecer "Pendiente respuesta" cuando
      // el saliente es posterior al último entrante.
      if(direction==="out" || webhookType==="outgoingMessageReceived" || webhookType==="outgoingAPIMessageReceived"){
        try{waTrackDirection(chatId,msg)}catch(_){}
      }

      if(waLiveState.selected&&chatId===waLiveState.selected.id){
        waPushLiveMessage(msg,true);
      }
    }
    // Actualiza la lista una sola vez después de procesar todo el lote:
    // llegan avisos y previews sin provocar destellos repetidos.
    if(touched){
      try{renderWhatsAppChats()}catch(_){}
    }

    // getChats sirve para nombres/orden/base de chats, pero GREEN-API avisa
    // que su orden puede actualizarse con menos frecuencia. El preview en vivo
    // de arriba no depende de este refresco.
    const summaryNow=Date.now();
    if(summaryNow-waLastHybridSummary>10000){
      waLastHybridSummary=summaryNow;
      try{await waRefreshHybridSummary()}catch(e){}
    }

    if(touched){
      try{
        const chatsR=await waApi("chats");
        const nextChats=Array.isArray(chatsR.chats)?chatsR.chats:[];
        if(waStableSig(nextChats)!==waStableSig(waLiveState.chats)){
          waLiveState.chats=nextChats;
          if(!$("view-whatsapplive")?.classList.contains("hidden"))renderWhatsAppChats();
        }
      }catch(e){}
    }
  }catch(e){
    const now=Date.now();
    if(waLiveState.selected && now-waLastHistoryFallback>30000){
      waLastHistoryFallback=now;
      try{await loadWaHistory(false)}catch(_){}
    }
  }finally{
    waLiveState.pollBusy=false;
  }
}

function startWaPolling(){
  if(waLiveState.poll)clearInterval(waLiveState.poll);
  waPollOnce();
  waLiveState.poll=setInterval(waPollOnce,2500);
}


async function waDownloadFile(url,name="archivo",idMessage=""){
  try{
    const chatId=String(waLiveState.selected?.id||"");
    if(chatId&&idMessage){
      const qs=new URLSearchParams({
        action:"download",
        chatId,
        idMessage:String(idMessage),
        name:String(name||"archivo")
      });
      // Navegación directa a una respuesta attachment: Safari aplica su
      // ajuste "Consultar al iniciar la descarga".
      window.location.href=`/api/green?${qs.toString()}`;
      return;
    }
    // Respaldo para archivos sin idMessage.
    const a=document.createElement("a");
    a.href=url;
    a.download=name||"archivo";
    a.rel="noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }catch(e){
    window.open(url,"_blank","noopener,noreferrer");
  }
}
window.waDownloadFile=waDownloadFile;

function waTemplatesKey(){return "tpf_wa_templates_v1"}
function waDefaultTemplates(){return [
  {name:"Saludo",text:"Hola, ¿en qué podemos ayudarte?"},
  {name:"Documentación",text:"Hola. Te escribimos de The Phone Face. Cuando puedas, envíanos la documentación pendiente. Gracias."},
  {name:"Gracias",text:"Muchas gracias. Si necesitas cualquier cosa, estamos a tu disposición."}
]}
function waLoadTemplates(){try{const x=JSON.parse(localStorage.getItem(waTemplatesKey())||"null");return Array.isArray(x)?x:waDefaultTemplates()}catch(e){return waDefaultTemplates()}}
function waSaveTemplates(x){localStorage.setItem(waTemplatesKey(),JSON.stringify(x))}
function waRenderTemplates(){
  const list=waLoadTemplates();
  $("waTemplateList").innerHTML=list.map((t,i)=>`<div class="waTemplateItem"><div><b>${esc(t.name||"Plantilla")}</b><div class="waTemplateText">${esc(t.text||"")}</div></div><div><button onclick="waUseTemplate(${i})">Usar</button><button onclick="waDeleteTemplate(${i})" style="margin-left:4px;background:#fff0f0;color:#b42318">×</button></div></div>`).join("")||'<div class="small">No hay plantillas.</div>';
}
window.waUseTemplate=i=>{const t=waLoadTemplates()[i];if(t)$("waComposerText").value=t.text||"";$("waTemplateModal").classList.add("hidden");$("waComposerText").focus()};
window.waDeleteTemplate=i=>{const x=waLoadTemplates();x.splice(i,1);waSaveTemplates(x);waRenderTemplates()};
$("waTemplateBtn").onclick=()=>{waRenderTemplates();$("waTemplateModal").classList.remove("hidden")};
$("waTemplateClose").onclick=()=>$("waTemplateModal").classList.add("hidden");
$("waTemplateModal").onclick=e=>{if(e.target===$("waTemplateModal"))$("waTemplateModal").classList.add("hidden")};
$("waTemplateSave").onclick=()=>{const name=$("waTemplateName").value.trim(),text=$("waTemplateText").value.trim();if(!name||!text){alert("Escribe nombre y texto.");return}const x=waLoadTemplates();x.push({name,text});waSaveTemplates(x);$("waTemplateName").value="";$("waTemplateText").value="";waRenderTemplates()};

$("waAttachBtn").onclick=()=>$("waAttachInput").click();
$("waAttachInput").onchange=async()=>{
  const f=$("waAttachInput").files?.[0]; const chat=waLiveState.selected; if(!f||!chat)return;
  if(f.size>2500000){alert("Por ahora, desde esta pantalla el archivo puede tener hasta 2,5 MB.");$("waAttachInput").value="";return}
  $("waAttachBtn").disabled=true; $("waComposerMsg").textContent="Enviando archivo…";
  try{
    const dataUrl=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(f)});
    const caption=$("waComposerText").value.trim();
    const r=await waApi("sendfile",{chatId:chat.id,fileName:f.name,mimeType:f.type||"application/octet-stream",dataUrl,caption});
    $("waComposerText").value=""; $("waComposerMsg").textContent="Archivo enviado";
    setTimeout(()=>loadWaHistory(true),800); setTimeout(()=>{$("waComposerMsg").textContent=""},1800);
  }catch(e){$("waComposerMsg").textContent=e.message||"No se pudo enviar el archivo."}
  finally{$("waAttachBtn").disabled=false;$("waAttachInput").value=""}
};

$("waScheduleBtn").onclick=()=>{
  const chat=waLiveState.selected;if(!chat)return;
  openWaQuick({phone:waNormalizePhone(chat.id),message:$("waComposerText").value.trim()});
  $("waQuickScheduleBox").classList.remove("hidden");
  $("waQuickWhen").value=localDateTimeValue(new Date(Date.now()+60*60*1000));
  $("waQuickSend").textContent="Programar";$("waQuickSend").dataset.mode="schedule";
};

let waAutoScheduleBusy=false;
async function waAutoSendDueSchedules(){
  if(waAutoScheduleBusy||!sb)return; waAutoScheduleBusy=true;
  try{
    const now=new Date().toISOString();
    const {data,error}=await sb.from("agenda_items").select("*").eq("whatsapp_enabled",true).eq("status","pending").lte("whatsapp_scheduled_at",now).order("whatsapp_scheduled_at",{ascending:true}).limit(10);
    if(error)throw error;
    for(const row of (data||[])){
      const phone=String(row.whatsapp_phone||row.customer_phone||"").replace(/\D/g,"");
      const message=String(row.whatsapp_message||"").trim();
      if(!phone||!message)continue;
      try{await waApi("send",{chatId:phone,message});await sb.from("agenda_items").update({status:"completed"}).eq("id",row.id)}catch(e){console.warn("WhatsApp programado",e)}
    }
  }catch(e){console.warn("Programados WhatsApp",e)}finally{waAutoScheduleBusy=false}
}
setInterval(waAutoSendDueSchedules,30000); setTimeout(waAutoSendDueSchedules,5000);

$("waLiveRefresh").onclick=loadWhatsAppLive;
$("waLiveSearch").addEventListener("input",renderWhatsAppChats);
document.querySelectorAll("[data-wa-tab]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-wa-tab]").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  waLiveState.filter=b.dataset.waTab;
  renderWhatsAppChats();
});
$("waComposerSend").onclick=sendWaLiveMessage;
$("waComposerText").addEventListener("keydown",e=>{
  if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendWaLiveMessage()}
});
$("waOpenContactTop").onclick=window.openWaMatchedContact;
$("waSideOpenContact").onclick=window.openWaMatchedContact;
$("waCreateContactTop").onclick=window.createWaContact;
$("waSideCreateContact").onclick=window.createWaContact;

// Navegación móvil WhatsApp: lista <-> conversación sin perder estado.
if($("waMobileBackChats"))$("waMobileBackChats").onclick=()=>{$("view-whatsapplive")?.classList.remove("wa-mobile-chat-open")};
const _waSelectMobileBase=window.selectWhatsAppChat;
window.selectWhatsAppChat=async(chatId)=>{
  await _waSelectMobileBase(chatId);
  if(window.matchMedia("(max-width: 820px)").matches)$("view-whatsapplive")?.classList.add("wa-mobile-chat-open");
};

/* ---- script inline extraído ---- */

(function(){
 function textOf(el){return (el&&el.textContent||"").trim().toLowerCase()}
 function isWhatsAppVisible(){
   var candidates=[...document.querySelectorAll('section,main,div')];
   return candidates.some(function(el){
     var t=textOf(el);
     var s=getComputedStyle(el);
     return s.display!=="none" && t==="whatsapp";
   });
 }
 document.addEventListener("click",function(e){
   var el=e.target.closest("a,button,[role=button],li");
   if(!el)return;
   var t=textOf(el);
   if(t==="whatsapp" || (t.includes("whatsapp")&&!t.includes("programad"))){
     setTimeout(function(){document.body.classList.add("wa-fullscreen-mode")},50);
   } else if(t && !t.includes("whatsapp") && el.closest(".sidebar,nav")){
     document.body.classList.remove("wa-fullscreen-mode");
   }
 },true);
 // Si se recarga estando en WhatsApp, detectar por contenido.
 setTimeout(function(){
   var h=[...document.querySelectorAll("h1,h2,h3")].find(x=>textOf(x)==="whatsapp");
   if(h)document.body.classList.add("wa-fullscreen-mode");
 },400);
})();

/* ===== WhatsApp CRM Total ===== */
const WA_META_KEY="tpf_wa_chat_meta_v3";
const WA_HISTORY_KEY="tpf_wa_history_cache_v2";
function waMetaAll(){try{return JSON.parse(localStorage.getItem(WA_META_KEY)||"{}")}catch(e){return {}}}
function waMeta(chatId){const a=waMetaAll();return a[chatId]||{pinned:false,archived:false,tags:[],note:"",lastIncomingAt:0,lastOutgoingAt:0}}
function waMetaSave(chatId,patch){const a=waMetaAll();a[chatId]={...waMeta(chatId),...patch};localStorage.setItem(WA_META_KEY,JSON.stringify(a));renderWhatsAppChats();waUpdateStats();if(waLiveState.selected?.id===chatId)waRenderSideExtras()}
function waCacheHistory(chatId,rows){try{const all=JSON.parse(localStorage.getItem(WA_HISTORY_KEY)||"{}");all[chatId]=(rows||[]).slice(-500);localStorage.setItem(WA_HISTORY_KEY,JSON.stringify(all))}catch(e){}}
function waCachedHistory(chatId){try{return JSON.parse(localStorage.getItem(WA_HISTORY_KEY)||"{}")[chatId]||[]}catch(e){return []}}
function waIsUnanswered(chatId){
  const m=waMeta(chatId);return Number(m.lastIncomingAt||0)>Number(m.lastOutgoingAt||0);
}
function waUpdateStats(){
  const chats=waLiveState.chats||[];
  const unread=chats.reduce((n,c)=>n+waUnreadCount(c.id),0);
  const waiting=chats.filter(c=>waIsUnanswered(c.id)).length;
  if($("waStatUnread"))$("waStatUnread").textContent=unread;
  if($("waStatWaiting"))$("waStatWaiting").textContent=waiting;
}
function waTrackDirection(chatId,msg){
  if(!chatId||!msg)return;
  const ts=Number(waMessageTimestamp(msg)||Math.floor(Date.now()/1000));
  const dir=waMessageDirection(msg);
  const m=waMeta(chatId);
  if(dir==="in"&&ts>Number(m.lastIncomingAt||0))waMetaSave(chatId,{lastIncomingAt:ts});
  if(dir==="out"&&ts>Number(m.lastOutgoingAt||0))waMetaSave(chatId,{lastOutgoingAt:ts});
}

/* Re-render chats with CRM filters/metadata. */
const _waRenderChatsBase=renderWhatsAppChats;
renderWhatsAppChats=function(){
  const q=String($("waLiveSearch")?.value||"").toLowerCase().trim();
  let rows=[...(waLiveState.chats||[])];
  const f=waLiveState.filter||"all";

  if(f==="groups")rows=rows.filter(c=>String(c.id||"").includes("@g.us"));
  if(f==="contacts")rows=rows.filter(c=>String(c.id||"").includes("@c.us"));
  if(f==="unread")rows=rows.filter(c=>waUnreadCount(c.id)>0);
  if(f==="favorites")rows=rows.filter(c=>waMeta(c.id).favorite);
  if(f==="unanswered")rows=rows.filter(c=>waIsUnanswered(c.id));
  if(f==="archived")rows=rows.filter(c=>waMeta(c.id).archived);
  if(f!=="archived")rows=rows.filter(c=>!waMeta(c.id).archived);

  if(q)rows=rows.filter(c=>{
    const meta=waMeta(c.id);
    return String(c.name||c.id||"").toLowerCase().includes(q)
      ||waNormalizePhone(c.id).includes(q.replace(/\D/g,""))
      ||(meta.tags||[]).join(" ").toLowerCase().includes(q);
  });

  rows.sort((a,b)=>Number(waMeta(b.id).pinned)-Number(waMeta(a.id).pinned));

  $("waLiveChats").innerHTML=rows.map(c=>{
    const active=waLiveState.selected?.id===c.id?" active":"";
    const meta=waMeta(c.id);
    const name=c.name||waNormalizePhone(c.id)||"WhatsApp";
    const initials=waInitials(name);
    const avatar=waLiveState.avatars[String(c.id||"")]||"";
    const avStyle=avatar?` style="background-image:url('${esc(avatar)}')"`:"";

    // Usar el último mensaje real de la versión híbrida.
    const live=waLiveState.livePreview[String(c.id||"")]||null;
    const hybridLast=c?._lastMessage||null;
    const hybridPreview=hybridLast?waLivePreviewText(hybridLast):"";
    const preview=live?.text||hybridPreview||waChatServerPreview(c)||(String(c.id||"").includes("@g.us")?"Grupo":"");
    const previewTime=live?.timestamp||waMessageTimestamp(hybridLast)||c.lastMessageTime||c.lastMessageTimestamp||c.timestamp||c.lastActivityTime;
    const unread=waUnreadCount(c.id);

    const extras=[];
    if(meta.pinned)extras.push("📌");
    if(meta.favorite)extras.push("★");
    if(waIsUnanswered(c.id))extras.push('<span class="waMiniFlag">Pendiente respuesta</span>');

    return `<div class="waChatRow${active}${unread?" waHasUnread":""}" onclick="selectWhatsAppChat('${String(c.id).replaceAll("'","\\'")}')">
      <div class="waAvatar${avatar?" hasPhoto":""}" data-wa-avatar-id="${esc(c.id)}" data-wa-initials="${esc(initials)}"${avStyle}>${avatar?"":esc(initials)}</div>
      <div class="waChatRowMain">
        <div class="waChatRowTop"><b>${esc(name)}</b><span>${esc(waTime(previewTime))}</span></div>
        <div class="waChatPreviewLine">
          <div class="waChatPreview">${esc(preview)}</div>
          ${unread?`<span class="waUnreadBadge">${unread>99?"99+":unread}</span>`:""}
        </div>
        ${extras.length?`<div class="waChatMeta">${extras.join(" ")}</div>`:""}
      </div>
    </div>`;
  }).join("")||'<div class="waLiveEmpty">No hay conversaciones en este filtro.</div>';

  setTimeout(()=>hydrateWaAvatars(rows.map(c=>c.id)),20);
};

/* History cache: if GREEN-API returns less, keep the union locally. */
const _loadWaHistoryTotal=loadWaHistory;
loadWaHistory=async function(scrollBottom=true){
  if(!waLiveState.selected)return;
  const chatId=waLiveState.selected.id;
  try{
    const r=await waApi("history",{chatId,count:200});
    const remote=Array.isArray(r.messages)?r.messages:[],cached=waCachedHistory(chatId),map=new Map();
    [...cached,...remote].forEach(x=>map.set(String(x?.idMessage||("t"+waMessageTimestamp(x)+waMessageText(x))),x));
    waLiveState.history=[...map.values()];
    waLiveState.history.forEach(m=>waTrackDirection(chatId,m));waCacheHistory(chatId,waLiveState.history);renderWaMessages(scrollBottom);
  }catch(e){
    const cached=waCachedHistory(chatId);if(cached.length){waLiveState.history=cached;renderWaMessages(scrollBottom)}else $("waMessages").innerHTML=`<div class="waLiveEmpty">${esc(e.message)}</div>`;
  }
};

/* Make messages actionable. */
const _renderWaMessagesTotal=renderWaMessages;
renderWaMessages=function(scrollBottom){
  _renderWaMessagesTotal(scrollBottom);
  [...$("waMessages").querySelectorAll(".waMsg")].forEach((node,i)=>{
    const m=[...(waLiveState.history||[])].sort((a,b)=>Number(waMessageTimestamp(a)||0)-Number(waMessageTimestamp(b)||0))[i];
    if(!m)return;node.dataset.waMsgIndex=String(i);node.title="Doble clic: crear tarea, recordatorio u oportunidad";
    node.ondblclick=()=>waOpenMessageActions(m);
  });
  if(waLiveState.selected){waCacheHistory(waLiveState.selected.id,waLiveState.history);waLiveState.history.forEach(m=>waTrackDirection(waLiveState.selected.id,m))}
};

let waSelectedActionMessage=null;
window.waOpenMessageActions=(m)=>{waSelectedActionMessage=m;$("waMsgActionPreview").textContent=waMessageText(m)||"[Archivo / multimedia]";$("waMsgActionModal").classList.remove("hidden")};
$("waMsgActionClose").onclick=()=>$("waMsgActionModal").classList.add("hidden");
$("waMsgActionModal").onclick=e=>{if(e.target===$("waMsgActionModal"))$("waMsgActionModal").classList.add("hidden")};
function waPrepareMessageCrm(){
  if(!waPrepareCurrentContactForCrm())return false;return true;
}
$("waMsgTask").onclick=()=>{if(!waPrepareMessageCrm())return;openContactTaskPage();setTimeout(()=>{if($("cpTaskTitle"))$("cpTaskTitle").value="Seguimiento WhatsApp";if($("cpTaskNotes"))$("cpTaskNotes").value=waMessageText(waSelectedActionMessage)||""},30);$("waMsgActionModal").classList.add("hidden")};
$("waMsgReminder").onclick=()=>{if(!waPrepareMessageCrm())return;openContactTaskPage();setTimeout(()=>{if($("cpTaskTitle"))$("cpTaskTitle").value="Recordatorio WhatsApp";if($("cpTaskNotes"))$("cpTaskNotes").value=waMessageText(waSelectedActionMessage)||"";if($("cpTaskStarts"))$("cpTaskStarts").value=localDateTimeValue(new Date(Date.now()+24*3600*1000))},30);$("waMsgActionModal").classList.add("hidden")};
$("waMsgOpp").onclick=()=>{if(!waPrepareMessageCrm())return;openContactNewOpportunity();setTimeout(()=>{if($("oppModalNotes"))$("oppModalNotes").value=waMessageText(waSelectedActionMessage)||""},30);$("waMsgActionModal").classList.add("hidden")};
$("waMsgCopy").onclick=async()=>{try{await navigator.clipboard.writeText(waMessageText(waSelectedActionMessage)||"")}catch(e){};$("waMsgActionModal").classList.add("hidden")};

/* Pin, archive and tags */
function waRefreshChatTopButtons(){const id=waLiveState.selected?.id;if(!id)return;const m=waMeta(id);$("waPinChat").textContent=m.pinned?"★":"☆";$("waArchiveChat").textContent=m.archived?"↥":"⌄"}
$("waPinChat").onclick=()=>{const id=waLiveState.selected?.id;if(id)waMetaSave(id,{pinned:!waMeta(id).pinned});waRefreshChatTopButtons()};
$("waArchiveChat").onclick=()=>{const id=waLiveState.selected?.id;if(id)waMetaSave(id,{archived:!waMeta(id).archived});waRefreshChatTopButtons()};
function waAddTag(){const id=waLiveState.selected?.id;if(!id)return;const tag=prompt("Etiqueta (ej.: Venta, Pendiente, Documentación)","");if(!tag)return;const m=waMeta(id),tags=[...new Set([...(m.tags||[]),tag.trim()])].filter(Boolean);waMetaSave(id,{tags});waRenderSideExtras()}
function waRemoveTag(tag){const id=waLiveState.selected?.id;if(!id)return;waMetaSave(id,{tags:(waMeta(id).tags||[]).filter(x=>x!==tag)});waRenderSideExtras()}
$("waTagChat").onclick=waAddTag;$("waAddTagSide").onclick=waAddTag;

function waRenderSideExtras(){
 const id=waLiveState.selected?.id;if(!id)return;const m=waMeta(id);
 $("waSideTags").innerHTML=(m.tags||[]).map(t=>`<span class="waTagChip">${esc(t)}<button onclick="waRemoveTag('${String(t).replaceAll("'","\\'")}')">×</button></span>`).join("")||'<span class="small">Sin etiquetas</span>';
 $("waInternalNote").value=m.note||"";
 waRefreshChatTopButtons();
 const items=[];
 (waLiveState.history||[]).slice(-3).reverse().forEach(x=>items.push({t:waMessageDirection(x)==="in"?"WhatsApp recibido":"WhatsApp enviado",d:waTime(waMessageTimestamp(x))}));
 const opps=[...document.querySelectorAll("#waSideOpps .waSideItem")].slice(0,2);opps.forEach(x=>items.push({t:"Oportunidad",d:x.innerText.replace(/\n/g," · ")}));
 const tasks=[...document.querySelectorAll("#waSideTasks .waSideItem")].slice(0,2);tasks.forEach(x=>items.push({t:"Tarea",d:x.innerText.replace(/\n/g," · ")}));
 $("waActivityTimeline").innerHTML=items.map(x=>`<div class="waActivityItem"><b>${esc(x.t)}</b><small>${esc(x.d)}</small></div>`).join("")||'<div class="small">Sin actividad</div>';
}
window.waRemoveTag=waRemoveTag;
$("waSaveInternalNote").onclick=()=>{const id=waLiveState.selected?.id;if(id){waMetaSave(id,{note:$("waInternalNote").value});$("waSaveInternalNote").textContent="Guardado ✓";setTimeout(()=>$("waSaveInternalNote").textContent="Guardar nota interna",1200)}};

/* Extend chat open */
const _selectWhatsAppChatTotal=window.selectWhatsAppChat;
window.selectWhatsAppChat=async(chatId)=>{
  const id=String(chatId||"");
  waReadSuppressUntil[id]=Date.now()+15000;
  waSetLastReadAt(id,Math.floor(Date.now()/1000));
  waSetUnread(id,0);

  await _selectWhatsAppChatTotal(chatId);

  // Tras cargar historial, usar también el timestamp del último mensaje visible
  // como corte de lectura para bloquear eventos antiguos que sigan en la cola.
  try{
    const hist=waLiveState.history||[];
    const latestTs=hist.reduce((m,x)=>Math.max(m,Number(waMessageTimestamp(x)||0)),0);
    waSetLastReadAt(id,Math.max(Math.floor(Date.now()/1000),latestTs));
  }catch(_){}

  waSetUnread(id,0);
  try{renderWhatsAppChats()}catch(_){}
  try{waUpdateStats()}catch(_){}
  waApi("read",{chatId}).catch(()=>{});
  waRefreshChatTopButtons();
  waRenderSideExtras();
};

/* Media gallery */
let waMediaFilter="all";
function waExtractLinks(text){return [...String(text||"").matchAll(/https?:\/\/[^\s]+/g)].map(x=>x[0])}
function waRenderMediaGallery(){
 const items=[];(waLiveState.history||[]).forEach(m=>{const info=waMediaInfo(m),text=waMessageText(m);if(info.url||/(image|video|audio|document|file)/i.test(info.type||""))items.push({kind:info.kind,info,m});waExtractLinks(text).forEach(url=>items.push({kind:"link",url,m}))});
 const rows=waMediaFilter==="all"?items:items.filter(x=>x.kind===waMediaFilter);
 $("waMediaGallery").innerHTML=rows.map(x=>{if(x.kind==="image"&&x.info.url)return `<div class="waMediaGalleryItem"><img src="${esc(x.info.url)}"><b>${esc(x.info.name||"Foto")}</b><a href="${esc(x.info.url)}" target="_blank">Abrir</a></div>`;if(x.kind==="video"&&x.info.url)return `<div class="waMediaGalleryItem"><video src="${esc(x.info.url)}" controls></video><b>${esc(x.info.name||"Vídeo")}</b></div>`;if(x.kind==="link")return `<div class="waMediaGalleryItem"><b>Enlace</b><a href="${esc(x.url)}" target="_blank">${esc(x.url)}</a></div>`;return `<div class="waMediaGalleryItem"><b>${esc(x.info?.name||x.kind||"Archivo")}</b>${x.info?.url?`<a href="${esc(x.info.url)}" target="_blank">Abrir / descargar</a>`:"<small>Disponible desde el chat</small>"}</div>`}).join("")||'<div class="small">No hay archivos de este tipo.</div>';
}
$("waMediaChat").onclick=()=>{waMediaFilter="all";document.querySelectorAll("[data-media-filter]").forEach(x=>x.classList.toggle("active",x.dataset.mediaFilter==="all"));waRenderMediaGallery();$("waMediaModal").classList.remove("hidden")};
$("waMediaClose").onclick=()=>$("waMediaModal").classList.add("hidden");$("waMediaModal").onclick=e=>{if(e.target===$("waMediaModal"))$("waMediaModal").classList.add("hidden")};
document.querySelectorAll("[data-media-filter]").forEach(b=>b.onclick=()=>{waMediaFilter=b.dataset.mediaFilter;document.querySelectorAll("[data-media-filter]").forEach(x=>x.classList.toggle("active",x===b));waRenderMediaGallery()});

/* Template variables and slash quick replies */
function waTemplateVars(text){
 const rec=waLiveState.contact,d=rec?.data||{},name=contactField(d,"NOMBRE Y APELLIDOS","NOMBRE","CLIENTE","CLIENTE FINAL")||waLiveState.selected?.name||"",dni=contactField(d,"DNI / NIF","DNI","NIF")||"",phone=waNormalizePhone(waLiveState.selected?.id||"");
 return String(text||"").replaceAll("{nombre}",name).replaceAll("{dni}",dni).replaceAll("{telefono}",phone);
}
window.waUseTemplate=i=>{const t=waLoadTemplates()[i];if(t)$("waComposerText").value=waTemplateVars(t.text||"");$("waTemplateModal").classList.add("hidden");$("waComposerText").focus();$("waSlashMenu").classList.add("hidden")};
function waRenderSlash(){
 const v=$("waComposerText").value;if(!v.startsWith("/"))return $("waSlashMenu").classList.add("hidden");
 const q=v.slice(1).toLowerCase(),list=waLoadTemplates().filter(t=>(t.name||"").toLowerCase().includes(q)).slice(0,8);
 $("waSlashMenu").innerHTML=list.map((t,i)=>`<div class="waSlashItem" data-slash-name="${esc(t.name)}"><b>/${esc(t.name.toLowerCase().replace(/\s+/g,""))}</b><small>${esc(waTemplateVars(t.text).slice(0,90))}</small></div>`).join("");
 [...$("waSlashMenu").children].forEach((el,i)=>el.onclick=()=>{const t=list[i];$("waComposerText").value=waTemplateVars(t.text);$("waSlashMenu").classList.add("hidden");$("waComposerText").focus()});
 $("waSlashMenu").classList.toggle("hidden",!list.length);
}
$("waComposerText").addEventListener("input",waRenderSlash);

/* Multi-file preview and send */
let waPendingFiles=[];
$("waAttachInput").onchange=()=>{waPendingFiles=[...($("waAttachInput").files||[])];if(!waPendingFiles.length)return;waRenderFilePreview();$("waFilePreviewModal").classList.remove("hidden")};
function waRenderFilePreview(){
 $("waFilePreviewList").innerHTML=waPendingFiles.map((f,i)=>`<div class="waFilePreviewItem">${f.type.startsWith("image/")?`<img data-file-preview="${i}">`:"<div style='font-size:28px'>📎</div>"}<div><b>${esc(f.name)}</b><small>${(f.size/1024/1024).toFixed(2)} MB · ${esc(f.type||"archivo")}</small></div></div>`).join("");
 waPendingFiles.forEach((f,i)=>{if(f.type.startsWith("image/")){const r=new FileReader();r.onload=()=>{const im=document.querySelector(`[data-file-preview="${i}"]`);if(im)im.src=r.result};r.readAsDataURL(f)}})
}
$("waFilePreviewClose").onclick=()=>{$("waFilePreviewModal").classList.add("hidden");waPendingFiles=[];$("waAttachInput").value=""};
$("waFilePreviewSend").onclick=async()=>{
 const chat=waLiveState.selected;if(!chat)return;for(const f of waPendingFiles){if(f.size>2500000){alert(`${f.name}: supera 2,5 MB y se omitirá.`);continue}try{const dataUrl=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(f)});await waApi("sendfile",{chatId:chat.id,fileName:f.name,mimeType:f.type||"application/octet-stream",dataUrl,caption:""})}catch(e){alert(`${f.name}: ${e.message}`)}}$("waFilePreviewModal").classList.add("hidden");waPendingFiles=[];$("waAttachInput").value="";setTimeout(()=>loadWaHistory(true),900)
};

/* Drag & drop files on chat */
$("waChatActive").addEventListener("dragover",e=>{e.preventDefault()});$("waChatActive").addEventListener("drop",e=>{e.preventDefault();waPendingFiles=[...(e.dataTransfer?.files||[])];if(waPendingFiles.length){waRenderFilePreview();$("waFilePreviewModal").classList.remove("hidden")}});

/* Track sent messages as answered */
const _sendWaLiveMessageTotal=sendWaLiveMessage;
sendWaLiveMessage=async function(){const before=$("waComposerText").value;await _sendWaLiveMessageTotal();if(waLiveState.selected&&before.trim())waMetaSave(waLiveState.selected.id,{lastOutgoingAt:Math.floor(Date.now()/1000)})};

/* Dashboard stats on refresh */
const _loadWhatsAppLiveTotal=loadWhatsAppLive;
loadWhatsAppLive=async function(){await _loadWhatsAppLiveTotal();waUpdateStats();renderWhatsAppChats()};

setTimeout(waUpdateStats,500);


/* ===== Persistencia, SLA y analítica avanzada ===== */
const WA_PERSIST_KEY="tpf_wa_persist_fallback_v1";
function waLocalPersistAll(){try{return JSON.parse(localStorage.getItem(WA_PERSIST_KEY)||"{}")}catch(e){return {}}}
function waLocalPersist(chatId, rows){
  const all=waLocalPersistAll(); const prev=all[chatId]||{}; const msgMap=new Map();
  [...(prev.messages||[]),...(rows||[])].forEach(m=>msgMap.set(String(m?.idMessage||("t"+waMessageTimestamp(m)+waMessageText(m))),m));
  all[chatId]={messages:[...msgMap.values()].slice(-1500),updatedAt:Date.now()};
  localStorage.setItem(WA_PERSIST_KEY,JSON.stringify(all));
}
function waLocalPersistGet(chatId){return waLocalPersistAll()[chatId]?.messages||[]}

async function waPersistRemote(chatId, rows){
  if(!chatId||!rows?.length)return;
  const compact=rows.slice(-200).map(m=>({
    id_message:String(m?.idMessage||""),
    direction:waMessageDirection(m),
    ts:Number(waMessageTimestamp(m)||0),
    text:waMessageText(m)||"",
    type:String(m?.messageData?.typeMessage||m?.typeMessage||""),
    raw:m
  }));
  try{
    const {error}=await sb.rpc("wa_upsert_messages",{p_chat_id:chatId,p_messages:compact});
    if(error)throw error;
    $("waPersistState").textContent="Historial: guardado en CRM";
    $("waPersistState").className="waPersistState ok";
  }catch(e){
    waLocalPersist(chatId,rows);
    $("waPersistState").textContent="Historial: copia local activa";
    $("waPersistState").className="waPersistState warn";
  }
}
async function waLoadRemoteHistory(chatId){
  try{
    const {data,error}=await sb.rpc("wa_get_messages",{p_chat_id:chatId,p_limit:1500});
    if(error)throw error;
    return (data||[]).map(x=>x.raw||x);
  }catch(e){return waLocalPersistGet(chatId)}
}

const _loadWaHistoryPersistent=loadWaHistory;
loadWaHistory=async function(scrollBottom=true){
  if(!waLiveState.selected)return;
  const chatId=waLiveState.selected.id;
  try{
    const [r,persisted]=await Promise.all([waApi("history",{chatId,count:200}),waLoadRemoteHistory(chatId)]);
    const remote=Array.isArray(r.messages)?r.messages:[],cached=waCachedHistory(chatId),map=new Map();
    [...persisted,...cached,...remote].forEach(x=>map.set(String(x?.idMessage||("t"+waMessageTimestamp(x)+waMessageText(x))),x));
    waLiveState.history=[...map.values()];
    waLiveState.history.forEach(m=>waTrackDirection(chatId,m));
    waCacheHistory(chatId,waLiveState.history); waLocalPersist(chatId,waLiveState.history);
    renderWaMessages(scrollBottom);
    waPersistRemote(chatId,waLiveState.history);
    waUpdateAdvancedMetrics();
  }catch(e){
    const persisted=await waLoadRemoteHistory(chatId);
    if(persisted.length){waLiveState.history=persisted;renderWaMessages(scrollBottom)}
    else _loadWaHistoryPersistent(scrollBottom);
  }
};

function waResponseDurations(){
  const out=[];(waLiveState.chats||[]).forEach(c=>{
    const m=waMeta(c.id),inc=Number(m.lastIncomingAt||0),outg=Number(m.lastOutgoingAt||0);
    if(inc&&outg&&outg>=inc)out.push(outg-inc);
  });return out;
}
function waFmtDuration(sec){
  if(!Number.isFinite(sec)||sec<0)return "—";
  if(sec<60)return Math.round(sec)+" s";
  if(sec<3600)return Math.round(sec/60)+" min";
  return (sec/3600).toFixed(sec<7200?1:0)+" h";
}
function waUpdateAdvancedMetrics(){
  const chats=waLiveState.chats||[],unread=chats.reduce((n,c)=>n+waUnreadCount(c.id),0),waiting=chats.filter(c=>waIsUnanswered(c.id)).length;
  const handled=chats.filter(c=>Number(waMeta(c.id).lastOutgoingAt||0)>0).length,durs=waResponseDurations(),avg=durs.length?durs.reduce((a,b)=>a+b,0)/durs.length:NaN;
  if($("waStatAvgResponse"))$("waStatAvgResponse").textContent=waFmtDuration(avg);
  if($("waStatHandled"))$("waStatHandled").textContent=handled;
  if($("waAUnread"))$("waAUnread").textContent=unread;if($("waAWaiting"))$("waAWaiting").textContent=waiting;if($("waAHandled"))$("waAHandled").textContent=handled;if($("waAAvg"))$("waAAvg").textContent=waFmtDuration(avg);
  const waitingRows=chats.filter(c=>waIsUnanswered(c.id)).map(c=>({c,age:Math.max(0,Math.floor(Date.now()/1000)-Number(waMeta(c.id).lastIncomingAt||0))})).sort((a,b)=>b.age-a.age);
  if($("waAnalyticsWaitingList"))$("waAnalyticsWaitingList").innerHTML=waitingRows.map(({c,age})=>`<div class="waWaitingRow" onclick="selectWhatsAppChat('${String(c.id).replaceAll("'","\\'")}');$('waAnalyticsModal').classList.add('hidden')"><div><b>${esc(c.name||waNormalizePhone(c.id)||"WhatsApp")}</b><small>${esc(waNormalizePhone(c.id))}</small></div><small>${esc(waFmtDuration(age))} esperando</small></div>`).join("")||'<div class="small">Ninguna conversación pendiente.</div>';
  waRenderSla();
}
function waRenderSla(){
  const id=waLiveState.selected?.id;if(!id||!$("waSlaState"))return;const m=waMeta(id);
  if(!waIsUnanswered(id)){$("waSlaState").textContent="Al día";$("waSlaState").className="waSlaState ok";return}
  const age=Math.max(0,Math.floor(Date.now()/1000)-Number(m.lastIncomingAt||0));
  $("waSlaState").textContent=`Pendiente de respuesta · ${waFmtDuration(age)}`;
  $("waSlaState").className="waSlaState "+(age>=7200?"danger":age>=1800?"warn":"");
}
$("waAnalyticsBtn").onclick=()=>{waUpdateAdvancedMetrics();$("waAnalyticsModal").classList.remove("hidden")};
$("waAnalyticsClose").onclick=()=>$("waAnalyticsModal").classList.add("hidden");$("waAnalyticsModal").onclick=e=>{if(e.target===$("waAnalyticsModal"))$("waAnalyticsModal").classList.add("hidden")};

const _waUpdateStats20=waUpdateStats;
waUpdateStats=function(){_waUpdateStats20();waUpdateAdvancedMetrics()};

/* Conteos de acciones creadas desde WhatsApp */
const WA_ACTION_STATS="tpf_wa_action_stats";
function waActionStats(){try{return JSON.parse(localStorage.getItem(WA_ACTION_STATS)||'{"opps":0,"tasks":0}')}catch(e){return {opps:0,tasks:0}}}
function waActionInc(k){const s=waActionStats();s[k]=(s[k]||0)+1;localStorage.setItem(WA_ACTION_STATS,JSON.stringify(s));if($("waAOpps"))$("waAOpps").textContent=s.opps||0;if($("waATasks"))$("waATasks").textContent=s.tasks||0}
const _waCreateOppFromSide20=window.waCreateOpportunityFromSide;
window.waCreateOpportunityFromSide=async()=>{waActionInc("opps");return _waCreateOppFromSide20()};
const _waCreateTaskFromSide20=window.waCreateTaskFromSide;
window.waCreateTaskFromSide=()=>{waActionInc("tasks");return _waCreateTaskFromSide20()};

/* Búsqueda profunda en multimedia */
const _waRenderMediaGallery20=waRenderMediaGallery;
waRenderMediaGallery=function(){
  const q=String($("waMediaSearch")?.value||"").toLowerCase().trim(),items=[];
  (waLiveState.history||[]).forEach(m=>{
    const info=waMediaInfo(m),text=waMessageText(m),links=waExtractLinks(text);
    if(info.url||/(image|video|audio|document|file)/i.test(info.type||""))items.push({kind:info.kind,info,m,text});
    links.forEach(url=>items.push({kind:"link",url,m,text}));
  });
  let rows=waMediaFilter==="all"?items:items.filter(x=>x.kind===waMediaFilter);
  if(q)rows=rows.filter(x=>String(x.info?.name||x.url||x.text||"").toLowerCase().includes(q));
  $("waMediaGallery").innerHTML=rows.map(x=>{if(x.kind==="image"&&x.info.url)return `<div class="waMediaGalleryItem"><img src="${esc(x.info.url)}"><b>${esc(x.info.name||"Foto")}</b><a href="${esc(x.info.url)}" target="_blank">Abrir</a></div>`;if(x.kind==="video"&&x.info.url)return `<div class="waMediaGalleryItem"><video src="${esc(x.info.url)}" controls></video><b>${esc(x.info.name||"Vídeo")}</b></div>`;if(x.kind==="link")return `<div class="waMediaGalleryItem"><b>Enlace</b><a href="${esc(x.url)}" target="_blank">${esc(x.url)}</a></div>`;return `<div class="waMediaGalleryItem"><b>${esc(x.info?.name||x.kind||"Archivo")}</b>${x.info?.url?`<a href="${esc(x.info.url)}" target="_blank">Abrir / descargar</a>`:"<small>Disponible desde el chat</small>"}</div>`}).join("")||'<div class="small">No hay resultados.</div>';
};
$("waMediaSearch").addEventListener("input",waRenderMediaGallery);

/* Inicializar */
setTimeout(()=>{const s=waActionStats();if($("waAOpps"))$("waAOpps").textContent=s.opps||0;if($("waATasks"))$("waATasks").textContent=s.tasks||0;waUpdateAdvancedMetrics()},700);
setInterval(waUpdateAdvancedMetrics,60000);


/* ===== Plantillas persistentes en Supabase ===== */
var waTemplatesCache=[];
var waTemplatesRemoteReady=false;
waTemplatesCache=waLoadTemplates();

function waLoadTemplates(){
  return Array.isArray(waTemplatesCache) && waTemplatesCache.length
    ? waTemplatesCache
    : waDefaultTemplates();
}

function waSaveTemplates(x){
  waTemplatesCache = Array.isArray(x) ? x : [];
  localStorage.setItem(waTemplatesKey(), JSON.stringify(waTemplatesCache));
}

async function waSyncTemplatesFromSupabase(){
  try{
    const {data,error}=await sb.rpc("wa_list_templates");
    if(error)throw error;

    if(Array.isArray(data) && data.length){
      waTemplatesCache=data.map(r=>({
        id:r.id,
        name:r.name,
        text:r.body,
        category:r.category||"",
        shortcut:r.shortcut||""
      }));
      waSaveTemplates(waTemplatesCache);
    }else{
      // Primera vez: subir las plantillas locales/default existentes para no perderlas.
      const local=waLoadTemplates();
      const uploaded=[];
      for(const t of local){
        const {data:id,error:e}=await sb.rpc("wa_upsert_template",{
          p_id:null,
          p_name:t.name||"Plantilla",
          p_body:t.text||"",
          p_category:t.category||null,
          p_shortcut:t.shortcut||null
        });
        if(!e)uploaded.push({...t,id});
      }
      if(uploaded.length){
        waTemplatesCache=uploaded;
        waSaveTemplates(uploaded);
      }
    }
    waTemplatesRemoteReady=true;
    if(!$("waTemplateModal")?.classList.contains("hidden"))waRenderTemplates();
  }catch(e){
    console.warn("Plantillas Supabase:",e);
    waTemplatesRemoteReady=false;
  }
}

waRenderTemplates=function(){
  const list=waLoadTemplates();
  $("waTemplateList").innerHTML=list.map((t,i)=>`
    <div class="waTemplateItem">
      <div>
        <b>${esc(t.name||"Plantilla")}</b>
        <div class="waTemplateText">${esc(t.text||"")}</div>
      </div>
      <div>
        <button onclick="waUseTemplate(${i})">Usar</button>
        <button onclick="waEditTemplate(${i})" style="margin-left:4px">Editar</button>
        <button onclick="waDeleteTemplate(${i})" style="margin-left:4px;background:#fff0f0;color:#b42318">×</button>
      </div>
    </div>`).join("")||'<div class="small">No hay plantillas.</div>';
};

window.waEditTemplate=i=>{
  const t=waLoadTemplates()[i]; if(!t)return;
  $("waTemplateName").value=t.name||"";
  $("waTemplateText").value=t.text||"";
  $("waTemplateSave").dataset.editIndex=String(i);
  $("waTemplateSave").textContent="Guardar cambios";
};

window.waDeleteTemplate=async i=>{
  const list=waLoadTemplates(),t=list[i]; if(!t)return;
  if(!confirm(`¿Eliminar la plantilla "${t.name||"Plantilla"}"?`))return;
  if(t.id){
    const {error}=await sb.rpc("wa_delete_template",{p_id:t.id});
    if(error){alert(error.message);return}
  }
  list.splice(i,1); waSaveTemplates(list); waRenderTemplates();
};

$("waTemplateSave").onclick=async()=>{
  const name=$("waTemplateName").value.trim(),text=$("waTemplateText").value.trim();
  if(!name||!text){alert("Escribe nombre y texto.");return}
  const list=waLoadTemplates();
  const idx=Number($("waTemplateSave").dataset.editIndex);
  const editing=Number.isInteger(idx)&&idx>=0&&idx<list.length;
  const current=editing?list[idx]:null;

  $("waTemplateSave").disabled=true;
  try{
    const {data:id,error}=await sb.rpc("wa_upsert_template",{
      p_id:current?.id||null,
      p_name:name,
      p_body:text,
      p_category:current?.category||null,
      p_shortcut:current?.shortcut||null
    });
    if(error)throw error;
    const row={id,name,text,category:current?.category||"",shortcut:current?.shortcut||""};
    if(editing)list[idx]=row; else list.push(row);
    waSaveTemplates(list);
    $("waTemplateName").value=""; $("waTemplateText").value="";
    delete $("waTemplateSave").dataset.editIndex;
    $("waTemplateSave").textContent="Guardar plantilla";
    waRenderTemplates();
  }catch(e){alert(e.message||"No se pudo guardar la plantilla.")}
  finally{$("waTemplateSave").disabled=false}
};

const _waTemplateBtnSupabase=$("waTemplateBtn").onclick;
$("waTemplateBtn").onclick=async()=>{
  await waSyncTemplatesFromSupabase();
  waRenderTemplates();
  $("waTemplateModal").classList.remove("hidden");
};

/* Cargar plantillas al iniciar sesión/app; localStorage queda solo como respaldo. */
setTimeout(waSyncTemplatesFromSupabase,1200);


/* ===== Etiquetas globales CRM ===== */
let crmLabelsCache=[];
let currentContactLabelIds=[];

async function crmLoadLabels(){
  const {data,error}=await sb.rpc("crm_list_labels");
  if(error)throw error;
  crmLabelsCache=Array.isArray(data)?data:[];
  crmRenderLabelsManager();
  return crmLabelsCache;
}
function crmRenderLabelsManager(){
  if(!$("labelsGlobalList"))return;
  const q=String($("labelSearch")?.value||"").toLowerCase().trim();
  const rows=(crmLabelsCache||[]).filter(x=>!q||String(x.name||"").toLowerCase().includes(q));
  $("labelsGlobalList").innerHTML=rows.map(x=>`<div class="labelGlobalRow">
    <div class="labelGlobalName"><span class="labelDot"></span>${esc(x.name)}</div>
    <div class="labelGlobalActions">
      <button onclick="crmRenameLabel('${x.id}','${String(x.name).replaceAll("'","\\'")}')">Renombrar</button>
      <button class="danger" onclick="crmDeleteLabel('${x.id}','${String(x.name).replaceAll("'","\\'")}')">Eliminar</button>
    </div>
  </div>`).join("");
  $("labelsEmpty").classList.toggle("hidden",rows.length>0);
}
window.crmRenameLabel=async(id,name)=>{
  const next=prompt("Nuevo nombre de la etiqueta",name||"");
  if(!next||next.trim()===name)return;
  const {error}=await sb.rpc("crm_rename_label",{p_id:id,p_name:next.trim()});
  if(error)return alert(error.message);
  await crmLoadLabels(); await crmRefreshCurrentContactLabels();
};
window.crmDeleteLabel=async(id,name)=>{
  if(!confirm(`¿Eliminar la etiqueta "${name}"? Se quitará también de todos los contactos.`))return;
  const {error}=await sb.rpc("crm_delete_label",{p_id:id});
  if(error)return alert(error.message);
  await crmLoadLabels(); await crmRefreshCurrentContactLabels();
};
$("labelCreate").onclick=async()=>{
  const name=$("labelNewName").value.trim(); if(!name)return;
  $("labelCreate").disabled=true;$("labelCreateMsg").textContent="";
  try{
    const {error}=await sb.rpc("crm_create_label",{p_name:name});
    if(error)throw error;
    $("labelNewName").value="";$("labelCreateMsg").textContent="Etiqueta creada.";
    await crmLoadLabels();
  }catch(e){$("labelCreateMsg").textContent=e.message||"No se pudo crear."}
  finally{$("labelCreate").disabled=false}
};
$("labelsReload").onclick=()=>crmLoadLabels().catch(e=>alert(e.message));
$("labelSearch").addEventListener("input",crmRenderLabelsManager);

async function crmGetContactLabels(contactId){
  if(!contactId)return [];
  const {data,error}=await sb.rpc("crm_get_contact_labels",{p_contact_id:contactId});
  if(error)throw error;return Array.isArray(data)?data:[];
}
async function crmRefreshCurrentContactLabels(){
  const cid=currentContact?.id;
  if(!cid){if($("contactLabelsList"))$("contactLabelsList").innerHTML="";return}
  try{
    const rows=await crmGetContactLabels(cid);
    currentContactLabelIds=rows.map(x=>x.id);
    $("contactLabelsList").innerHTML=rows.map(x=>`<span class="contactLabelChip">${esc(x.name)}</span>`).join("")||'<span class="small">Sin etiquetas</span>';
    if(waLiveState?.contact&&String(waLiveState.contact.id)===String(cid)){
      $("waSideTags").innerHTML=rows.map(x=>`<span class="waGlobalTagChip">${esc(x.name)}</span>`).join("")||'<span class="small">Sin etiquetas</span>';
    }
  }catch(e){console.warn("Etiquetas contacto",e)}
}
$("contactManageLabels").onclick=async()=>{
  if(!currentContact)return;
  try{await crmLoadLabels()}catch(e){return alert(e.message)}
  const assigned=await crmGetContactLabels(currentContact.id);
  const ids=new Set(assigned.map(x=>x.id));
  $("contactLabelsChoices").innerHTML=(crmLabelsCache||[]).map(x=>`<label class="contactLabelChoice"><input type="checkbox" value="${x.id}" ${ids.has(x.id)?"checked":""}><span>${esc(x.name)}</span></label>`).join("")||'<div class="small">Primero crea etiquetas en el menú Etiquetas.</div>';
  $("contactLabelsModal").classList.remove("hidden");
};
$("contactLabelsClose").onclick=()=>$("contactLabelsModal").classList.add("hidden");
$("contactLabelsModal").onclick=e=>{if(e.target===$("contactLabelsModal"))$("contactLabelsModal").classList.add("hidden")};
$("contactLabelsSave").onclick=async()=>{
  if(!currentContact)return;
  const ids=[...$("contactLabelsChoices").querySelectorAll("input:checked")].map(x=>x.value);
  const {error}=await sb.rpc("crm_set_contact_labels",{p_contact_id:currentContact.id,p_label_ids:ids});
  if(error)return alert(error.message);
  $("contactLabelsModal").classList.add("hidden"); await crmRefreshCurrentContactLabels(); renderWhatsAppChats();
};

/* Cargar etiquetas al abrir una ficha */
const _openContactLabelsBase=window.openContact;
window.openContact=async function(id){const r=await _openContactLabelsBase(id);setTimeout(crmRefreshCurrentContactLabels,30);return r};

/* WhatsApp: las etiquetas pasan a ser las del contacto CRM, persistentes. */
async function waRefreshGlobalContactTags(){
  const cid=waLiveState?.contact?.id;
  if(!cid){$("waSideTags").innerHTML='<span class="small">Sin contacto vinculado</span>';return}
  try{
    const rows=await crmGetContactLabels(cid);
    $("waSideTags").innerHTML=rows.map(x=>`<span class="waGlobalTagChip">${esc(x.name)}</span>`).join("")||'<span class="small">Sin etiquetas</span>';
  }catch(e){}
}
const waAddTagSideEl=$("waAddTagSide");
const waTagChatEl=$("waTagChat");
const waOpenTagHandler=async()=>{
  if(!waLiveState?.contact)return alert("Primero vincula el chat a un contacto.");
  currentContact=waLiveState.contact;
  await crmLoadLabels();
  const assigned=await crmGetContactLabels(currentContact.id),ids=new Set(assigned.map(x=>x.id));
  $("contactLabelsChoices").innerHTML=(crmLabelsCache||[]).map(x=>`<label class="contactLabelChoice"><input type="checkbox" value="${x.id}" ${ids.has(x.id)?"checked":""}><span>${esc(x.name)}</span></label>`).join("")||'<div class="small">No hay etiquetas. Créala primero en el menú Etiquetas.</div>';
  $("contactLabelsModal").classList.remove("hidden");
};
if(waAddTagSideEl)waAddTagSideEl.onclick=waOpenTagHandler;
if(waTagChatEl)waTagChatEl.onclick=waOpenTagHandler;

const _matchWaContactLabels=matchWaContact;
matchWaContact=async function(){const r=await _matchWaContactLabels();setTimeout(waRefreshGlobalContactTags,40);return r};

/* Carga inicial y al entrar en menú Etiquetas */
document.querySelectorAll('.nav[data-view="labels"]').forEach(n=>n.addEventListener("click",()=>crmLoadLabels().catch(e=>alert(e.message))));
setTimeout(()=>crmLoadLabels().catch(()=>{}),1600);
