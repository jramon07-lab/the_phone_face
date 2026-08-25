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
    const protectedApi=/\\/api\\/(green|telegram)(?:\\?|$)/.test(url);
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
    }catch(e){
      console.warn('No se pudo adjuntar la sesión a la API protegida.',e);
    }
    return nativeFetch(input,init);
  };
})();
</script>`;

const NAV_STABILIZER=`<script id="tpf-nav-stabilizer-p0">
(function(){
  const mainViews=["dashboard","alerts","search","database","sales","import","agenda","whatsapplive","whatsapp","labels","settings","automations","users","trash"];
  function visibleMainView(){
    return mainViews.find(function(v){
      const el=document.getElementById("view-"+v);
      return el && !el.classList.contains("hidden");
    }) || window.__tpfCurrentView || "dashboard";
  }
  window.tpfVisibleMainView=visibleMainView;
  window.tpfMainViewNow=visibleMainView;
  window.tpfMainViewId=visibleMainView;

  // Compatibilidad con llamadas antiguas: Volver delega en el router único.
  window.tpfGoBack=function(){
    if(typeof window.tpfBackExactly!=="function")return false;
    Promise.resolve(window.tpfBackExactly()).catch(function(e){console.error("TPF back error",e)});
    return true;
  };
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

    if(!html.includes('tpf-protected-api-auth-v1')){
      html=html.includes('</head>')?html.replace('</head>',AUTH_PATCH+'\n</head>'):AUTH_PATCH+html;
    }

    if(!html.includes('tpf-nav-stabilizer-p0')){
      html=html.includes('</body>')?html.replace('</body>',NAV_STABILIZER+'\n</body>'):html+NAV_STABILIZER;
    }

    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store, max-age=0');
    res.setHeader('X-TPF-Fix','crm-automations-tdz+protected-api-auth+nav-stabilizer');
    res.status(200).send(html);
  }catch(e){
    res.status(500).send('No se pudo cargar The Phone Face: '+(e?.message||e));
  }
};
