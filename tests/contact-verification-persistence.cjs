'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/modules/contact-google-inline.js','utf8');
function fixture(){
 let stored=null,deny=false,account='shop@example.test',writes=0,googleReads=0;
 const row={id:'record-a',data:{NOMBRE:'Nombre',APELLIDOS:'Apellido',APODO:'Alias','TELÉFONO':'900000001','DNI / NIF':'EXISTING',NOTAS:'Conservar'}};
 const unrelated={id:'34900000002@c.us',name:'Otro'};
 const context={Date,console,Map,Set,localStorage:{getItem:()=>null},googleContactsEmail:()=>account,googleContactsConnected:()=>true,googleApi:async()=>{googleReads++;throw Error('Unexpected Google read')},waLiveState:{selected:unrelated,contact:null,selectionVersion:1},window:{TPFModules:{register(){}}},document:{getElementById:()=>null},sb:{from(table){assert.equal(table,'records');let payload;return{update(p){payload=p;return this},eq(key,value){if(key==='data')assert.equal(value,JSON.stringify(row.data),'optimistic guard must preserve concurrent changes');return this},select(){return this},async single(){writes++;if(deny)return{data:null,error:null};stored={id:row.id,data:structuredClone(payload.data)};return{data:stored,error:null}}}}}};
 vm.createContext(context);vm.runInContext(source.replace("M.register('contact-google-inline',{install});","window.testApi={contactChat,makeVerification,savedVerification,writeCrm,renderVerifiedCard,persistMatchingVerification};"),context);
 return{api:context.window.testApi,row,context,get stored(){return stored},get writes(){return writes},get googleReads(){return googleReads},setAccount:v=>account=v,setDeny:v=>deny=v};
}
(async()=>{
 const f=fixture(),a=f.api,chat=a.contactChat(f.row);
 assert.equal(chat.id,'34900000001@c.us','profile confirmation must not use an unrelated selected chat');
 assert.equal(a.savedVerification(f.row,chat),null,'a name alone is not verified');
 await a.writeCrm(f.row,'Nombre','Apellido','Alias',chat,{resourceName:'people/verified-a'});
 assert.equal(f.stored.data.NOTAS,'Conservar');assert.equal(f.stored.data['DNI / NIF'],'EXISTING');
 assert.equal(f.stored.data.TPF_WHATSAPP_CHAT_ID,chat.id);
 assert.ok(a.savedVerification(f.row,chat));
 const second=fixture();second.row.data=structuredClone(f.stored.data);
 assert.ok(second.api.savedVerification(second.row,chat),'a new PC can use the persisted confirmation without local storage');
 const card={dataset:{},innerHTML:'',querySelector:()=>({})};
 for(let i=0;i<100;i++)assert.equal(second.api.renderVerifiedCard(card,second.row,chat),true);
 assert.match(card.innerHTML,/Contacto verificado/);assert.equal(second.googleReads,0);assert.equal(second.writes,0);
 assert.match(card.innerHTML,/<details class="tpfVerifiedDetails">/);assert.doesNotMatch(card.innerHTML,/<details[^>]*\sopen/);
 const legacy=fixture(),legacyChat=legacy.api.contactChat(legacy.row);
 legacy.row.data.TPF_WHATSAPP_NAME_CONFIRMED={chat_id:legacyChat.id};
 const person={resourceName:'people/legacy',names:[{givenName:'Nombre',familyName:'Apellido'}],nicknames:[{value:'Alias'}],phoneNumbers:[{value:'+34900000001'}]};
 const before=structuredClone(legacy.row.data);
 legacy.context.waLiveState.contact=structuredClone(legacy.row);
 assert.equal(await legacy.api.persistMatchingVerification(legacy.row,legacyChat,[person,person]),false);
 assert.equal(await legacy.api.persistMatchingVerification(legacy.row,legacyChat,[{...person,phoneNumbers:[{value:'900000002'}]}]),false);
 assert.equal(legacy.writes,0);
 await Promise.all([legacy.api.persistMatchingVerification(legacy.row,legacyChat,[person]),legacy.api.persistMatchingVerification(legacy.row,legacyChat,[person])]);
 assert.equal(legacy.writes,1,'concurrent checks share one optimistic metadata write');
 assert.ok(legacy.api.savedVerification(legacy.context.waLiveState.contact,legacyChat),'WhatsApp reuses profile proof');
 const {TPF_CONTACT_VERIFIED,...unchanged}=legacy.row.data;assert.deepEqual(unchanged,before);
 assert.equal(await legacy.api.persistMatchingVerification(legacy.row,legacyChat,[person]),true);assert.equal(legacy.writes,1);
 for(const field of ['NOMBRE','APELLIDOS','APODO','TELÉFONO']){
   const original=second.row.data[field];second.row.data[field]='changed';assert.equal(second.api.savedVerification(second.row,chat),null,field+' changes require review');second.row.data[field]=original;
 }
 second.setAccount('different@example.test');assert.equal(second.api.savedVerification(second.row,chat),null);
 second.setAccount('shop@example.test');assert.equal(second.api.savedVerification(second.row,{id:'34900000002@c.us'}),null);
 const denied=fixture();denied.setDeny(true);
 await assert.rejects(()=>denied.api.writeCrm(denied.row,'Nombre','Apellido','Alias',chat,{resourceName:'people/a'}),/No se confirmó/);
 assert.equal(denied.row.data.TPF_CONTACT_VERIFIED,undefined,'no returned row must never be advertised as a saved verification');
 console.log('Verification persists across PCs, prevents repeated Google reads, validates account/identity and confirms the CRM write');
})().catch(e=>{console.error(e);process.exitCode=1});
