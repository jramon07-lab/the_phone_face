/* TPF physical module split · generated from app-core.js */
/* ===== Motor de Automatizaciones CRM v2 ===== */
var crmAutomations=[];
let crmAutomationStartedAt=Math.floor(Date.now()/1000);
const crmAutomationSeenIncoming=new Set();

function auto2TriggerLabel(t){
 return {message_received:"Llega un WhatsApp",message_contains:"WhatsApp contiene palabra",opportunity_stage:"Oportunidad cambia de columna",label_assigned:"Se asigna etiqueta",unanswered:"Cliente sin respuesta"}[t]||t;
}
function auto2ActionLabel(t){
 return {create_task:"Crear tarea",create_opportunity:"Crear oportunidad",assign_label:"Asignar etiqueta",schedule_whatsapp:"Programar WhatsApp",send_template:"Enviar plantilla",sequence_label_opportunity_whatsapp:"Crear oportunidad → esperar → WhatsApp"}[t]||t;
}
function auto2RenderTriggerConfig(){
 const t=$("auto2Trigger").value;
 let h="";
 if(t==="message_contains")h='<label>Palabra o frase<input id="auto2Keyword" placeholder="Ej.: renovación"></label>';
 if(t==="opportunity_stage")h=`<label>Columna<select id="auto2TriggerStage">${(salesCache.stages||[]).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></label>`;
 if(t==="label_assigned")h=`<label>Etiqueta<select id="auto2TriggerLabel">${(crmLabelsCache||[]).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></label>`;
 if(t==="unanswered")h='<label>Tiempo sin respuesta<select id="auto2UnansweredMinutes"><option value="30">30 minutos</option><option value="60">1 hora</option><option value="120" selected>2 horas</option><option value="240">4 horas</option><option value="480">8 horas</option><option value="1440">24 horas</option></select></label>';
 if(t==="message_received")h='<div class="small">Se ejecutará únicamente con mensajes nuevos recibidos después de activar la regla.</div>';
 $("auto2TriggerConfig").innerHTML=h;
}
function auto2RenderActionConfig(){
 const t=$("auto2Action").value;
 let h="";
 if(t==="create_task")h='<div class="row"><label>Título<input id="auto2TaskTitle" value="Seguimiento WhatsApp"></label><label>Crear para<select id="auto2TaskDelay"><option value="0">Ahora</option><option value="60">Dentro de 1 hora</option><option value="1440" selected>Mañana</option><option value="2880">Dentro de 2 días</option><option value="10080">Dentro de 7 días</option></select></label></div>';
 if(t==="create_opportunity")h=`<div class="row"><label>Título<input id="auto2OppTitle" value="Oportunidad desde WhatsApp"></label><label>Columna<select id="auto2ActionStage">${(salesCache.stages||[]).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></label></div>`;
 if(t==="assign_label")h=`<label>Etiqueta<select id="auto2ActionLabel">${(crmLabelsCache||[]).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></label>`;
 if(t==="schedule_whatsapp")h='<div class="row"><label>Mensaje<textarea id="auto2WaText" rows="3" placeholder="Mensaje. Puedes usar {nombre}, {dni}, {telefono}"></textarea></label><label>Enviar dentro de<select id="auto2WaDelay"><option value="5">5 minutos</option><option value="30" selected>30 minutos</option><option value="60">1 hora</option><option value="1440">1 día</option></select></label></div>';
 if(t==="send_template")h=`<label>Plantilla<select id="auto2Template">${waLoadTemplates().map((x,i)=>`<option value="${i}">${esc(x.name)}</option>`).join("")}</select></label><div class="small">El envío automático usa GREEN-API y solo se ejecuta para el chat relacionado con el evento.</div>`;
 if(t==="sequence_label_opportunity_whatsapp")h=`
   <div class="auto2Sequence">
     <div class="auto2SequenceStep"><b>1 · Crear oportunidad</b>
       <label>Título<input id="auto2SeqOppTitle" value="Oportunidad desde etiqueta"></label>
       <label>Columna<select id="auto2SeqStage">${(salesCache.stages||[]).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></label>
     </div>
     <div class="auto2SequenceWait"><b>2 · Esperar</b>
       <div class="row"><label>Días<input id="auto2SeqDays" type="number" min="0" value="7"></label><label>Hora<select id="auto2SeqHour">${Array.from({length:24},(_,i)=>`<option value="${i}" ${i===10?"selected":""}>${String(i).padStart(2,"0")}:00</option>`).join("")}</select></label></div>
     </div>
     <div class="auto2SequenceStep"><b>3 · Enviar WhatsApp</b>
       <label>Tipo<select id="auto2SeqMessageType"><option value="template">Usar plantilla</option><option value="text">Escribir mensaje</option></select></label>
       <label>Plantilla<select id="auto2SeqTemplate">${waLoadTemplates().map((x,i)=>`<option value="${i}">${esc(x.name)}</option>`).join("")}</select></label>
       <label>Mensaje<textarea id="auto2SeqText" rows="3" placeholder="Opcional si eliges mensaje. Puedes usar {nombre}, {dni}, {telefono}"></textarea></label>
     </div>
   </div>`;
 $("auto2ActionConfig").innerHTML=h;
}
async function auto2PrepareOptions(){
 try{if(!(salesCache.stages||[]).length)await loadSales()}catch(e){}
 try{if(!(crmLabelsCache||[]).length)await crmLoadLabels()}catch(e){}
 try{await waSyncTemplatesFromSupabase()}catch(e){}
 auto2RenderTriggerConfig();auto2RenderActionConfig();
}
function auto2ReadTriggerConfig(){
 const t=$("auto2Trigger").value;
 if(t==="message_contains")return {keyword:$("auto2Keyword")?.value.trim()||""};
 if(t==="opportunity_stage")return {stage_id:$("auto2TriggerStage")?.value||""};
 if(t==="label_assigned")return {label_id:$("auto2TriggerLabel")?.value||""};
 if(t==="unanswered")return {minutes:Number($("auto2UnansweredMinutes")?.value||120)};
 return {};
}
function auto2ReadActionConfig(){
 const t=$("auto2Action").value;
 if(t==="create_task")return {title:$("auto2TaskTitle")?.value.trim()||"Seguimiento WhatsApp",delay_minutes:Number($("auto2TaskDelay")?.value||0)};
 if(t==="create_opportunity")return {title:$("auto2OppTitle")?.value.trim()||"Oportunidad desde WhatsApp",stage_id:$("auto2ActionStage")?.value||""};
 if(t==="assign_label")return {label_id:$("auto2ActionLabel")?.value||""};
 if(t==="schedule_whatsapp")return {text:$("auto2WaText")?.value.trim()||"",delay_minutes:Number($("auto2WaDelay")?.value||30)};
 if(t==="send_template")return {template_index:Number($("auto2Template")?.value||0)};
 if(t==="sequence_label_opportunity_whatsapp")return {
   opp_title:$("auto2SeqOppTitle")?.value.trim()||"Oportunidad desde etiqueta",
   stage_id:$("auto2SeqStage")?.value||"",
   wait_days:Math.max(0,Number($("auto2SeqDays")?.value||0)),
   send_hour:Math.max(0,Math.min(23,Number($("auto2SeqHour")?.value||10))),
   message_type:$("auto2SeqMessageType")?.value||"template",
   template_index:Number($("auto2SeqTemplate")?.value||0),
   text:$("auto2SeqText")?.value.trim()||""
 };
 return {};
}
async function loadAutomations(){
 try{
   await auto2PrepareOptions();
   const {data,error}=await sb.rpc("crm_list_automations");if(error)throw error;
   crmAutomations=Array.isArray(data)?data:[];
   auto2RenderList();
 }catch(e){if($("auto2Msg"))$("auto2Msg").textContent=e.message||"No se pudieron cargar las automatizaciones."}
}
function auto2RenderList(){
 const f=$("auto2Filter")?.value||"all";
 const rows=crmAutomations.filter(x=>f==="all"||(f==="enabled"&&x.enabled)||(f==="disabled"&&!x.enabled));
 $("auto2Empty").style.display=rows.length?"none":"block";
 $("auto2List").innerHTML=rows.map(r=>`<div class="auto2Rule">
   <div class="auto2RuleTop">
    <div class="auto2RuleTitle"><div class="auto2RuleIcon">⚡</div><div><b>${esc(r.name)}</b><div class="auto2RuleText">${esc(auto2TriggerLabel(r.trigger_type))} → ${esc(auto2ActionLabel(r.action_type))}</div><span class="auto2State${r.enabled?"":" off"}">${r.enabled?"Activa":"Desactivada"}</span></div></div>
    <div class="auto2RuleActions"><button onclick="auto2Toggle('${r.id}',${!r.enabled})">${r.enabled?"Desactivar":"Activar"}</button><button onclick="auto2Edit('${r.id}')">Editar</button><button class="danger" onclick="auto2Delete('${r.id}')">Eliminar</button></div>
   </div></div>`).join("");
}
$("auto2Trigger").onchange=auto2RenderTriggerConfig;$("auto2Action").onchange=auto2RenderActionConfig;$("auto2Reload").onclick=loadAutomations;$("auto2Filter").onchange=auto2RenderList;
$("auto2Cancel").onclick=()=>auto2ResetForm();
function auto2ResetForm(){
 $("auto2Id").value="";$("auto2Name").value="";$("auto2Enabled").checked=true;$("auto2FormTitle").textContent="Nueva automatización";$("auto2Save").textContent="Guardar automatización";$("auto2Cancel").classList.add("hidden");$("auto2Msg").textContent="";auto2RenderTriggerConfig();auto2RenderActionConfig();
}
$("auto2Save").onclick=async()=>{
 const name=$("auto2Name").value.trim();if(!name){$("auto2Msg").textContent="Pon un nombre.";return}
 const id=$("auto2Id").value||null;
 $("auto2Save").disabled=true;
 try{
  const {error}=await sb.rpc("crm_upsert_automation",{p_id:id,p_name:name,p_enabled:$("auto2Enabled").checked,p_trigger_type:$("auto2Trigger").value,p_trigger_config:auto2ReadTriggerConfig(),p_action_type:$("auto2Action").value,p_action_config:auto2ReadActionConfig()});
  if(error)throw error;$("auto2Msg").textContent=id?"Automatización actualizada.":"Automatización creada.";auto2ResetForm();await loadAutomations();
 }catch(e){$("auto2Msg").textContent=e.message||"No se pudo guardar."}finally{$("auto2Save").disabled=false}
};
window.auto2Toggle=async(id,enabled)=>{const r=crmAutomations.find(x=>x.id===id);if(!r)return;const {error}=await sb.rpc("crm_upsert_automation",{p_id:id,p_name:r.name,p_enabled:enabled,p_trigger_type:r.trigger_type,p_trigger_config:r.trigger_config||{},p_action_type:r.action_type,p_action_config:r.action_config||{}});if(error)alert(error.message);else loadAutomations()};
window.auto2Delete=async id=>{const r=crmAutomations.find(x=>x.id===id);if(!confirm(`¿Eliminar "${r?.name||"esta automatización"}"?`))return;const {error}=await sb.rpc("crm_delete_automation",{p_id:id});if(error)alert(error.message);else loadAutomations()};
window.auto2Edit=async id=>{
 const r=crmAutomations.find(x=>x.id===id);if(!r)return;$("auto2Id").value=r.id;$("auto2Name").value=r.name;$("auto2Enabled").checked=!!r.enabled;$("auto2Trigger").value=r.trigger_type;$("auto2Action").value=r.action_type;await auto2PrepareOptions();auto2RenderTriggerConfig();auto2RenderActionConfig();
 const tc=r.trigger_config||{},ac=r.action_config||{};
 if($("auto2Keyword"))$("auto2Keyword").value=tc.keyword||"";if($("auto2TriggerStage"))$("auto2TriggerStage").value=tc.stage_id||"";if($("auto2TriggerLabel"))$("auto2TriggerLabel").value=tc.label_id||"";if($("auto2UnansweredMinutes"))$("auto2UnansweredMinutes").value=String(tc.minutes||120);
 if($("auto2TaskTitle"))$("auto2TaskTitle").value=ac.title||"Seguimiento WhatsApp";if($("auto2TaskDelay"))$("auto2TaskDelay").value=String(ac.delay_minutes||0);if($("auto2OppTitle"))$("auto2OppTitle").value=ac.title||"Oportunidad desde WhatsApp";if($("auto2ActionStage"))$("auto2ActionStage").value=ac.stage_id||"";if($("auto2ActionLabel"))$("auto2ActionLabel").value=ac.label_id||"";if($("auto2WaText"))$("auto2WaText").value=ac.text||"";if($("auto2WaDelay"))$("auto2WaDelay").value=String(ac.delay_minutes||30);if($("auto2Template"))$("auto2Template").value=String(ac.template_index||0);
 if($("auto2SeqOppTitle"))$("auto2SeqOppTitle").value=ac.opp_title||"Oportunidad desde etiqueta";
 if($("auto2SeqStage"))$("auto2SeqStage").value=ac.stage_id||"";
 if($("auto2SeqDays"))$("auto2SeqDays").value=String(ac.wait_days??7);
 if($("auto2SeqHour"))$("auto2SeqHour").value=String(ac.send_hour??10);
 if($("auto2SeqMessageType"))$("auto2SeqMessageType").value=ac.message_type||"template";
 if($("auto2SeqTemplate"))$("auto2SeqTemplate").value=String(ac.template_index||0);
 if($("auto2SeqText"))$("auto2SeqText").value=ac.text||"";
 $("auto2FormTitle").textContent="Editar automatización";$("auto2Save").textContent="Guardar cambios";$("auto2Cancel").classList.remove("hidden");
};

