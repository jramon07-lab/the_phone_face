(function(){
  'use strict';
  const byId=id=>document.getElementById(id);
  function ensureStyles(){
    if(byId('tpfAutoUiPolishStyles'))return;
    const s=document.createElement('style');s.id='tpfAutoUiPolishStyles';s.textContent=`
      #view-automations .pageHeader{display:none!important}
      #tpfAutoHero{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin:0 0 14px;padding:18px 20px;border:1px solid #dbe7f5;border-radius:16px;background:linear-gradient(135deg,#f8fbff,#fff)}
      #tpfAutoHero h2{margin:0 0 5px;font-size:24px}#tpfAutoHero p{margin:0;color:#667085;font-size:12px}
      .tpfAutoHeroActions{display:flex;gap:8px;flex-wrap:wrap}.tpfAutoHeroActions button{white-space:nowrap}
      #tpfAutoStats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}
      .tpfAutoStat{padding:13px 14px;border:1px solid #e3e8ef;border-radius:12px;background:#fff}.tpfAutoStat span{display:block;font-size:10px;color:#667085;margin-bottom:4px}.tpfAutoStat b{font-size:21px}
      #tpfAutomationAdvancedBar{padding:16px!important;border-radius:14px!important;background:#fff!important;border:1px solid #e1e7ef!important;box-shadow:0 4px 16px rgba(15,23,42,.04)}
      #tpfAutomationAdvancedBar h3{font-size:16px!important}.tpfAutoCapabilities{display:none!important}
      .tpfAutoPresetButtons{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:9px!important}.tpfAutoPresetButtons button{min-height:58px!important;text-align:left!important;padding:12px!important;border-radius:11px!important;font-size:11px!important;font-weight:700!important}
      #view-automations .automation2Grid{gap:14px!important;align-items:start!important}
      #view-automations .automation2Grid>.card{border-radius:14px!important;border:1px solid #e2e8f0!important;box-shadow:0 4px 16px rgba(15,23,42,.035)!important}
      #view-automations .automation2Head{padding-bottom:10px;border-bottom:1px solid #eef2f6;margin-bottom:10px}
      #view-automations #auto2FormTitle:before{content:'⚙ ';}
      #view-automations #auto2List .auto2Rule{border:1px solid #e5eaf0!important;border-radius:11px!important;margin-bottom:9px!important;background:#fff!important}
      #tpfAutomationHistory{border-radius:14px!important;box-shadow:0 4px 16px rgba(15,23,42,.035)}
      @media(max-width:900px){#tpfAutoStats{grid-template-columns:repeat(2,1fr)}.tpfAutoPresetButtons{grid-template-columns:1fr!important}#tpfAutoHero{flex-direction:column}.tpfAutoHeroActions{width:100%}}
    `;document.head.appendChild(s);
  }
  function counts(){
    const rows=Array.isArray(window.crmAutomations)?window.crmAutomations:[];
    const active=rows.filter(x=>x.enabled).length,paused=rows.length-active;
    let errors=0;document.querySelectorAll('#tpfAutoHistoryBody .tpfAutoRunError').forEach(()=>errors++);
    return {total:rows.length,active,paused,errors};
  }
  function refreshStats(){const c=counts();[['tpfAutoTotal',c.total],['tpfAutoActive',c.active],['tpfAutoPaused',c.paused],['tpfAutoErrors',c.errors]].forEach(([id,v])=>{const e=byId(id);if(e&&e.textContent!==String(v))e.textContent=v;});}
  function ensureHero(){
    const view=byId('view-automations');if(!view)return;
    ensureStyles();
    let hero=byId('tpfAutoHero');
    if(!hero){hero=document.createElement('section');hero.id='tpfAutoHero';hero.innerHTML=`<div><h2>Automatizaciones</h2><p>Crea, controla y revisa reglas automáticas del CRM. El motor sigue funcionando en servidor aunque cierres la aplicación.</p></div><div class="tpfAutoHeroActions"><button id="tpfAutoNew" class="primary" type="button">+ Nueva automatización</button><button id="tpfAutoRefresh" class="secondary" type="button">↻ Actualizar</button></div>`;view.insertAdjacentElement('afterbegin',hero);}
    let stats=byId('tpfAutoStats');if(!stats){stats=document.createElement('div');stats.id='tpfAutoStats';stats.innerHTML=`<div class="tpfAutoStat"><span>Total</span><b id="tpfAutoTotal">0</b></div><div class="tpfAutoStat"><span>Activas</span><b id="tpfAutoActive">0</b></div><div class="tpfAutoStat"><span>Pausadas</span><b id="tpfAutoPaused">0</b></div><div class="tpfAutoStat"><span>Errores visibles</span><b id="tpfAutoErrors">0</b></div>`;hero.insertAdjacentElement('afterend',stats);}
    const reload=byId('auto2Reload');if(reload)reload.style.display='none';
    if(byId('tpfAutoRefresh')&&!byId('tpfAutoRefresh').dataset.bound){byId('tpfAutoRefresh').dataset.bound='1';byId('tpfAutoRefresh').onclick=()=>reload?.click();}
    if(byId('tpfAutoNew')&&!byId('tpfAutoNew').dataset.bound){byId('tpfAutoNew').dataset.bound='1';byId('tpfAutoNew').onclick=()=>{try{window.auto2ResetForm?.()}catch(_){ }byId('auto2Name')?.focus();byId('auto2FormTitle')?.scrollIntoView({behavior:'smooth',block:'center'});};}
    const bar=byId('tpfAutomationAdvancedBar');if(bar){const h=bar.querySelector('h3');if(h&&h.textContent!=='Plantillas rápidas')h.textContent='Plantillas rápidas';const sm=bar.querySelector('.small');if(sm&&sm.textContent!=='Empieza con una automatización habitual y personalízala después.')sm.textContent='Empieza con una automatización habitual y personalízala después.';}
    refreshStats();
  }
  function init(){ensureHero();setTimeout(ensureHero,250);setTimeout(refreshStats,700);}
  document.addEventListener('click',e=>{if(e.target?.closest?.('.nav[data-view="automations"]'))setTimeout(init,100);if(e.target?.closest?.('#auto2Save,#auto2Reload,[onclick*="auto2Toggle"],[onclick*="auto2Delete"]'))setTimeout(refreshStats,700);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){const v=byId('view-automations');if(v&&!v.classList.contains('hidden')){ensureHero();refreshStats();}}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();