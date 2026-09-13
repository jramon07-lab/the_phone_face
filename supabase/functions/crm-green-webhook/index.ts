import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"";
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const GREEN_PROXY="https://the-phone-face-app-whatsapp-git-4c8eb2-jramon-07-2402s-projects.vercel.app/api/green";
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
function phoneToChat(ctx:any){
  const existing=String(ctx?.chat_id||"").trim();
  if(/^[^@]+@(c\.us|g\.us|lid)$/.test(existing))return existing;
  let digits=String(ctx?.phone||"").replace(/\D/g,"");
  if(digits.length===9)digits="34"+digits;
  return digits.length>=8&&digits.length<=15?`${digits}@c.us`:"";
}
function messageVars(value:string,ctx:any){return String(value||"")
  .replaceAll("{nombre}",String(ctx?.name||""))
  .replaceAll("{dni}",String(ctx?.dni||""))
  .replaceAll("{telefono}",String(ctx?.phone||""))
  .replaceAll("{operador}",String(ctx?.operator||""))
  .replaceAll("{precio_total}",String(ctx?.precio_total||""));}
async function recordFailure(message:string,detail:unknown){
  const fingerprint=`green-webhook:${message.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,80)}`;
  try{
    const {data}=await sb.from("crm_system_events").select("id,occurrences").eq("fingerprint",fingerprint).eq("status","active").maybeSingle();
    if(data?.id)await sb.from("crm_system_events").update({occurrences:Number(data.occurrences||1)+1,last_seen_at:new Date().toISOString(),detail:safeDetail(detail)}).eq("id",data.id);
    else await sb.from("crm_system_events").insert({fingerprint,source:"automation",module:"Seguimientos de WhatsApp",severity:"error",status:"active",message,detail:safeDetail(detail),route:"crm-green-webhook",device:"server",app_version:"edge-v2"});
  }catch(error){console.error("GREEN_WEBHOOK_AUDIT_ERROR",error instanceof Error?error.message:String(error));}
}

