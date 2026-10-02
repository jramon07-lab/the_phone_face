'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/modules/offers-pro.js','utf8').replace("M.register('offers-pro',{install});","window.testContext=directOfferContext;");
let records=[],choose=()=>{},fetches=[],fetchError=null,warningText='';
class Select{constructor(){this.options=[];this.value=''}add(o){this.options.push(o);if(this.options.length===1||o.selected)this.value=o.value}replaceChildren(...opts){this.options=[];this.value='';opts.forEach(o=>this.add(o))}}
class Option{constructor(text,value,def=false,selected=false){Object.assign(this,{text,value,selected})}}
const sb={from(){let id;return{select(){return this},eq(k,v){if(k==='id')id=v;return this},contains(k,v){id=v.TPF_RELACIONES.managed_contacts[0].record_id;return this},async maybeSingle(){fetches.push(id);return{data:records.find(r=>r.id===id)||null,error:fetchError}},async limit(){return{data:records.filter(r=>(r.data.TPF_RELACIONES?.managed_contacts||[]).some(x=>x.record_id===id))}}}}};
const document={addEventListener(){},getElementById(){return null},body:{appendChild(){}},createElement(){const els={holder:new Select(),manager:new Select(),recipient:new Select(),summary:{},cancel:{},continue:{},h2:{after(p){warningText=p.textContent}}};return{style:{},dataset:{},querySelector(s){return s==='h2'?els.h2:els[s.match(/data-(\w+)/)[1]]},close(){},remove(){},showModal(){choose(els);els.continue.onclick()}}}};
const context={window:{TPFModules:{},addEventListener(){}},document,sb,Intl,Option};vm.createContext(context);vm.runInContext(source,context);
const holder={id:'owner',data:{NOMBRE:'María José',APELLIDOS:'García López','NOMBRE Y APELLIDOS':'María José García López','TELÉFONO':'600000001'}};
const manager={id:'manager',data:{NOMBRE:'Jose Ramon',APELLIDOS:'Sánchez','NOMBRE Y APELLIDOS':'Jose Ramon Sánchez','TELÉFONO':'600000002',TPF_RELACIONES:{managed_contacts:[{record_id:'owner'}]}}};
(async()=>{
 records=[holder];choose=()=>{throw Error('Unlinked contact must skip dialog')};let r=await context.window.testContext(holder);assert.equal(r.name,'María José');assert.equal(r.recipientId,'owner');
 choose=()=>{};records.push(manager);r=await context.window.testContext(holder);assert.equal(r.id,'owner');assert.equal(r.managerId,'manager');assert.equal(r.name,'Jose Ramon');assert.equal(r.phone,'600000002');
 choose=e=>{e.recipient.value='owner';e.recipient.onchange()};r=await context.window.testContext(holder);assert.equal(r.managerId,'manager');assert.equal(r.recipientId,'owner');
 records.push({...manager,id:'other'});choose=e=>{assert.equal(e.manager.value,'');assert.equal(e.recipient.value,'');e.manager.value='other';e.manager.onchange()};r=await context.window.testContext(holder);assert.equal(r.recipientId,'other');
 choose=e=>{assert.equal(e.holder.value,'');e.holder.value='1';e.holder.onchange();e.manager.value='manager';e.manager.onchange()};r=await context.window.testContext(manager);assert.equal(r.id,'owner');assert.equal(r.recipientId,'manager');
 choose=e=>e.cancel.onclick();assert.equal(await context.window.testContext(holder),null);
 // Missing linked rows must not block either composer or select a vanished titular.
 const stale={id:'stale-manager',data:{NOMBRE:'Gestor',TPF_RELACIONES:{managed_contacts:[{record_id:'gone'},{record_id:'gone'},{record_id:'owner'}]}}};
 records=[stale,holder];fetches=[];warningText='';
 choose=e=>{assert.match(warningText,/ya no están disponibles/);assert.equal(e.holder.options.length,3);e.holder.value='1';e.holder.onchange();assert.equal(e.manager.value,stale.id);};
 r=await context.window.testContext(stale);assert.equal(r.id,'owner');assert.equal(r.managerId,stale.id);assert.equal(r.recipientId,stale.id);assert.equal(fetches.filter(x=>x==='gone').length,1);
 records=[stale];warningText='';choose=e=>{assert.match(warningText,/contactos disponibles/);assert.equal(e.holder.value,'0');assert.equal(e.recipient.value,stale.id)};
 r=await context.window.testContext(stale);assert.equal(r.id,stale.id);
 choose=e=>e.cancel.onclick();assert.equal(await context.window.testContext(stale),null);
 await assert.rejects(()=>context.window.testContext({id:'missing'}),/contacto ya no está disponible/);
 fetchError={message:'network unavailable'};await assert.rejects(()=>context.window.testContext(stale),e=>e.message==='network unavailable');fetchError=null;
 console.log('PASS: explicit holder/manager/recipient choices, compound names, multiple managers and cancellation.');
})().catch(e=>{console.error(e);process.exitCode=1});
