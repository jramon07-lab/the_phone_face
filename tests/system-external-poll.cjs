const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/modules/system-status.js','utf8');
const code=source.slice(source.indexOf('async function syncExternal(){'),source.indexOf("document.addEventListener('visibilitychange'"));
const sha='a'.repeat(40);
async function scenario(result){
 let out={},polls=0,calls=0;
 const context={currentCommit:()=>sha,external:()=>out,saveExternal:x=>out=x,render(){},location:{pathname:'/',host:'crm.test'},fetch:async(url)=>{calls++;return url==='/'?{headers:{get:()=>sha}}:{ok:result!==null,json:async()=>({workflow_runs:result})};},AbortSignal,console:{warn(){}},externalSync:null,pollExternal:()=>polls++};
 vm.createContext(context);vm.runInContext(code,context);
 await Promise.all([context.syncExternal(),context.syncExternal()]);assert.equal(calls,2,'Concurrent checks must share one HEAD and one GitHub query');assert.equal(polls,1);return out;
}
(async()=>{
 const run=(name,status,conclusion,head=sha)=>({name,status,conclusion,head_sha:head});
 let out=await scenario([run('CRM modules check','in_progress',null),run('CRM Browser Validation','in_progress',null)]);assert.equal(out.ci.state,'pending');assert.equal(out.e2e.state,'pending');
 out=await scenario([run('CRM modules check','completed','success'),run('CRM Browser Validation','completed','success')]);assert.equal(out.ci.state,'ok');assert.equal(out.e2e.state,'ok');
 out=await scenario([run('CRM modules check','completed','failure','b'.repeat(40))]);assert.equal(out.ci.state,'info','Results from another commit cannot certify this version');
 out=await scenario(null);assert.equal(out.ci.state,'info','Unavailable external check must not claim it is still running');
 out=await scenario([run('CRM modules check','completed','failure'),run('CRM Browser Validation','completed','cancelled')]);assert.equal(out.ci.state,'bad');assert.equal(out.e2e.state,'info');
 const start=source.indexOf('function pollExternal(){'),end=source.indexOf('\nfunction currentCommit',start),timers=[];
 const c={clearTimeout(){},externalPoll:0,document:{hidden:false},externalState:()=> 'pending',setTimeout:(fn,ms)=>{timers.push({fn,ms});return 1;},syncExternal:()=>polls++};let polls=0;
 vm.createContext(c);vm.runInContext(source.slice(start,end),c);c.pollExternal();assert.equal(timers[0].ms,15000);timers[0].fn();assert.equal(polls,1);c.document.hidden=true;timers[0].fn();assert.equal(polls,1);
 console.log('PASS external checks: pending-to-success, SHA scope, failures, no duplicate queries and visibility-aware polling');
})().catch(e=>{console.error(e);process.exitCode=1});
