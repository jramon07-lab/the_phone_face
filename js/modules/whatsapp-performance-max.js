(function(){
'use strict';
const M=window.TPFModules;if(!M)return;

const CHAT_PAGE_SIZE=80;
const AVATAR_BATCH_SIZE=12;
const AVATAR_MAX_RETRIES=3;
const waPerformancePage={key:'',limit:CHAT_PAGE_SIZE,total:0,loadingMore:false,scrollFrame:0,avatarFrame:0};
const waAvatarQueue=[];
const waAvatarQueued=new Set();
const waAvatarRetry=new Map();
let waAvatarDraining=false;

function waPerformanceText(value){
  return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
function waPerformanceDigits(value){return String(value??'').replace(/\D/g,'')}
function waPerformanceMeta(chatId){return typeof waMeta==='function'?(waMeta(chatId)||{}):{}}
function waPerformanceUnread(chat){
  const local=typeof waUnreadCount==='function'?Number(waUnreadCount(chat?.id)||0):0;
  const server=typeof waChatServerUnread==='function'?Number(waChatServerUnread(chat)||0):0;
  return Math.max(local,server);
}
function waPerformanceUnanswered(chat){
  if(chat&&typeof chat==='object'&&typeof chat.__tpfPending==='boolean')return chat.__tpfPending;
  const chatId=chat&&typeof chat==='object'?chat.id:chat;
  return typeof waIsUnanswered==='function'&&waIsUnanswered(chatId);
}
function waPerformanceMatches(chat,query){
  const textQuery=waPerformanceText(query);
  if(!textQuery)return true;
  const meta=waPerformanceMeta(chat?.id);
  const text=[chat?.name,chat?.chatName,chat?.contactName,chat?.id,...(Array.isArray(meta.tags)?meta.tags:[])].map(waPerformanceText).join(' ');
  if(text.includes(textQuery))return true;
  const phoneQuery=waPerformanceDigits(query);
  // Un término alfabético produce ""; nunca debe convertir includes("") en una coincidencia universal.
  return !!phoneQuery&&String(typeof waNormalizePhone==='function'?waNormalizePhone(chat?.id):chat?.id||'').includes(phoneQuery);
}
function waPerformanceFilterRows(chats,filter,query){
  let rows=[...(Array.isArray(chats)?chats:[])];
  const f=String(filter||'all');
  if(f==='groups')rows=rows.filter(c=>String(c?.id||'').includes('@g.us'));
  if(f==='contacts')rows=rows.filter(c=>String(c?.id||'').includes('@c.us'));
  if(f==='unread')rows=rows.filter(c=>waPerformanceUnread(c)>0);
  if(f==='favorites')rows=rows.filter(c=>{
    const meta=waPerformanceMeta(c?.id);
    return !!(meta.favorite||meta.pinned);
  });
  if(f==='unanswered')rows=rows.filter(c=>waPerformanceUnanswered(c));
  if(f==='archived')rows=rows.filter(c=>!!waPerformanceMeta(c?.id).archived);
  else rows=rows.filter(c=>!waPerformanceMeta(c?.id).archived);
  if(String(query||'').trim())rows=rows.filter(c=>waPerformanceMatches(c,query));
  rows.sort((a,b)=>Number(!!waPerformanceMeta(b?.id).pinned)-Number(!!waPerformanceMeta(a?.id).pinned));
  return rows;
}

function waPerformanceEscapeSelector(value){
  if(window.CSS?.escape)return window.CSS.escape(String(value));
  return String(value).replace(/["\\]/g,'\\$&');
}
function waPerformanceApplyAvatar(chatId,url){
  document.querySelectorAll(`[data-wa-avatar-id="${waPerformanceEscapeSelector(chatId)}"]`).forEach(el=>{
    if(typeof waApplyAvatar==='function')waApplyAvatar(el,url,el.dataset.waInitials||'W');
  });
}
function waPerformanceAvatarElements(chatId){
  return [...document.querySelectorAll(`[data-wa-avatar-id="${waPerformanceEscapeSelector(chatId)}"]`)];
}
function waPerformanceAvatarVisible(chatId){
  const box=document.getElementById('waLiveChats');
  const elements=waPerformanceAvatarElements(chatId).filter(el=>box?.contains?.(el));
  if(!elements.length)return false;
  if(!box?.getBoundingClientRect)return true;
  const bounds=box.getBoundingClientRect();
  if(!bounds||(!bounds.height&&!bounds.width))return true;
  return elements.some(el=>{
    const rect=el.getBoundingClientRect?.();
    return !rect||rect.bottom>=bounds.top-48&&rect.top<=bounds.bottom+48;
  });
}
function waPerformanceVisibleAvatarIds(candidateIds=[]){
  const box=document.getElementById('waLiveChats');if(!box)return[];
  const allowed=new Set(candidateIds.map(String));
  const all=[...box.querySelectorAll('[data-wa-avatar-id]')];
  const bounds=box.getBoundingClientRect?.();
  const noLayout=!bounds||(!bounds.height&&!bounds.width);
  return [...new Set(all.filter(el=>{
    const id=String(el.dataset.waAvatarId||'');
    if(!id||(allowed.size&&!allowed.has(id)))return false;
    if(noLayout)return true;
    const rect=el.getBoundingClientRect?.();
    return !rect||rect.bottom>=bounds.top-48&&rect.top<=bounds.bottom+48;
  }).map(el=>String(el.dataset.waAvatarId||'')))];
}
function waPerformanceAvatarUrl(result){
  return String((result?.base64Avatar?`data:image/jpeg;base64,${result.base64Avatar}`:'')||result?.urlAvatar||'');
}
function waPerformanceScheduleAvatarRetry(chatId,state){
  if(state.attempts<AVATAR_MAX_RETRIES){
    const delay=Math.min(600*(2**(state.attempts-1)),4000);
    clearTimeout(state.timer);
    state.timer=setTimeout(()=>{
      state.timer=0;
      if(waPerformanceAvatarVisible(chatId))waPerformanceQueueAvatars([chatId]);
    },delay);
    return;
  }
  // Después de varios fallos deja descansar al proveedor. Un scroll posterior podrá reintentarlo.
  state.attempts=0;
  state.cooldownUntil=Date.now()+60000;
}
async function waPerformanceLoadAvatar(chatId){
  const id=String(chatId||'');if(!id)return;
  const state=waAvatarRetry.get(id)||{attempts:0,cooldownUntil:0,timer:0,loading:false,resolvedEmpty:false};
  waAvatarRetry.set(id,state);
  if(state.loading||state.resolvedEmpty||Date.now()<Number(state.cooldownUntil||0))return;
  const current=waLiveState?.avatars?.[id];
  if(current){state.attempts=0;state.cooldownUntil=0;waPerformanceApplyAvatar(id,current);return}
  state.loading=true;
  try{
    if(waLiveState?.avatarPending?.[id]){
      const pendingUrl=await waLiveState.avatarPending[id];
      if(pendingUrl){state.attempts=0;state.cooldownUntil=0;waPerformanceApplyAvatar(id,pendingUrl);return}
    }
    const result=await waApi('avatar',{chatId:id});
    const url=waPerformanceAvatarUrl(result);
    if(!url&&result?.degraded)throw new Error(result.reason||'avatar_temporalmente_no_disponible');
    if(waLiveState?.avatars)waLiveState.avatars[id]=url;
    state.attempts=0;state.cooldownUntil=0;state.resolvedEmpty=!url;
    waPerformanceApplyAvatar(id,url);
  }catch(_){
    if(waLiveState?.avatars?.[id]==='')delete waLiveState.avatars[id];
    state.attempts+=1;
    waPerformanceScheduleAvatarRetry(id,state);
  }finally{state.loading=false}
}
async function waPerformanceDrainAvatarQueue(){
  if(waAvatarDraining)return;
  waAvatarDraining=true;
  try{
    while(waAvatarQueue.length){
      const batch=waAvatarQueue.splice(0,AVATAR_BATCH_SIZE);
      for(const id of batch){
        waAvatarQueued.delete(id);
        if(waPerformanceAvatarVisible(id))await waPerformanceLoadAvatar(id);
        await new Promise(resolve=>setTimeout(resolve,55));
      }
      if(waAvatarQueue.length)await new Promise(resolve=>setTimeout(resolve,120));
    }
  }finally{waAvatarDraining=false}
}
function waPerformanceQueueAvatars(chatIds=[]){
  for(const raw of chatIds){
    const id=String(raw||'');if(!id||waAvatarQueued.has(id))continue;
    const state=waAvatarRetry.get(id);
    if(state?.loading||state?.resolvedEmpty||Date.now()<Number(state?.cooldownUntil||0))continue;
    const cached=waLiveState?.avatars?.[id];
    if(cached){waPerformanceApplyAvatar(id,cached);continue}
    waAvatarQueued.add(id);waAvatarQueue.push(id);
  }
  void waPerformanceDrainAvatarQueue();
}
function waPerformanceHydrateVisible(candidateIds=[]){
  waPerformanceQueueAvatars(waPerformanceVisibleAvatarIds(candidateIds));
}
function waPerformanceScheduleVisibleAvatars(candidateIds=[]){
  if(waPerformancePage.avatarFrame)return;
  const schedule=window.requestAnimationFrame||((fn)=>setTimeout(fn,16));
  waPerformancePage.avatarFrame=schedule(()=>{
    waPerformancePage.avatarFrame=0;
    waPerformanceHydrateVisible(candidateIds);
  });
}

function waPerformancePreview(chat){
  const live=waLiveState.livePreview?.[String(chat?.id||'')]||null;
  const hybridLast=chat?._lastMessage||null;
  const hybridPreview=hybridLast&&typeof waLivePreviewText==='function'?waLivePreviewText(hybridLast):'';
  const server=typeof waChatServerPreview==='function'?waChatServerPreview(chat):'';
  return live?.text||hybridPreview||server||(String(chat?.id||'').includes('@g.us')?'Grupo':'');
}
function waPerformancePreviewTime(chat){
  const live=waLiveState.livePreview?.[String(chat?.id||'')]||null;
  const hybridLast=chat?._lastMessage||null;
  return live?.timestamp||(typeof waMessageTimestamp==='function'?waMessageTimestamp(hybridLast):0)||chat?.lastMessageTime||chat?.lastMessageTimestamp||chat?.timestamp||chat?.lastActivityTime;
}
function waPerformanceRenderRow(chat){
  const active=waLiveState.selected?.id===chat.id?' active':'';
  const meta=waPerformanceMeta(chat.id);
  const name=chat.name||(typeof waNormalizePhone==='function'?waNormalizePhone(chat.id):'')||'WhatsApp';
  const initials=typeof waInitials==='function'?waInitials(name):String(name).slice(0,2).toUpperCase();
  const avatar=waLiveState.avatars?.[String(chat.id||'')]||'';
  const avStyle=avatar?` style="background-image:url('${esc(avatar)}')"`:'';
  const unread=waPerformanceUnread(chat);
  const extras=[];
  if(meta.pinned)extras.push('📌');
  if(meta.favorite)extras.push('★');
  if(waPerformanceUnanswered(chat))extras.push('<span class="waMiniFlag">Pendiente respuesta</span>');
  return `<div class="waChatRow${active}${unread?' waHasUnread':''}" onclick="selectWhatsAppChat('${String(chat.id).replaceAll("'","\\'")}')"><div class="waAvatar${avatar?' hasPhoto':''}" data-wa-avatar-id="${esc(chat.id)}" data-wa-initials="${esc(initials)}"${avStyle}>${avatar?'':esc(initials)}</div><div class="waChatRowMain"><div class="waChatRowTop"><b>${esc(name)}</b><span>${esc(typeof waTime==='function'?waTime(waPerformancePreviewTime(chat)):'')}</span></div><div class="waChatPreviewLine"><div class="waChatPreview">${esc(waPerformancePreview(chat))}</div>${unread?`<span class="waUnreadBadge">${unread>99?'99+':unread}</span>`:''}</div>${extras.length?`<div class="waChatMeta">${extras.join(' ')}</div>`:''}</div></div>`;
}
function waPerformanceLoadMore(){
  if(waPerformancePage.loadingMore||waPerformancePage.limit>=waPerformancePage.total)return;
  waPerformancePage.loadingMore=true;
  const box=document.getElementById('waLiveChats');
  const scrollTop=Number(box?.scrollTop||0);
  waPerformancePage.limit=Math.min(waPerformancePage.total,waPerformancePage.limit+CHAT_PAGE_SIZE);
  try{window.renderWhatsAppChats?.()}finally{
    if(box)box.scrollTop=scrollTop;
    waPerformancePage.loadingMore=false;
  }
}
function waPerformanceBindList(box){
  if(!box||box.__tpfWaProgressiveBound)return;
  box.__tpfWaProgressiveBound=true;
  box.addEventListener('scroll',()=>{
    waPerformanceScheduleVisibleAvatars();
    const remaining=Number(box.scrollHeight||0)-Number(box.scrollTop||0)-Number(box.clientHeight||0);
    if(remaining>180||waPerformancePage.limit>=waPerformancePage.total||waPerformancePage.scrollFrame)return;
    const schedule=window.requestAnimationFrame||((fn)=>setTimeout(fn,16));
    waPerformancePage.scrollFrame=schedule(()=>{waPerformancePage.scrollFrame=0;waPerformanceLoadMore()});
  },{passive:true});
  box.addEventListener('click',event=>{
    if(event.target.closest?.('.waLiveLoadMore'))waPerformanceLoadMore();
  });
}

function install(){
  try{
    if(typeof hydrateWaAvatars==='function')window.hydrateWaAvatars=async function(chatIds=[]){waPerformanceHydrateVisible(chatIds)};

    if(typeof loadWaHistory==='function')window.loadWaHistory=async function(scrollBottom=true){
      if(!waLiveState.selected)return;
      try{
        const r=await waApi('history',{chatId:waLiveState.selected.id,count:40});
        const nextHistory=Array.isArray(r.messages)?r.messages:[];
        if(waStableSig(nextHistory)!==waStableSig(waLiveState.history)){
          waLiveState.history=nextHistory;
          renderWaMessages(scrollBottom);
        }else if(scrollBottom){
          const box=document.getElementById('waMessages');if(box)box.scrollTop=box.scrollHeight;
        }
      }catch(e){
        const box=document.getElementById('waMessages');if(box)box.innerHTML=`<div class="waLiveEmpty">${esc(e.message||'No se pudo cargar la conversación')}</div>`;
      }
    };

    if(typeof renderWhatsAppChats==='function'){
      const enhancedRender=function(){
        const search=document.getElementById('waLiveSearch');
        const query=String(search?.value||'').trim();
        const filter=String(waLiveState.filter||'all');
        const key=`${filter}\u0000${waPerformanceText(query)}`;
        const keyChanged=key!==waPerformancePage.key;
        if(keyChanged){waPerformancePage.key=key;waPerformancePage.limit=CHAT_PAGE_SIZE}
        const rows=waPerformanceFilterRows(waLiveState.chats,filter,query);
        waPerformancePage.total=rows.length;
        const visible=rows.slice(0,waPerformancePage.limit);
        const box=document.getElementById('waLiveChats');if(!box)return;
        waPerformanceBindList(box);
        const oldTop=Number(box.scrollTop||0);
        box.innerHTML=visible.map(waPerformanceRenderRow).join('')||'<div class="waLiveEmpty">No hay conversaciones en este filtro.</div>';
        if(rows.length>visible.length){
          const remaining=rows.length-visible.length;
          box.insertAdjacentHTML('beforeend',`<button type="button" class="waLiveEmpty waLiveLoadMore" style="display:block;width:100%;border:0;background:#fff;cursor:pointer">Mostrar más (${remaining})</button>`);
        }
        box.scrollTop=keyChanged?0:oldTop;
        waPerformanceScheduleVisibleAvatars(visible.map(c=>c.id));
      };
      enhancedRender.__tpfPerformanceMax=true;
      window.renderWhatsAppChats=enhancedRender;
    }

    const search=document.getElementById('waLiveSearch');
    if(search&&!search.__tpfWaPerformanceSearch){
      search.__tpfWaPerformanceSearch=true;
      // El listener original conserva una referencia al render antiguo; sustitúyelo sin bloquear extensiones futuras.
      if(typeof _waRenderChatsBase==='function')search.removeEventListener('input',_waRenderChatsBase);
      search.addEventListener('input',()=>window.renderWhatsAppChats?.());
    }

    if(!window.fetch.__tpfWaAvatarSerialized){
      const originalFetch=window.fetch.bind(window);
      let avatarInFlight=0;
      const serializedFetch=async function(input,init){
        const url=typeof input==='string'?input:(input&&input.url)||'';
        if(String(url).includes('/api/green?action=avatar')){
          while(avatarInFlight>=1)await new Promise(resolve=>setTimeout(resolve,80));
          avatarInFlight++;
          try{return await originalFetch(input,init)}finally{avatarInFlight=Math.max(0,avatarInFlight-1)}
        }
        return originalFetch(input,init);
      };
      serializedFetch.__tpfWaAvatarSerialized=true;
      window.fetch=serializedFetch;
    }
  }catch(e){console.warn('WhatsApp performance max',e)}
}
M.register('whatsapp-performance-max',{install});
})();
