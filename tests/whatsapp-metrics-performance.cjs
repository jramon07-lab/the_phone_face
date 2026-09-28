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
