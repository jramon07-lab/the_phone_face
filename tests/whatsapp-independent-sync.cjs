const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
const from=source.indexOf('let waSharedSyncTimer='),to=source.indexOf('\nasync function loadWhatsAppLive()',from);
assert.ok(from>0&&to>from);
const timers=[],listeners={},calls=[],historyCalls=[];
let finishSummary,finishHistory,holdHistory=false,historyResult=true,viewHidden=false;
const status={classList:{contains:()=>false},dataset:{}};
const context={
  waLiveState:{selected:{id:'A'},poll:1,loading:false,pollBusy:true},
  waPollBackoffUntil:Infinity,waOwnRuntimeLease:()=>false,
  document:{hidden:false,addEventListener(name,fn){listeners[name]=fn;}},
  window:{addEventListener(name,fn){listeners[name]=fn;},loadWaHistory(scroll){
    historyCalls.push({chat:context.waLiveState.selected.id,scroll});
    return holdHistory?new Promise(r=>finishHistory=r):Promise.resolve(historyResult);
  }},
  $:id=>id==='waLiveStatus'?status:{classList:{contains:()=>viewHidden},dataset:{}},
  waRefreshHybridSummary(){calls.push(['summary']);return new Promise(r=>finishSummary=r);},
  setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){},Date
};
vm.createContext(context);vm.runInContext(source.slice(from,to),context);
(async()=>{
  const syncing=context.waSyncSharedView();
  assert.deepEqual(calls,[['summary']],'Un poll ocupado, sin lease y con backoff no bloquea el resumen compartido');
  await context.waSyncSharedView();assert.equal(calls.length,1,'No duplica lecturas si ya está sincronizando');
  finishSummary(true);await syncing;
  assert.deepEqual(historyCalls,[{chat:'A',scroll:false}],'La conversación abierta se actualiza sin avisos ni salto de scroll');
  assert.equal(timers.at(-1).ms,15000);
  context.document.hidden=true;await context.waSyncSharedView();assert.equal(calls.length,1);
  context.document.hidden=false;listeners.online();assert.equal(calls.length,2,'Reconectar consulta sin esperar otro aviso');
  finishSummary(false);await new Promise(r=>setImmediate(r));
  assert.equal(historyCalls.length,1,'No carga historial tras fallar el resumen');
  assert.equal(status.dataset.syncDelayed,'1');
  assert.equal(timers.at(-1).ms,15000,'Un fallo no detiene la siguiente sincronización');
  for(let cycle=0;cycle<240;cycle++){
    const next=timers.at(-1).fn();finishSummary(true);await next;
  }
  assert.equal(calls.length,242,'Una hora de ciclos simulados sigue leyendo el resumen');
  assert.equal(historyCalls.length,241,'Una sola conversación por ciclo, aunque no cambie el resumen');
  holdHistory=true;
  const held=context.waSyncSharedView();finishSummary(true);await new Promise(r=>setImmediate(r));
  const before=calls.length;
  listeners.online();listeners.focus();await context.waSyncSharedView();
  assert.equal(calls.length,before,'Un historial lento no permite solapar ciclos');
  finishHistory(true);await held;holdHistory=false;
  const switching=context.waSyncSharedView();context.waLiveState.selected={id:'B'};context.waLiveState.selectionVersion=1;
  const historyBefore=historyCalls.length;finishSummary(true);await switching;
  assert.equal(historyCalls.length,historyBefore,'El resumen atrasado de A no carga ni toca B');
  historyResult=false;
  const failed=context.waSyncSharedView();finishSummary(true);await failed;
  assert.equal(status.dataset.syncDelayed,'1','El fallo de historial no se anuncia como sincronizado');
  historyResult=true;listeners.online();finishSummary(true);await new Promise(r=>setImmediate(r));
  assert.equal(historyCalls.at(-1).chat,'B','Reconectar reintenta el historial del chat actual');
  context.waLiveState.selected=null;
  const empty=context.waSyncSharedView();finishSummary(true);await empty;
  assert.equal(historyCalls.at(-1).chat,'B','Sin selección no se carga ningún historial');
  viewHidden=true;const last=calls.length;await context.waSyncSharedView();assert.equal(calls.length,last);
  assert.doesNotMatch(source.slice(from,to),/waApi\(['"](?:send|sendfile|read|notifications)/);
  console.log('Shared summary and selected history refresh without notifications, overlap or stale selection');
})().catch(error=>{console.error(error);process.exitCode=1;});
