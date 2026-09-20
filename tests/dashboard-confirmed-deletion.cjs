const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const timers=[],source=fs.readFileSync('js/modules/dashboard-performance-guard.js','utf8');
const sandbox={window:{TPFModules:{register(){}}},document:{getElementById:id=>['app','view-dashboard'].includes(id)?{classList:{contains:()=>false}}:null},console,Intl,Date,Map,setTimeout:fn=>timers.push(fn),clearTimeout(){},setInterval(){}};
vm.runInNewContext(source.replace("M.register('dashboard-performance-guard'","window.testDeletion={D,removeConfirmed,load,configure:(fetcher,renderer)=>{fetchData=fetcher;render=renderer;build=()=>{}}};M.register('dashboard-performance-guard'"),sandbox);
(async()=>{
 const api=sandbox.window.testDeletion;let finish,renders=0;
 api.D.data={opps:[{id:'delete'},{id:'keep'}],tasks:[{id:'task'}]};
 api.configure(()=>new Promise(r=>finish=r),()=>renders++);
 const loading=api.load();
 api.removeConfirmed('opportunity','delete');
 assert.equal(api.D.data.opps.length,1);assert.equal(api.D.data.opps[0].id,'keep');assert.equal(renders,1,'Confirmed row must disappear before refresh finishes');
 finish({opps:[{id:'delete'},{id:'keep'}],tasks:[{id:'task'}]});await loading;
 assert.equal(api.D.data.opps.length,1,'Late dashboard read restored deletion');
 assert.equal(timers.length,1,'Only one follow-up load should be queued');
 api.removeConfirmed('task','task');assert.equal(api.D.data.tasks.length,0);
 // Execute the real public delete handler: cancel/error must not refresh/remove.
 const main=fs.readFileSync('js/core/20-main.js','utf8');const handler=main.slice(main.indexOf('window.deleteOpp=async(id)=>{'),main.indexOf('\nwindow.editOpp='));
 let accepted=false,removed=0,refreshed=0,fail=false;
 const ctx={window:{},confirm:()=>accepted,deleteOpportunityVerified:async()=>{if(fail)throw Error('Denied');removed++},renderSales(){},loadSales:async()=>refreshed++,Promise,console,alert(){}};
 vm.runInNewContext(handler,ctx);
 assert.equal(await ctx.window.deleteOpp('id'),false);assert.equal(removed,0);
 accepted=true;fail=true;assert.equal(await ctx.window.deleteOpp('id'),false);assert.equal(refreshed,0);
 fail=false;assert.equal(await ctx.window.deleteOpp('id'),true);assert.equal(removed,1);assert.equal(refreshed,1);
 console.log('PASS: confirmed deletion renders immediately, stale reads cannot resurrect, cancelled/failed deletes preserve rows');
})().catch(e=>{console.error(e);process.exitCode=1});
