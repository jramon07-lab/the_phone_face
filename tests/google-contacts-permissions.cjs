const assert=require('assert');

process.env.SUPABASE_SERVICE_ROLE_KEY='service';
process.env.SUPABASE_PUBLISHABLE_KEY='public';
process.env.GOOGLE_DRIVE_CLIENT_ID='client';
process.env.GOOGLE_DRIVE_CLIENT_SECRET='secret';
process.env.CRM_BACKUP_ENCRYPTION_KEY='encryption';

const originalFetch=global.fetch;
global.fetch=async()=>({ok:true,json:async()=>[{user_id:'user-1',is_admin:true}]});

const api=require('../api/google-contacts');

(async()=>{
  try{
    const result=await api._test.identity({headers:{authorization:'Bearer valid.session.token'}});
    assert.equal(result.permissions.user_id,'user-1');
    assert.equal(result.permissions.is_admin,true);
    console.log('PASS: Google Contacts accepts the permissions row returned by Supabase RPC.');
  }finally{
    global.fetch=originalFetch;
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
