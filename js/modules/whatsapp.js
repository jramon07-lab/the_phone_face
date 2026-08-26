(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M) return;

  let greenStateCache={at:0,state:''};

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

  M.register('whatsapp',{
    install(){
      M.wrapGlobals('whatsapp',[
        'loadWhatsAppLive','renderWhatsAppChats','renderWaMessages','loadWhatsappPrograms',
        'openWhatsAppChat','openWhatsAppComposer','waRefreshChats','waLoadChatHistory',
        'waSendCurrent','waSendText','waSendMedia','waOpenTemplates','waCloseTemplates'
      ]);
      M.wrapGlobals('whatsapp',['waApi'],{rethrow:['waApi']});

      const baseApi=window.waApi;
      if(typeof baseApi!=='function' || baseApi.__tpfGreenGuard) return;

      const guardedApi=async function(action,payload){
        const kind=String(action||'').toLowerCase();
        const body=(payload && typeof payload==='object')?{...payload}:payload;

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
        }

        return baseApi.call(this,action,body);
      };
      guardedApi.__tpfGreenGuard=true;
      window.waApi=guardedApi;
    }
  });
})();
