import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { lifecycleEnabled, orderedConfig } from "./lifecycle.ts";
import { businessContext } from "./contact-party.ts";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"";
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const GREEN_PROXY="https://the-phone-face-app-whatsapp-fotos-y.vercel.app/api/green";
const sb=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false}});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});

async function cronAuthorized(req:Request){const secret=String(req.headers.get("x-tpf-cron-secret")||"");if(!secret)return false;const {data,error}=await sb.rpc("crm_check_runner_secret",{p_secret:secret});return !error&&data===true;}
function phoneToChat(ctx:any){const existing=String(ctx?.chat_id||"").trim();if(/^[^@]+@(c\.us|g\.us|lid)$/.test(existing))return existing;let digits=String(ctx?.phone||"").replace(/\D/g,"");if(digits.length===9)digits="34"+digits;if(digits.length<8||digits.length>15)return "";return `${digits}@c.us`;}
function contactVar(ctx:any,key:string){const data=ctx?.contact_data&&typeof ctx.contact_data==="object"?ctx.contact_data:{};const wanted=String(key||"").trim().toLowerCase();for(const [k,v] of Object.entries(data)){if(String(k).trim().toLowerCase()===wanted)return String(v??"");}return "";}
function vars(text:string,ctx:any){return String(text||"")
  .replaceAll("{{contacto.nombre}}",String(ctx?.name||""))
  .replaceAll("{{contacto.telefono}}",String(ctx?.phone||""))
  .replace(/\{\{contacto\.([^}]+)\}\}/gi,(_m,k)=>contactVar(ctx,k))
  .replace(/\{contacto\.([^}]+)\}/gi,(_m,k)=>contactVar(ctx,k))
  .replaceAll("{nombre}",String(ctx?.name||""))
  .replaceAll("{dni}",String(ctx?.dni||""))
  .replaceAll("{telefono}",String(ctx?.phone||""))
  .replaceAll("{oferta_mensaje}",String(ctx?.oferta_mensaje||""))
  .replaceAll("{operador}",String(ctx?.operator||""))
  .replaceAll("{precio_total}",String(ctx?.precio_total||""))
  .replaceAll("{mensaje}",String(ctx?.message||""));}
function durationMs(value:any,unit:any){const n=Math.max(0,Number(value||0));return n*({minutes:60000,hours:3600000,days:86400000,weeks:604800000}[String(unit)]||0);}
function numberValue(value:any,ctx:any){const x=vars(String(value??""),ctx).replace(",",".").trim();if(!x)return null;const n=Number(x);return Number.isFinite(n)?n:null;}
function userValue(value:any,job:any){const x=String(value||"");return !x||x==="self"?job.user_id:x;}
function validDate(value:any){const d=new Date(String(value||""));return Number.isFinite(d.getTime())?d:null;}
function eventBase(ctx:any){return validDate(ctx?.event_at)||new Date();}
function madridDate(iso:string){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(iso));}
function madridAtOffset(value:any,unit:any,time?:string,baseIso?:string){const base=validDate(baseIso)||new Date();let d=new Date(base.getTime()+durationMs(value,unit));if(!time)return d.toISOString();const date=madridDate(d.toISOString());const candidate=new Date(`${date}T${/^\d\d:\d\d$/.test(time)?time:"09:00"}:00Z`);const fmt=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});const p=Object.fromEntries(fmt.formatToParts(candidate).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));const shown=new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);return new Date(candidate.getTime()-(shown.getTime()-candidate.getTime())).toISOString();}

async function greenStateAuthorized(){try{const r=await fetch(`${GREEN_PROXY}?action=state`,{headers:{"cache-control":"no-cache"}});if(!r.ok)return false;const d=await r.json().catch(()=>({}));return String(d?.state||d?.data?.stateInstance||"").toLowerCase()==="authorized";}catch{return false;}}
async function sendGreen(chatId:string,message:string){if(!chatId||!message.trim())throw new Error("WhatsApp inválido: falta chat o mensaje");if(!(await greenStateAuthorized())){const e:any=new Error("GREEN-API no está autorizada todavía");e.beforeSend=true;throw e;}let r:Response;try{r=await fetch(`${GREEN_PROXY}?action=send`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chatId,message})});}catch(err){const e:any=new Error(`Resultado de envío desconocido: ${err instanceof Error?err.message:String(err)}`);e.ambiguousSend=true;throw e;}const data=await r.json().catch(()=>({}));if(!r.ok||data?.ok===false){const e:any=new Error(String(data?.error||data?.message||`GREEN-API HTTP ${r.status}`));e.status=r.status;e.afterSend=true;throw e;}return data;}
async function resolveTemplate(userId:string,index:number){const {data,error}=await sb.from("wa_templates").select("id,name,body").eq("user_id",userId).order("name",{ascending:true}).order("id",{ascending:true});if(error)throw error;const tpl=(data||[])[Math.max(0,Number(index||0))];if(!tpl)throw new Error("Plantilla no encontrada");return tpl;}
async function resolveTemplateId(userId:string,id:any){const {data,error}=await sb.from("wa_templates").select("id,name,body").eq("user_id",userId).eq("id",id).maybeSingle();if(error)throw error;if(!data)throw new Error("Plantilla no encontrada");return data;}
async function resolveStage(stageId?:string){if(stageId){const {data}=await sb.from("sales_stages").select("id,pipeline_id,name").eq("id",stageId).maybeSingle();if(data)return data;}const {data,error}=await sb.from("sales_stages").select("id,pipeline_id,name").eq("active",true).order("position").limit(1).maybeSingle();if(error)throw error;if(!data)throw new Error("No hay columnas de ventas");return data;}

