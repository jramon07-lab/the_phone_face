'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
const normal=core.slice(core.indexOf('async function sendWaLiveMessage(){'),core.indexOf('\nlet waLastHistoryFallback'));
const quoteSource=fs.readFileSync('js/modules/whatsapp-reply-isolated.js','utf8');
const quoted=quoteSource.slice(quoteSource.indexOf('  async function sendQuoted(){'),quoteSource.indexOf('\n  window.tpfWhatsAppQuotedReply'));
function fixture(quote=false){
 const elements={waComposerText:{value:'Fixture message'},waComposerSend:{},waComposerMsg:{}};
 const state={selected:{id:'fixture@c.us'},drafts:{'fixture@c.us':'Fixture message'}},calls=[],pushed=[];let settle,reject;
 const reminders={get:()=>null,sent:()=>{throw Error('Fixture optional UI failed');}};
 const context={waLiveState:state,$:id=>elements[id],document:{getElementById:id=>elements[id]},window:{TPFReplyReminders:reminders},TPFReplyReminders:reminders,waApi:(_action,args)=>{calls.push(args);return new Promise((yes,no)=>{settle=yes;reject=no;})},waPushLiveMessage:m=>pushed.push(m),waRememberLivePreview(){},renderWhatsAppChats(){},setTimeout(){},Date,console:{warn(){}}};
 context.fetch=(_url,opts)=>{calls.push(JSON.parse(opts.body));return new Promise((yes,no)=>{settle=body=>yes({ok:true,json:async()=>body});reject=no;})};
 vm.createContext(context);vm.runInContext(quote?'let selected={idMessage:"fixture-quote"},busy=false;function clearReply(){selected=null};'+quoted+';this.send=sendQuoted;':normal+';this.send=sendWaLiveMessage;',context);
 return {context,elements,state,calls,pushed,settle:body=>settle(body),reject:error=>reject(error)};
}
(async()=>{
 for(const quote of [false,true]){
  const f=fixture(quote),first=f.context.send();await f.context.send();assert.equal(f.calls.length,1,'repeated send while pending makes one request');
  f.settle({idMessage:'fixture-receipt'});await first;
  assert.equal(f.elements.waComposerText.value,'','accepted message clears even when reminder UI throws');assert.equal(f.state.drafts['fixture@c.us'],undefined);assert.equal(f.state.composerSending,false);assert.equal(f.elements.waComposerSend.disabled,false);assert.equal(f.pushed.length,1);
  if(!quote){await f.context.send();assert.equal(f.calls.length,1,'click after success cannot resend cleared text');}
  const changed=fixture(quote),pending=changed.context.send();changed.elements.waComposerText.value='New draft';changed.state.drafts['fixture@c.us']='New draft';changed.settle({idMessage:'second'});await pending;assert.equal(changed.elements.waComposerText.value,'New draft');assert.equal(changed.state.drafts['fixture@c.us'],'New draft');
  const other=fixture(quote),old=other.context.send();other.state.selected={id:'other@c.us'};other.elements.waComposerText.value='Other draft';other.settle({idMessage:'third'});await old;assert.equal(other.elements.waComposerText.value,'Other draft');assert.equal(other.pushed.length,0);
  const failed=fixture(quote),attempt=failed.context.send();failed.reject(Error('Fixture offline'));await attempt;assert.equal(failed.elements.waComposerText.value,'Fixture message');assert.equal(failed.state.drafts['fixture@c.us'],'Fixture message');assert.equal(failed.state.composerSending,false);
  const blocked=fixture(quote);blocked.state.composerSending=true;await blocked.context.send();assert.equal(blocked.calls.length,0,'text and quoted sends share pending guard');
 }
 const scheduled=fixture(),pending=scheduled.context.send();scheduled.settle({scheduled:true,scheduledAt:'2026-10-09T08:00:00Z',scheduleId:'fixture-schedule'});await pending;assert.equal(scheduled.elements.waComposerText.value,'');assert.equal(scheduled.pushed.length,0,'queued message is not shown as already sent');assert.match(scheduled.elements.waComposerMsg.textContent,/Programado/);
 const renderFailed=fixture();renderFailed.context.waPushLiveMessage=()=>{throw Error('Fixture renderer failed')};const accepted=renderFailed.context.send();renderFailed.settle({idMessage:'confirmed'});await accepted;assert.equal(renderFailed.elements.waComposerText.value,'');assert.match(renderFailed.elements.waComposerMsg.textContent,/no repitas/);
 console.log('PASS text/quoted single-flight, accepted draft cleanup despite reminder/UI failures, queued sends, changed drafts, other chat and failed request preservation');
})().catch(error=>{console.error(error);process.exitCode=1});
