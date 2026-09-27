(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const markers=new Map(),pending=new Map();let syncing=false;
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
 markers.set(id,{ts,count:n});
 if(st?.unread)st.unread[id]=n;
 window.waSetLastReadAt?.(id,ts);window.waSaveUnread?.();
}
async function sync(){
 if(syncing||!db()?.rpc||document.hidden)return;syncing=true;
 try{let after='';for(;;){const {data,error}=await db().rpc('crm_whatsapp_internal_reads',{p_after:after});if(error)throw error;for(const row of data||[])if(!pending.has(row.chat_id))apply(row);if((data||[]).length<500)break;after=data[data.length-1].chat_id;}refresh();}
 catch(e){M.report?.('whatsapp-read',e,'shared-read-sync');}
 finally{syncing=false;}
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
window.TPFPrivateReads={count,sync};
M.register('whatsapp-read',{install(){
 function installGuard(){const base=window.waApi;if(typeof base!=='function'||base.__tpfReadSafeGuard)return false;const wrapped=async function(action,payload){if(String(action||'').toLowerCase()==='read')return safeRead(payload||{});return base.apply(this,arguments);};wrapped.__tpfReadSafeGuard=true;wrapped.__tpfReadSafeBase=base;window.waApi=wrapped;return true;}
 if(!installGuard()){let tries=0;const timer=setInterval(()=>{if(installGuard()||++tries>40)clearInterval(timer)},100);}
 if(typeof document!=='undefined'){setTimeout(sync,1200);setInterval(sync,20000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});}
}});
})();
