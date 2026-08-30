(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M) return;
  function installSalesFullscreen(){
    if(document.getElementById('tpfSalesFullscreenCss')) return;
    const s=document.createElement('style');
    s.id='tpfSalesFullscreenCss';
    s.textContent=`
#view-sales{position:fixed!important;inset:0!important;z-index:1200!important;background:#f6f8fb!important;overflow:hidden!important;padding:0!important;margin:0!important}
#view-sales .salesBoardPage{height:100vh!important;width:100vw!important;max-width:none!important;margin:0!important}
#view-sales .salesBoardTopbar{min-height:58px!important;height:58px!important;padding:7px 18px!important}
#view-sales .salesBoardTitleGroup{gap:10px!important}#view-sales .salesBoardTitleGroup h2{font-size:19px!important}#view-sales .salesBoardTitleGroup .small{font-size:11px!important}
#view-sales .salesBackBtn,#view-sales .salesBoardTopActions button{padding:8px 11px!important}
#view-sales .salesSummaryAccordion{flex:0 0 auto!important;background:#fff!important;border-bottom:1px solid #e2e7ee!important}
#view-sales .salesSummaryToggle{min-height:34px!important;padding:6px 18px!important}#view-sales .salesSummaryToggle small{display:none!important}
#view-sales .salesSummaryPanel{padding:6px 18px 8px!important}#view-sales .salesSummaryCards{display:none!important}
#view-sales .salesSummaryExtra{display:grid!important;grid-template-columns:190px 190px minmax(0,1fr)!important;gap:12px!important;align-items:stretch!important}
#view-sales .salesSummaryMetric,#view-sales .salesSummaryStagesWrap{min-height:68px!important;padding:8px 12px!important;margin:0!important}
#view-sales .salesSummaryMetric span,#view-sales .salesSummaryStagesWrap>span{font-size:10px!important}#view-sales .salesSummaryMetric>b{font-size:18px!important;margin:3px 0!important}#view-sales .salesSummaryMetric small{font-size:9px!important}
#view-sales .salesSummaryProgress{height:6px!important;margin-top:6px!important}#view-sales .salesSummaryStages{display:flex!important;gap:6px!important;align-items:stretch!important;overflow-x:auto!important;padding:2px 0!important}#view-sales .salesSummaryStages>*{min-width:112px!important;padding:6px 8px!important}
#view-sales .salesBulkBar{min-height:48px!important;padding:6px 18px!important;gap:8px!important;flex-wrap:nowrap!important;overflow-x:auto!important}#view-sales .salesBulkBar select{height:36px!important;padding:6px 9px!important;margin:0!important}#view-sales .salesBulkBar button{padding:8px 11px!important;white-space:nowrap!important}
#view-sales .salesBoardViewport{flex:1 1 auto!important;min-height:0!important;padding:8px 8px 5px!important}#view-sales .salesBoardViewport .salesNavWrap{height:calc(100% - 18px)!important}#view-sales #salesScroll{height:100%!important}
#view-sales #salesBoard.board{height:100%!important;min-height:0!important;grid-auto-columns:minmax(230px,1fr)!important;gap:8px!important;padding-bottom:4px!important}
#view-sales #salesBoard>.stage{width:230px!important;height:100%!important;max-height:100%!important;padding:7px!important;border-radius:10px!important;overflow-y:auto!important}#view-sales #salesBoard>.stage .stageHead{padding:3px 3px 6px!important;margin-bottom:3px!important}
#view-sales .stageTitle{font-size:12px!important}#view-sales .stageMeta,#view-sales .stageSelectAllLabel{font-size:9px!important}
#view-sales .opp{padding:8px 9px!important;margin:6px 0!important;border-radius:8px!important;min-height:126px!important;max-height:142px!important;overflow:hidden!important}#view-sales .oppTitle{font-size:11px!important;line-height:1.2!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important}#view-sales .oppInfo{gap:2px!important;margin-top:5px!important;font-size:9.5px!important;line-height:1.2!important}#view-sales .oppInfo>*{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}#view-sales .oppFooter{margin-top:5px!important;gap:5px!important}#view-sales .oppFooter select{padding:5px 6px!important;font-size:9px!important}#view-sales .oppAmount{font-size:14px!important}
#view-sales .salesCompactFooter{padding:4px 14px!important;min-height:25px!important}#view-sales #salesMiniRail{margin-top:3px!important;height:6px!important}
@media(min-height:800px){#view-sales .opp{min-height:132px!important;max-height:148px!important}}`;
    document.head.appendChild(s);
  }
  M.register('contacts-sales',{
    install(){
      installSalesFullscreen();
      M.wrapGlobals('contacts-sales',[
        'loadSales','renderSales','renderSalesList',
        'openOpportunityFull','openOpportunityCard','deleteOpp','moveSelectedSalesOpportunities',
        'deleteSelectedSalesOpportunities','loadDatabase','renderDatabase','saveContact','deleteContact'
      ]);
    }
  });
})();
