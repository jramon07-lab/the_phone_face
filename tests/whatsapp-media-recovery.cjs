const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/modules/whatsapp-media-recovery.js','utf8');
function fixture(api=async()=>({downloadUrl:'https://media.test/renewed.oga'})){
 const reports=[],timers=[],listeners={},events={};let requests=0;
 const media={dataset:{waMediaMessage:'synthetic'},isConnected:true,tagName:'AUDIO',src:'https://media.test/expired.oga',parentElement:{querySelector:()=>null},matches:()=>true,addEventListener:(type,fn)=>listeners[type]=fn,load(){},setAttribute(name,value){this[name]=value;},after(notice){this.notice=notice;}};
 const state={selected:{id:'synthetic-chat'},selectionVersion:1,history:[{idMessage:'synthetic'}]};
 const c={window:{addEventListener:(type,fn)=>events[type]=fn,tpfReportSystemEvent:row=>reports.push(row)},waLiveState:state,waMediaCache:new Map(),waApi:async(action,body)=>{assert.equal(action,'file');assert.equal(body.chatId,'synthetic-chat');requests++;return api();},document:{createElement:()=>({})},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){}};
 vm.createContext(c);vm.runInContext(source,c);
 const fail=()=>events.error({target:media});
 return {c,media,state,reports,timers,listeners,fail,failTarget:target=>events.error({target}),requests:()=>requests};
}
const settle=()=>new Promise(setImmediate);
(async()=>{
 let f=fixture();f.fail();f.fail();await settle();assert.equal(f.requests(),1);assert.equal(f.media.src,'https://media.test/renewed.oga');assert.equal(f.reports.length,0);f.listeners.loadedmetadata();f.timers[0]();assert.equal(f.reports.length,0,'A loaded file must not produce a delayed warning');
 f=fixture();f.fail();await settle();f.fail();assert.equal(f.reports.length,1,'Persistent playback failure remains visible');assert.equal(f.reports[0].severity,'warning');f.fail();assert.equal(f.requests(),1,'Do not loop the provider for a broken file');
 const reopened={...f.media};f.failTarget(reopened);await settle();f.failTarget(reopened);assert.equal(f.reports.length,1,'Rerendering the same failed file must not flood telemetry');assert.equal(f.reports[0].action,'Recuperar archivo de WhatsApp');assert.match(f.reports[0].detail,/Mensaje: synthetic/);
 f=fixture(async()=>{throw Error('provider unavailable')});f.fail();await settle();assert.equal(f.reports.length,1);assert.equal(f.media.src,'https://media.test/expired.oga');
 f=fixture(async()=>({available:false,reason:'file_unavailable'}));f.fail();await settle();assert.match(f.media.notice.textContent,/archivo antiguo.*no está disponible/);assert.match(f.media.notice.textContent,/móvil.*reenvíen/);assert.equal(f.requests(),1);
 f=fixture(async()=>{throw Error('connection timeout')});f.fail();await settle();assert.match(f.media.notice.textContent,/No se pudo cargar/);assert.doesNotMatch(f.media.notice.textContent,/ya no está disponible/,'A temporary network error must not be presented as a lost file');
 let finish;f=fixture(()=>new Promise(resolve=>finish=resolve));f.fail();f.state.selectionVersion++;finish({downloadUrl:'https://media.test/stale'});await settle();assert.equal(f.media.src,'https://media.test/expired.oga','Stale replies cannot modify a new conversation');assert.equal(f.reports.length,0);
 f=fixture(async()=>({downloadUrl:'javascript:bad'}));f.fail();await settle();assert.equal(f.reports.length,1);assert.equal(f.media.src,'https://media.test/expired.oga','Never render an unsafe provider URL');
 console.log('PASS media recovery: read-only renewal, bounded attempts, playback evidence, visible persistent failure and stale selection');
})().catch(e=>{console.error(e);process.exitCode=1});
