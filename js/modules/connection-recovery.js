/* Bounded recovery for explicitly read-only requests. Never replay writes. */
(function(){
  'use strict';
  if(window.TPFConnectionRecovery)return;
  const nativeFetch=window.fetch.bind(window),cooldowns=new Map();
  let retrying=0,banner;
  function safeRead(input,init={}){
    try{
      const url=new URL(typeof input==='string'?input:input?.url||String(input),location.href);
      const method=String(init.method||input?.method||'GET').toUpperCase();
      if(url.origin===location.origin){
        if(method==='GET'&&url.pathname==='/api/green-status')return true;
        if(method==='GET'&&url.pathname==='/api/green-health')return true;
        if(['/api/green','/api/mobile-green'].includes(url.pathname)){
          const action=String(url.searchParams.get('action')||'').toLowerCase();
          // Estas acciones solo consultan WhatsApp. Se pueden recuperar tras un
          // corte breve; enviar, responder, marcar leído o guardar nunca se repite.
          const getReads=new Set(['state','summary','chats']);
          const postReads=new Set(['history','previews','avatar','file']);
          if(method==='GET')return getReads.has(action);
          if(method==='POST'&&!input?.bodyUsed&&init.body)return postReads.has(action);
        }
      }
      return method==='GET'&&!init.body&&!input?.bodyUsed&&url.origin==='https://overfzbjtpjqxzbujezg.supabase.co'&&/^\/rest\/v1\/[a-zA-Z_][a-zA-Z0-9_]*$/.test(url.pathname);
    }catch(_){return false;}
  }
  function showOffline(){
    if(!document.body)return;
    if(!banner){banner=document.createElement('div');banner.setAttribute('role','status');banner.style.cssText='position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2147483646;max-width:90vw;padding:10px 16px;border-radius:8px;background:#fff3cd;color:#644900;box-shadow:0 2px 12px #0002;font:14px system-ui;pointer-events:none';document.body.appendChild(banner);}
    banner.textContent='Sin conexión. Los cambios sin guardar no se enviarán automáticamente.';
    banner.hidden=navigator.onLine!==false;
  }
  function abortError(signal){return signal?.reason||new DOMException('Solicitud cancelada','AbortError');}
  function pause(ms,signal,waitOnline){
    return new Promise((resolve,reject)=>{
      if(signal?.aborted){reject(abortError(signal));return;}
      let timer;
      const done=(error)=>{clearTimeout(timer);window.removeEventListener('online',online);signal?.removeEventListener('abort',abort);error?reject(error):resolve();};
      const abort=()=>done(abortError(signal)),online=()=>done();
      signal?.addEventListener('abort',abort,{once:true});
      if(waitOnline)window.addEventListener('online',online,{once:true});
      timer=setTimeout(()=>done(),ms);
    });
  }
  function retryDelay(response){
    if(!response)return 800;
    const raw=response.headers.get('Retry-After');
    if(!raw)return response.status===429?null:800;
    const seconds=Number(raw),ms=Number.isFinite(seconds)?seconds*1000:Date.parse(raw)-Date.now();
    return Number.isFinite(ms)&&ms>=0&&ms<=5000?Math.max(800,ms):null;
  }
  window.fetch=async function(input,init){
    if(!safeRead(input,init))return nativeFetch(input,init);
    const signal=init?.signal||input?.signal;
    let response,failure;
    try{response=await nativeFetch(input,init);}catch(error){failure=error;}
    if(response&&!([429,502,503,504].includes(response.status)))return response;
    if(signal?.aborted||failure?.name==='AbortError'||failure?.name==='TimeoutError'){if(failure)throw failure;return response;}
    const key=String(typeof input==='string'?input:input?.url||input),now=Date.now(),delay=retryDelay(response);
    if(retrying>=3||now<(cooldowns.get(key)||0)||delay===null){if(failure)throw failure;return response;}
    if(cooldowns.size>=100)cooldowns.delete(cooldowns.keys().next().value);
    cooldowns.set(key,now+30000);retrying++;
    try{
      await pause(navigator.onLine===false?8000:delay,signal,navigator.onLine===false);
      if(navigator.onLine===false){if(failure)throw failure;return response;}
      if(signal?.aborted)throw abortError(signal);
      // Return the final real response: authentication errors and persistent failures stay visible.
      return await nativeFetch(input,init);
    }finally{retrying--;}
  };
  window.TPFConnectionRecovery={safeRead};
  window.addEventListener('offline',showOffline);window.addEventListener('online',showOffline);
  document.addEventListener('DOMContentLoaded',showOffline,{once:true});
  if(document.body)showOffline();
})();