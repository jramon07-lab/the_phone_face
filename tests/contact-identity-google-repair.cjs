'use strict';
const assert=require('node:assert/strict');
const {repair}=require('../lib/contact-identity-google-repair');
function setup(){
 const manager={id:'manager',data:{NOMBRE:'Gestor',APELLIDOS:'Ejemplo','TELÉFONO':'611111111','DNI / NIF':'GESTOR',TPF_IDENTITY_RECOVERY:{user_confirmed_at:'2026-10-03',holder_record_id:'holder'},TPF_RELACIONES:{managed_contacts:[{record_id:'holder'}]}}};
 const holder={id:'holder',data:{NOMBRE:'Titular','DNI / NIF':'TITULAR','TELÉFONO':'',TPF_GOOGLE_CONTACT:{resource_name:'people/c1',google_account:'test@example.test'},TPF_IDENTITY_RECOVERY:{manager_record_id:'manager',previous_phone_owned_by_manager:'611111111'}}};
 const people=[{resourceName:'people/c1',etag:'e',names:[{givenName:'Titular'}],phoneNumbers:[{value:'+34611111111'},{value:'+34958111111'}],userDefined:[{key:'DNI / NIF',value:'TITULAR'},{key:'Other',value:'preserve'}],emailAddresses:[{value:'holder@example.test'}]}];
 let created=0,patched=0,saves=0;
 const google=async(path,opt)=>{if(path.startsWith('people/me/'))return {connections:structuredClone(people)};if(path.startsWith('people:createContact')){created++;const p={resourceName:'people/c2',...opt.body};people.push(p);return structuredClone(p);}const p=people.find(p=>p.resourceName===path.split(/[?:]/)[0]);assert(p);if(opt?.method==='PATCH'){patched++;assert.equal(path.includes('updatePersonFields=phoneNumbers'),true);p.phoneNumbers=opt.body.phoneNumbers;}return structuredClone(p);};
 return {manager,holder,people,deps:{google,account:'test@example.test',save:async(row,metadata)=>{saves++;row.data={...row.data,...metadata};}},counts:()=>({created,patched,saves})};
}
(async()=>{
 let x=setup(),before=structuredClone(x.people[0]);await repair(x.manager,x.holder,x.deps);
 assert.equal(x.counts().created,1);assert.equal(x.people[0].phoneNumbers.length,1);assert.equal(x.people[0].phoneNumbers[0].value,'+34958111111');
 for(const k of ['names','userDefined','emailAddresses'])assert.deepEqual(x.people[0][k],before[k]);
 assert.equal(x.manager.data.TPF_IDENTITY_GOOGLE_REPAIR.status,'completed');assert.equal(x.holder.data.TPF_CONTACT_SYNC.status,'review');
 await repair(x.manager,x.holder,x.deps);assert.equal(x.counts().created,1,'retry must reuse the manager');
 x=setup();x.people[0].userDefined[0].value='OTHER';await assert.rejects(()=>repair(x.manager,x.holder,x.deps),/DNI/);assert.deepEqual(x.counts(),{created:0,patched:0,saves:0});
 x=setup();delete x.manager.data.TPF_IDENTITY_RECOVERY.user_confirmed_at;await assert.rejects(()=>repair(x.manager,x.holder,x.deps),/autorización/);assert.equal(x.counts().patched,0);
 x=setup();x.people.push({...x.people[0],resourceName:'people/c3',userDefined:[{key:'DNI / NIF',value:'OTHER'}]});await assert.rejects(()=>repair(x.manager,x.holder,x.deps),/Otro contacto/);assert.equal(x.counts().created,0);
 x=setup();const real=x.deps.google;x.deps.google=async(path,opt)=>{if(path.startsWith('people:createContact'))throw Error('lost response');return real(path,opt);};await assert.rejects(()=>repair(x.manager,x.holder,x.deps),/lost response/);await assert.rejects(()=>repair(x.manager,x.holder,x.deps),/No se repetirá/);
 console.log('PASS authorized holder/manager Google separation, preservation, retries and fail-closed conflicts');
})().catch(e=>{console.error(e);process.exitCode=1;});