async function complete(job:any,status:"done"|"failed",errorMessage?:string,extra:any={}){const {data,error}=await sb.from("crm_server_automation_jobs").update({status,error_message:errorMessage||null,completed_at:status==="done"?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","running").select("id");if(error)throw error;if(!data?.length)return;await sb.from("crm_automation_runs").insert({automation_id:job.automation_id,user_id:job.user_id,event_key:job.event_key,context:errorMessage?{...(job.context||{}),...extra,error:errorMessage,server:true}:{...(job.context||{}),...extra,server:true},status:status==="done"?"ok":"error"});}
async function requeue(job:any,message:string,minutes=2,dependency=false){await sb.from("crm_server_automation_jobs").update({status:"pending",error_message:message,run_at:new Date(Date.now()+minutes*60000).toISOString(),updated_at:new Date().toISOString(),...(dependency?{attempts:Math.max(0,Number(job.attempts||0)-1)}:{})}).eq("id",job.id).eq("status","running");}
async function preflight(job:any){const {data,error}=await sb.rpc("crm_lifecycle_job_guard",{p_job:job.id});if(error)throw error;if(data?.context)job.context=data.context;if(data?.retry){await requeue(job,data.reason,0.1,true);return false;}return data?.allow===true;}
async function hasResponseSince(ctx:any){const chat=phoneToChat(ctx);const since=String(ctx?.flow_started_at||ctx?.event_at||"");if(!chat||!since)return false;const {data,error}=await sb.from("wa_messages").select("id").eq("chat_id",chat).eq("direction","in").gt("created_at",since).limit(1);if(error)throw error;return !!data?.length;}
async function shouldSkip(job:any){const a=job.action_config||{},ctx=job.context||{},business=businessContext(ctx);if(a.__flow_guard==="no_response"&&await hasResponseSince(ctx))return "El cliente respondió: condición no cumplida";if(a.__stop_if_response&&await hasResponseSince(ctx))return "El cliente respondió: repetición detenida";return "";}

async function enqueueChild(job:any,eventKey:string,actionType:string,config:any,context:any,runAt:string){const {error}=await sb.from("crm_server_automation_jobs").upsert({automation_id:job.automation_id,user_id:job.user_id,event_key:eventKey,action_type:actionType,action_config:config||{},context,run_at:runAt,status:"pending"},{onConflict:"automation_id,event_key",ignoreDuplicates:true});if(error)throw error;}
async function expandFlow(job:any){const steps=Array.isArray(job.action_config?.steps)?job.action_config.steps:[];if(!steps.length)throw new Error("El flujo no tiene pasos");const origin=eventBase(job.context||{});const started=origin.toISOString();const root=`${job.event_key}:flow`;let delay=0;let guard="";let previous:any=null;let actionNo=0;let previousEvent:string|null=null;
  for(let i=0;i<steps.length;i++){const s=steps[i]||{};
    if(s.kind==="wait"){delay+=durationMs(s.value,s.unit);continue;}
    if(s.kind==="condition"){guard=String(s.condition_type||"");continue;}
    if(s.kind==="action"){
      const type=s.action_type==="send_whatsapp_now"?"__send_whatsapp":String(s.action_type||"");if(!type)throw new Error(`Paso ${i+1}: acción vacía`);actionNo++;
      const cfg={...(s.config||{}),__flow_guard:guard||null,__flow_step:i+1};const ctx={...(job.context||{}),flow_root:root,flow_started_at:started};const runAt=new Date(origin.getTime()+delay).toISOString();const key=`${root}:action:${actionNo}`;await enqueueChild(job,key,type,orderedConfig(cfg,ctx,previousEvent),ctx,runAt);previousEvent=key;previous={type,config:{...(s.config||{})},guard,baseIndex:actionNo};continue;
    }
    if(s.kind==="repeat"){
      if(!previous)throw new Error(`Paso ${i+1}: no hay acción anterior para repetir`);const every=durationMs(s.every_value,s.every_unit);const times=Math.max(1,Math.min(100,Number(s.times||1)));if(!every)throw new Error(`Paso ${i+1}: intervalo de repetición inválido`);
      for(let k=1;k<=times;k++){delay+=every;const cfg={...previous.config,__flow_guard:previous.guard||null,__stop_if_response:!!s.stop_if_response,__flow_repeat:k};const ctx={...(job.context||{}),flow_root:root,flow_started_at:started};const key=`${root}:repeat:${previous.baseIndex}:${k}`;await enqueueChild(job,key,previous.type,orderedConfig(cfg,ctx,previousEvent),ctx,new Date(origin.getTime()+delay).toISOString());previousEvent=key;}
    }
  }
  return {children:actionNo,flow_root:root};
}

async function updateSiblingOpportunity(job:any,oppId:string){const root=String(job.context?.flow_root||"");if(!root)return;const {data}=await sb.from("crm_server_automation_jobs").select("id,context").eq("automation_id",job.automation_id).in("status",lifecycleEnabled(job.context)?["pending","running"]:["pending"]).contains("context",{flow_root:root});for(const row of data||[]){await sb.from("crm_server_automation_jobs").update({context:{...(row.context||{}),opportunity_id:oppId}}).eq("id",row.id);}}

async function processJob(job:any){try{
    if(!(await preflight(job)))return "requeued";
    const a=job.action_config||{},ctx=job.context||{},business=businessContext(ctx);
    if(job.action_type==="flow_v1"){const info=await expandFlow(job);await complete(job,"done",undefined,{flow_children:info.children,flow_root:info.flow_root});return "done";}
    const skipped=await shouldSkip(job);if(skipped){await complete(job,"done",undefined,{skipped:true,skip_reason:skipped});return "done";}
    if(job.action_type==="create_task"){
      const starts=madridAtOffset(a.start_value||0,a.start_unit||"minutes",a.start_time||undefined,eventBase(ctx).toISOString());const remMs=durationMs(a.reminder_value||0,a.reminder_unit||"minutes");const reminderAt=remMs?new Date(new Date(starts).getTime()-remMs).toISOString():null;
      const methods=[];if(a.notify_in_app!==false)methods.push("in_app");if(a.notify_email)methods.push("email");
      const row:any={title:vars(a.title||"Seguimiento",business),description:vars(a.description||ctx.message||"",business)||null,customer_name:vars(a.customer_name||business.name||"",business)||null,customer_phone:vars(a.customer_phone||business.phone||"",business)||null,starts_at:starts,reminder_at:reminderAt,status:a.status||"pending",assigned_to:userValue(a.assigned_to,job),created_by:job.user_id,related_record_id:ctx.contact_id||null,reminder_methods:methods.length?methods:["in_app"],reminder_minutes:remMs?[Math.round(remMs/60000)]:[],sync_google_calendar:!!a.sync_google_calendar,notify_in_app:a.notify_in_app!==false,notify_email:!!a.notify_email,whatsapp_enabled:!!a.whatsapp_enabled,whatsapp_phone:vars(a.customer_phone||ctx.phone||"",ctx)||null,whatsapp_message:vars(a.whatsapp_message||"",ctx)||null,whatsapp_scheduled_at:a.whatsapp_enabled?starts:null};
      const {error}=await sb.from("agenda_items").insert(row);if(error)throw error;
    }else if(job.action_type==="create_opportunity"){
      const stage=await resolveStage(a.stage_id);const base=eventBase(ctx);const expected=madridDate(new Date(base.getTime()+durationMs(a.expected_value||0,a.expected_unit||"days")).toISOString());
      const row:any={...(ctx.contract_party?{contract_party:ctx.contract_party}:{}),pipeline_id:stage.pipeline_id,stage_id:stage.id,record_id:ctx.contact_id||null,title:vars(a.title||"Oportunidad",business),client_name:vars(a.client_name||business.name||"",business)||null,phone:vars(a.phone||business.phone||"",business)||null,amount:numberValue(a.amount,business),expected_date:expected,owner_user_id:userValue(a.owner_user_id,job),status:a.status||"open",notes:vars(a.notes||"",business)||null,position:Number(a.position||0)};
      const {data:opp,error}=await sb.from("sales_opportunities").insert(row).select("id").single();if(error)throw error;
      const custom=a.custom_values&&typeof a.custom_values==="object"?a.custom_values:{};const rows=Object.entries(custom).filter(([,v])=>String(v??"").trim()!=="").map(([field_id,v])=>({opportunity_id:opp.id,field_id,value:vars(String(v),business)}));if(rows.length){const {error:e2}=await sb.from("sales_custom_values").upsert(rows,{onConflict:"opportunity_id,field_id"});if(e2)throw e2;}await updateSiblingOpportunity(job,opp.id);
    }else if(job.action_type==="assign_label"){
      if(!ctx.contact_id||!a.label_id)throw new Error("Falta contacto o etiqueta");const {error}=await sb.from("crm_contact_labels").upsert({contact_id:ctx.contact_id,label_id:a.label_id},{onConflict:"contact_id,label_id",ignoreDuplicates:true});if(error)throw error;
    }else if(job.action_type==="record_offer_month"||job.action_type==="record_sale_month"){
      const {data,error}=await sb.rpc("crm_lifecycle_month_label",{p_job:job.id});if(error)throw error;if(data?.allow!==true)return "requeued";
    }else if(job.action_type==="move_opportunity"){
      const oid=ctx.opportunity_id;if(!oid)throw new Error("No hay oportunidad relacionada para mover");if(!a.stage_id)throw new Error("Falta la columna de destino");const {error}=await sb.from("sales_opportunities").update({stage_id:a.stage_id,updated_at:new Date().toISOString()}).eq("id",oid);if(error)throw error;
    }else if(job.action_type==="schedule_whatsapp"||job.action_type==="__send_whatsapp"){
      if(!(await preflight(job)))return "requeued";await sendGreen(phoneToChat(job.context),vars(String(a.text||""),job.context));
    }else if(job.action_type==="send_template"){
      const tpl=a.template_id?await resolveTemplateId(job.user_id,a.template_id):await resolveTemplate(job.user_id,Number(a.template_index||0));if(!(await preflight(job)))return "requeued";await sendGreen(phoneToChat(job.context),vars(String(tpl.body||""),job.context));
    }else if(job.action_type==="sequence_label_opportunity_whatsapp"){
      const stage=await resolveStage(a.stage_id);const {data:opp,error:oppErr}=await sb.from("sales_opportunities").insert({...(ctx.contract_party?{contract_party:ctx.contract_party}:{}),pipeline_id:stage.pipeline_id,stage_id:stage.id,record_id:ctx.contact_id||null,title:a.opp_title||"Oportunidad desde etiqueta",client_name:business.name||null,phone:business.phone||null,owner_user_id:job.user_id,expected_date:madridDate(eventBase(ctx).toISOString())}).select("id").single();if(oppErr)throw oppErr;let text=String(a.text||"");if((a.message_type||"template")==="template"){const tpl=await resolveTemplate(job.user_id,Number(a.template_index||0));text=String(tpl.body||"");}text=vars(text,ctx);if(!text.trim())throw new Error("El WhatsApp está vacío");const waitMs=Number(a.wait_days||0)*86400000;await enqueueChild(job,`${job.event_key}:sequence-send`,"__send_whatsapp",{text},{...ctx,opportunity_id:opp?.id||null},new Date(eventBase(ctx).getTime()+waitMs).toISOString());
    }else throw new Error(`Acción no soportada en servidor: ${job.action_type}`);
    await complete(job,"done");return "done";
  }catch(err:any){const msg=String(err?.message||err||"Error desconocido");if(err?.beforeSend&&Number(job.attempts||0)<10){await requeue(job,msg,2);return "requeued";}await complete(job,"failed",msg);return "failed";}}

Deno.serve(async(req:Request)=>{if(req.method!=="POST"&&req.method!=="GET")return json({ok:false},405);if(!(await cronAuthorized(req)))return json({ok:false,error:"Unauthorized"},401);const {data:enabledRow}=await sb.from("app_settings").select("value").eq("key","crm_server_automations_enabled").maybeSingle();if(enabledRow?.value!==true)return json({ok:true,enabled:false,claimed:0,done:0,failed:0});const {data:jobs,error}=await sb.rpc("crm_server_claim_jobs",{p_limit:20});if(error)return json({ok:false,error:error.message},500);let done=0,failed=0,requeued=0;for(const job of jobs||[]){const result=await processJob(job);if(result==="done")done++;else if(result==="requeued")requeued++;else failed++;}return json({ok:true,enabled:true,claimed:(jobs||[]).length,done,failed,requeued});});
