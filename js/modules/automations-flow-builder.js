(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const units=[['minutes','minutos'],['hours','horas'],['days','días'],['weeks','semanas']];
  let flow={id:null,name:'',enabled:true,trigger_type:'',trigger_config:{},steps:[]};
  let opts={stages:[],pipelines:[],labels:[],templates:[],salesFields:[],users:[]};
  let observer=null;

  function uid(){return 's_'+Math.random().toString(36).slice(2)+Date.now().toString(36)}
  function unitOptions(v=''){return '<option value="">Unidad…</option>'+units.map(([x,l])=>`<option value="${x}" ${v===x?'selected':''}>${l}</option>`).join('')}
  function actionLabel(t){return ({create_opportunity:'Crear oportunidad',create_task:'Crear tarea',send_whatsapp_now:'Enviar WhatsApp ahora',send_template:'Enviar plantilla WhatsApp',assign_label:'Asignar etiqueta',move_opportunity:'Mover oportunidad de columna',record_offer_month:'Registrar OFERTA · mes y año',record_sale_month:'Cambiar OFERTA por VENTAS · mes y año'})[t]||'Elige una acción'}
  function triggerLabel(t){return ({message_received:'Llega un WhatsApp',message_contains:'WhatsApp contiene palabra o frase',opportunity_stage:'Oportunidad entra en una columna',label_assigned:'Se asigna una etiqueta',unanswered:'Cliente sin respuesta'})[t]||'Elige qué inicia la automatización'}
  function getRule(id){return (Array.isArray(window.crmAutomations)?window.crmAutomations:[]).find(x=>String(x.id)===String(id))}

  function ensureStyles(){
    if($('tpfFlowStyles'))return;
    const s=document.createElement('style');s.id='tpfFlowStyles';s.textContent=`
      #tpfFlowBuilder{margin:0 0 14px;padding:0;border:1px solid #dfe6ef;border-radius:15px;background:#fff;box-shadow:0 5px 18px rgba(15,23,42,.04);overflow:hidden}
      .tpfFlowHead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 17px;border-bottom:1px solid #edf1f5}.tpfFlowHead h3{margin:0;font-size:16px}.tpfFlowHeadActions{display:flex;gap:7px;flex-wrap:wrap}
      .tpfFlowMeta{display:grid;grid-template-columns:1.6fr 1fr 1fr;gap:10px;padding:14px 17px;background:#fbfcfe;border-bottom:1px solid #edf1f5}.tpfFlowMeta label,.tpfStepConfig label{font-size:10px;font-weight:700;color:#475467}.tpfFlowMeta input,.tpfFlowMeta select,.tpfStepConfig input,.tpfStepConfig select,.tpfStepConfig textarea{margin-top:5px;width:100%}
      .tpfFlowBody{display:grid;grid-template-columns:minmax(300px,390px) 1fr;gap:14px;padding:14px 17px 17px}.tpfFlowTimeline{border:1px solid #e5eaf0;border-radius:12px;padding:11px;background:#fcfdff}.tpfFlowTimelineTitle{font-size:11px;font-weight:800;margin-bottom:9px}
      .tpfFlowStep{position:relative;padding:10px;border:1px solid #e3e8ef;border-radius:10px;background:#fff;margin-bottom:9px}.tpfFlowStep.active{border-color:#7aa9ef;box-shadow:0 0 0 2px rgba(37,99,235,.08)}.tpfFlowStepTop{display:flex;align-items:center;gap:7px}.tpfStepNum{width:22px;height:22px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;background:#eef4ff;color:#285ab8;font-size:10px;font-weight:800}.tpfStepKind{font-size:9px;font-weight:800;border-radius:999px;padding:3px 7px}.tpfKindAction{background:#eaf8ef;color:#23733c}.tpfKindWait{background:#fff4df;color:#925f00}.tpfKindRepeat{background:#f2edff;color:#6440a8}.tpfKindCondition{background:#e9f6ff;color:#17628b}.tpfFlowStepTitle{font-size:11px;font-weight:700;flex:1}.tpfFlowStep button{padding:4px 7px;font-size:9px}
      .tpfFlowAdd{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}.tpfFlowAdd button{padding:8px 5px;font-size:9px;background:#fff;border:1px dashed #aebed2;color:#315b95}.tpfFlowEmpty{padding:18px;text-align:center;color:#667085;font-size:11px;border:1px dashed #cbd5e1;border-radius:10px}
      .tpfStepEditor{border:1px solid #e5eaf0;border-radius:12px;padding:13px;min-height:260px}.tpfStepEditor h4{margin:0 0 4px;font-size:14px}.tpfStepEditor .hint{font-size:10px;color:#667085;margin-bottom:11px}.tpfStepConfig{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.tpfStepConfig .full{grid-column:1/-1}.tpfStepConfig .three{grid-column:span 1}.tpfFieldGroup{grid-column:1/-1;border-top:1px solid #edf1f5;padding-top:10px;margin-top:3px}.tpfFieldGroup h5{margin:0 0 8px;font-size:11px}.tpfCheckRow{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.tpfCheckRow label{display:flex;gap:5px;align-items:center;font-weight:600}.tpfCheckRow input{width:auto;margin:0}
      .tpfVarHelp{grid-column:1/-1;padding:8px 9px;border-radius:8px;background:#f7f9fc;color:#667085;font-size:9px}.tpfFlowMessage{padding:0 17px 14px;font-size:10px;min-height:14px}.tpfFlowMessage.ok{color:#23733c}.tpfFlowMessage.err{color:#b42318}
      #view-automations.tpfFlowMode .automation2Grid>.card:first-child{display:none!important}#view-automations.tpfFlowMode #tpfAutomationAdvancedBar{display:none!important}
      @media(max-width:1050px){.tpfFlowBody{grid-template-columns:1fr}.tpfFlowMeta{grid-template-columns:1fr 1fr}.tpfFlowMeta label:first-child{grid-column:1/-1}}@media(max-width:700px){.tpfFlowMeta,.tpfStepConfig{grid-template-columns:1fr}.tpfFlowAdd{grid-template-columns:1fr 1fr}.tpfStepConfig .full{grid-column:auto}}
    `;document.head.appendChild(s);
  }

  async function loadOptions(){
    try{const {data}=await sb.from('sales_stages').select('id,pipeline_id,name,position,active').eq('active',true).order('position');opts.stages=data||[]}catch(_){opts.stages=[]}
    try{const {data}=await sb.from('sales_pipelines').select('id,name').order('name');opts.pipelines=data||[]}catch(_){opts.pipelines=[]}
    try{const {data}=await sb.from('crm_labels').select('id,name').order('name');opts.labels=data||[]}catch(_){opts.labels=[]}
    try{const {data}=await sb.from('wa_templates').select('id,name,body').order('name');opts.templates=data||[]}catch(_){opts.templates=[]}
    try{const {data}=await sb.from('sales_custom_fields').select('id,field_key,label,field_type,options,required,pipeline_id,active').eq('active',true).order('position');opts.salesFields=data||[]}catch(_){opts.salesFields=[]}
    opts.users=[];
    try{
      const {data:sessionData}=await sb.auth.getSession();
      if(sessionData?.session?.user){
        const {data,error}=await sb.rpc('admin_list_users_permissions');
        if(!error)opts.users=Array.isArray(data)?data:[];
      }
    }catch(_){opts.users=[]}
  }

  function ensureBuilder(){
    const view=$('view-automations');if(!view)return;
    ensureStyles();view.classList.add('tpfFlowMode');
    let b=$('tpfFlowBuilder');
    if(!b){b=document.createElement('section');b.id='tpfFlowBuilder';b.innerHTML=`
      <div class="tpfFlowHead"><div><h3>Constructor libre de automatizaciones</h3><div class="small">Elige el disparador y añade acciones, esperas, condiciones y repeticiones en el orden que quieras.</div></div><div class="tpfFlowHeadActions"><button id="tpfFlowNew" class="secondary" type="button">Nueva</button><button id="tpfFlowSave" class="primary" type="button">Guardar automatización</button></div></div>
      <div class="tpfFlowMeta"><label>Nombre de la automatización<input id="tpfFlowName" placeholder="Ej.: Renovación → seguimiento"></label><label>CUANDO<select id="tpfFlowTrigger"><option value="">Elige qué la inicia…</option><option value="message_received">Llega un WhatsApp</option><option value="message_contains">WhatsApp contiene palabra o frase</option><option value="opportunity_stage">Oportunidad entra en una columna</option><option value="label_assigned">Se asigna una etiqueta</option><option value="unanswered">Cliente sin respuesta</option></select></label><label>Estado<select id="tpfFlowEnabled"><option value="1">Activa</option><option value="0">Pausada</option></select></label><div id="tpfFlowTriggerConfig" class="full"></div></div>
      <div class="tpfFlowBody"><div><div class="tpfFlowTimeline"><div class="tpfFlowTimelineTitle">PASOS DEL FLUJO</div><div id="tpfFlowSteps"></div><div class="tpfFlowAdd"><button type="button" data-add="action">+ Acción</button><button type="button" data-add="wait">+ Espera</button><button type="button" data-add="condition">+ Condición</button><button type="button" data-add="repeat">+ Repetición</button></div></div></div><div id="tpfStepEditor" class="tpfStepEditor"></div></div><div id="tpfFlowMessage" class="tpfFlowMessage"></div>`;
      const stats=$('tpfAutoStats');(stats||view.firstElementChild)?.insertAdjacentElement('afterend',b);
      b.addEventListener('click',onBuilderClick);b.addEventListener('input',onBuilderInput);b.addEventListener('change',onBuilderInput);
      $('tpfFlowSave').onclick=saveFlow;$('tpfFlowNew').onclick=resetFlow;$('tpfFlowTrigger').onchange=()=>{flow.trigger_type=$('tpfFlowTrigger').value;flow.trigger_config={};renderTriggerConfig();};
    }
    const n=$('tpfAutoNew');if(n){n.onclick=()=>{resetFlow();$('tpfFlowBuilder')?.scrollIntoView({behavior:'smooth',block:'start'});};}
    ensureLifecycleOptions();renderAll();
  }

  function ensureLifecycleOptions(){
    if($('tpfLifecycleOptions'))return;
    const box=document.createElement('div');box.id='tpfLifecycleOptions';box.style.cssText='padding:14px 17px;border-bottom:1px solid #edf1f5;background:#f8faff';
    box.innerHTML='<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-lifecycle-draft="offer">Preparar oferta y seguimiento</button><button type="button" data-lifecycle-draft="after_sale">Preparar después de tramitar</button></div><label style="display:block;margin-top:12px">Protecciones de este flujo<select id="tpfLifecycleMode"><option value="">Mantener funcionamiento actual</option><option value="offer">Oferta y seguimiento</option><option value="after_sale">Después de tramitar</option></select></label><div id="tpfLifecycleConfig" style="margin-top:12px"></div>';
    $('tpfFlowBuilder').querySelector('.tpfFlowMeta').insertAdjacentElement('afterend',box);
  }

  function lifecycleDraft(mode){
    const action=(type,config={})=>({id:uid(),kind:'action',action_type:type,config});
    const wait=days=>({id:uid(),kind:'wait',value:days,unit:'days'});
    const after=mode==='after_sale';
    flow={id:null,name:after?'Después de tramitar':'Oferta y seguimiento',enabled:false,trigger_type:after?'opportunity_stage':'label_assigned',trigger_config:{},
      lifecycle:{version:1,mode,stop_stage_ids:[]},selected:null,
      steps:after?[action('record_sale_month'),wait(2),action('send_template'),wait(5),action('send_template')]:[action('create_opportunity',{title:'Oferta · {nombre}',client_name:'{nombre}',phone:'{telefono}',status:'open'}),action('send_template'),action('record_offer_month'),wait(2),action('send_template'),wait(3),action('send_template')]};
    renderAll();$('tpfFlowMessage').className='tpfFlowMessage';$('tpfFlowMessage').textContent='Borrador pausado. Elige las columnas, la etiqueta y las plantillas. Puedes cambiar los días; las esperas se suman.';
  }

  function renderLifecycle(){
    const box=$('tpfLifecycleConfig');if(!box)return;
    const p=flow.lifecycle||{},offer=p.mode==='offer',after=p.mode==='after_sale';
    $('tpfLifecycleMode').value=p.mode||'';
    if(!offer&&!after){box.innerHTML='<span class="small">Opcional: prepara uno de estos flujos como borrador nuevo. Tus automatizaciones actuales se conservan.</span>';return;}
    box.innerHTML=`<strong>${after?'Después de tramitar':'Oferta y seguimiento'}</strong><p class="small">${after?'El día 0 es la entrada en la columna elegida arriba. No depende de la etiqueta de seguimiento de oferta. Al salir de esa columna se cancelan los pasos pendientes.':'La etiqueta elegida arriba inicia esta campaña una vez por cliente. Quitarla detiene el seguimiento; volver a ponerla no lo reinicia. Cualquier respuesta del cliente detiene este seguimiento.'}</p>${offer?`<div class="tpfStepConfig"><label>Pendiente de tramitar<select data-lifecycle-stage="0">${stageOptions(p.stop_stage_ids?.[0]||'')}</select></label><label>Tramitado<select data-lifecycle-stage="1">${stageOptions(p.stop_stage_ids?.[1]||'')}</select></label></div>`:''}<p class="small">Una petición explícita de baja bloquea los mensajes comerciales de estos flujos. Las plantillas y las esperas se eligen en los pasos. «Cancelar ejecución» sigue disponible en el historial.</p>`;
  }

  function renderTriggerConfig(){
    const box=$('tpfFlowTriggerConfig');if(!box)return;
    const t=flow.trigger_type,c=flow.trigger_config||{};
    let h='';
    if(t==='message_contains')h=`<label>Palabra o frase<input data-trigger-key="keyword" value="${esc(c.keyword||'')}" placeholder="Escribe la palabra o frase"></label>`;
    if(t==='opportunity_stage')h=`<label>Columna<select data-trigger-key="stage_id"><option value="">Elige columna…</option>${opts.stages.map(x=>`<option value="${x.id}" ${String(c.stage_id||'')===String(x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`;
    if(t==='label_assigned')h=`<label>Etiqueta<select data-trigger-key="label_id"><option value="">Elige etiqueta…</option>${opts.labels.map(x=>`<option value="${x.id}" ${String(c.label_id||'')===String(x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`;
    if(t==='unanswered')h=`<div class="tpfStepConfig"><label>Tiempo<input type="number" min="1" data-trigger-key="wait_value" value="${esc(c.wait_value||'')}"></label><label>Unidad<select data-trigger-key="wait_unit">${unitOptions(c.wait_unit||'')}</select></label></div>`;
    if(t==='message_received')h='<div class="small">Se inicia con cada mensaje nuevo recibido.</div>';
    box.innerHTML=h;
  }

  function stepTitle(s){if(s.kind==='action')return actionLabel(s.action_type);if(s.kind==='wait')return `${s.value||'—'} ${dictUnit(s.unit)}`;if(s.kind==='condition')return s.condition_type==='no_response'?'Continuar solo si no ha respondido':'Elige una condición';if(s.kind==='repeat')return `Cada ${s.every_value||'—'} ${dictUnit(s.every_unit)} · ${s.times||'—'} veces`;return s.kind}
  function dictUnit(u){return ({minutes:'minutos',hours:'horas',days:'días',weeks:'semanas'})[u]||'unidad'}
  function renderSteps(){
    const box=$('tpfFlowSteps');if(!box)return;
    if(!flow.steps.length){box.innerHTML='<div class="tpfFlowEmpty">Todavía no hay pasos. Añade la primera acción, espera, condición o repetición.</div>';renderEditor(null);return;}
    if(!flow.selected||!flow.steps.some(x=>x.id===flow.selected))flow.selected=flow.steps[0].id;
    box.innerHTML=flow.steps.map((s,i)=>`<div class="tpfFlowStep ${s.id===flow.selected?'active':''}" data-step-id="${s.id}"><div class="tpfFlowStepTop"><span class="tpfStepNum">${i+1}</span><span class="tpfStepKind tpfKind${s.kind[0].toUpperCase()+s.kind.slice(1)}">${s.kind==='action'?'HACER':s.kind==='wait'?'ESPERAR':s.kind==='repeat'?'REPETIR':'SI'}</span><span class="tpfFlowStepTitle">${esc(stepTitle(s))}</span><button type="button" data-move="up">↑</button><button type="button" data-move="down">↓</button><button type="button" data-delete="1">×</button></div></div>`).join('');
    renderEditor(flow.steps.find(x=>x.id===flow.selected));
  }

  function renderEditor(s){
    const e=$('tpfStepEditor');if(!e)return;
    if(!s){e.innerHTML='<h4>Configura tu flujo</h4><div class="hint">Selecciona o añade un paso. Ninguna acción viene impuesta: tú eliges qué ocurre y cuándo.</div>';return;}
    if(s.kind==='wait')return renderWait(e,s);
    if(s.kind==='repeat')return renderRepeat(e,s);
    if(s.kind==='condition')return renderCondition(e,s);
    renderAction(e,s);
  }

  function renderWait(e,s){e.innerHTML=`<h4>ESPERAR</h4><div class="hint">Elige exactamente cuánto tiempo debe pasar antes del siguiente paso.</div><div class="tpfStepConfig"><label>Tiempo<input data-key="value" type="number" min="0" value="${esc(s.value??'')}"></label><label>Unidad<select data-key="unit">${unitOptions(s.unit||'')}</select></label></div>`}
  function renderRepeat(e,s){e.innerHTML=`<h4>REPETIR</h4><div class="hint">Repite la acción inmediatamente anterior con el intervalo y límite que tú decidas.</div><div class="tpfStepConfig"><label>Cada<input data-key="every_value" type="number" min="1" value="${esc(s.every_value??'')}"></label><label>Unidad<select data-key="every_unit">${unitOptions(s.every_unit||'')}</select></label><label>Máximo de repeticiones<input data-key="times" type="number" min="1" max="100" value="${esc(s.times??'')}"></label><div class="full tpfCheckRow"><label><input data-key="stop_if_response" type="checkbox" ${s.stop_if_response?'checked':''}> Detener las repeticiones si el cliente responde</label></div></div>`}
  function renderCondition(e,s){e.innerHTML=`<h4>CONDICIÓN</h4><div class="hint">Los pasos siguientes solo continuarán si se cumple esta condición.</div><div class="tpfStepConfig"><label class="full">Condición<select data-key="condition_type"><option value="">Elige condición…</option><option value="no_response" ${s.condition_type==='no_response'?'selected':''}>El cliente no ha respondido desde que empezó el flujo</option></select></label></div>`}

  function commonVars(){return '<div class="tpfVarHelp">Puedes usar variables en los textos: <b>{nombre}</b>, <b>{dni}</b>, <b>{telefono}</b>, <b>{mensaje}</b>. Si un campo queda vacío, no se fuerza ningún valor.</div>'}
  function stageOptions(v=''){return '<option value="">Elige columna…</option>'+opts.stages.map(x=>`<option value="${x.id}" ${String(v)===String(x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}
  function labelOptions(v=''){return '<option value="">Elige etiqueta…</option>'+opts.labels.map(x=>`<option value="${x.id}" ${String(v)===String(x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}
  function templateOptions(v=''){return '<option value="">Elige plantilla…</option>'+opts.templates.map(x=>`<option value="${x.id}" ${String(v)===String(x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}
  function userOptions(v=''){return '<option value="self">Usuario de la automatización</option>'+opts.users.map(x=>`<option value="${esc(x.user_id)}" ${String(v)===String(x.user_id)?'selected':''}>${esc(x.display_name||x.email)}</option>`).join('')}
  function actionSelect(s){return `<label class="full">Acción<select data-key="action_type"><option value="">Elige una acción…</option><option value="create_opportunity" ${s.action_type==='create_opportunity'?'selected':''}>Crear oportunidad</option><option value="create_task" ${s.action_type==='create_task'?'selected':''}>Crear tarea</option><option value="send_whatsapp_now" ${s.action_type==='send_whatsapp_now'?'selected':''}>Enviar WhatsApp ahora</option><option value="send_template" ${s.action_type==='send_template'?'selected':''}>Enviar plantilla WhatsApp</option><option value="assign_label" ${s.action_type==='assign_label'?'selected':''}>Asignar etiqueta</option><option value="move_opportunity" ${s.action_type==='move_opportunity'?'selected':''}>Mover oportunidad de columna</option></select></label>`}

  function renderAction(e,s){
    const c=s.config||(s.config={});let h=`<h4>HACER</h4><div class="hint">Elige la acción. Después aparecen todos sus campos configurables.</div><div class="tpfStepConfig">${actionSelect(s)}`;
    if(s.action_type==='create_opportunity'){
      h+=`${commonVars()}<label>Título<input data-cfg="title" value="${esc(c.title||'')}"></label><label>Cliente<input data-cfg="client_name" value="${esc(c.client_name||'')}"></label><label>Teléfono<input data-cfg="phone" value="${esc(c.phone||'')}"></label><label>Importe<input data-cfg="amount" value="${esc(c.amount||'')}" placeholder="Ej.: 120 o {importe}"></label><label>Columna / estado<select data-cfg="stage_id">${stageOptions(c.stage_id||'')}</select></label><label>Estado comercial<select data-cfg="status"><option value="">No establecer</option><option value="open" ${c.status==='open'?'selected':''}>Abierta</option><option value="won" ${c.status==='won'?'selected':''}>Ganada</option><option value="lost" ${c.status==='lost'?'selected':''}>Perdida</option></select></label><label>Fecha prevista · dentro de<input data-cfg="expected_value" type="number" min="0" value="${esc(c.expected_value??'')}"></label><label>Unidad de fecha<select data-cfg="expected_unit">${unitOptions(c.expected_unit||'')}</select></label><label>Responsable<select data-cfg="owner_user_id">${userOptions(c.owner_user_id||'self')}</select></label><label>Posición<input data-cfg="position" type="number" min="0" value="${esc(c.position??'')}"></label><label class="full">Notas<textarea data-cfg="notes" rows="3">${esc(c.notes||'')}</textarea></label>`;
      if(opts.salesFields.length){h+='<div class="tpfFieldGroup"><h5>Campos personalizados de ventas</h5><div class="tpfStepConfig">'+opts.salesFields.map(f=>`<label>${esc(f.label)}${f.required?' *':''}<input data-custom="${f.id}" value="${esc((c.custom_values||{})[f.id]??'')}"></label>`).join('')+'</div></div>';}
    }else if(s.action_type==='create_task'){
      h+=`${commonVars()}<label>Título<input data-cfg="title" value="${esc(c.title||'')}"></label><label>Estado<select data-cfg="status"><option value="">Elige estado…</option><option value="pending" ${c.status==='pending'?'selected':''}>Pendiente</option><option value="done" ${c.status==='done'?'selected':''}>Completada</option><option value="cancelled" ${c.status==='cancelled'?'selected':''}>Cancelada</option></select></label><label class="full">Descripción<textarea data-cfg="description" rows="3">${esc(c.description||'')}</textarea></label><label>Cliente / contacto<input data-cfg="customer_name" value="${esc(c.customer_name||'')}"></label><label>Teléfono<input data-cfg="customer_phone" value="${esc(c.customer_phone||'')}"></label><label>Crear para dentro de<input data-cfg="start_value" type="number" min="0" value="${esc(c.start_value??'')}"></label><label>Unidad<select data-cfg="start_unit">${unitOptions(c.start_unit||'')}</select></label><label>Hora opcional<input data-cfg="start_time" type="time" value="${esc(c.start_time||'')}"></label><label>Responsable<select data-cfg="assigned_to">${userOptions(c.assigned_to||'self')}</select></label><label>Recordar antes<input data-cfg="reminder_value" type="number" min="0" value="${esc(c.reminder_value??'')}"></label><label>Unidad recordatorio<select data-cfg="reminder_unit">${unitOptions(c.reminder_unit||'')}</select></label><div class="full tpfCheckRow"><label><input type="checkbox" data-cfg-bool="notify_in_app" ${c.notify_in_app!==false?'checked':''}> Aviso en CRM</label><label><input type="checkbox" data-cfg-bool="notify_email" ${c.notify_email?'checked':''}> Email</label><label><input type="checkbox" data-cfg-bool="sync_google_calendar" ${c.sync_google_calendar?'checked':''}> Google Calendar</label><label><input type="checkbox" data-cfg-bool="whatsapp_enabled" ${c.whatsapp_enabled?'checked':''}> WhatsApp asociado a la tarea</label></div><label class="full">Mensaje WhatsApp de la tarea<textarea data-cfg="whatsapp_message" rows="3">${esc(c.whatsapp_message||'')}</textarea></label>`;
    }else if(s.action_type==='send_whatsapp_now'){
      h+=`${commonVars()}<div class="full" style="padding:8px 9px;background:#ecfdf3;border-radius:8px;color:#23733c;font-size:10px;font-weight:700">Se envía en cuanto el flujo llega a este paso.</div><label class="full">Mensaje<textarea data-cfg="text" rows="5" placeholder="Escribe el mensaje…">${esc(c.text||'')}</textarea></label>`;
    }else if(s.action_type==='send_template'){
      h+=`${commonVars()}<label class="full">Plantilla<select data-cfg="template_id">${templateOptions(c.template_id||'')}</select></label>`;
    }else if(s.action_type==='assign_label'){
      h+=`<label class="full">Etiqueta<select data-cfg="label_id">${labelOptions(c.label_id||'')}</select></label>`;
    }else if(s.action_type==='move_opportunity'){
      h+=`<label class="full">Mover a columna<select data-cfg="stage_id">${stageOptions(c.stage_id||'')}</select></label>`;
    }
    if(s.action_type==='record_offer_month')h+='<p class="full">Añade OFERTA con el mes y año del envío confirmado. Debe ir justo después de enviar la oferta, con una oportunidad vinculada.</p>';
    if(s.action_type==='record_sale_month')h+='<p class="full">Añade VENTAS con el mes y año de entrada en Tramitado. Retira la etiqueta de esa oferta si ninguna otra oportunidad abierta la necesita.</p>';
    h+='</div>';e.innerHTML=h;
    if(flow.lifecycle){const select=e.querySelector('[data-key="action_type"]');if(select){for(const type of ['record_offer_month','record_sale_month']){const option=document.createElement('option');option.value=type;option.textContent=actionLabel(type);select.appendChild(option);}select.value=s.action_type||'';}}
  }

  function onBuilderClick(ev){
    const preset=ev.target.closest('[data-lifecycle-draft]');if(preset){if((flow.id||flow.steps.length)&&!window.confirm('Preparar un borrador nuevo descartará los cambios sin guardar del editor. ¿Continuar?'))return;lifecycleDraft(preset.dataset.lifecycleDraft);return;}
    const add=ev.target.closest('[data-add]');if(add){const kind=add.dataset.add;const s={id:uid(),kind};if(kind==='action'){s.action_type='';s.config={}}if(kind==='wait'){s.value='';s.unit=''}if(kind==='condition'){s.condition_type=''}if(kind==='repeat'){s.every_value='';s.every_unit='';s.times='';s.stop_if_response=false}flow.steps.push(s);flow.selected=s.id;renderSteps();return;}
    const row=ev.target.closest('[data-step-id]');if(!row)return;const id=row.dataset.stepId,i=flow.steps.findIndex(x=>x.id===id);if(i<0)return;
    if(ev.target.closest('[data-delete]')){flow.steps.splice(i,1);flow.selected=flow.steps[Math.max(0,i-1)]?.id||null;renderSteps();return;}
    const m=ev.target.closest('[data-move]');if(m){const j=m.dataset.move==='up'?i-1:i+1;if(j>=0&&j<flow.steps.length){[flow.steps[i],flow.steps[j]]=[flow.steps[j],flow.steps[i]];renderSteps();}return;}
    flow.selected=id;renderSteps();
  }

  function onBuilderInput(ev){
    const t=ev.target;
    if(t.id==='tpfLifecycleMode'){
      flow.lifecycle=t.value?{version:1,mode:t.value,stop_stage_ids:[]}:null;if(flow.extra)delete flow.extra.lifecycle;
      flow.enabled=false;renderAll();$('tpfFlowMessage').textContent='Se conservan tus pasos. Revisa el registro mensual y las columnas antes de activar. El borrador queda pausado.';return;
    }
    if(t.dataset.lifecycleStage!==undefined&&flow.lifecycle){flow.lifecycle.stop_stage_ids=flow.lifecycle.stop_stage_ids||[];flow.lifecycle.stop_stage_ids[Number(t.dataset.lifecycleStage)]=t.value;return;}
    if(t.id==='tpfFlowName'){flow.name=t.value;return}if(t.id==='tpfFlowEnabled'){flow.enabled=t.value==='1';return}
    if(t.dataset.triggerKey){flow.trigger_config[t.dataset.triggerKey]=t.value;return}
    const s=flow.steps.find(x=>x.id===flow.selected);if(!s)return;
    if(t.dataset.key){let v=t.type==='checkbox'?t.checked:t.value;if(['value','every_value','times'].includes(t.dataset.key)&&v!=='')v=Number(v);s[t.dataset.key]=v;if(t.dataset.key==='action_type'){s.config={};}renderSteps();return;}
    if(t.dataset.cfg){s.config=s.config||{};s.config[t.dataset.cfg]=t.value;return}
    if(t.dataset.cfgBool){s.config=s.config||{};s.config[t.dataset.cfgBool]=t.checked;return}
    if(t.dataset.custom){s.config=s.config||{};s.config.custom_values=s.config.custom_values||{};s.config.custom_values[t.dataset.custom]=t.value;return}
  }

  function validate(){
    if(!String(flow.name||'').trim())return 'Pon un nombre a la automatización.';
    if(flow.lifecycle&&!flow.enabled)return ''; // Incomplete drafts are safe while paused; server validates activation too.
    if(flow.lifecycle?.mode==='offer'){
      if(flow.trigger_type!=='label_assigned')return 'El seguimiento de oferta necesita la etiqueta de inicio.';
      const ids=flow.lifecycle.stop_stage_ids||[];if(ids.length!==2||!ids[0]||!ids[1]||ids[0]===ids[1])return 'Elige dos columnas diferentes: Pendiente de tramitar y Tramitado.';
    }
    if(flow.lifecycle?.mode==='after_sale'&&flow.trigger_type!=='opportunity_stage')return 'Elige la columna Tramitado como inicio.';
    if(!flow.trigger_type)return 'Elige qué inicia la automatización.';
    if(flow.trigger_type==='message_contains'&&!String(flow.trigger_config.keyword||'').trim())return 'Escribe la palabra o frase del disparador.';
    if(flow.trigger_type==='opportunity_stage'&&!flow.trigger_config.stage_id)return 'Elige la columna que inicia la automatización.';
    if(flow.trigger_type==='label_assigned'&&!flow.trigger_config.label_id)return 'Elige la etiqueta que inicia la automatización.';
    if(flow.trigger_type==='unanswered'&&(!Number(flow.trigger_config.wait_value)||!flow.trigger_config.wait_unit))return 'Configura el tiempo sin respuesta.';
    if(!flow.steps.length)return 'Añade al menos un paso.';
    let prevAction=false;
    for(let i=0;i<flow.steps.length;i++){
      const s=flow.steps[i],n=i+1;
      if(s.kind==='action'){if(!s.action_type)return `Elige la acción del paso ${n}.`;prevAction=true;if(s.action_type==='send_whatsapp_now'&&!String(s.config?.text||'').trim())return `Escribe el mensaje WhatsApp del paso ${n}.`;if(s.action_type==='send_template'&&!s.config?.template_id)return `Elige la plantilla del paso ${n}.`;if(s.action_type==='assign_label'&&!s.config?.label_id)return `Elige la etiqueta del paso ${n}.`;}
      if(s.kind==='wait'&&((s.value===''||Number(s.value)<0)||!s.unit))return `Configura tiempo y unidad en la espera del paso ${n}.`;
      if(s.kind==='condition'&&!s.condition_type)return `Elige la condición del paso ${n}.`;
      if(s.kind==='repeat'){if(!prevAction)return `La repetición del paso ${n} necesita una acción anterior.`;if(!Number(s.every_value)||!s.every_unit||!Number(s.times))return `Configura intervalo y repeticiones en el paso ${n}.`;}
    }
    return '';
  }

  function normalizeTrigger(){
    const c={...flow.trigger_config};
    if(flow.trigger_type==='unanswered'){
      const mult={minutes:1,hours:60,days:1440,weeks:10080}[c.wait_unit]||1;c.minutes=Math.max(1,Math.round(Number(c.wait_value||0)*mult));delete c.wait_value;delete c.wait_unit;
    }
    return c;
  }

  async function saveFlow(){
    const msg=$('tpfFlowMessage'),err=validate();if(err){msg.className='tpfFlowMessage err';msg.textContent=err;return;}
    const btn=$('tpfFlowSave');btn.disabled=true;msg.className='tpfFlowMessage';msg.textContent='Guardando…';
    try{
      const payload={...(flow.extra||{}),version:1,steps:flow.steps.map(({id,...x})=>x),...(flow.lifecycle?{lifecycle:flow.lifecycle}:{})};
      const {data,error}=await sb.rpc('crm_upsert_automation',{p_id:flow.id||null,p_name:String(flow.name).trim(),p_enabled:!!flow.enabled,p_trigger_type:flow.trigger_type,p_trigger_config:normalizeTrigger(),p_action_type:'flow_v1',p_action_config:payload});
      if(error)throw error;flow.id=data||flow.id;msg.className='tpfFlowMessage ok';msg.textContent=flow.enabled?'Automatización guardada. El flujo se ejecutará en servidor aunque cierres el CRM.':'Borrador guardado y pausado. No se enviará ningún mensaje.';try{await window.loadAutomations?.()}catch(_){}decorateRules();
    }catch(e){msg.className='tpfFlowMessage err';msg.textContent=e?.message||'No se pudo guardar.'}finally{btn.disabled=false}
  }

  function resetFlow(){flow={id:null,name:'',enabled:true,trigger_type:'',trigger_config:{},steps:[],selected:null};renderAll();$('tpfFlowName')?.focus()}
  async function editFlow(id){
    let r=getRule(id);if(!r){try{await window.loadAutomations?.();r=getRule(id)}catch(_){}}
    if(!r||r.action_type!=='flow_v1')return false;
    flow={id:r.id,name:r.name||'',enabled:!!r.enabled,trigger_type:r.trigger_type||'',trigger_config:{...(r.trigger_config||{})},steps:(r.action_config?.steps||[]).map(x=>({id:uid(),...JSON.parse(JSON.stringify(x))})),selected:null};
    flow.extra={...(r.action_config||{})};flow.lifecycle=r.action_config?.lifecycle?JSON.parse(JSON.stringify(r.action_config.lifecycle)):null;
    if(flow.trigger_type==='unanswered'&&flow.trigger_config.minutes&&!flow.trigger_config.wait_value){const m=Number(flow.trigger_config.minutes);if(m%10080===0){flow.trigger_config.wait_value=m/10080;flow.trigger_config.wait_unit='weeks'}else if(m%1440===0){flow.trigger_config.wait_value=m/1440;flow.trigger_config.wait_unit='days'}else if(m%60===0){flow.trigger_config.wait_value=m/60;flow.trigger_config.wait_unit='hours'}else{flow.trigger_config.wait_value=m;flow.trigger_config.wait_unit='minutes'}}
    renderAll();$('tpfFlowBuilder')?.scrollIntoView({behavior:'smooth',block:'start'});return true;
  }

  function renderAll(){if(!$('tpfFlowBuilder'))return;$('tpfFlowName').value=flow.name||'';$('tpfFlowEnabled').value=flow.enabled?'1':'0';$('tpfFlowTrigger').value=flow.trigger_type||'';renderTriggerConfig();renderLifecycle();renderSteps();}
  function decorateRules(){
    const rules=Array.isArray(window.crmAutomations)?window.crmAutomations:[];
    document.querySelectorAll('#auto2List .auto2Rule').forEach(el=>{
      const edit=el.querySelector('button[onclick*="auto2Edit"]');if(!edit)return;const m=(edit.getAttribute('onclick')||'').match(/auto2Edit\('([^']+)'\)/);if(!m)return;const r=rules.find(x=>String(x.id)===m[1]);if(r?.action_type==='flow_v1'){const txt=el.querySelector('.auto2RuleText'),next=`${triggerLabel(r.trigger_type)} → Flujo avanzado · ${(r.action_config?.steps||[]).length} pasos`;if(txt&&txt.textContent!==next)txt.textContent=next;if(el.dataset.tpfFlowRule!=='1')el.dataset.tpfFlowRule='1';}
    });
  }

  function installCapture(){
    document.addEventListener('click',async ev=>{const b=ev.target.closest('button[onclick*="auto2Edit"]');if(!b)return;const m=(b.getAttribute('onclick')||'').match(/auto2Edit\('([^']+)'\)/);if(!m)return;const r=getRule(m[1]);if(r?.action_type!=='flow_v1')return;ev.preventDefault();ev.stopImmediatePropagation();await editFlow(m[1]);},true);
    observer=new MutationObserver(()=>decorateRules());const list=$('auto2List');if(list)observer.observe(list,{childList:true,subtree:true});
  }

  async function init(){const v=$('view-automations');if(!v)return;await loadOptions();ensureBuilder();installCapture();decorateRules();}
  document.addEventListener('click',e=>{if(e.target?.closest?.('.nav[data-view="automations"]'))setTimeout(()=>{loadOptions().then(()=>{ensureBuilder();decorateRules();renderAll();});},140);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,350));else setTimeout(init,350);
  window.TPFAutomationFlow={newFlow:resetFlow,editFlow};
})();
