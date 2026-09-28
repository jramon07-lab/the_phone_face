'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
function extract(name,next){const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction '+next+'(',start);assert(start>=0&&end>start);return source.slice(start,end)}
const chats=Array.from({length:2500},(_,i)=>({id:String(i),_lastIncomingAt:100,_lastOutgoingAt:i%2?0:110,_lastMessage:{timestamp:100,direction:i%2?'in':'out'}}));
let lookups=0,hiddenWrites=0,visible=false;const nativeFind=chats.find.bind(chats);chats.find=(...args)=>{lookups++;return nativeFind(...args)};
const nodes={waAnalyticsModal:{classList:{contains:()=>!visible}},waAnalyticsWaitingList:{set innerHTML(v){hiddenWrites++;this.html=v}},waAWaiting:{textContent:''}};
const c={console,Date,Number,Math,waLiveState:{chats,livePreview:{}},waMeta:()=>({}),waMessageTimestamp:m=>m?.timestamp||0,waMessageDirection:m=>m?.direction,$:id=>nodes[id],waUnreadCount:()=>0,waRenderSla(){},waNormalizePhone:x=>x,esc:x=>String(x)};
vm.createContext(c);
vm.runInContext(extract('waIsUnanswered','waUpdateStats')+'\n'+extract('waResponseDurations','waFmtDuration')+'\n'+extract('waFmtDuration','waUpdateAdvancedMetrics')+'\n'+extract('waUpdateAdvancedMetrics','waRenderSla')+'\n'+source.slice(source.indexOf('function waSharedIncomingAt('),source.indexOf('\n$("waAnalyticsBtn")')),c);
c.waUpdateAdvancedMetrics();assert.equal(nodes.waAWaiting.textContent,1250);assert.equal(lookups,0,'large lists must not run a full chat search for each metric');assert.equal(hiddenWrites,0,'closed analytics must not rebuild hidden DOM');
visible=true;c.waUpdateAdvancedMetrics();assert.equal(hiddenWrites,1);assert.match(nodes.waAnalyticsWaitingList.html,/1250|esperando/);assert.equal(lookups,0);
assert.equal(c.waIsUnanswered('1'),true,'single-chat callers remain supported');
console.log('2500-chat metrics preserve counts with zero repeated searches and no hidden list redraw');

// Message actions must sort once, preserving the message bound to each row.
const start=source.indexOf('renderWaMessages=function(scrollBottom){');
const end=source.indexOf('\nlet waSelectedActionMessage',start);
let reads=0,action=null;
const history=Array.from({length:200},(_,i)=>({timestamp:200-i}));
const messageNodes=history.map(()=>({dataset:{}}));
const msgContext={waLiveState:{history,selected:null},_renderWaMessagesTotal(){},$:()=>({querySelectorAll:()=>messageNodes}),waMessageTimestamp(m){reads++;return m.timestamp},waOpenMessageActions(m){action=m}};
vm.runInNewContext(source.slice(start,end),msgContext);
msgContext.renderWaMessages(false);
assert.ok(reads<2000,'message actions must not sort the full history per row');
messageNodes[0].ondblclick();assert.equal(action.timestamp,1);
messageNodes[199].ondblclick();assert.equal(action.timestamp,200);
// Polling refreshes once and does not redraw the desktop list on another screen.
const manual=fs.readFileSync('js/modules/whatsapp-inbox-manual.js','utf8');
let hidden=false,redraws=0;
const inboxContext={document:{hidden:false},$:()=>({classList:{contains:()=>hidden}}),window:{renderWhatsAppChats(){redraws++}},controls(){},loading:false,generation:0,busy:new Set(),rows:new Map(),db:()=>({from:()=>({select:()=>({order:()=>({limit:()=>Promise.resolve({data:[]})})})})}),console};
vm.runInNewContext(manual.slice(manual.indexOf('function refresh(){'),manual.indexOf('async function save(')),inboxContext);
(async()=>{await inboxContext.sync(true);assert.equal(redraws,1);hidden=true;await inboxContext.sync(true);assert.equal(redraws,1);hidden=false;await inboxContext.sync();assert.equal(redraws,2);console.log('Message actions sort once; inbox polling renders once only on the visible desktop view');})().catch(e=>{console.error(e);process.exitCode=1});

// Opening analytics must populate immediately, not wait for the next timer.
nodes.waAnalyticsBtn={};nodes.waAnalyticsModal.classList.remove=()=>{visible=true};visible=false;
vm.runInContext(source.slice(source.indexOf('$("waAnalyticsBtn").onclick='),source.indexOf('\n$("waAnalyticsClose").onclick=')),c);
const writesBefore=hiddenWrites;nodes.waAnalyticsBtn.onclick();assert.equal(hiddenWrites,writesBefore+1);
