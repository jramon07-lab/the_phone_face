(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M) return;
  M.register('contacts-sales',{
    install(){
      M.wrapGlobals('contacts-sales',[
        'loadSales','renderSales','renderSalesList',
        'openOpportunityFull','openOpportunityCard','deleteOpp','moveSelectedSalesOpportunities',
        'deleteSelectedSalesOpportunities','loadDatabase','renderDatabase','saveContact','deleteContact'
      ]);
    }
  });
})();
