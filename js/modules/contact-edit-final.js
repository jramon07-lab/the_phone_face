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

  function applySimpleMode(){
    const root=modal();if(!root||root.classList.contains('hidden'))return;
    root.dataset.tpfFinalEditing='1';
    root.classList.remove('tpf-contact-readonly');
    root.classList.add('tpf-contact-editing');

    fields().forEach(el=>{
      if(String(el.tagName||'').toUpperCase()==='SELECT'){
        el.disabled=false;
        el.setAttribute('aria-disabled','false');
      }else{
        el.disabled=false;
        el.readOnly=false;
        el.removeAttribute('readonly');
        el.setAttribute('aria-readonly','false');
      }
    });

    const edit=byId('tpfContactEditToggle');
    if(edit)edit.style.display='none';

    const save=byId('tpfContactSaveLocal');
    if(save){
      save.disabled=false;
      save.style.display='inline-flex';
      save.textContent='Guardar cambios';
    }

    const real=byId('contactSave');
    if(real)real.disabled=false;

    const hint=byId('tpfContactProtectedHint');
    if(hint)hint.textContent='Puedes editar los datos directamente y pulsar “Guardar cambios” al terminar.';
  }

  document.addEventListener('click',e=>{
    const save=e.target?.closest?.('#tpfContactSaveLocal');
    if(!save)return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const real=byId('contactSave');
    if(real){real.disabled=false;real.click();}
    setTimeout(applySimpleMode,80);
  },true);

  const observer=new MutationObserver(()=>{
    const root=modal();
    if(!root||root.classList.contains('hidden'))return;
    requestAnimationFrame(applySimpleMode);
  });
  observer.observe(document.body,{childList:true,subtree:true});

  window.addEventListener('tpf:contact-open',applySimpleMode);
  setTimeout(applySimpleMode,250);
})();
