(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M)return;

  // Opportunity cards already render their native openOpportunityCard(id)
  // actions from contacts-sales-core.js. Keep this module limited to layout;
  // do not capture/intercept clicks or duplicate opportunity ownership.
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

  // cpTaskDetailPage was authored inside cpTaskPage. That makes the native
  // detail invisible whenever the create page is hidden. Correct ownership
  // once at module installation: create and detail pages become siblings.
  // No click interception, polling, observer or duplicate task implementation.
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
