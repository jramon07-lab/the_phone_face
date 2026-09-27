const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let current=true,afterSession=null,calls=[];
const context={window:{},document:{createElement(){return {}},head:{appendChild(){}}},URL,URLSearchParams,Date,console,fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>(options.method==='PUT'?{id:'file_123',name:'test.pdf',webViewLink:'https://drive.google.com/file/d/file_123/view'}:{ok:true,uploadUrl:'https://www.googleapis.com/upload/test'})}}};
const originalSource=fs.readFileSync('js/mobile-documents.js','utf8');assert(!originalSource.includes('canvas.toBlob'));
const src=originalSource.replace('window.TPFMobileDocuments={mount,leave};','window.TPFMobileDocuments={mount,leave};window.testDocs={api,uploadOne,safeUrl,uploadMime,setModel:m=>model=m};');vm.runInNewContext(src,context);const t=context.window.testDocs;
const link={version:1,provider:'google_drive',folder_id:'folder_123456789'},m={id:'client-a',options:{isCurrent:()=>current,client:{auth:{getSession:async()=>{afterSession?.();return {data:{session:{access_token:'test-token'}}}}}}}};t.setModel(m);
(async()=>{
 assert.equal(t.uploadMime({name:'IMG.HEIC',type:'application/octet-stream'}),'image/heic');
 assert.equal(t.uploadMime({name:'image.jpg',type:'image/jpg'}),'image/jpeg');
 assert.equal(t.uploadMime({name:'image.jpg',type:'image/jpeg; charset=binary'}),'image/jpeg');
 assert.equal(t.uploadMime({name:'bad.jpg',type:'text/html'}),'text/html');

 await t.uploadOne(m,{name:'test.pdf',type:'application/pdf',size:100},link);assert.equal(calls.length,2);const body=JSON.parse(calls[0].options.body);assert.equal(body.contactId,'client-a');assert.deepEqual(body.expectedLink,link);assert.equal(calls[1].options.method,'PUT');assert.equal(calls[1].options.body.name,'test.pdf');assert.equal(calls[1].options.body.size,100);assert.equal(m.uploaded.length,1);assert.equal(m.uploaded[0].webViewLink,'https://drive.google.com/file/d/file_123/view');assert.equal(m.files[0].name,'test.pdf');
 calls=[];afterSession=()=>current=false;await assert.rejects(t.uploadOne(m,{name:'test.pdf',type:'application/pdf',size:100},link));assert.equal(calls.length,0);
 afterSession=null;current=true;context.window.TPFMobileDocuments.leave();await assert.rejects(t.api(m,'list'));assert.equal(calls.length,0);
 assert.equal(t.safeUrl('javascript:alert(1)'),'');assert.equal(t.safeUrl('https://evil.test/file'),'');assert.equal(t.safeUrl('https://drive.google.com/file/d/test/view'),'https://drive.google.com/file/d/test/view');
 console.log('PASS: mobile document uploads retain contact/folder, route changes stop stale requests, leave invalidates actions, file links allowlisted. Network mocked.');
})().catch(e=>{console.error(e);process.exit(1)});
