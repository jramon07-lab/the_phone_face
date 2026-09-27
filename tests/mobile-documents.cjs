const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let current=true,afterSession=null,calls=[];
const context={window:{},document:{createElement(){return {}},head:{appendChild(){}}},URL,URLSearchParams,Date,console,fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>(options.method==='PUT'?{id:'file_123',name:'test.pdf',webViewLink:'https://drive.google.com/file/d/file_123/view'}:{ok:true,uploadUrl:'https://www.googleapis.com/upload/test'})}}};
const originalSource=fs.readFileSync('js/mobile-documents.js','utf8');assert(!originalSource.includes('canvas.toBlob'));
const src=originalSource.replace('window.TPFMobileDocuments={mount,leave};','window.TPFMobileDocuments={mount,leave};window.testDocs={api,uploadOne,sendFile,safeUrl,uploadMime,setModel:m=>model=m};');vm.runInNewContext(src,context);const t=context.window.testDocs;
const link={version:1,provider:'google_drive',folder_id:'folder_123456789'},m={id:'client-a',options:{isCurrent:()=>current,client:{auth:{getSession:async()=>{afterSession?.();return {data:{session:{access_token:'test-token'}}}}}}}};t.setModel(m);
(async()=>{
 assert.equal(t.uploadMime({name:'IMG.HEIC',type:'application/octet-stream'}),'image/heic');
 assert.equal(t.uploadMime({name:'image.jpg',type:'image/jpg'}),'image/jpeg');
 assert.equal(t.uploadMime({name:'image.jpg',type:'image/jpeg; charset=binary'}),'image/jpeg');
 assert.equal(t.uploadMime({name:'bad.jpg',type:'text/html'}),'text/html');

 await t.uploadOne(m,{name:'test.pdf',type:'application/pdf',size:100},link);assert.equal(calls.length,2);const body=JSON.parse(calls[0].options.body);assert.equal(body.contactId,'client-a');assert.deepEqual(body.expectedLink,link);assert.equal(calls[1].options.method,'PUT');assert.equal(calls[1].options.body.name,'test.pdf');assert.equal(calls[1].options.body.size,100);assert.equal(m.uploaded.length,1);assert.equal(m.uploaded[0].webViewLink,'https://drive.google.com/file/d/file_123/view');assert.equal(m.files[0].name,'test.pdf');

 let progress=[],lastXHR;
 context.XMLHttpRequest=class{constructor(){this.upload={};lastXHR=this;}open(method,url){this.method=method;this.url=url;}setRequestHeader(k,v){this.mime=v;}send(file){this.file=file;this.upload.onprogress({lengthComputable:true,loaded:50,total:100});this.upload.onload();this.status=200;this.responseText='{"id":"ok"}';this.onload();}};
 const response=await t.sendFile('https://www.googleapis.com/upload/test',{size:100},'application/pdf',n=>progress.push(n));assert(response.ok);assert.equal((await response.json()).id,'ok');assert.deepEqual(progress,[50,100]);assert.equal(lastXHR.method,'PUT');assert.equal(lastXHR.mime,'application/pdf');assert.equal(lastXHR.timeout,120000);
 context.XMLHttpRequest.prototype.send=function(){this.ontimeout();};await assert.rejects(t.sendFile('https://www.googleapis.com/upload/test',{},'application/pdf',()=>{}),/confirmar/);
 delete context.XMLHttpRequest;
 calls=[];afterSession=()=>current=false;await assert.rejects(t.uploadOne(m,{name:'test.pdf',type:'application/pdf',size:100},link));assert.equal(calls.length,0);
 afterSession=null;current=true;context.window.TPFMobileDocuments.leave();await assert.rejects(t.api(m,'list'));assert.equal(calls.length,0);
 assert.equal(t.safeUrl('javascript:alert(1)'),'');assert.equal(t.safeUrl('https://evil.test/file'),'');assert.equal(t.safeUrl('https://drive.google.com/file/d/test/view'),'https://drive.google.com/file/d/test/view');
 console.log('PASS: mobile document uploads retain contact/folder, route changes stop stale requests, leave invalidates actions, file links allowlisted. Network mocked.');
})().catch(e=>{console.error(e);process.exit(1)});
