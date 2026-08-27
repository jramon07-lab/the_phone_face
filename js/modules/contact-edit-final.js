(function(){
  'use strict';
  if(window.__tpfContactEditFinal)return;
  window.__tpfContactEditFinal=true;

  const ids=['contactFirstName','contactLastName','contactName','contactPhone','contactDni','contactEmail','contactNotes','contactObservations'];
  const byId=id=>document.getElementById(id);
  const modal=()=>byId('contactModal');

  function fields(){
    const out=[];
    ids.forEach(id=>{const el=byId(id);if(el)out.push(el);});
    byId('contactCustomFields')?.querySelectorAll('input,textarea,select').forEach(el=>out.push(el));
    return [...new Set(out)];
  }

  function apply(on){
    const root=modal();if(!root)return;
    root.dataset.tpfFinalEditing=on?'1':'0';
    root.classList.toggle('tpf-contact-readonly',!on);
    root.classList.toggle('tpf-contact-editing',on);
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
    if(edit){edit.textContent=on?'Cancelar edición':'Editar datos';edit.setAttribute('aria-pressed',String(on));}
    const save=byId('tpfContactSaveLocal');
    if(save){save.disabled=!on;save.style.display=on?'inline-flex':'none';}
    const real=byId('contactSave');
    if(real)real.disabled=!on;
    const hint=byId('tpfContactProtectedHint');
    if(hint)hint.textContent=on?'Edición activada. Guarda los cambios cuando termines.':'Datos protegidos. Pulsa “Editar datos” para modificarlos.';
  }

  window.addEventListener('click',e=>{
    const edit=e.target?.closest?.('#tpfContactEditToggle');
    if(edit){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const on=modal()?.dataset.tpfFinalEditing!=='1';
      apply(on);
      requestAnimationFrame(()=>apply(on));
      return;
    }
    const save=e.target?.closest?.('#tpfContactSaveLocal');
    if(save){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const real=byId('contactSave');
      if(real){real.disabled=false;real.click();}
      setTimeout(()=>apply(false),80);
    }
  },true);

  const observer=new MutationObserver(()=>{
    const root=modal();
    if(!root||root.classList.contains('hidden'))return;
    if(root.dataset.tpfFinalEditing==='1')requestAnimationFrame(()=>apply(true));
  });
  observer.observe(document.body,{childList:true,subtree:true});
})();
