'use strict';

const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const source=fs.readFileSync('js/modules/contact-google-inline.js','utf8');
const store=new Map();
const chat={id:'34611111111@c.us',name:'Nombre público largo de WhatsApp'};
const row={id:'r1',data:{NOMBRE:'Antonio',APELLIDOS:'',APODO:'Miami','TELÉFONO':'611111111'}};
row.data.TPF_CONTACT_VERIFIED={
 version:1,
 signature:JSON.stringify(['r1','611111111','Antonio','','Miami']),
 chat_id:'',
 whatsapp_name:'',
 google_account:'shop@example.test',
 google_resource:'people/r1',
 verified_at:'2026-09-14T12:00:00Z'
};
const context={
 console,Map,Set,Date,Event:function(){},
 localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)},
 googleContactsEmail:()=> 'shop@example.test',
 waLiveState:{selected:chat,contact:row,selectionVersion:1},
 window:{TPFModules:{register(){}},dispatchEvent(){}},
 document:{getElementById:()=>null,querySelector:()=>null}
};
vm.createContext(context);
const marker='  M.register("contact-google-inline", { install });';
assert.ok(source.includes(marker),'the test must execute the production module');
vm.runInContext(source.replace(marker,'  window.testApi={savedVerification,rememberUnifiedName,whatsappDisplayIdentity};'),context,{timeout:1000});

const api=context.window.testApi;
assert.ok(api.savedVerification(row,chat),'CRM+Google proof stays valid before the first WhatsApp is confirmed');
api.rememberUnifiedName(chat,row);
assert.deepEqual(JSON.parse(JSON.stringify(api.whatsappDisplayIdentity(chat))),{name:'Antonio',nickname:'Miami',recordId:'r1'},'the first matching WhatsApp must display the final chosen identity');
assert.equal(api.savedVerification(row,{id:'34622222222@c.us',name:'Otra persona'}),null,'a different phone must never receive the verified identity');

const legacy={id:'r2',data:{NOMBRE:'Pilar',APELLIDOS:'',APODO:'','TELÉFONO':'622222222',TPF_CRM_GOOGLE_SYNC:{version:1,signature:JSON.stringify(['r2','622222222','Pilar','','']),google_account:'shop@example.test',google_resource:'people/r2',verified_at:'2026-09-14T12:00:00Z',no_whatsapp:true}}};
assert.ok(api.savedVerification(legacy,{id:'34622222222@c.us',name:'Otro nombre'}),'the earlier CRM+Google-only marker must remain verified');

console.log('CRM+Google verified contacts keep the chosen identity for their first matching WhatsApp.');