/* Ejecución segura una sola vez por evento */
async function auto2AlreadyRan(automationId,eventKey){
 const {data}=await sb.from("crm_automation_runs").select("id").eq("automation_id",automationId).eq("event_key",eventKey).limit(1);return !!data?.length;
}
async function auto2LogRun(automationId,eventKey,context,status="ok"){
 try{await sb.from("crm_automation_runs").insert({automation_id:automationId,event_key:eventKey,context,status})}catch(e){}
}
function auto2ContextVars(text,ctx){
 const name=ctx.name||"",dni=ctx.dni||"",phone=ctx.phone||"";
 return String(text||"").replaceAll("{nombre}",name).replaceAll("{dni}",dni).replaceAll("{telefono}",phone);
}
async function auto2Execute(rule,ctx,eventKey){
 if(await auto2AlreadyRan(rule.id,eventKey))return;
 try{
  const a=rule.action_config||{};
  if(rule.action_type==="create_task"){
   const {data:{user}}=await sb.auth.getUser();const when=new Date(Date.now()+Number(a.delay_minutes||0)*60000).toISOString();
   const {error}=await sb.from("agenda_items").insert({title:a.title||"Seguimiento WhatsApp",description:ctx.message||null,customer_name:ctx.name||null,customer_phone:ctx.phone||null,starts_at:when,assigned_to:user?.id||null,related_record_id:ctx.contact_id||null,status:"pending"});if(error)throw error;
  }else if(rule.action_type==="create_opportunity"){
   let stage=(salesCache.stages||[]).find(s=>String(s.id)===String(a.stage_id));if(!stage){if(!(salesCache.stages||[]).length)await loadSales();stage=(salesCache.stages||[])[0]}if(!stage)throw new Error("No hay columnas de ventas.");
   const {error}=await sb.from("sales_opportunities").insert({pipeline_id:stage.pipeline_id,stage_id:stage.id,record_id:ctx.contact_id||null,title:a.title||"Oportunidad desde WhatsApp",client_name:ctx.name||null,phone:ctx.phone||null});if(error)throw error;
  }else if(rule.action_type==="assign_label"){
   if(!ctx.contact_id||!a.label_id)throw new Error("Falta contacto o etiqueta.");
   const current=await crmGetContactLabels(ctx.contact_id);const ids=[...new Set(current.map(x=>x.id).concat([a.label_id]))];const {error}=await sb.rpc("crm_set_contact_labels",{p_contact_id:ctx.contact_id,p_label_ids:ids});if(error)throw error;
  }else if(rule.action_type==="schedule_whatsapp"){
   if(!ctx.phone)throw new Error("El contacto no tiene teléfono.");const {data:{user}}=await sb.auth.getUser();const when=new Date(Date.now()+Number(a.delay_minutes||30)*60000).toISOString();const text=auto2ContextVars(a.text,ctx);
   const {error}=await sb.from("agenda_items").insert({title:"WhatsApp programado",customer_name:ctx.name||null,customer_phone:ctx.phone,starts_at:when,assigned_to:user?.id||null,status:"pending",whatsapp_enabled:true,whatsapp_phone:ctx.phone,whatsapp_message:text,whatsapp_scheduled_at:when});if(error)throw error;
  }else if(rule.action_type==="send_template"){
   if(!ctx.chat_id)throw new Error("No hay chat relacionado.");const tpl=waLoadTemplates()[Number(a.template_index||0)];if(!tpl)throw new Error("Plantilla no encontrada.");await waApi("send",{chatId:ctx.chat_id,message:auto2ContextVars(tpl.text,ctx)});
  }else if(rule.action_type==="sequence_label_opportunity_whatsapp"){
   if(!ctx.contact_id)throw new Error("La etiqueta debe estar asociada a un contacto.");
   let stage=(salesCache.stages||[]).find(s=>String(s.id)===String(a.stage_id));
   if(!stage){if(!(salesCache.stages||[]).length)await loadSales();stage=(salesCache.stages||[]).find(s=>String(s.id)===String(a.stage_id))||(salesCache.stages||[])[0]}
   if(!stage)throw new Error("No hay columnas de ventas.");
   const {data:opp,error:oppErr}=await sb.from("sales_opportunities").insert({
     pipeline_id:stage.pipeline_id,stage_id:stage.id,record_id:ctx.contact_id,
     title:a.opp_title||"Oportunidad desde etiqueta",client_name:ctx.name||null,phone:ctx.phone||null
   }).select("id").single();
   if(oppErr)throw oppErr;

   if(!ctx.phone)throw new Error("El contacto no tiene teléfono.");
   const {data:{user}}=await sb.auth.getUser();
   const now=new Date();
   const when=new Date(now.getTime()+Math.max(0,Number(a.wait_days||0))*86400000);
   when.setHours(Math.max(0,Math.min(23,Number(a.send_hour??10))),0,0,0);
   if(when.getTime()<Date.now())when.setDate(when.getDate()+1);

   let msg="";
   if((a.message_type||"template")==="template"){
     const tpl=waLoadTemplates()[Number(a.template_index||0)];
     if(!tpl)throw new Error("Plantilla no encontrada.");
     msg=auto2ContextVars(tpl.text,ctx);
   }else{
     msg=auto2ContextVars(a.text||"",ctx);
   }
   if(!msg.trim())throw new Error("El WhatsApp está vacío.");

   const {error:waErr}=await sb.from("agenda_items").insert({
     title:"WhatsApp automático",
     customer_name:ctx.name||null,
     customer_phone:ctx.phone,
     starts_at:when.toISOString(),
     assigned_to:user?.id||null,
     related_record_id:ctx.contact_id,
     status:"pending",
     whatsapp_enabled:true,
     whatsapp_phone:ctx.phone,
     whatsapp_message:msg,
     whatsapp_scheduled_at:when.toISOString(),
     description:`Automatización: ${rule.name}${opp?.id?` · Oportunidad ${opp.id}`:""}`
   });
   if(waErr)throw waErr;
  }
  await auto2LogRun(rule.id,eventKey,ctx,"ok");
 }catch(e){await auto2LogRun(rule.id,eventKey,{...ctx,error:e.message},"error");console.warn("Automatización",rule.name,e)}
}
async function auto2Fire(triggerType,ctx,eventKey){
 if(!crmAutomations.length)try{const {data}=await sb.rpc("crm_list_automations");crmAutomations=data||[]}catch(e){}
 for(const r of crmAutomations.filter(x=>x.enabled&&x.trigger_type===triggerType)){
  const tc=r.trigger_config||{};
  if(triggerType==="message_contains"&&!String(ctx.message||"").toLowerCase().includes(String(tc.keyword||"").toLowerCase()))continue;
  if(triggerType==="opportunity_stage"&&String(tc.stage_id||"")!==String(ctx.stage_id||""))continue;
  if(triggerType==="label_assigned"&&String(tc.label_id||"")!==String(ctx.label_id||""))continue;
  await auto2Execute(r,ctx,eventKey+":"+r.id);
 }
}

