'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/whatsapp-archive-sync.js','utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(rows=[]){
  const meta={},errors=[],writes=[],reads=[],listeners={};
  const config={read:null,write:null};
  const db={auth:{getSession:async()=>({data:{session:{user:{id:'demo'}}}})},from(){return {
    select(){let after='',size=1000;const query={order(){return query;},limit(n){size=n;return query;},gt(_key,value){after=value;return query;},then(ok,bad){reads.push({after,size});return Promise.resolve(config.read?config.read({after,size}):{data:rows.filter(row=>row.chat_id>after).slice(0,size),error:null}).then(ok,bad);}};return query;},
    upsert(payload,options){writes.push({payload,options});return config.write?config.write(payload):Promise.resolve({error:null});}
  };}};
  const context={console,Date,setTimeout(){return 1;},clearTimeout(){},document:{hidden:false,getElementById(){return null;},addEventListener(){}},window:{sb:db,waMeta:id=>meta[id]||{},waMetaAll:()=>meta,waMetaSave(id,patch){meta[id]={...meta[id],...patch};},waTrackDirection(){},waRefreshChatTopButtons(){},addEventListener(name,fn){listeners[name]=fn;},TPFModules:{register(_name,definition){definition.install();},report(...args){errors.push(args);}}}};
  vm.createContext(context);vm.runInContext(source.replace("window.TPFModules?.register?.(MODULE,{install});","window.__archiveTest={sync};\nwindow.TPFModules?.register?.(MODULE,{install});"),context);
  return {meta,config,writes,reads,errors,window:context.window,sync:context.window.__archiveTest.sync};
}
const cases=[
  ['Móvil lee todos los estados y conserva la instantánea anterior si falla una página',async()=>{
    const mobile=fs.readFileSync('js/mobile-app.js','utf8');
    const code=mobile.slice(mobile.indexOf('  const mobileWaArchiveSeconds='),mobile.indexOf('  async function saveMobileWaArchiveState'));
    const rows=Array.from({length:1201},(_,i)=>({chat_id:'chat'+String(i).padStart(5,'0'),archived:i===1200}));
    let fail=false;
    const context={state:{whatsapp:{archiveStates:{}}},client:{from(){return {select(){let after='',size=1000;const q={order(){return q},limit(n){size=n;return q},gt(_key,value){after=value;return q},then(ok,bad){return Promise.resolve(fail&&after?{error:new Error('offline')}:{data:rows.filter(r=>r.chat_id>after).slice(0,size)}).then(ok,bad)}};return q}}}}};
    vm.createContext(context);vm.runInContext(code,context);
    await context.loadMobileWaArchiveStates();assert.equal(Object.keys(context.state.whatsapp.archiveStates).length,1201);assert.equal(context.state.whatsapp.archiveStates.chat01200.archived,true);
    const previous=context.state.whatsapp.archiveStates;fail=true;await context.loadMobileWaArchiveStates();assert.equal(context.state.whatsapp.archiveStates,previous);
  }],
  ['Una lectura iniciada antes del clic no revierte el archivo confirmado',async()=>{
    const f=fixture([{chat_id:'chat',archived:false}]);await flush();
    const held=deferred();f.config.read=()=>held.promise;const reading=f.sync();await flush();
    f.window.waMetaSave('chat',{archived:true});await flush();
    held.resolve({data:[{chat_id:'chat',archived:false}],error:null});await reading;
    assert.equal(f.meta.chat.archived,true);
  }],
  ['Un guardado rechazado recupera el estado anterior y comunica el fallo',async()=>{
    const f=fixture([{chat_id:'chat',archived:false}]);await flush();
    f.config.write=async()=>({error:new Error('offline')});
    f.window.waMetaSave('chat',{archived:true});await flush();
    assert.equal(f.meta.chat.archived,false);assert.ok(f.errors.length);
  }],
  ['Archivar y deshacer se guardan en el orden del usuario',async()=>{
    const f=fixture([{chat_id:'chat',archived:false}]);await flush();
    const first=deferred();f.config.write=()=>f.writes.length===1?first.promise:Promise.resolve({error:null});
    f.window.waMetaSave('chat',{archived:true});f.window.waMetaSave('chat',{archived:false});await flush();
    assert.equal(f.writes.length,1,'Solo debe haber una escritura del mismo chat en vuelo');
    first.resolve({error:null});await flush();await flush();
    assert.deepEqual(f.writes.map(w=>w.payload.archived),[true,false]);assert.equal(f.meta.chat.archived,false);
  }],
  ['Lee más de mil estados sin volver a archivar un chat recuperado por otro PC',async()=>{
    const rows=Array.from({length:1201},(_,i)=>({chat_id:'chat'+String(i).padStart(5,'0'),archived:false}));
    const f=fixture(rows);f.meta.chat01200={archived:true,archivedAt:1};await flush();await flush();
    assert.equal(f.meta.chat01200.archived,false);assert.equal(f.writes.length,0);assert.ok(f.reads.length>=3);
  }],
  ['Dos escrituras rechazadas recuperan el último estado confirmado',async()=>{
    const f=fixture([{chat_id:'chat',archived:false}]);await flush();
    f.config.write=async()=>({error:new Error('offline')});
    f.window.waMetaSave('chat',{archived:true});f.window.waMetaSave('chat',{archived:false});await flush();await flush();
    assert.equal(f.meta.chat.archived,false);assert.equal(f.errors.length,2);
  }],
  ['Si falla una página, conserva el estado completo anterior',async()=>{
    const f=fixture();await flush();f.meta.chat={archived:true,archivedAt:1};
    f.config.read=({after})=>after?{data:null,error:new Error('offline')}:{data:Array.from({length:500},(_,i)=>({chat_id:'chat'+String(i).padStart(5,'0'),archived:false}))};
    await f.sync();assert.equal(f.meta.chat.archived,true);assert.equal(f.writes.length,0);assert.ok(f.errors.length);
  }]
];
(async()=>{let failed=0;for(const [name,run] of cases){try{await run();console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+': '+error.message);}}if(failed)process.exitCode=1;})().catch(error=>{console.error(error);process.exitCode=1;});
