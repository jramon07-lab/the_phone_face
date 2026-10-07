'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({window:{}});vm.runInContext(fs.readFileSync('js/modules/opportunity-identity.js','utf8'),ctx);
const api=ctx.window.TPFOpportunityIdentity,base={id:'sale',record_id:'manager',client_name:'Titular',phone:'600111111',contract_party:{same:false,holder_record_id:'holder',holder_name:'Titular',holder_phone:'600111111',manager_record_id:'manager',contact_name:'Gestora',contact_phone:'600222222',recipient:'contact'}};
const before=JSON.stringify(base),offers=[{created_at:'2026-10-01',snapshot:{recipient_name:'Antigua',recipient_phone:'600333333'}}];
const result=api.resolve(base,offers);assert.equal(result.holder.id,'holder');assert.equal(result.manager.id,'manager');assert.equal(result.recipient.id,'manager');assert.equal(result.recipient.name,'Gestora');assert.equal(result.recipient.phone,'600222222');
const holder=api.resolve({...base,contract_party:{...base.contract_party,recipient:'holder'}});assert.equal(holder.recipient.id,'holder');assert.equal(holder.recipient.phone,'600111111');
const empty={...base,contract_party:{...base.contract_party,recipient_phone:''}};assert.equal(api.resolve(empty,offers).recipient.phone,'');
const legacy={id:'sale',record_id:'holder',client_name:'Titular',phone:'600111111'};const saved=[...offers,{created_at:'2026-10-05',snapshot:{recipient_phone:'600444444',recipient_name:'Nueva',recipient_contact_id:'new-id'}}];const recipient=api.resolve(legacy,saved).recipient;assert.equal(recipient.phone,'600444444');assert.equal(recipient.name,'Nueva');assert.equal(recipient.id,'new-id');
assert.equal(api.resolve(legacy,[{snapshot:{recipient_phone:''}}]).recipient.phone,'');
assert.equal(api.resolve({...base,contract_party:{same:false,recipient_phone:'600222222'}}).recipient.id,null,'missing manager ID cannot borrow holder identity');
const installation=api.installation({client_name:'Titular',recipient_context:{contract_party:base.contract_party,name:'Gestora',phone:''}},base);assert.equal(installation.holder.id,'holder');assert.equal(installation.recipient.phone,'','explicit cleared installation recipient cannot borrow any phone');
assert.equal(JSON.stringify(base),before,'identity resolution must not change customer data');
// The view and the follow-up communication both delegate to the same model.
const view=fs.readFileSync('js/modules/opportunity-contract-details.js','utf8');vm.runInContext(view.slice(view.indexOf('function party(o){'),view.indexOf('function operator(o)')),ctx);
const follow=fs.readFileSync('js/modules/offer-followup-ui.js','utf8');vm.runInContext('const F={byOpportunity:new Map()};'+follow.slice(follow.indexOf('function identity(o={}){'),follow.indexOf('function listActions(')),ctx);
ctx.window.TPFOfferFollowup={state:{byOpportunity:new Map([['sale',saved]])}};vm.runInContext('F.byOpportunity.set("sale",window.TPFOfferFollowup.state.byOpportunity.get("sale"));',ctx);
for(const o of [base,empty,legacy])assert.equal(ctx.party(o).recipient.phone,ctx.conversationPhone(o));
console.log('PASS: common opportunity identity, explicit parties, missing IDs, cleared phones, latest saved recipient, installation context and presentation/communication parity');
// Contract details may read missing legacy data only from the confirmed party ID.
(async()=>{
 const src=fs.readFileSync('js/modules/opportunity-contract-details.js','utf8');
 const fragment=src.slice(src.indexOf('async function completePersonData('),src.indexOf('function compactHeader('));
 const reads=[];const isolated={window:{TPFContactParty:{contactValues:r=>r.data}},sb:{from:()=>{let id;const q={select:()=>q,eq:(key,value)=>{if(key==='id')id=value;return q;},maybeSingle:async()=>{reads.push(id);return{data:{id,data:{dni:id==='holder'?'HOLDER-DNI':'MANAGER-DNI',phone:id==='holder'?'600333333':'600222222'}}};}};return q;}}};
 vm.runInNewContext(fragment,isolated);
 const row={record_id:'manager',client_name:'Holder',contract_party:{same:false,holder_record_id:'holder',manager_record_id:'manager'}};
 const people=api.resolve(row);await isolated.completePersonData(people,row);assert.equal(people.holder.dni,'HOLDER-DNI');assert.equal(people.holder.phone,'600333333');assert.equal(people.manager.phone,'600222222');
 const cleared={...row,contract_party:{...row.contract_party,holder_dni:'',holder_phone:'',contact_phone:''}};reads.length=0;const empty=api.resolve(cleared);await isolated.completePersonData(empty,cleared);assert.equal(reads.length,0);assert.equal(empty.holder.dni,'');assert.equal(empty.holder.phone,'');
 const unlinked={record_id:'manager',contract_party:{same:false,holder_name:'Holder',holder_dni:'SNAPSHOT-DNI'}};const separate=api.resolve(unlinked);await isolated.completePersonData(separate,unlinked);assert.equal(separate.holder.dni,'SNAPSHOT-DNI');assert.equal(separate.holder.phone,'');
 assert.equal(api.resolve({record_id:'self',client_name:'Self',dni:'SELF-DNI',phone:'600111111'}).holder.dni,'SELF-DNI');
 console.log('PASS: holder DNI and phones stay separate, exact record fallback and explicit cleared snapshot values preserved');
})().catch(e=>{console.error(e);process.exitCode=1;});
