(function(){
  'use strict';
  const M=window.TPFModules;if(!M)return;
  const byId=id=>document.getElementById(id);
  function value(id){return byId(id)?.value||'';}
  function closeEditor(){byId('tpfContactEditorBack')?.remove();}
  function fixOpportunityLayer(){const modal=byId('oppDetailModal');if(!modal)return;modal.style.setProperty('z-index','80000','important');modal.style.setProperty('pointer-events','auto','important');const card=modal.querySelector('.opportunityModalCard,.modalCard');if(card){card.style.setProperty('position','relative','important');card.style.setProperty('z-index','80001','important');card.style.setProperty('pointer-events','auto','important');}}
  function openEditor(){
    closeEditor();
    const modal=byId('contactModal');if(!modal||modal.classList.contains('hidden'))return;
    const back=document.createElement('div');back.id='tpfContactEditorBack';back.className='modalBack';
    back.style.cssText='position:fixed!important;inset:0!important;z-index:70000!important;pointer-events:auto!important;';
    back.innerHTML='<div class="modalCard" style="max-width:760px;position:relative;z-index:70001;pointer-events:auto"><div class="modalHead"><h3>Editar contacto</h3><button id="tpfContactEditorCancel" type="button" class="secondary">Volver</button></div><div class="formGrid"><label>Nombre<input id="tpfEditFirstName"></label><label>Apellidos<input id="tpfEditLastName"></label><label>Teléfono<input id="tpfEditPhone"></label><label>Email<input id="tpfEditEmail" type="email"></label><label>DNI<input id="tpfEditDni"></label></div><div class="modalActions"><button id="tpfContactEditorSave" type="button" class="primary">Guardar cambios</button><button id="tpfContactEditorCancelBottom" type="button" class="secondary">Cancelar</button></div></div>';
    document.body.appendChild(back);
    byId('tpfEditFirstName').value=value('contactFirstName')||value('contactName').split(' ')[0]||'';
    byId('tpfEditLastName').value=value('contactLastName')||value('contactName').split(' ').slice(1).join(' ');
    byId('tpfEditPhone').value=value('contactPhone');byId('tpfEditEmail').value=value('contactEmail');byId('tpfEditDni').value=value('contactDni');
  }
  function copyToReal(){
    const first=value('tpfEditFirstName'),last=value('tpfEditLastName');
    if(byId('contactFirstName'))byId('contactFirstName').value=first;if(byId('contactLastName'))byId('contactLastName').value=last;if(byId('contactName'))byId('contactName').value=[first,last].filter(Boolean).join(' ');
    if(byId('contactPhone'))byId('contactPhone').value=value('tpfEditPhone');if(byId('contactEmail'))byId('contactEmail').value=value('tpfEditEmail');if(byId('contactDni'))byId('contactDni').value=value('tpfEditDni');
  }
  M.register('contact-edit',{install(){
    if(M.claimControl)M.claimControl('contact-edit','#tpfContactEditToggle','exclusive');
    window.addEventListener('click',e=>{
      const edit=e.target?.closest?.('#tpfContactEditToggle');if(edit){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openEditor();return;}
      const cancel=e.target?.closest?.('#tpfContactEditorCancel,#tpfContactEditorCancelBottom');if(cancel){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();closeEditor();return;}
      const save=e.target?.closest?.('#tpfContactEditorSave');if(save){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();copyToReal();const real=byId('contactSave');if(real){real.disabled=false;real.click();}closeEditor();return;}
      if(e.target?.closest?.('#cpNewOpp,[data-action="new-opportunity"]'))setTimeout(fixOpportunityLayer,0);
    },true);
    const observer=new MutationObserver(()=>{const modal=byId('oppDetailModal');if(modal&&!modal.classList.contains('hidden'))fixOpportunityLayer();});
    observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
    window.addEventListener('tpf:contact-open',closeEditor);
    fixOpportunityLayer();
  }});
})();
