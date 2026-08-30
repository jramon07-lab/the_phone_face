(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M) return;
  function installSalesSafeUi(){
    if(document.getElementById('tpfSalesSafeUi'))return;
    const s=document.createElement('style');s.id='tpfSalesSafeUi';s.textContent=`
#view-sales #salesScrollLeft,#view-sales #salesScrollRight{display:none!important}
#view-sales .salesBoardViewport{padding-left:8px!important;padding-right:8px!important}
#view-sales .salesNavWrap{display:block!important}
#view-sales #salesScroll{width:100%!important;max-width:100%!important}
#view-sales #salesBoard.board{grid-auto-columns:245px!important;gap:10px!important;min-width:max-content!important;width:max-content!important}
#view-sales #salesBoard>.stage{width:245px!important;min-width:245px!important;max-width:245px!important}
#view-sales .opp{min-height:0!important;max-height:none!important;overflow:visible!important}
`;document.head.appendChild(s);
  }
  M.register('contacts-sales',{
    install(){
      installSalesSafeUi();
      M.wrapGlobals('contacts-sales',[
        'loadSales','renderSales','renderSalesList',
        'openOpportunityFull','openOpportunityCard','deleteOpp','moveSelectedSalesOpportunities',
        'deleteSelectedSalesOpportunities','loadDatabase','renderDatabase','saveContact','deleteContact'
      ]);
    }
  });
})();
