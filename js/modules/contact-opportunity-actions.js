(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M)return;

  // Opportunity creation/editing belongs to the native sales owner.
  // This module only preserves contact-profile layout and fixes the authored
  // task DOM ownership once, without click interception or duplicate logic.
  function ensureContactScroll(){
    if(document.getElementById('tpfContactThreeColumnScroll'))return;
    const s=document.createElement('style');
    s.id='tpfContactThreeColumnScroll';
    s.textContent=`
      #contactModal.contactProfileBack{overflow:hidden!important}
      #contactModal .contactProfile{height:100vh!important;min-height:100vh!important;overflow:hidden!important}
      #contactModal .cpColumns{height:calc(100vh - 62px)!important;min-height:0!important;overflow:hidden!important;align-items:stretch!important}
      #contactModal .cpLeft,#contactModal .cpCenter,#contactModal .cpRight{height:100%!important;max-height:100%!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain}
      #contactModal .cpLeft{position:relative!important;top:auto!important;align-self:stretch!important}
      @media(max-width:1100px){
        #contactModal.contactProfileBack{overflow:auto!important}
        #contactModal .contactProfile{height:auto!important;min-height:100vh!important;overflow:visible!important}
        #contactModal .cpColumns{height:auto!important;overflow:visible!important}
        #contactModal .cpLeft,#contactModal .cpCenter,#contactModal .cpRight{height:auto!important;max-height:none!important;overflow:visible!important}
      }
    `;
    document.head.appendChild(s);
  }

  function ensureNativeTaskPageOwnership(){
    const createPage=document.getElementById('cpTaskPage');
    const detailPage=document.getElementById('cpTaskDetailPage');
    if(!createPage||!detailPage||detailPage.parentElement!==createPage)return;
    createPage.insertAdjacentElement('afterend',detailPage);
  }

  M.register('contact-opportunities',{install(){
    ensureContactScroll();
    ensureNativeTaskPageOwnership();
  }});
})();
