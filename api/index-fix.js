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

const AUTH_PATCH=`<script id="tpf-protected-api-auth-v1">
(function(){
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    const protectedApi=/\/api\/(green|telegram)(?:\?|$)/.test(url);
    if(!protectedApi)return nativeFetch(input,init);
    try{
      let accessToken='';
      if(typeof sb!=='undefined'&&sb&&sb.auth&&typeof sb.auth.getSession==='function'){
        const result=await sb.auth.getSession();
        accessToken=result&&result.data&&result.data.session&&result.data.session.access_token||'';
      }
      if(accessToken){
        const headers=new Headers((init&&init.headers)||(input instanceof Request?input.headers:undefined)||{});
        headers.set('Authorization','Bearer '+accessToken);
        return nativeFetch(input,{...(init||{}),headers});
      }
    }catch(e){console.warn('No se pudo adjuntar la sesión a la API protegida.',e)}
    return nativeFetch(input,init);
  };
})();
</script>`;

const COMPAT_PATCH=`<script id="tpf-browser-compat-v2">
(function(){
  try{
    if(!navigator.storage){
      Object.defineProperty(navigator,'storage',{configurable:true,value:{
        persisted:async function(){return false},
        persist:async function(){return false}
      }});
    }else{
      if(typeof navigator.storage.persisted!=='function')navigator.storage.persisted=async function(){return false};
      if(typeof navigator.storage.persist!=='function')navigator.storage.persist=async function(){return false};
    }
  }catch(_){ }
})();
</script>`;

const NAV_STABILIZER=`<script id="tpf-nav-stabilizer-p0">
(function(){
  const mainViews=["dashboard","alerts","search","database","sales","import","agenda","whatsapplive","whatsapp","labels","settings","automations","users","trash"];
  function visibleMainView(){return mainViews.find(function(v){const el=document.getElementById("view-"+v);return el&&!el.classList.contains("hidden")})||window.__tpfCurrentView||"dashboard"}
  window.tpfVisibleMainView=visibleMainView;window.tpfMainViewNow=visibleMainView;window.tpfMainViewId=visibleMainView;
  window.tpfGoBack=function(){if(typeof window.tpfBackExactly!=="function")return false;Promise.resolve(window.tpfBackExactly()).catch(function(e){console.error("TPF back error",e)});return true};
})();
</script>`;

const ACTION_STABILIZER=`<script id="tpf-action-stabilizer-p0">
(function(){
  const canonicalDelete=typeof window.oppUnifiedDelete==='function'?window.oppUnifiedDelete:null;
  if(canonicalDelete){window.__tpfCanonicalOpportunityDelete=canonicalDelete;window.deleteOpp=async function(id){let title='Oportunidad';try{const rows=(typeof salesCache!=='undefined'&&salesCache&&salesCache.opportunities)||[];const row=rows.find(function(x){return String(x.id)===String(id)});if(row&&row.title)title=row.title}catch(_){}return window.__tpfCanonicalOpportunityDelete(id,title)}}
  if(typeof window.selectWhatsAppChat==='function')window.__tpfCanonicalSelectWhatsAppChat=window.selectWhatsAppChat;
  window.__TPF_CANONICAL_ACTIONS={version:'p0-5',opportunityDelete:!!window.__tpfCanonicalOpportunityDelete,whatsappSelect:!!window.__tpfCanonicalSelectWhatsAppChat,whatsappScheduler:'server',automations:'server'};
})();
</script>`;

module.exports=async function(req,res){
  try{
    const host=req.headers['x-forwarded-host']||req.headers.host;if(!host)throw new Error('Host no disponible');
    let html=await getText(`https://${host}/api/index?_tdz=${Date.now()}`);
    const declaration='let crmAutomations=[];';
    if(html.includes(declaration)){html=html.replace(declaration,'crmAutomations=[];');const early='<script id="tpf-crm-automations-tdz-fix">var crmAutomations=[];</script>';html=html.includes('</head>')?html.replace('</head>',early+'\n</head>'):early+html}

    const templateTdz='let waTemplatesCache = waLoadTemplates();';
    if(html.includes(templateTdz))html=html.replace(templateTdz,'var waTemplatesCache = waLoadTemplates();');

    const legacyWaScheduler='setInterval(waAutoSendDueSchedules,30000); setTimeout(waAutoSendDueSchedules,5000);';
    if(html.includes(legacyWaScheduler))html=html.replace(legacyWaScheduler,'/* TPF: scheduler WhatsApp trasladado a Supabase Cron/Edge Worker */');

    const incomingFire='await auto2Fire("message_received",ctx,"msg:"+id);await auto2Fire("message_contains",ctx,"msgcontains:"+id);';
    if(html.includes(incomingFire))html=html.replace(incomingFire,'/* TPF: message_received/message_contains se ejecutan en Supabase */');

    html=html.replace(/await auto2Fire\("opportunity_stage",\{opportunity_id:o\.id,stage_id:o\.stage_id,[\s\S]*?\},"oppstage:"\+o\.id\+":"\+o\.stage_id\)/,'/* TPF: opportunity_stage se ejecuta en Supabase */');
    html=html.replace(/for\(const lab of added\)await auto2Fire\("label_assigned",[\s\S]*?\);/,'/* TPF: label_assigned se ejecuta en Supabase */');

    const unansweredInterval='setInterval(auto2CheckUnanswered,120000);';
    if(html.includes(unansweredInterval))html=html.replace(unansweredInterval,'/* TPF: unanswered se procesa con pg_cron en Supabase */');
    const unansweredStartup='setTimeout(()=>{loadAutomations().catch(()=>{});auto2CheckUnanswered().catch(()=>{})},1800);';
    if(html.includes(unansweredStartup))html=html.replace(unansweredStartup,'setTimeout(()=>{loadAutomations().catch(()=>{})},1800);');

    if(!html.includes('tpf-browser-compat-v2')){
      html=html.includes('<head>')?html.replace('<head>','<head>\n'+COMPAT_PATCH):COMPAT_PATCH+html;
    }
    if(!html.includes('tpf-protected-api-auth-v1'))html=html.includes('</head>')?html.replace('</head>',AUTH_PATCH+'\n</head>'):AUTH_PATCH+html;
    const tail=[];if(!html.includes('tpf-nav-stabilizer-p0'))tail.push(NAV_STABILIZER);if(!html.includes('tpf-action-stabilizer-p0'))tail.push(ACTION_STABILIZER);
    if(tail.length){const patch=tail.join('\n');html=html.includes('</body>')?html.replace('</body>',patch+'\n</body>'):html+patch}
    res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-TPF-Fix','crm-automations-tdz+wa-templates-var-hoist+browser-compat-early+protected-api-auth+nav-stabilizer+action-stabilizer+server-wa-scheduler+server-automations');res.status(200).send(html);
  }catch(e){res.status(500).send('No se pudo cargar The Phone Face: '+(e?.message||e))}
};
