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
api.ingestJobs([{context:{phone:'34695661409'},action_config:{__delivery_receipt:{idMessage:'auto-1'}},completed_at:new Date(now*1000).toISOString()}]);

const chat={id:'34695661409@c.us',_lastMessage:{timestamp:now,direction:'out'}};
context.waLiveState.livePreview[chat.id]={timestamp:now,outgoing:true,idMessage:'auto-1'};
assert.equal(api.isAutomaticWaiting(chat),true,'El último envío automático debe salir de Conversaciones');

context.waLiveState.livePreview[chat.id]={timestamp:now+30,outgoing:false};
assert.equal(api.isAutomaticWaiting(chat),false,'La respuesta del cliente debe devolver el chat a Conversaciones');

context.waLiveState.livePreview[chat.id]={timestamp:now+1800,outgoing:true,idMessage:'phone-1'};
assert.equal(api.isAutomaticWaiting(chat),false,'Un envío manual posterior no puede quedar clasificado como automático');

context.waLiveState.livePreview[chat.id]={timestamp:now+30,outgoing:true,idMessage:'phone-2'};
storage.set('tpf_wa_manual_outgoing_v1',JSON.stringify({'695661409':(now+30)*1000}));
// Vuelve a cargar el módulo para comprobar la caché manual desde el almacenamiento.
const second={...context,TPFModules:{register(){}},TPFAutomationInbox:undefined};second.window=second;
vm.runInNewContext(fs.readFileSync('js/modules/whatsapp-automation-inbox.js','utf8'),second,{filename:'whatsapp-automation-inbox.js'});
second.TPFAutomationInbox.ingestJobs([{context:{contact_phone:'695661409'},action_config:{__delivery_receipt:{idMessage:'auto-1'}},completed_at:new Date(now*1000).toISOString()}]);
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

for(const status of ['following','accepted','processed']){
 inbox.ingestBusiness([offer(status)],[saleOpp]);
 chatMeta={archived:true,archivedAt:now+200};sample._lastMessage={timestamp:now+100,direction:'in'};
 assert.deepEqual(kinds(),[status==='following'?'automatic':'processing'],'attending keeps the commercial phase');
 assert.equal(inbox.matchesFilter(sample,'archived'),false);
 sample._lastMessage={timestamp:now+201,direction:'in'};
 assert.ok(kinds().includes('unanswered'),'new incoming needs attention again');
}
inbox.ingestBusiness([],[]);chatMeta={archived:true,archivedAt:now+300};
assert.deepEqual(kinds(),['archived'],'attended chat without active offer is archived');

// Only actual customer declines enter this inbox; attending and archiving are distinct.
chatMeta={};sample._lastMessage={timestamp:now+400,direction:'in'};
inbox.ingestBusiness([offer('lost')],[saleOpp]);assert.deepEqual(kinds(),['unanswered']);
const declinedOffer={...offer('lost'),customer_declined_at:new Date((now+400)*1000).toISOString()};
inbox.ingestBusiness([declinedOffer],[saleOpp]);assert.deepEqual(kinds(),['unanswered','declined']);
chatMeta={archived:true,archivedAt:now+410};assert.deepEqual(kinds(),['declined'],'attending retains declined inbox');
inbox.ingestDeclineArchives([{chat_id:chatId,declined_archived_at:new Date((now+420)*1000).toISOString()}]);
assert.deepEqual(kinds(),['archived'],'explicit archive dismisses declined inbox');
sample._lastMessage={timestamp:now+430,direction:'in'};assert.deepEqual(kinds(),['unanswered','declined'],'new customer message reopens');
inbox.ingestBusiness([declinedOffer,{...offer('following'),id:'other'}],[saleOpp]);assert.deepEqual(kinds(),['unanswered','automatic','declined']);
sample._lastMessage={timestamp:now+400,direction:'in'};chatMeta={archived:true,archivedAt:now+420};
assert.deepEqual(kinds(),['automatic'],'archiving refusal preserves other active offers');
console.log('Customer decline inbox and explicit archival OK');

