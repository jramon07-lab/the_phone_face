'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
const start=source.indexOf('function waContactLoading('),end=source.indexOf('\nasync function loadWaHistory',start);
const nodes=new Map(),events=[],pending=[],busy=[];
function node(id){if(!nodes.has(id))nodes.set(id,{dataset:{},style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){}},setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},closest:()=>({clientHeight:700}),getBoundingClientRect:()=>({height:315}),value:''});return nodes.get(id)}
const c={window:{dispatchEvent:e=>events.push(e.type)},Event:class{constructor(type){this.type=type}},waLiveState:{chats:[],avatars:{}},$:node,waSetUnread(){},waMarkActiveChatRow(){},localStorage:{setItem(){}},waApi:()=>Promise.resolve(),waNormalizePhone:x=>x,waInitials:()=>'',waApplyAvatar(){},waLoadAvatar:()=>Promise.resolve(''),loadWaHistory:()=>Promise.resolve(),matchWaContact:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),console};
vm.createContext(c);vm.runInContext(source.slice(start,end),c);
(async()=>{
 const a=c.window.selectWhatsAppChat('a');await Promise.resolve();
 assert.equal(node('waContactCard').dataset.waLoading,'true');assert.equal(node('waContactCard').inert,true);
 const b=c.window.selectWhatsAppChat('b');await Promise.resolve();
 pending[0].resolve();await a;assert.equal(node('waContactCard').dataset.waLoading,'true','old completion must not reveal the next contact');
 pending[1].resolve();await b;assert.equal(node('waContactCard').dataset.waLoading,undefined);assert.equal(node('waContactCard').inert,false);assert.equal(events.filter(x=>x==='tpf:wa-contact-ready').length,1);
 const failed=c.window.selectWhatsAppChat('c');await Promise.resolve();pending[2].reject(new Error('network'));await assert.rejects(failed,/network/);assert.equal(node('waContactCard').inert,false,'error must release the loading state');
 console.log('Contact placeholder preserves layout, ignores stale completion and releases on failure');
})().catch(e=>{console.error(e);process.exitCode=1});
