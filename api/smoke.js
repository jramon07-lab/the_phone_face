const fs = require('fs');
const path = require('path');

function read(rel){
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

module.exports = async function(req,res){
  try{
    const indexClean = read('api/index-clean.js');
    const indexFix = read('api/index-fix.js');
    const indexBase = read('api/index.js');
    const vercel = read('vercel.json');

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
      branch:process.env.VERCEL_GIT_COMMIT_REF||null,
      commit:process.env.VERCEL_GIT_COMMIT_SHA||null,
      deployment_id:process.env.VERCEL_DEPLOYMENT_ID||null,
      mode:'deployed-source-validation',
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
