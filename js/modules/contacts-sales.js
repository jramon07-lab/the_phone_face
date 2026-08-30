(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M) return;
  function loadSalesUpgrade(){
    if(document.querySelector('script[data-tpf-sales-upgrade]')) return;
    const s=document.createElement('script');
    s.src='/js/modules/sales-fullscreen-ui.js?v=5d3e0db36ec8d8fbd248419c7455683b40c5c970';
    s.dataset.tpfSalesUpgrade='1';
    s.onload=()=>{ try{ window.TPFModules?.install?.('sales-fullscreen-ui'); }catch(e){} };
    document.body.appendChild(s);
  }
  M.register('contacts-sales',{
    install(){
      loadSalesUpgrade();
      M.wrapGlobals('contacts-sales',[
        'loadSales','renderSales','renderSalesList',
        'openOpportunityFull','openOpportunityCard','deleteOpp','moveSelectedSalesOpportunities',
        'deleteSelectedSalesOpportunities','loadDatabase','renderDatabase','saveContact','deleteContact'
      ]);
    }
  });
})();
