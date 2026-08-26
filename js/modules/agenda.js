(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M) return;
  M.register('agenda',{
    install(){
      M.wrapGlobals('agenda',[
        'loadAgenda','completeAgenda','cancelAgenda','deleteAgenda','openAgendaWhatsApp',
        'openContactTaskDetail','renderContactTaskDetail','saveContactTask','deleteAlertTask'
      ]);
    }
  });
})();
