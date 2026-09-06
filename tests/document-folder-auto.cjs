'use strict';
const assert=require('node:assert/strict');
Object.assign(process.env,{SUPABASE_SERVICE_ROLE_KEY:'test-service',SUPABASE_ANON_KEY:'test-anon',GOOGLE_DRIVE_CLIENT_ID:'test-client',GOOGLE_DRIVE_CLIENT_SECRET:'test-secret',CRM_BACKUP_ENCRYPTION_KEY:'test-encryption'});
const handler=require('../api/crm-documents'),{ROOT,PENDING}=require('../lib/crm-document-folder')._test;
const id='11111111-1111-1111-1111-111111111111',MIME='application/vnd.google-apps.folder';
const clone=v=>JSON.parse(JSON.stringify(v));
let data,permissions,folders,log,generated,rootWritable,pages,claimed,hook,incomplete,folderPosts;
const original=()=>({NOMBRE:'EMILIO',APELLIDOS:'RODRÍGUEZ BAR COLON',NOTAS:'No borrar',TPF_TITULAR:{same:false,holder_name:'Titular distinto'}});
function reset(){data=original();permissions={user_id:id,is_admin:true,can_edit_records:true};folders=new Map();log=[];generated=0;rootWritable=true;pages=null;claimed=false;hook=null;incomplete=false;folderPosts=0;}
const makeFolder=(id,name='Emilio Rodríguez Bar Colon',parents=[ROOT])=>({id,name,parents,mimeType:MIME,trashed:false,capabilities:{canAddChildren:true}});
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
global.fetch=async(raw,options={})=>{
 const url=new URL(raw);log.push({url,options});if(hook){const response=await hook(url,options);if(response)return response;}
 if(url.pathname.endsWith('/current_user_permissions'))return reply(permissions);
 if(url.pathname.endsWith('/crm_external_credentials'))return reply([{encrypted_value:handler._test.seal({refresh_token:'test-refresh'})}]);
 if(url.hostname==='oauth2.googleapis.com')return reply({access_token:'test-google'});
 if(url.pathname==='/rest/v1/records'){
  assert.equal(options.headers.Authorization,'Bearer test.token','Records must always use the user token, not service role');
  if(url.searchParams.get('id')?.startsWith('neq.'))return reply(claimed?[{id:'other'}]:[]);
  if(options.method==='PATCH'){
   assert(url.searchParams.has('data'),'Writes must have a compare-and-swap predicate');
   const expected=JSON.parse(url.searchParams.get('data').slice(3));
   if(JSON.stringify(expected)!==JSON.stringify(data))return reply([]);
   data=JSON.parse(options.body).data;return reply([{id,data:clone(data)}]);
  }
  return reply([{id,data:clone(data)}]);
 }
 if(url.pathname==='/drive/v3/files/generateIds')return reply({ids:['generated_folder_'+(++generated)]});
 if(url.pathname==='/drive/v3/files'&&options.method==='POST'){
  folderPosts++;const value=JSON.parse(options.body);assert.deepEqual(value.parents,[ROOT]);assert.equal(value.mimeType,MIME);assert.equal(value.appProperties.tpfContactId,id);
  if(folders.has(value.id))return reply({},409);
  folders.set(value.id,{...makeFolder(value.id,value.name),appProperties:value.appProperties});return reply({id:value.id});
 }
 if(url.pathname==='/drive/v3/files'){
  assert(url.searchParams.get('q').includes("'"+ROOT+"' in parents"),'Search must stay within approved root');
  const page=Number(url.searchParams.get('pageToken')||0),all=pages||[[...folders.values()].map(({id,name})=>({id,name}))];
  return reply({files:all[page]||[],...(page<all.length-1?{nextPageToken:String(page+1)}:{}),incompleteSearch:incomplete});
 }
 if(url.pathname.startsWith('/drive/v3/files/')){
  const fid=decodeURIComponent(url.pathname.split('/').pop());
  if(fid===ROOT)return reply({...makeFolder(ROOT,'01 Clientes',['approved_parent']),capabilities:{canAddChildren:rootWritable}});
  return folders.has(fid)?reply(folders.get(fid)):reply({},404);
 }
 throw Error('Unexpected request: '+url);
};
async function invoke(body={},method='POST'){
 let result;const res={setHeader(){},status(status){this.code=status;return this;},json(value){result={status:this.code,body:value};return this;}};
 await handler({method,query:{action:'ensureFolder'},headers:{authorization:'Bearer test.token'},body:{contactId:id,confirmed:true,expectedData:clone(data),...body}},res);
 return result;
}
const writes=()=>log.filter(x=>x.options.method==='PATCH'||x.options.method==='POST'&&x.url.pathname==='/drive/v3/files');
(async()=>{
 reset();let r=await invoke({rootId:'wrong_root',name:'Malicious replacement'});assert.equal(r.status,200);assert.equal(r.body.created,true);assert.equal(r.body.link.folder_name,'Emilio Rodríguez Bar Colon');assert.equal(folders.size,1);assert.equal(data.NOTAS,'No borrar');assert.equal(data.TPF_TITULAR.holder_name,'Titular distinto');assert(!data[PENDING]);
 const linked=clone(data.TPF_DOCUMENTS);r=await invoke();assert.equal(r.status,200);assert.deepEqual(data.TPF_DOCUMENTS,linked);assert.equal(folderPosts,1,'Repeated ensure must not create another folder');
 console.log('PASS create named folder in approved root, preserve fields, reuse linked folder');

 reset();const existing=makeFolder('existing_folder_1','EMILIO RODRIGUEZ BAR COLON');folders.set(existing.id,existing);pages=[[],[{id:existing.id,name:existing.name}]];
 r=await invoke();assert.equal(r.status,200);assert.equal(r.body.link.folder_id,existing.id);assert.equal(folderPosts,0);assert.equal(generated,0);
 reset();folders.set('existing_folder_1',makeFolder('existing_folder_1'));folders.set('existing_folder_2',makeFolder('existing_folder_2'));
 r=await invoke();assert.equal(r.body.needsChoice,true);assert.equal(r.body.candidates.length,2);assert.equal(writes().length,0,'Ambiguous folder names must not write anything');
 r=await invoke({folderId:'not_in_candidates'});assert.equal(r.status,409);assert.equal(writes().length,0);
 r=await invoke({folderId:'existing_folder_2'});assert.equal(r.status,200);assert.equal(r.body.link.folder_id,'existing_folder_2');assert.equal(folderPosts,0);
 console.log('PASS paginated existing match, ambiguity with no writes and validated choice');

 for(const setup of [()=>{permissions.is_admin=false;permissions.can_edit_records=false;},()=>{data.NOMBRE='';data.APELLIDOS='';},()=>{rootWritable=false;},()=>{incomplete=true;}]){
  reset();setup();r=await invoke();assert(r.status>=400);assert.equal(writes().length,0);
 }
 reset();assert.equal((await invoke({},'GET')).status,405);assert.equal(writes().length,0);
 reset();assert.equal((await invoke({confirmed:false})).status,400);assert.equal(writes().length,0);
 reset();assert.equal((await invoke({expectedData:{}})).status,409);assert.equal(writes().length,0);
 reset();claimed=true;folders.set('existing_folder_1',makeFolder('existing_folder_1'));assert.equal((await invoke()).status,409);assert.equal(writes().length,0);
 reset();const wrong=makeFolder('existing_folder_1',undefined,['other_parent']);folders.set(wrong.id,wrong);assert.equal((await invoke()).status,409);assert.equal(writes().length,0);
 console.log('PASS read-only roles, invalid name, missing write permission, incomplete search, stale data, forged choice and claimed folder are safe');

 reset();const snapshot=clone(data);let failOnce=true;
 hook=async(url,options)=>{if(failOnce&&url.pathname==='/drive/v3/files'&&options.method==='POST'){
  failOnce=false;const body=JSON.parse(options.body);folders.set(body.id,{...makeFolder(body.id,body.name),appProperties:body.appProperties});throw Error('Simulated connection loss after Google created folder');
 }};
 r=await invoke({expectedData:snapshot});assert.equal(r.status,500);assert(data[PENDING]);const reserved=data[PENDING].folder_id;
 r=await invoke({expectedData:snapshot});assert.equal(r.status,200);assert.equal(r.body.link.folder_id,reserved);assert.equal(folders.size,1);assert.equal(generated,1);assert(!data[PENDING]);
 console.log('PASS retry after uncertain Google result recovers reserved ID without duplicates');

 reset();const both=await Promise.all([invoke(),invoke()]);assert(both.every(x=>x.status===200));assert.equal(both[0].body.link.folder_id,both[1].body.link.folder_id);assert.equal(folders.size,1,'Parallel requests must create one folder');
 reset();let edited=false;hook=async(url,options)=>{if(!edited&&url.pathname==='/drive/v3/files'&&options.method==='POST'){edited=true;data.NOTAS='Nota nueva durante la operación';}};
 r=await invoke();assert.equal(r.status,200);assert.equal(r.body.data.NOTAS,'Nota nueva durante la operación');
 reset();permissions.is_admin=false;permissions.can_edit_records=true;r=await invoke();assert.equal(r.status,200,'An editor can prepare within the approved root');
 assert(!JSON.stringify(r.body).includes('test-google'));assert(!JSON.stringify(r.body).includes('test-refresh'));
 console.log('PASS concurrent preparations, concurrent note preservation and no credential disclosure. All network mocked.');
})().catch(error=>{console.error(error);process.exitCode=1;});
