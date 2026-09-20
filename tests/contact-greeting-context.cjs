'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/modules/offers-pro.js','utf8').replace("M.register('offers-pro',{install});","window.testContext=directOfferContext;");
let managers=[];const sb={from(){const q={select(){return q},eq(){return q},contains(){return q},async limit(){return{data:managers}}};return q;}};
const context={window:{TPFModules:{}},document:{addEventListener(){},getElementById(){return null}},sb,Intl};vm.createContext(context);vm.runInContext(source,context);
(async()=>{
 const contact={id:'owner',data:{NOMBRE:'María José',APELLIDOS:'García López','NOMBRE Y APELLIDOS':'María José García López','TELÉFONO':'600000001'}};
 const own=await context.window.testContext(contact);assert.equal(own.name,'María José');assert.equal(own.phone,'600000001');
 managers=[{id:'manager',data:{NOMBRE:'Jose Ramon',APELLIDOS:'Sánchez','NOMBRE Y APELLIDOS':'Jose Ramon Sánchez','TELÉFONO':'600000002'}}];
 const managed=await context.window.testContext(contact);assert.equal(managed.name,'Jose Ramon');assert.equal(managed.recipientId,'manager');assert.equal(managed.phone,'600000002');assert.equal(managed.id,'owner');
 managers.push({...managers[0],id:'other'});await assert.rejects(context.window.testContext(contact),/más de una persona/);
 console.log('PASS: compound Nombre retained for customer and manager; recipient safeguards preserved.');
})().catch(e=>{console.error(e);process.exitCode=1;});
