const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
const from=source.indexOf('let waSharedSyncTimer='),to=source.indexOf('\nasync function loadWhatsAppLive()',from);
assert.ok(from>0&&to>from);
const timers=[],listeners={},calls=[];
let finishSummary;
const context={
  waLiveState:{selected:{id:'A'},poll:1,loading:false,pollBusy:true},
  waPollBackoffUntil:Infinity,waOwnRuntimeLease:()=>false,
  document:{hidden:false,addEventListener(name,fn){listeners[name]=fn;}},
  window:{addEventListener(name,fn){listeners[name]=fn;}},
  $:()=>({classList:{contains:()=>false},dataset:{}}),
  waRefreshHybridSummary(){calls.push(['summary']);return new Promise(r=>finishSummary=r);},
  setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){},Date
};
vm.createContext(context);vm.runInContext(source.slice(from,to),context);
(async()=>{
  const syncing=context.waSyncSharedView();
  assert.deepEqual(calls,[['summary']],'Un poll ocupado, sin lease y con backoff no bloquea el resumen compartido');
  await context.waSyncSharedView();assert.equal(calls.length,1,'No duplica lecturas si ya está sincronizando');
  finishSummary(true);await syncing;
  assert.equal(timers.at(-1).ms,15000);
  context.document.hidden=true;await context.waSyncSharedView();assert.equal(calls.length,1);
  context.document.hidden=false;listeners.online();assert.equal(calls.length,2,'Reconectar consulta sin esperar otro aviso');
  finishSummary(false);await new Promise(r=>setImmediate(r));
  assert.equal(timers.at(-1).ms,15000,'Un fallo no detiene la siguiente sincronización');
  for(let cycle=0;cycle<240;cycle++){
    const next=timers.at(-1).fn();finishSummary(true);await next;
  }
  assert.equal(calls.length,242,'Una hora de ciclos simulados sigue leyendo el resumen sin reconstruir el historial');
  assert.doesNotMatch(source.slice(from,to),/waApi\(['"](?:send|sendfile|read|notifications)/);
  console.log('Shared counters refresh independently without rebuilding selected history');
})().catch(error=>{console.error(error);process.exitCode=1;});
