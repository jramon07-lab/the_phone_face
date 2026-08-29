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

  function isDeleteControl(target){
    const el=target?.closest?.('button,a,[role="button"],.dangerText');
    if(!el)return null;
    const text=String(el.textContent||'').trim().toLowerCase();
    return (el.classList.contains('dangerText') || text==='eliminar' || text.includes('eliminar oportunidad')) ? el : null;
  }

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
    ensureContactScroll();
    document.addEventListener('click',function(e){
      const root=e.target?.closest?.('#cpOpportunities');
      if(!root)return;
      const del=isDeleteControl(e.target);
      if(del){
        const id=opportunityIdFrom(del);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if(id)deleteOpportunityFromContact(id);
        return;
      }
      if(e.target?.closest?.('select,input,button,a'))return;
      const id=opportunityIdFrom(e.target);
      if(!id)return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if(typeof window.openOpportunityCard==='function')window.openOpportunityCard(id);
    },true);
  }});
})();
