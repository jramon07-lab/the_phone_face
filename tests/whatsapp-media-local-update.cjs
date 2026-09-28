'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
const code=source.slice(source.indexOf('async function hydrateWaMedia('),source.indexOf('\nfunction waApplyAvatar('));
function setup(ids){
 const nodes=ids.map(id=>({dataset:{waMediaId:id},getBoundingClientRect:()=>({bottom:200}),removeAttribute(){delete this.dataset.waMediaId},set outerHTML(v){this.html=v;delete this.dataset.waMediaId}}));
 const box={scrollHeight:1000,clientHeight:400,scrollTop:600,getBoundingClientRect:()=>({top:0})};
 let calls=0,redraws=0;
 const c={waLiveState:{selected:{id:'a'},selectionVersion:1,history:ids.map(idMessage=>({idMessage}))},waMediaCache:new Map(),waMediaPending:new Set(),document:{querySelectorAll:()=>nodes.filter(n=>n.dataset.waMediaId),getElementById:()=>box},waApi:async()=>{calls++;return {downloadUrl:'https://example.test/file'}},waMediaInfo:()=>({caption:'original caption'}),waMediaHtml:info=>{assert.equal(info.caption,'');return '<media>'},renderWaMessages:()=>redraws++};
 vm.createContext(c);vm.runInContext(code,c);return {c,nodes,box,calls:()=>calls,redraws:()=>redraws};
}
(async()=>{
 const a=setup(['one','two','three']);await a.c.hydrateWaMedia();
 assert.equal(a.calls(),3);assert.equal(a.redraws(),0,'resolving three files must not rebuild the conversation three times');assert.ok(a.nodes.every(n=>n.html==='<media>'));assert.equal(a.c.waMediaPending.size,0);
 const b=setup(['old']);let finish;b.c.waApi=()=>new Promise(r=>finish=r);const pending=b.c.hydrateWaMedia();b.c.waLiveState.selectionVersion++;finish({downloadUrl:'https://example.test/old'});await pending;assert.equal(b.nodes[0].html,undefined,'stale file must not touch new chat');
 const d=setup(['missing']);d.c.waLiveState.history=[];d.c.waMediaCache.set('a::missing','https://example.test/x');await d.c.hydrateWaMedia();assert.equal(d.nodes[0].textContent,'Archivo no disponible');assert.equal(d.redraws(),0,'orphan placeholder must not enter a redraw loop');
 const e=setup(['retry']);e.c.waApi=async()=>{throw new Error('timeout')};await e.c.hydrateWaMedia();assert.equal(e.c.waMediaCache.has('a::retry'),false,'temporary failure must remain retryable on reopening');assert.equal(e.c.waMediaPending.size,0);
 console.log('Media updates preserve message DOM, ignore stale chats and avoid permanent failure cache');
})().catch(e=>{console.error(e);process.exitCode=1});
