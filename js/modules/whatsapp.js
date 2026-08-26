(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M) return;
  M.register('whatsapp',{
    install(){
      M.wrapGlobals('whatsapp',[
        'loadWhatsAppLive','renderWhatsAppChats','renderWaMessages','loadWhatsappPrograms',
        'openWhatsAppChat','openWhatsAppComposer','waRefreshChats','waLoadChatHistory',
        'waSendCurrent','waSendText','waSendMedia','waOpenTemplates','waCloseTemplates'
      ]);
      M.wrapGlobals('whatsapp',['waApi'],{rethrow:['waApi']});
    }
  });
})();
