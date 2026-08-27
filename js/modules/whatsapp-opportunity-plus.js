(function(){
  'use strict';
  if(window.__tpfWhatsappOpportunityPlus)return;
  window.__tpfWhatsappOpportunityPlus=true;

  function isWhatsappViewOpen(){
    const v=document.getElementById('view-whatsapplive');
    return !!v && !v.classList.contains('hidden');
  }

  function looksLikeOpportunitySection(el){
    let node=el;
    for(let i=0;i<6 && node;i++,node=node.parentElement){
      const txt=String(node.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
      if(txt.includes('oportunidades')) return true;
    }
    return false;
  }

  function looksLikePlusButton(btn){
    if(!btn)return false;
    const txt=String(btn.textContent||'').trim();
    const title=String(btn.getAttribute('title')||'').toLowerCase();
    const aria=String(btn.getAttribute('aria-label')||'').toLowerCase();
    return txt==='+' || txt==='＋' || title.includes('oportunidad') || aria.includes('oportunidad');
  }

  document.addEventListener('click',async e=>{
    const btn=e.target?.closest?.('button');
    if(!btn || !isWhatsappViewOpen() || !looksLikePlusButton(btn) || !looksLikeOpportunitySection(btn)) return;
    if(typeof window.openContactNewOpportunity!=='function' && typeof openContactNewOpportunity!=='function') return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    try{
      if(typeof window.openContactNewOpportunity==='function') await window.openContactNewOpportunity();
      else await openContactNewOpportunity();
    }catch(err){
      console.error('WhatsApp nueva oportunidad',err);
      alert(err?.message||'No se pudo abrir Nueva oportunidad.');
    }
  },true);
})();