/* Mensajes nuevos recibidos: la primera carga solo establece línea base */
let auto2HistoryBaselineReady=false;
const _auto2LoadHistoryBase=loadWaHistory;
loadWaHistory=async function(scrollBottom=true){
 const previousIds=new Set((waLiveState.history||[]).map(m=>String(m?.idMessage||"")));
 await _auto2LoadHistoryBase(scrollBottom);
 const chat=waLiveState.selected;if(!chat)return;
 const incoming=(waLiveState.history||[]).filter(m=>waMessageDirection(m)==="in"&&m?.idMessage&&!previousIds.has(String(m.idMessage)));
 if(!auto2HistoryBaselineReady){incoming.forEach(m=>crmAutomationSeenIncoming.add(String(m.idMessage)));auto2HistoryBaselineReady=true;return}
 for(const m of incoming){
  const id=String(m.idMessage);if(crmAutomationSeenIncoming.has(id))continue;crmAutomationSeenIncoming.add(id);
  const d=waLiveState.contact?.data||{},ctx={chat_id:chat.id,contact_id:waLiveState.contact?.id||null,name:contactField(d,"NOMBRE Y APELLIDOS","NOMBRE","CLIENTE","CLIENTE FINAL")||chat.name||"",phone:waNormalizePhone(chat.id),dni:contactField(d,"DNI / NIF","DNI","NIF")||"",message:waMessageText(m),id_message:id};
  await auto2Fire("message_received",ctx,"msg:"+id);await auto2Fire("message_contains",ctx,"msgcontains:"+id);
 }
};

