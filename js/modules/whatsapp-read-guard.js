(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const markers=new Map(),pending=new Map(),nativeObservations=new Map();let syncing=false;
const state=()=>{try{return waLiveState}catch(_){return window.waLiveState}};
const db=()=>{try{return sb}catch(_){return window.sb}};
function count(id){const row=markers.get(String(id));return row?row.count:null;}
function refresh(){window.renderWhatsAppChats?.();window.waUpdateStats?.();}
function apply(row){
 const id=String(row.chat_id),old=markers.get(id),ts=Number(row.read_ts||0);
 if(old&&old.ts>ts)return;
 const st=state(),live=st?.livePreview?.[id];
 let n=Math.max(0,Number(row.unread_count||0));
 if(live&&!live.outgoing&&Number(live.timestamp)>Math.max(ts,Number(row.last_incoming_ts||0)))n=Math.max(n,Number(st?.unread?.[id]||0));
 markers.set(id,{ts,count:n,lastIncoming:Number(row.last_incoming_ts||0)});
 if(st?.unread)st.unread[id]=n;
 window.waSetLastReadAt?.(id,ts);window.waSaveUnread?.();
}
async function sync(){
 if(syncing||!db()?.rpc||document.hidden)return;syncing=true;
 try{if(db().auth?.getSession){const {data}=await db().auth.getSession();if(!data?.session)return;}let after='';for(;;){const {data,error}=await db().rpc('crm_whatsapp_internal_reads',{p_after:after});if(error)throw error;for(const row of data||[])if(!pending.has(row.chat_id))apply(row);if((data||[]).length<500)break;after=data[data.length-1].chat_id;}refresh();}
 catch(e){M.report?.('whatsapp-read',e,'shared-read-sync');}
 finally{syncing=false;}
}

async function reconcileNative(result){
 const at=Number(result?.nativeReadSnapshotAt||0);
 if(!at||result?.degraded||result?.rateLimited||!Array.isArray(result?.chats)||!db()?.rpc||document.hidden)return;
 const ready=[],present=new Set();
 for(const chat of result.chats){
  const id=String(chat?.id||''),ts=Number(chat?._lastIncomingAt||markers.get(id)?.lastIncoming||0);present.add(id);
  if(!/^\d{10,15}@(c\.us|lid)$/.test(id)||chat?.unreadCount!==0||!Number.isSafeInteger(ts)||ts<=0||ts*1000>at-120000){
   nativeObservations.delete(id);continue;
  }
  if((markers.get(id)?.ts||0)>=ts){nativeObservations.delete(id);continue;}
  const previous=nativeObservations.get(id);
  if(!previous||previous.ts!==ts||at-previous.at>300000){nativeObservations.set(id,{ts,at});continue;}
  if(at-previous.at>=90000&&!pending.has(id))ready.push({id,ts});
 }
 for(const id of nativeObservations.keys())if(!present.has(id))nativeObservations.delete(id);
 // Exact last-message watermark preserves messages arriving during persistence.
 // A missing/stale provider count never means that a chat has been read.
 await Promise.all(ready.slice(0,20).map(async({id,ts})=>{
  try{
   const {data,error}=await db().rpc('crm_whatsapp_mark_internal_read',{p_chat_id:id,p_ts:ts});
   if(error)throw error;
   nativeObservations.delete(id);
  }catch(e){M.report?.('whatsapp-read',e,'native-read-sync');}
 }));
 if(ready.length)await sync();
}

async function safeRead(payload){
 const id=String(payload?.chatId||'');if(!id)return {ok:true,setRead:false,localOnly:true};
 const ts=Math.floor(Date.now()/1000),old=markers.get(id);
 if(old&&old.ts>=ts)return {ok:true,setRead:false,localOnly:true};
 markers.set(id,{ts,count:0});
 if(state()?.unread)state().unread[id]=0;
 if(!db()?.rpc)return {ok:true,setRead:false,localOnly:true};
 const task=(async()=>{try{const {data,error}=await db().rpc('crm_whatsapp_mark_internal_read',{p_chat_id:id,p_ts:ts});if(error)throw error;const current=markers.get(id);if(current&&current.ts<=Number(data))current.ts=Number(data);return {ok:true,setRead:false,localOnly:true};}catch(e){M.report?.('whatsapp-read',e,'persist-read');return {ok:true,setRead:false,localOnly:true,degraded:true};}finally{if(pending.get(id)===task)pending.delete(id);}})();
 pending.set(id,task);return task;
}
window.TPFPrivateReads={count,sync,reconcileNative};
M.register('whatsapp-read',{install(){
 function installGuard(){const base=window.waApi;if(typeof base!=='function'||base.__tpfReadSafeGuard)return false;const wrapped=async function(action,payload){if(String(action||'').toLowerCase()==='read')return safeRead(payload||{});const result=await base.apply(this,arguments);if(String(action||'').toLowerCase()==='summary')await reconcileNative(result);return result;};wrapped.__tpfReadSafeGuard=true;wrapped.__tpfReadSafeBase=base;window.waApi=wrapped;return true;}
 if(!installGuard()){let tries=0;const timer=setInterval(()=>{if(installGuard()||++tries>40)clearInterval(timer)},100);}
 if(typeof document!=='undefined'){setTimeout(sync,1200);setInterval(sync,20000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});}
}});
})();
