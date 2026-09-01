(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M)return;

  // Native owners only: contact-profile/contacts-sales-core for contact+tasks,
  // sales owner for opportunities. This module changes layout/DOM ownership only.
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

      /* Task create/detail are full contact-profile pages, like opportunity detail. */
      #contactModal .cpTaskPage:not(.hidden){position:absolute!important;inset:0!important;z-index:120!important;background:#f7f9fc!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}
      #contactModal .cpTaskPageTop{position:relative!important;top:0!important;z-index:3!important;flex:0 0 auto!important;min-height:72px!important;display:grid!important;grid-template-columns:minmax(120px,1fr) minmax(260px,2fr) minmax(120px,1fr)!important;align-items:center!important;gap:14px!important;padding:12px 20px!important;background:#fff!important;border-bottom:1px solid #e3e7ed!important}
      #contactModal .cpTaskPageTop>div{text-align:center!important;min-width:0!important}
      #contactModal .cpTaskPageTop>div b,#contactModal .cpTaskPageTop>div small{display:block!important}
      #contactModal .cpTaskPageTop>button:first-child{justify-self:start!important;visibility:visible!important;opacity:1!important}
      #contactModal .cpTaskPageTop>button:last-child{justify-self:end!important;visibility:visible!important;opacity:1!important}
      #contactModal .cpTaskPageBody{flex:1 1 auto!important;min-height:0!important;overflow:auto!important;padding:24px!important}

      @media(max-width:1100px){
        #contactModal.contactProfileBack{overflow:auto!important}
        #contactModal .contactProfile{height:auto!important;min-height:100vh!important;overflow:visible!important}
        #contactModal .cpColumns{height:auto!important;overflow:visible!important}
        #contactModal .cpLeft,#contactModal .cpCenter,#contactModal .cpRight{height:auto!important;max-height:none!important;overflow:visible!important}
        #contactModal .cpTaskPage:not(.hidden){position:fixed!important;inset:0!important;height:100vh!important}
      }
      @media(max-width:700px){
        #contactModal .cpTaskPageTop{grid-template-columns:auto 1fr auto!important;padding:10px!important;gap:8px!important}
        #contactModal .cpTaskPageTop>div small{display:none!important}
        #contactModal .cpTaskPageBody{padding:12px!important}
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
