(function(){
'use strict';
const MODULE='whatsapp-archive-sync',SYNC_MS=20000;
let timer=0,syncing=false,installed=false;
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value||{},key);
const client=()=>{try{return typeof sb!=='undefined'&&sb?.from?sb:(window.sb?.from?window.sb:null)}catch(_){return window.sb?.from?window.sb:null}};
const seconds=value=>{if(!value)return 0;const numeric=Number(value);if(Number.isFinite(numeric)&&numeric>0)return numeric>1e12?numeric/1000:numeric;const parsed=Date.parse(value);return Number.isFinite(parsed)?parsed/1000:0};
const iso=value=>{const timestamp=seconds(value);return timestamp?new Date(timestamp*1000).toISOString():null};
function refresh(){try{window.renderWhatsAppChats?.();window.waUpdateStats?.();window.waRefreshChatTopButtons?.()}catch(_){}}
async function persist(chatId,archived,archivedAt=0){
  const db=client();if(!db||!chatId)return false;
  const payload={chat_id:String(chatId),archived:!!archived,updated_at:new Date().toISOString()};
  if(archived)payload.archived_at=iso(archivedAt)||payload.updated_at;
  else payload.reopened_at=payload.updated_at;
  const {error}=await db.from('crm_whatsapp_chat_state').upsert(payload,{onConflict:'chat_id'});
  if(error)throw error;return true;
}
async function sync(){
  const db=client();if(!db||syncing||document.hidden)return;syncing=true;
  try{
    const {data,error}=await db.from('crm_whatsapp_chat_state').select('chat_id,archived,archived_at,reopened_at,updated_at');
    if(error)throw error;
    const remote=new Map((data||[]).map(row=>[String(row.chat_id),row]));
    let changed=false;
    for(const [chatId,row] of remote){
      const current=window.waMeta?.(chatId)||{},archivedAt=seconds(row.archived_at);
      if(!!current.archived!==!!row.archived||Number(current.archivedAt||0)!==archivedAt){
        window.__tpfWaArchiveBaseSave?.(chatId,{archived:!!row.archived,archivedAt,reopenedAt:seconds(row.reopened_at)},{persist:true,render:false});changed=true;
      }
    }
    const local=window.waMetaAll?.()||{};
    const legacy=Object.entries(local).filter(([chatId,meta])=>meta?.archived&&!remote.has(chatId));
    for(const [chatId,meta] of legacy)await persist(chatId,true,meta.archivedAt||Date.now()/1000);
    if(changed)refresh();
  }catch(error){window.TPFModules?.report?.(MODULE,error,'sync')}
  finally{syncing=false;schedule()}
}
function schedule(){clearTimeout(timer);timer=setTimeout(sync,SYNC_MS)}
function install(){
  if(installed||typeof window.waMetaSave!=='function'||typeof window.waTrackDirection!=='function'){setTimeout(install,100);return}
  installed=true;
  const baseSave=window.waMetaSave,baseTrack=window.waTrackDirection,baseButtons=window.waRefreshChatTopButtons;
  window.__tpfWaArchiveBaseSave=baseSave;
  window.waMetaSave=function(chatId,patch,options={}){
    const next={...(patch||{})},changed=own(next,'archived');
    if(changed&&next.archived&&!next.archivedAt)next.archivedAt=Math.floor(Date.now()/1000);
    if(changed&&!next.archived)next.reopenedAt=Math.floor(Date.now()/1000);
    const result=baseSave(chatId,next,options);
    if(changed&&options.remote!==false)persist(chatId,!!next.archived,next.archivedAt).catch(error=>window.TPFModules?.report?.(MODULE,error,'persist'));
    return result;
  };
  window.waTrackDirection=function(chatId,message,options={}){
    const result=baseTrack(chatId,message,options),meta=window.waMeta?.(chatId)||{},timestamp=seconds(window.waMessageTimestamp?.(message)||Date.now()/1000),direction=window.waMessageDirection?.(message);
    if(direction==='in'&&meta.archived&&timestamp>Number(meta.archivedAt||0))window.waMetaSave(chatId,{archived:false,lastIncomingAt:Math.max(timestamp,Number(meta.lastIncomingAt||0))},{...options,render:true});
    return result;
  };
  window.waRefreshChatTopButtons=function(){
    const result=baseButtons?.();const button=document.getElementById('waArchiveChat'),chatId=window.waLiveState?.selected?.id;if(button&&chatId){const archived=!!window.waMeta?.(chatId)?.archived;button.textContent=archived?'↥ Recuperar':'✓ Archivar';button.title=archived?'Devolver a conversaciones activas':'Apartar esta conversación cerrada';button.setAttribute('aria-label',button.title)}return result;
  };
  window.addEventListener('focus',sync);window.addEventListener('storage',event=>{if(event.key==='tpf_wa_chat_meta_v3')sync()});document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
  window.waRefreshChatTopButtons();sync();
}
window.TPFModules?.register?.(MODULE,{install});
if(!window.TPFModules)install();
})();
