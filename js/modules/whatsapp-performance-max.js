(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
function install(){
  try{
    if(typeof hydrateWaAvatars==='function'){
      hydrateWaAvatars=async function(chatIds=[]){
        const ids=[...new Set(chatIds.map(String).filter(Boolean))].slice(0,8);
        for(const id of ids){
          try{
            const url=await waLoadAvatar(id);
            document.querySelectorAll(`[data-wa-avatar-id="${CSS.escape(id)}"]`).forEach(el=>waApplyAvatar(el,url,el.dataset.waInitials||'W'));
          }catch(_){}
          await new Promise(r=>setTimeout(r,60));
        }
      };
    }

    if(typeof loadWaHistory==='function'){
      loadWaHistory=async function(scrollBottom=true){
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
    }

    if(typeof renderWhatsAppChats==='function'){
      renderWhatsAppChats=function(){
        const search=document.getElementById('waLiveSearch');
        const q=String(search?.value||'').toLowerCase().trim();
        let rows=waLiveState.chats||[];
        if(waLiveState.filter==='groups')rows=rows.filter(c=>String(c.id||'').includes('@g.us'));
        if(waLiveState.filter==='contacts')rows=rows.filter(c=>String(c.id||'').includes('@c.us'));
        if(waLiveState.filter==='unread')rows=rows.filter(c=>waUnreadCount(c.id)>0);
        if(q)rows=rows.filter(c=>String(c.name||c.id||'').toLowerCase().includes(q)||waNormalizePhone(c.id).includes(q.replace(/\D/g,'')));
        const total=rows.length;
        rows=rows.slice(0,80);
        const box=document.getElementById('waLiveChats');if(!box)return;
        box.innerHTML=rows.map(c=>{
          const active=waLiveState.selected?.id===c.id?' active':'';
          const name=c.name||waNormalizePhone(c.id)||'WhatsApp';
          const initials=waInitials(name);
          const avatar=waLiveState.avatars[String(c.id||'')]||'';
          const avStyle=avatar?` style="background-image:url('${esc(avatar)}')"`:'';
          const live=waLiveState.livePreview[String(c.id||'')]||null;
          const hybridLast=c?._lastMessage||null;
          const serverPreview=waChatServerPreview(c);
          const hybridPreview=hybridLast?waLivePreviewText(hybridLast):'';
          const preview=(live?.text||hybridPreview||serverPreview||(String(c.id||'').includes('@g.us')?'Grupo':''));
          const previewTime=live?.timestamp||waMessageTimestamp(hybridLast)||c.lastMessageTime||c.lastMessageTimestamp||c.timestamp||c.lastActivityTime;
          const unread=Math.max(waUnreadCount(c.id),waChatServerUnread(c));
          return `<div class="waChatRow${active}${unread?' waHasUnread':''}" onclick="selectWhatsAppChat('${String(c.id).replaceAll("'","\\'")}')"><div class="waAvatar${avatar?' hasPhoto':''}" data-wa-avatar-id="${esc(c.id)}" data-wa-initials="${esc(initials)}"${avStyle}>${avatar?'':esc(initials)}</div><div class="waChatRowMain"><div class="waChatRowTop"><b>${esc(name)}</b><span>${esc(waTime(previewTime))}</span></div><div class="waChatPreviewLine"><div class="waChatPreview">${esc(preview)}</div>${unread?`<span class="waUnreadBadge">${unread>99?'99+':unread}</span>`:''}</div></div></div>`;
        }).join('')||'<div class="waLiveEmpty">No hay conversaciones en este filtro.</div>';
        if(total>80&&!q)box.insertAdjacentHTML('beforeend','<div class="waLiveEmpty" style="padding:10px">Mostrando las 80 conversaciones más recientes. Usa el buscador para localizar otras.</div>');
        setTimeout(()=>hydrateWaAvatars(rows.slice(0,8).map(c=>c.id)),250);
      };
    }

    const originalFetch=window.fetch.bind(window);
    let avatarInFlight=0;
    window.fetch=async function(input,init){
      const url=typeof input==='string'?input:(input&&input.url)||'';
      if(String(url).includes('/api/green?action=avatar')){
        while(avatarInFlight>=1)await new Promise(r=>setTimeout(r,80));
        avatarInFlight++;
        try{return await originalFetch(input,init)}finally{avatarInFlight=Math.max(0,avatarInFlight-1)}
      }
      return originalFetch(input,init);
    };
  }catch(e){console.warn('WhatsApp performance max',e)}
}
M.register('whatsapp-performance-max',{install});
})();