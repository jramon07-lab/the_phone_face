const assert=require('node:assert/strict');
const {syncOne,fields}=require('../lib/contact-sync');
const row={id:'one',data:{NOMBRE:'Ana',APELLIDOS:'García',APODO:'Tienda','TELÉFONO':'611111111',EMAIL:'ana@example.test','DNI / NIF':'TEST'},duplicates:1};
const c=fields(row.data);
let person={resourceName:'people/c1',etag:'e',names:[{givenName:'Ana',familyName:'García'}],nicknames:[{value:'Tienda'}],phoneNumbers:[{value:'+34611111111'}],emailAddresses:[{value:c.email}],userDefined:[{key:'DNI / NIF',value:c.dni}]};
(async()=>{
 let created=0,edited=0,checkpoint=0,waName='';
 const google=async(path,opt)=>{if(path.startsWith('people:createContact')){created++;return person;}if(opt?.method==='PATCH'){person={...person,...opt.body};}return person;};
 const green=async(method,body)=>{assert(!/send/i.test(method));if(method==='getContactInfo')return {contactName:waName};edited++;waName=[body.firstName,body.lastName].join(' ');return {[method]:true};};
 const deps={google,green,people:[],account:'shop@example.test',checkpoint:async()=>{checkpoint++;}};
 let out=await syncOne(row,deps);assert.equal(created,1);assert.equal(edited,1);assert.equal(checkpoint,1);assert.equal(out.TPF_CONTACT_VERIFIED.source,'server_readback');
 await syncOne({...row,data:{...row.data,...out}},deps);assert.equal(created,1,'retry must not create duplicates');assert.equal(edited,1,'aligned WhatsApp is not rewritten');
 await assert.rejects(()=>syncOne({...row,duplicates:2},deps),/compartido/);
 await assert.rejects(()=>syncOne(row,{...deps,people:[person,{...person,resourceName:'people/c2'}]}),/Más de una/);
 await assert.rejects(()=>syncOne(row,{...deps,green:async()=>({contactName:'',addContact:true})}),/todavía no confirma/);
 await assert.rejects(()=>syncOne(row,{...deps,checkpoint:async()=>{throw Error('changed');}}),/changed/);
 await assert.rejects(()=>syncOne({...row,data:{...row.data,'TELÉFONO':''}},deps),/Falta/);
 await assert.rejects(()=>syncOne(row,{...deps,people:[{...person,names:[{givenName:'Otra',familyName:'Persona'}],userDefined:[]}]}),/otra identidad/);
 await assert.rejects(()=>syncOne(row,{...deps,people:[{...person,userDefined:[{key:'DNI / NIF',value:'OTHER'}]}]}),/otra identidad/);
 console.log('PASS durable contact synchronization: create, idempotency, readback, conflicts and stale edits');
})().catch(e=>{console.error(e);process.exitCode=1;});

const {failureStatus}=require('../lib/contact-sync');
assert.equal(failureStatus(Error("WhatsApp: Validation failed. Details: 'chatId': invalid phone number")),'review');
assert.equal(failureStatus(Error('WhatsApp: HTTP 503')),'retry');
assert.equal(failureStatus(Error('WhatsApp: rate limit 429')),'retry');
