'use strict';
const assert=require('node:assert/strict');
const {verifyHealth,ServiceConfigurationError,main}=require('../scripts/wait-service-deployment.cjs');
const canonical='https://the-phone-face-app-whatsapp-fotos-y.vercel.app';
const expected={commit:'a'.repeat(40),branch:'work/unify-crm-services-20260920',environment:'preview'};
const health={ok:true,app:'The Phone Face CRM',...expected,service_origins:{telegram:canonical,google_drive_documents:'https://the-phone-face-app-whatsapp-git-4c8eb2-jramon-07-2402s-projects.vercel.app'}};
const reply=body=>async(url,options)=>{
  assert.equal(String(url),canonical+'/api/health');
  assert.equal(options.redirect,'error');
  return{ok:true,json:async()=>body};
};

(async()=>{
  assert.equal(await verifyHealth(canonical,expected,'fake-bypass',reply(health)),true,'Canonical Telegram may pass while the documented Documents migration remains pending');
  const invalid=[undefined,null,'','https://the-phone-face-app-whatsapp-git-1e9acf-jramon-07-2402s-projects.vercel.app',canonical+'/',canonical+'/path'];
  for(const telegram of invalid){
    await assert.rejects(verifyHealth(canonical,expected,'fake-bypass',reply({...health,service_origins:{telegram}})),ServiceConfigurationError);
  }
  await assert.rejects(verifyHealth(canonical,expected,'fake-bypass',reply({...health,service_origins:undefined})),ServiceConfigurationError);
  assert.equal(await verifyHealth(canonical,expected,'fake-bypass',reply({...health,commit:'b'.repeat(40),service_origins:undefined})),false,'An old deployment can keep waiting; its configuration is not the target');
  assert.equal(await verifyHealth(canonical,expected,'fake-bypass',reply({...health,environment:'production',service_origins:undefined})),false);

  process.env.E2E_EXPECTED_COMMIT=expected.commit;
  process.env.E2E_EXPECTED_BRANCH=expected.branch;
  process.env.E2E_EXPECTED_ENVIRONMENT=expected.environment;
  process.env.SERVICE_TARGET_URL=canonical;
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET='fake-bypass';
  let reads=0;
  const originalFetch=global.fetch;
  global.fetch=async(...args)=>{reads++;return reply({...health,service_origins:{telegram:null}})(...args)};
  try{
    await assert.rejects(main(),error=>error instanceof ServiceConfigurationError&&/CRM_STABLE_ORIGIN/.test(error.message));
    assert.equal(reads,1,'A known configuration error must terminate immediately instead of retrying for 12 minutes');
  }finally{global.fetch=originalFetch}
  console.log('PASS service deployment: exact identity plus canonical Telegram required, missing/legacy/invalid origins block immediately, all requests mocked.');
})().catch(error=>{console.error(error);process.exitCode=1});
