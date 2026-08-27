(function(){
  'use strict';
  if(window.__tpfContactActionsBridge)return;
  window.__tpfContactActionsBridge=true;

  const byId=id=>document.getElementById(id);
  const fieldIds=['contactFirstName','contactLastName','contactName','contactPhone','contactDni','contactEmail','contactNotes','contactObservations'];

  function fields(){
    const out=[];
    fieldIds.forEach(id=>{const el=byId(id);if(el)out.push(el);});
    byId('contactCustomFields')?.querySelectorAll('input,textarea,select').forEach(el=>out.push(el));
    return [...new Set(out)];
  }

  function applyEditing(on){
    const modal=byId('contactModal');
    if(!modal||modal.classList.contains('hidden'))return;
    modal.dataset.tpfBridgeEditing=on?'1':'0';
    modal.classList.toggle('tpf-contact-editing',on);
    modal.classList.toggle('tpf-contact-readonly',!on);
    fields().forEach(el=>{
      if(String(el.tagName||'').toUpperCase()==='SELECT'){
        el.disabled=!on;
        el.setAttribute('aria-disabled',String(!on));
      }else{
        el.disabled=false;
        el.readOnly=!on;
        if(on)el.removeAttribute('readonly');else el.setAttribute('readonly','');
        el.setAttribute('aria-readonly',String(!on));
      }
    });
    const edit=byId('tpfContactEditToggle');
    if(edit){
      edit.disabled=false;
      edit.style.display='inline-flex';
      edit.textContent=on?'Cancelar edición':'Editar datos';
      edit.setAttribute('aria-pressed',String(on));
    }
    const save=byId('tpfContactSaveLocal');
    if(save){save.disabled=!on;save.style.display=on?'inline-flex':'none';}
    const real=byId('contactSave');
    if(real){real.disabled=!on;real.style.display='none';}
    const hint=byId('tpfContactProtectedHint');
    if(hint)hint.textContent=on?'Edición activada. Guarda los cambios cuando termines.':'Datos protegidos. Pulsa “Editar datos” para modificarlos.';
  }

  function opportunityIdFrom(el){
    const holder=el?.closest?.('[data-opp-id]');
    if(holder?.dataset?.oppId)return holder.dataset.oppId;
    let node=el;
    while(node&&node!==document.body){
      const raw=String(node.getAttribute?.('onclick')||'');
      const m=raw.match(/(?:openOpportunityCard|openOpportunityDetail)\(['\"]([^'\"]+)['\"]\)/);
      if(m)return m[1];
      node=node.parentElement;
    }
    return '';
  }

  document.addEventListener('click',e=>{
    const edit=e.target?.closest?.('#tpfContactEditToggle');
    if(edit){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const modal=byId('contactModal');
      const on=modal?.dataset?.tpfBridgeEditing!=='1';
      applyEditing(on);
      setTimeout(()=>applyEditing(on),0);
      setTimeout(()=>applyEditing(on),80);
      return;
    }

    const save=e.target?.closest?.('#tpfContactSaveLocal');
    if(save){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const real=byId('contactSave');
      if(real){real.disabled=false;real.click();}
      setTimeout(()=>applyEditing(false),150);
      setTimeout(()=>applyEditing(false),700);
      return;
    }

    const newOpp=e.target?.closest?.('#cpNewOpp,#cpSideNewOpp');
    if(newOpp){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      if(typeof window.openContactNewOpportunity==='function')window.openContactNewOpportunity();
      else if(typeof openContactNewOpportunity==='function')openContactNewOpportunity();
      return;
    }

    const oppArea=e.target?.closest?.('#cpOpportunities');
    if(oppArea){
      const danger=e.target?.closest?.('.dangerText,[data-action="delete"]');
      if(danger)return;
      const id=opportunityIdFrom(e.target);
      if(!id)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      if(typeof window.openOpportunityCard==='function')window.openOpportunityCard(id);
      else if(typeof openOpportunityCard==='function')openOpportunityCard(id);
    }
  },true);

  window.addEventListener('tpf:contact-open',()=>{
    const modal=byId('contactModal');if(modal)modal.dataset.tpfBridgeEditing='0';
    setTimeout(()=>applyEditing(false),0);
    setTimeout(()=>applyEditing(false),120);
  });
})();
