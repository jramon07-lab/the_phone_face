'use strict';

const crypto=require('crypto');
const O=require('../lib/telegram-operations-core');

const SB_URL=String(process.env.SUPABASE_URL||'https://overfzbjtpjqxzbujezg.supabase.co').replace(/\/$/,'');
const SERVICE_KEY=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'');
const BOT_TOKEN=String(process.env.TELEGRAM_BOT_TOKEN||'');
const CRON_SECRET=String(process.env.CRON_SECRET||'');
const SETTINGS_KEY='team_notification_settings';
const ENABLED_KEY='telegram_operations_server_enabled_at';
const SEND_ACTIONS='(send_template,send_whatsapp_now,__send_whatsapp)';
const json=(res,status,body)=>{res.setHeader('Cache-Control','no-store');return res.status(status).json(body)};
const sbHeaders=(extra={})=>({apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,'Content-Type':'application/json',...extra});

async function sbRequest(path,{method='GET',body,headers={}}={}){
  const response=await fetch(`${SB_URL}/rest/v1/${path}`,{method,headers:sbHeaders(headers),body:body===undefined?undefined:JSON.stringify(body)});
  const raw=await response.text();let data=null;try{data=raw?JSON.parse(raw):null}catch(_){data=raw}
  if(!response.ok)throw new Error(`Supabase ${response.status}: ${typeof data==='string'?data:(data?.message||'respuesta no válida')}`);return data;
}
async function setting(key){const rows=await sbRequest(`app_settings?key=eq.${encodeURIComponent(key)}&select=key,value,updated_at&limit=1`);return rows?.[0]||null}
async function saveSetting(key,value){await sbRequest('app_settings?on_conflict=key',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:{key,value,updated_at:new Date().toISOString()}})}
async function telegram(body){
  const response=await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.description||'Telegram no respondió correctamente');return data.result;
}
async function claim(key){
  const now=Date.now(),owner=crypto.randomUUID(),current=await setting(key),state=current?.value||{};
  if(state.status==='sent'||(state.status==='sending'&&now-Number(state.claimed_at||0)<120000)||Number(state.next_at||0)>now)return null;
  const value={status:'sending',owner_id:owner,claimed_at:now,attempt:Number(state.attempt||0)};
  if(!current){try{await sbRequest('app_settings',{method:'POST',headers:{Prefer:'return=minimal'},body:{key,value,updated_at:new Date().toISOString()}})}catch(error){if(/409|duplicate|unique/i.test(error.message))return null;throw error}}
  else {await saveSetting(key,value);const confirmed=await setting(key);if(confirmed?.value?.owner_id!==owner)return null}
  return value;
}
async function deliver({key,chatId,threadId,text}){
  const state=await claim(key);if(!state)return {sent:0,skipped:1,failed:0};
  try{const result=await telegram({chat_id:String(chatId),message_thread_id:Number(threadId)>0?Number(threadId):undefined,text,disable_web_page_preview:true});await saveSetting(key,{status:'sent',owner_id:state.owner_id,attempt:state.attempt+1,sent_at:Date.now(),message_id:result?.message_id||null});return {sent:1,skipped:0,failed:0}}
  catch(error){await saveSetting(key,{status:'pending',owner_id:state.owner_id,attempt:state.attempt+1,next_at:Date.now()+60000,last_error:String(error.message||error).slice(0,500)});return {sent:0,skipped:0,failed:1}}
}
function rangeQuery(select,field,start,end,extra={}){const q=new URLSearchParams({select,...extra,order:`${field}.asc`,limit:'500'});q.append(field,`gte.${start}`);q.append(field,`lt.${end}`);return q.toString()}
async function manualRows(start,end,status='pending'){
  return sbRequest(`agenda_items?${rangeQuery('id,customer_name,customer_phone,starts_at,status,whatsapp_enabled,whatsapp_phone,whatsapp_message,whatsapp_scheduled_at,whatsapp_delivery_status', 'whatsapp_scheduled_at',start,end,{status:`eq.${status}`,whatsapp_enabled:'eq.true'})}`);
}
async function jobRows(start,end,{status,field='updated_at'}={}){
  return sbRequest(`crm_server_automation_jobs?${rangeQuery('id,action_type,action_config,context,run_at,status,error_message,created_at,updated_at,completed_at',field,start,end,{status:`eq.${status}`,action_type:`in.${SEND_ACTIONS}`})}`);
}
async function templateMap(jobs){
  const ids=[...new Set((jobs||[]).map(row=>String(row?.action_config?.template_id||'')).filter(Boolean))];if(!ids.length)return new Map();
  const rows=await sbRequest(`whatsapp_templates?id=in.(${ids.map(encodeURIComponent).join(',')})&select=id,name,body`);return new Map((rows||[]).map(row=>[String(row.id),row]));
}
function addTotals(total,result){for(const key of ['sent','skipped','failed'])total[key]+=Number(result[key]||0)}
async function runCron(){
  if(!SERVICE_KEY||!BOT_TOKEN||!CRON_SECRET)throw new Error('Faltan credenciales privadas de Telegram, Supabase o Cron en Vercel.');
  const config=(await setting(SETTINGS_KEY))?.value||{},chatId=String(config.telegram_chat_id||'').trim();
  if(!chatId)return {ok:true,enabled:false,sent:0,failed:0,skipped:0};
  let enabled=(await setting(ENABLED_KEY))?.value?.at;
  if(!enabled){enabled=new Date().toISOString();await saveSetting(ENABLED_KEY,{at:enabled});return {ok:true,enabled:true,initialized:true,sent:0,failed:0,skipped:0}}
  const now=Date.now(),floor=new Date(Math.max(new Date(enabled).getTime(),now-O.DELIVERY_WINDOW_MS)).toISOString(),until=new Date(now+1000).toISOString();
  const totals={sent:0,failed:0,skipped:0,manual:0,incidents:0,daily:0};
  if(config.whatsapp_telegram&&Number(config.whatsapp_telegram_thread_id)>0){
    const rows=O.dueManual(await manualRows(floor,until),{enabledAt:enabled,now});
    for(const row of rows){const result=await deliver({key:O.deliveryKey('whatsapp_manual',row.id,O.manualAt(row)),chatId,threadId:config.whatsapp_telegram_thread_id,text:O.manualMessage(row)});addTotals(totals,result);totals.manual+=result.sent}
  }
  if(Number(config.incidents_telegram_thread_id)>0){
    const failures=await jobRows(floor,until,{status:'failed'}),templates=await templateMap(failures);
    for(const job of failures){const result=await deliver({key:O.deliveryKey('whatsapp_failure',job.id),chatId,threadId:config.incidents_telegram_thread_id,text:O.failureMessage(job,templates)});addTotals(totals,result);totals.incidents+=result.sent}
  }
  const day=O.shouldSendDaily(now);
  if(day.due&&Number(config.daily_summary_telegram_thread_id)>0){
    const key=O.deliveryKey('whatsapp_daily',day.key),already=await setting(key);
    if(already?.value?.status!=='sent'){
      const [done,failed,manual]=await Promise.all([jobRows(day.start,day.end,{status:'done',field:'completed_at'}),jobRows(day.start,day.end,{status:'failed'}),manualRows(day.start,day.end)]);
      const result=await deliver({key,chatId,threadId:config.daily_summary_telegram_thread_id,text:O.dailySummary({dayKey:day.key,sent:done.length,manualPending:manual.length,errors:failed.length})});addTotals(totals,result);totals.daily+=result.sent;
    }
  }
  return {ok:totals.failed===0,enabled:true,...totals};
}
module.exports=async function handler(req,res){try{if(req.method!=='GET')return json(res,405,{ok:false,error:'Método no permitido'});if(!CRON_SECRET||req.headers.authorization!==`Bearer ${CRON_SECRET}`)return json(res,401,{ok:false,error:'No autorizado'});return json(res,200,await runCron())}catch(error){console.error('telegram-operations',error);return json(res,500,{ok:false,error:String(error.message||error)})}};
module.exports._test={runCron,setting,saveSetting,manualRows,jobRows};
