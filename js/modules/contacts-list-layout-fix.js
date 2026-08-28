(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
M.register('contacts-list-layout',{install(){
  if(document.getElementById('tpfContactsResponsiveFix'))return;
  const view=document.getElementById('view-database');
  const syncActive=()=>document.body.classList.toggle('tpfContactsActive',!!view&&!view.classList.contains('hidden'));
  const style=document.createElement('style');
  style.id='tpfContactsResponsiveFix';
  style.textContent=`
    body.tpfContactsActive{overflow-x:hidden!important}
    body.tpfContactsActive .referenceShell{min-width:0!important;max-width:100%!important}
    body.tpfContactsActive .referenceWorkspace{position:absolute!important;top:0!important;right:0!important;left:252px!important;margin-left:0!important;width:auto!important;max-width:none!important;min-width:0!important;flex:none!important}
    body.tpfContactsActive.sidebarCollapsed .referenceWorkspace{left:0!important}
    body.tpfContactsActive .referenceWorkspace main{min-width:0!important;overflow-x:hidden!important}
    @media (max-width:850px) and (min-width:801px){
      body.tpfContactsActive:not(.sidebarCollapsed) .referenceWorkspace{left:72px!important}
    }
    @media (max-width:800px){
      body.tpfContactsActive .referenceWorkspace{left:0!important}
    }
    #view-database.tpfContactsEnhanced,
    #view-database.tpfContactsEnhanced .tpfContactsApp,
    #view-database.tpfContactsEnhanced .tpfContactsContent,
    #view-database.tpfContactsEnhanced .tpfContactsTableCard{min-width:0!important;max-width:100%!important}
    @media (max-width:1450px) and (min-width:1051px){
      #view-database.tpfContactsEnhanced .tpfContactsBody{grid-template-columns:minmax(0,1fr)!important}
      #view-database.tpfContactsEnhanced .tpfContactsFilters{display:none;position:fixed!important;left:270px!important;top:78px!important;width:280px!important;max-height:calc(100vh - 94px)!important;overflow:auto!important;z-index:80000!important;box-shadow:0 22px 65px #0005!important}
      #view-database.tpfContactsEnhanced .tpfContactsFilters.open{display:block!important}
      #view-database.tpfContactsEnhanced .tpfContactsMobileClose{display:inline-flex!important}
      #view-database.tpfContactsEnhanced .tpfContactsTable{min-width:760px!important}
      #view-database.tpfContactsEnhanced .tpfContactIdentity{min-width:190px!important}
    }
    @media (max-width:1050px){
      #view-database.tpfContactsEnhanced .tpfContactsBody{grid-template-columns:minmax(0,1fr)!important}
      #view-database.tpfContactsEnhanced .tpfContactsFilters{display:none;position:fixed!important;left:88px!important;right:12px!important;top:78px!important;width:auto!important;max-height:calc(100vh - 94px)!important;overflow:auto!important;z-index:80000!important;box-shadow:0 22px 65px #0005!important}
      #view-database.tpfContactsEnhanced .tpfContactsFilters.open{display:block!important}
      #view-database.tpfContactsEnhanced .tpfContactsMobileClose{display:inline-flex!important}
      #view-database.tpfContactsEnhanced .tpfContactsTableScroll{display:none!important}
      #view-database.tpfContactsEnhanced .tpfContactsCards{display:block!important}
    }
    @media (max-width:850px){
      #view-database.tpfContactsEnhanced .tpfContactsFilters{left:82px!important}
    }
    @media (max-width:650px){
      #view-database.tpfContactsEnhanced .tpfContactsFilters{left:10px!important;right:10px!important;top:70px!important}
    }
  `;
  document.head.appendChild(style);
  if(view){
    new MutationObserver(syncActive).observe(view,{attributes:true,attributeFilter:['class']});
  }
  document.addEventListener('click',e=>{if(e.target?.closest?.('.nav'))setTimeout(syncActive,0);},true);
  window.addEventListener('resize',syncActive,{passive:true});
  syncActive();
}});
})();
