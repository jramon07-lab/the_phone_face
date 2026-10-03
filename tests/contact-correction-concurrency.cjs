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
  makeVerification:verified,makeCrmGoogleSync:()=>({}), savedVerification:r=>r.data.TPF_CONTACT_VERIFIED?.signature===signature(r),
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
       database=clone(payload.data);return {data:{id:row.id,data:clone(database)}};
      }};
    return query;
  }}
 };
 vm.createContext(context);vm.runInContext(source.slice(start,end)+"\nthis.writeCrm=writeCrm;",context);
 const action=context.writeCrm(row,"Antonio","Reyes Cervilla","Chaparral Deuda",chat,{resourceName:resource},null,{phone:"600111222",dni:"fixture",email:""});
 return {action, read:()=>database, writes:()=>writes};
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
 console.log("PASS: metadata refresh, immutable baseline, unrelated edits, identity conflicts, binding conflicts, invalid signatures and second-write race");
})().catch(error=>{console.error(error);process.exitCode=1;});
