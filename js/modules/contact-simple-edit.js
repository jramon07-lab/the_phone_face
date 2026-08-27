(function(){
  'use strict';
  if(window.__tpfContactSimpleEdit)return;
  window.__tpfContactSimpleEdit=true;

  const FIELD_IDS=['contactFirstName','contactLastName','contactName','contactPhone','contactDni','contactEmail','contactNotes','contactObservations'];
  const byId=id=>document.getElementById(id);

  function forceEditable(){
    const modal=byId('contactModal');
    if(!modal||modal.classList.contains('hidden'))return;

    modal.classList.remove('tpf-contact-readonly');
    modal.classList.add('tpf-contact-editing');

    FIELD_IDS.forEach(id=>{
      const el=byId(id);if(!el)return;
      el.disabled=false;
      el.readOnly=false;
      el.removeAttribute('readonly');
      el.removeAttribute('disabled');
      el.setAttribute('aria-readonly','false');
      el.setAttribute('aria-disabled','false');
    });
    byId('contactCustomFields')?.querySelectorAll('input,textarea,select').forEach(el=>{
      el.disabled=false;
      if('readOnly' in el)el.readOnly=false;
      el.removeAttribute('readonly');
      el.removeAttribute('disabled');
    });

    const edit=byId('tpfContactEditToggle');
    if(edit)edit.style.display='none';
    const hint=byId('tpfContactProtectedHint');
    if(hint)hint.style.display='none';

    const local=byId('tpfContactSaveLocal');
    if(local){
      local.style.display='inline-flex';
      local.disabled=false;
      local.textContent='Guardar cambios';
    }
    const real=byId('contactSave');
    if(real){
      real.disabled=false;
      real.style.display='none';
    }
  }

  document.addEventListener('click',e=>{
    const save=e.target?.closest?.('#tpfContactSaveLocal');
    if(!save)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const real=byId('contactSave');
    if(real){
      real.disabled=false;
      real.click();
      setTimeout(forceEditable,120);
    }
  },true);

  const observer=new MutationObserver(()=>requestAnimationFrame(forceEditable));
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','readonly','disabled']});
  setInterval(forceEditable,700);
  setTimeout(forceEditable,50);
  setTimeout(forceEditable,300);
})();