/* Cambio de columna de oportunidad */
const _runOpportunityAutomationsV2=runOpportunityAutomations;
runOpportunityAutomations=async function(opportunityId){
 try{await _runOpportunityAutomationsV2(opportunityId)}catch(e){}
 let o=(salesCache.opportunities||[]).find(x=>String(x.id)===String(opportunityId));if(!o){try{const {data}=await sb.from("sales_opportunities").select("*").eq("id",opportunityId).maybeSingle();o=data}catch(e){}}
 if(o){const rec=await findContactRecordForOpportunity(o).catch(()=>null),d=rec?.data||{};await auto2Fire("opportunity_stage",{opportunity_id:o.id,stage_id:o.stage_id,contact_id:rec?.id||o.record_id||null,name:o.client_name||contactField(d,"NOMBRE Y APELLIDOS","NOMBRE")||"",phone:o.phone||contactField(d,"TELÉFONO","TELEFONO")||"",dni:contactField(d,"DNI / NIF","DNI","NIF")||""},"oppstage:"+o.id+":"+o.stage_id)}
};

/* Etiqueta asignada */
const _crmSetLabelsAuto2=$("contactLabelsSave").onclick;
$("contactLabelsSave").onclick=async function(){
 const before=currentContact?await crmGetContactLabels(currentContact.id).catch(()=>[]):[];
 await _crmSetLabelsAuto2.call(this);
 if(!currentContact)return;const after=await crmGetContactLabels(currentContact.id).catch(()=>[]),oldIds=new Set(before.map(x=>x.id)),added=after.filter(x=>!oldIds.has(x.id)),d=currentContact.data||{};
 for(const lab of added)await auto2Fire("label_assigned",{contact_id:currentContact.id,label_id:lab.id,label_name:lab.name,name:contactField(d,"NOMBRE Y APELLIDOS","NOMBRE")||"",phone:contactField(d,"TELÉFONO","TELEFONO")||"",dni:contactField(d,"DNI / NIF","DNI","NIF")||""},"label:"+currentContact.id+":"+lab.id+":"+Date.now());
};

