const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/modules/system-monitoring.js','utf8');
const fn=source.slice(source.indexOf('async function resolveRecoveredRequest'),source.indexOf('function readLocalErrors'));
async function run(overrides={},local=[]){
 const calls=[],base={id:1,status:'active',source:'desktop',severity:'error',message:'/api/green-status',route:'/',app_version:'build',device:'PC',last_seen_at:'2026-09-05T12:00:00Z'};
 const context={recoveryChecks:new Map(),isAdmin:()=>true,isTestRuntime:()=>false,version:()=> 'build',device:()=> 'PC',readLocalErrors:()=>local,$:()=>null,setTimeout:()=>{},loadAll:()=>{},sb:{rpc:async(name,args)=>{calls.push({name,args});return {data:[{...base,...overrides}]};}}};
 vm.createContext(context);vm.runInContext(fn+';this.recover=resolveRecoveredRequest',context);
 const event={url:base.message,route:'/',recoveredAt:'2026-09-05T12:01:00Z'};
 await context.recover(event);await context.recover(event);
 assert.equal(calls.filter(c=>c.name==='crm_list_system_events').length,1);
 return calls.filter(c=>c.name==='crm_set_system_event_status');
}
(async()=>{
 assert.equal((await run()).length,1);
 for(const change of [{severity:'critical'},{app_version:'older'},{device:'mobile'},{route:'/other'},{last_seen_at:'2026-09-05T12:02:00Z'},{message:'/other'}])assert.equal((await run(change)).length,0);
 assert.equal((await run({},[{message:'/api/green-status',type:'Red'}])).length,0);
 assert(source.includes("setStatus(target.dataset.systemResolve,'ignored')"));
 console.log('PASS: recovery scope, throttling, new failures and manual review');
})().catch(e=>{console.error(e);process.exitCode=1});
