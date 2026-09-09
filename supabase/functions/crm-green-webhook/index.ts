import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"";
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const sb=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false}});
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});

function token(req:Request){return String(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();}
function interactiveText(message:any){
  const data=message?.messageData||message||{};
  const reply=data.interactiveButtonsResponse||message?.interactiveButtonsResponse;
  if(reply){const selected=reply.interactiveButtonsResponse||reply;return String(selected.selectedDisplayText||selected.selectedButtonText||selected.buttonText||"").trim();}
  const legacy=data.buttonsResponseMessage||message?.buttonsResponseMessage||data.templateButtonReplyMessage||message?.templateButtonReplyMessage;
  return String(legacy?.selectedButtonText||legacy?.selectedDisplayText||data?.textMessageData?.textMessage||data?.extendedTextMessageData?.text||message?.textMessage||message?.caption||"").trim();
}
function incoming(body:any){return String(body?.typeWebhook||body?.type||"").toLowerCase().includes("incoming");}
function safeDetail(value:unknown){return String(value||"").replace(/(authorization\s*:\s*bearer\s+)[^\s]+/gi,"$1[REDACTADO]").slice(0,500);}
async function recordFailure(message:string,detail:unknown){
  const fingerprint=`green-webhook:${message.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,80)}`;
  try{
    const {data}=await sb.from("crm_system_events").select("id,occurrences").eq("fingerprint",fingerprint).eq("status","active").maybeSingle();
    if(data?.id)await sb.from("crm_system_events").update({occurrences:Number(data.occurrences||1)+1,last_seen_at:new Date().toISOString(),detail:safeDetail(detail)}).eq("id",data.id);
    else await sb.from("crm_system_events").insert({fingerprint,source:"automation",module:"Seguimientos de WhatsApp",severity:"error",status:"active",message,detail:safeDetail(detail),route:"crm-green-webhook",device:"server",app_version:"edge-v2"});
  }catch(error){console.error("GREEN_WEBHOOK_AUDIT_ERROR",error instanceof Error?error.message:String(error));}
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return reply({ok:false,error:"Method not allowed"},405);
  const secret=token(req);
  if(secret.length<64)return reply({ok:false,error:"Unauthorized"},401);
  const {data:authorized,error:authError}=await sb.rpc("crm_check_runner_secret",{p_secret:secret});
  if(authError||authorized!==true)return reply({ok:false,error:"Unauthorized"},401);
  let body:any;try{body=await req.json();}catch{await recordFailure("Webhook de WhatsApp con JSON inválido","GREEN no entregó una notificación válida");return reply({ok:false,error:"Invalid JSON"},400);}
  if(!incoming(body))return reply({ok:true,ignored:true});
  const chatId=String(body?.senderData?.chatId||body?.chatId||"").trim();
  const idMessage=String(body?.idMessage||body?.messageData?.idMessage||"").trim();
  const timestamp=Number(body?.timestamp||0);
  if(!chatId||!idMessage||!Number.isFinite(timestamp)||timestamp<=0){await recordFailure("Respuesta de WhatsApp incompleta",`chat=${!!chatId}; message=${!!idMessage}; timestamp=${timestamp>0}`);return reply({ok:false,error:"Incomplete incoming message"},400);}
  if(chatId.endsWith("@g.us"))return reply({ok:true,ignored:true});
  const createdAt=new Date(timestamp*1000).toISOString();
  const row={chat_id:chatId,id_message:idMessage,direction:"in",ts:Math.floor(timestamp),text_content:interactiveText(body),type_message:String(body?.messageData?.typeMessage||body?.typeMessage||"incoming"),raw:body,created_at:createdAt};
  const {error}=await sb.from("wa_messages").insert(row);
  if(error&&String(error.code||"")!=="23505"){await recordFailure("No se pudo guardar una respuesta de WhatsApp",`code=${String(error.code||"")}; ${error.message||"Persistence failed"}`);return reply({ok:false,error:"Persistence failed"},500);}
  return reply({ok:true,accepted:true,duplicate:String(error?.code||"")==="23505"});
});