/* Cliente sin respuesta */
const auto2ContactLookupCache=new Map();
async function auto2LookupContactByPhone(phone){
  const key=String(phone||"").replace(/\D/g,"");
  const cached=auto2ContactLookupCache.get(key);
  if(cached && Date.now()-cached.at<10*60*1000)return cached.record;
  let rec=null;
  try{
    for(const q of waPhoneVariants(phone)){
      const {data}=await sb.rpc("search_records",{search_text:q,sheet_filter:"BASE DE DATOS",result_limit:3});
      if(data?.length){rec=data[0];break}
    }
  }catch(e){}
  auto2ContactLookupCache.set(key,{at:Date.now(),record:rec});
  if(auto2ContactLookupCache.size>500){
    const oldest=[...auto2ContactLookupCache.entries()].sort((a,b)=>a[1].at-b[1].at).slice(0,100);
    oldest.forEach(([k])=>auto2ContactLookupCache.delete(k));
  }
  return rec;
}
async function auto2CheckUnanswered(){
 if(!crmAutomations.length)return;
 const now=Math.floor(Date.now()/1000);
 for(const r of crmAutomations.filter(x=>x.enabled&&x.trigger_type==="unanswered")){
  const mins=Number(r.trigger_config?.minutes||120);
  for(const c of (waLiveState.chats||[])){
   const meta=waMeta(c.id),inc=Number(meta.lastIncomingAt||0),out=Number(meta.lastOutgoingAt||0);
   if(!inc||out>=inc||now-inc<mins*60)continue;
   const phone=waNormalizePhone(c.id);
   const rec=await auto2LookupContactByPhone(phone);
   const d=rec?.data||{},ctx={chat_id:c.id,contact_id:rec?.id||null,name:contactField(d,"NOMBRE Y APELLIDOS","NOMBRE")||c.name||"",phone,dni:contactField(d,"DNI / NIF","DNI","NIF")||"",minutes_waiting:Math.floor((now-inc)/60)};
   await auto2Execute(r,ctx,`unanswered:${c.id}:${inc}:${mins}:${r.id}`);
  }
 }
}
setInterval(auto2CheckUnanswered,120000);
setTimeout(()=>{loadAutomations().catch(()=>{});auto2CheckUnanswered().catch(()=>{})},1800);


