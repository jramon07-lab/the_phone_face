'use strict';

const crypto=require('crypto');
const T=require('../lib/telegram-agenda-core');

const SB_URL=String(process.env.SUPABASE_URL||'https://overfzbjtpjqxzbujezg.supabase.co').replace(/\/$/,'');
const SERVICE_KEY=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'');
const BOT_TOKEN=String(process.env.TELEGRAM_BOT_TOKEN||'');
const CRON_SECRET=String(process.env.CRON_SECRET||'');
const SETTINGS_KEY='team_notification_settings';
const ENABLED_KEY='telegram_agenda_server_enabled_at';
const MAX_LOOKBACK_MS=7*24*60*60*1000;

const json=(res,status,body)=>{res.setHeader('Cache-Control','no-store');return res.status(status).json(body)};
const sbHeaders=(extra={})=>({apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,'Content-Type':'application/json',...extra});
const tg=method=>`https://api.telegram.org/bot${BOT_TOKEN}/${method}`;

async function sbRequest(path,{method='GET',body,headers={}}={}){
  const response=await fetch(`${SB_URL}/rest/v1/${path}`,{method,headers:sbHeaders(headers),body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();let data=null;
  try{data=text?JSON.parse(text):null}catch(_){data=text}
  if(!response.ok)throw new Error(`Supabase ${response.status}: ${typeof data==='string'?data:(data?.message||'respuesta no válida')}`);
  return data;
}

async function setting(key){
  const rows=await sbRequest(`app_settings?key=eq.${encodeURIComponent(key)}&select=key,value,updated_at&limit=1`);
  return rows?.[0]||null;
}
async function saveSetting(key,value){
  await sbRequest('app_settings?on_conflict=key',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:{key,value,updated_at:new Date().toISOString()}});
}

async function telegram(method,body){
  const response=await fetch(tg(method),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok||!data.ok)throw new Error(data.description||`Telegram ${method} no respondió correctamente`);
  return data.result;
}

function safeEqual(one,two){
  const a=Buffer.from(String(one||'')),b=Buffer.from(String(two||''));
  return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(a,b);
}

async function ensureWebhook(req){
  const desired=`https://${req.headers.host}/api/telegram-agenda`;
  const info=await telegram('getWebhookInfo',{});
  if(info?.url===desired)return false;
  await telegram('setWebhook',{url:desired,secret_token:T.webhookSecret(CRON_SECRET),allowed_updates:['callback_query'],drop_pending_updates:false});
  return true;
}

async function completeFromCallback(callback,chatId){
  const taskId=T.callbackTaskId(callback?.data);
  const callbackChat=String(callback?.message?.chat?.id||'');
  if(!taskId||callbackChat!==String(chatId)){
    await telegram('answerCallbackQuery',{callback_query_id:callback.id,text:'Este botón no pertenece a este CRM.',show_alert:true});
    return {completed:false,rejected:true};
  }
  const rows=await sbRequest(`agenda_items?id=eq.${encodeURIComponent(taskId)}&select=id,status,title&limit=1`);
  const task=rows?.[0];
  if(!task){
    await telegram('answerCallbackQuery',{callback_query_id:callback.id,text:'La tarea ya no existe.',show_alert:true});
    return {completed:false,missing:true};
  }
  if(task.status!=='completed'){
    await sbRequest(`agenda_items?id=eq.${encodeURIComponent(taskId)}&status=eq.pending`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status:'completed'}});
  }
  await telegram('answerCallbackQuery',{callback_query_id:callback.id,text:'Tarea marcada como completada ✅'});
  const original=String(callback?.message?.text||task.title||'Tarea');
  await telegram('editMessageText',{chat_id:callbackChat,message_id:callback.message.message_id,text:`${original}\n\n✅ COMPLETADA`,reply_markup:{inline_keyboard:[]},disable_web_page_preview:true});
  return {completed:true,taskId};
}

async function claimDelivery(item){
  const now=Date.now(),owner=crypto.randomUUID();
  const current=await setting(item.key);
  const state=current?.value||{};
  if(state.status==='sent')return null;
  if(state.status==='sending'&&now-Number(state.claimed_at||0)<120000)return null;
  if(Number(state.next_at||0)>now)return null;
  const value={status:'sending',owner_id:owner,claimed_at:now,attempt:Number(state.attempt||0)};
  if(!current){
    try{
      await sbRequest('app_settings',{method:'POST',headers:{Prefer:'return=minimal'},body:{key:item.key,value,updated_at:new Date().toISOString()}});
    }catch(error){if(/409|duplicate|unique/i.test(error.message))return null;throw error}
  }else{
    await saveSetting(item.key,value);
    const confirmed=await setting(item.key);
    if(confirmed?.value?.owner_id!==owner)return null;
  }
  return value;
}

