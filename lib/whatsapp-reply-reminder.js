'use strict';
// Use the caller's CRM session, never a service key. Reserving the notice before
// sending means a storage failure cannot cause a customer message to be retried.
async function rpc(req,name,args){
 const authorization=String(req.headers?.authorization||'');
 const base=String(process.env.SUPABASE_URL||'https://overfzbjtpjqxzbujezg.supabase.co').replace(/\/$/,'');
 const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'sb_publishable_o6_eM5v04EBInhfiSnyFLA_5yRHlB4j';
 const r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});
 const value=await r.json().catch(()=>null);if(!r.ok)throw Error(value?.message||'No se pudo guardar el aviso sin respuesta.');return value;
}
async function prepare(req,body,chatId){
 if(!body.replyReminder)return null;
 return rpc(req,'crm_prepare_reply_reminder',{p_chat_id:chatId,p_message:body.message||body.caption||'',p_spec:body.replyReminder});
}
async function finish(req,id,data){
 if(!id)return null;
 try{if(!data?.idMessage)throw Error('No se confirmó el identificador del mensaje.');const armed=await rpc(req,'crm_arm_reply_reminder',{p_id:id,p_message_id:data.idMessage});if(armed!==true)throw Error('No se confirmó el aviso.');return {id,ok:true};}
 catch(_){return {id,ok:false,error:'El WhatsApp ya se ha enviado, pero no se ha confirmado el aviso. No repitas el envío. Puedes activar el aviso desde el mensaje enviado.'};}
}
module.exports={prepare,finish};