/* ===== Dashboard comercial + objetivo mensual + historial completo ===== */
function crmMonthStart(d=new Date()){return new Date(d.getFullYear(),d.getMonth(),1)}
function crmMonthEnd(d=new Date()){return new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59,999)}
function crmMoney(n){return Number(n||0).toLocaleString("es-ES",{style:"currency",currency:"EUR"})}
async function loadCommercialDashboard(){
  try{
    const now=new Date(),start=crmMonthStart(now),end=crmMonthEnd(now),monthStr=start.toISOString().slice(0,10);
    let goalAmount=0,goalOpps=0;
    try{
      const {data,error}=await sb.rpc("crm_get_month_goal",{p_month:monthStr});
      if(!error&&data?.length){goalAmount=Number(data[0].target_amount||0);goalOpps=Number(data[0].target_opportunities||0)}
    }catch(e){}
    let opps=[];
    try{const {data,error}=await sb.from("sales_opportunities").select("*");if(!error)opps=data||[]}catch(e){}
    const stages=salesCache?.stages||[];
    const stageName=id=>(stages.find(s=>String(s.id)===String(id))?.name||"").toLowerCase();
    const won=opps.filter(o=>/ganad|cerrad.*gan|won/.test(stageName(o.stage_id)));
    const wonThisMonth=won.filter(o=>{const d=new Date(o.updated_at||o.created_at||0);return d>=start&&d<=end});
    const wonAmount=wonThisMonth.reduce((s,o)=>s+Number(o.amount||0),0);
    const open=opps.filter(o=>!/ganad|perdid|cerrad/.test(stageName(o.stage_id)));
    const forecast=open.reduce((s,o)=>s+Number(o.amount||0),0)+wonAmount;
    const progress=goalAmount>0?Math.min(100,Math.round((wonAmount/goalAmount)*100)):0;
    $("dashGoalAmount").textContent=crmMoney(goalAmount);$("dashWonAmount").textContent=crmMoney(wonAmount);$("dashForecastAmount").textContent=crmMoney(forecast);$("dashGoalProgress").textContent=progress+"%";$("dashGoalBarFill").style.width=progress+"%";
    const byStage={};open.forEach(o=>{const n=stages.find(s=>String(s.id)===String(o.stage_id))?.name||"Sin columna";byStage[n]=(byStage[n]||0)+Number(o.amount||0)});
    $("dashForecastBreakdown").innerHTML=Object.entries(byStage).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([n,v])=>`<div class="forecastRow"><b>${esc(n)}</b><span>${esc(crmMoney(v))}</span></div>`).join("")||'<div class="small">Sin oportunidades abiertas.</div>';
    const today0=new Date();today0.setHours(0,0,0,0);const today1=new Date(today0);today1.setDate(today1.getDate()+1);
    let agenda=[];try{const {data,error}=await sb.from("agenda_items").select("*").gte("starts_at",today0.toISOString()).lt("starts_at",today1.toISOString()).order("starts_at",{ascending:true});if(!error)agenda=data||[]}catch(e){}
    $("dashContactToday").innerHTML=agenda.slice(0,10).map(x=>`<button class="dashItem" onclick="openAppView('agenda')"><b>${esc(x.customer_name||x.title||"Seguimiento")}</b><span>${esc(x.customer_phone||"")} · ${new Date(x.starts_at).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</span></button>`).join("")||'<div class="small">No tienes contactos programados para hoy.</div>';
    const priority=open.filter(o=>{const d=o.expected_date?new Date(o.expected_date+"T23:59:59").getTime():0;return d&&d<Date.now()}).sort((a,b)=>String(a.expected_date).localeCompare(String(b.expected_date))).slice(0,8);
    $("dashPriorityFollowups").innerHTML=priority.map(o=>`<button class="dashItem" onclick="openOpportunityFull('${o.id}')"><b>${esc(o.client_name||o.title||"Oportunidad")}</b><span>${esc(o.expected_date||"Sin fecha")} · ${esc(crmMoney(o.amount||0))} <i class="priorityTag">Vencida</i></span></button>`).join("")||'<div class="small">No hay seguimientos vencidos.</div>';
    $("goalAmountInput").value=goalAmount||"";$("goalOppInput").value=goalOpps||"";
  }catch(e){console.warn("Dashboard comercial",e)}
}
$("dashGoalEdit").onclick=()=>{$("goalModal").classList.remove("hidden")};
$("goalModalClose").onclick=()=>$("goalModal").classList.add("hidden");
$("goalModal").onclick=e=>{if(e.target===$("goalModal"))$("goalModal").classList.add("hidden")};
$("goalSave").onclick=async()=>{
  $("goalSave").disabled=true;$("goalMsg").textContent="";
  try{
    const month=crmMonthStart(new Date()).toISOString().slice(0,10);
    const {error}=await sb.rpc("crm_set_month_goal",{p_month:month,p_target_amount:Number($("goalAmountInput").value||0),p_target_opportunities:Number($("goalOppInput").value||0)});
    if(error)throw error;$("goalMsg").textContent="Objetivo guardado.";await loadCommercialDashboard()
  }catch(e){$("goalMsg").textContent=e.message||"No se pudo guardar."}finally{$("goalSave").disabled=false}
};
let enrichContactHistoryBusy=false;
async function enrichContactHistory(){
  if(enrichContactHistoryBusy||!currentContact||!$("cpTimeline"))return;
  enrichContactHistoryBusy=true;
  $("cpTimeline").querySelectorAll("[data-crm-extra-history='1']").forEach(n=>n.remove());
  const d=currentContact.data||{},phone=String(contactField(d,"TELÉFONO","TELEFONO","TEL","MÓVIL","MOVIL","PHONE")||"").replace(/\D/g,""),chatId=phone?phone+"@c.us":"",extra=[];
  if(chatId){
    try{
      const {data,error}=await sb.rpc("wa_get_messages",{p_chat_id:chatId,p_limit:100});
      if(!error)(data||[]).slice(-40).forEach(m=>extra.push({date:new Date(Number(m.ts||0)*1000),title:m.direction==="in"?"WhatsApp recibido":"WhatsApp enviado",text:m.text_content||m.type_message||"Mensaje",type:m.direction==="in"?"wa_in":"wa_out"}))
    }catch(e){}
  }
  try{const labs=await crmGetContactLabels(currentContact.id);if(labs?.length)extra.push({date:new Date(),title:"Etiquetas actuales",text:labs.map(x=>x.name).join(", "),type:"label"})}catch(e){}
  if(extra.length){
    const extraHtml=extra.sort((a,b)=>b.date-a.date).map(x=>`<div class="cpEvent cpEvent-${x.type}" data-crm-extra-history="1"><div class="cpDot"></div><div class="cpEventBody"><small>${x.date.toLocaleString("es-ES")}</small><b>${esc(x.title)}</b><div>${esc(x.text)}</div></div></div>`).join("");
    $("cpTimeline").insertAdjacentHTML("afterbegin",extraHtml)
  }
  enrichContactHistoryBusy=false;
}
const _renderContactProfileCommercial=renderContactProfile;
renderContactProfile=async function(){const r=await _renderContactProfileCommercial();setTimeout(()=>enrichContactHistory(),50);return r};
const _loadDashboardCommercialBase=loadDashboard;
loadDashboard=async function(){const r=await _loadDashboardCommercialBase();try{if(!(salesCache?.stages||[]).length)await loadSales()}catch(e){}await loadCommercialDashboard();return r};
setTimeout(()=>{if(!$("view-dashboard")?.classList.contains("hidden"))loadCommercialDashboard()},1600);
