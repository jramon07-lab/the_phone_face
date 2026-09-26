(function(){
  'use strict';
  const M=window.TPFModules;if(!M)return;

  const REFRESH_MS=90000;
  const MATCH_BEFORE_SECONDS=180;
  const MATCH_AFTER_SECONDS=900;
  const MANUAL_KEY='tpf_wa_manual_outgoing_v1';
  const SEND_ACTIONS=['send_template','send_whatsapp_now','__send_whatsapp'];
  let latestAutomaticByPhone=new Map();
  let manualCache=null;
  let loading=false;
  let timer=0;

  function liveState(){
    try{return typeof waLiveState!=='undefined'?waLiveState:null}catch(_){return null}
  }
  function database(){
    try{return typeof sb!=='undefined'&&sb?.from?sb:(window.sb?.from?window.sb:null)}catch(_){return window.sb?.from?window.sb:null}
  }

  const digits=value=>String(value??'').replace(/\D/g,'');
  function localPhone(value){
    let valueDigits=digits(value);
    if(valueDigits.startsWith('0034'))valueDigits=valueDigits.slice(4);
    else if(valueDigits.startsWith('34')&&valueDigits.length===11)valueDigits=valueDigits.slice(2);
    return valueDigits;
  }
  function chatPhone(chat){return localPhone(chat?.id||chat?.chatId||'')}
  function seconds(value){
    const time=new Date(value||0).getTime();
    return Number.isFinite(time)?Math.floor(time/1000):0;
  }
  function manualMap(){
    if(manualCache)return manualCache;
    try{manualCache=JSON.parse(localStorage.getItem(MANUAL_KEY)||'{}')||{}}catch(_){manualCache={}}
    return manualCache;
  }
  function rememberManual(chatId){
    const phone=chatPhone({id:chatId});if(!phone)return;
    const rows=manualMap(),cutoff=Date.now()-120*86400000;
    Object.keys(rows).forEach(key=>{if(Number(rows[key]||0)<cutoff)delete rows[key]});
    rows[phone]=Date.now();
    try{localStorage.setItem(MANUAL_KEY,JSON.stringify(rows))}catch(_){}
  }
  function preview(chat){
    const id=String(chat?.id||'');
    const candidate=liveState()?.livePreview?.[id]||null;
    const storedTimestamp=Number(window.waMessageTimestamp?.(chat?._lastMessage)||0);
    const live=candidate&&Number(candidate.timestamp||0)>=storedTimestamp?candidate:null;
    const last=live||(chat?._lastMessage||null);
    const timestamp=Number(live?.timestamp||(typeof window.waMessageTimestamp==='function'?window.waMessageTimestamp(last):0)||chat?.lastMessageTime||chat?.lastMessageTimestamp||chat?.timestamp||chat?.lastActivityTime||0);
    const outgoing=typeof live?.outgoing==='boolean'?live.outgoing:(typeof window.waMessageDirection==='function'?window.waMessageDirection(last)==='out':false);
    return {timestamp,outgoing,idMessage:String(last?.idMessage||last?.id_message||'')};
  }
  function isAutomaticWaiting(chat){
    const phone=chatPhone(chat),sentAt=Number(latestAutomaticByPhone.get(phone)||0);
    if(!phone||!sentAt)return false;
    const last=preview(chat);
    if(!last.outgoing||!last.timestamp)return false;
    if(last.timestamp<sentAt-MATCH_BEFORE_SECONDS||last.timestamp>sentAt+MATCH_AFTER_SECONDS)return false;
    const manualAt=Number(manualMap()[phone]||0)/1000;
    return !(manualAt>=sentAt-MATCH_BEFORE_SECONDS&&manualAt>=last.timestamp-MATCH_BEFORE_SECONDS);
  }
  function jobPhone(row){
    const context=row?.context||{};
    return localPhone(context.phone||context.contact_phone||context.contract_party?.recipient_phone||context.contact_data?.['TELÉFONO']||'');
  }
  function ingestJobs(rows){
    const next=new Map();
    for(const row of rows||[]){
      const phone=jobPhone(row),stamp=seconds(row.completed_at||row.updated_at);
      if(phone&&stamp>Number(next.get(phone)||0))next.set(phone,stamp);
    }
    latestAutomaticByPhone=next;
    return next.size;
  }
  async function loadAutomaticSends(){
    const client=database();
    if(loading||!client)return;
    loading=true;
    try{
      const since=new Date(Date.now()-120*86400000).toISOString();
      const result=await client.from('crm_server_automation_jobs')
        .select('id,action_type,context,completed_at,updated_at')
        .eq('status','done')
        .in('action_type',SEND_ACTIONS)
        .gte('completed_at',since)
        .order('completed_at',{ascending:false})
        .limit(1000);
      if(result.error)throw result.error;
      ingestJobs(result.data||[]);
      updateAutomaticCount();
      window.renderWhatsAppChats?.();
    }catch(error){console.warn('Bandeja de WhatsApp automáticos',error)}
    finally{loading=false}
  }
  function meta(chat){return window.waMeta?.(chat.id)||{}}
  function incoming(chat){return Math.max(Number(chat?._lastIncomingAt||0),Number(meta(chat).lastIncomingAt||0),!preview(chat).outgoing?preview(chat).timestamp:0)}
  function category(chat){
    const m=meta(chat),last=preview(chat),inc=incoming(chat);
    if(m.archived)return 'archived';
    const manualState=window.TPFInboxManual?.category(chat,inc);if(manualState)return manualState;
    if(last.outgoing&&window.TPFWaAutoReplies?.isReply(last.idMessage))return 'unanswered';
    if(isAutomaticWaiting(chat)){
      const manual=Number(manualMap()[chatPhone(chat)]||0)/1000;
      if(inc>Math.max(manual,Number(m.archivedAt||0)))return 'unanswered';
      return 'automatic';
    }
    return last.timestamp?(last.outgoing?'all':'unanswered'):'all';
  }
  function automaticChats(){return (liveState()?.chats||[]).filter(c=>category(c)==='automatic')}
  function updateAutomaticCount(){
    const rows=liveState()?.chats||[];
    for(const [key,id] of [['automatic','waAutomaticCount'],['unanswered','waPendingCount'],['waiting','waWaitingCount']]){
      const badge=document.getElementById(id);if(!badge)continue;
      badge.textContent=String(rows.filter(c=>category(c)===key).length);badge.hidden=false;
    }
  }
  function ensureTab(){
    const view=document.getElementById('view-whatsapplive'),tabs=view?.querySelector('.waTabs');if(!tabs)return;
    if(!view.classList.contains('waInboxWorkspace'))view.classList.add('waInboxWorkspace');
    const labels=[['unanswered','Pendientes','waPendingCount'],['waiting','En espera','waWaitingCount'],['automatic','Automáticos','waAutomaticCount'],['all','Todos','']];
    const more=tabs.querySelector('.waCleanFilters');
    for(const [key,label,id] of labels){
      let button=view.querySelector('[data-wa-tab="'+key+'"]');
      if(!button){button=document.createElement('button');button.type='button';button.dataset.waTab=key;}
      if(!button.dataset.inboxLabel){button.innerHTML=label+(id?' <b id="'+id+'" class="waAutomaticCount">0</b>':'');button.dataset.inboxLabel='1';}
      tabs.insertBefore(button,more||null);
      button.classList.toggle('active',(liveState()?.filter||'all')===key);
    }
    if(more){for(const button of [...tabs.querySelectorAll(':scope > [data-wa-tab]')])if(!labels.some(x=>x[0]===button.dataset.waTab))more.lastChild.append(button);}
    const page=view.querySelector('.waLivePage'),body=view.querySelector('.waLiveLayout');
    // Place navigation above the three existing panes, preserving all native controls.
    if(page&&body&&tabs.parentElement!==page)page.insertBefore(tabs,body);
    let info=document.getElementById('waInboxHelp');
    if(!info){info=document.createElement('div');info.id='waInboxHelp';info.setAttribute('role','status');document.getElementById('waLiveSearch')?.parentElement.after(info);}
    const messages={unanswered:'Clientes que necesitan atención. Leer no resuelve.',waiting:'Marcadas por ti. Esperando documentación, confirmación u otra respuesta.',snoozed:'Conversaciones aplazadas hasta la fecha elegida.',automatic:'Último envío automático. Las respuestas pasan a Pendientes.',all:'Todas las conversaciones sin archivar.',archived:'Conversaciones resueltas o archivadas.'};
    info.textContent=messages[liveState()?.filter||'all']||'Filtra tus conversaciones.';
    updateAutomaticCount();decorateHeader();
  }
  function decorateHeader(){
    const button=document.getElementById('waArchiveChat'),chatId=liveState()?.selected?.id;
    if(button&&chatId){const archived=!!window.waMeta?.(chatId)?.archived;button.textContent=archived?'Reabrir':'✓ Resolver';button.title=archived?'Volver a conversaciones':'Archivar conversación resuelta. Los seguimientos continúan.';}
  }
  function decorateAutomaticRows(){
    const rows=new Map((liveState()?.chats||[]).map(c=>[String(c.id),c]));
    document.querySelectorAll('#waLiveChats .waChatRow').forEach(row=>{
      const chat=rows.get(row.dataset.waChatId);if(!chat)return;
      const key=category(chat),labels={automatic:'Automático',waiting:'En espera',unanswered:'Pendiente',snoozed:'Aplazada'};
      row.querySelectorAll('.waMiniFlag,.waAutomaticFlag,.waInboxFlag,.waInboxReason').forEach(x=>x.remove());
      if(!labels[key])return;
      const badge=document.createElement('span');badge.className='waInboxFlag '+key;badge.textContent=labels[key];
      let host=row.querySelector('.waChatMeta');if(!host){host=document.createElement('div');host.className='waChatMeta';row.querySelector('.waChatRowMain')?.append(host);}host.append(badge);
      const detail=window.TPFInboxManual?.describe(chat);if(detail){const note=document.createElement('small');note.className='waInboxReason';note.textContent=detail;host.append(note);}
    });decorateHeader();
  }
  function openAutomaticTab(tab){
    const state=liveState();if(!state)return;
    state.filter=tab.dataset.waTab;
    document.querySelectorAll('#view-whatsapplive [data-wa-tab]').forEach(b=>b.classList.toggle('active',b===tab));
    window.renderWhatsAppChats?.();ensureTab();
  }
  function wrapRenderer(){
    const base=window.renderWhatsAppChats;
    if(typeof base!=='function'||base.__tpfAutomationInbox)return false;
    const wrapped=function(...args){
      const state=liveState();if(!state)return base.apply(this,args);
      const chats=state.chats,filter=state.filter||'all';
      if(['automatic','waiting','unanswered','snoozed'].includes(filter)){
        state.chats=(chats||[]).filter(c=>category(c)===filter);state.filter='all';
      }
      try{return base.apply(this,args)}finally{state.chats=chats;state.filter=filter;updateAutomaticCount();queueMicrotask(decorateAutomaticRows);}
    };
    wrapped.__tpfAutomationInbox=true;window.renderWhatsAppChats=wrapped;return true;
  }
  function styles(){
    if(document.getElementById('tpfWaAutomationInboxCss'))return;
    const style=document.createElement('style');style.id='tpfWaAutomationInboxCss';
    style.textContent=`#view-whatsapplive .waAutomaticCount{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-left:4px;padding:0 5px;border-radius:999px;background:#e8efff;color:#315ea8;font-size:10px}#view-whatsapplive .waTabs button.active .waAutomaticCount{background:#fff;color:#172033}#view-whatsapplive .waAutomaticFlag{display:inline-flex;padding:3px 7px;border-radius:999px;background:#fff4d6;color:#8a5b00;font-size:9px;font-weight:800}#view-whatsapplive .waAutomaticCount[hidden]{display:none!important}`;
    document.head.appendChild(style);
  }
  function bindManualComposer(){
    const markLater=()=>{
      const chatId=liveState()?.selected?.id;if(!chatId)return;
      setTimeout(()=>{
        const text=String(document.getElementById('waComposerText')?.value||'');
        if(!text.trim()){rememberManual(chatId);window.renderWhatsAppChats?.()}
      },650);
    };
    const send=document.getElementById('waComposerSend');
    if(send&&!send.dataset.tpfAutomationManual){send.dataset.tpfAutomationManual='1';send.addEventListener('click',markLater)}
    const text=document.getElementById('waComposerText');
    if(text&&!text.dataset.tpfAutomationManual){text.dataset.tpfAutomationManual='1';text.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey)markLater()})}
  }
  function bind(){
    styles();ensureTab();bindManualComposer();
    const selected=document.getElementById('waChatName');if(selected)new MutationObserver(()=>{decorateHeader();}).observe(selected,{childList:true});
    const view=document.getElementById('view-whatsapplive');if(view)new MutationObserver(()=>{if(!view.classList.contains('hidden'))ensureTab();}).observe(view,{attributes:true,attributeFilter:['class']});
    document.addEventListener('click',event=>{
      const tab=event.target.closest?.('#view-whatsapplive [data-wa-tab]');
      if(tab&&['automatic','waiting','unanswered','snoozed','all'].includes(tab.dataset.waTab)){
        event.preventDefault();event.stopImmediatePropagation();openAutomaticTab(tab);
      }
      if(tab)setTimeout(()=>{ensureTab();updateAutomaticCount();if(tab.dataset.waTab==='automatic')decorateAutomaticRows()},0);
      if(event.target.closest?.('.nav[data-view="whatsapplive"],#waLiveRefresh'))setTimeout(loadAutomaticSends,180);
    },true);
    if(!wrapRenderer()){
      let tries=0;const wait=setInterval(()=>{tries++;if(wrapRenderer()||tries>40)clearInterval(wait)},100);
    }
    loadAutomaticSends();
    clearInterval(timer);timer=setInterval(()=>{
      const view=document.getElementById('view-whatsapplive');
      if(view&&!view.classList.contains('hidden'))loadAutomaticSends();
    },REFRESH_MS);
  }
  window.TPFAutomationInbox={isAutomaticWaiting,category,ingestJobs,reload:loadAutomaticSends};
  M.register('whatsapp-automation-inbox',{install(){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind()}});
})();
