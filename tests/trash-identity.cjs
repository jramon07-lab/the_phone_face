const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/core/20-main.js','utf8');
const fn=source.slice(source.indexOf('window.restoreTrash=async'),source.indexOf('window.purgeTrash=async'));
(async()=>{
 for(const [kind,key,table] of [['contact','record','records'],['opportunity','opportunity','sales_opportunities'],['agenda','agenda','agenda_items']]){
  const id='restored-id',stored={id,marker:'original'},x={id:'trash-id',entity_type:kind,entity_id:id,payload:{[key]:stored},label:'Test'};
  let write,removed=false,refreshed=0,alerts=[];
  const window={dispatchEvent(){},TPFRecordLinks:{invalidate(){}},tpfReloadContacts:async()=>refreshed++,TPFRefreshTasks:async()=>refreshed++};
  const sb={from(name){return {select(){return this},eq(){return this},maybeSingle:async()=>({data:x}),insert:async row=>{assert.equal(name,table);write=row;return{};},delete(){removed=true;return this;}}}};
  const context={window,sb,CustomEvent,alert:x=>alerts.push(x),auditAction:async()=>{},loadTrash:async()=>{},loadSales:async()=>refreshed++,console};
  vm.runInNewContext(fn,context);await window.restoreTrash('trash-id');assert.equal(write.id,id);assert(removed);assert.equal(refreshed,1);assert.deepEqual(alerts,[]);
  removed=false;sb.from=name=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:x}),insert:async()=>({error:{message:'duplicate key'}}),delete(){removed=true;return this;}});
  await window.restoreTrash('trash-id');assert.equal(removed,false,'A failed restoration must keep the recoverable trash item');assert.deepEqual(alerts,['duplicate key']);
 }
 console.log('PASS: restore keeps contact/opportunity/task identity, refreshes shared views and preserves trash on conflict');
})().catch(e=>{console.error(e);process.exitCode=1;});
