const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
const start=source.indexOf('async function waApi('),end=source.indexOf('function waApplySummaryChats',start);
async function check(action,stall,ms){
 let expire,cleared=false,requestSignal;
 const context={AbortController,
  setTimeout(fn,delay){assert.equal(delay,ms);expire=fn;return 1},clearTimeout(){cleared=true},
  fetch:async(_url,opts)=>{requestSignal=opts.signal;return {
   ok:true,status:200,json:()=>stall?new Promise((resolve,reject)=>{
    requestSignal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});
   }):Promise.resolve({ok:true,urlAvatar:'photo'})
  }}
 };
 vm.createContext(context);vm.runInContext(source.slice(start,end)+';this.read=waApi;',context);
 const pending=context.read(action,{});
 await new Promise(setImmediate);
 if(stall){assert.equal(cleared,false);expire();await assert.rejects(pending,{name:"AbortError"});assert.equal(requestSignal.aborted,true)}
 else {await pending;assert.equal(!!requestSignal,!!ms)}
 assert.equal(cleared,!!ms);
}
(async()=>{
 await check('avatar',true,8000);await check('avatar',false,8000);
 await check('history',false,20000);await check('send',false,0);
 console.log('PASS: optional avatar body bounded, normal photos/history preserved, sends not aborted');
})().catch(e=>{console.error(e);process.exitCode=1});
