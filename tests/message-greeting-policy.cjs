// Exercise the production render functions without database or message delivery.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync('supabase/functions/crm-automation-runner/index.ts','utf8');
const render=source.slice(source.indexOf('function contactVar'),source.indexOf('function durationMs'));
const sandbox={};vm.createContext(sandbox);vm.runInContext(stripTypeScriptTypes(render),sandbox);
const context={name:'María José García',contact_data:{NOMBRE:'María José'},operator:'Vodafone',precio_total:'52,00'};
assert.equal(sandbox.outgoingVars('Hola {nombre} 👋',context),'Hola María José 👋');
assert.equal(sandbox.outgoingVars('Hola {{contacto.nombre}}',context),'Hola María José');
assert.equal(sandbox.outgoingVars('Hola {nombre}',{...context,contract_party:{recipient:'holder',holder_first_name:'José Luis'}}),'Hola José Luis');
assert.equal(sandbox.outgoingVars('Hola {nombre}',{...context,recipient_first_name:'Ana María',recipient_contact_id:'manager',contact_id:'customer'}),'Hola Ana María');
const reminder='Hola {nombre}, ¿has podido revisar la oferta de {operador} por {precio_total} €/mes?';
for(const phase of ['reminder_2','reminder_5']){
 assert.match(sandbox.outgoingVars(reminder,{...context,offer_welcome:false},phase),/oferta de Vodafone por/);
 assert.equal(sandbox.outgoingVars(reminder,{...context,offer_welcome:true},phase),'Hola María José, ¿has podido revisar la oferta por 52,00 €/mes?');
 assert.doesNotMatch(sandbox.outgoingVars(reminder,{...context,oferta_mensaje:'Hola María, soy Ramón. Te envío una oferta que puede interesarte:'},phase),/Vodafone/);
}
assert.match(sandbox.outgoingVars('{oferta_mensaje}',{...context,oferta_mensaje:'Hola María José García, te envío la oferta de Vodafone:\nNetflix incluido'}),/^Hola María José,.*Vodafone:\nNetflix incluido$/);
assert.equal(sandbox.outgoingVars('Texto escrito manualmente para García',context),'Texto escrito manualmente para García');
console.log('PASS: first names, compound names, recipient isolation, normal/welcome reminders and legacy welcome inference');

const party={holder_record_id:'h',recipient_contact_id:'m',holder_name:'Ana García',recipient_first_name:'José Manuel'};
const message=sandbox.outgoingVars('Hola {nombre}\nOferta',{...context,contract_party:party});
assert.equal(message,'Hola José Manuel\nSobre el contrato de Ana García.\nOferta');
assert.equal(sandbox.contractMessage(message,party),message);
assert.equal(sandbox.contractMessage('Hola Ana\nOferta',{...party,recipient_contact_id:'h'}),'Hola Ana\nOferta');
assert.equal(sandbox.contractMessage('',party),'');
console.log('Contract holder reference, manager greeting and idempotent rendering OK');
