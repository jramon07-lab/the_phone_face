(function(){
  'use strict';
  if(window.__tpfContactSafariEditHotfix)return;
  window.__tpfContactSafariEditHotfix=true;

  const byId=id=>document.getElementById(id);
  const modal=()=>byId('contactModal');
  const FIELD_IDS=['contactFirstName','contactLastName','contactName','contactPhone','contactDni','contactEmail','contactNotes','contactObservations'];

  function editableFields(){
    const out=[];
    FIELD_IDS.forEach(id=>{const el=byId(id);if(el)out.push(el);});
    byId('contactCustomFields')?.querySelectorAll('input,textarea,select').forEach(el=>out.push(el));
    return [...new Set(out)];
  }

  function applyEditing(on){
    const root=modal();if(!root)return;
    root.dataset.tpfSafariEditing=on?'1':'0';
    root.classList.toggle('tpf-contact-readonly',!on);
    root.classList.toggle('tpf-contact-editing',on);
    editableFields().forEach(el=>{
      const tag=String(el.tagName||'').toUpperCase();
      if(tag==='SELECT'){
        el.disabled=!on;
        el.setAttribute('aria-disabled',String(!on));
      }else{
        el.disabled=false;
        el.readOnly=!on;
        if(on)el.removeAttribute('readonly');else el.setAttribute('readonly','');
        el.setAttribute('aria-readonly',String(!on));
      }
    });
    const toggle=byId('tpfContactEditToggle');
    if(toggle){toggle.textContent=on?'Cancelar edición':'Editar datos';toggle.setAttribute('aria-pressed',String(on));}
    const local=byId('tpfContactSaveLocal');
    if(local){local.disabled=!on;local.style.display=on?'inline-flex':'none';}
    const hint=byId('tpfContactProtectedHint');
    if(hint)hint.textContent=on?'Edición activada. Guarda los cambios cuando termines.':'Datos protegidos. Pulsa “Editar datos” para modificarlos.';
    if(on){
      const first=byId('contactPhone')||byId('contactFirstName');
      setTimeout(()=>{try{first?.focus({preventScroll:true});}catch(_){try{first?.focus();}catch(__){}}},0);
    }
  }

  function keepForcedState(){
    const root=modal();if(!root||root.classList.contains('hidden'))return;
    if(root.dataset.tpfSafariEditing==='1')applyEditing(true);
  }

  function handleWindowClick(e){
    const target=e.target;
    const edit=target?.closest?.('#tpfContactEditToggle');
    if(edit){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const root=modal();
      const on=root?.dataset.tpfSafariEditing!=='1';
      applyEditing(on);
      requestAnimationFrame(()=>applyEditing(on));
      setTimeout(()=>applyEditing(on),80);
      setTimeout(()=>applyEditing(on),250);
      return;
    }
    const save=target?.closest?.('#tpfContactSaveLocal');
    if(save){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const real=byId('contactSave');
      if(real){
        real.disabled=false;
        real.click();
        setTimeout(()=>applyEditing(false),250);
      }
    }
  }

  window.addEventListener('click',handleWindowClick,true);

  const observer=new MutationObserver(()=>requestAnimationFrame(keepForcedState));
  function attach(){
    const root=modal();
    if(root&&!root.dataset.tpfSafariObserved){
      root.dataset.tpfSafariObserved='1';
      observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['readonly','disabled','class']});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
  setTimeout(attach,200);
  setTimeout(attach,800);
})();
