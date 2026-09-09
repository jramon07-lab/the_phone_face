'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');

const runner=fs.readFileSync('supabase/functions/crm-automation-runner/index.ts','utf8');
const phone=runner.match(/function phoneToChat[^\n]+/)?.[0];
const start=runner.indexOf('const serviceHeaders=');
const serviceEnd=runner.indexOf('async function greenStateAuthorized');
const guardStart=runner.indexOf('function greenIncoming');
const guardEnd=runner.indexOf('async function enqueueChild');
assert(phone&&start>=0&&serviceEnd>start&&guardStart>=0&&guardEnd>guardStart,'response guard source is present');
const source=stripTypeScriptTypes(`const GREEN_PROXY='https://stable.test/api/green';\n${phone}\n${runner.slice(start,serviceEnd)}${runner.slice(guardStart,guardEnd)}\nglobalThis.guard={hasResponseSince,providerResponsesSince};`);

const inserted=[];
const query={
  eq(){return this},gt(){return this},limit(){return Promise.resolve({data:[],error:null})}
};
const sb={from(table){assert.equal(table,'wa_messages');return {
  select(){return query},
  async insert(row){inserted.push(row);return {error:null}}
}}};
let request;
const context={sb,Date,console,Response,fetch:async(url,options)=>{
  request={url:String(url),options};
  return new Response(JSON.stringify({ok:true,messages:[
    {type:'outgoing',timestamp:1788945003,idMessage:'out-1',textMessage:'Recordatorio'},
    {type:'incoming',timestamp:1788887380,idMessage:'in-1',typeMessage:'buttonsResponseMessage',buttonsResponseMessage:{selectedButtonText:'Acepto'}}
  ]}),{status:200,headers:{'content-type':'application/json'}});
}};
vm.createContext(context);vm.runInContext(source,context);

(async()=>{
  const answered=await context.guard.hasResponseSince({phone:'695 661 409',flow_started_at:'2026-09-07T09:10:00.000Z'},'runner-secret');
  assert.equal(answered,true,'a provider reply stops the follow-up even when wa_messages was stale');
  assert.match(request.url,/action=history/);
  assert.equal(request.options.headers['x-tpf-cron-secret'],'runner-secret');
  assert.equal(JSON.parse(request.options.body).count,200);
  assert.equal(inserted.length,1);
  assert.equal(inserted[0].direction,'in');
  assert.equal(inserted[0].text_content,'Acepto');
  assert.equal(inserted[0].created_at,'2026-09-08T17:09:40.000Z');
  console.log('Provider history reply is synchronized and blocks the pending follow-up.');
})().catch(error=>{console.error(error);process.exitCode=1});
