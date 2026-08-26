const base = require('./index');
const fix = require('./index-fix');

const MENU_CLEAN = `
<style id="tpf-menu-clean-v3">
.nav[data-view="search"][data-sheet="LIQUIDACION"],
.nav[data-view="search"][data-sheet="DATA"],
.nav[data-view="search"][data-sheet="CLAWBACK"],
.nav[data-view="search"][data-sheet="AJUSTES"]{display:none!important}
#tpfWaTemplatesNav{user-select:none}
#tpfAutomationAdvancedBar{margin:0 0 14px;padding:14px 16px;border:1px solid #b9d3fb;border-radius:12px;background:#f7fbff}
#tpfAutomationAdvancedBar h3{margin:0 0 5px;font-size:15px}
.tpfAutoCaps{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}
.tpfAutoCaps span{display:inline-flex;padding:4px 7px;border-radius:999px;background:#eef4ff;color:#315fa7;font-size:9px;font-weight:700}
#tpfBuildBadge{position:fixed;right:8px;bottom:8px;z-index:30000;padding:5px 8px;border-radius:7px;background:#101828e8;color:#fff;font:10px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;box-shadow:0 3px 10px #0002;opacity:.78;pointer-events:none;max-width:min(460px,calc(100vw - 16px));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
</style>`;

const FINAL_BINDINGS = `
<script id="tpf-entry-unique-v3">
(function(){
  function byId(id){return document.getElementById(id)}
  async function openTemplates(){try{const waNav=document.querySelector('.nav[data-view="whatsapplive"]');if(waNav && byId('view-whatsapplive')?.classList.contains('hidden'))waNav.click();if(typeof waSyncTemplatesFromSupabase==='function')await waSyncTemplatesFromSupabase();if(typeof waRenderTemplates==='function')waRenderTemplates();byId('waTemplateModal')?.classList.remove('hidden')}catch(e){console.warn('Plantillas WhatsApp',e)}}
  function bindTemplatesNav(){const n=byId('tpfWaTemplatesNav');if(!n||n.dataset.bound==='1')return;n.dataset.bound='1';n.onclick=function(e){e.preventDefault();e.stopPropagation();openTemplates()}}
  async function showAdvancedAutomation(){try{if(typeof auto2PrepareOptions==='function')await auto2PrepareOptions();if(typeof auto2RenderTriggerConfig==='function')auto2RenderTriggerConfig();if(typeof auto2RenderActionConfig==='function')auto2RenderActionConfig();if(typeof loadAutomations==='function')await loadAutomations()}catch(e){console.warn('Automatizaciones avanzadas',e)}}
  function bindAutomations(){document.querySelectorAll('.nav[data-view="automations"]').forEach(function(n){if(n.dataset.advancedEntry==='1')return;n.dataset.advancedEntry='1';n.addEventListener('click',function(){setTimeout(showAdvancedAutomation,40)})})}
  function boot(){bindTemplatesNav();bindAutomations()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();setTimeout(boot,250);
})();
</script>`;

module.exports=async function(req,res){
  try{
    if(typeof base.buildHtml!=='function')throw new Error('buildHtml no disponible');
    if(typeof fix.applyFix!=='function')throw new Error('applyFix no disponible');

    let html=await base.buildHtml();
    html=fix.applyFix(html);

    const commit=String(process.env.VERCEL_GIT_COMMIT_SHA||'local');
    const branch=String(process.env.VERCEL_GIT_COMMIT_REF||'unknown');
    const shortCommit=commit.slice(0,8);

    html=html.replace(/function waDefaultTemplates\(\)\{return \[[\s\S]*?\]\}/,'function waDefaultTemplates(){return []}');

    if(!html.includes('id="tpfWaTemplatesNav"')){
      const waNav='<div class="nav secondaryNav" data-view="whatsapplive"><b>◉</b><span>WhatsApp</span></div>';
      const tplNav=waNav+'\n      <div id="tpfWaTemplatesNav" class="nav secondaryNav"><b>▤</b><span>Plantillas WhatsApp</span></div>';
      html=html.replace(waNav,tplNav);
    }

    if(!html.includes('id="tpfAutomationAdvancedBar"')){
      const grid='<div class="automation2Grid">';
      const bar=`<div id="tpfAutomationAdvancedBar"><h3>⚡ Constructor avanzado</h3><div class="small">Motor completo activo: configura disparadores, condiciones y acciones.</div><div class="tpfAutoCaps"><span>WhatsApp recibido</span><span>Palabra clave</span><span>Cambio de columna</span><span>Etiqueta</span><span>Sin respuesta</span><span>Tarea</span><span>Oportunidad</span><span>WhatsApp programado</span><span>Plantilla</span><span>Secuencia</span></div></div>`;
      html=html.replace(grid,bar+'\n    '+grid);
    }

    const buildBadge=`<div id="tpfBuildBadge" data-tpf-commit="${shortCommit}" data-tpf-branch="${branch}">PRUEBAS · ${branch} · ${shortCommit}</div>`;
    if(!html.includes('id="tpfBuildBadge"'))html=html.includes('</body>')?html.replace('</body>',buildBadge+'\n</body>'):html+buildBadge;

    html=html.includes('</head>')?html.replace('</head>',MENU_CLEAN+'\n</head>'):MENU_CLEAN+html;
    html=html.includes('</body>')?html.replace('</body>',FINAL_BINDINGS+'\n</body>'):html+FINAL_BINDINGS;

    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store, max-age=0');
    res.setHeader('X-TPF-Menu','clean-v3');
    res.setHeader('X-TPF-Entry','single-endpoint-no-http-chain');
    res.setHeader('X-TPF-Commit',commit);
    res.setHeader('X-TPF-Branch',branch);
    res.status(200).send(html);
  }catch(e){res.status(500).send('No se pudo cargar The Phone Face: '+(e?.message||e))}
};
