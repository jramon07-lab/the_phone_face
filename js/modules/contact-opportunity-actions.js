(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M)return;

  function opportunityIdFrom(target){
    const row=target?.closest?.('[data-opp-id]');
    if(row?.dataset?.oppId)return row.dataset.oppId;
    const withOnclick=target?.closest?.('[onclick*="openOpportunityCard"]');
    const raw=withOnclick?.getAttribute?.('onclick')||'';
    const m=raw.match(/openOpportunityCard\(['\"]([^'\"]+)['\"]\)/);
    return m?.[1]||'';
  }

  M.register('contact-opportunities',{install(){
    document.addEventListener('click',function(e){
      const root=e.target?.closest?.('#cpOpportunities');
      if(!root)return;
      if(e.target?.closest?.('.dangerText,select,input'))return;
      const id=opportunityIdFrom(e.target);
      if(!id)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if(typeof window.openOpportunityCard==='function')window.openOpportunityCard(id);
    },true);
  }});
})();
