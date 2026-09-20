'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/contact-documents.js','utf8');
class Element{
 constructor(){this.nodes={};this.events={};this.children=[];this.isConnected=true;this.disabled=false;this.classList={contains:()=>false};}
 set innerHTML(value){this.html=value;this.nodes={};}get innerHTML(){return this.html||'';}
 querySelector(selector){const attr=selector.match(/^\[([^\]]+)\]$/)?.[1];if(!attr||!this.innerHTML.includes(attr))return null;return this.nodes[selector]||(this.nodes[selector]=new Element());}
 querySelectorAll(){return [];}addEventListener(name,fn){this.events[name]=fn;}click(){return this.events.click?.();}
 append(...items){this.children.push(...items);}appendChild(item){this.append(item);}setAttribute(){}removeAttribute(){}
}
async function fixture(callback,{origin='https://current-crm.example',expired=false}={}){
 const host=new Element(),modal=new Element(),events={},requests=[],redirects=[];
 const context=vm.createContext({URL,URLSearchParams,console,
  document:{head:new Element(),createElement:()=>new Element(),querySelector:()=>null,getElementById:id=>id==='cpDocumentsPending'?host:id==='contactModal'?modal:id==='contactName'?{value:'Prueba'}:null},
  currentContact:{id:'test-contact',data:expired?{TPF_DOCUMENTS:{version:1,provider:'google_drive',folder_id:'folder_test_123456'}}:{}},
  MutationObserver:class{observe(){}},addEventListener(name,fn){events[name]=fn},
  location:{origin,assign(url){redirects.push(url)}},
  sb:{auth:{getSession:async()=>({data:{session:{access_token:'test-session'}}})}},
  fetch:async(url,options)=>{
   requests.push({url,options});assert.equal(options.headers.Authorization,'Bearer test-session');
   const action=new URL(url,origin).searchParams.get('action');
   if(action==='status')return{ok:true,json:async()=>({ok:true,configured:true,connected:expired,canManage:true,callback})};
   if(action==='list'&&expired)return{ok:false,json:async()=>({ok:false,error:'Vuelve a conectar Google Drive desde Documentos.'})};
   if(action==='authorize')return{ok:true,json:async()=>({ok:true,url:'https://accounts.google.com/o/oauth2/v2/auth?synthetic-test'})};
   throw Error('Unexpected mocked API action: '+action);
  }
 });context.window=context;
 vm.runInContext(source,context);await events['tpf:contact-open']();
 const button=host.querySelector(expired?'[data-doc-reconnect]':'[data-doc-connect]');assert(button);
 await button.click();return{host,requests,redirects};
}

(async()=>{
 for(const origin of ['https://configured-crm.example','https://other-configured-crm.example']){
  const callback=origin+'/api/crm-documents?action=callback';
  const away=await fixture(callback);
  assert.equal(away.requests.length,1,'Another origin must not initiate authorization here');
  assert.equal(away.redirects.length,0);
  const notice=away.host.querySelector('[data-doc-message]'),link=notice.children.find(item=>item instanceof Element);
  assert.equal(link.href,origin+'/');assert(!notice.textContent.includes('rama'));
  for(const expired of [false,true]){
   const here=await fixture(callback,{origin,expired});
   const authorize=here.requests.filter(item=>item.url.includes('action=authorize'));
   assert.equal(authorize.length,1);assert.equal(authorize[0].options.method,'POST');
   assert.equal(here.redirects.length,1);
  }
 }
 for(const callback of [undefined,'','/api/crm-documents?action=callback','http://crm.example/api/crm-documents?action=callback','https://user:secret@crm.example/api/crm-documents?action=callback','https://crm.example/api/other?action=callback','https://crm.example/api/crm-documents?action=authorize','https://crm.example/api/crm-documents?action=callback&action=callback','https://crm.example/api/crm-documents?action=callback&next=other','https://crm.example/api/crm-documents?action=callback#fragment']){
  const invalid=await fixture(callback);
  assert.equal(invalid.requests.length,1);assert.equal(invalid.redirects.length,0);
  const notice=invalid.host.querySelector('[data-doc-message]');assert.match(notice.textContent,/No hay una dirección válida/);assert.equal(notice.children.length,0,'Invalid callback has no historical fallback link');
 }

 // The UI follows the server's origin; it does not weaken host/cookie checks.
 const configured='https://documents-crm.example';
 Object.assign(process.env,{SUPABASE_SERVICE_ROLE_KEY:'test-service',SUPABASE_ANON_KEY:'test-anon',GOOGLE_DRIVE_CLIENT_ID:'test-client',GOOGLE_DRIVE_CLIENT_SECRET:'test-secret',CRM_BACKUP_ENCRYPTION_KEY:'test-encryption',CRM_DOCUMENTS_ORIGIN:configured});
 const api=require('../api/crm-documents');
 let reads=0;const originalFetch=global.fetch;
 global.fetch=async url=>{reads++;assert(String(url).endsWith('/rest/v1/rpc/current_user_permissions'));return{ok:true,json:async()=>({user_id:'test-admin',is_admin:true})}};
 async function invoke(action,host,query={}){
  const result={headers:{}};await api({method:action==='callback'?'GET':'POST',headers:{host,authorization:'Bearer test.token.value'},query:{action,...query},body:{}},{setHeader(k,v){result.headers[k]=v},status(code){result.status=code;return this},json(body){result.body=body;return this}});return result;
 }
 try{
  assert.equal((await invoke('authorize','wrong-crm.example')).status,409);
  const auth=await invoke('authorize',new URL(configured).host);assert.equal(auth.status,200);
  assert.match(auth.headers['Set-Cookie'],/Path=\/api\/crm-documents; HttpOnly; Secure; SameSite=Lax; Max-Age=600/);
  const authorization=new URL(auth.body.url);
  assert.equal(authorization.searchParams.get('redirect_uri'),configured+'/api/crm-documents?action=callback');
  assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');
  const before=reads;
  const missingCookie=await invoke('callback',new URL(configured).host,{state:authorization.searchParams.get('state'),code:'synthetic-code'});
  assert.equal(missingCookie.status,400);assert.equal(reads,before,'Missing nonce cookie must reject before an OAuth exchange');
 }finally{global.fetch=originalFetch}
 console.log('PASS Documents connection uses authenticated status callback, rejects invalid callbacks without fallback, and preserves server host/nonce-cookie authorization. All network mocked.');
})().catch(error=>{console.error(error);process.exitCode=1});
