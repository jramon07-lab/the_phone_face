const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
function section(start,end){
  const from=source.indexOf(start),to=source.indexOf(end,from);
  assert.ok(from>=0&&to>from,`No se encontró ${start}`);
  return source.slice(from,to);
}

const saved=[];
const context={
  waLiveState:{chats:[],unread:{chatA:59},livePreview:{}},
  localStorage:{setItem(key,value){saved.push([key,JSON.parse(value)]);}},
  waMessageTimestamp:message=>message?.timestamp||0,
  waRememberLivePreview(){},
};
vm.createContext(context);
vm.runInContext([
  section('function waSaveUnread()','function waUnreadCount('),
  section('function waChatServerUnread(','function waLivePreviewText('),
  section('function waApplySummaryChats(','async function waRefreshHybridSummary(')
].join('\n'),context);

context.waApplySummaryChats([
  {id:'chatA',unreadCount:2,_lastMessage:{timestamp:2}},
  {id:'chatB',unreadMessagesCount:0,_lastMessage:{timestamp:3}}
]);
assert.deepEqual(JSON.parse(JSON.stringify(context.waLiveState.unread)),{chatA:2,chatB:0});
assert.deepEqual(saved.at(-1),['tpf_wa_unread',{chatA:2,chatB:0}]);

// Una lectura realizada en otro PC se refleja en el siguiente resumen y no
// conserva el contador antiguo de este navegador.
context.waApplySummaryChats([{id:'chatA',unreadCount:0,_lastMessage:{timestamp:2}}]);
assert.deepEqual(JSON.parse(JSON.stringify(context.waLiveState.unread)),{chatA:0});
console.log('WhatsApp unread counters reconcile from the shared provider summary');
