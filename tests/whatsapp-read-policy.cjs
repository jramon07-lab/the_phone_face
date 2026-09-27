const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const mark=require('../lib/green-manual-read');
(async()=>{
 let calls=0;global.fetch=async()=>{calls++;return {ok:true,json:async()=>({setRead:true})}};
 const args={chatId:'example@c.us',base:'https://example.invalid',id:'test',token:'test',data:{idMessage:'accepted'}};
 await mark(args);await mark({...args,manualReply:false});await mark({...args,manualReply:true,data:{}});assert.equal(calls,0);
 assert.equal((await mark({...args,manualReply:true})).setRead,true);assert.equal(calls,1);
 global.fetch=async()=>{throw Error('network')};assert.equal((await mark({...args,manualReply:true})).setRead,false);
 let invoked=[];const context={window:{waApi:async action=>{invoked.push(action);return {ok:true}},TPFModules:{register:(_,m)=>m.install()}},setInterval,clearInterval};
 vm.runInNewContext(fs.readFileSync('js/modules/whatsapp-read-guard.js','utf8'),context);
 assert.equal((await context.window.waApi('read',{})).localOnly,true);assert.equal(invoked.length,0);
 await context.window.waApi('send',{});await context.window.waApi('notifications',{});assert.deepEqual(invoked,['send','notifications']);
 for(const filename of ['green-read-safe.js','green.js','green-reply.js']){
  let reads=0;
  const source=fs.readFileSync('api/'+filename,'utf8').replace('export default async function handler','async function handler');
  const ctx={process:{env:{GREEN_API_INSTANCE_ID:'test',GREEN_API_TOKEN:'test',VERCEL_ENV:'production'}},require:p=>p.includes('crm-api-auth')?{authorize:async()=>true}:async o=>{if(o.manualReply===true&&o.data?.idMessage)reads++},fetch:async()=>({ok:true,text:async()=>JSON.stringify({idMessage:'sent'}),json:async()=>({})}),console,Buffer,FormData,Blob,AbortController,AbortSignal,setTimeout,clearTimeout,URL};
  vm.createContext(ctx);vm.runInContext(source+'\nthis.handler=handler;',ctx);
  const request=async(action,body)=>{let result;await ctx.handler({method:'POST',headers:{},query:{action},body},{setHeader(){},status(){return this},json(x){result=x;return x}});return result};
  if(filename==='green.js'){
   assert.equal((await request('read',{chatId:'34600000000'})).localOnly,true);assert.equal(reads,0);
   await request('send',{chatId:'34600000000',message:'auto'});assert.equal(reads,0);
   await request('send',{chatId:'34600000000',message:'manual',manualReply:true});assert.equal(reads,1);
   ctx.fetch=async()=>({ok:false,status:500,text:async()=>'{"error":"failed"}'});
   await request('send',{chatId:'34600000000',message:'failed',manualReply:true});assert.equal(reads,1);
  }else if(filename==='green-read-safe.js'){assert.equal((await request('read',{})).localOnly,true);assert.equal(reads,0)}
  else{await request('',{chatId:'34600000000',message:'manual',quotedMessageId:'quote'});assert.equal(reads,1)}
 }
 console.log('PASS: private open, manual receipt, automatic private, failures safe, quoted reply, outgoing notifications preserved');
})();
