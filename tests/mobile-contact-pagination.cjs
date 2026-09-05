const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/mobile-app.js','utf8');
const testSource=source.replace(/\s*boot\(\);\s*\}\)\(\);\s*$/, '\nwindow.testContacts={fetchAllMobileContacts,state,refreshData,contactMatchesSearch};\n})();');
assert.notEqual(testSource,source);
let records=[],calls=[],failAt=-1;
const client={from(table){
  assert.equal(table,'records');
  const orders=[];
  const q={select(){return q},eq(key,value){assert.equal(key,'source_sheet');assert.equal(value,'BASE DE DATOS');return q},order(key){orders.push(key);return q},range(from,to){
    calls.push([from,to]);assert.deepEqual(orders,['updated_at','id']);
    return Promise.resolve(from===failAt?{data:null,error:{message:'Failed page'}}:{data:records.slice(from,Math.min(to+1,from+1000)),error:null});
  }};return q;
}};
const context={window:{supabase:{createClient:()=>client}},console,Date,Intl,URLSearchParams,setTimeout,clearTimeout,location:{hash:'#/contacts'},document:{getElementById(){return null},querySelectorAll(){return []}}};
vm.runInNewContext(testSource,context);
const api=context.window.testContacts;
async function run(){
  for(const count of [0,999,1000,1244,2501]){
    records=Array.from({length:count},(_,i)=>({id:String(i),data:{NOMBRE:'Contacto '+i}}));calls=[];
    const result=await api.fetchAllMobileContacts();
    assert.equal(result.error,null);assert.equal(result.data.length,count);
    assert.equal(new Set(result.data.map(r=>r.id)).size,count);
    assert.equal(calls.length,Math.floor(count/1000)+1);
  }
  failAt=1000;
  const failed=await api.fetchAllMobileContacts();
  assert.equal(failed.data,null,'Do not return a partial list as complete');
  assert.equal(failed.error.message,'Failed page');
  console.log('PASS: 0, 999, 1000, 1244, 2501 contacts; unique rows; failed page rejected');
}
run().catch(e=>{console.error(e);process.exitCode=1});
