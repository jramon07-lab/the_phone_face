(function(){
  'use strict';
  if(window.__tpfContactOpenNonBlocking)return;
  window.__tpfContactOpenNonBlocking=true;

  const previous=window.openContact;
  if(typeof previous!=='function')return;

  const waitVisible=(timeoutMs=4500)=>new Promise(resolve=>{
    const started=performance.now();
    const tick=()=>{
      const modal=document.getElementById('contactModal');
      if(modal&&!modal.classList.contains('hidden')){resolve(true);return;}
      if(performance.now()-started>=timeoutMs){resolve(false);return;}
      setTimeout(tick,25);
    };
    tick();
  });

  window.openContact=function(id){
    let operation;
    try{
      operation=previous.apply(this,arguments);
    }catch(error){
      try{window.TPFModules?.report('contact-profile',error,'openContact sync');}catch(_){}
      throw error;
    }

    Promise.resolve(operation).catch(error=>{
      try{window.TPFModules?.report('contact-profile',error,'openContact background');}catch(_){}
    });

    return waitVisible().then(visible=>{
      if(!visible){
        try{window.TPFModules?.report('contact-profile',new Error('La ficha tardó demasiado en abrir'),'openContact > 4.5s');}catch(_){}
      }
      try{window.dispatchEvent(new CustomEvent('tpf:contact-open',{detail:{id,visible}}));}catch(_){}
      return visible;
    });
  };
})();
