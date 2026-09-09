const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const calls=[],downloads=[],timers=[];let sessionReads=0,token='synthetic-token';
 const window={fetch:async(input,init)=>{calls.push({input,init});return new Response('synthetic-document',{headers:{'Content-Type':'application/pdf'}})}};
 const ctx=vm.createContext({window,location:{href:'https://crm.test/',origin:'https://crm.test'},URL,Headers,Response,setTimeout:fn=>timers.push(fn),document:{body:{appendChild(){}},createElement:()=>({click(){downloads.push({url:this.href,name:this.download})},remove(){}})},sb:{auth:{getSession:async()=>{sessionReads++;return {data:{session:token?{access_token:token}:null}}}}}});
 vm.runInContext(fs.readFileSync('js/core/api-auth.js','utf8'),ctx);
 await window.fetch('/api/green?action=summary');assert.equal(calls.at(-1).init.headers.get('Authorization'),'Bearer synthetic-token');
 await window.fetch('https://third-party.test/api/green');assert.equal(sessionReads,1,'Never read/send a CRM token to another origin');assert.equal(calls.at(-1).init,undefined);
 await window.fetch('/api/crm-documents',{headers:{Authorization:'Bearer existing'}});assert.equal(sessionReads,1);
 await window.fetch('/api/green',{headers:{Authorization:'Bearer explicit','Content-Type':'application/json'},method:'POST',body:'{}'});assert.equal(calls.at(-1).init.headers.get('Authorization'),'Bearer explicit');assert.equal(calls.at(-1).init.body,'{}');
 token=null;await window.fetch('/api/green');assert.equal(calls.at(-1).init.headers.has('Authorization'),false,'A signed-out browser must not reuse a previous token');
 token='current';await window.TPFAPIAuth.download('/api/green?action=download&chatId=synthetic','audit.pdf');assert.equal(calls.at(-1).init.headers.get('Authorization'),'Bearer current');assert(!calls.at(-1).input.includes(token));assert.equal(downloads[0].name,'audit.pdf');assert(downloads[0].url.startsWith('blob:'));timers.forEach(fn=>fn());
 await assert.rejects(window.TPFAPIAuth.download('https://other.test/file','audit.pdf'),/no válida/);
 console.log('PASS client authorization: same-origin requests, explicit headers, logout and protected blob downloads');
})().catch(error=>{console.error(error);process.exitCode=1});
