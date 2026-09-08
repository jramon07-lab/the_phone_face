const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const moduleSource=fs.readFileSync(path.join(__dirname,'../js/modules/whatsapp-archive-sync.js'),'utf8');
const runtimeSource=fs.readFileSync(path.join(__dirname,'../js/modules/runtime.js'),'utf8');
const migration=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20260908073027_whatsapp_chat_archive_sync.sql'),'utf8');

const meta={chat:{archived:false,lastIncomingAt:0,lastOutgoingAt:0}};
const writes=[];
const listeners={};
const button={textContent:'',title:'',setAttribute(name,value){this[name]=value;}};
const db={from(table){assert.equal(table,'crm_whatsapp_chat_state');return {select:async()=>({data:[],error:null}),upsert:async payload=>{writes.push(payload);return {error:null};}};}};
const context={
  console,Date,clearTimeout,setTimeout(){return 1;},
  document:{hidden:false,getElementById(id){return id==='waArchiveChat'?button:null;},addEventListener(name,fn){listeners[name]=fn;}},
  window:{sb:db,waLiveState:{selected:{id:'chat'}},waMeta:id=>meta[id],waMetaAll:()=>meta,renderWhatsAppChats(){},waUpdateStats(){},
    waMetaSave(id,patch){meta[id]={...meta[id],...patch};},
    waTrackDirection(id,message){if(message.direction==='in')meta[id].lastIncomingAt=message.timestamp;},
    waMessageTimestamp:message=>message.timestamp,waMessageDirection:message=>message.direction,
    waRefreshChatTopButtons(){button.textContent=meta.chat.archived?'↥':'⌄';},
    addEventListener(name,fn){listeners[name]=fn;},TPFModules:{register(_name,definition){definition.install();},report(error){throw error;}}}
};
vm.createContext(context);vm.runInContext(moduleSource,context);

context.window.waMetaSave('chat',{archived:true});
assert.equal(meta.chat.archived,true);
assert.ok(meta.chat.archivedAt>0);
assert.equal(button.textContent,'✓ Archivar');
context.window.waRefreshChatTopButtons();
assert.equal(button.textContent,'↥ Recuperar');
context.window.waTrackDirection('chat',{direction:'in',timestamp:meta.chat.archivedAt-1});
assert.equal(meta.chat.archived,true,'Un mensaje anterior al archivo no debe recuperar el chat');
context.window.waTrackDirection('chat',{direction:'in',timestamp:meta.chat.archivedAt+1});
assert.equal(meta.chat.archived,false,'Un mensaje nuevo debe devolver el chat a activas');

assert.match(runtimeSource,/whatsapp-archive-sync\.js/);
assert.match(migration,/enable row level security/i);
assert.match(migration,/for select\s+to authenticated/i);
assert.match(migration,/for insert\s+to authenticated/i);
assert.match(migration,/for update\s+to authenticated/i);
assert.match(migration,/after insert on public\.wa_messages/i);
assert.match(migration,/message_at > archived_at/i);
assert.doesNotMatch(migration,/to anon/i);

Promise.resolve().then(()=>{
  assert.ok(writes.some(row=>row.archived===true));
  assert.ok(writes.some(row=>row.archived===false));
  console.log('WhatsApp archive sync and automatic recovery: ok');
}).catch(error=>{console.error(error);process.exitCode=1;});
