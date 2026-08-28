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
    if(m?.[1])return m[1];
    const any=target?.closest?.('[onclick]');
    const rawAny=any?.getAttribute?.('onclick')||'';
    const idMatch=rawAny.match(/['\"]([^'\"]+)['\"]/);
    return idMatch?.[1]||'';
  }

  async function deleteOpportunityFromContact(id){
    if(!id)return;
    if(!confirm('¿Eliminar esta oportunidad?'))return;
    try{
      const {error}=await sb.from('sales_opportunities').delete().eq('id',id);
      if(error)throw error;
      if(typeof window.loadSales==='function')await window.loadSales();
      else if(typeof loadSales==='function')await loadSales();
      if(typeof window.renderContactProfile==='function')await window.renderContactProfile();
      else if(typeof renderContactProfile==='function')await renderContactProfile();
    }catch(err){alert(err?.message||'No se pudo eliminar la oportunidad.');}
  }

  M.register('contact-opportunities',{install(){
    document.addEventListener('click',function(e){
      const root=e.target?.closest?.('#cpOpportunities');
      if(!root)return;
      const del=e.target?.closest?.('.dangerText');
      if(del){
        const id=opportunityIdFrom(del);
        if(!id)return;
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        deleteOpportunityFromContact(id);
        return;
      }
      if(e.target?.closest?.('select,input'))return;
      const id=opportunityIdFrom(e.target);
      if(!id)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if(typeof window.openOpportunityCard==='function')window.openOpportunityCard(id);
    },true);
  }});
})();
