'use strict';
const assert=require('node:assert/strict');
const preview=require('../lib/crm-document-preview');
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function run(){
 let downloads=0,metadata={parents:['folder'],mimeType:'image/jpeg',size:'4',capabilities:{canDownload:true}};
 const args={fileId:'file',link:{folder_id:'folder'},t:'test',fail,drive:async()=>metadata,request:async()=>{downloads++;return new Response(Buffer.from('test'));}};
 assert.deepEqual(await preview(args),{ok:true,mimeType:'image/jpeg',base64:'dGVzdA=='});
 metadata={...metadata,parents:['different']};await assert.rejects(preview(args),e=>e.status===403);assert.equal(downloads,1);
 metadata={...metadata,parents:['folder'],capabilities:{canDownload:false}};await assert.rejects(preview(args),e=>e.status===403);assert.equal(downloads,1);
 metadata={...metadata,capabilities:{canDownload:true},mimeType:'image/svg+xml'};assert.equal((await preview(args)).external,true);assert.equal(downloads,1);
 metadata={...metadata,mimeType:'application/pdf',size:String(4*1024*1024)};assert.equal((await preview(args)).external,true);assert.equal(downloads,1);
 metadata={...metadata,size:'0'};assert.equal((await preview({...args,request:async()=>new Response(Buffer.alloc(3*1024*1024+1))})).external,true,'stream cap applies even when metadata size is absent');
 await assert.rejects(preview({...args,request:async()=>new Response('',{status:500})}),e=>e.status===502);
 console.log('PASS authorized document previews, folder isolation, download permission, safe formats, byte caps and upstream failure');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
