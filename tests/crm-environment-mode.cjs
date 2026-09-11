const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const entry=fs.readFileSync('api/index-clean.js','utf8');
const offers=fs.readFileSync('js/modules/offers-pro.js','utf8');
const green=fs.readFileSync('api/green.js','utf8');
const greenReply=fs.readFileSync('api/green-reply.js','utf8');
async function render(environment,branch){
  let html;
  const ctx={module:{exports:{}},process:{env:{VERCEL_ENV:environment,VERCEL_GIT_COMMIT_REF:branch}},require:name=>name==='./index'?{buildHtml:async()=>'<html><head></head><body></body></html>'}:{applyFix:s=>s}};
  vm.runInNewContext(entry,ctx);
  await ctx.module.exports({}, {setHeader(){},status(){return this},send(s){html=s}});
  return html;
}
(async()=>{
  for(const [environment,branch,mode]of [['production','main','stable'],['preview','codex/verify-whatsapp-delivery-20260910','test'],['development','unknown','test']]){
    const html=await render(environment,branch);
    assert.ok(html.includes(`name="tpf-crm-mode" content="${mode}"`));
    assert.ok(html.includes(mode==='stable'?'ESTABLE ·':'PRUEBAS ·'));
    const expression=offers.match(/const CRM_TEST_MODE=(.*);/)[1];
    assert.equal(vm.runInNewContext(expression,{document:{querySelector:()=>({content:mode})}}),mode!=='stable');
    assert.equal(vm.runInNewContext(expression,{}),true);
  }
  assert.match(green,/VERCEL_ENV[\s\S]*!== "production"/);
  assert.match(greenReply,/VERCEL_ENV[\s\S]*!=="production"/);
  console.log('Production is stable; preview and development entrypoints remain restricted');
})().catch(e=>{console.error(e);process.exitCode=1});
