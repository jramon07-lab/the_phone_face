'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
const render=source.slice(source.indexOf('function renderWaMessages('),source.indexOf('\nasync function matchWaContact('));
let height=1200,top=0,anchorY=0,afterAnchorY=0,hasAnchor=false,load;
const box={clientHeight:400,get scrollHeight(){return height},get scrollTop(){return top},set scrollTop(v){top=Math.max(0,Math.min(v,height-400))},getBoundingClientRect:()=>({top:0}),querySelectorAll:()=>hasAnchor?[{dataset:{waMessageId:'anchor'},getBoundingClientRect:()=>({top:anchorY-top,bottom:anchorY-top+100})}]:[],removeEventListener(){},addEventListener(type,fn){load=fn},set innerHTML(v){this.html=v;top=0;anchorY=afterAnchorY}};
const timers=[],state={selectionVersion:1,history:[]};
const c={waLiveState:state,$:()=>box,setTimeout:(fn,ms)=>timers.push({fn,ms}),hydrateWaMedia(){},waMessageTimestamp:()=>0};
vm.createContext(c);vm.runInContext(render,c);
c.renderWaMessages(true);assert.equal(top,800,'opening must reach bottom synchronously');assert.ok(!timers.some(t=>t.ms===80));
height=1500;load();assert.equal(top,1100,'late image keeps the last message visible');
top=200;height=1700;load();assert.equal(top,200,'late image must respect manual scrolling');
// A background refresh inserts content above the message being read.
hasAnchor=true;top=300;anchorY=320;afterAnchorY=520;
c.renderWaMessages(false);assert.equal(top,500,'retain the visible message and its offset on redraw');
const staleLoad=load;state.selectionVersion++;top=40;staleLoad();assert.equal(top,40,'old chat callbacks cannot move the new chat');
// A media URL arriving after a chat switch must not redraw the new history.
const hydrate=source.slice(source.indexOf('async function hydrateWaMedia('),source.indexOf('\nfunction waApplyAvatar('));
let resolve,redraws=0;const mediaState={selected:{id:'a'},selectionVersion:1,history:[]};
const media={waLiveState:mediaState,waMediaCache:new Map(),waMediaPending:new Set(),document:{querySelectorAll:()=>[{dataset:{waMediaId:'file'}}]},waApi:()=>new Promise(r=>resolve=r),renderWaMessages(){redraws++}};
vm.createContext(media);vm.runInContext(hydrate,media);
(async()=>{const pending=media.hydrateWaMedia();mediaState.selected={id:'b'};mediaState.selectionVersion++;resolve({downloadUrl:'https://example.test/file'});await pending;assert.equal(redraws,0);assert.equal(media.waMediaPending.size,0);console.log('Stable initial scroll, media loading, reader position and chat-switch isolation');})().catch(e=>{console.error(e);process.exitCode=1});
