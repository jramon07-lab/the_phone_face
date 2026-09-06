const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

async function run(){
  // Execute the actual global wheel listener: profile must keep native scrolling.
  const main=fs.readFileSync('js/core/20-main.js','utf8');
  const start=main.indexOf('document.addEventListener("wheel",');
  const end=main.indexOf('},{passive:false});',start)+'},{passive:false});'.length;
  let wheel,prevented=0,scrolled=0;
  vm.runInNewContext(main.slice(start,end),{document:{addEventListener(type,fn){wheel=fn}},$:()=>({classList:{contains:()=>false}}),window:{scrollBy(){scrolled++}}});
  for(const selector of ['#contactModal','.contactProfileBack','.modalBack','textarea','#salesScroll']){
    wheel({target:{closest:s=>s.split(',').map(x=>x.trim()).includes(selector)},deltaY:120,preventDefault(){prevented++}});
  }
  assert.equal(prevented,0,'Sales wheel handler blocked native profile scrolling');
  assert.equal(scrolled,0,'Sales moved background behind profile');
  wheel({target:{closest:()=>null},deltaY:120,preventDefault(){prevented++}});
  assert.equal(prevented,1);assert.equal(scrolled,1,'Normal sales behavior changed');
  const contacts=[{id:'c1',data:{NOMBRE:'Uno'}},{id:'c2',data:{NOMBRE:'Dos'}}];
  const initial=[
    {id:'o1',record_id:'c1',expected_date:'2026-09-10'},
    {id:'o2',record_id:'c1',expected_date:'2026-10-20'},
    {id:'o3',record_id:'c2',expected_date:'2026-11-01'},
  ];
  let queryRows=initial,board={data:{opportunities:initial}},queries=0;
  const cells=contacts.map(()=>({innerHTML:'',querySelector(){return null}}));
  const rows=contacts.map((r,i)=>({dataset:{contactId:r.id},querySelector(s){return s==='.tpfOppCell'?cells[i]:null}}));
  const timers=[];
  const window=new EventTarget();
  window.TPFModules={register(name,def){def.install()}};
  const context=vm.createContext({window,CustomEvent,console,Array,
    document:{getElementById(){return {}},querySelector(){return null},querySelectorAll(){return rows},addEventListener(){}},
    setTimeout(fn){timers.push(fn)},setInterval(){},
    sb:{from(table){queries++;const q={select(){return q},eq(){return q},then(resolve,reject){return Promise.resolve(table==='records'?{data:contacts}:queryRows).then(v=>resolve(Array.isArray(v)?{data:v}:v),reject)}};return q},rpc:async()=>board},
    salesCache:{},renderSales(){},$:()=>({innerHTML:''}),esc:v=>v,
  });
  vm.runInContext(fs.readFileSync('js/modules/contacts-final-fix.js','utf8'),context);
  const core=fs.readFileSync('js/modules/contacts-sales-core.js','utf8');
  vm.runInContext(core.slice(core.indexOf('async function loadSales(){'),core.indexOf('\nwindow.moveOpp=')),context);
  await timers[0]();
  assert.match(cells[0].innerHTML,/2 oportunidades/);
  assert.match(cells[0].innerHTML,/10\/9\/2026/);
  const unchanged=cells[1].innerHTML;
  let finishOld;
  queryRows=new Promise(resolve=>{finishOld=resolve});
  const oldLoad=timers[0]();
  const before=queries;
  board={data:{opportunities:initial.slice(1)}};
  await context.loadSales();
  assert.match(cells[0].innerHTML,/1 oportunidad/,'Deleted opportunity still counted');
  assert.match(cells[0].innerHTML,/20\/10\/2026/,'Next closing date not refreshed');
  assert.equal(cells[1].innerHTML,unchanged,'Unrelated contact changed');
  assert.equal(queries,before,'Refresh made redundant data queries');
  finishOld(initial);
  await oldLoad;
  assert.match(cells[0].innerHTML,/1 oportunidad/,'Late query restored the deleted opportunity');
  board={error:{message:'Simulated failure'}};
  await context.loadSales();
  assert.match(cells[0].innerHTML,/1 oportunidad/,'Failed refresh cleared the count');
  board={data:{opportunities:[initial[2]]}};
  await context.loadSales();
  assert.equal(cells[0].innerHTML,'<small>Sin oportunidades</small>');
  window.dispatchEvent(new CustomEvent('tpf:contacts-loaded',{detail:{records:[{...contacts[0],data:{NOMBRE:'Uno',TPF_RELACIONES:{managed_contacts:[{record_id:'c2'},{record_id:'c2'}]}}},contacts[1]]}}));
  assert.match(cells[0].innerHTML,/1 oportunidad/,'Managed holder opportunity missing or duplicated');
  assert.match(cells[1].innerHTML,/1 oportunidad/,'Holder lost own opportunity');
  console.log('PASS: deletion count, closing date, unrelated contact, stale query, failed refresh, final deletion');
}
run().catch(e=>{console.error(e);process.exitCode=1});
