const https = require('https');

function getText(url){
  return new Promise((resolve,reject)=>{
    https.get(url,{headers:{'User-Agent':'The-Phone-Face-Smoke'}},r=>{
      if(r.statusCode>=300 && r.statusCode<400 && r.headers.location){r.resume();return getText(r.headers.location).then(resolve,reject)}
      if(r.statusCode!==200){r.resume();return reject(new Error('HTTP '+r.statusCode))}
      let body='';r.setEncoding('utf8');r.on('data',c=>body+=c);r.on('end',()=>resolve(body));
    }).on('error',reject)
  })
}

module.exports = async function(req,res){
  try{
    const host=req.headers['x-forwarded-host']||req.headers.host;
    if(!host) throw new Error('Host no disponible');
    const html=await getText(`https://${host}/api/index-clean?_smoke=${Date.now()}`);

    const checks={
      templates_nav: html.includes('id="tpfWaTemplatesNav"'),
      automation_advanced: html.includes('id="tpfAutomationAdvancedBar"'),
      menu_clean_css: html.includes('id="tpf-menu-clean-v2"'),
      entry_unique: html.includes('id="tpf-entry-unique-v2"'),
      no_default_templates: html.includes('function waDefaultTemplates(){return []}'),
      whatsapp_patch_preserved: html.includes('tpf-fix-3-points-v1') || html.includes('waIsUnanswered')
    };
    const pass=Object.values(checks).every(Boolean);
    const payload={
      ok:pass,
      app:'The Phone Face CRM',
      branch:process.env.VERCEL_GIT_COMMIT_REF||null,
      commit:process.env.VERCEL_GIT_COMMIT_SHA||null,
      deployment_id:process.env.VERCEL_DEPLOYMENT_ID||null,
      checks,
      timestamp:new Date().toISOString()
    };
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Cache-Control','no-store, max-age=0');
    res.status(pass?200:500).send(JSON.stringify(payload));
  }catch(e){
    res.status(500).json({ok:false,error:e?.message||String(e),timestamp:new Date().toISOString()});
  }
};
