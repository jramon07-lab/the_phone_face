'use strict';
const crypto=require('crypto');
const C=require('../lib/whatsapp-auto-replies');
const {authorize}=require('../lib/crm-api-auth');
const SB=String(process.env.SUPABASE_URL||'https://overfzbjtpjqxzbujezg.supabase.co').replace(/\/$/,'');
const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const ID=process.env.GREEN_API_INSTANCE_ID||process.env.GREEN_API_ID_INSTANCE||process.env.GREEN_API_IDINSTANCE||'';
const TOKEN=process.env.GREEN_API_TOKEN||process.env.GREEN_API_API_TOKEN||process.env.GREEN_API_TOKEN_INSTANCE||'';
const BASE=String(process.env.GREEN_API_API_URL||'https://7107.api.greenapi.com').replace(/\/$/,'');
async function db(path,method='GET',body,prefer){const r=await fetch(SB+'/rest/v1/'+path,{method,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000)});if(!r.ok){const e=Error('No se pudo acceder a la configuración ('+r.status+').');e.status=r.status;throw e;}return r.status===204?null:r.json();}
const eq=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length>0&&x.length===y.length&&crypto.timingSafeEqual(x,y)};
async function run(){
 if(process.env.VERCEL_ENV!=='production')return {skipped:'Solo producción'};
 if(!KEY)throw Error('Falta la conexión del servidor.');
 await db('crm_whatsapp_reply_settings?id=eq.1','PATCH',{last_check_at:new Date().toISOString(),server_ready:!!(ID&&TOKEN)},'return=minimal');
 if(!ID||!TOKEN)throw Error('Falta la conexión del servidor con WhatsApp.');
 const [config]=await db('crm_whatsapp_reply_settings?id=eq.1&select=*');
 if(!config?.enabled)return {sent:0,enabled:false};
 C.validate(config);const now=new Date(),period=C.closure(now,config.schedule);if(!period)return {sent:0,open:true};
 const since=new Date(now.getTime()-300000).toISOString();
 const incoming=await db('wa_messages?direction=eq.in&created_at=gte.'+encodeURIComponent(since)+'&select=chat_id,id_message,direction,ts,type_message,text_content&order=created_at.desc&limit=100');
 let sent=0,uncertain=0;const chats=new Set(),started=Date.now();
 for(const row of incoming){
  if(chats.has(row.chat_id)||!C.eligible(row,now,config.enabled_since)||C.closure(new Date(Number(row.ts)*(Number(row.ts)>1e12?1:1000)),config.schedule)!==period)continue;chats.add(row.chat_id);
  if(sent+uncertain>=8||Date.now()-started>40000)break;
  // Don't send a stale acknowledgement after the team has already answered.
  const outgoing=await db('wa_messages?chat_id=eq.'+encodeURIComponent(row.chat_id)+'&direction=eq.out&ts=gte.'+Number(row.ts)+'&select=id&limit=1');if(outgoing.length)continue;
  // Check disabled/edited state again before every claim.
  const [fresh]=await db('crm_whatsapp_reply_settings?id=eq.1&select=enabled,updated_at');if(!fresh?.enabled||fresh.updated_at!==config.updated_at)break;
  const key=crypto.createHash('sha256').update(row.chat_id+'|'+period).digest('hex');
  let claim;try{claim=await db('crm_whatsapp_reply_receipts?on_conflict=dedupe_key','POST',{dedupe_key:key,chat_id:row.chat_id,incoming_id:row.id_message,closure:period,status:'reserved'},'resolution=ignore-duplicates,return=representation');}catch(e){throw e;}if(!claim?.length)continue;
  // A reserved/uncertain attempt is never automatically resent: a timeout may still have delivered it.
  try{
   const r=await fetch(BASE+'/waInstance'+encodeURIComponent(ID)+'/sendMessage/'+encodeURIComponent(TOKEN),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId:row.chat_id,message:config.message}),signal:AbortSignal.timeout(10000)});
   const data=await r.json();if(!r.ok||!data.idMessage)throw Error('Sin confirmación de envío');
   const at=new Date().toISOString();await db('crm_whatsapp_reply_receipts?dedupe_key=eq.'+key,'PATCH',{status:'sent',outgoing_id:String(data.idMessage),sent_at:at},'return=minimal');sent++;
   // Persist the provider receipt so both computers classify the message consistently.
   try{await db('wa_messages','POST',{chat_id:row.chat_id,id_message:String(data.idMessage),direction:'out',ts:Math.floor(Date.now()/1000),text_content:config.message,type_message:'textMessage',raw:{idMessage:String(data.idMessage),type:'outgoing',typeMessage:'textMessage',timestamp:Math.floor(Date.now()/1000),textMessage:config.message}},'return=minimal');}catch(_){/* provider webhook/history can also persist the message */}
  }catch(_){uncertain++;await db('crm_whatsapp_reply_receipts?dedupe_key=eq.'+key,'PATCH',{status:'uncertain'},'return=minimal');}
 }
 // Receipt retention bounds reads/storage; never changes business followup jobs.
 await db('crm_whatsapp_reply_receipts?created_at=lt.'+encodeURIComponent(new Date(Date.now()-90*86400000).toISOString()),'DELETE',undefined,'return=minimal');
 return {sent,uncertain,enabled:true};
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 const cron=req.method==='GET'&&req.query?.action==='cron';
 if(cron){if(!eq(String(req.headers.authorization||''),'Bearer '+String(process.env.CRON_SECRET||''))||!process.env.CRON_SECRET)return res.status(401).json({ok:false});}
 else if(!await authorize(req,res,req.method==='POST'?'is_admin':'can_use_whatsapp'))return;
 try{
  if(cron)return res.status(200).json({ok:true,...await run()});
  if(!KEY)throw Error('Falta la conexión del servidor.');
  if(req.method==='POST'){
   const input=typeof req.body==='string'?JSON.parse(req.body):req.body,clean=C.validate(input);
   const [old]=await db('crm_whatsapp_reply_settings?id=eq.1&select=enabled,enabled_since');
   const now=new Date().toISOString();await db('crm_whatsapp_reply_settings?id=eq.1','PATCH',{...clean,updated_at:now,enabled_since:clean.enabled&&!old?.enabled?now:old?.enabled_since||now},'return=minimal');
   return res.status(200).json({ok:true});
  }
  if(req.method!=='GET')return res.status(405).json({ok:false});
  const [settings]=await db('crm_whatsapp_reply_settings?id=eq.1&select=*');
  const issues=await db('crm_whatsapp_reply_receipts?status=in.(reserved,uncertain)&created_at=gte.'+encodeURIComponent(new Date(Date.now()-86400000).toISOString())+'&select=chat_id,status,created_at&limit=50');
  return res.status(200).json({ok:true,settings,connected:!!(ID&&TOKEN&&process.env.CRON_SECRET),issues});
 }catch(e){return res.status(503).json({ok:false,error:e.message||'No se pudo completar la operación.'});}
};
