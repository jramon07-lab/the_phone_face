const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const auth=require('../lib/crm-api-auth');
function response(){return {code:200,setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}}}
(async()=>{
 const original=global.fetch;let calls=0;
 try{
  global.fetch=async()=>{calls++;throw Error('Unexpected call')};
  let res=response();assert.equal(await auth.authorize({headers:{}},res),false);assert.equal(res.code,401);assert.equal(calls,0);
  for(const [status,p,expected] of [[401,null,401],[200,null,403],[200,{user_id:'test',can_use_whatsapp:false},403],[200,{user_id:'test',can_use_whatsapp:true},200],[200,{user_id:'test',is_admin:true},200],[503,null,503]]){
   global.fetch=async()=>({status,ok:status===200,json:async()=>p});res=response();
   assert.equal(await auth.authorize({headers:{authorization:'Bearer synthetic-session'}},res),expected===200);assert.equal(res.code,expected);
  }
  global.fetch=async()=>{throw Error('Network failed')};res=response();assert.equal(await auth.authorize({headers:{authorization:'Bearer synthetic-session'}},res),false);assert.equal(res.code,503);
  for(const name of ['green','green-reply','green-file-safe','green-status','green-read-safe','green-enable-status','telegram']){
   let providerCalls=0;const source=fs.readFileSync('api/'+name+'.js','utf8').replace('export default async function handler','async function handler')+';this.handler=handler;';
   const ctx=vm.createContext({require:()=>auth,process:{env:{GREEN_API_INSTANCE_ID:'test',GREEN_API_TOKEN:'test',TELEGRAM_BOT_TOKEN:'test'}},fetch:async()=>{providerCalls++;throw Error('No provider access without session')},console:{error(){}},setTimeout,clearTimeout,AbortController,URLSearchParams,Buffer});
   vm.runInContext(source,ctx);res=response();
   await ctx.handler({method:name==='green'?'GET':'POST',query:{action:name==='green'?'summary':'send'},headers:{},body:{}},res);
   assert.equal(res.code,401,name+' must require a CRM session before processing');assert.equal(providerCalls,0,name+' must not contact the provider anonymously');
  }
 }finally{global.fetch=original}
 console.log('PASS CRM API authorization: missing/expired session, denied permission, outage, allowed user/admin, all provider endpoints');
})().catch(error=>{console.error(error);process.exitCode=1});
