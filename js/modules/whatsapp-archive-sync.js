(function(){
'use strict';
const MODULE='whatsapp-archive-sync',SYNC_MS=20000;
let timer=0,syncing=false,installed=false;
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value||{},key);
const selectedId=()=>{try{return typeof waLiveState!=='undefined'?waLiveState.selected?.id:window.waLiveState?.selected?.id}catch(_){return null}};
const client=()=>{try{return typeof sb!=='undefined'&&sb?.from?sb:(window.sb?.from?window.sb:null)}catch(_){return window.sb?.from?window.sb:null}};
const seconds=value=>{if(!value)return 0;const numeric=Number(value);if(Number.isFinite(numeric)&&numeric>0)return numeric>1e12?numeric/1000:numeric;const parsed=Date.parse(value);return Number.isFinite(parsed)?parsed/1000:0};
const iso=value=>{const timestamp=seconds(value);return timestamp?new Date(timestamp*1000).toISOString():null};
function refresh(){try{window.renderWhatsAppChats?.();window.waUpdateStats?.();window.waRefreshChatTopButtons?.()}catch(_){}}
function undoNotice(chatId){
  document.getElementById('waArchiveUndo')?.remove();
  const notice=document.createElement('div');notice.id='waArchiveUndo';notice.innerHTML='<span>Conversación archivada</span><button type="button">Deshacer</button>';
  notice.querySelector('button').onclick=()=>{window.waMetaSave?.(chatId,{archived:false},{render:true});notice.remove();refresh()};
  document.body.appendChild(notice);setTimeout(()=>notice.remove(),7000);
}
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
    if(db.auth?.getSession){const {data}=await db.auth.getSession();if(!data?.session){schedule();return}}
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
    const result=baseButtons?.();const button=document.getElementById('waArchiveChat'),chatId=selectedId();if(button&&chatId){const archived=!!window.waMeta?.(chatId)?.archived;button.textContent=archived?'↥ Desarchivar':'✓ Archivar conversación';button.title=archived?'Devolver a conversaciones activas':'Apartar esta conversación cerrada';button.setAttribute?.('aria-label',button.title);button.classList?.add?.('waArchiveMain');button.onclick=()=>{const id=selectedId();if(!id)return;const next=!window.waMeta?.(id)?.archived;window.waMetaSave?.(id,{archived:next},{render:true});refresh();if(next)undoNotice(id)}}return result;
  };
  if(typeof document.createElement==='function'&&!document.getElementById('waArchiveSyncStyles')){const style=document.createElement('style');style.id='waArchiveSyncStyles';style.textContent='#view-whatsapplive #waArchiveChat.waArchiveMain{min-width:170px!important;padding:0 13px!important;font-weight:800!important;background:#eef6ff!important;color:#175cd3!important;border-color:#b2ccff!important}#waArchiveUndo{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:95000;display:flex;align-items:center;gap:18px;padding:12px 15px;border-radius:11px;background:#172033;color:#fff;box-shadow:0 15px 45px #10203355;font-size:12px}#waArchiveUndo button{border:0;background:transparent;color:#8fc5ff;font-weight:900;cursor:pointer}@media(max-width:700px){#view-whatsapplive #waArchiveChat.waArchiveMain{min-width:145px!important;font-size:10px!important}}';document.head.appendChild(style)}
  window.addEventListener('focus',sync);window.addEventListener('storage',event=>{if(event.key==='tpf_wa_chat_meta_v3')sync()});document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
  window.waRefreshChatTopButtons();sync();
}
window.TPFModules?.register?.(MODULE,{install});
if(!window.TPFModules)install();
})();
