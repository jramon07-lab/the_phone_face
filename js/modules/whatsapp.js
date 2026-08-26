(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M) return;

  let greenStateCache={at:0,state:''};
  const fileResultCache=new Map();
  let fileSafeChain=Promise.resolve();

  function normalizeOutgoingChatId(value){
    const raw=String(value||'').trim();
    if(!raw) return '';
    const suffixMatch=raw.match(/@(c\.us|lid|g\.us)$/i);
    const suffix=suffixMatch?`@${suffixMatch[1].toLowerCase()}`:'@c.us';
    let digits=raw.replace(/@.*$/,'').replace(/\D/g,'');
    if(suffix==='@c.us' && digits.length===9) digits='34'+digits;
    if(suffix==='@c.us' && (digits.length<10 || digits.length>15)) return '';
    if((suffix==='@lid' || suffix==='@g.us') && !digits) return '';
    return `${digits}${suffix}`;
  }

  async function getGreenState(baseApi){
    const now=Date.now();
    if(greenStateCache.state && now-greenStateCache.at<15000) return greenStateCache.state;
    try{
      const r=await baseApi('state');
      const state=String(r?.state||r?.data?.stateInstance||'').toLowerCase();
      greenStateCache={at:now,state};
      return state;
    }catch(_){
      greenStateCache={at:now,state:'unknown'};
      return 'unknown';
    }
  }

  function providerNotReadyError(err){
    const status=Number(err?.status||err?.greenStatus||0);
    const text=String(err?.message||err?.error||err||'').toLowerCase();
    return status===400 && (text.includes('starting')||text.includes('not authorized')||text.includes('not authorised'));
  }

  async function safeFileRequest(body){
    const chatId=normalizeOutgoingChatId(body?.chatId);
    const idMessage=String(body?.idMessage||'').trim();
    if(!chatId||!idMessage) return {ok:true,available:false,degraded:true,reason:'invalid_request'};
    const key=`${chatId}::${idMessage}`;
    if(fileResultCache.has(key)) return fileResultCache.get(key);

    const task=async()=>{
      const ctrl=new AbortController();
      const timer=setTimeout(()=>ctrl.abort(),5000);
      try{
        const r=await fetch('/api/green-file-safe',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({chatId,idMessage}),
          signal:ctrl.signal
        });
        const data=await r.json().catch(()=>({ok:true,available:false,degraded:true,reason:'bad_response'}));
        const result={ok:true,...data};
        fileResultCache.set(key,result);
        return result;
      }catch(_){
        const result={ok:true,available:false,degraded:true,reason:'network_error'};
        fileResultCache.set(key,result);
        return result;
      }finally{
        clearTimeout(timer);
      }
    };

    const queued=fileSafeChain.then(async()=>{
      const result=await task();
      await new Promise(r=>setTimeout(r,120));
      return result;
    },async()=>{
      const result=await task();
      await new Promise(r=>setTimeout(r,120));
      return result;
    });
    fileSafeChain=queued.then(()=>undefined,()=>undefined);
    return queued;
  }

  function scheduledStatus(row){
    if(row?.status==='cancelled') return {key:'cancelled',label:'Cancelado'};
    const raw=String(row?.whatsapp_delivery_status||'').toLowerCase();
    if(raw==='sent'||row?.status==='completed') return {key:'sent',label:'✅ Enviado'};
    if(raw==='sending') return {key:'sending',label:'⏳ Enviando'};
    if(raw==='error') return {key:'error',label:'❌ Error'};
    if(raw==='uncertain') return {key:'uncertain',label:'⚠️ Resultado incierto'};
    const when=row?.whatsapp_scheduled_at||row?.starts_at;
    const due=!when||new Date(when).getTime()<=Date.now();
    return {key:'pending',label:due?'🟢 Listo para enviar':'Programado'};
  }

  function html(s){
    if(typeof window.esc==='function') return window.esc(s);
    return String(s??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));
  }

  function ensureWhatsappUxStyles(){
    if(document.getElementById('tpfWhatsappUxFixes'))return;
    const style=document.createElement('style');
    style.id='tpfWhatsappUxFixes';
    style.textContent=`
      #view-whatsapplive .waChatActive.hidden{display:none!important}
      #view-whatsapplive .waChatEmpty.hidden{display:none!important}
      #view-whatsapplive .waLivePage{padding-bottom:18px!important}
      #view-whatsapplive .waLiveLayout{min-height:0!important}
      #view-whatsapplive .waChatPane,#view-whatsapplive .waChatActive{min-height:0!important}
      #view-whatsapplive .waComposer{margin-bottom:12px!important;padding-bottom:12px!important}
      #waMiniStats span{cursor:pointer;user-select:none}
      #waMiniStats span:hover{filter:brightness(.97)}
      #waMiniStats span[role="button"]{outline-offset:2px}
    `;
    document.head.appendChild(style);
  }

  function clickWhatsappTab(tab){
    const btn=document.querySelector(`#view-whatsapplive [data-wa-tab="${tab}"]`);
    if(btn){btn.click();return true;}
    return false;
  }

  function bindTopWhatsappFilters(){
    [['waStatUnread','unread'],['waStatWaiting','unanswered']].forEach(([id,tab])=>{
      const badge=document.getElementById(id);
      const hit=badge?.closest('span')||badge;
      if(!hit||hit.dataset.tpfTopFilterBound==='1')return;
      hit.dataset.tpfTopFilterBound='1';
      hit.setAttribute('role','button');
      hit.setAttribute('tabindex','0');
      hit.setAttribute('title',tab==='unread'?'Ver conversaciones no leídas':'Ver conversaciones sin responder');
      const run=e=>{
        if(e?.type==='keydown' && e.key!=='Enter' && e.key!==' ')return;
        e?.preventDefault?.();
        clickWhatsappTab(tab);
      };
      hit.addEventListener('click',run);
      hit.addEventListener('keydown',run);
    });
  }

  function normalizeInitialWhatsappView(){
    const view=document.getElementById('view-whatsapplive');
    if(!view||view.classList.contains('hidden'))return;
    const active=document.getElementById('waChatActive');
    const empty=document.getElementById('waChatEmpty');
    const selected=active && !active.classList.contains('hidden');
    if(selected){empty?.classList.add('hidden');return;}
    const first=document.querySelector('#waLiveChats .waChatRow');
    if(first){
      first.click();
      return;
    }
    active?.classList.add('hidden');
    empty?.classList.remove('hidden');
  }

  function scheduleWhatsappUiNormalize(){
    [80,220,650].forEach(ms=>setTimeout(()=>{
      ensureWhatsappUxStyles();
      bindTopWhatsappFilters();
      normalizeInitialWhatsappView();
    },ms));
  }

  async function refreshProgramRows(baseLoad){
    const result=await baseLoad();
    try{
      const rows=Array.isArray(window.__waRows)?window.__waRows:[];
      const trs=[...document.querySelectorAll('#waRows tr')];
      trs.forEach((tr,i)=>{
        const row=rows[i];
        if(!row||tr.children.length<6)return;
        const st=scheduledStatus(row);
        const statusCell=tr.children[4];
        const actions=tr.children[5];
        const err=String(row.whatsapp_delivery_error||'').trim();
        statusCell.innerHTML=`<span class="${st.key==='error'||st.key==='uncertain'?'waReady':'waPending'}">${html(st.label)}</span>${err?`<div class="small" style="margin-top:4px">${html(err)}</div>`:''}`;

        if(st.key==='pending'){
          actions.innerHTML=`<button class="agendaWaSend" onclick="retryProgrammedWhatsapp('${row.id}')">Enviar ahora</button> <button class="secondary" onclick="editProgrammedWhatsapp('${row.id}')">Editar</button> <button class="secondary" onclick="cancelProgrammedWhatsapp('${row.id}')">Cancelar</button> <button class="secondary" onclick="deleteProgrammedWhatsapp('${row.id}')">Eliminar</button>`;
        }else if(st.key==='error'){
          actions.innerHTML=`<button class="agendaWaSend" onclick="retryProgrammedWhatsapp('${row.id}')">Enviar ahora</button> <button class="secondary" onclick="editProgrammedWhatsapp('${row.id}')">Reprogramar</button> <button class="secondary" onclick="openProgrammedWhatsappManual('${row.id}',false)">Abrir manual</button> <button class="secondary" onclick="deleteProgrammedWhatsapp('${row.id}')">Eliminar</button>`;
        }else if(st.key==='uncertain'){
          actions.innerHTML=`<button class="secondary" onclick="openProgrammedWhatsappManual('${row.id}',true)">Revisar / abrir manual</button> <button class="secondary" onclick="markProgrammedWhatsappSent('${row.id}')">Marcar enviado</button> <button class="secondary" onclick="reprogramUncertainWhatsapp('${row.id}')">Reprogramar</button> <button class="secondary" onclick="deleteProgrammedWhatsapp('${row.id}')">Eliminar</button>`;
        }else if(st.key==='sending'){
          actions.innerHTML=`<button class="secondary" disabled>Enviando…</button> <button class="secondary" onclick="loadWhatsappPrograms()">Actualizar</button>`;
        }else if(st.key==='sent'){
          const sentAt=row.whatsapp_sent_at?new Date(row.whatsapp_sent_at).toLocaleString('es-ES'):'';
          if(sentAt) statusCell.innerHTML+=`<div class="small" style="margin-top:4px">${html(sentAt)}</div>`;
          actions.innerHTML=`<button class="secondary" onclick="deleteProgrammedWhatsapp('${row.id}')">Eliminar</button>`;
        }
      });
    }catch(e){console.warn('Estado WhatsApp programado',e);}
    return result;
  }

  M.register('whatsapp',{
    install(){
      M.wrapGlobals('whatsapp',[
        'loadWhatsAppLive','renderWhatsAppChats','renderWaMessages','loadWhatsappPrograms',
        'openWhatsAppChat','openWhatsAppComposer','waRefreshChats','waLoadChatHistory',
        'waSendCurrent','waSendText','waSendMedia','waOpenTemplates','waCloseTemplates'
      ]);
      M.wrapGlobals('whatsapp',['waApi'],{rethrow:['waApi']});

      ensureWhatsappUxStyles();
      bindTopWhatsappFilters();
      document.querySelectorAll('[data-view="whatsapplive"]').forEach(el=>{
        if(el.dataset.tpfWhatsappOpenBound==='1')return;
        el.dataset.tpfWhatsappOpenBound='1';
        el.addEventListener('click',scheduleWhatsappUiNormalize);
      });

      const baseLoadLive=window.loadWhatsAppLive;
      if(typeof baseLoadLive==='function'&&!baseLoadLive.__tpfInitialViewFix){
        const enhancedLoad=async function(...args){
          const result=await baseLoadLive.apply(this,args);
          scheduleWhatsappUiNormalize();
          return result;
        };
        enhancedLoad.__tpfInitialViewFix=true;
        window.loadWhatsAppLive=enhancedLoad;
      }

      const baseApi=window.waApi;
      if(typeof baseApi==='function' && !baseApi.__tpfGreenGuard){
        const guardedApi=async function(action,payload){
          const kind=String(action||'').toLowerCase();
          const body=(payload && typeof payload==='object')?{...payload}:payload;

          if(kind==='file') return safeFileRequest(body||{});

          if(kind==='send' || kind==='sendfile'){
            const chatId=normalizeOutgoingChatId(body?.chatId);
            if(!chatId){
              const err=new Error('El número de WhatsApp no es válido. Revisa el teléfono antes de enviar.');
              err.code='TPF_INVALID_WHATSAPP_PHONE';
              throw err;
            }
            body.chatId=chatId;
          }

          if(kind==='avatar'){
            const chatId=normalizeOutgoingChatId(body?.chatId);
            if(!chatId) return {ok:true,available:false,degraded:true,reason:'invalid_chat'};
            const state=await getGreenState(baseApi);
            if(state!=='authorized'){
              return {ok:true,available:false,degraded:true,state,reason:'provider_not_ready'};
            }
            body.chatId=chatId;
            try{
              return await baseApi.call(this,action,body);
            }catch(err){
              if(providerNotReadyError(err)){
                greenStateCache={at:Date.now(),state:'starting'};
                return {ok:true,available:false,degraded:true,state:'starting',reason:'provider_not_ready'};
              }
              throw err;
            }
          }

          return baseApi.call(this,action,body);
        };
        guardedApi.__tpfGreenGuard=true;
        window.waApi=guardedApi;
      }

      const baseLoadPrograms=window.loadWhatsappPrograms;
      if(typeof baseLoadPrograms==='function'&&!baseLoadPrograms.__tpfDeliveryStatus){
        const enhanced=async function(){return refreshProgramRows(()=>baseLoadPrograms.apply(this,arguments));};
        enhanced.__tpfDeliveryStatus=true;
        window.loadWhatsappPrograms=enhanced;
      }

      window.retryProgrammedWhatsapp=async function(id){
        const row=(window.__waRows||[]).find(x=>String(x.id)===String(id));
        if(!row)return;
        const st=scheduledStatus(row);
        if(st.key==='uncertain'){
          alert('Este envío tiene resultado incierto. Revísalo antes de reenviar para evitar un duplicado.');
          return;
        }
        const now=new Date().toISOString();
        const {error}=await sb.from('agenda_items').update({
          status:'pending',whatsapp_delivery_status:'pending',whatsapp_delivery_error:null,
          whatsapp_scheduled_at:now,starts_at:now
        }).eq('id',id);
        if(error){alert(error.message);return;}
        await window.loadWhatsappPrograms();
      };

      window.openProgrammedWhatsappManual=function(id,uncertain){
        const row=(window.__waRows||[]).find(x=>String(x.id)===String(id));
        if(!row)return;
        if(uncertain&&!confirm('El resultado del envío es incierto. GREEN-API podría haberlo enviado. ¿Quieres abrir WhatsApp igualmente para revisarlo o enviarlo manualmente?'))return;
        const chat=normalizeOutgoingChatId(row.whatsapp_phone||row.customer_phone);
        const digits=String(chat||'').replace(/@.*$/,'');
        if(!digits){alert('No hay un teléfono válido.');return;}
        window.open('https://wa.me/'+digits+'?text='+encodeURIComponent(row.whatsapp_message||''),'_blank','noopener,noreferrer');
      };

      window.markProgrammedWhatsappSent=async function(id){
        if(!confirm('¿Confirmas que este WhatsApp ya fue enviado?'))return;
        const {error}=await sb.from('agenda_items').update({
          status:'completed',whatsapp_delivery_status:'sent',whatsapp_delivery_error:null,whatsapp_sent_at:new Date().toISOString()
        }).eq('id',id);
        if(error){alert(error.message);return;}
        await window.loadWhatsappPrograms();
      };

      window.reprogramUncertainWhatsapp=function(id){
        if(!confirm('El resultado anterior es incierto. Reprogramarlo podría duplicar el mensaje si ya llegó. ¿Quieres continuar?'))return;
        if(typeof window.editProgrammedWhatsapp==='function')window.editProgrammedWhatsapp(id);
      };

      scheduleWhatsappUiNormalize();
    }
  });
})();
