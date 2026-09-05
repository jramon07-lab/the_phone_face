const assert=require('node:assert/strict');
Object.assign(process.env,{SUPABASE_SERVICE_ROLE_KEY:'test-service',SUPABASE_ANON_KEY:'test-anon',GOOGLE_DRIVE_CLIENT_ID:'test-client',GOOGLE_DRIVE_CLIENT_SECRET:'test-secret',CRM_BACKUP_ENCRYPTION_KEY:'test-encryption'});
const handler=require('../api/crm-documents.js'),T=handler._test;
const rid='11111111-1111-1111-1111-111111111111',fid='folder_test_123456';
let permission={user_id:rid,is_admin:true,can_edit_records:true},savedLink={version:1,provider:'google_drive',folder_id:fid,folder_name:'Carpeta'},patch=null,emptyPatch=false,calls=[];
const row=()=>({id:rid,source_sheet:'BASE DE DATOS',data:{NOMBRE:'Contacto',NOTAS:'Conservar',TPF_TITULAR:{same:false,holder_name:'Titular'},TPF_DOCUMENTS:savedLink}});
const response=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...headers}});
global.fetch=async(url,options={})=>{calls.push({url,options});
 if(url.includes('current_user_permissions'))return response(permission);
 if(url.includes('crm_external_credentials'))return response([{encrypted_value:T.seal({refresh_token:'test-refresh'})}]);
 if(url.includes('oauth2.googleapis.com'))return response({access_token:'test-google-access'});
 if(url.includes('/rest/v1/records')){if(options.method==='PATCH'){patch=JSON.parse(options.body);return response(emptyPatch?[]:[{...row(),...patch}]);}return response([row()]);}
 if(url.includes('/upload/drive'))return response({},200,{location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=test'});
 if(url.includes('/drive/v3/files/'+fid))return response({id:fid,name:'Carpeta verificada',mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}});
 if(url.includes('/drive/v3/files?'))return response({files:[{id:'file_test',name:'Factura.pdf'}]});
 throw Error('Unexpected network call: '+url);
};
async function invoke(action,body={},method){let result;const res={setHeader(){return this;},status(s){this.code=s;return this;},json(d){result={status:this.code,body:d};return this;},end(){result={status:this.code};return this;}};await handler({method:method||(['link','upload','authorize'].includes(action)?'POST':'GET'),headers:{authorization:'Bearer test.token.value',host:'the-phone-face-app-whatsapp-git-4c8eb2-jramon-07-2402s-projects.vercel.app'},query:{action,contactId:rid,q:'Cliente'},body:{contactId:rid,...body}},res);return result;}
(async()=>{
 assert.equal(T.folderId('https://drive.google.com/drive/u/0/folders/'+fid),fid);
 for(const bad of ['https://evil.test/folders/'+fid,'javascript:alert(1)','folder/../../secret'])assert.throws(()=>T.folderId(bad));
 assert.throws(()=>T.adapter({version:1,provider:'onedrive'}));
 const s=await invoke('status');assert.equal(s.body.connected,true);assert.ok(!JSON.stringify(s).includes('test-refresh'));
 const a=await invoke('authorize');assert.equal(a.status,200);assert.equal(new URL(a.body.url).searchParams.get('redirect_uri').includes('crm-documents'),true);
 let d=await invoke('list');assert.equal(d.status,200);assert.equal(d.body.files.length,1);
 d=await invoke('link',{confirmed:true,expectedLink:savedLink,folderId:fid});assert.equal(d.status,200);assert.equal(patch.data.NOTAS,'Conservar');assert.equal(patch.data.TPF_TITULAR.holder_name,'Titular');assert.equal(patch.data.NOMBRE,'Contacto');assert.equal(patch.data.TPF_DOCUMENTS.provider,'google_drive');
 d=await invoke('link',{confirmed:true,expectedLink:null,folderId:fid});assert.equal(d.status,409);
 emptyPatch=true;d=await invoke('link',{confirmed:true,expectedLink:savedLink,folderId:fid});assert.equal(d.status,409);emptyPatch=false;
 d=await invoke('upload',{expectedLink:savedLink,name:'DNI.pdf',size:1000,mimeType:'application/pdf'});assert.equal(d.status,200);assert.ok(d.body.uploadUrl);assert.ok(!JSON.stringify(d).includes('test-google-access'));
 d=await invoke('upload',{expectedLink:null,name:'DNI.pdf',size:1000,mimeType:'application/pdf'});assert.equal(d.status,409);
 d=await invoke('upload',{expectedLink:savedLink,name:'a.html',size:1000,mimeType:'text/html'});assert.equal(d.status,400);
 d=await invoke('link',{},'GET');assert.equal(d.status,405);
 permission={user_id:rid,is_admin:false,can_edit_records:false};
 for(const action of ['upload','link','search','authorize'])assert.equal((await invoke(action,{expectedLink:savedLink,confirmed:true,folderId:fid})).status,403);
 permission=null;calls=[];assert.equal((await invoke('list')).status,403);assert.equal(calls.length,1);
 console.log('PASS: permissions, folder validation, provider guard, preservation, stale saves, upload restrictions, OAuth state, no token disclosure. All network mocked.');
})().catch(e=>{console.error(e);process.exit(1);});
