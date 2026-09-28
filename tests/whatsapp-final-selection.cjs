'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
const code=source.slice(source.indexOf('const _selectWhatsAppChatTotal='),source.indexOf('/* Media gallery */'));
const state={selected:null,history:[]},pending=[],marked=[];
const c={window:{selectWhatsAppChat:id=>{state.selected={id};return new Promise(resolve=>pending.push(resolve))}},waLiveState:state,waReadSuppressUntil:{},waSetLastReadAt(){},waSetUnread(){},waMarkActiveChatRow:id=>marked.push(id),waUpdateStats(){},waApi:async()=>{},waRefreshChatTopButtons(){},waRenderSideExtras(){},waMessageTimestamp:()=>0};
vm.createContext(c);vm.runInContext(code,c);
(async()=>{
 const a=c.window.selectWhatsAppChat('a'),b=c.window.selectWhatsAppChat('b');
 pending[1]();await b;pending[0]();await a;
 assert.deepEqual(marked,['b'],'a late completion must never reactivate the old conversation');
 marked.length=0;
 const old=c.window.selectWhatsAppChat('a'),other=c.window.selectWhatsAppChat('b'),newest=c.window.selectWhatsAppChat('a');
 pending[4]();await newest;pending[2]();await old;pending[3]();await other;
 assert.deepEqual(marked,['a'],'even returning to the same chat must discard its earlier request');
 console.log('Only the latest chat selection updates active row, counters and side panel');
})().catch(e=>{console.error(e.message);process.exitCode=1});
