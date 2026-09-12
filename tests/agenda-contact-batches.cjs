const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/agenda-core.js','utf8');
const start=source.indexOf('async function agendaLoadLinkedContacts('),end=source.indexOf('$("agendaCalendar").onclick',start);
let calls=[],mode='normal',release;
const context={Map,Set,Promise,String,console:{warn(){}},agendaContactCache:new Map(),agendaSearchDigits:v=>String(v||'').replace(/\D/g,'').slice(-9),agendaContactValues:r=>({phone:r.data.phone}),sb:{
 from(table){
  assert.equal(table,'records');let ids;
  const chain={
   select(){return chain},
   in(key,value){assert.equal(key,'id');ids=Array.from(value);calls.push(ids);return chain},
   async eq(key,value){
    assert.equal(key,'source_sheet');assert.equal(value,'BASE DE DATOS');
    if(mode==='error')return {error:{message:'offline'}};
    if(mode==='hold')await new Promise(r=>release=r);
    return {data:ids.map(id=>({id,data:{DNI:'DNI-'+id}})).reverse().concat({id:'wrong',data:{DNI:'WRONG'}})};
   }
  };return chain;
 },
 async rpc(){return {data:[{id:'p1',data:{phone:'600000001'}},{id:'p2',data:{phone:'600000001'}}]}}
}};
vm.createContext(context);vm.runInContext(source.slice(start,end),context);
(async()=>{
 const rows=Array.from({length:300},(_,i)=>({related_record_id:'r'+i}));
 const cache=await context.agendaLoadLinkedContacts([...rows,rows[0]]);
 assert.equal(calls.length,3);assert(calls.every(ids=>ids.length===100));assert.equal(cache.size,300);assert(!cache.has('wrong'));
 for(const [i,row] of rows.entries())assert.equal((await context.agendaResolveContact(row,cache)).data.DNI,'DNI-r'+i);
 assert.equal(calls.length,3,'Rendering does not refetch each contact');
 assert.equal(await context.agendaResolveContact({customer_phone:'600000001'},cache),null,'Ambiguous phone must not select another person');
 mode='error';const failed=await context.agendaLoadLinkedContacts([rows[0]]);assert.equal(await context.agendaResolveContact(rows[0],failed),null);
 mode='hold';const old=context.agendaLoadLinkedContacts([{related_record_id:'old'}]);mode='normal';const current=await context.agendaLoadLinkedContacts([{related_record_id:'current'}]);release();const prior=await old;
 assert.equal(current.size,1);assert(!current.has('old'));assert(!prior.has('current'));
 console.log('PASS Agenda: 300 linked contacts in 3 bounded reads; DNI mapping, failure, ambiguity and overlapping loads remain isolated.');
})().catch(e=>{console.error(e);process.exitCode=1});
