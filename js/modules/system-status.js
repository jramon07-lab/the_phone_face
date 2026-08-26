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

  function render(){
    ensureCard();
    const box=document.getElementById('tpfModuleStatusList');
    if(!box) return;
    const items=M.status().filter(x=>x.name!=='runtime');
    box.innerHTML=items.map(item=>{
      const ok=['ready','ok'].includes(item.state);
      const label=ok?'Operativo':item.state==='loading'?'Cargando':'Error aislado';
      const dot=ok?'🟢':item.state==='loading'?'🟡':'🔴';
      return `<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid #edf0f3"><span>${dot}</span><div><b>${esc(item.name)}</b><div class="small">${esc(label)}${item.detail?` · ${esc(item.detail)}`:''}</div></div></div>`;
    }).join('') || '<div class="small">Sin módulos registrados todavía.</div>';
  }

  M.register('system-status',{
    install(){
      M.wrapGlobals('system-status',['loadSystemStatus']);
      window.addEventListener('tpf:module-status',()=>setTimeout(render,0));
      document.addEventListener('click',e=>{
        if(e.target?.closest?.('.nav[data-view="system"]')) setTimeout(render,50);
      });
      setTimeout(render,0);
    }
  });
})();
