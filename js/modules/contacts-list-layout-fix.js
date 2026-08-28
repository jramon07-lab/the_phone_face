(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
M.register('contacts-list-layout',{install(){
  if(document.getElementById('tpfContactsResponsiveFix'))return;
  const style=document.createElement('style');
  style.id='tpfContactsResponsiveFix';
  style.textContent=`
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
}});
})();
