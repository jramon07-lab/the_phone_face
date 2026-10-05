'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const edge=fs.readFileSync('supabase/functions/crm-green-webhook/index.ts','utf8');
const code=edge.slice(edge.indexOf('function token('));
let handler,marks=[],marker=0,failures=[],auth=true;
const sb={
 async rpc(name,args){
  if(name==='crm_check_runner_secret')return {data:auth,error:null};
  assert.equal(name,'crm_whatsapp_mark_internal_read');
  marks.push(args);marker=Math.max(marker,args.p_ts);return {data:marker,error:null};
 },
 from(){throw Error('A manual response must not modify customers, inbox state or automation jobs');}
};
const context={sb,Deno:{serve(fn){handler=fn;}},reply:(body,status=200)=>({body,status}),GREEN_PROXY:'https://example.invalid',Response,Date,recordFailure:async(...x)=>failures.push(x)};
vm.createContext(context);vm.runInContext(stripTypeScriptTypes(code),context);
// Existing recordFailure would persist incidents. Replace it for isolated fixtures.
context.recordFailure=async(...x)=>failures.push(x);
const event=(ts,type='outgoingMessageReceived',chat='client@c.us')=>({typeWebhook:type,timestamp:ts,idMessage:'test',senderData:{chatId:chat}});
const request=body=>({method:'POST',headers:new Headers({authorization:'Bearer '+'x'.repeat(64)}),json:async()=>body});
(async()=>{
 let r=await handler(request(event(200)));
 assert.equal(r.body.readSynced,true);assert.equal(marker,199);assert.equal(marks.length,1);
 const incoming=[100,150,200,210];
 assert.deepEqual(incoming.filter(ts=>ts>marker),[200,210],'Later and ambiguous same-second incoming messages stay unread');
 await handler(request(event(200)));await handler(request(event(150)));
 assert.equal(marker,199,'Duplicate and delayed notifications cannot rewind the read marker');
 const before=marks.length;
 for(const body of [event(300,'outgoingAPIMessageReceived'),event(300,'outgoingMessageStatus'),event(300,'outgoingMessageReceived','group@g.us'),event(0),event('bad')]){
  r=await handler(request(body));assert.equal(r.body.ignored,true);
 }
 assert.equal(marks.length,before,'Automatic sends, delivery receipts, groups and invalid timestamps do not clear unread');
 auth=false;r=await handler(request(event(400)));assert.equal(r.status,401);assert.equal(marks.length,before);
 assert.equal(failures.length,0);
 console.log('PASS authenticated phone reply read sync; no automated send handling; delayed events and new incoming protected');
})().catch(error=>{console.error(error);process.exitCode=1;});