// Offer work plans share the existing Agenda task, never create a second reminder.
const iso=s=>new Date(s*1000).toISOString();
const planned={...offer('following'),updated_at:iso(now-3600),next_action:'Revisar documentación',next_action_at:iso(now+86400),plan_task_id:'existing-task',plan_task:{status:'pending',starts_at:iso(now+86400),title:'Revisar documentación'}};
chatMeta={};sample._lastMessage={timestamp:now-7200,direction:'out'};
context.TPFInboxManual.since=()=>0;
inbox.ingestBusiness([planned],[saleOpp]);assert.deepEqual(kinds(),['snoozed','automatic']);
assert.equal(inbox.workPlan(sample).at,now+86400);
assert.match(inbox.describe(sample),/Próxima acción: Revisar documentación/);
sample._lastMessage={timestamp:now-60,direction:'in'};assert.deepEqual(kinds(),['unanswered','automatic'],'new incoming interrupts future snooze');
sample._lastMessage={timestamp:now,direction:'out'};assert.deepEqual(kinds(),['snoozed','automatic'],'manual reply returns to the remaining planned action');
const due={...planned,plan_task:{...planned.plan_task,starts_at:iso(now-30)}};
inbox.ingestBusiness([due],[saleOpp]);assert.deepEqual(kinds(),['unanswered','automatic'],'edited task date overrides old offer date');
assert.match(inbox.describe(sample),/Próxima acción vencida/);
chatMeta={archived:true,archivedAt:now-40};assert.deepEqual(kinds(),['unanswered','automatic'],'attending before the deadline does not swallow the reminder');
chatMeta={archived:true,archivedAt:now};assert.deepEqual(kinds(),['automatic'],'attending after the deadline dismisses its pending badge');
inbox.ingestBusiness([planned],[saleOpp]);assert.deepEqual(kinds(),['snoozed','automatic'],'a rescheduled future task reappears');
chatMeta={};
for(const status of ['completed','cancelled']){
 inbox.ingestBusiness([{...planned,plan_task:{...planned.plan_task,status}}],[saleOpp]);assert.deepEqual(kinds(),['automatic'],status+' task removes the snooze');
}
inbox.ingestBusiness([{...planned,plan_task:null}],[saleOpp]);assert.deepEqual(kinds(),['automatic'],'inaccessible linked tasks cannot invent reminders');
inbox.ingestBusiness([{...planned,plan_task:null,plan_task_id:null,next_action_at:null}],[saleOpp]);assert.deepEqual(kinds(),['automatic'],'deleted task clears the linked date');
inbox.ingestBusiness([{...planned,plan_task:null,plan_task_id:null}],[saleOpp]);assert.deepEqual(kinds(),['snoozed','automatic'],'dated plan without an Agenda notification still classifies');
context.TPFInboxManual.since=()=>now-10;context.TPFInboxManual.category=()=> 'waiting';
assert.deepEqual(kinds(),['waiting','automatic'],'a later explicit wait takes precedence');
context.TPFInboxManual.since=()=>0;context.TPFInboxManual.category=()=>null;
inbox.ingestBusiness([planned,{...due,id:'second'}],[saleOpp]);assert.deepEqual(kinds(),['unanswered','automatic'],'earliest pending action wins across multiple real offers');
inbox.ingestBusiness([{...planned,status:'won'}],[saleOpp]);assert.deepEqual(kinds(),['archived'],'old plans on closed offers do not reopen the sale');
inbox.ingestBusiness([],[]);assert.deepEqual(kinds(),['all'],'reply without an offer remains in Todos');
sample._lastMessage={timestamp:now+10,direction:'in'};assert.deepEqual(kinds(),['unanswered'],'next customer reply needs attention');
console.log('Linked offer plans: future, due, incoming, attendance, edits, completion and multiple offers OK');

// Real provider IDs distinguish phone replies even at exactly the same time.
context.waLiveState.livePreview={};chatMeta={};context.TPFInboxManual.category=()=>null;context.TPFInboxManual.since=()=>0;
inbox.ingestBusiness([offer('following')],[saleOpp]);
inbox.ingestJobs([{context:{phone},action_config:{__delivery_receipt:{idMessage:'offer-auto',acceptedAt:iso(now)}},updated_at:iso(now)}]);
sample._lastIncomingAt=now-100;sample._lastMessage={timestamp:now,idMessage:'offer-auto',direction:'out'};
assert.deepEqual(kinds(),['unanswered','automatic'],'automatic receipt does not resolve customer attention');
sample._lastMessage={timestamp:now,idMessage:'native-phone-reply',direction:'out'};
assert.deepEqual(kinds(),['automatic'],'native phone reply at the same second removes message attention');
sample._lastMessage={timestamp:now+1,idMessage:'new-incoming',direction:'in'};assert.deepEqual(kinds(),['unanswered','automatic']);
inbox.ingestJobs([{context:{phone},completed_at:iso(now)}]);sample._lastMessage={timestamp:now,idMessage:'native-phone-reply',direction:'out'};
assert.equal(inbox.isAutomaticWaiting(sample),false,'historical jobs without receipts cannot label a phone reply automatic');
console.log('Provider receipts distinguish native phone replies without timestamp guessing');

// Delivery-confirmed recipient wins over an obsolete offer snapshot, even
// when offer data loads before the provider receipts.
api.ingestBusiness([{id:'receipt-offer',opportunity_id:'receipt-opp',status:'following',snapshot:{recipient_phone:'600000001'}}],[{id:'receipt-opp',phone:'600000002'}]);
api.ingestJobs([{context:{offer_instance_id:'receipt-offer',phone:'600000001'},action_config:{__delivery_receipt:{chatId:'34600000002@c.us',idMessage:'confirmed'}},completed_at:new Date().toISOString()}]);
const actual={id:'34600000002@c.us',_lastIncomingAt:now,_lastMessage:{direction:'in',timestamp:now}};
assert.equal(api.business(actual).automatic,true);
assert.equal(api.business({id:'34600000001@c.us'}),undefined,'Old snapshot must not classify another conversation');
assert(api.facets(actual).includes('automatic'));assert(api.facets(actual).includes('unanswered'),'A reply keeps the automatic phase and needs attention');
api.ingestBusiness([{id:'receipt-offer',opportunity_id:'receipt-opp',status:'accepted',snapshot:{recipient_phone:'600000001'}}],[]);
assert(api.facets(actual).includes('processing'));assert(!api.facets(actual).includes('automatic'));
console.log('Confirmed recipient classification survives asynchronous receipt loading and preserves offer phases');
