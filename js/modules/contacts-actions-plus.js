(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M||window.__tpfContactsActionsPlusLoaded)return;
  window.__tpfContactsActionsPlusLoaded=true;

  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  async function openOffer(contactId){
    const opened=window.openContact?.(contactId);
    if(opened&&typeof opened.then==='function')await opened;
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
    const remove=menu.querySelector('[data-more="delete"]');
    menu.insertBefore(button,remove||null);
  }

  function install(){
    const scan=root=>{
      if(root instanceof Element&&root.matches('.tpfMoreMenu[data-owner-id]'))addOfferAction(root);
      root?.querySelectorAll?.('.tpfMoreMenu[data-owner-id]').forEach(addOfferAction);
    };
    scan(document);
    new MutationObserver(records=>{
      records.forEach(record=>record.addedNodes.forEach(node=>scan(node)));
    }).observe(document.body,{childList:true,subtree:true});
  }

  M.register('contacts-actions-plus',{install});
})();
