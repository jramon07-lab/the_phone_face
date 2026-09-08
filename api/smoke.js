const finalFix = require('./final-fix');
const vercel = require('../vercel.json');

function captureResponse(resolve){
  let statusCode=200;
  const headers={};
  return {
    setHeader(name,value){headers[String(name).toLowerCase()]=String(value);},
    status(code){statusCode=code;return this;},
    send(body){resolve({statusCode,headers,body:String(body??'')});},
    json(value){resolve({statusCode,headers,body:JSON.stringify(value)});}
  };
}

async function renderCurrentDeployment(req){
  return new Promise((resolve,reject)=>{
    Promise.resolve(finalFix(req,captureResponse(resolve))).catch(reject);
  });
}

function count(source,needle){return source.split(needle).length-1;}

module.exports = async function(req,res){
  try{
    const rendered=await renderCurrentDeployment(req);
    const html=rendered.body;
    const rootRoute=(vercel.routes||[]).find(route=>route.src==='^/$');
    const expectedMode=process.env.VERCEL_GIT_COMMIT_REF==='tmp/contact-profile-recover-20260901'?'stable':'test';

    const checks={
      rendered_ok:rendered.statusCode===200&&html.includes('<!doctype html>'),
      root_single_entry:rootRoute?.dest==='/api/final-fix',
      runtime_loaded:html.includes('/js/modules/runtime.js'),
      contact_profile_loaded:html.includes('/js/modules/contact-profile.js'),
      automation_advanced:html.includes('id="tpfAutomationAdvancedBar"'),
      entry_unique:count(html,'id="tpf-entry-unique-v3"')===1,
      build_badge:count(html,'id="tpfBuildBadge"')===1,
      correct_mode:html.includes(`name="tpf-crm-mode" content="${expectedMode}"`),
      no_default_templates:html.includes('waDefaultTemplates=function(){return []}'),
      no_http_render_chain:rendered.headers['x-tpf-entry']==='single-endpoint-no-http-chain'
    };

    const pass=Object.values(checks).every(Boolean);
    const payload={
      ok:pass,
      app:'The Phone Face CRM',
      branch:process.env.VERCEL_GIT_COMMIT_REF||'local',
      commit:process.env.VERCEL_GIT_COMMIT_SHA||null,
      deployment_id:process.env.VERCEL_DEPLOYMENT_ID||null,
      mode:'deployed-runtime-validation',
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
