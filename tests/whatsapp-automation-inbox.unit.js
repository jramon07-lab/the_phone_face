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


// Exercise the actual outer wrapper: it must not pre-filter global search.
const search={value:'cliente'};
context.document.getElementById=id=>id==='waLiveSearch'?search:id==='waLiveChats'?{}:null;
context.document.querySelector=()=>null;
context.document.querySelectorAll=()=>[];
let rendered=[];
context.waLiveState.chats=[{id:'a@c.us',name:'cliente A'},{id:'b@g.us',name:'cliente B'}];
context.renderWhatsAppChats=()=>{rendered=context.waLiveState.chats.map(c=>c.id)};
const wrappedSource=fs.readFileSync('js/modules/whatsapp-automation-inbox.js','utf8').replace('window.TPFAutomationInbox={','window.__wrapInbox=wrapRenderer;window.TPFAutomationInbox={');
vm.runInNewContext(wrappedSource,context);
context.__wrapInbox();
for(const filter of ['unanswered','waiting','automatic','snoozed','groups','archived']){
 context.waLiveState.filter=filter;context.renderWhatsAppChats();
 assert.deepEqual(rendered,['a@c.us','b@g.us'],'global search must bypass '+filter);
 assert.equal(context.waLiveState.filter,filter);
}
search.value='';context.waLiveState.filter='automatic';context.renderWhatsAppChats();assert.equal(rendered.length,0,'clearing search restores the chosen category');

// Commercial lifecycle is independent of attention and of legacy board columns.
const inbox=context.TPFAutomationInbox;
const phone='34600123456',chatId=phone+'@c.us';
const sample={id:chatId,_lastMessage:{timestamp:now,direction:'out'}};
let chatMeta={};context.waMeta=()=>chatMeta;
context.waLiveState.livePreview={};context.TPFInboxManual={category:()=>null};
const oldOpp={id:'old',stage_id:'this-month',phone};
const saleOpp={id:'sale',stage_id:'processing',phone};
const offer=status=>({id:'offer',opportunity_id:'sale',status,status_changed_at:new Date((now+1)*1000).toISOString(),snapshot:{recipient_phone:phone}});
const kinds=()=>Array.from(inbox.facets(sample));
inbox.ingestBusiness([],[oldOpp]);assert.deepEqual(kinds(),['all'],'old opportunities cannot classify a chat by their column');
inbox.ingestBusiness([offer('following')],[oldOpp,saleOpp]);assert.deepEqual(kinds(),['automatic']);
sample._lastMessage={timestamp:now+2,direction:'in'};assert.deepEqual(kinds(),['unanswered','automatic']);
sample._lastMessage={timestamp:now+3,direction:'out'};assert.deepEqual(kinds(),['automatic']);
inbox.ingestBusiness([offer('accepted')],[oldOpp,saleOpp]);assert.deepEqual(kinds(),['processing'],'accepted sale plus old Este mes must only be processing');
inbox.ingestBusiness([offer('processed')],[oldOpp,saleOpp]);assert.deepEqual(kinds(),['processing']);
sample._lastMessage={timestamp:now+4,direction:'in'};assert.deepEqual(kinds(),['unanswered','processing']);
sample._lastMessage={timestamp:now,direction:'out'};
inbox.ingestBusiness([offer('won')],[oldOpp,saleOpp]);assert.deepEqual(kinds(),['archived'],'won sale ignores legacy review opportunities');
// Moving the old opportunity to a review column does not change the offer status.
inbox.ingestBusiness([offer('won')],[oldOpp,{...saleOpp,stage_id:'review'}]);assert.deepEqual(kinds(),['archived']);
sample._lastMessage={timestamp:now+4,direction:'in'};assert.deepEqual(kinds(),['unanswered'],'customer response reopens attention');
inbox.ingestBusiness([offer('won'),{...offer('following'),id:'second'}],[oldOpp,saleOpp]);sample._lastMessage={timestamp:now,direction:'out'};assert.deepEqual(kinds(),['automatic'],'another active offer prevents archival');
inbox.ingestBusiness([offer('processed'),{...offer('following'),id:'second'}],[saleOpp]);assert.deepEqual(kinds(),['automatic','processing'],'two real offers retain both phases');
context.TPFInboxManual.category=()=> 'waiting';assert.deepEqual(kinds(),['waiting','automatic','processing'],'explicit waiting coexists with the commercial phase');
context.TPFInboxManual.category=()=>null;
inbox.ingestBusiness([offer('won')],[saleOpp]);
chatMeta={archived:true,archivedAt:now+2,lastIncomingAt:now-100};
sample._lastMessage={timestamp:now+90,direction:'out'};
inbox.ingestJobs([{context:{phone},completed_at:new Date((now+90)*1000).toISOString()}]);
assert.deepEqual(kinds(),['archived'],'after-sale automatic message must keep a resolved chat archived');
sample._lastMessage={timestamp:now+95,direction:'in'};assert.deepEqual(kinds(),['unanswered']);
console.log('WhatsApp commercial phases, legacy reviews, multiple offers and after-sale OK');
