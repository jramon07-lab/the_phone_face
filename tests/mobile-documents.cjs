const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let current=true,afterSession=null,calls=[];
const context={window:{},document:{createElement(){return {}},head:{appendChild(){}}},URL,URLSearchParams,Date,console,fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({ok:true,uploadUrl:'https://www.googleapis.com/upload/test'})}}};
const src=fs.readFileSync('js/mobile-documents.js','utf8').replace('window.TPFMobileDocuments={mount,leave};','window.TPFMobileDocuments={mount,leave};window.testDocs={api,uploadOne,safeUrl,setModel:m=>model=m};');vm.runInNewContext(src,context);const t=context.window.testDocs;
const link={version:1,provider:'google_drive',folder_id:'folder_123456789'},m={id:'client-a',options:{isCurrent:()=>current,client:{auth:{getSession:async()=>{afterSession?.();return {data:{session:{access_token:'test-token'}}}}}}}};t.setModel(m);
(async()=>{
 await t.uploadOne(m,{name:'test.pdf',type:'application/pdf',size:100},link);assert.equal(calls.length,2);const body=JSON.parse(calls[0].options.body);assert.equal(body.contactId,'client-a');assert.deepEqual(body.expectedLink,link);assert.equal(calls[1].options.method,'PUT');
 calls=[];afterSession=()=>current=false;await assert.rejects(t.uploadOne(m,{name:'test.pdf',type:'application/pdf',size:100},link));assert.equal(calls.length,0);
 afterSession=null;current=true;context.window.TPFMobileDocuments.leave();await assert.rejects(t.api(m,'list'));assert.equal(calls.length,0);
 assert.equal(t.safeUrl('javascript:alert(1)'),'');assert.equal(t.safeUrl('https://evil.test/file'),'');assert.equal(t.safeUrl('https://drive.google.com/file/d/test/view'),'https://drive.google.com/file/d/test/view');
 console.log('PASS: mobile document uploads retain contact/folder, route changes stop stale requests, leave invalidates actions, file links allowlisted. Network mocked.');
})().catch(e=>{console.error(e);process.exit(1)});
