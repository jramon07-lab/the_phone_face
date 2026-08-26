(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M) return;

  const later=(fn,ms=0)=>setTimeout(()=>{try{fn()}catch(e){console.warn('TPF automatizaciones avanzadas',e)}},ms);
  const byId=id=>document.getElementById(id);

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

  async function applyPreset(preset){
    await prepareAutomationOptions();
    const trigger=byId('auto2Trigger');
    const action=byId('auto2Action');
    if(!trigger||!action) return;
    if(preset==='renewal'){trigger.value='message_contains';action.value='assign_label';}
    if(preset==='unanswered'){trigger.value='unanswered';action.value='create_task';}
    if(preset==='sequence'){trigger.value='label_assigned';action.value='sequence_label_opportunity_whatsapp';}
    renderAutomationConfigs();
    later(()=>{
      if(preset==='renewal'&&byId('auto2Keyword')) byId('auto2Keyword').value='renovación';
      if(preset==='unanswered'&&byId('auto2UnansweredMinutes')) byId('auto2UnansweredMinutes').value='120';
    },20);
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
      <div class="small">Motor completo activo: elige una automatización rápida o configura manualmente CUANDO → HACER.</div>
      <div class="tpfAutoCapabilities">
        <span>WhatsApp recibido</span><span>Palabra clave</span><span>Cambio de columna</span><span>Etiqueta asignada</span><span>Sin respuesta</span>
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
    if(bar.querySelectorAll('[data-auto-preset]').length!==3 || !bar.textContent.includes('Constructor avanzado activo')) fillAdvancedBar(bar);
    else bindPresetButtons(bar);
  }

  async function restoreAdvancedAutomations(){
    ensureAdvancedAutomationBar();
    await prepareAutomationOptions();
    renderAutomationConfigs();
    try{if(typeof window.loadAutomations==='function') await window.loadAutomations();}catch(_){}
    ensureAdvancedAutomationBar();
  }

  M.register('automations-settings',{
    install(){
      M.wrapGlobals('automations-settings',[
        'loadAutomations','renderAutomations','loadGoogleSettings','loadNotifySettings',
        'saveNotifySettings','saveGoogleSettings','loadUsersAdmin','renderSelectedUserPerms',
        'saveSelectedUserPerms','loadSettings','renderSettingsSearchColumns'
      ]);
      ensureAdvancedStyles();
      ensureAdvancedAutomationBar();
      document.addEventListener('click',e=>{
        if(e.target?.closest?.('.nav[data-view="automations"]')) later(restoreAdvancedAutomations,120);
      });
      later(()=>{
        const view=byId('view-automations');
        if(view&&!view.classList.contains('hidden')) restoreAdvancedAutomations();
      },500);
    }
  });
})();
