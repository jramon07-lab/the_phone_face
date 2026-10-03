const assert=require('node:assert/strict');
Object.assign(process.env,{SUPABASE_SERVICE_ROLE_KEY:'service',SUPABASE_PUBLISHABLE_KEY:'public',GOOGLE_CONTACTS_CLIENT_ID:'client',GOOGLE_CONTACTS_CLIENT_SECRET:'secret',CRM_BACKUP_ENCRYPTION_KEY:'encryption'});
const api=require('../api/google-contacts');
const stored={refresh_token:'private-refresh',email:'team@example.com'};
let tokenResult,transportFailure=false,writes=0;
global.fetch=async(url,options={})=>{
 if(url.includes('oauth2.googleapis.com')){if(transportFailure)throw new Error('network');return new Response(JSON.stringify(tokenResult.body),{status:tokenResult.status});}
 if(options.method&&options.method!=='GET')writes++;
 if(url.includes('/auth/v1/user'))return new Response(JSON.stringify({id:'user'}));
 if(url.includes('user_permissions'))return new Response(JSON.stringify([{user_id:'user',is_admin:true}]));
 if(url.includes('crm_external_credentials'))return new Response(JSON.stringify([{encrypted_value:api._test.seal(stored)}]));
 throw new Error('unexpected request');
};
async function status(){let result;await api({method:'GET',query:{action:'status'},headers:{authorization:'Bearer crm-token'}},{setHeader(){},status(code){assert.equal(code,200);return this},json(body){result=body;return body}});assert(!JSON.stringify(result).includes('private-refresh'));return result;}
(async()=>{
 tokenResult={status:200,body:{access_token:'private-access'}};assert.equal((await status()).connected,true);
 tokenResult={status:400,body:{error:'invalid_grant',error_description:'private details'}};let s=await status();assert.equal(s.connected,false);assert.equal(s.reauthorize,true);assert.equal(s.email,stored.email);assert.equal(s.canManage,true);assert(!JSON.stringify(s).includes('private details'));
 tokenResult={status:503,body:{error:'server_error'}};s=await status();assert.equal(s.reauthorize,false);assert.equal(s.code,'google_unavailable');
 tokenResult={status:400,body:{error:'invalid_client'}};s=await status();assert.equal(s.reauthorize,false);assert.equal(s.code,'google_configuration_error');
 transportFailure=true;s=await status();assert.equal(s.reauthorize,false);assert.equal(s.code,'google_unavailable');
 assert.equal(writes,0,'health checks must never modify contacts or credentials');
 console.log('PASS: live Google health, revoked permission, configuration failure and temporary outages remain distinct without modifying data or exposing credentials.');
})().catch(e=>{console.error(e);process.exitCode=1});
