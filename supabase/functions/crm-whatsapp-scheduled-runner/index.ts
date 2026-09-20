import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"";
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const GREEN_PROXY="https://the-phone-face-app-whatsapp-fotos-y.vercel.app/api/green";
const sb=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false}});

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});

async function cronAuthorized(req:Request){
  const secret=String(req.headers.get("x-tpf-cron-secret")||"");
  if(!secret)return false;
  const {data,error}=await sb.rpc("crm_check_runner_secret",{p_secret:secret});
  return !error&&data===true;
}

function chatIdFromPhone(value:unknown){
  let digits=String(value||"").replace(/\D/g,"");
  if(digits.length===9) digits="34"+digits;
  if(digits.length<10||digits.length>15) return "";
  return `${digits}@c.us`;
}

async function greenState(secret:string){
  try{
    const r=await fetch(`${GREEN_PROXY}?action=state`,{headers:{"x-tpf-cron-secret":secret,"cache-control":"no-cache"}});
    if(!r.ok)return "unknown";
    const d=await r.json().catch(()=>({}));
    return String(d?.state||d?.data?.stateInstance||"unknown").toLowerCase();
  }catch{return "unknown";}
}

async function updateRow(id:string,patch:Record<string,unknown>){
  const {error}=await sb.from("agenda_items").update({...patch,updated_at:new Date().toISOString()}).eq("id",id);
  if(error)throw error;
}

async function processScheduled(row:any,secret:string){
  const id=String(row.id||"");
  const chatId=chatIdFromPhone(row.whatsapp_phone||row.customer_phone);
  const message=String(row.whatsapp_message||"").trim();
  if(!chatId){
    await updateRow(id,{whatsapp_delivery_status:"error",whatsapp_delivery_error:"Número de WhatsApp no válido."});
    return "error";
  }
  if(!message){
    await updateRow(id,{whatsapp_delivery_status:"error",whatsapp_delivery_error:"El mensaje está vacío."});
    return "error";
  }

  const state=await greenState(secret);
  if(state!=="authorized"){
    await updateRow(id,{whatsapp_delivery_status:"pending",whatsapp_delivery_error:`GREEN-API no está autorizada (${state}). Se volverá a comprobar sin intentar el envío.`});
    return "waiting";
  }

  let r:Response;
  try{
    r=await fetch(`${GREEN_PROXY}?action=send`,{
      method:"POST",
      headers:{"x-tpf-cron-secret":secret,"content-type":"application/json"},
      body:JSON.stringify({chatId,message})
    });
  }catch(err){
    await updateRow(id,{
      whatsapp_delivery_status:"uncertain",
      whatsapp_delivery_error:`Resultado incierto: se perdió la conexión durante el intento de envío. No se reintentará automáticamente. ${err instanceof Error?err.message:String(err)}`
    });
    return "uncertain";
  }

  const data=await r.json().catch(()=>({}));
  if(r.ok&&data?.ok!==false){
    await updateRow(id,{
      whatsapp_delivery_status:"sent",
      whatsapp_delivery_error:null,
      whatsapp_sent_at:new Date().toISOString(),
      whatsapp_provider_message_id:String(data?.idMessage||data?.data?.idMessage||"")||null,
      status:"completed"
    });
    return "sent";
  }

  const msg=String(data?.error||data?.message||`GREEN-API HTTP ${r.status}`);
  if(r.status>=500||data?.ok===false&&r.status<400){
    await updateRow(id,{
      whatsapp_delivery_status:"uncertain",
      whatsapp_delivery_error:`Resultado incierto: ${msg}. No se reintentará automáticamente.`
    });
    return "uncertain";
  }

  await updateRow(id,{whatsapp_delivery_status:"error",whatsapp_delivery_error:msg});
  return "error";
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST"&&req.method!=="GET")return json({ok:false},405);
  if(!(await cronAuthorized(req)))return json({ok:false,error:"Unauthorized"},401);
  const secret=String(req.headers.get("x-tpf-cron-secret")||"");
  const {data:flag}=await sb.from("app_settings").select("value").eq("key","crm_server_scheduled_whatsapp_enabled").maybeSingle();
  if(flag?.value!==true)return json({ok:true,enabled:false,claimed:0});

  await sb.rpc("crm_recover_stale_scheduled_whatsapp");
  const {data:rows,error}=await sb.rpc("crm_claim_scheduled_whatsapp",{p_limit:20});
  if(error)return json({ok:false,error:error.message},500);

  let sent=0,waiting=0,failed=0,uncertain=0;
  for(const row of rows||[]){
    try{
      const result=await processScheduled(row,secret);
      if(result==="sent")sent++;
      else if(result==="waiting")waiting++;
      else if(result==="uncertain")uncertain++;
      else failed++;
    }catch(err){
      failed++;
      try{await updateRow(String(row.id),{whatsapp_delivery_status:"error",whatsapp_delivery_error:String(err instanceof Error?err.message:err)});}catch{}
    }
  }
  return json({ok:true,enabled:true,claimed:(rows||[]).length,sent,waiting,failed,uncertain});
});
