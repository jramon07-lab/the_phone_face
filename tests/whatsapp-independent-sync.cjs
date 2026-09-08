const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
const from=source.indexOf('let waSharedSyncTimer='),to=source.indexOf('\nasync function loadWhatsAppLive()',from);
assert.ok(from>0&&to>from);
const timers=[],listeners={},calls=[];
let finishSummary,finishHistory;
const context={
  waLiveState:{selected:{id:'A'},poll:1,loading:false,pollBusy:true},
  waPollBackoffUntil:Infinity,waOwnRuntimeLease:()=>false,
  document:{hidden:false,addEventListener(name,fn){listeners[name]=fn;}},
  window:{addEventListener(name,fn){listeners[name]=fn;},loadWaHistory(scroll){calls.push(['history',scroll]);return new Promise(r=>finishHistory=r);}},
  $:()=>({classList:{contains:()=>false},dataset:{}}),
  waRefreshHybridSummary(){calls.push(['summary']);return new Promise(r=>finishSummary=r);},
  setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){},Date
};
vm.createContext(context);vm.runInContext(source.slice(from,to),context);
(async()=>{
  const syncing=context.waSyncSharedView();
  assert.deepEqual(calls,[['summary'],['history',false]],'Un poll ocupado, sin lease y con backoff no bloquea las lecturas compartidas');
  await context.waSyncSharedView();assert.equal(calls.length,2,'No duplica lecturas si ya está sincronizando');
  finishSummary(true);finishHistory();await syncing;
  assert.equal(timers.at(-1).ms,15000);
  context.document.hidden=true;await context.waSyncSharedView();assert.equal(calls.length,2);
  context.document.hidden=false;listeners.online();assert.equal(calls.length,4,'Reconectar consulta sin esperar otro aviso');
  finishSummary(false);finishHistory();await new Promise(r=>setImmediate(r));
  assert.equal(timers.at(-1).ms,15000,'Un fallo no detiene la siguiente sincronización');
  for(let cycle=0;cycle<240;cycle++){
    const next=timers.at(-1).fn();finishSummary(true);finishHistory();await next;
  }
  assert.equal(calls.length,484,'Una hora de ciclos simulados sigue leyendo ambos recursos con la cola bloqueada');
  assert.doesNotMatch(source.slice(from,to),/waApi\(['"](?:send|sendfile|read|notifications)/);
  console.log('Shared history and counters refresh independently of notification queue, lease and backoff');
})().catch(error=>{console.error(error);process.exitCode=1;});
