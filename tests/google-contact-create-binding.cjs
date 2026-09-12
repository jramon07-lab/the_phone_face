'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const main=fs.readFileSync('js/core/20-main.js','utf8');
const createSlice=main.slice(main.indexOf('function normGooglePhone'),main.indexOf('/* Rueda normal'));
const calls=[];let searches=0;
const createContext={window:{},URLSearchParams,console};
createContext.googleContactsConnected=()=>true;
createContext.googleContactsServer=async(action,options={})=>{
 const request=JSON.parse(options.body||'{}'),path=request.path;
 if(action!=='proxy')throw Error('Acción inesperada: '+action);
 if(path.startsWith('people:searchContacts')){searches++;return{results:[{person:{resourceName:'people/old',phoneNumbers:[{value:'+34613446380'}]}}]};}
 if(path.startsWith('people:createContact')){calls.push({path,body:request.body});return{resourceName:'people/new'};}
 throw Error('Ruta inesperada: '+path);
};
vm.createContext(createContext);vm.runInContext(createSlice,createContext);

(async()=>{
 assert.equal(createContext.contactDisplayCase('CATETO'),'Cateto');
 assert.equal(createContext.contactDisplayCase('PRUEBA 25'),'Prueba 25');
 assert.equal(createContext.contactDisplayCase('ORTIZ'),'Ortiz');
 const created=await createContext.createGoogleContact('Prueba 25 Ortiz','613446380','', 'CATETO',{first:'Prueba 25',last:'Ortiz',forceNew:true});
 assert.equal(created.duplicate,false);assert.equal(created.person.resourceName,'people/new');
 assert.equal(searches,0,'Una ficha nueva no debe reutilizar otra solo porque comparte teléfono');
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0].body.names)),[{givenName:'Prueba 25',familyName:'Ortiz',displayName:'Prueba 25 Ortiz'}]);
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0].body.nicknames)),[{value:'Cateto',type:'DEFAULT'}]);
 const reused=await createContext.createGoogleContact('Otra Persona','613446380','','');
 assert.equal(reused.duplicate,true,'Las rutas antiguas conservan su protección contra duplicados');
 assert.equal(calls.length,1);

 const inline=fs.readFileSync('js/modules/contact-google-inline.js','utf8').replace("M.register('contact-google-inline',{install});","window.testApi={contactData,searchGoogle,syncState,displayCase};");
 const directCalls=[];
 const directPerson={resourceName:'people/new',names:[{givenName:'Prueba 25',familyName:'Ortiz'}],nicknames:[{value:'Cateto'}],phoneNumbers:[{value:'+34613446380'}]};
 const inlineContext={
  window:{TPFModules:{}},document:{getElementById(){return null;}},console,URLSearchParams,Map,Set,Date,setTimeout(){return 1;},clearTimeout(){},
  splitName(value){const parts=String(value||'').trim().split(/\s+/);return{first:parts.shift()||'',last:parts.join(' ')};},
  unifiedVisible(first,last,nickname){return[first,last,nickname].filter(Boolean).join(' ');},
  googleContactsConnected:()=>true,googleContactsEmail:()=> 'shop@example.test',
  googleApi:async path=>{directCalls.push(path);if(path.startsWith('people/new?'))return directPerson;if(path.startsWith('people/me/connections'))throw Error('No debe buscar por teléfono si ya tiene su ficha vinculada');throw Error('Ruta inesperada: '+path);}
 };
 vm.createContext(inlineContext);vm.runInContext(inline,inlineContext);
 const row={id:'crm-new',data:{NOMBRE:'PRUEBA 25',APELLIDOS:'ORTIZ',APODO:'CATETO','TELÉFONO':'613446380',TPF_WHATSAPP_CHAT_ID:'34613446380@c.us',TPF_WHATSAPP_NAME_CONFIRMED:{chat_id:'34613446380@c.us'},TPF_GOOGLE_CONTACT:{version:1,resource_name:'people/new',google_account:'shop@example.test'}}};
 const contact=inlineContext.window.testApi.contactData(row),found=await inlineContext.window.testApi.searchGoogle(contact),state=inlineContext.window.testApi.syncState(row,null,found,true,'','');
 assert.equal(inlineContext.window.testApi.displayCase('CATETO'),'Cateto');
 assert.equal(contact.first,'Prueba 25');assert.equal(contact.last,'Ortiz');
 assert.equal(contact.nickname,'Cateto');
 assert.equal(found.length,1);assert.equal(found[0].resourceName,'people/new');assert.equal(state.ok,true);assert.equal(state.status,'Al día');assert.equal(directCalls.some(path=>path.startsWith('people/me/connections')),false);
 const contactsUi=fs.readFileSync('js/modules/contacts-list-ui.js','utf8');
 assert.match(contactsUi,/const first=displayContactCase\(byId\('tpfCreateFirst'\)\.value\),last=displayContactCase\(byId\('tpfCreateLast'\)\.value\)/,'Crear contacto debe guardar nombre y apellidos normalizados en CRM');
 console.log('PASS Google creates each new CRM contact with separate name fields and verifies its own binding');
})().catch(error=>{console.error(error);process.exitCode=1});
