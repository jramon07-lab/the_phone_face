const https = require('https');

function getText(url){
  return new Promise((resolve,reject)=>{
    https.get(url,{headers:{'User-Agent':'The-Phone-Face-Vercel-Fix'}},r=>{
      if(r.statusCode>=300 && r.statusCode<400 && r.headers.location){
        r.resume(); return getText(r.headers.location).then(resolve,reject);
      }
      if(r.statusCode!==200){r.resume(); return reject(new Error('HTTP '+r.statusCode));}
      let body=''; r.setEncoding('utf8');
      r.on('data',c=>body+=c); r.on('end',()=>resolve(body));
    }).on('error',reject);
  });
}

const UX_PATCH = String.raw`
<style id="tpf-fix-3-points-v1">
/* 1) WhatsApp: historial desplazable y compositor siempre visible */
#view-whatsapplive .waLivePage{height:calc(100dvh - 64px)!important;min-height:0!important;overflow:hidden!important;display:flex!important;flex-direction:column!important}
#view-whatsapplive .waLiveLayout{flex:1 1 auto!important;min-height:0!important;overflow:hidden!important}
#view-whatsapplive .waChatPane,#view-whatsapplive .waChatActive{min-height:0!important;overflow:hidden!important;display:flex!important;flex-direction:column!important}
#view-whatsapplive .waMessages{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain!important}
#view-whatsapplive .waComposer{position:sticky!important;bottom:0!important;z-index:30!important;flex:0 0 auto!important;background:#f7f8fa!important}
#view-whatsapplive .waComposerMsg{flex:0 0 18px!important}
/* 3) Automatizaciones: que la configuración avanzada no se colapse */
#view-automations .auto2Config{display:block!important;min-height:34px!important;margin-top:8px!important}
#view-automations .auto2Config:empty{min-height:0!important;margin-top:0!important}
#view-automations .auto2Builder{overflow:visible!important}
#tpfWaTemplatesNav{user-select:none}
@media(max-width:820px){#view-whatsapplive .waLivePage{height:100dvh!important}}
</style>
<script id="tpf-fix-3-points-v1-js">
(function(){
  const later=(fn,ms=0)=>setTimeout(()=>{try{fn()}catch(e){console.warn('TPF fix 3',e)}},ms);

  function reconcileWaiting(){
    try{
      const chats=(window.waLiveState&&waLiveState.chats)||[];
      if(typeof waTrackDirection==='function'){
        chats.forEach(c=>{if(c&&c.id&&c._lastMessage)waTrackDirection(c.id,c._lastMessage)});
      }
      if(typeof waUpdateStats==='function')waUpdateStats();
      if(typeof waUpdateAdvancedMetrics==='function')waUpdateAdvancedMetrics();
      if(typeof renderWhatsAppChats==='function')renderWhatsAppChats();
    }catch(e){console.warn('Reconciliar sin responder',e)}
  }

  function patchWaiting(){
    if(typeof waIsUnanswered!=='function'||waIsUnanswered.__tpfPatched)return;
    const original=waIsUnanswered;
    const patched=function(chatId){
      try{
        const chats=(window.waLiveState&&waLiveState.chats)||[];
        const c=chats.find(x=>String(x&&x.id)===String(chatId));
        const last=c&&c._lastMessage;
        if(last&&typeof waMessageDirection==='function'){
          const dir=waMessageDirection(last);
          if(dir==='in')return true;
          if(dir==='out')return false;
        }
      }catch(_){}
      return original(chatId);
    };
    patched.__tpfPatched=true;
    waIsUnanswered=patched;
    if(typeof loadWhatsAppLive==='function'&&!loadWhatsAppLive.__tpfWaitingPatched){
      const oldLoad=loadWhatsAppLive;
      const wrapped=async function(){const r=await oldLoad.apply(this,arguments);later(reconcileWaiting,120);return r};
      wrapped.__tpfWaitingPatched=true;
      loadWhatsAppLive=wrapped;
    }
    reconcileWaiting();
  }

  async function loadOnlyOwnTemplates(){
    try{
      const {data,error}=await sb.rpc('wa_list_templates');
      if(error)throw error;
      waTemplatesCache=Array.isArray(data)?data.map(r=>({id:r.id,name:r.name,text:r.body,category:r.category||'',shortcut:r.shortcut||''})):[];
      waTemplatesRemoteReady=true;
      try{
        const u=await sb.auth.getUser();
        const uid=u&&u.data&&u.data.user&&u.data.user.id;
        if(uid)localStorage.setItem('tpf_wa_templates_user_'+uid,JSON.stringify(waTemplatesCache));
      }catch(_){}
      if(typeof waRenderTemplates==='function')waRenderTemplates();
      if(typeof auto2RenderActionConfig==='function'&&document.getElementById('view-automations')&&!document.getElementById('view-automations').classList.contains('hidden'))auto2RenderActionConfig();
      return waTemplatesCache;
    }catch(e){
      console.warn('Plantillas por usuario',e);
      waTemplatesCache=[];
      waTemplatesRemoteReady=false;
      if(typeof waRenderTemplates==='function')waRenderTemplates();
      return [];
    }
  }

  function patchTemplates(){
    if(typeof waDefaultTemplates==='function')waDefaultTemplates=function(){return []};
    if(typeof waLoadTemplates==='function')waLoadTemplates=function(){return Array.isArray(waTemplatesCache)?waTemplatesCache:[]};
    if(typeof waSaveTemplates==='function')waSaveTemplates=function(x){waTemplatesCache=Array.isArray(x)?x:[]};
    if(typeof waSyncTemplatesFromSupabase==='function')waSyncTemplatesFromSupabase=loadOnlyOwnTemplates;
    later(loadOnlyOwnTemplates,250);
  }

  function addTemplatesNav(){
    if(document.getElementById('tpfWaTemplatesNav'))return;
    const waNav=document.querySelector('.nav[data-view="whatsapplive"]');
    if(!waNav||!waNav.parentNode)return;
    const n=document.createElement('div');
    n.id='tpfWaTemplatesNav';
    n.className='nav secondaryNav';
    n.innerHTML='<b>▤</b><span>Plantillas WhatsApp</span>';
    n.addEventListener('click',async e=>{
      e.preventDefault();e.stopPropagation();
      if(document.getElementById('view-whatsapplive')&&document.getElementById('view-whatsapplive').classList.contains('hidden'))waNav.click();
      try{await loadOnlyOwnTemplates()}catch(_){}
      later(()=>{if(typeof waRenderTemplates==='function')waRenderTemplates();document.getElementById('waTemplateModal')?.classList.remove('hidden')},80);
    });
    waNav.insertAdjacentElement('afterend',n);
  }

  async function restoreAdvancedAutomations(){
    try{
      if(typeof auto2PrepareOptions==='function')await auto2PrepareOptions();
      if(typeof auto2RenderTriggerConfig==='function')auto2RenderTriggerConfig();
      if(typeof auto2RenderActionConfig==='function')auto2RenderActionConfig();
      if(typeof loadAutomations==='function')await loadAutomations();
      const h=document.querySelector('#view-automations .pageHeader .small');
      if(h&&!document.getElementById('tpfAutoAdvancedNote')){
        const note=document.createElement('div');
        note.id='tpfAutoAdvancedNote';note.className='small';
        note.style.cssText='margin-top:6px;font-weight:700;color:#1767d8';
        note.textContent='Motor avanzado activo: WhatsApp, palabras, columnas, etiquetas, sin respuesta, tareas, oportunidades, plantillas y secuencias.';
        h.insertAdjacentElement('afterend',note);
      }
    }catch(e){console.warn('Automatizaciones avanzadas',e)}
  }

  function bindAutomationNav(){
    document.querySelectorAll('.nav[data-view="automations"]').forEach(n=>{
      if(n.dataset.tpfAdvancedBound)return;
      n.dataset.tpfAdvancedBound='1';
      n.addEventListener('click',()=>later(restoreAdvancedAutomations,120));
    });
  }

  function boot(){
    patchWaiting();
    patchTemplates();
    addTemplatesNav();
    bindAutomationNav();
    later(reconcileWaiting,1000);
    later(()=>{if(document.getElementById('view-automations')&&!document.getElementById('view-automations').classList.contains('hidden'))restoreAdvancedAutomations()},500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>later(boot,0));else later(boot,0);
})();
</script>`;

module.exports=async function(req,res){
  try{
    const host=req.headers['x-forwarded-host']||req.headers.host;
    if(!host) throw new Error('Host no disponible');

    let html=await getText(`https://${host}/api/index?_tdz=${Date.now()}`);

    const declaration='let crmAutomations=[];';
    if(html.includes(declaration)){
      html=html.replace(declaration,'crmAutomations=[];');
      const early='<script id="tpf-crm-automations-tdz-fix">var crmAutomations=[];</script>';
      html=html.includes('</head>')?html.replace('</head>',early+'\n</head>'):early+html;
    }

    html=html.includes('</body>')?html.replace('</body>',UX_PATCH+'\n</body>'):html+UX_PATCH;

    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store, max-age=0');
    res.setHeader('X-TPF-Fix','crm-automations-tdz+3-points-v1');
    res.status(200).send(html);
  }catch(e){
    res.status(500).send('No se pudo cargar The Phone Face: '+(e?.message||e));
  }
};
