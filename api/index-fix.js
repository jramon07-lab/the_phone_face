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
<style id="tpf-fix-3-points-v2">
/* WhatsApp: conservar la mejora ya validada */
#view-whatsapplive .waLivePage{height:calc(100dvh - 64px)!important;min-height:0!important;overflow:hidden!important;display:flex!important;flex-direction:column!important}
#view-whatsapplive .waLiveLayout{flex:1 1 auto!important;min-height:0!important;overflow:hidden!important}
#view-whatsapplive .waChatPane,#view-whatsapplive .waChatActive{min-height:0!important;overflow:hidden!important;display:flex!important;flex-direction:column!important}
#view-whatsapplive .waMessages{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain!important}
#view-whatsapplive .waComposer{position:sticky!important;bottom:0!important;z-index:30!important;flex:0 0 auto!important;background:#f7f8fa!important}
#view-whatsapplive .waComposerMsg{flex:0 0 18px!important}
@media(max-width:820px){#view-whatsapplive .waLivePage{height:100dvh!important}}

/* Plantillas: pantalla independiente y claramente visible */
#tpfTemplatesPage{padding:0 0 24px}
.tpfTplHead{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}
.tpfTplHead h2{margin:0 0 5px}.tpfTplGrid{display:grid;grid-template-columns:minmax(300px,380px) 1fr;gap:14px}
.tpfTplCard{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;box-shadow:0 3px 14px rgba(15,30,55,.05)}
.tpfTplList{display:grid;gap:8px}.tpfTplRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start;border:1px solid #e3e8ef;border-radius:10px;padding:11px;background:#fff}
.tpfTplRow b{display:block;font-size:12px}.tpfTplRow p{margin:5px 0 0;font-size:11px;color:#667085;white-space:pre-wrap}.tpfTplActions{display:flex;gap:5px;flex-wrap:wrap}.tpfTplActions button{padding:6px 8px;font-size:10px}
.tpfTplBadge{display:inline-flex;padding:4px 8px;border-radius:999px;background:#e9f7ef;color:#16844c;font-size:10px;font-weight:800}
@media(max-width:900px){.tpfTplGrid{grid-template-columns:1fr}}

/* Automatizaciones: constructor avanzado explícito */
#view-automations .automation2Grid{grid-template-columns:minmax(500px,620px) 1fr!important}
#view-automations .auto2Config{display:block!important;visibility:visible!important;opacity:1!important;min-height:34px!important;margin-top:8px!important;overflow:visible!important}
#view-automations .auto2Config:empty{min-height:0!important;margin-top:0!important}
#view-automations .auto2Builder{overflow:visible!important}
#tpfAutomationAdvancedBar{margin:0 0 14px;padding:14px;border:1px solid #b9d3fb;border-radius:12px;background:#f7fbff}
#tpfAutomationAdvancedBar h3{margin:0 0 5px;font-size:15px}.tpfAutoPresetButtons{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.tpfAutoPresetButtons button{background:#fff;border:1px solid #cfdcf0;color:#2454a6;padding:8px 10px;font-size:10px}
.tpfAutoCapabilities{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.tpfAutoCapabilities span{display:inline-flex;padding:4px 7px;border-radius:999px;background:#eef4ff;color:#315fa7;font-size:9px;font-weight:700}
@media(max-width:980px){#view-automations .automation2Grid{grid-template-columns:1fr!important}}
</style>
<script id="tpf-fix-3-points-v2-js">
(function(){
  const later=(fn,ms=0)=>setTimeout(()=>{try{fn()}catch(e){console.warn('TPF fix v2',e)}},ms);
  const $id=id=>document.getElementById(id);

  /* ---------- WhatsApp: sin responder ---------- */
  function reconcileWaiting(){
    try{
      const chats=(window.waLiveState&&waLiveState.chats)||[];
      if(typeof waTrackDirection==='function')chats.forEach(c=>{if(c&&c.id&&c._lastMessage)waTrackDirection(c.id,c._lastMessage)});
      if(typeof waUpdateStats==='function')waUpdateStats();
      if(typeof waUpdateAdvancedMetrics==='function')waUpdateAdvancedMetrics();
      if(typeof renderWhatsAppChats==='function')renderWhatsAppChats();
    }catch(e){console.warn('Reconciliar sin responder',e)}
  }
  function patchWaiting(){
    if(typeof waIsUnanswered!=='function'||waIsUnanswered.__tpfPatched)return;
    const original=waIsUnanswered;
    waIsUnanswered=function(chatId){
      try{
        const c=((window.waLiveState&&waLiveState.chats)||[]).find(x=>String(x&&x.id)===String(chatId));
        const last=c&&c._lastMessage;
        if(last&&typeof waMessageDirection==='function'){
          const dir=waMessageDirection(last); if(dir==='in')return true; if(dir==='out')return false;
        }
      }catch(_){}
      return original(chatId);
    };
    waIsUnanswered.__tpfPatched=true;
    reconcileWaiting();
  }

  /* ---------- Plantillas por usuario: pantalla REAL ---------- */
  let ownTemplates=[];
  async function loadOwnTemplates(){
    const {data,error}=await sb.rpc('wa_list_templates');
    if(error)throw error;
    ownTemplates=Array.isArray(data)?data.map(r=>({id:r.id,name:r.name||'',text:r.body||'',category:r.category||'',shortcut:r.shortcut||''})):[];
    try{waTemplatesCache=ownTemplates.slice();waTemplatesRemoteReady=true}catch(_){}
    renderTemplatesPage();
    try{if(typeof waRenderTemplates==='function')waRenderTemplates()}catch(_){}
    return ownTemplates;
  }
  function ensureTemplatesPage(){
    if($id('tpfTemplatesPage'))return;
    const main=document.querySelector('.referenceWorkspace main'); if(!main)return;
    const page=document.createElement('section');
    page.id='tpfTemplatesPage';page.className='hidden';
    page.innerHTML=`
      <div class="tpfTplHead"><div><h2>Plantillas WhatsApp</h2><div class="small">Solo aparecen las plantillas guardadas en tu cuenta.</div></div><span class="tpfTplBadge">Por usuario</span></div>
      <div class="tpfTplGrid">
        <div class="tpfTplCard">
          <h3 id="tpfTplFormTitle">Nueva plantilla</h3>
          <input id="tpfTplId" type="hidden">
          <label>Nombre<input id="tpfTplName" placeholder="Ej.: Renovación"></label>
          <label>Mensaje<textarea id="tpfTplText" rows="7" placeholder="Texto de la plantilla. Puedes usar {nombre}, {dni}, {telefono}"></textarea></label>
          <div class="row"><button id="tpfTplSave" class="primary">Guardar plantilla</button><button id="tpfTplCancel" class="secondary hidden">Cancelar edición</button></div>
          <div id="tpfTplMsg" class="small"></div>
        </div>
        <div class="tpfTplCard"><div class="row" style="align-items:center"><div><h3 style="margin:0">Mis plantillas</h3><div class="small">Disponibles también dentro de WhatsApp.</div></div><button id="tpfTplReload" class="secondary">↻ Actualizar</button></div><div id="tpfTplList" class="tpfTplList" style="margin-top:12px"></div></div>
      </div>`;
    main.appendChild(page);

    $id('tpfTplSave').onclick=async()=>{
      const name=$id('tpfTplName').value.trim(), text=$id('tpfTplText').value.trim(), rawId=$id('tpfTplId').value;
      if(!name||!text){$id('tpfTplMsg').textContent='Escribe nombre y mensaje.';return}
      $id('tpfTplSave').disabled=true;$id('tpfTplMsg').textContent='Guardando…';
      try{
        const {error}=await sb.rpc('wa_upsert_template',{p_id:rawId?Number(rawId):null,p_name:name,p_body:text,p_category:null,p_shortcut:null});
        if(error)throw error; resetTplForm(); await loadOwnTemplates(); $id('tpfTplMsg').textContent='Plantilla guardada correctamente.';
      }catch(e){$id('tpfTplMsg').textContent=e.message||'No se pudo guardar.'}finally{$id('tpfTplSave').disabled=false}
    };
    $id('tpfTplCancel').onclick=resetTplForm;
    $id('tpfTplReload').onclick=()=>loadOwnTemplates().catch(e=>$id('tpfTplMsg').textContent=e.message);
  }
  function resetTplForm(){
    if(!$id('tpfTplId'))return;$id('tpfTplId').value='';$id('tpfTplName').value='';$id('tpfTplText').value='';$id('tpfTplFormTitle').textContent='Nueva plantilla';$id('tpfTplSave').textContent='Guardar plantilla';$id('tpfTplCancel').classList.add('hidden');
  }
  function renderTemplatesPage(){
    const box=$id('tpfTplList');if(!box)return;
    box.innerHTML=ownTemplates.length?ownTemplates.map(t=>`<div class="tpfTplRow"><div><b>${typeof esc==='function'?esc(t.name):t.name}</b><p>${typeof esc==='function'?esc(t.text):t.text}</p></div><div class="tpfTplActions"><button class="secondary" onclick="tpfTplEdit('${t.id}')">Editar</button><button class="danger" onclick="tpfTplDelete('${t.id}')">Eliminar</button></div></div>`).join(''):'<div class="small">No tienes plantillas guardadas. Crea la primera a la izquierda.</div>';
  }
  window.tpfTplEdit=id=>{
    const t=ownTemplates.find(x=>String(x.id)===String(id));if(!t)return;
    $id('tpfTplId').value=t.id;$id('tpfTplName').value=t.name;$id('tpfTplText').value=t.text;$id('tpfTplFormTitle').textContent='Editar plantilla';$id('tpfTplSave').textContent='Guardar cambios';$id('tpfTplCancel').classList.remove('hidden');$id('tpfTplName').focus();
  };
  window.tpfTplDelete=async id=>{
    const t=ownTemplates.find(x=>String(x.id)===String(id));if(!t||!confirm('¿Eliminar la plantilla "'+t.name+'"?'))return;
    const {error}=await sb.rpc('wa_delete_template',{p_id:Number(id)});if(error)return alert(error.message);await loadOwnTemplates();
  };
  function addTemplatesNav(){
    ensureTemplatesPage();
    let n=$id('tpfWaTemplatesNav');
    if(!n){
      const waNav=document.querySelector('.nav[data-view="whatsapplive"]');if(!waNav)return;
      n=document.createElement('div');n.id='tpfWaTemplatesNav';n.className='nav secondaryNav';n.innerHTML='<b>▤</b><span>Plantillas WhatsApp</span>';waNav.insertAdjacentElement('afterend',n);
    }
    n.onclick=async e=>{
      e.preventDefault();e.stopPropagation();
      try{if(typeof perms!=='undefined'&&!perms?.is_admin&&!perms?.can_manage_templates)return alert('No tienes permiso para gestionar plantillas.')}catch(_){}
      document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));n.classList.add('active');
      document.querySelectorAll('.referenceWorkspace main > section[id^="view-"]').forEach(s=>s.classList.add('hidden'));
      $id('tpfTemplatesPage').classList.remove('hidden');
      try{await loadOwnTemplates()}catch(err){$id('tpfTplMsg').textContent=err.message||'No se pudieron cargar las plantillas.'}
    };
    document.querySelectorAll('.nav:not(#tpfWaTemplatesNav)').forEach(x=>{
      if(x.dataset.tpfTplHideBound)return;x.dataset.tpfTplHideBound='1';x.addEventListener('click',()=>{$id('tpfTemplatesPage')?.classList.add('hidden')},true);
    });
  }

  /* Forzar que WhatsApp use solo plantillas reales del usuario */
  function patchTemplateFunctions(){
    try{waDefaultTemplates=function(){return []}}catch(_){}
    try{waLoadTemplates=function(){return ownTemplates.slice()}}catch(_){}
    try{waSyncTemplatesFromSupabase=loadOwnTemplates}catch(_){}
  }

  /* ---------- Automatizaciones avanzadas visibles ---------- */
  function ensureAdvancedAutomationBar(){
    const view=$id('view-automations');if(!view||$id('tpfAutomationAdvancedBar'))return;
    const grid=view.querySelector('.automation2Grid');if(!grid)return;
    const bar=document.createElement('div');bar.id='tpfAutomationAdvancedBar';
    bar.innerHTML=`<h3>⚡ Constructor avanzado activo</h3><div class="small">Elige una automatización rápida o configura manualmente CUANDO → HACER.</div><div class="tpfAutoCapabilities"><span>WhatsApp recibido</span><span>Palabra clave</span><span>Cambio de columna</span><span>Etiqueta asignada</span><span>Sin respuesta</span><span>Tarea</span><span>Oportunidad</span><span>Etiqueta</span><span>WhatsApp programado</span><span>Plantilla</span><span>Secuencia</span></div><div class="tpfAutoPresetButtons"><button data-auto-preset="renewal">Renovación → etiqueta</button><button data-auto-preset="unanswered">Sin respuesta → tarea</button><button data-auto-preset="sequence">Etiqueta → oportunidad + WhatsApp</button></div>`;
    grid.insertAdjacentElement('beforebegin',bar);
    bar.querySelectorAll('[data-auto-preset]').forEach(b=>b.onclick=async()=>{
      try{if(typeof auto2PrepareOptions==='function')await auto2PrepareOptions()}catch(_){}
      const p=b.dataset.autoPreset,tr=$id('auto2Trigger'),ac=$id('auto2Action');if(!tr||!ac)return;
      if(p==='renewal'){tr.value='message_contains';ac.value='assign_label'}
      if(p==='unanswered'){tr.value='unanswered';ac.value='create_task'}
      if(p==='sequence'){tr.value='label_assigned';ac.value='sequence_label_opportunity_whatsapp'}
      if(typeof auto2RenderTriggerConfig==='function')auto2RenderTriggerConfig();if(typeof auto2RenderActionConfig==='function')auto2RenderActionConfig();
      later(()=>{if(p==='renewal'&&$id('auto2Keyword'))$id('auto2Keyword').value='renovación';if(p==='unanswered'&&$id('auto2UnansweredMinutes'))$id('auto2UnansweredMinutes').value='120'},20);
    });
  }
  async function restoreAdvancedAutomations(){
    ensureAdvancedAutomationBar();
    try{if(typeof auto2PrepareOptions==='function')await auto2PrepareOptions()}catch(_){}
    try{if(typeof auto2RenderTriggerConfig==='function')auto2RenderTriggerConfig()}catch(_){}
    try{if(typeof auto2RenderActionConfig==='function')auto2RenderActionConfig()}catch(_){}
    try{if(typeof loadAutomations==='function')await loadAutomations()}catch(e){console.warn('Automatizaciones avanzadas',e)}
  }
  function bindAutomationNav(){
    document.querySelectorAll('.nav[data-view="automations"]').forEach(n=>{
      if(n.dataset.tpfAdvancedBound)return;n.dataset.tpfAdvancedBound='1';n.addEventListener('click',()=>later(restoreAdvancedAutomations,80));
    });
  }

  function boot(){patchWaiting();ensureTemplatesPage();addTemplatesNav();patchTemplateFunctions();bindAutomationNav();later(()=>loadOwnTemplates().catch(()=>{}),500);later(reconcileWaiting,800);later(ensureAdvancedAutomationBar,500)}
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
    res.setHeader('X-TPF-Fix','crm-automations-tdz+3-points-v2');
    res.status(200).send(html);
  }catch(e){
    res.status(500).send('No se pudo cargar The Phone Face: '+(e?.message||e));
  }
};
