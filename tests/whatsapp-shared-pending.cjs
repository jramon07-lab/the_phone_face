const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
const fn=source.slice(source.indexOf('function waIsUnanswered('),source.indexOf('function waUpdateStats(){',source.indexOf('function waIsUnanswered(')));
function device(meta){const ctx={waLiveState:{chats:[{id:'A',_lastMessage:{timestamp:20,outgoing:true}},{id:'B',_lastMessage:{timestamp:30,outgoing:false}}],livePreview:{}},waMeta:()=>meta,waMessageTimestamp:m=>m?.timestamp||0,waMessageDirection:m=>m.outgoing?'out':'in'};vm.runInNewContext(fn,ctx);return ctx;}
const one=device({lastIncomingAt:100,lastOutgoingAt:0}),two=device({lastIncomingAt:0,lastOutgoingAt:200});
for(const d of [one,two]){assert.equal(d.waIsUnanswered('A'),false);assert.equal(d.waIsUnanswered('B'),true);assert.equal(d.waIsUnanswered('missing'),false)}
one.waLiveState.livePreview.B={timestamp:31,outgoing:true};assert.equal(one.waIsUnanswered('B'),false);
one.waLiveState.chats[1]._lastMessage={timestamp:32,outgoing:false};assert.equal(one.waIsUnanswered('B'),true);
console.log('Different browser caches produce identical pending counts from shared messages');
