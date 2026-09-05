const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/modules/connection-recovery.js','utf8');
function app(sequence,options={}){
 let calls=0;const events=new EventTarget();
 const context={URL,DOMException,Date,Map,Promise,navigator:{onLine:true},location:{href:'https://preview.example/',origin:'https://preview.example'},document:{body:null,addEventListener(){}},setTimeout:options.timer||((fn)=>setTimeout(fn,0)),clearTimeout,window:{fetch:async()=>{calls++;const value=sequence.shift();if(value instanceof Error)throw value;return value;},addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)}};
 vm.createContext(context);vm.runInContext(source,context);
 return {fetch:context.window.fetch,safe:context.window.TPFConnectionRecovery.safeRead,calls:()=>calls,context};
}
const response=(status,delay=null)=>({status,headers:{get:()=>delay}});
(async()=>{
 const ok=response(200),url='/api/green?action=chats';
 let a=app([new TypeError('Failed to fetch'),ok]);assert.equal(await a.fetch(url),ok);assert.equal(a.calls(),2);
 for(const target of ['/api/green?action=send','/api/green?action=notifications','https://other.example/data','https://overfzbjtpjqxzbujezg.supabase.co/rest/v1/rpc/run_sales'])assert.equal(a.safe(target),false);
 assert.equal(a.safe('https://overfzbjtpjqxzbujezg.supabase.co/rest/v1/agenda_items?select=*'),true);
 for(const status of [400,401,403,404,500]){a=app([response(status),ok]);assert.equal((await a.fetch(url)).status,status);assert.equal(a.calls(),1);}
 a=app([new TypeError('Failed'),ok]);await assert.rejects(a.fetch(url,{method:'POST'}));assert.equal(a.calls(),1);
 a=app([response(429,'60'),ok]);assert.equal((await a.fetch(url)).status,429);assert.equal(a.calls(),1);
 a=app([response(503),ok,response(503),ok]);assert.equal(await a.fetch(url),ok);assert.equal((await a.fetch(url)).status,503);assert.equal(a.calls(),3);
 a=app([new TypeError('first'),new TypeError('second')]);await assert.rejects(a.fetch(url),/second/);assert.equal(a.calls(),2);
 const controller=new AbortController();a=app([response(503),ok],{timer:fn=>setTimeout(()=>{controller.abort();fn();},0)});await assert.rejects(a.fetch(url,{signal:controller.signal}),e=>e.name==='AbortError');assert.equal(a.calls(),1);
 a=app([new DOMException('timeout','TimeoutError'),ok]);await assert.rejects(a.fetch(url));assert.equal(a.calls(),1);
 console.log('PASS: safe reads, write exclusions, authentication, Retry-After, cooldown, persistent failure and cancellation');
})().catch(e=>{console.error(e);process.exitCode=1});
