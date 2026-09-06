(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M)return;

  M.register('contact-open',{install(){
    const previous=window.openContact;
    if(typeof previous!=='function')throw new Error('openContact no está disponible');
    const waitVisible=(id,before,timeoutMs=4500)=>new Promise(resolve=>{
      const started=performance.now();
      const tick=()=>{const modal=document.getElementById('contactModal');if(modal&&!modal.classList.contains('hidden')&&currentContact!==before&&String(currentContact?.id||'')===String(id)){resolve(true);return;}if(performance.now()-started>=timeoutMs){resolve(false);return;}setTimeout(tick,25);};tick();
    });
    window.openContact=function(id){
      const before=currentContact;
      let operation;
      try{operation=previous.apply(this,arguments);}catch(error){M.report('contact-open',error,'openContact sync');throw error;}
      Promise.resolve(operation).catch(error=>M.report('contact-open',error,'openContact background'));
      return waitVisible(id,before).then(visible=>{if(!visible)M.report('contact-open',new Error('La ficha tardó demasiado en abrir'),'openContact > 4.5s');try{window.dispatchEvent(new CustomEvent('tpf:contact-open',{detail:{id,visible}}));}catch(_){}return visible;});
    };
  }});
})();
