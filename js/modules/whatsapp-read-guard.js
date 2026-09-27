(function(){
  'use strict';
  const M=window.TPFModules;if(!M)return;
  async function safeRead(){return {ok:true,setRead:false,localOnly:true};}
  M.register('whatsapp-read',{install(){function installGuard(){const base=window.waApi;if(typeof base!=='function'||base.__tpfReadSafeGuard)return false;const wrapped=async function(action,payload){if(String(action||'').toLowerCase()==='read')return safeRead(payload||{});return base.apply(this,arguments);};wrapped.__tpfReadSafeGuard=true;wrapped.__tpfReadSafeBase=base;window.waApi=wrapped;return true;}if(!installGuard()){let tries=0;const timer=setInterval(()=>{tries++;if(installGuard()||tries>40)clearInterval(timer);},100);}}});
})();
