const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const entry=fs.readFileSync('api/index-clean.js','utf8');
const offers=fs.readFileSync('js/modules/offers-pro.js','utf8');
async function render(branch){
  let html;
  const ctx={module:{exports:{}},process:{env:{VERCEL_GIT_COMMIT_REF:branch}},require:name=>name==='./index'?{buildHtml:async()=>'<html><head></head><body></body></html>'}:{applyFix:s=>s}};
  vm.runInNewContext(entry,ctx);
  await ctx.module.exports({}, {setHeader(){},status(){return this},send(s){html=s}});
  return html;
}
(async()=>{
  for(const [branch,mode]of [['tmp/contact-profile-recover-20260901','stable'],['desarrollo-crm','test'],['unknown','test']]){
    const html=await render(branch);
    assert.ok(html.includes(`name="tpf-crm-mode" content="${mode}"`));
    assert.ok(html.includes(mode==='stable'?'ESTABLE ·':'PRUEBAS ·'));
    const expression=offers.match(/const CRM_TEST_MODE=(.*);/)[1];
    assert.equal(vm.runInNewContext(expression,{document:{querySelector:()=>({content:mode})}}),mode!=='stable');
    assert.equal(vm.runInNewContext(expression,{}),true);
  }
  console.log('Stable offers enabled; development and unknown entrypoints remain restricted');
})().catch(e=>{console.error(e);process.exitCode=1});
