(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M) return;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function ensureCard(){
    const host=document.getElementById('view-system');
    if(!host || document.getElementById('tpfModuleStatusCard')) return;
    const card=document.createElement('div');
    card.id='tpfModuleStatusCard';
    card.className='card';
    card.innerHTML='<h3 style="margin-bottom:8px">Módulos independientes</h3><div class="small" style="margin-bottom:10px">Un fallo en un módulo queda aislado y se registra aquí.</div><div id="tpfModuleStatusList"></div>';
    host.appendChild(card);
  }

  function systemErrors(){
    try{const rows=JSON.parse(localStorage.getItem('tpf_system_errors_v1')||'[]');return Array.isArray(rows)?rows.slice(0,30):[]}catch(_){return []}
  }
  function moduleErrors(){
    try{return typeof M.errors==='function'?(M.errors()||[]).slice(0,30):[]}catch(_){return []}
  }
  function allErrors(){
    const rows=[...systemErrors().map(x=>({...x,source:x.source||'Sistema'})),...moduleErrors().map(x=>({...x,source:x.module||'Módulo'}))];
    rows.sort((a,b)=>String(b.at||b.created_at||'').localeCompare(String(a.at||a.created_at||'')));
    return rows.slice(0,40);
  }

  function ensureErrorsCard(){
    const host=document.getElementById('view-system');
    if(!host || document.getElementById('tpfVisibleErrorsCard')) return;
    const card=document.createElement('div');
    card.id='tpfVisibleErrorsCard';
    card.className='card';
    card.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><h3 style="margin:0 0 6px">Errores recientes</h3><div class="small">Errores JavaScript, módulos y fallos registrados por el CRM.</div></div><button id="tpfClearVisibleErrors" type="button" class="secondary">Limpiar errores</button></div><div id="tpfVisibleErrorsList" style="margin-top:10px"></div>`;
    host.appendChild(card);
  }

  function renderErrors(){
    ensureErrorsCard();
    const box=document.getElementById('tpfVisibleErrorsList');
    if(!box)return;
    const rows=allErrors();
    box.innerHTML=rows.length?rows.map((e,i)=>{
      const when=e.at||e.created_at||'';
      const message=e.message||e.detail||e.error||'Error sin detalle';
      const source=e.source||e.module||e.context||'Sistema';
      return `<div data-error-row="${i}" style="padding:10px 0;border-bottom:1px solid #edf0f3"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span>🔴</span><b>${esc(source)}</b><span class="small">${esc(when?new Date(when).toLocaleString('es-ES'):'')}</span></div><div class="small" style="margin:5px 0 0 26px;white-space:pre-wrap;word-break:break-word">${esc(message)}</div></div>`;
    }).join(''):'<div class="small">No hay errores registrados.</div>';
  }

  function render(){
    ensureCard();
    const box=document.getElementById('tpfModuleStatusList');
    if(box){
      const items=M.status().filter(x=>x.name!=='runtime');
      box.innerHTML=items.map(item=>{
        const ok=['ready','ok'].includes(item.state);
        const label=ok?'Operativo':item.state==='loading'?'Cargando':'Error aislado';
        const dot=ok?'🟢':item.state==='loading'?'🟡':'🔴';
        return `<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid #edf0f3"><span>${dot}</span><div><b>${esc(item.name)}</b><div class="small">${esc(label)}${item.detail?` · ${esc(item.detail)}`:''}</div></div></div>`;
      }).join('') || '<div class="small">Sin módulos registrados todavía.</div>';
    }
    renderErrors();
  }

  const SENSITIVE_KEY=/pass(word)?|secret|token|authorization|cookie|api[_-]?key|private[_-]?key|credential/i;
  const SENSITIVE_TEXT=[/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi,/sb_(?:publishable|secret)_[A-Za-z0-9_-]+/gi,/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]{10,})?/g,/(?:GREEN_API_TOKEN|CRM_TEST_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET)\s*[:=]\s*[^\s,;]+/gi];
  function safeUrl(value){try{const u=new URL(String(value),location.origin);return u.origin===location.origin?u.pathname:u.origin+u.pathname}catch(_){return String(value||'')}}
  function redactText(value){let out=String(value??'');if(/^https?:\/\//i.test(out))out=safeUrl(out);for(const rx of SENSITIVE_TEXT)out=out.replace(rx,'[REDACTADO]');out=out.replace(/([?&](?:token|secret|password|key|auth|code)=)[^&#\s]+/gi,'$1[REDACTADO]');return out.slice(0,2500)}
  function sanitize(value,depth=0){if(depth>6)return '[TRUNCADO]';if(value===null||value===undefined||typeof value==='number'||typeof value==='boolean')return value;if(typeof value==='string')return redactText(value);if(Array.isArray(value))return value.slice(0,100).map(v=>sanitize(v,depth+1));if(typeof value==='object'){const out={};for(const [k,v] of Object.entries(value).slice(0,100))out[k]=SENSITIVE_KEY.test(k)?'[REDACTADO]':sanitize(v,depth+1);return out}return redactText(value)}
  function stateText(id){return document.getElementById(id)?.textContent?.trim()||''}

  function buildDiagnostic(){
    const badge=document.getElementById('tpfBuildBadge');
    return sanitize({schema:'tpf-diagnostic-v1',generated_at:new Date().toISOString(),build:{commit:badge?.dataset?.tpfCommit||'',branch:badge?.dataset?.tpfBranch||''},page:{path:location.pathname,viewport:{width:window.innerWidth,height:window.innerHeight},online:navigator.onLine,visibility:document.visibilityState},device:{user_agent:navigator.userAgent,language:navigator.language,platform:navigator.platform||''},system_status:{overall:stateText('systemBanner'),application:stateText('systemAppText'),green_api:stateText('systemGreenText'),supabase:stateText('systemSupabaseText'),frontend:stateText('systemFrontText'),checked_at:stateText('systemCheckedAt')},modules:typeof M.status==='function'?M.status():[],system_errors:systemErrors(),module_errors:moduleErrors()});
  }

  function ensureExportButton(){
    const host=document.getElementById('view-system');
    if(!host || document.getElementById('systemExportDiagnostic')) return;
    const refresh=document.getElementById('systemRefresh');
    const btn=document.createElement('button');btn.id='systemExportDiagnostic';btn.type='button';btn.className='secondary';btn.textContent='Exportar diagnóstico';btn.title='Descarga un diagnóstico técnico sin contraseñas ni tokens';
    if(refresh?.parentElement)refresh.parentElement.appendChild(btn);else host.prepend(btn);
  }

  window.tpfBuildDiagnostic=buildDiagnostic;
  window.tpfExportDiagnostic=async function(){try{if(typeof window.loadSystemStatus==='function')await window.loadSystemStatus()}catch(_){}const data=buildDiagnostic();const stamp=new Date().toISOString().replace(/[:.]/g,'-');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`the-phone-face-diagnostico-${stamp}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return data};

  M.register('system-status',{install(){
    M.wrapGlobals('system-status',['loadSystemStatus']);
    window.addEventListener('tpf:module-status',()=>setTimeout(render,0));
    window.addEventListener('error',()=>setTimeout(renderErrors,0));
    window.addEventListener('unhandledrejection',()=>setTimeout(renderErrors,0));
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('.nav[data-view="system"]'))setTimeout(()=>{ensureExportButton();render()},50);
      if(e.target?.id==='systemExportDiagnostic')window.tpfExportDiagnostic();
      if(e.target?.id==='tpfClearVisibleErrors'){
        try{localStorage.removeItem('tpf_system_errors_v1')}catch(_){}
        try{if(typeof M.clearErrors==='function')M.clearErrors()}catch(_){}
        renderErrors();
      }
    });
    setTimeout(()=>{ensureExportButton();render()},0);
  }});
})();