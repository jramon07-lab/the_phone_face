(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M||window.__tpfContactsMenuPreserveLoaded)return;
  window.__tpfContactsMenuPreserveLoaded=true;

  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  function makeMoreButton(button){
    const actions=button?.closest?.('#tpfContactsRows .tpfContactActions');
    const buttons=actions?[...actions.querySelectorAll('button')]:[];
    if(!buttons.length||buttons.at(-1)!==button)return false;
    const id=String(button.dataset.id||button.closest('[data-contact-id]')?.dataset.contactId||'').trim();
    if(!id)return false;
    button.dataset.id=id;
    button.dataset.action='more-final';
    button.title='Más';
    button.textContent='⋯';
    return true;
  }

  async function openOffer(contactId){
    const result=window.openContact?.(contactId);
    if(result&&typeof result.then==='function')await result;
    for(let attempt=0;attempt<40;attempt++){
      const button=document.getElementById('cpNewOffer');
      if(button&&!button.disabled){button.click();return;}
      await wait(50);
    }
    alert('El configurador de ofertas todavía no está disponible. Vuelve a intentarlo en unos segundos.');
  }

  function addOfferAction(menu){
    if(!menu||menu.dataset.tpfOfferActionReady==='1')return;
    const contactId=String(menu.dataset.ownerId||'').trim();
    if(!contactId)return;
    menu.dataset.tpfOfferActionReady='1';
    const button=document.createElement('button');
    button.type='button';
    button.textContent='Enviar oferta';
    button.dataset.tpfContactOffer=contactId;
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      menu.remove();
      openOffer(contactId).catch(error=>alert(error?.message||'No se pudo abrir la oferta.'));
    });
    menu.insertBefore(button,menu.querySelector('[data-more="delete"]')||null);
  }

  function install(){
    window.addEventListener('pointerdown',event=>{
      const button=event.target.closest?.('#tpfContactsRows .tpfContactActions button');
      if(!makeMoreButton(button))return;
      // Conserva el menú estable: impide que un módulo previo lo sustituya.
      event.stopImmediatePropagation();
    },true);

    const scan=root=>{
      if(root instanceof Element&&root.matches('.tpfMoreMenu[data-owner-id]'))addOfferAction(root);
      root?.querySelectorAll?.('.tpfMoreMenu[data-owner-id]').forEach(addOfferAction);
    };
    scan(document);
    new MutationObserver(records=>{
      records.forEach(record=>record.addedNodes.forEach(scan));
    }).observe(document.body,{childList:true,subtree:true});
  }

  M.register('contacts-menu-preserve',{install});
})();
