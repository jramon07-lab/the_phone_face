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
    const live=window.waLiveState?.livePreview?.[id]||null;
    const last=live||(chat?._lastMessage||null);
    const timestamp=Number(live?.timestamp||(typeof window.waMessageTimestamp==='function'?window.waMessageTimestamp(last):0)||chat?.lastMessageTime||chat?.lastMessageTimestamp||chat?.timestamp||chat?.lastActivityTime||0);
    const outgoing=typeof live?.outgoing==='boolean'?live.outgoing:(typeof window.waMessageDirection==='function'?window.waMessageDirection(last)==='out':false);
    return {timestamp,outgoing};
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
    if(loading||!window.sb?.from)return;
    loading=true;
    try{
      const since=new Date(Date.now()-120*86400000).toISOString();
      const result=await window.sb.from('crm_server_automation_jobs')
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
  function automaticChats(){return (window.waLiveState?.chats||[]).filter(isAutomaticWaiting)}
  function updateAutomaticCount(){
    const badge=document.getElementById('waAutomaticCount');if(!badge)return;
    const count=automaticChats().length;
    badge.textContent=String(count);
    badge.hidden=count===0;
  }
  function ensureTab(){
    const tabs=document.querySelector('#view-whatsapplive .waTabs');if(!tabs)return;
    const all=tabs.querySelector('[data-wa-tab="all"]');if(all&&all.textContent.trim()==='Todas')all.textContent='Conversaciones';
    if(!tabs.querySelector('[data-wa-tab="automatic"]')){
      const button=document.createElement('button');
      button.type='button';button.dataset.waTab='automatic';
      button.innerHTML='Automáticos <b id="waAutomaticCount" class="waAutomaticCount" hidden>0</b>';
      all?.insertAdjacentElement('afterend',button);
    }
    updateAutomaticCount();
  }
  function decorateAutomaticRows(){
    if(window.waLiveState?.filter!=='automatic')return;
    document.querySelectorAll('#waLiveChats .waChatRow .waChatMeta').forEach(meta=>{
      if(meta.querySelector('.waAutomaticFlag'))return;
      meta.insertAdjacentHTML('afterbegin','<span class="waAutomaticFlag">⚡ Automático · esperando respuesta</span> ');
    });
    document.querySelectorAll('#waLiveChats .waChatRow').forEach(row=>{
      if(row.querySelector('.waChatMeta'))return;
      row.querySelector('.waChatRowMain')?.insertAdjacentHTML('beforeend','<div class="waChatMeta"><span class="waAutomaticFlag">⚡ Automático · esperando respuesta</span></div>');
    });
  }
  function wrapRenderer(){
    const base=window.renderWhatsAppChats;
    if(typeof base!=='function'||base.__tpfAutomationInbox)return false;
    const wrapped=function(...args){
      const state=window.waLiveState;
      if(!state)return base.apply(this,args);
      const chats=state.chats,filter=state.filter||'all';
      if(filter==='automatic'){
        state.chats=(chats||[]).filter(isAutomaticWaiting);state.filter='all';
      }else if(filter!=='archived'){
        state.chats=(chats||[]).filter(chat=>!isAutomaticWaiting(chat));
      }
      try{return base.apply(this,args)}finally{
        state.chats=chats;state.filter=filter;
        updateAutomaticCount();
        queueMicrotask(decorateAutomaticRows);
      }
    };
    wrapped.__tpfAutomationInbox=true;
    window.renderWhatsAppChats=wrapped;
    return true;
  }
  function styles(){
    if(document.getElementById('tpfWaAutomationInboxCss'))return;
    const style=document.createElement('style');style.id='tpfWaAutomationInboxCss';
    style.textContent=`#view-whatsapplive .waAutomaticCount{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-left:4px;padding:0 5px;border-radius:999px;background:#e8efff;color:#315ea8;font-size:10px}#view-whatsapplive .waTabs button.active .waAutomaticCount{background:#fff;color:#172033}#view-whatsapplive .waAutomaticFlag{display:inline-flex;padding:3px 7px;border-radius:999px;background:#fff4d6;color:#8a5b00;font-size:9px;font-weight:800}#view-whatsapplive .waAutomaticCount[hidden]{display:none!important}`;
    document.head.appendChild(style);
  }
  function bindManualComposer(){
    const markLater=()=>{
      const chatId=window.waLiveState?.selected?.id;if(!chatId)return;
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
    document.addEventListener('click',event=>{
      const tab=event.target.closest?.('#view-whatsapplive [data-wa-tab]');
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
  window.TPFAutomationInbox={isAutomaticWaiting,ingestJobs,reload:loadAutomaticSends};
  M.register('whatsapp-automation-inbox',{install(){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind()}});
})();

