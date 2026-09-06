(function(){
  'use strict';
  if(window.__tpfAutomationFlowInitialized)return;
  window.__tpfAutomationFlowInitialized=true;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const units=[['minutes','minutos'],['hours','horas'],['days','días'],['weeks','semanas']];
  let flow={id:null,name:'',enabled:true,trigger_type:'',trigger_config:{},steps:[]};
  let opts={stages:[],pipelines:[],labels:[],templates:[],salesFields:[],users:[]};
  let observer=null;
  let simpleView=true;

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
      <div class="tpfFlowMeta"><label>Nombre de la automatización<input id="tpfFlowName" placeholder="Ej.: Renovación → seguimiento"></label><label>Cuándo empieza<select id="tpfFlowTrigger"><option value="">Elige qué la inicia…</option><option value="message_received">Llega un WhatsApp</option><option value="message_contains">WhatsApp contiene palabra o frase</option><option value="opportunity_stage">Oportunidad entra en una columna</option><option value="label_assigned">Se asigna una etiqueta</option><option value="unanswered">Cliente sin respuesta</option></select></label><label>Estado<select id="tpfFlowEnabled"><option value="1">Activa</option><option value="0">Pausada</option></select></label><div id="tpfFlowTriggerConfig" class="full"></div></div>
      <div class="tpfFlowBody"><div><div class="tpfFlowTimeline"><div class="tpfFlowTimelineTitle">PASOS DEL FLUJO</div><div id="tpfFlowSteps"></div><div class="tpfFlowAdd"><button type="button" data-add="action">+ Acción</button><button type="button" data-add="wait">+ Espera</button><button type="button" data-add="condition">+ Condición</button><button type="button" data-add="repeat">+ Repetición</button></div></div></div><div id="tpfStepEditor" class="tpfStepEditor"></div></div><div id="tpfFlowMessage" class="tpfFlowMessage"></div>`;
      const stats=$('tpfAutoStats');(stats||view.firstElementChild)?.insertAdjacentElement('afterend',b);
      b.addEventListener('click',onBuilderClick);b.addEventListener('input',onBuilderInput);b.addEventListener('change',onBuilderInput);
      $('tpfFlowSave').onclick=saveFlow;$('tpfFlowNew').onclick=resetFlow;$('tpfFlowTrigger').onchange=()=>{flow.trigger_type=$('tpfFlowTrigger').value;flow.trigger_config={};renderTriggerConfig();};
    }
    const n=$('tpfAutoNew');if(n){n.onclick=()=>{resetFlow();$('tpfFlowBuilder')?.scrollIntoView({behavior:'smooth',block:'start'});};}
    ensureSimpleView();ensureLifecycleOptions();renderAll();
  }

  function ensureSimpleView(){
    const b=$('tpfFlowBuilder');if(!b)return;
    if(!$('tpfSimpleTabs')){
      const bar=document.createElement('div');bar.id='tpfSimpleTabs';bar.innerHTML='<div role="group" aria-label="Presentación de la automatización"><button type="button" data-presentation="simple">Configuración sencilla</button><button type="button" data-presentation="advanced">Vista avanzada</button></div><button type="button" id="tpfShowFlowReview" aria-expanded="false">Ver resumen completo</button>';
      b.querySelector('.tpfFlowMeta').insertAdjacentElement('beforebegin',bar);
      const review=document.createElement('div');review.id='tpfSimpleReview';review.hidden=true;bar.insertAdjacentElement('afterend',review);
      const style=document.createElement('style');style.id='tpfSimpleFlowStyles';style.textContent=`
        #tpfSimpleTabs{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;background:#fff;padding:14px 20px;border:1px solid #e0e7f0;border-bottom:0}
        #tpfSimpleTabs>div{display:flex;gap:8px;flex-wrap:wrap}#tpfSimpleTabs button{min-height:40px;padding:9px 14px;border-radius:9px;border:1px solid #d8e0ed;background:#fff;color:#42526b;font-size:13px}
        #tpfSimpleTabs button[aria-pressed="true"]{color:#135bc4;background:#edf4ff;border-color:#94baff;font-weight:700}
        #tpfSimpleReview{padding:20px;background:#fff;border:1px solid #d8e3f3;color:#26354a}#tpfSimpleReview[hidden]{display:none!important}#tpfSimpleReview h3{margin:0 0 12px}#tpfSimpleReview ol{padding-left:22px;margin:12px 0}#tpfSimpleReview li{padding:7px 0;line-height:1.5;font-size:14px}
        #tpfFlowBuilder.tpfSimple>.tpfBuilderStepper{display:none!important}
        #tpfFlowBuilder.tpfSimple>.tpfFlowMeta{border-radius:0!important}
        #tpfFlowBuilder.tpfSimple .tpfFlowMeta label,#tpfFlowBuilder.tpfSimple .tpfStepConfig label{font-size:13px!important;line-height:1.5}
        #tpfFlowBuilder.tpfSimple .tpfFlowMeta input,#tpfFlowBuilder.tpfSimple .tpfFlowMeta select,#tpfFlowBuilder.tpfSimple .tpfStepConfig input,#tpfFlowBuilder.tpfSimple .tpfStepConfig select,#tpfFlowBuilder.tpfSimple .tpfStepConfig textarea{font-size:14px!important;max-width:100%;box-sizing:border-box}
        #tpfFlowBuilder.tpfSimple.tpfBuilderPro>.tpfFlowBody,#tpfFlowBuilder.tpfSimple>.tpfFlowBody{grid-template-columns:minmax(300px,.95fr) minmax(0,1.3fr)!important;padding:20px!important;gap:20px!important;background:#f5f7fb!important}
        #tpfFlowBuilder.tpfSimple .tpfFlowTimeline{min-height:0!important;padding:16px!important}#tpfFlowBuilder.tpfSimple .tpfFlowTimelineTitle{font-size:15px!important}
        #tpfFlowBuilder.tpfSimple .tpfFlowTimelineTitle:after{display:none!important}
        #tpfFlowBuilder.tpfSimple .tpfFlowStep{padding:14px!important;cursor:pointer}#tpfFlowBuilder.tpfSimple .tpfFlowStep.active{border-left:4px solid #2468db!important}
        #tpfFlowBuilder.tpfSimple .tpfFlowStepTitle{font-size:14px!important;line-height:1.4}#tpfFlowBuilder.tpfSimple .tpfStepKind{display:none!important}
        #tpfFlowBuilder.tpfSimple .tpfFlowStep button{width:30px;height:30px;flex-shrink:0}#tpfFlowBuilder.tpfSimple .tpfStepNum{flex-shrink:0;background:#efe7ff!important;color:#7149b4!important}
        .tpfStepSummary{font-size:12px;line-height:1.6;color:#667085;margin:8px 0 0 33px;overflow-wrap:anywhere}.tpfStepSummary:empty{display:none}
        #tpfFlowBuilder:not(.tpfSimple) .tpfStepSummary{display:none}
        #tpfFlowBuilder.tpfSimple .tpfFlowAdd button{font-size:12px!important;min-height:42px!important}
        #tpfFlowBuilder.tpfSimple .tpfStepEditor{min-height:0!important;align-self:start;padding:20px!important}#tpfFlowBuilder.tpfSimple .tpfStepEditor:before{content:'EDITAR EL PASO SELECCIONADO';font-size:12px!important}
        #tpfFlowBuilder.tpfSimple .tpfStepEditor h4{font-size:19px!important}#tpfFlowBuilder.tpfSimple .tpfStepEditor .hint,#tpfFlowBuilder.tpfSimple .small,#tpfFlowBuilder.tpfSimple .tpfVarHelp,#tpfFlowBuilder.tpfSimple .tpfDynamicHint{font-size:12px!important;line-height:1.6!important}
        #tpfFlowBuilder.tpfSimple #tpfLifecycleOptions{border:1px solid #e0e7f0;border-top:0}#tpfFlowBuilder.tpfSimple #tpfLifecycleOptions button{font-size:13px;min-height:40px}
        #tpfFlowBuilder.tpfSimple #tpfLifecycleMode{margin-left:10px;max-width:100%;font-size:14px;padding:8px}
        #tpfFlowBuilder.tpfSimple .tpfFlowMessage{font-size:13px!important}
        @media(max-width:900px){#tpfFlowBuilder.tpfSimple.tpfBuilderPro>.tpfFlowBody,#tpfFlowBuilder.tpfSimple>.tpfFlowBody{grid-template-columns:minmax(0,1fr)!important}#tpfFlowBuilder.tpfSimple.tpfBuilderPro>.tpfFlowMeta{grid-template-columns:minmax(0,1fr)!important}#tpfFlowBuilder.tpfSimple #tpfLifecycleMode{display:block;margin:8px 0 0;width:100%}}
      `;document.head.appendChild(style);
    }
    b.classList.toggle('tpfSimple',simpleView);
    b.querySelectorAll('[data-presentation]').forEach(x=>x.setAttribute('aria-pressed',String((x.dataset.presentation==='simple')===simpleView)));
    const title=b.querySelector('.tpfFlowTimelineTitle');if(title)title.textContent=simpleView?'Qué hará esta automatización':'PASOS DEL FLUJO';
    const labels={action:'Añadir acción',wait:'Añadir espera',condition:'Añadir condición',repeat:'Añadir repetición'};
    b.querySelectorAll('[data-add]').forEach(x=>{x.textContent='+ '+labels[x.dataset.add]});
    ensureCardsLayout();renderCards();
  }

  function ensureCardsLayout(){
    const b=$('tpfFlowBuilder');if(!$('tpfGuidedCards')){const cards=document.createElement('section');cards.id='tpfGuidedCards';b.querySelector('.tpfFlowBody').insertAdjacentElement('beforebegin',cards);}
    if($('tpfGuidedStyles'))return;
    const s=document.createElement('style');s.id='tpfGuidedStyles';s.textContent=`
      #tpfFlowBuilder.tpfSimple.tpfBuilderPro,#tpfFlowBuilder.tpfSimple{display:grid!important;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:16px;align-items:start}
      #tpfFlowBuilder.tpfSimple>.tpfFlowHead,#tpfFlowBuilder.tpfSimple>.tpfBuilderProTop,#tpfFlowBuilder.tpfSimple>#tpfSimpleTabs,#tpfFlowBuilder.tpfSimple>#tpfSimpleReview,#tpfFlowBuilder.tpfSimple>#tpfBuilderReview,#tpfFlowBuilder.tpfSimple>#tpfFlowMessage{grid-column:1/-1}
      #tpfFlowBuilder.tpfSimple>.tpfFlowMeta{grid-column:1;grid-row:3;display:grid!important;grid-template-columns:minmax(0,1fr) minmax(100px,.65fr)!important;gap:10px!important;padding:36px 16px 16px!important;border:1px solid #e0e7f0!important;border-radius:14px!important}
      #tpfFlowBuilder.tpfSimple>.tpfFlowMeta>label:first-of-type{grid-column:1/-1}
      #tpfFlowBuilder.tpfSimple>.tpfFlowMeta>.afClassify{display:none!important}
      #tpfFlowBuilder.tpfSimple>#tpfLifecycleOptions{grid-column:2;grid-row:3/5;border-radius:14px;border:1px solid #e0e7f0!important;background:#fff!important;padding:16px!important;min-width:0}
      #tpfFlowBuilder.tpfSimple>#tpfLifecycleOptions>div:first-child{flex-direction:column}
      #tpfFlowBuilder.tpfSimple>#tpfLifecycleOptions label{font-size:13px;line-height:1.5}
      #tpfFlowBuilder.tpfSimple #tpfLifecycleMode{display:block!important;margin:8px 0!important;width:100%;min-height:40px}
      #tpfFlowBuilder.tpfSimple #tpfLifecycleConfig .tpfStepConfig{grid-template-columns:minmax(0,1fr)!important}
      #tpfFlowBuilder.tpfSimple.tpfBuilderPro>.tpfFlowBody,#tpfFlowBuilder.tpfSimple>.tpfFlowBody{display:none!important}
      #tpfFlowBuilder:not(.tpfSimple)>#tpfGuidedCards{display:none!important}
      #tpfFlowBuilder.tpfSimple>#tpfGuidedCards{display:grid;grid-column:1;grid-row:4;gap:12px;min-width:0}
      #tpfGuidedCards>h3{margin:0;color:#1b2a41;font-size:17px}.tpfGuidedCard{background:#fff;border:1px solid #dee6f1;border-radius:14px;padding:16px;min-width:0}.tpfGuidedCardHead{display:flex;gap:8px;align-items:center;margin-bottom:12px}.tpfGuidedCardHead h4{margin:0;flex:1;font-size:15px}.tpfGuidedCardHead button{min-width:28px;min-height:30px;background:#f3f6fb;border:1px solid #dce4ef;color:#4b5d78;border-radius:6px}.tpfGuidedCard .tpfStepConfig{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px!important}
      .tpfGuidedCard details{grid-column:1/-1;border-top:1px solid #e6ebf3;padding-top:10px;margin-top:4px}.tpfGuidedCard summary{font-size:12px;color:#225db5;cursor:pointer}.tpfGuidedCard details>.tpfStepConfig{padding-top:12px}.tpfGuidedCard select,.tpfGuidedCard input,.tpfGuidedCard textarea{width:100%;box-sizing:border-box}.tpfGuidedCard .tpfCheckRow input{width:auto}.tpfGuidedCard .hint{display:none}.tpfGuidedCard p{margin:0;font-size:12px;line-height:1.6;color:#667085}.tpfGuidedCard .tpfCardSearch{margin:0 0 6px;min-height:36px}.tpfGuidedCard[data-kind="wait"]{background:#f6f2ff;border-color:#e4daf8}
      #tpfFlowBuilder.tpfSimple #tpfFlowTriggerConfig{padding:10px;background:#f8faff}#tpfFlowBuilder.tpfSimple #tpfFlowTriggerConfig .tpfSearchWrap{grid-template-columns:minmax(0,1fr) minmax(110px,.65fr)!important;padding:0;background:none;border:0}#tpfFlowBuilder.tpfSimple #tpfFlowTriggerConfig .tpfSearchWrap input{min-height:34px!important}
      #tpfFlowBuilder.tpfSimple>.tpfBuilderReview{display:none!important}
      @media(max-width:760px){#tpfFlowBuilder.tpfSimple.tpfBuilderPro,#tpfFlowBuilder.tpfSimple{grid-template-columns:minmax(0,1fr)!important}#tpfFlowBuilder.tpfSimple>.tpfFlowMeta,#tpfFlowBuilder.tpfSimple>#tpfLifecycleOptions,#tpfFlowBuilder.tpfSimple>#tpfGuidedCards{grid-column:1!important;grid-row:auto!important}#tpfFlowBuilder.tpfSimple>#tpfLifecycleOptions{order:5}#tpfFlowBuilder.tpfSimple>#tpfFlowMessage{order:6}}
    `;document.head.appendChild(s);
  }

  function renderCards(){
    const root=$('tpfGuidedCards');if(!root||!simpleView)return;
    const expanded=new Set([...root.querySelectorAll('details[open]')].map(x=>x.closest('[data-card-id]')?.dataset.cardId));
    root.innerHTML='<h3>Acciones y mensajes</h3>';
    const primary={create_opportunity:['title','amount','stage_id'],create_task:['title','start_value','start_unit','start_time'],send_template:['template_id'],send_whatsapp_now:['text'],assign_label:['label_id','label_name_template','label_category'],move_opportunity:['stage_id']};
    flow.steps.forEach((step,i)=>{
      const card=document.createElement('article');card.className='tpfGuidedCard';card.dataset.cardId=step.id;card.dataset.kind=step.kind;
      card.innerHTML=`<header class="tpfGuidedCardHead"><span class="tpfStepNum">${i+1}</span><h4>${esc(stepTitle(step))}</h4><button type="button" data-card-move="up" aria-label="Subir paso ${i+1}">↑</button><button type="button" data-card-move="down" aria-label="Bajar paso ${i+1}">↓</button><button type="button" data-card-delete="1" aria-label="Quitar paso ${i+1}">×</button></header>`;
      const body=document.createElement('div');
      if(step.kind==='wait')renderWait(body,step);else if(step.kind==='repeat')renderRepeat(body,step);else if(step.kind==='condition')renderCondition(body,step);else renderAction(body,step);
      body.querySelector('h4')?.remove();body.querySelector('.hint')?.remove();
      const grid=body.querySelector('.tpfStepConfig');
      if(grid&&step.kind==='action'){
        const more=document.createElement('details');more.open=expanded.has(step.id);more.innerHTML='<summary>Más opciones de este paso</summary><div class="tpfStepConfig"></div>';
        const moreGrid=more.querySelector('div');
        [...grid.children].forEach(el=>{const key=el.querySelector('[data-cfg]')?.dataset.cfg;const chooseAction=el.querySelector('[data-key="action_type"]');if((chooseAction&&step.action_type)||(key&&!primary[step.action_type]?.includes(key))||(!key&&!chooseAction&&el.tagName!=='P'))moreGrid.appendChild(el);});
        if(moreGrid.children.length)grid.appendChild(more);
      }
      body.querySelectorAll('select[data-cfg="template_id"],select[data-cfg="label_id"],select[data-cfg="stage_id"]').forEach(select=>{
        if(select.dataset.cfg==='label_id'){
          const option=document.createElement('option');option.value='__dynamic__';option.textContent='Etiqueta con mes y año';select.appendChild(option);select.value=step.config?.label_id||'';
          if(select.value==='__dynamic__'){
            const fields=document.createElement('div');fields.className='full';fields.innerHTML=`<label>Nombre de etiqueta<input data-cfg="label_name_template" value="${esc(step.config?.label_name_template||'')}" placeholder="VENTAS {MES} {AÑO}"></label><label>Categoría<input data-cfg="label_category" value="${esc(step.config?.label_category||'')}"></label>`;select.closest('label').insertAdjacentElement('afterend',fields);
          }
        }
        if(select.options.length>8){const search=document.createElement('input');search.className='tpfCardSearch';search.type='search';search.placeholder='Buscar…';search.setAttribute('aria-label','Buscar opciones de '+select.dataset.cfg);search.addEventListener('input',()=>{const q=search.value.toLocaleLowerCase();[...select.options].forEach(o=>{o.hidden=!!o.value&&o.value!==select.value&&!o.textContent.toLocaleLowerCase().includes(q);});});select.insertAdjacentElement('beforebegin',search);}
      });
      card.appendChild(body);root.appendChild(card);
    });
    const add=document.createElement('div');add.className='tpfFlowAdd';add.innerHTML='<button type="button" data-add="action">+ Añadir acción</button><button type="button" data-add="wait">+ Añadir espera</button><button type="button" data-add="condition">+ Añadir condición</button><button type="button" data-add="repeat">+ Añadir repetición</button>';root.appendChild(add);
    if(!flow.steps.length){const p=document.createElement('p');p.className='small';p.textContent='Añade lo que quieres que haga la automatización. Cada paso se configura aquí mismo.';root.insertBefore(p,add);}
  }

  function optionName(list,id,fallback){return list.find(x=>String(x.id)===String(id))?.name||fallback;}
  function stepSummary(s){
    const c=s.config||{};
    if(s.kind==='wait')return `Esperar otros ${s.value??'…'} ${dictUnit(s.unit)} antes de continuar.`;
    if(s.kind==='repeat')return `Repetir la acción anterior cada ${s.every_value||'…'} ${dictUnit(s.every_unit)}, hasta ${s.times||'…'} veces.${s.stop_if_response?' Se detiene si el cliente responde.':''}`;
    if(s.kind==='condition')return s.condition_type==='no_response'?'Los siguientes pasos solo continúan si el cliente no ha respondido.':'Elige qué debe cumplirse para continuar.';
    if(s.action_type==='send_template')return 'Plantilla: '+optionName(opts.templates,c.template_id,'pendiente de elegir');
    if(s.action_type==='send_whatsapp_now')return c.text||'Escribe el mensaje que se enviará.';
    if(s.action_type==='create_opportunity')return [c.title||'Título pendiente',optionName(opts.stages,c.stage_id,'Columna pendiente'),c.amount!==undefined&&c.amount!==''?'Importe: '+c.amount:''].filter(Boolean).join(' · ');
    if(s.action_type==='create_task')return [c.title||'Título pendiente',c.start_value?`Dentro de ${c.start_value} ${dictUnit(c.start_unit)}`:'Fecha configurada en el paso',c.start_time||''].filter(Boolean).join(' · ');
    if(s.action_type==='assign_label')return c.label_id==='__dynamic__'?(c.label_name_template||'Etiqueta con mes y año'):optionName(opts.labels,c.label_id,'Elige la etiqueta');
    if(s.action_type==='move_opportunity')return 'Columna de destino: '+optionName(opts.stages,c.stage_id,'pendiente de elegir');
    if(s.action_type==='record_offer_month')return 'Añade OFERTA · MES · AÑO tras confirmar el envío.';
    if(s.action_type==='record_sale_month')return 'Registra VENTAS · MES · AÑO y conserva las etiquetas de otras ofertas abiertas.';
    return 'Selecciona qué quieres que ocurra en este paso.';
  }
  function refreshSummaries(){
    document.querySelectorAll('#tpfFlowSteps [data-step-id]').forEach(row=>{const s=flow.steps.find(x=>x.id===row.dataset.stepId);if(s){let p=row.querySelector('.tpfStepSummary');if(!p){p=document.createElement('p');p.className='tpfStepSummary';row.appendChild(p);}p.textContent=stepSummary(s);}});
    const review=$('tpfSimpleReview');if(!review||review.hidden)return;
    const c=flow.trigger_config||{};const triggerDetail=flow.trigger_type==='label_assigned'?optionName(opts.labels,c.label_id,'Etiqueta pendiente'):flow.trigger_type==='opportunity_stage'?optionName(opts.stages,c.stage_id,'Columna pendiente'):flow.trigger_type==='message_contains'?(c.keyword||'Palabra pendiente'):flow.trigger_type==='unanswered'?`${c.wait_value||'…'} ${dictUnit(c.wait_unit)}`:'';
    review.innerHTML=`<h3>${esc(flow.name||'Automatización sin nombre')}</h3><p><strong>${flow.enabled?'Activa al guardar':'Pausada al guardar'}</strong> · ${esc(triggerLabel(flow.trigger_type))}${triggerDetail?' · '+esc(triggerDetail):''}</p><ol>${flow.steps.map(s=>`<li><strong>${esc(stepTitle(s))}</strong><br>${esc(stepSummary(s))}</li>`).join('')}</ol><p class="small">Revisa cada paso para consultar todos sus campos. Este resumen no guarda ni activa la automatización.</p>`;
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
    if(!flow.steps.length){box.innerHTML='<div class="tpfFlowEmpty">Todavía no hay pasos. Añade la primera acción, espera, condición o repetición.</div>';renderEditor(null);renderCards();return;}
    if(!flow.selected||!flow.steps.some(x=>x.id===flow.selected))flow.selected=flow.steps[0].id;
    box.innerHTML=flow.steps.map((s,i)=>`<div class="tpfFlowStep ${s.id===flow.selected?'active':''}" data-step-id="${s.id}"><div class="tpfFlowStepTop"><span class="tpfStepNum">${i+1}</span><span class="tpfStepKind tpfKind${s.kind[0].toUpperCase()+s.kind.slice(1)}">${s.kind==='action'?'HACER':s.kind==='wait'?'ESPERAR':s.kind==='repeat'?'REPETIR':'SI'}</span><span class="tpfFlowStepTitle">${esc(stepTitle(s))}</span><button type="button" data-move="up">↑</button><button type="button" data-move="down">↓</button><button type="button" data-delete="1">×</button></div></div>`).join('');
    renderEditor(flow.steps.find(x=>x.id===flow.selected));
    refreshSummaries();
    renderCards();
  }

  function renderEditor(s){
    const e=$('tpfStepEditor');if(!e)return;
    if(!s){e.innerHTML='<h4>Configura tu flujo</h4><div class="hint">Selecciona o añade un paso. Ninguna acción viene impuesta: tú eliges qué ocurre y cuándo.</div>';return;}
    if(s.kind==='wait')return renderWait(e,s);
    if(s.kind==='repeat')return renderRepeat(e,s);
    if(s.kind==='condition')return renderCondition(e,s);
    renderAction(e,s);
  }

  function renderWait(e,s){e.innerHTML=`<h4>Cuánto esperar</h4><div class="hint">Elige exactamente cuánto tiempo debe pasar antes del siguiente paso.</div><div class="tpfStepConfig"><label>Tiempo<input data-key="value" type="number" min="0" value="${esc(s.value??'')}"></label><label>Unidad<select data-key="unit">${unitOptions(s.unit||'')}</select></label></div>`}
  function renderRepeat(e,s){e.innerHTML=`<h4>Cuántas veces repetir</h4><div class="hint">Repite la acción inmediatamente anterior con el intervalo y límite que tú decidas.</div><div class="tpfStepConfig"><label>Cada<input data-key="every_value" type="number" min="1" value="${esc(s.every_value??'')}"></label><label>Unidad<select data-key="every_unit">${unitOptions(s.every_unit||'')}</select></label><label>Máximo de repeticiones<input data-key="times" type="number" min="1" max="100" value="${esc(s.times??'')}"></label><div class="full tpfCheckRow"><label><input data-key="stop_if_response" type="checkbox" ${s.stop_if_response?'checked':''}> Detener las repeticiones si el cliente responde</label></div></div>`}
  function renderCondition(e,s){e.innerHTML=`<h4>Cuándo continuar</h4><div class="hint">Los pasos siguientes solo continuarán si se cumple esta condición.</div><div class="tpfStepConfig"><label class="full">Condición<select data-key="condition_type"><option value="">Elige condición…</option><option value="no_response" ${s.condition_type==='no_response'?'selected':''}>El cliente no ha respondido desde que empezó el flujo</option></select></label></div>`}

  function commonVars(){return '<div class="tpfVarHelp">Puedes usar variables en los textos: <b>{nombre}</b>, <b>{dni}</b>, <b>{telefono}</b>, <b>{mensaje}</b>. Si un campo queda vacío, no se fuerza ningún valor.</div>'}
  function stageOptions(v=''){return '<option value="">Elige columna…</option>'+opts.stages.map(x=>`<option value="${x.id}" ${String(v)===String(x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}
  function labelOptions(v=''){return '<option value="">Elige etiqueta…</option>'+opts.labels.map(x=>`<option value="${x.id}" ${String(v)===String(x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}
  function templateOptions(v=''){return '<option value="">Elige plantilla…</option>'+opts.templates.map(x=>`<option value="${x.id}" ${String(v)===String(x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}
  function userOptions(v=''){return '<option value="self">Usuario de la automatización</option>'+opts.users.map(x=>`<option value="${esc(x.user_id)}" ${String(v)===String(x.user_id)?'selected':''}>${esc(x.display_name||x.email)}</option>`).join('')}
  function actionSelect(s){return `<label class="full">Acción<select data-key="action_type"><option value="">Elige una acción…</option><option value="create_opportunity" ${s.action_type==='create_opportunity'?'selected':''}>Crear oportunidad</option><option value="create_task" ${s.action_type==='create_task'?'selected':''}>Crear tarea</option><option value="send_whatsapp_now" ${s.action_type==='send_whatsapp_now'?'selected':''}>Enviar WhatsApp ahora</option><option value="send_template" ${s.action_type==='send_template'?'selected':''}>Enviar plantilla WhatsApp</option><option value="assign_label" ${s.action_type==='assign_label'?'selected':''}>Asignar etiqueta</option><option value="move_opportunity" ${s.action_type==='move_opportunity'?'selected':''}>Mover oportunidad de columna</option></select></label>`}

  function renderAction(e,s){
    const c=s.config||(s.config={});let h=`<h4>${esc(actionLabel(s.action_type))}</h4><div class="hint">Elige la acción. Después aparecen todos sus campos configurables.</div><div class="tpfStepConfig">${actionSelect(s)}`;
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
    const presentation=ev.target.closest('[data-presentation]');if(presentation){simpleView=presentation.dataset.presentation==='simple';ensureSimpleView();renderSteps();return;}
    const card=ev.target.closest('[data-card-id]');if(card){const i=flow.steps.findIndex(x=>x.id===card.dataset.cardId);if(i<0)return;const del=ev.target.closest('[data-card-delete]'),move=ev.target.closest('[data-card-move]');if(del){flow.steps.splice(i,1);renderSteps();}else if(move){const j=i+(move.dataset.cardMove==='up'?-1:1);if(j>=0&&j<flow.steps.length){[flow.steps[i],flow.steps[j]]=[flow.steps[j],flow.steps[i]];renderSteps();}}return;}
    if(ev.target.closest('#tpfShowFlowReview')){const r=$('tpfSimpleReview');r.hidden=!r.hidden;$('tpfShowFlowReview').setAttribute('aria-expanded',String(!r.hidden));refreshSummaries();return;}
    const preset=ev.target.closest('[data-lifecycle-draft]');if(preset){if((flow.id||flow.steps.length)&&!window.confirm('Preparar un borrador nuevo descartará los cambios sin guardar del editor. ¿Continuar?'))return;lifecycleDraft(preset.dataset.lifecycleDraft);return;}
    const add=ev.target.closest('[data-add]');if(add){const kind=add.dataset.add;const s={id:uid(),kind};if(kind==='action'){s.action_type='';s.config={}}if(kind==='wait'){s.value='';s.unit=''}if(kind==='condition'){s.condition_type=''}if(kind==='repeat'){s.every_value='';s.every_unit='';s.times='';s.stop_if_response=false}flow.steps.push(s);flow.selected=s.id;renderSteps();return;}
    const row=ev.target.closest('[data-step-id]');if(!row)return;const id=row.dataset.stepId,i=flow.steps.findIndex(x=>x.id===id);if(i<0)return;
    if(ev.target.closest('[data-delete]')){flow.steps.splice(i,1);flow.selected=flow.steps[Math.max(0,i-1)]?.id||null;renderSteps();return;}
    const m=ev.target.closest('[data-move]');if(m){const j=m.dataset.move==='up'?i-1:i+1;if(j>=0&&j<flow.steps.length){[flow.steps[i],flow.steps[j]]=[flow.steps[j],flow.steps[i]];renderSteps();}return;}
    flow.selected=id;renderSteps();
  }

  function onBuilderInput(ev){
    const t=ev.target;
    queueMicrotask(refreshSummaries);
    if(t.id==='tpfLifecycleMode'){
      flow.lifecycle=t.value?{version:1,mode:t.value,stop_stage_ids:[]}:null;if(flow.extra)delete flow.extra.lifecycle;
      flow.enabled=false;renderAll();$('tpfFlowMessage').textContent='Se conservan tus pasos. Revisa el registro mensual y las columnas antes de activar. El borrador queda pausado.';return;
    }
    if(t.dataset.lifecycleStage!==undefined&&flow.lifecycle){flow.lifecycle.stop_stage_ids=flow.lifecycle.stop_stage_ids||[];flow.lifecycle.stop_stage_ids[Number(t.dataset.lifecycleStage)]=t.value;return;}
    if(t.id==='tpfFlowName'){flow.name=t.value;return}if(t.id==='tpfFlowEnabled'){flow.enabled=t.value==='1';return}
    if(t.dataset.triggerKey){flow.trigger_config[t.dataset.triggerKey]=t.value;return}
    const cardId=t.closest('[data-card-id]')?.dataset.cardId;
    const s=flow.steps.find(x=>x.id===(cardId||flow.selected));if(!s)return;
    if(t.dataset.key){let v=t.type==='checkbox'?t.checked:t.value;if(['value','every_value','times'].includes(t.dataset.key)&&v!=='')v=Number(v);s[t.dataset.key]=v;if(t.dataset.key==='action_type'){s.config={};}if(!cardId||ev.type==='change'||t.dataset.key==='action_type')renderSteps();return;}
    if(t.dataset.cfg){s.config=s.config||{};s.config[t.dataset.cfg]=t.value;if(cardId&&t.dataset.cfg==='label_id'&&ev.type==='change')renderCards();return}
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

  function renderAll(){if(!$('tpfFlowBuilder'))return;$('tpfFlowName').value=flow.name||'';$('tpfFlowEnabled').value=flow.enabled?'1':'0';$('tpfFlowTrigger').value=flow.trigger_type||'';renderTriggerConfig();renderLifecycle();renderSteps();refreshSummaries();}
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
