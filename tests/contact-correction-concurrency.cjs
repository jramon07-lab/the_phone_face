const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require("node:path").join(__dirname, "../js/modules/contact-google-inline.js"), "utf8");
const start = source.indexOf("  async function writeCrm(");
const end = source.indexOf("  async function addAssociatedContactToHolder", start);
const clone = value => JSON.parse(JSON.stringify(value));
const account = "store@example.com", resource = "people/fixture", chat = {id:"34600111222@c.us"};
const initial = {NOMBRE:"Antonio", APELLIDOS:"Old", "NOMBRE Y APELLIDOS":"Antonio Old", APODO:"", TELÉFONO:"600111222", "DNI / NIF":"fixture", EMAIL:"", NOTES:"keep"};
function signature(row) { const d=row.data; return JSON.stringify([row.id,d.TELÉFONO,d.NOMBRE,d.APELLIDOS,d.APODO]); }
function verified(row) {return {version:1,signature:signature(row),google_account:account,google_resource:resource,chat_id:chat.id,verified_at:"new"};}
async function runCase(change, options={}) {
 const row = {id:"contact-fixture",data:clone(initial)};
 let database=clone(initial), writes=0;
 const context={safe:v=>String(v??"").trim(), fold:v=>String(v??"").toLowerCase(), displayCase:v=>String(v), verificationSignature:signature,
  googleBinding:()=>({version:1,resource_name:resource,google_account:account,updated_at:"new"}),
  makeVerification:verified,makeCrmGoogleSync:()=>({}), watchSavedContactSync:()=>{}, savedVerification:r=>(!r.data.TPF_CONTACT_SYNC || r.data.TPF_CONTACT_SYNC.status==="verified") && r.data.TPF_CONTACT_VERIFIED?.signature===signature(r),
  savedCrmGoogleSync:()=>true,
  sb:{from:()=>{
    let payload, conditions=[];
    const query={ update:p=>{payload=p;return query;},eq:(k,v)=>{conditions.push([k,v]);return query;},select:()=>query,
      single:async()=>{
       if(!payload) return {data:{id:row.id,data:clone(database)}};
       writes++;
       if(writes===1){change(database); if(options.mutateRow) row.data=clone(database);}
       if(options.secondRace&&writes===2) database.NOTES="later";
       const expected=conditions.find(([k])=>k==="data")?.[1];
       if(JSON.stringify(database)!==expected)return {data:null,error:{code:"PGRST116"}};
       database=clone(payload.data);if(options.afterWrite) options.afterWrite(database);return {data:{id:row.id,data:clone(database)}};
      }};
    return query;
  }}
 };
 vm.createContext(context);vm.runInContext(source.slice(start,end)+"\nthis.writeCrm=writeCrm;",context);
 const action=context.writeCrm(row,"Antonio","Reyes Cervilla","Chaparral Deuda",chat,{resourceName:resource},null,{phone:"600111222",dni:"fixture",email:""});
 return {action, read:()=>database, writes:()=>writes};
}
async function checkWatcher(values, options={}) {
 const expected={id:"contact-fixture",data:{...clone(initial),TPF_GOOGLE_CONTACT:{resource_name:resource,google_account:account}}};
 const row=clone(expected), active=clone(expected), timers=[], events=[];
 let reads=0, selectedAccount=account;
 const ctx={Map, safe:v=>String(v??"").trim(),fold:v=>String(v??"").toLowerCase(),verificationSignature:signature,
  googleAccountEmail:()=>selectedAccount,current:()=>active,matchedWa:()=>null,
  setTimeout:fn=>timers.push(fn), CustomEvent:function(type,init){return {type,...init};},window:{dispatchEvent:event=>events.push(event)},
  sb:{from:()=>{const q={select:()=>q,eq:()=>q,single:async()=>{reads++;return values.shift()||{error:{message:"temporarily unavailable"}};}};return q;}}
 };
 vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf("  const savedSyncChecks = new Map();"),start)+"\nthis.watch=watchSavedContactSync;",ctx);
 ctx.watch(row,chat);
 if(options.changeAccount) selectedAccount="other@example.com";
 while(timers.length) await timers.shift()();
 return {row,active,events,reads};
}
(async()=>{
 let t=await runCase(d=>{d.TPF_GOOGLE_CONTACT={resource_name:resource,google_account:account,updated_at:"background"};d.TPF_CONTACT_VERIFIED=verified({id:"contact-fixture",data:d});d.NOTES="concurrent note";},{mutateRow:true});
 await t.action;
 assert.equal(t.read().APELLIDOS,"Reyes Cervilla");assert.equal(t.read().NOTES,"concurrent note");assert.equal(t.writes(),2);
 for(const field of ["NOMBRE","APELLIDOS","TELÉFONO","DNI / NIF","EMAIL"]){
  t=await runCase(d=>{d[field]="another person's change";});
  await assert.rejects(t.action,/La ficha cambió/);assert.equal(t.writes(),1);
 }
 t=await runCase(d=>{d.TPF_GOOGLE_CONTACT={resource_name:"people/other",google_account:account};});
 await assert.rejects(t.action,/La ficha cambió/);
 t=await runCase(d=>{d.TPF_CONTACT_VERIFIED={...verified({id:"contact-fixture",data:d}),signature:"wrong"};});
 await assert.rejects(t.action,/La ficha cambió/);
 t=await runCase(d=>{d.NOTES="concurrent";},{secondRace:true});
 await assert.rejects(t.action);assert.equal(t.read().APELLIDOS,"Old");
 const invalidate = d => { delete d.TPF_CONTACT_VERIFIED; delete d.TPF_CRM_GOOGLE_SYNC; d.TPF_CONTACT_SYNC={status:"pending"}; };
 for(const status of ["pending","processing","retry"]){
  t=await runCase(()=>{},{afterWrite:d=>{invalidate(d);d.TPF_CONTACT_SYNC.status=status;}});
  const saved=await t.action;
  assert.equal(saved.TPF_CONTACT_SYNC.status,status);assert.equal(saved.TPF_CONTACT_VERIFIED,undefined);
 }
 for(const field of ["TELÉFONO","DNI / NIF","EMAIL"]){
  t=await runCase(()=>{},{afterWrite:d=>{invalidate(d);d[field]="wrong";}});
  await assert.rejects(t.action,/No se confirmó/);
 }
 for(const field of ["resource_name","google_account"]){
  t=await runCase(()=>{},{afterWrite:d=>{invalidate(d);d.TPF_GOOGLE_CONTACT[field]="wrong";}});
  await assert.rejects(t.action,/No se confirmó/);
 }
 t=await runCase(()=>{},{afterWrite:d=>{invalidate(d);d.TPF_WHATSAPP_CHAT_ID="wrong";}});
 await assert.rejects(t.action,/No se confirmó/);
 for(const status of [undefined,"review"]){
  t=await runCase(()=>{},{afterWrite:d=>{invalidate(d);d.TPF_CONTACT_SYNC.status=status;}});
  await assert.rejects(t.action,/No se confirmó/);
 }
 const base={id:"contact-fixture",data:{...clone(initial),TPF_GOOGLE_CONTACT:{resource_name:resource,google_account:account}}};
 let watched=await checkWatcher([
  {data:{...base,data:{...base.data,TPF_CONTACT_SYNC:{status:"pending"}}}},
  {data:{...base,data:{...base.data,TPF_CONTACT_SYNC:{status:"verified"},TPF_CONTACT_VERIFIED:verified(base)}}},
 ]);
 assert.equal(watched.reads,2);assert.equal(watched.events.length,1);assert.equal(watched.active.data.TPF_CONTACT_SYNC.status,"verified");
 watched=await checkWatcher([{data:{...base,data:{...base.data,NOMBRE:"Someone else",TPF_CONTACT_SYNC:{status:"verified"}}}}]);
 assert.equal(watched.events.length,0);assert.equal(watched.active.data.NOMBRE,"Antonio");
 watched=await checkWatcher([],{changeAccount:true});assert.equal(watched.reads,0);
 watched=await checkWatcher([]);assert.equal(watched.reads,24);assert.equal(watched.events.length,0);
 console.log("PASS: server pending status and exact saved identity/bindings;  metadata refresh, immutable baseline, unrelated edits, identity conflicts, binding conflicts, invalid signatures and second-write race");
})().catch(error=>{console.error(error);process.exitCode=1;});

