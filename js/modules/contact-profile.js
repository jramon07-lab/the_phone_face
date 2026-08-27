(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M) return;
  M.register('contact-profile',{
    install(){
      M.wrapGlobals('contact-profile',[
        'renderContactProfile','openContact','openContactProfile',
        'openContactTaskDetail','deleteContactTask',
        'openContactProgrammedWhatsapp','deleteContactProgrammedWhatsapp'
      ]);
    }
  });
})();
