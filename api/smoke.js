const https = require('https');

const BRANCH = 'work/crm-unica-20260825';
const RAW_BASE = `https://raw.githubusercontent.com/jramon07-lab/the_phone_face/${BRANCH}`;

function getText(url){
  return new Promise((resolve,reject)=>{
    https.get(url,{headers:{'User-Agent':'The-Phone-Face-Smoke'}},r=>{
      if(r.statusCode>=300 && r.statusCode<400 && r.headers.location){
        r.resume();
        return getText(r.headers.location).then(resolve,reject);
      }
      if(r.statusCode!==200){
        r.resume();
        return reject(new Error(`HTTP ${r.statusCode} ${url}`));
      }
      let body='';
      r.setEncoding('utf8');
      r.on('data',c=>body+=c);
      r.on('end',()=>resolve(body));
    }).on('error',reject);
  });
}

module.exports = async function(req,res){
  try{
    const [indexClean,indexFix,indexBase,vercel] = await Promise.all([
      getText(`${RAW_BASE}/api/index-clean.js?v=${Date.now()}`),
      getText(`${RAW_BASE}/api/index-fix.js?v=${Date.now()}`),
      getText(`${RAW_BASE}/api/index.js?v=${Date.now()}`),
      getText(`${RAW_BASE}/vercel.json?v=${Date.now()}`)
    ]);

    const checks={
      official_source: indexBase.includes('the_phone_face/work/crm-unica-20260825/index.html') && !indexBase.includes('the_phone_face/main/index.html'),
      root_single_entry: vercel.includes('"source": "/"') && vercel.includes('"destination": "/api/index-clean"'),
      templates_nav: indexClean.includes('id="tpfWaTemplatesNav"'),
      automation_advanced: indexClean.includes('id="tpfAutomationAdvancedBar"'),
      menu_clean_css: indexClean.includes('tpf-menu-clean-v2'),
      entry_unique: indexClean.includes('tpf-entry-unique-v2'),
      no_default_templates: indexClean.includes('function waDefaultTemplates(){return []}'),
      whatsapp_patch_preserved: indexFix.includes('tpf-fix-3-points-v1') || indexFix.includes('waIsUnanswered')
    };

    const pass=Object.values(checks).every(Boolean);
    const payload={
      ok:pass,
      app:'The Phone Face CRM',
      branch:process.env.VERCEL_GIT_COMMIT_REF||BRANCH,
      commit:process.env.VERCEL_GIT_COMMIT_SHA||null,
      deployment_id:process.env.VERCEL_DEPLOYMENT_ID||null,
      mode:'official-branch-source-validation',
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
