const assert=require('assert');

process.env.SUPABASE_SERVICE_ROLE_KEY='service';
process.env.SUPABASE_PUBLISHABLE_KEY='public';
process.env.GOOGLE_DRIVE_CLIENT_ID='client';
process.env.GOOGLE_DRIVE_CLIENT_SECRET='secret';
process.env.CRM_BACKUP_ENCRYPTION_KEY='encryption';

const originalFetch=global.fetch;
const calls=[];
global.fetch=async(url,options)=>{
  calls.push({url,options});
  if(url.includes('/auth/v1/user'))return {ok:true,json:async()=>({id:'user-1'})};
  if(url.includes('/rest/v1/user_permissions'))return {ok:true,json:async()=>[{user_id:'user-1',is_admin:true}]};
  throw new Error('Unexpected request: '+url);
};

const api=require('../api/google-contacts');

(async()=>{
  try{
    const result=await api._test.identity({headers:{authorization:'Bearer valid.session.token'}});
    assert.equal(result.permissions.user_id,'user-1');
    assert.equal(result.permissions.is_admin,true);
    assert(calls[0].url.endsWith('/auth/v1/user'));
    assert(calls[1].url.includes('/rest/v1/user_permissions?user_id=eq.user-1'));
    assert.equal(calls[1].options.headers.Authorization,'Bearer service');
    console.log('PASS: Google Contacts validates the session with Auth and reads permissions securely on the server.');
  }finally{
    global.fetch=originalFetch;
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
