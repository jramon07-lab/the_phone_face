/* TPF physical module split · generated from app-core.js */
(function(){
  const KEY='tpf_system_errors_v1';
  const maxErrors=30;
  function readErrors(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(_){return[]}}
  function writeErrors(items){try{localStorage.setItem(KEY,JSON.stringify(items.slice(0,maxErrors)))}catch(_){}}
  function recordError(type,message,detail){
    const items=readErrors();
    items.unshift({type:String(type||'Error'),message:String(message||'Error desconocido').slice(0,500),detail:String(detail||'').slice(0,700),at:new Date().toISOString()});
    writeErrors(items);
    if(!document.getElementById('view-system')?.classList.contains('hidden')) renderSystemErrors();
  }
  window.addEventListener('error',e=>recordError('JavaScript',e.message,e.filename?`${e.filename}:${e.lineno||''}`:''));
  window.addEventListener('unhandledrejection',e=>recordError('Promesa',e.reason?.message||String(e.reason||'Unhandled rejection'),''));

  const originalFetch=window.fetch.bind(window);
  window.fetch=async function(...args){
    try{
      const r=await originalFetch(...args);
      const url=String(typeof args[0]==='string'?args[0]:args[0]?.url||'');
      if(r.status>=400 && !url.includes('/api/green-health')) recordError(`HTTP ${r.status}`,url,r.statusText||'');
      return r;
    }catch(e){
      const url=String(typeof args[0]==='string'?args[0]:args[0]?.url||'');
      recordError('Red',url,e?.message||String(e));
      throw e;
    }
  };

  function setState(dotId,textId,state,text){
    const dot=document.getElementById(dotId), out=document.getElementById(textId);
    if(dot)dot.className='systemDot '+(state==='ok'?'systemDotOk':state==='warn'?'systemDotWarn':state==='bad'?'systemDotBad':'systemDotPending');
    if(out)out.textContent=text;
  }

  window.renderSystemErrors=function(){
    const box=document.getElementById('systemErrorList'); if(!box)return;
    const items=readErrors();
    if(!items.length){box.innerHTML='<div class="small">No hay fallos registrados en este navegador.</div>';return}
    const escText=v=>String(v||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    box.innerHTML=items.map(x=>`<div class="systemErrorItem"><b>${escText(x.type)} · ${escText(x.message)}</b><div>${escText(x.detail)}</div><small>${new Date(x.at).toLocaleString('es-ES')}</small></div>`).join('');
  };

  window.loadSystemStatus=async function(){
    if(!perms?.is_admin)return;
    setState('systemAppDot','systemAppText','pending','Comprobando…');
    setState('systemGreenDot','systemGreenText','pending','Comprobando…');
    setState('systemSupabaseDot','systemSupabaseText','pending','Comprobando…');
    setState('systemFrontDot','systemFrontText','pending','Comprobando…');
    const banner=document.getElementById('systemBanner'); if(banner){banner.className='systemBanner systemBannerPending';banner.textContent='Comprobando estado general…'}

    let app='bad',green='bad',supa='bad';
    try{
      const r=await originalFetch(location.pathname||'/',{method:'HEAD',cache:'no-store'});
      app=r.ok?'ok':'bad'; setState('systemAppDot','systemAppText',app,r.ok?'Aplicación online y respondiendo':'La aplicación no responde correctamente');
    }catch(e){setState('systemAppDot','systemAppText','bad','Error de conexión con la aplicación')}

    try{
      const r=await originalFetch('/api/green-health',{cache:'no-store'}); const d=await r.json().catch(()=>null);
      if(r.ok && d?.providerHealthy===true && d?.degraded!==true && String(d?.state||'').toLowerCase()==='authorized'){
        green='ok';setState('systemGreenDot','systemGreenText','ok','Authorized · proveedor sano');
      }else if(r.ok){green='warn';setState('systemGreenDot','systemGreenText','warn',`Degradado · ${d?.state||'estado desconocido'}`)}
      else setState('systemGreenDot','systemGreenText','bad',`Error HTTP ${r.status}`);
    }catch(e){setState('systemGreenDot','systemGreenText','bad','No se pudo comprobar GREEN-API')}

    try{
      const result=await sb.auth.getSession();
      if(result?.error)throw result.error;
      supa='ok';setState('systemSupabaseDot','systemSupabaseText','ok','Conexión y sesión operativas');
    }catch(e){setState('systemSupabaseDot','systemSupabaseText','bad',e?.message||'Error de conexión')}

    const errors=readErrors();
    const recent=errors.filter(x=>Date.now()-new Date(x.at).getTime()<3600000);
    const front=recent.length?'warn':'ok';
    setState('systemFrontDot','systemFrontText',front,recent.length?`${recent.length} fallo(s) registrado(s) en la última hora`:'Sin fallos recientes registrados');

    const states=[app,green,supa,front];
    const overall=states.includes('bad')?'bad':states.includes('warn')?'warn':'ok';
    if(banner){
      banner.className='systemBanner '+(overall==='ok'?'systemBannerOk':overall==='warn'?'systemBannerWarn':'systemBannerBad');
      banner.textContent=overall==='ok'?'Todo operativo':overall==='warn'?'Sistema operativo con avisos':'Hay un problema que requiere revisión';
    }
    const checked=document.getElementById('systemCheckedAt');if(checked)checked.textContent=new Date().toLocaleString('es-ES');
    renderSystemErrors();
  };

  document.addEventListener('click',e=>{
    if(e.target?.id==='systemRefresh')loadSystemStatus();
    if(e.target?.id==='systemClearErrors'){writeErrors([]);renderSystemErrors();loadSystemStatus();}
  });
})();
