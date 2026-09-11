const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('js/modules/dashboard-performance-guard.js','utf8');
const start=source.indexOf('function completeSnapshot(');
const end=source.indexOf('\nasync function fetchData',start);
assert.ok(start>=0&&end>start,'dashboard snapshot validator must exist');
const completeSnapshot=vm.runInNewContext(`(${source.slice(start,end)})`);

const valid=[
  {data:[{id:'opp'}]},
  {data:[{id:'stage'}]},
  {data:[{id:'task'}]},
  {count:1265},
  {data:[{id:'activity-new'}]},
  {data:{target_amount:100}}
];
const snapshot=completeSnapshot(valid,{today:'2026-09-11',month:'2026-09',monthStart:'2026-09-01'},null);
assert.equal(snapshot.contacts,1265);
assert.equal(snapshot.opps[0].id,'opp');
assert.equal(snapshot.activity[0].id,'activity-new');

const partial=valid.map(row=>({...row}));
partial[2]={data:[],error:{message:'Tiempo de espera agotado'}};
assert.throws(
  ()=>completeSnapshot(partial,{today:'2026-09-11'},snapshot),
  /conserva los últimos datos completos.*tareas/,
  'a partial critical response must never replace the current dashboard snapshot'
);

const optional=valid.map(row=>({...row}));
optional[4]={data:[],error:{message:'Auditoría no disponible'}};
optional[5]={data:null,error:{message:'Objetivo no disponible'}};
const preserved=completeSnapshot(optional,{today:'2026-09-11'},snapshot);
assert.equal(preserved.activity[0].id,'activity-new');
assert.equal(preserved.goal.target_amount,100);
assert.equal(preserved.warnings.length,2);

assert.match(source,/const next=await fetchData\(\);D\.data=next;render\(\)/,'the completed snapshot must be assigned atomically');
assert.match(source,/if\(!D\.data&&\$\('dashAlerts'\)\)/,'a refresh failure must preserve an existing rendered snapshot');

console.log('Dashboard navigation consistency regression checks passed');
