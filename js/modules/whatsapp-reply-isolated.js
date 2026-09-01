(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
M.register('whatsapp-reply-isolated',{install(){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let selected=null,busy=false,scheduled=false,observer=null;
  const style=document.createElement('style');
  style.textContent=`#waMessages .waMsg{position:relative}#waMessages .waBubble{position:relative}#waMessages .tpfReplyBtn{position:absolute;top:50%;transform:translateY(-50%);opacity:0;border:1px solid #dce3ec;background:#fff;border-radius:7px;padding:3px 7px;font-size:11px;cursor:pointer;z-index:3;white-space:nowrap;box-shadow:0 2px 7px #0001}#waMessages .waMsg.in .tpfReplyBtn{left:calc(100% + 7px);right:auto}#waMessages .waMsg.out .tpfReplyBtn{right:calc(100% + 7px);left:auto}#waMessages .waMsg:hover .tpfReplyBtn{opacity:1}.tpfReplyBar{display:flex;align-items:center;gap:8px;background:#f4f7fb;border-left:3px solid #4f8cff;border-radius:8px;padding:7px 9px;margin:0 8px 6px;font-size:12px}.tpfReplyBar span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tpfReplyBar button{border:0;background:transparent;font-size:18px;cursor:pointer}`;
  document.head.appendChild(style);

  function clean(v){const s=typeof v==='string'?v.trim():'';return s&&!/^\[?quotedmessage\]?$/i.test(s)?s:''}
  function deepText(o){
    if(!o||typeof o!=='object')return'';
    const direct=[o?.extendedTextMessage?.text,o?.extendedTextMessageData?.text,o?.messageData?.extendedTextMessage?.text,o?.messageData?.extendedTextMessageData?.text,o?.textMessage,o?.messageData?.textMessage,o?.messageData?.textMessageData?.textMessage,o?.text,o?.body,o?.messageText];
    for(const v of direct){const s=clean(v);if(s)return s}
    return'';
  }
  function cachedById(chatId){
    try{const all=JSON.parse(localStorage.getItem('tpf_wa_history_cache_v2')||'{}');return new Map((all?.[chatId]||[]).map(x=>[String(x?.idMessage||''),x]))}
    catch(_){return new Map()}
  }
  function realReply(m,cache){return deepText(m)||deepText(cache.get(String(m?.idMessage||'')))}
  function composer(){return document.querySelector('#view-whatsapplive .waComposer')||document.getElementById('waComposerText')?.closest('.waComposer')}
  function showBar(){
    document.getElementById('tpfReplyBar')?.remove();if(!selected)return;
    const c=composer();if(!c)return;
    const d=document.createElement('div');d.id='tpfReplyBar';d.className='tpfReplyBar';d.innerHTML=`<b>Responder</b><span>${esc(selected.text)}</span><button type="button">×</button>`;
    d.querySelector('button').onclick=()=>{selected=null;d.remove()};c.parentElement?.insertBefore(d,c);
  }
  function bindReply(button,m,text){
    const id=String(m?.idMessage||'');if(button.dataset.tpfReplyMessage===id)return;
    button.dataset.tpfReplyMessage=id;
    button.onclick=e=>{e.stopPropagation();selected={idMessage:id,text:text||((typeof waMessageText==='function'&&waMessageText(m))||'Mensaje')};showBar()};
  }
  function patch(){
    const view=document.getElementById('view-whatsapplive'),box=document.getElementById('waMessages');if(!box||!view||view.classList.contains('hidden'))return;
    let hist=[];try{hist=[...(waLiveState?.history||[])].sort((a,b)=>Number(waMessageTimestamp(a)||0)-Number(waMessageTimestamp(b)||0))}catch(_){return}
    const nodes=[...box.querySelectorAll('.waMsg')],byId=new Map(hist.map(x=>[String(x?.idMessage||''),x])),cache=cachedById(waLiveState?.selected?.id||'');
    nodes.forEach((node,index)=>{
      const nodeId=String(node.dataset.tpfMessageId||''),m=(nodeId&&byId.get(nodeId))||hist[index];if(!m)return;
      const id=String(m.idMessage||'');node.dataset.tpfMessageId=id;
      const bubble=node.querySelector('.waBubble');if(!bubble)return;
      const reply=realReply(m,cache),quoteKey=`${id}:${reply}`;
      if(reply&&node.dataset.tpfReplyQuote!==quoteKey){
        const walker=document.createTreeWalker(bubble,NodeFilter.SHOW_TEXT),texts=[];while(walker.nextNode())texts.push(walker.currentNode);
        texts.forEach(x=>{if(/^\s*\[?quotedmessage\]?\s*$/i.test(x.nodeValue||''))x.nodeValue=(x.nodeValue||'').replace(/\[?quotedmessage\]?/i,reply)});node.dataset.tpfReplyQuote=quoteKey;
      }
      let button=node.querySelector('.tpfReplyBtn');if(!button){button=document.createElement('button');button.type='button';button.className='tpfReplyBtn';button.textContent='↩ Responder';bubble.appendChild(button)}
      bindReply(button,m,reply);
    });
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;patch()})}
  function observe(){const box=document.getElementById('waMessages');if(!box||observer)return;observer=new MutationObserver(schedule);observer.observe(box,{childList:true,subtree:true});schedule()}
  function clearReply(){selected=null;document.getElementById('tpfReplyBar')?.remove()}
  async function sendQuoted(){
    if(!selected||busy)return false;
    const chat=waLiveState?.selected,text=document.getElementById('waComposerText')?.value.trim();if(!chat||!text)return false;
    busy=true;const btn=document.getElementById('waComposerSend'),msg=document.getElementById('waComposerMsg');if(btn)btn.disabled=true;if(msg)msg.textContent='Enviando…';
    try{
      const r=await fetch('/api/green-reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId:chat.id,message:text,quotedMessageId:selected.idMessage})});
      const j=await r.json().catch(()=>({}));if(!r.ok||j.ok===false)throw new Error(j.error||`Error ${r.status}`);
      document.getElementById('waComposerText').value='';if(msg)msg.textContent='Enviado';
      const localMsg={type:'outgoing',outgoing:true,idMessage:j.idMessage||('local-'+Date.now()),timestamp:Math.floor(Date.now()/1000),typeMessage:'quotedMessage',extendedTextMessage:{text,stanzaId:selected.idMessage,participant:chat.id},messageData:{typeMessage:'quotedMessage',extendedTextMessageData:{text,stanzaId:selected.idMessage,participant:chat.id}},statusMessage:'sent',sendByApi:true};
      try{waPushLiveMessage(localMsg,true);waRememberLivePreview(chat.id,localMsg);renderWhatsAppChats()}catch(_){}
      clearReply();setTimeout(()=>{if(msg)msg.textContent=''},1800);return true;
    }catch(e){if(msg)msg.textContent=e.message||'No se pudo enviar.';return true}
    finally{busy=false;if(btn)btn.disabled=false}
  }
  window.tpfWhatsAppQuotedReply=()=>selected;
  document.addEventListener('click',e=>{if(e.target?.id==='waComposerSend'&&selected){e.preventDefault();e.stopImmediatePropagation();sendQuoted()}},true);
  document.addEventListener('keydown',e=>{if(e.target?.id==='waComposerText'&&e.key==='Enter'&&!e.shiftKey&&selected){e.preventDefault();e.stopImmediatePropagation();sendQuoted()}},true);
  document.addEventListener('click',e=>{if(e.target?.closest?.('.nav[data-view="whatsapplive"]'))setTimeout(()=>{observe();schedule()},0)},true);
  observe();
}});
})();
