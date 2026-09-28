const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
const code=source.slice(source.indexOf('async function loadWhatsAppLive(){'),source.indexOf('\nfunction renderWhatsAppChats(){'));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
async function run(reverse=false,failSummary=false){
 const state=deferred(),summary=deferred(),nodes={waLiveStatus:{dataset:{}},waLiveChats:{innerHTML:'existing'}};
 let draws=0,polls=0;const ctx={waLiveState:{loading:false,chats:[{id:'existing'}]},$:id=>nodes[id],esc:String,waApi:action=>action==='state'?state.promise:action==='summary'?summary.promise:Promise.resolve(),waApplySummaryChats(rows){ctx.waLiveState.chats=rows},renderWhatsAppChats(){draws++},startWaPolling(){polls++},waSharedSyncStatus(ok){nodes.waLiveStatus.dataset.syncDelayed=ok?'0':'1'}};
 vm.createContext(ctx);vm.runInContext(code,ctx);const load=ctx.loadWhatsAppLive();
 if(reverse){summary.resolve({chats:[{id:'loaded'}]});await new Promise(setImmediate);assert.equal(draws,1,'Conversation list need not await connection check');state.resolve({state:'authorized'})}
 else{state.resolve({state:'authorized'});await new Promise(setImmediate);assert.equal(nodes.waLiveStatus.textContent,'Conectado','Connection visible while summary is still pending');assert.equal(draws,0);if(failSummary)summary.reject(new Error('timeout'));else summary.resolve({chats:[{id:'loaded'}]})}
 await load;assert.equal(ctx.waLiveState.loading,false);assert.equal(polls,1);if(failSummary){assert.equal(nodes.waLiveChats.innerHTML,'existing');assert.equal(ctx.waLiveState.chats[0].id,'existing')}
}
(async()=>{await run();await run(true);await run(false,true);console.log('PASS connection/list independent in either order; failed refresh preserves existing conversations');})().catch(e=>{console.error(e);process.exitCode=1});
