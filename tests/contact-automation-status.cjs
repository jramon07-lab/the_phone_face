'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/contact-automation-status.js','utf8');
let registered='';
const context={window:{TPFModules:{register(name){registered=name},report(){}}},document:{readyState:'loading',addEventListener(){},getElementById(){return null}},Date,Map,Set,console,setTimeout(){},setInterval(){return 1},CustomEvent:function(){}};
context.window.window=context.window;vm.runInNewContext(source,context,{filename:'contact-automation-status.js'});
const api=context.window.TPFContactAutomationStatus;
assert.equal(registered,'contact-automation-status');
assert(api,'publica utilidades comprobables');
const jobs=[
 {id:'root-a',automation_id:'auto-a',event_key:'sale-a:flow',action_type:'flow_v1',status:'done',created_at:'2026-09-10T08:00:00Z',context:{contact_id:'contact-a',flow_root:'sale-a:flow'}},
 {id:'next-a',automation_id:'auto-a',event_key:'sale-a:flow:action:1',action_type:'send_template',status:'pending',run_at:'2099-09-12T09:00:00Z',created_at:'2026-09-10T08:00:01Z',context:{contact_id:'contact-a',flow_root:'sale-a:flow'}},
 {id:'root-b',automation_id:'auto-b',event_key:'sale-b:flow',action_type:'flow_v1',status:'done',created_at:'2026-09-09T08:00:00Z',context:{contact_id:'contact-a',flow_root:'sale-b:flow'}},
 {id:'done-b',automation_id:'auto-b',event_key:'sale-b:flow:action:1',action_type:'assign_label',status:'done',completed_at:'2026-09-09T08:00:02Z',context:{contact_id:'contact-a',flow_root:'sale-b:flow'}},
 {id:'root-c',automation_id:'auto-c',event_key:'sale-c:flow',action_type:'flow_v1',status:'done',created_at:'2026-09-08T08:00:00Z',context:{contact_id:'contact-a',flow_root:'sale-c:flow'}},
 {id:'fail-c',automation_id:'auto-c',event_key:'sale-c:flow:action:1',action_type:'send_whatsapp_now',status:'failed',error_message:'Proveedor no disponible',context:{contact_id:'contact-a',flow_root:'sale-c:flow'}}
];
const rows=api.groupJobs(jobs,[{id:'auto-a',name:'Seguimiento Vodafone'},{id:'auto-b',name:'Posventa Vodafone'},{id:'auto-c',name:'Revisión Vodafone'}]);
assert.equal(rows.length,3,'agrupa pasos de una misma ejecución');
const summary=api.summarize(rows);
assert.deepEqual(JSON.parse(JSON.stringify({active:summary.active,scheduled:summary.scheduled,completed:summary.completed,errors:summary.errors})),{active:1,scheduled:1,completed:1,errors:1});
assert.equal(summary.next.id,'next-a');
const flowRows=api.groupJobs([
 {id:'flow',automation_id:'auto-flow',event_key:'flow-x:flow',action_type:'flow_v1',status:'done',created_at:'2026-09-10T08:00:00Z',context:{contact_id:'contact-a',flow_root:'flow-x:flow'},action_config:{steps:[{kind:'action',action_type:'assign_label',config:{label_id:'label-1'}},{kind:'wait',value:3,unit:'months'},{kind:'action',action_type:'prepare_operator_review',config:{title:'Revisar renovación'}}]}},
 {id:'label',automation_id:'auto-flow',event_key:'flow-x:flow:action:1',action_type:'assign_label',status:'done',completed_at:'2026-09-10T08:00:01Z',context:{contact_id:'contact-a',flow_root:'flow-x:flow'},action_config:{__flow_step:1,label_id:'label-1'}},
 {id:'review',automation_id:'auto-flow',event_key:'flow-x:flow:action:3',action_type:'prepare_operator_review',status:'pending',run_at:'2026-12-10T08:00:00Z',context:{contact_id:'contact-a',flow_root:'flow-x:flow'},action_config:{__flow_step:3,title:'Revisar renovación'}}
],[{id:'auto-flow',name:'RENOVACIÓN · Vodafone',trigger_type:'opportunity_stage'}]);
const flowSteps=api.executionSteps(flowRows[0],{labels:new Map([['label-1',{name:'Cliente Vodafone'}]]),stages:new Map(),templates:new Map()});
assert.equal(flowSteps.length,4,'explica disparador, etiqueta, espera y revisión');
assert.equal(flowSteps[1].details[0][1],'Cliente Vodafone','resuelve el nombre de la etiqueta');
assert.equal(flowSteps[3].title,'Preparar revisión de renovación con el operador','traduce la acción técnica de renovación');
assert.match(source,/contains\('context',\{contact_id:id\}\)/,'filtra por identificador del contacto');
assert.match(source,/#contactModal \.cpRight/,'inserta el contador en la ficha');
assert.match(source,/offers\.before\(section\)/,'mantiene el contador encima de ofertas aunque esa sección cargue después');
assert.match(source,/waAutomationStatus/,'inserta el contador en WhatsApp');
assert.match(source,/data-cas-toggle/,'permite plegar el resumen de automatizaciones');
assert.match(source,/casExecution[^`]*<summary|<details class="casExecution/,'agrupa cada ejecución en un desplegable');
assert.match(source,/from\('wa_templates'\)/,'carga la biblioteca para mostrar el contenido de la plantilla');
assert.match(source,/casTemplate/,'muestra cada plantilla en un segundo desplegable');
assert.match(source,/Pasos de esta automatización/,'muestra todos los pasos realizados y pendientes');
assert.match(source,/Ver mensaje que se enviará/,'explica claramente el desplegable de la plantilla');
assert.doesNotMatch(source,/>prepare_operator_review</,'no muestra la acción técnica como etiqueta visible');
assert.match(source,/crm_cancel_automation_execution/,'cancela la ejecución sin borrar el historial');
assert(!/from\(['"]sales_opportunities['"]\)\.update/.test(source),'el contador no mueve oportunidades');
console.log('PASS: contador de automatizaciones por cliente');
