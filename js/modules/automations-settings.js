(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M) return;

  const later=(fn,ms=0)=>setTimeout(()=>{try{fn()}catch(e){console.warn('TPF automatizaciones avanzadas',e)}},ms);
  const byId=id=>document.getElementById(id);

  function enableServerAutomationMode(){
    window.TPF_SERVER_AUTOMATIONS=true;
    const current=window.auto2Execute;
    if(typeof current==='function' && current.__tpfServerGate!==true){
      const original=current;
      const gated=async function(...args){
        if(window.TPF_SERVER_AUTOMATIONS===true) return;
        return original.apply(this,args);
      };
      gated.__tpfServerGate=true;
      gated.__tpfOriginal=original;
      window.__tpfAuto2ExecuteLocal=original;
      window.auto2Execute=gated;
    }
  }

  function ensureAdvancedStyles(){
    if(document.getElementById('tpfAutomationAdvancedStyles')) return;
    const style=document.createElement('style');
    style.id='tpfAutomationAdvancedStyles';
    style.textContent=`
      #view-automations .automation2Grid{grid-template-columns:minmax(500px,620px) 1fr!important}
      #view-automations .auto2Config{display:block!important;visibility:visible!important;opacity:1!important;min-height:34px!important;margin-top:8px!important;overflow:visible!important}
      #view-automations .auto2Config:empty{min-height:0!important;margin-top:0!important}
      #view-automations .auto2Builder{overflow:visible!important}
      #tpfAutomationAdvancedBar{margin:0 0 14px;padding:14px;border:1px solid #b9d3fb;border-radius:12px;background:#f7fbff}
      #tpfAutomationAdvancedBar h3{margin:0 0 5px;font-size:15px}
      .tpfAutoPresetButtons{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
      .tpfAutoPresetButtons button{background:#fff;border:1px solid #cfdcf0;color:#2454a6;padding:8px 10px;font-size:10px}
      .tpfAutoCapabilities{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}
      .tpfAutoCapabilities span{display:inline-flex;padding:4px 7px;border-radius:999px;background:#eef4ff;color:#315fa7;font-size:9px;font-weight:700}
      #tpfAutomationHistory{margin-top:16px;padding:14px;border:1px solid #dfe5ea;border-radius:12px;background:#fff}
      .tpfAutoHistoryHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap}
      .tpfAutoHistoryHead h3{margin:0;font-size:15px}
      .tpfAutoHistoryTableWrap{overflow:auto}
      .tpfAutoHistoryTable{width:100%;border-collapse:collapse;font-size:11px}
      .tpfAutoHistoryTable th,.tpfAutoHistoryTable td{padding:8px;border-bottom:1px solid #edf0f3;text-align:left;vertical-align:top}
      .tpfAutoRunOk,.tpfAutoRunError,.tpfAutoRunPending{display:inline-flex;padding:3px 7px;border-radius:999px;font-weight:700}
      .tpfAutoRunOk{background:#eaf8ef;color:#24723a}.tpfAutoRunError{background:#fff0f0;color:#a32929}.tpfAutoRunPending{background:#fff7df;color:#7a5a00}
      .tpfAutoHistoryError{max-width:320px;white-space:normal;word-break:break-word}
      .tpfAutoHistoryEmpty{padding:12px 0;color:#6b7280}
      @media(max-width:980px){#view-automations .automation2Grid{grid-template-columns:1fr!important}}
    `;
    document.head.appendChild(style);
  }

  function renderAutomationConfigs(){
    try{if(typeof window.auto2RenderTriggerConfig==='function') window.auto2RenderTriggerConfig();}catch(_){}
    try{if(typeof window.auto2RenderActionConfig==='function') window.auto2RenderActionConfig();}catch(_){}
    try{if(typeof auto2RenderTriggerConfig==='function') auto2RenderTriggerConfig();}catch(_){}
    try{if(typeof auto2RenderActionConfig==='function') auto2RenderActionConfig();}catch(_){}
  }

  async function prepareAutomationOptions(){
    try{
      if(typeof window.auto2PrepareOptions==='function') await window.auto2PrepareOptions();
      else if(typeof auto2PrepareOptions==='function') await auto2PrepareOptions();
    }catch(_){}
  }

  function keepFieldValue(id,value,attempt=0){
    const field=byId(id);
    if(field && field.value!==String(value)) field.value=String(value);
    if(attempt<30) setTimeout(()=>keepFieldValue(id,value,attempt+1),50);
  }

  async function applyPreset(preset){
    await prepareAutomationOptions();
    const trigger=byId('auto2Trigger');
    const action=byId('auto2Action');
    if(!trigger||!action) return;
    if(preset==='renewal'){trigger.value='message_contains';action.value='assign_label';}
    if(preset==='unanswered'){trigger.value='unanswered';action.value='create_task';}
    if(preset==='sequence'){trigger.value='label_assigned';action.value='sequence_label_opportunity_whatsapp';}
    renderAutomationConfigs();
    if(preset==='renewal') keepFieldValue('auto2Keyword','renovación');
    if(preset==='unanswered') keepFieldValue('auto2UnansweredMinutes','120');
  }

  function bindPresetButtons(bar){
    bar.querySelectorAll('[data-auto-preset]').forEach(btn=>{
      if(btn.dataset.tpfPresetBound==='1') return;
      btn.dataset.tpfPresetBound='1';
      btn.addEventListener('click',()=>applyPreset(btn.dataset.autoPreset));
    });
  }

  function fillAdvancedBar(bar){
    bar.innerHTML=`
      <h3>⚡ Constructor avanzado activo</h3>
      <div class="small">Motor completo activo en servidor: elige una automatización rápida o configura manualmente CUANDO → HACER. Las reglas siguen funcionando aunque cierres el CRM.</div>
      <div class="tpfAutoCapabilities">
        <span>Servidor 24/7</span><span>WhatsApp recibido</span><span>Palabra clave</span><span>Cambio de columna</span><span>Etiqueta asignada</span><span>Sin respuesta</span>
        <span>Tarea</span><span>Oportunidad</span><span>Etiqueta</span><span>WhatsApp programado</span><span>Plantilla</span><span>Secuencia</span>
      </div>
      <div class="tpfAutoPresetButtons">
        <button type="button" data-auto-preset="renewal">Renovación → etiqueta</button>
        <button type="button" data-auto-preset="unanswered">Sin respuesta → tarea</button>
        <button type="button" data-auto-preset="sequence">Etiqueta → oportunidad + WhatsApp</button>
      </div>`;
    bindPresetButtons(bar);
  }

  function ensureAdvancedAutomationBar(){
    const view=byId('view-automations');
    if(!view) return;
    const grid=view.querySelector('.automation2Grid');
    if(!grid) return;
    ensureAdvancedStyles();
    let bar=byId('tpfAutomationAdvancedBar');
    if(!bar){
      bar=document.createElement('div');
      bar.id='tpfAutomationAdvancedBar';
      grid.insertAdjacentElement('beforebegin',bar);
    }
    if(bar.querySelectorAll('[data-auto-preset]').length!==3 || !bar.textContent.includes('Servidor 24/7')) fillAdvancedBar(bar);
    else bindPresetButtons(bar);
  }

  function actionLabel(t){
    return ({create_task:'Crear tarea',create_opportunity:'Crear oportunidad',assign_label:'Asignar etiqueta',schedule_whatsapp:'Programar WhatsApp',send_template:'Enviar plantilla',sequence_label_opportunity_whatsapp:'Secuencia',__send_whatsapp:'Enviar WhatsApp'})[t]||t||'—';
  }
  function historyStatus(row){
    if(row.run_status==='ok') return ['Correcta','tpfAutoRunOk'];
    if(row.run_status==='error') return ['Error','tpfAutoRunError'];
    return [row.run_status||'Pendiente','tpfAutoRunPending'];
  }
  function fmtHistoryDate(v){
    try{return new Date(v).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});}catch(_){return String(v||'');}
  }
  function ensureHistoryPanel(){
    const view=byId('view-automations');
    if(!view) return null;
    let box=byId('tpfAutomationHistory');
    if(box) return box;
    box=document.createElement('section');
    box.id='tpfAutomationHistory';
    box.innerHTML=`<div class="tpfAutoHistoryHead"><div><h3>Historial de ejecuciones</h3><div class="small">Comprueba qué automatizaciones se ejecutaron y cuáles fallaron.</div></div><button type="button" id="tpfAutoHistoryReload" class="secondary">Actualizar historial</button></div><div id="tpfAutoHistoryBody" class="tpfAutoHistoryEmpty">Cargando…</div>`;
    view.appendChild(box);
    byId('tpfAutoHistoryReload')?.addEventListener('click',()=>loadAutomationHistory());
    return box;
  }
  async function loadAutomationHistory(){
    ensureHistoryPanel();
    const body=byId('tpfAutoHistoryBody');
    if(!body || !window.sb) return;
    body.textContent='Cargando…';
    try{
      const {data,error}=await window.sb.rpc('crm_list_automation_execution_history',{p_limit:50});
      if(error) throw error;
      const rows=Array.isArray(data)?data:[];
      if(!rows.length){body.className='tpfAutoHistoryEmpty';body.textContent='Todavía no hay ejecuciones registradas.';return;}
      body.className='tpfAutoHistoryTableWrap';
      body.innerHTML=`<table class="tpfAutoHistoryTable"><thead><tr><th>Fecha</th><th>Automatización</th><th>Acción</th><th>Estado</th><th>Detalle</th><th>Acciones</th></tr></thead><tbody>${rows.map(r=>{
        const [label,cls]=historyStatus(r);
        const detail=r.error_message?String(r.error_message):'Sin errores';
        return `<tr><td>${fmtHistoryDate(r.created_at)}</td><td>${window.esc?window.esc(r.automation_name||''):String(r.automation_name||'')}</td><td>${window.esc?window.esc(actionLabel(r.action_type)):actionLabel(r.action_type)}</td><td><span class="${cls}">${label}</span></td><td class="tpfAutoHistoryError">${window.esc?window.esc(detail):detail}</td><td>${r.can_retry&&r.job_id?`<button type="button" class="secondary" data-tpf-auto-retry="${r.job_id}">Reintentar</button>`:'—'}</td></tr>`;
      }).join('')}</tbody></table>`;
      body.querySelectorAll('[data-tpf-auto-retry]').forEach(btn=>btn.addEventListener('click',async()=>{
        if(!confirm('¿Reintentar esta acción segura ahora?')) return;
        btn.disabled=true;btn.textContent='Reintentando…';
        try{
          const {error}=await window.sb.rpc('crm_retry_automation_job_safe',{p_job_id:btn.dataset.tpfAutoRetry});
          if(error) throw error;
          btn.textContent='En cola';
          later(loadAutomationHistory,1500);
        }catch(e){alert(e?.message||'No se pudo reintentar.');btn.disabled=false;btn.textContent='Reintentar';}
      }));
    }catch(e){body.className='tpfAutoHistoryEmpty';body.textContent='No se pudo cargar el historial: '+(e?.message||e);}
  }
  window.loadAutomationHistory=loadAutomationHistory;

  async function restoreAdvancedAutomations(){
    enableServerAutomationMode();
    ensureAdvancedAutomationBar();
    ensureHistoryPanel();
    await prepareAutomationOptions();
    renderAutomationConfigs();
    try{if(typeof window.loadAutomations==='function') await window.loadAutomations();}catch(_){}
    ensureAdvancedAutomationBar();
    await loadAutomationHistory();
  }

  M.register('automations-settings',{
    install(){
      enableServerAutomationMode();
      M.wrapGlobals('automations-settings',[
        'loadAutomations','renderAutomations','loadGoogleSettings','loadNotifySettings',
        'saveNotifySettings','saveGoogleSettings','loadUsersAdmin','renderSelectedUserPerms',
        'saveSelectedUserPerms','loadSettings','renderSettingsSearchColumns'
      ]);
      ensureAdvancedStyles();
      ensureAdvancedAutomationBar();
      ensureHistoryPanel();
      const reload=byId('auto2Reload');
      if(reload && reload.dataset.tpfHistoryBound!=='1'){
        reload.dataset.tpfHistoryBound='1';
        reload.addEventListener('click',()=>later(loadAutomationHistory,200));
      }
      document.addEventListener('click',e=>{
        if(e.target?.closest?.('.nav[data-view="automations"]')) later(restoreAdvancedAutomations,120);
      });
      later(()=>{
        enableServerAutomationMode();
        const view=byId('view-automations');
        if(view&&!view.classList.contains('hidden')) restoreAdvancedAutomations();
      },500);
    }
  });
})();
