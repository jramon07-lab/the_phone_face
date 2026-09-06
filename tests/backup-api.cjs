const assert=require('node:assert/strict'),crypto=require('node:crypto');
Object.assign(process.env,{SUPABASE_URL:'https://supabase.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-service',SUPABASE_ANON_KEY:'test-anon',GOOGLE_DRIVE_CLIENT_ID:'test-id',GOOGLE_DRIVE_CLIENT_SECRET:'test-secret',CRM_BACKUP_ENCRYPTION_KEY:'test-backup',CRON_SECRET:'test-cron'});
const key=crypto.createHash('sha256').update('test-backup').digest(),iv=Buffer.alloc(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv),body=Buffer.concat([cipher.update('test-refresh'),cipher.final()]);const sealed=Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64');
const handler=require('../api/crm-backup'),B=require('../lib/crm-backup-core');
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data,arrayBuffer:async()=>data});
let failure='',uploaded,finished,seen;
global.fetch=async(url,options={})=>{const u=new URL(url),table=u.pathname.split('/').at(-1);seen.push({url,method:options.method||'GET'});
 if(u.pathname.endsWith('/rpc/current_user_permissions'))return response({is_admin:true});
 if(table==='crm_backup_runs'&&options.method==='POST')return response([{id:'run-test'}]);
 if(table==='crm_backup_runs'&&options.method==='PATCH'){finished=JSON.parse(options.body);return response(null,204);}
 if(table==='crm_external_credentials'&&!u.searchParams.has('offset'))return response([{encrypted_value:sealed}]);
 if(u.hostname==='oauth2.googleapis.com')return response({access_token:'test-access'});
 if(u.pathname.startsWith('/upload/')){const data=Buffer.from(options.body),start=data.indexOf(Buffer.from('TPFB1')),end=data.lastIndexOf(Buffer.from('\r\n--'));uploaded=data.subarray(start,end);return response({id:'file-test'});}
 if(u.searchParams.get('alt')==='media')return response(failure==='corrupt'?Buffer.from('corrupt'):uploaded);
 if(B.TABLES.includes(table)){if(table===failure)return response({},404);return response([]);}
 throw Error('Unexpected request '+u.pathname);
};
async function request(method='POST'){seen=[];finished=null;let status,result;const res={setHeader(){return this},status(n){status=n;return this},json(v){result=v}};await handler({method,headers:{authorization:'Bearer x.eyJzdWIiOiJ0ZXN0In0.x'},query:{action:'run'}},res);return {status,result};}
(async()=>{
 let r=await request();assert.equal(r.status,200);assert.equal(finished.status,'verified');assert.equal(r.result.verification,'download-decrypt-counts');assert.equal(Object.keys(r.result.counts).length,38);assert(seen.some(x=>x.url.includes('alt=media')));assert(seen.some(x=>x.url.includes('user_field_permissions')&&x.url.includes('order=user_id.asc,section.asc,field_key.asc')));
 failure='corrupt';r=await request();assert.equal(r.status,500);assert.equal(finished.status,'failed');
 failure='sales_custom_values';r=await request();assert.equal(r.status,500);assert.equal(finished.status,'failed');assert(!seen.some(x=>x.url.includes('/upload/')));
 failure='';r=await request('GET');assert.equal(r.status,405);assert(!seen.some(x=>x.method==='PATCH'));
 console.log('PASS backup API remote download, corruption, missing table, composite key and POST enforcement');
})().catch(e=>{console.error(e);process.exitCode=1;});
