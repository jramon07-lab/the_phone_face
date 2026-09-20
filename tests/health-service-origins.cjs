'use strict';
const assert=require('node:assert/strict');
const health=require('../api/health');
function run(){let result;health({},{setHeader(){},status(code){assert.equal(code,200);return this;},json(value){result=value;}});return result;}
const old={...process.env};
try{
  for(const key of ['CRM_STABLE_ORIGIN','CRM_GOOGLE_CONTACTS_ORIGIN','GOOGLE_DRIVE_BACKUP_REDIRECT_URI','CRM_DOCUMENTS_ORIGIN'])delete process.env[key];
  let result=run();
  assert.equal(result.service_origins.telegram,result.service_origins.canonical);
  assert.equal(result.service_origins.google_drive_documents,result.service_origins.canonical,'Document authorization uses the registered canonical callback');
  process.env.GOOGLE_DRIVE_BACKUP_REDIRECT_URI='https://backup.example/api/crm-backup?action=callback&token=never-expose-this';
  process.env.CRM_STABLE_ORIGIN='https://user:private@telegram.example';
  process.env.CRM_DOCUMENTS_ORIGIN='not-a-url';
  process.env.SUPABASE_SERVICE_ROLE_KEY='private-key';
  result=run();
  assert.equal(result.service_origins.google_drive_backups,'https://backup.example');
  assert.equal(result.service_origins.telegram,null);
  assert.equal(result.service_origins.google_drive_documents,null);
  assert.ok(!JSON.stringify(result).includes('never-expose-this'));
  assert.ok(!JSON.stringify(result).includes('private'));
  for(const suffix of ['/path','?query=private','#fragment']){
    process.env.CRM_STABLE_ORIGIN=result.service_origins.canonical+suffix;
    assert.equal(run().service_origins.telegram,null,'Invalid runtime origin must not appear healthy');
  }
  console.log('PASS: health exposes effective origins only, never credentials or callback query strings');
}finally{for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];Object.assign(process.env,old);}