async function contactDnis(tasks){
  const ids=[...new Set(tasks.map(row=>String(row.related_record_id||'')).filter(Boolean))];
  if(!ids.length)return new Map();
  const rows=await sbRequest(`records?id=in.(${ids.map(encodeURIComponent).join(',')})&select=id,data`);
  return new Map((rows||[]).map(row=>[String(row.id),T.recordDni(row)]));
}

async function dueRows(field,floor,now){
  const query=new URLSearchParams({select:'id,title,description,customer_name,customer_phone,starts_at,reminder_at,status,related_record_id,whatsapp_enabled',status:'eq.pending',[field]:`gte.${new Date(floor).toISOString()}`,order:`${field}.asc`,limit:'200'});
  query.append(field,`lte.${new Date(now).toISOString()}`);
  return sbRequest(`agenda_items?${query.toString()}`);
}

async function runCron(req){
  if(!SERVICE_KEY||!BOT_TOKEN||!CRON_SECRET)throw new Error('Faltan credenciales privadas de Telegram, Supabase o Cron en Vercel.');
  const config=(await setting(SETTINGS_KEY))?.value||{};
  if(!config.agenda_telegram||!String(config.telegram_chat_id||'').trim())return {ok:true,enabled:false,sent:0};
  const webhookChanged=await ensureWebhook(req);
  let enabled=(await setting(ENABLED_KEY))?.value?.at;
  if(!enabled){enabled=new Date().toISOString();await saveSetting(ENABLED_KEY,{at:enabled});return {ok:true,enabled:true,initialized:true,webhookChanged,sent:0};}
  const now=Date.now(),floor=Math.max(new Date(enabled).getTime(),now-MAX_LOOKBACK_MS);
  const [main,extra]=await Promise.all([dueRows('starts_at',floor,now),dueRows('reminder_at',floor,now)]);
  const tasks=new Map([...(main||[]),...(extra||[])].map(row=>[String(row.id),row]));
  const due=T.dueDeliveries([...tasks.values()],{enabledAt:new Date(floor).toISOString(),now});
  const dnis=await contactDnis([...tasks.values()]);
  let sent=0,failed=0;
  for(const item of due){
    const claim=await claimDelivery(item);if(!claim)continue;
    try{
      const result=await telegram('sendMessage',{chat_id:String(config.telegram_chat_id),message_thread_id:config.agenda_telegram_thread_id||undefined,text:T.taskMessage(item.task,{kind:item.kind,dni:dnis.get(String(item.task.related_record_id||''))||''}),disable_web_page_preview:true,reply_markup:{inline_keyboard:[[{text:'✅ Marcar como completada',callback_data:T.callbackData(item.task.id)}]]}});
      await saveSetting(item.key,{status:'sent',owner_id:claim.owner_id,attempt:claim.attempt+1,sent_at:Date.now(),message_id:result?.message_id||null});sent++;
    }catch(error){
      await saveSetting(item.key,{status:'pending',owner_id:claim.owner_id,attempt:claim.attempt+1,next_at:Date.now()+60000,last_error:String(error.message||error).slice(0,500)});failed++;
    }
  }
  return {ok:failed===0,enabled:true,webhookChanged,due:due.length,sent,failed};
}

module.exports=async function handler(req,res){
  try{
    if(req.method==='GET'){
      if(!CRON_SECRET||req.headers.authorization!==`Bearer ${CRON_SECRET}`)return json(res,401,{ok:false,error:'No autorizado'});
      return json(res,200,await runCron(req));
    }
    if(req.method==='POST'){
      if(!BOT_TOKEN||!SERVICE_KEY||!CRON_SECRET)return json(res,503,{ok:false,error:'Telegram no está configurado'});
      if(!safeEqual(req.headers['x-telegram-bot-api-secret-token'],T.webhookSecret(CRON_SECRET)))return json(res,401,{ok:false,error:'Webhook no autorizado'});
      const config=(await setting(SETTINGS_KEY))?.value||{};
      if(!config.agenda_telegram||!config.telegram_chat_id)return json(res,200,{ok:true,ignored:true});
      if(req.body?.callback_query)return json(res,200,{ok:true,...await completeFromCallback(req.body.callback_query,config.telegram_chat_id)});
      return json(res,200,{ok:true,ignored:true});
    }
    return json(res,405,{ok:false,error:'Método no permitido'});
  }catch(error){console.error('telegram-agenda',error);return json(res,500,{ok:false,error:String(error.message||error)})}
};

module.exports._test={runCron,completeFromCallback,setting,saveSetting};
