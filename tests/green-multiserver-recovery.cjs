'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('api/green.js','utf8').replace('export default async function handler','async function handler')+';this.handle=handler;';
function server(provider,clock){
  class TestDate extends Date{static now(){return clock.now;}}
  const waits=[];
  const context={require:()=>({authorize:async()=>true}),Date:TestDate,Math,URLSearchParams,AbortController,Buffer,Blob,FormData,escape,console:{error(){}},process:{env:{GREEN_API_INSTANCE_ID:'test-instance',GREEN_API_TOKEN:'test-token',GREEN_API_API_URL:'https://provider.test'}},fetch:async(url,opts)=>{const r=await provider(String(url),opts);return {ok:r.status===200,status:r.status,statusText:'limit',headers:{get:()=>r.retryAfter||null},text:async()=>JSON.stringify(r.body)}},setTimeout(fn,ms){if(ms===12000)return 1;waits.push(ms);clock.now+=ms;queueMicrotask(fn);return 1;},clearTimeout(){}};
  vm.createContext(context);vm.runInContext(source,context);return {handle:context.handle,waits};
}
async function call(s,action,body={}){const res={setHeader(){},status(){return this},json(value){this.body=value;return this}};await s.handle({method:['summary','chats'].includes(action)?'GET':'POST',query:{action},body},res);return res.body;}
(async()=>{
  const clock={now:100000},used=new Map(),calls=[];
  const provider=async url=>{
    const method=url.split('/')[4];calls.push(method);
    if(['lastIncomingMessages','lastOutgoingMessages','getChatHistory'].includes(method)){
      if(clock.now-(used.get(method)||0)<1000)return {status:429,body:{message:'Too Many Requests'}};
      used.set(method,clock.now);
    }
    const body=method==='getChats'?[{id:'chat',unreadCount:2}]:method==='lastOutgoingMessages'?[]:[{chatId:'chat',idMessage:'one',timestamp:20,textMessage:'Sintético'}];
    return {status:200,body};
  };
  const a=server(provider,clock),b=server(provider,clock);
  const first=await call(a,'summary');const second=await call(b,'summary');
  assert.equal(first.degraded,undefined);assert.equal(second.degraded,undefined,'Un servidor sin caché debe recuperarse del límite de un segundo');
  assert.equal(JSON.stringify(first.chats),JSON.stringify(second.chats));assert.ok(b.waits.some(ms=>ms>=1100));
  used.set('getChatHistory',clock.now);const history=await call(b,'history',{chatId:'chat'});assert.equal(history.messages[0].idMessage,'one');
  let count=0;const failed=server(async()=>{count++;return {status:429,body:{message:'limited'},retryAfter:'60'};},clock);
  const result=await call(failed,'history',{chatId:'chat'});assert.equal(result.degraded,true);assert.equal(count,1,'Respeta un Retry-After largo sin repetir antes de plazo');
  count=0;const persistent=server(async()=>{count++;return {status:429,body:{message:'limited'}};},clock);
  assert.equal((await call(persistent,'chats')).degraded,true);assert.equal(count,3,'Un límite persistente se detiene tras tres intentos');
  count=0;const sending=server(async()=>{count++;return {status:429,body:{message:'limited'}};},clock);
  await call(sending,'send',{chatId:'chat',message:'No se envía realmente'});assert.equal(count,1,'Nunca reintenta un envío');
  console.log('Dos servidores independientes recuperan resumen e historial tras 429; Retry-After y envío único respetados');
})().catch(error=>{console.error(error);process.exitCode=1;});