// La decisión ya se registra dentro del trigger de wa_messages. Las respuestas
// posteriores de «Más opciones», «Volver» y «Otro motivo» crean trabajos con
// claves distintas. También se reclaman aquí de forma atómica para que no
// esperen a la cola periódica. Ante cualquier ambigüedad se dejan en cola:
// nunca se envía un mensaje a otra oferta ni se duplica un envío.
async function sendOfferReplyNow(incomingMessageId:string,chatId:string,secret:string){
  const {data:decision,error:decisionError}=await sb.from("crm_offer_response_states")
    .select("offer_instance_id,action")
    .eq("decision_message_id",incomingMessageId)
    .maybeSingle();
  if(decisionError)throw decisionError;
  let offerId=String(decision?.offer_instance_id||"").trim();
  const eventKey=decision?.action==="decline"?`offer-reason:${offerId}`:decision?.action==="alternative"?`offer-alternative-ack:${offerId}`:"";
  let jobId="";

  if(!eventKey){
    const phone=chatId.replace(/@[^@]+$/,"").replace(/\D/g,"");
    if(!phone)return {sent:false,reason:"no_followup_message"};
    const since=new Date(Date.now()-30_000).toISOString();
    const {data:candidates,error:candidatesError}=await sb.from("crm_server_automation_jobs")
      .select("id,event_key,context")
      .eq("status","pending")
      .like("event_key","offer-reason-%")
      .gte("created_at",since);
    if(candidatesError)throw candidatesError;
    const matching=(candidates||[]).filter((candidate:any)=>{
      const candidatePhone=String(candidate?.context?.phone||"").replace(/\D/g,"");
      return candidatePhone===phone||candidatePhone===phone.replace(/^34/,"");
    });
    // Un único trabajo creado por este clic es seguro. Si hubiese dos, no se
    // adivina: el runner normal conserva el mensaje para revisión.
    if(matching.length!==1)return {sent:false,reason:matching.length?"ambiguous_followup":"no_followup_message"};
    jobId=String(matching[0].id||"");
    offerId=String(matching[0].context?.offer_instance_id||"").trim();
  }

  let claim=sb.from("crm_server_automation_jobs")
    .update({status:"running",updated_at:new Date().toISOString(),error_message:null})
    .eq("status","pending");
  claim=jobId?claim.eq("id",jobId):claim.eq("event_key",eventKey);
  const {data:job,error:claimError}=await claim.select("id,action_config,context").maybeSingle();
  if(claimError)throw claimError;
  if(!job)return {sent:false,reason:"already_claimed"};

  const chatId=phoneToChat(job.context),message=messageVars(String(job.action_config?.text||""),job.context||{}),buttons=Array.isArray(job.action_config?.reply_buttons)?job.action_config.reply_buttons:[];
  if(!chatId||!message.trim()){
    await sb.from("crm_server_automation_jobs").update({status:"pending",error_message:"Respuesta automática pendiente: falta teléfono o texto",updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","running");
    return {sent:false,reason:"invalid_message"};
  }

  // Esta comprobación ocurre antes del envío. Si WhatsApp está caído, se deja
  // el trabajo pendiente para el respaldo periódico sin riesgo de repetirlo.
  try{
    const stateResponse=await fetch(`${GREEN_PROXY}?action=state`,{headers:{"x-tpf-cron-secret":secret,"cache-control":"no-cache"}});
    const state=await stateResponse.json().catch(()=>({}));
    if(!stateResponse.ok||String(state?.state||state?.data?.stateInstance||"").toLowerCase()!=="authorized"){
      await sb.from("crm_server_automation_jobs").update({status:"pending",error_message:"Respuesta automática pendiente: WhatsApp no está disponible",updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","running");
      return {sent:false,reason:"whatsapp_unavailable"};
    }
  }catch(error){
    await sb.from("crm_server_automation_jobs").update({status:"pending",error_message:"Respuesta automática pendiente: no se pudo comprobar WhatsApp",updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","running");
    await recordFailure("Respuesta automática de oferta aplazada",error instanceof Error?error.message:String(error));
    return {sent:false,reason:"state_check_failed"};
  }

  let response:Response,body:any={};
  try{
    response=await fetch(`${GREEN_PROXY}?action=${buttons.length?"sendbuttons":"send"}`,{method:"POST",headers:{"content-type":"application/json","x-tpf-cron-secret":secret},body:JSON.stringify({chatId,message,...(buttons.length?{buttons}:{})})});
    body=await response.json().catch(()=>({}));
  }catch(error){
    await sb.from("crm_server_automation_jobs").update({status:"failed",error_message:"No se confirmó el envío inmediato; no se reintenta para evitar un duplicado",updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","running");
    await recordFailure("Respuesta automática de oferta sin confirmar",error instanceof Error?error.message:String(error));
    return {sent:false,reason:"network_unconfirmed"};
  }
  const providerMessageId=String(body?.idMessage||body?.data?.idMessage||"").trim();
  if(!response.ok||body?.ok===false||!providerMessageId){
    const retrySafe=response.status>=400&&response.status<500;
    await sb.from("crm_server_automation_jobs").update(retrySafe?{status:"pending",error_message:"Respuesta automática pendiente: WhatsApp rechazó el envío",updated_at:new Date().toISOString()}:{status:"failed",error_message:"WhatsApp no confirmó el envío; no se reintenta para evitar un duplicado",updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","running");
    await recordFailure(retrySafe?"Respuesta automática de oferta aplazada":"Respuesta automática de oferta sin confirmar",body?.error||body?.message||`WhatsApp HTTP ${response.status}`);
    return {sent:false,reason:retrySafe?"provider_rejected":"provider_unconfirmed"};
  }

  const receipt={idMessage:providerMessageId,chatId,checks:0,acceptedAt:new Date().toISOString()};
  try{
    const {error:rememberError}=await sb.from("crm_offer_outgoing_messages").upsert({provider_message_id:providerMessageId,offer_instance_id:offerId,job_id:job.id,phase:String(job.action_config?.offer_phase||"response"),sent_at:new Date().toISOString()},{onConflict:"provider_message_id"});
    if(rememberError)throw rememberError;
    const {error:pendingError}=await sb.from("crm_server_automation_jobs").update({status:"pending",action_config:{...(job.action_config||{}),__delivery_receipt:receipt},error_message:"WhatsApp aceptó el mensaje; pendiente confirmar el envío",run_at:new Date(Date.now()+120000).toISOString(),updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","running");
    if(pendingError)throw pendingError;
  }catch(error){
    await sb.from("crm_server_automation_jobs").update({status:"failed",error_message:"WhatsApp se envió pero no se pudo verificar; no se reintenta para evitar un duplicado",updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","running");
    await recordFailure("Respuesta automática de oferta enviada sin verificación",error instanceof Error?error.message:String(error));
    return {sent:true,reason:"sent_unverified"};
  }
  return {sent:true,interactive:buttons.length>0};
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
  const duplicate=String(error?.code||"")==="23505";
  let immediate:any={sent:false,reason:"duplicate"};
  if(!duplicate){
    try{immediate=await sendOfferReplyNow(idMessage,chatId,secret)}
    catch(dispatchError){await recordFailure("No se pudo iniciar la respuesta automática de oferta",dispatchError instanceof Error?dispatchError.message:String(dispatchError));}
  }
  return reply({ok:true,accepted:true,duplicate,immediate});
});
