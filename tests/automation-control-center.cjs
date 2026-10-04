const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('js/modules/automation-control-center.js','utf8');
assert.match(fs.readFileSync('assets/app.css','utf8'),/header:not\(\.waChatHeader\):not\(\.ccHead\)/,'fullscreen must not hide control center header');
assert.match(source,/\.ccHead\{position:sticky;top:0/,'la cabecera del control debe permanecer visible');
assert.match(source,/root\.scrollTop=0/,'el control debe abrirse desde arriba');
const context={window:{TPFModules:{register(){}}}};
vm.runInNewContext(source,context,{filename:'automation-control-center.js'});

const api=context.window.TPFAutomationControlCenter;
assert(api,'debe publicar el controlador del centro de envíos');
assert.equal(api.statusOf('automation',{status:'pending'}),'pending');
assert.equal(api.statusOf('automation',{status:'paused'}),'paused');
assert.equal(api.statusOf('automation',{status:'done'}),'sent');
assert.equal(api.statusOf('program',{status:'pending',whatsapp_delivery_status:'uncertain'}),'uncertain');
assert.equal(api.statusOf('program',{status:'completed',whatsapp_delivery_status:'sent'}),'sent');
assert.equal(api.operatorOf({name:'Seguimiento O2'},{}),'O2');
assert.equal(api.operatorOf({name:'Revisión MásMóvil'},{}),'MásMóvil');

assert.match(source,/crm_set_automation_job_pause/,'debe pausar y reanudar de forma controlada');
assert.match(source,/crm_cancel_automation_job/,'debe cancelar sin borrar el historial');
assert.match(source,/crm_retry_automation_step/,'debe reutilizar el reintento seguro y deduplicado');
assert.match(source,/Posibles duplicados pendientes/,'debe señalar posibles duplicados');
assert.match(source,/Resultado incierto|Revisar antes de reenviar/,'debe impedir reenvíos ciegos');
assert.match(source,/view-whatsapp.*wapHeaderActions/,'el botón debe insertarse en WhatsApp programados');
assert.match(source,/view-whatsapplive.*ccLaunch.*remove/,'el botón no debe recargar las conversaciones normales');
assert.doesNotMatch(source,/\.delete\(/,'el centro no debe borrar trabajos ni mensajes');

const sql=fs.readFileSync('db/proposals/automation_control_center.sql','utf8');
assert.match(sql,/user_id\s*=\s*auth\.uid\(\)/,'los controles deben limitarse al propietario');
assert.match(sql,/status in \('pending','paused'\)/,'solo se cancelan trabajos que aún no se enviaron');
assert.match(sql,/grant execute .* to authenticated/i,'las funciones deben exigir sesión autenticada');
assert.match(sql,/revoke all .* from public, anon/i,'las funciones no deben quedar públicas');

console.log('PASS automation control center: estados, seguridad, duplicados y acciones sin borrado');

// Behavioral regression: mix manual/automatic rows, deduplicate provider receipts,
// order pending sends and expose editing only before delivery.
const nodes={ccStatus:{value:'pending'},ccSearch:{value:''},ccOperator:{value:''},ccSource:{value:''}};
const calls=[];
const sandbox={window:{TPFModules:{register(){}}},document:{getElementById:id=>nodes[id]||null},
sb:{rpc:async(name,args)=>{calls.push({name,args});return {data:'paused'}}}};
vm.runInNewContext(source.replace('window.TPFAutomationControlCenter={statusOf','window.__test={state,actions,filtered,updateProgram,reasonCategory,dateMatches,needsReview,madridBoundary,historyArgs};window.TPFAutomationControlCenter={statusOf'),sandbox);
const t=sandbox.window.__test,a=sandbox.window.TPFAutomationControlCenter;
t.state.jobs=[
{id:'later',action_type:'send_whatsapp_now',status:'pending',run_at:'2026-11-02T10:00:00Z',context:{name:'Ejemplo automático',phone:'34000000001'},action_config:{text:'Oferta'}},
{id:'delivered',action_type:'send_whatsapp_now',status:'cancelled',context:{phone:'34000000002'},action_config:{text:'Mensaje',__delivery_receipt:{idMessage:'provider1',acceptedAt:'2026-10-04T10:00:00Z'}}}
];
t.state.programs=[{id:'manual',status:'pending',whatsapp_enabled:true,whatsapp_delivery_status:'pending',whatsapp_message:'Mensaje manual',whatsapp_scheduled_at:'2026-11-01T10:00:00Z',customer_name:'Ejemplo manual',whatsapp_phone:'34000000003',updated_at:'2026-10-04T09:00:00Z'}];
t.state.history=[{source:'automation',id:'delivered',message_key:'provider1',sent_at:'2026-10-04T10:00:00Z',message:'Mensaje',phone:'34000000002'}];
const rows=a.makeRows();
assert.equal(rows.filter(x=>x.messageKey==='provider1').length,1);
assert.equal(rows.find(x=>x.id==='delivered').status,'sent');
assert.deepEqual(Array.from(t.filtered(),x=>x.id),['manual','later']);
assert.match(t.actions(rows.find(x=>x.id==='manual')),/>Gestionar</);
assert.doesNotMatch(t.actions(rows.find(x=>x.id==='manual')),/data-cc-action/,'la lista solo abre el detalle');
assert.match(t.actions(rows.find(x=>x.id==='manual'),false),/>Editar</);
assert.match(t.actions(rows.find(x=>x.id==='manual'),false,true),/>Pausar</);
assert.doesNotMatch(t.actions(rows.find(x=>x.id==='manual'),false,true),/>Editar</,'el editor no debe abrir un segundo editor');
assert.doesNotMatch(t.actions(rows.find(x=>x.id==='later')),/>Editar</);
assert.equal(t.actions(rows.find(x=>x.id==='delivered'),false),'');
assert.equal(t.actions({source:'program',id:'sending',status:'sending'},false),'');
(async()=>{await t.updateProgram(rows.find(x=>x.id==='manual'),'pause');assert.equal(calls[0].name,'crm_control_scheduled_whatsapp');assert.equal(calls[0].args.p_expected_at,'2026-10-04T09:00:00Z');console.log('PASS unified sends: ordering, receipt history, editing eligibility and guarded RPC');})().catch(e=>{console.error(e);process.exitCode=1});

t.state.jobs.push({id:'manager',action_type:'send_whatsapp_now',status:'pending',context:{name:'Gestor Apellido',contact_id:'holder',recipient_contact_id:'manager',contact_data:{NOMBRE:'Titular'},operator:'Vodafone',precio_total:'59,00',contract_party:{same:false,recipient:'contact',holder_name:'Titular Apellido'}},action_config:{offer_phase:'reminder_2',text:'Hola {nombre}\nOferta de {operador}: {precio_total} €/mes'}});
const preview=a.makeRows().find(x=>x.id==='manager').message;
assert.match(preview,/Hola Gestor\nSobre el contrato de Titular Apellido\./);
assert.match(preview,/Vodafone: 59,00 €/);

assert.equal(t.reasonCategory({source:'automation',raw:{action_config:{offer_phase:'initial'},context:{lifecycle:{mode:'offer'}}},auto:{name:'OFERTAS · Seguimiento general'}}),'offer');
assert.equal(t.reasonCategory({raw:{action_config:{offer_phase:'reminder_2'}}}),'reminder');
assert.equal(t.reasonCategory({auto:{name:'POSVENTA · Yoigo · 3 meses'}}),'followup');
assert.equal(t.reasonCategory({auto:{name:'POSVENTA · Yoigo · 11 meses'}}),'review');
assert.equal(t.reasonCategory({raw:{action_config:{offer_phase:'router_return'}}}),'return');
assert.equal(t.dateMatches({when:'2026-10-03T22:30:00Z'},'today','','','2026-10-04T10:00:00Z'),true,'Madrid day starts before UTC midnight');
assert.equal(t.dateMatches({when:'2026-10-05T10:00:00Z'},'tomorrow','','','2026-10-04T10:00:00Z'),true);
assert.equal(t.dateMatches({when:'2026-10-05T10:00:00Z'},'week','','','2026-10-04T10:00:00Z'),false,'next Monday is not this week');
assert.equal(t.dateMatches({when:'2026-10-04T10:00:00Z'},'range','2026-10-03','2026-10-05'),true);
assert.equal(t.dateMatches({when:'2026-10-04T10:00:00Z'},'range','2026-10-05','2026-10-03'),false);
assert.equal(t.needsReview({status:'sent',when:'2026-10-01T10:00:00Z'},'overdue','2026-10-04T10:00:00Z'),false);
assert.equal(t.needsReview({status:'pending',when:'2026-10-01T10:00:00Z'},'overdue',Date.parse('2026-10-04T10:00:00Z')),true);
assert.equal(t.needsReview({status:'uncertain'},'needs'),true);
nodes.ccStatus.value='';nodes.ccReason={value:'reminder'};nodes.ccDate={value:''};nodes.ccReview={value:''};nodes.ccSource.value='';
assert.deepEqual(Array.from(t.filtered(),x=>x.id),['manager']);
nodes.ccReason.value='';nodes.ccDate.value='range';nodes.ccFrom={value:'2026-11-01'};nodes.ccTo={value:'2026-11-01'};
assert.deepEqual(Array.from(t.filtered(),x=>x.id),['manual']);
console.log('PASS send filters: reason, inclusive Madrid dates, review and combined filters');

assert.equal(t.madridBoundary('2026-10-04'),'2026-10-03T22:00:00.000Z');
assert.equal(t.madridBoundary('2026-10-26'),'2026-10-25T23:00:00.000Z','DST boundary uses Madrid offset');
nodes.ccDate.value='range';nodes.ccFrom.value='2026-10-24';nodes.ccTo.value='2026-10-25';
assert.equal(t.historyArgs().p_to,'2026-10-25T23:00:00.000Z','inclusive custom end becomes next local midnight');

