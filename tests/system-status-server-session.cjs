const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/system-status-core.js','utf8');
const start=source.indexOf('window.loadSystemStatus=async function()');
const fn=source.slice(start,source.indexOf("\n  document.addEventListener('click'",start));
async function run(result){
 const banner={},calls=[],events=[],states={};
 const context={window:{dispatchEvent:e=>events.push(e.detail)},perms:{is_admin:true},document:{getElementById:id=>id==='systemBanner'?banner:null},location:{pathname:'/'},setState:(dot,text,state)=>{states[text]=state},originalFetch:async()=>({ok:true,json:async()=>({providerHealthy:true,degraded:false,state:'authorized'})}),sb:{rpc:async name=>{calls.push(name);return result},auth:{getSession:async()=>({data:{session:{access_token:'synthetic-cached-session'}}})}},readErrors:()=>[],renderSystemErrors(){},CustomEvent:class{constructor(type,data){this.detail=data.detail}}};
 vm.createContext(context);vm.runInContext(fn,context);await context.window.loadSystemStatus();return {banner,calls,events,states};
}
(async()=>{
 const good=await run({data:{user_id:'synthetic-user'},error:null});
 assert.deepEqual(good.calls,['current_user_permissions'],'Health must contact the database instead of trusting a cached session');
 assert.equal(good.states.systemSupabaseText,'ok');assert.equal(good.events[0].overall,'ok');
 assert.doesNotMatch(good.banner.textContent,/Todo operativo/i,'Basic probes must not certify all CRM integrations');
 for(const result of [{data:null,error:{message:'Session expired'}},{data:null,error:null},{data:{},error:null}]){
  const denied=await run(result);assert.equal(denied.states.systemSupabaseText,'bad');assert.equal(denied.events[0].overall,'bad');
 }
 console.log('PASS system status: live server permission check, expired/missing session and scoped health result');
})().catch(e=>{console.error(e);process.exitCode=1});
