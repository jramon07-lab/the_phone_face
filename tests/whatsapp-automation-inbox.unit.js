'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const storage=new Map();
const context={
  console,
  setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask,
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  document:{readyState:'loading',addEventListener(){}},
  TPFModules:{register(){}},
  waLiveState:{livePreview:{}},
  waMessageTimestamp:message=>message?.timestamp||0,
  waMessageDirection:message=>message?.direction||'in'
};
context.window=context;
vm.runInNewContext(fs.readFileSync('js/modules/whatsapp-automation-inbox.js','utf8'),context,{filename:'whatsapp-automation-inbox.js'});

const api=context.TPFAutomationInbox;
assert.ok(api,'El módulo debe exponer su diagnóstico');
const now=Math.floor(Date.now()/1000);
api.ingestJobs([{context:{phone:'34695661409'},completed_at:new Date(now*1000).toISOString()}]);

const chat={id:'34695661409@c.us',_lastMessage:{timestamp:now,direction:'out'}};
context.waLiveState.livePreview[chat.id]={timestamp:now,outgoing:true};
assert.equal(api.isAutomaticWaiting(chat),true,'El último envío automático debe salir de Conversaciones');

context.waLiveState.livePreview[chat.id]={timestamp:now+30,outgoing:false};
assert.equal(api.isAutomaticWaiting(chat),false,'La respuesta del cliente debe devolver el chat a Conversaciones');

context.waLiveState.livePreview[chat.id]={timestamp:now+1800,outgoing:true};
assert.equal(api.isAutomaticWaiting(chat),false,'Un envío manual posterior no puede quedar clasificado como automático');

context.waLiveState.livePreview[chat.id]={timestamp:now+30,outgoing:true};
storage.set('tpf_wa_manual_outgoing_v1',JSON.stringify({'695661409':(now+30)*1000}));
// Vuelve a cargar el módulo para comprobar la caché manual desde el almacenamiento.
const second={...context,TPFModules:{register(){}},TPFAutomationInbox:undefined};second.window=second;
vm.runInNewContext(fs.readFileSync('js/modules/whatsapp-automation-inbox.js','utf8'),second,{filename:'whatsapp-automation-inbox.js'});
second.TPFAutomationInbox.ingestJobs([{context:{contact_phone:'695661409'},completed_at:new Date(now*1000).toISOString()}]);
assert.equal(second.TPFAutomationInbox.isAutomaticWaiting(chat),false,'Escribir manualmente debe devolver el chat a Conversaciones');

console.log('WhatsApp automation inbox OK');

