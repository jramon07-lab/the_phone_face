(function(){
  'use strict';
  if(window.TPFModules && window.TPFModules.version>=1) return;

  const states=new Map();
  const owners=new Map();
  const ERROR_KEY='tpf_module_errors_v1';
  const CONFLICT_KEY='tpf_control_conflicts_v1';
  const MAX_ERRORS=40;
  const MAX_CONFLICTS=40;

  function safeString(v){try{return String(v??'');}catch(_){return 'Error desconocido';}}
  function persistList(key,entry,max){try{const prev=JSON.parse(localStorage.getItem(key)||'[]');prev.unshift(entry);localStorage.setItem(key,JSON.stringify(prev.slice(0,max)));}catch(_){}}
  function persistError(entry){persistList(ERROR_KEY,entry,MAX_ERRORS)}
  function emit(name,state,detail=''){const item={name,state,detail:safeString(detail),at:new Date().toISOString()};states.set(name,item);try{window.dispatchEvent(new CustomEvent('tpf:module-status',{detail:item}));}catch(_){}return item;}
  function report(name,error,context=''){const message=safeString(error?.message||error);const entry={module:name,message,context:safeString(context),at:new Date().toISOString()};persistError(entry);emit(name,'error',message);try{console.error(`[TPF:${name}]`,context||'error',error);}catch(_){}return entry;}
  function guard(name,fn,options={}){if(typeof fn!=='function')return fn;if(fn.__tpfGuarded)return fn;const rethrow=options.rethrow===true;const fallback=Object.prototype.hasOwnProperty.call(options,'fallback')?options.fallback:undefined;const wrapped=function(...args){try{const result=fn.apply(this,args);if(result&&typeof result.then==='function')return result.then(value=>{emit(name,'ok');return value;}).catch(error=>{report(name,error,fn.name||'async');if(rethrow)throw error;return typeof fallback==='function'?fallback(error):fallback;});emit(name,'ok');return result;}catch(error){report(name,error,fn.name||'sync');if(rethrow)throw error;return typeof fallback==='function'?fallback(error):fallback;}};Object.defineProperty(wrapped,'__tpfGuarded',{value:true});Object.defineProperty(wrapped,'__tpfOriginal',{value:fn});return wrapped;}
  function wrapGlobals(name,names,options={}){const rethrowSet=new Set(options.rethrow||[]);const wrapped=[];for(const key of names||[]){const fn=window[key];if(typeof fn!=='function'||fn.__tpfGuarded)continue;window[key]=guard(name,fn,{rethrow:rethrowSet.has(key)});wrapped.push(key);}return wrapped;}
  function register(name,definition={}){if(!name)throw new Error('Nombre de módulo requerido');if(states.get(name)?.state==='ready'||states.get(name)?.state==='ok')return states.get(name);emit(name,'loading');try{if(typeof definition.install==='function')definition.install(api);return emit(name,'ready');}catch(error){report(name,error,'install');return states.get(name);}}
  function status(){return Array.from(states.values()).map(x=>({...x}));}
  function errors(){try{return JSON.parse(localStorage.getItem(ERROR_KEY)||'[]');}catch(_){return [];}}
  function clearErrors(){try{localStorage.removeItem(ERROR_KEY);}catch(_){}}

  function normalizeControl(control){if(!control)return '';if(typeof control==='string')return control.trim();if(control.id)return '#'+control.id;return safeString(control);}
  function claimControl(moduleName,control,action='click'){
    const normalized=normalizeControl(control);const key=`${normalized}::${safeString(action)}`;
    if(!moduleName||!normalized)return false;
    const current=owners.get(key);
    if(current&&current.module!==moduleName){
      const conflict={control:normalized,action:safeString(action),module:safeString(moduleName),owner:current.module,at:new Date().toISOString()};
      persistList(CONFLICT_KEY,conflict,MAX_CONFLICTS);
      report('runtime',new Error(`Conflicto de control: ${key} ya pertenece a ${current.module}`),`claimControl:${moduleName}`);
      try{window.dispatchEvent(new CustomEvent('tpf:ownership-conflict',{detail:conflict}));}catch(_){}
      return false;
    }
    owners.set(key,{module:moduleName,control:normalized,action:safeString(action),at:new Date().toISOString()});
    return true;
  }
  function releaseControl(moduleName,control,action='click'){const key=`${normalizeControl(control)}::${safeString(action)}`;const current=owners.get(key);if(!current||current.module!==moduleName)return false;owners.delete(key);return true;}
  function ownerships(){return Array.from(owners.values()).map(x=>({...x}));}
  function conflicts(){try{return JSON.parse(localStorage.getItem(CONFLICT_KEY)||'[]');}catch(_){return [];}}
  function clearConflicts(){try{localStorage.removeItem(CONFLICT_KEY);}catch(_){}}

  function installBrowserErrorCapture(){
    if(window.__tpfBrowserErrorCaptureInstalled)return;
    window.__tpfBrowserErrorCaptureInstalled=true;
    window.addEventListener('error',e=>{if(e?.error||e?.message)report('browser',e.error||new Error(e.message||'Error JavaScript'),e.filename?`${e.filename}:${e.lineno||0}`:'window.error')});
    window.addEventListener('unhandledrejection',e=>report('browser',e?.reason||new Error('Promesa rechazada'),'unhandledrejection'));
  }

  function installWhatsappLogoutPlacement(){
    if(document.getElementById('tpfWhatsappLogoutStyle'))return;
    const style=document.createElement('style');style.id='tpfWhatsappLogoutStyle';style.textContent=`.referenceUser .tpfWaLogout{margin-left:auto!important;padding:6px 9px!important;min-width:auto!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:7px!important;background:rgba(255,255,255,.08)!important;color:#fff!important;font-size:11px!important;line-height:1!important;flex:0 0 auto!important;white-space:nowrap!important}.referenceUser .tpfWaLogout:hover{background:rgba(255,255,255,.14)!important}.referenceUser:has(.tpfWaLogout) .referenceOnline{display:none!important}`;document.head.appendChild(style);
    let queued=false;const sync=()=>{queued=false;const logout=document.getElementById('logout');const sideUser=document.querySelector('.referenceUser');if(!logout||!sideUser)return;if(logout.parentElement!==sideUser)sideUser.appendChild(logout);logout.classList.add('tpfWaLogout');};const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(sync);};document.querySelectorAll('.nav').forEach(el=>el.addEventListener('click',()=>{queue();setTimeout(queue,120);}));window.addEventListener('resize',queue,{passive:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden)queue();});queue();setTimeout(queue,300);
  }

  function loadScript(id,src,onload){if(document.getElementById(id))return;const s=document.createElement('script');s.id=id;s.src=src;s.async=false;if(onload)s.onload=onload;document.head.appendChild(s);}
  function loadContactProfile(){loadScript('tpfContactProfileScript','/js/modules/contact-profile.js',()=>loadScript('tpfContactOpenNonBlockingScript','/js/modules/contact-open-nonblocking.js'));}
  function loadSearchFallback(){loadScript('tpfSearchFallbackScript','/js/modules/search-fallback.js');}

  const api={version:1,register,guard,wrapGlobals,report,emit,status,errors,clearErrors,claimControl,releaseControl,ownerships,conflicts,clearConflicts};
  window.TPFModules=api;emit('runtime','ready');installBrowserErrorCapture();setTimeout(installWhatsappLogoutPlacement,0);setTimeout(loadContactProfile,0);setTimeout(loadSearchFallback,0);
})();