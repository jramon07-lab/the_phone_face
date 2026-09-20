(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M)return;

  M.register('contact-open',{install(){
    const previous=window.openContact;
    if(typeof previous!=='function')throw new Error('openContact no está disponible');
    const $=id=>document.getElementById(id);let suspended=null,request=0;
    function resume(){
      const state=suspended;if(!state)return;suspended=null;
      state.parent.removeAttribute('data-tpf-suspended');
      if(state.aria===null)state.parent.removeAttribute('aria-hidden');else state.parent.setAttribute('aria-hidden',state.aria);
      state.parent.inert=state.inert;$('contactModal')?.classList.remove('tpfOpportunityContactFront');
    }
    function present(origin){
      if(!origin||origin.parent.classList.contains('hidden')||$('oppModalId')?.value!==origin.id)return;
      if(!suspended){suspended=origin;origin.parent.setAttribute('data-tpf-suspended','contact');origin.parent.setAttribute('aria-hidden','true');origin.parent.inert=true;}
      $('contactModal')?.classList.add('tpfOpportunityContactFront');
    }
    document.addEventListener('click',event=>{
      if(!suspended||!event.target.closest?.('#contactClose'))return;
      const state=suspended;if(state.parent.classList.contains('hidden')||$('oppModalId')?.value!==state.id){resume();return;}
      event.preventDefault();event.stopImmediatePropagation();$('contactModal')?.classList.add('hidden');resume();
      for(const [key,length]of Object.entries(state.history))if(Array.isArray(window[key])&&window[key].length>length)window[key].length=length;
      window.__returnSalesOpportunityId=null;window.__contactOpportunityReturnId=null;
    },true);
    const parent=$('oppDetailModal');if(parent)new MutationObserver(()=>{if(suspended&&(parent.classList.contains('hidden')||$('oppModalId')?.value!==suspended.id))resume();}).observe(parent,{attributes:true,attributeFilter:['class']});
    const contactLayer=$('contactModal');if(contactLayer)new MutationObserver(()=>{if(suspended&&contactLayer.classList.contains('hidden'))resume();}).observe(contactLayer,{attributes:true,attributeFilter:['class']});
    const waitVisible=(id,before,timeoutMs=4500)=>new Promise(resolve=>{
      const started=performance.now();
      const tick=()=>{const modal=document.getElementById('contactModal');if(modal&&!modal.classList.contains('hidden')&&String(currentContact?.id||'')===String(id)){resolve(true);return;}if(performance.now()-started>=timeoutMs){resolve(false);return;}setTimeout(tick,25);};tick();
    });
    window.openContact=function(id){
      const before=currentContact;
      const run=++request,parent=$('oppDetailModal'),origin=parent&&!parent.classList.contains('hidden')?{parent,id:$('oppModalId')?.value,aria:parent.getAttribute('aria-hidden'),inert:parent.inert,history:Object.fromEntries(['__TPF_HISTORY','__tpfDetailHistory','__tpfNavStack'].map(key=>[key,window[key]?.length||0]))}:null;
      let operation;
      try{operation=previous.apply(this,arguments);}catch(error){M.report('contact-open',error,'openContact sync');throw error;}
      Promise.resolve(operation).catch(error=>M.report('contact-open',error,'openContact background'));
      return waitVisible(id,before).then(visible=>{if(run!==request)return false;if(visible)present(origin);else M.report('contact-open',new Error('La ficha tardó demasiado en abrir'),'openContact > 4.5s');try{window.dispatchEvent(new CustomEvent('tpf:contact-open',{detail:{id,visible}}));}catch(_){}return visible;});
    };
  }});
})();
