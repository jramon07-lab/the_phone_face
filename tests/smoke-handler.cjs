const assert=require('node:assert/strict');
const smoke=require('../api/smoke');

async function run(){
  const before={ref:process.env.VERCEL_GIT_COMMIT_REF,sha:process.env.VERCEL_GIT_COMMIT_SHA};
  process.env.VERCEL_GIT_COMMIT_REF='desarrollo-crm';
  process.env.VERCEL_GIT_COMMIT_SHA='0123456789abcdef0123456789abcdef01234567';
  const result=await new Promise((resolve,reject)=>{
    let code=200,headers={};
    const res={setHeader(k,v){headers[String(k).toLowerCase()]=v},status(v){code=v;return this},send(v){resolve({code,headers,body:JSON.parse(String(v))})},json(v){resolve({code,headers,body:v})}};
    Promise.resolve(smoke({headers:{}},res)).catch(reject);
  });
  assert.equal(result.code,200,JSON.stringify(result.body));
  assert.equal(result.body.ok,true);
  assert.equal(result.body.branch,'desarrollo-crm');
  assert.ok(Object.values(result.body.checks).every(Boolean),JSON.stringify(result.body.checks));
  if(before.ref===undefined)delete process.env.VERCEL_GIT_COMMIT_REF;else process.env.VERCEL_GIT_COMMIT_REF=before.ref;
  if(before.sha===undefined)delete process.env.VERCEL_GIT_COMMIT_SHA;else process.env.VERCEL_GIT_COMMIT_SHA=before.sha;
  console.log('PASS: /api/smoke valida el código del despliegue actual sin depender de ramas antiguas');
}
run().catch(error=>{console.error(error);process.exitCode=1});
