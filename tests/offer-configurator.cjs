// Offline checks only: no database rows or WhatsApp messages are created.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/modules/offers-pro.js'),'utf8');
const context={window:{},Intl};
vm.createContext(context);
vm.runInContext(source,context);
const api=context.window.TPFOffersPro;
assert(api,'the offer configurator exposes its deterministic helpers');
assert.deepEqual([...api.OPERATORS],['Vodafone','Yoigo','MásMóvil','O2','Lowi','Orange']);
assert.equal(api.directSaleMessage('Vodafone',52,'Ana García'),'Hola Ana, te envío lo que hemos comentado:\n• Operador: Vodafone\nPrecio final: 52,00 €/mes');
assert.equal(api.scheduledSendIso('now',''),null,'send now never creates a schedule');
assert.match(api.nextHalfHourLocal(Date.parse('2026-09-10T10:10:00Z')),/:30$/,'the default slot advances to a half-hour boundary');
assert.match(api.nextHalfHourLocal(Date.parse('2026-09-10T10:31:00Z')),/:00$/,'the default slot never keeps arbitrary minutes');
assert.equal(api.scheduledSendIso('scheduled','2026-09-12T10:30',Date.parse('2026-09-10T10:30:00Z')),new Date('2026-09-12T10:30').toISOString(),'scheduled local time is converted to an ISO instant');
assert.throws(()=>api.scheduledSendIso('scheduled','2026-09-10T10:30',Date.parse('2026-09-10T10:30:00Z')),/minuto de margen/);
const offer={operator:'Vodafone',name:'VDF · NOMBRE INTERNO',base_price:52,base_features:['Fibra 600 Mb','2 líneas de 160 GB'],line_options:[
  {id:'gb',name:'Fibra 1 Gb',price_delta:10,option_type:'radio',message_text:'Fibra 1 Gb',replaces_text:'Fibra 600 Mb'},
  {id:'unlimited',name:'Datos ilimitados',price_delta:4,option_type:'radio',message_text:'2 líneas con datos ilimitados',replaces_text:'2 líneas de 160 GB'},
  {id:'netflix',name:'Netflix interno',price_delta:4,option_type:'radio',message_text:'Netflix incluido',replaces_text:'Amazon incluido'},
  {id:'extra',name:'Línea adicional interna',price_delta:6,option_type:'quantity',message_text:'30 GB'},
  {id:'extraUnlimited',name:'Línea con datos ilimitados',price_delta:6,option_type:'quantity',message_text:'con datos ilimitados'}
]};
assert.equal(api.calculateTotal(offer,{gb:1,netflix:1,extra:2}),78,'options update the calculated total');
const message=api.buildMessage(offer,{gb:1,netflix:1,extra:2},'Ana García','Precio válido este mes.',75);
assert.match(message,/Hola Ana/);
assert.match(message,/Fibra 1 Gb/);
assert.ok(message.indexOf('Fibra 1 Gb')<message.indexOf('2 líneas de 160 GB'),'replacement keeps Fiber before mobile data');
assert.match(message,/Netflix incluido/);
assert.equal((message.match(/2 líneas de 30 GB/g)||[]).length,1,'extra lines are grouped into one natural customer sentence');
assert.ok(message.indexOf('2 líneas de 30 GB')<message.indexOf('Netflix incluido'),'mobile lines appear before content services');
assert.match(message,/75,00 €\/mes/);
assert.match(message,/Precio válido este mes/);
assert.doesNotMatch(message,/NOMBRE INTERNO|Netflix interno|Vodafone/,'internal catalog names are never sent to the customer');
assert.doesNotMatch(message,/principales|adicional|× 2/i,'customer copy omits internal line wording and multiplication text');
assert.doesNotMatch(message,/Fibra 600 Mb|Amazon incluido/,'replaced commercial features are removed');
const hiddenMessage=api.buildMessage(offer,{gb:1,netflix:1,extra:2},'Ana García','',75,{netflix:false,extra:false});
assert.doesNotMatch(hiddenMessage,/Netflix incluido|2 líneas de 30 GB/,'hidden options keep their price but are omitted from the customer message');
assert.match(hiddenMessage,/75,00 €\/mes/);
const unlimitedMessage=api.buildMessage(offer,{gb:1,unlimited:1,extra:1},'Ana García','',72);
assert.match(unlimitedMessage,/2 líneas con datos ilimitados/);
assert.match(unlimitedMessage,/1 línea de 30 GB/);
assert.doesNotMatch(unlimitedMessage,/2 líneas de 160 GB/);
const extraUnlimitedMessage=api.buildMessage(offer,{extraUnlimited:2},'Ana García','',64);
assert.match(extraUnlimitedMessage,/2 líneas con datos ilimitados/);
assert.doesNotMatch(extraUnlimitedMessage,/líneas de con datos/);

const masmovil={operator:'MásMóvil',name:'MM · INTERNA',base_price:34.9,base_features:['Fibra 500 Mb','2 líneas con 50 GB compartidos'],line_options:[
  {id:'fiber1gb',name:'Fibra 1 Gb',price_delta:10,option_type:'checkbox',group_name:'fibra',message_text:'Fibra 1 Gb',replaces_text:'Fibra 500 Mb'},
  {id:'line25',name:'Línea móvil 25 GB',data_gb:25,price_delta:5,option_type:'quantity',group_name:'shared_gb',message_text:'25 GB compartidos'},
  {id:'line45',name:'Línea móvil 45 GB',data_gb:45,price_delta:10,option_type:'quantity',group_name:'shared_gb',message_text:'45 GB compartidos'},
  {id:'discount15',name:'Descuento 15 €',price_delta:-15,option_type:'radio',group_name:'discount'}
]};
assert.equal(api.calculateTotal(masmovil,{fiber1gb:1,line25:1,line45:2,discount15:1}),54.9,'MásMóvil adds extras and applies any optional discount');
const masmovilMessage=api.buildMessage(masmovil,{fiber1gb:1,line25:1,line45:2,discount15:1},'Rosa López','',54.9);
assert.match(masmovilMessage,/Fibra 1 Gb/);
assert.match(masmovilMessage,/5 líneas con 165 GB compartidos/,'additional lines are merged into the shared data pool');
assert.doesNotMatch(masmovilMessage,/Descuento|INTERNA|Línea móvil/,'discount and internal names never reach the customer');
const hiddenSharedMessage=api.buildMessage(masmovil,{line25:1},'Rosa López','',39.9,{line25:false});
assert.match(hiddenSharedMessage,/2 líneas con 50 GB compartidos/,'the eye can hide the added shared data from the message without changing price');
assert.doesNotMatch(hiddenSharedMessage,/75 GB/);

const sql=fs.readFileSync(path.join(root,'db/proposals/offer-configurator.sql'),'utf8');
for(const table of ['crm_offer_catalog','crm_offer_line_options','crm_offer_instances'])assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`));
assert.match(sql,/p_mode not in \('followup','accepted'\)/);
assert.match(sql,/record_offer_month/);
assert.match(sql,/wait','unit','days','value',2/);
assert.match(sql,/wait','unit','days','value',3/);
assert.match(sql,/r\.trigger_config->>'automation_operator'/);
assert.match(sql,/array\['Vodafone','Yoigo','MásMóvil','O2','Lowi','Orange'\]/);
assert.doesNotMatch(sql,/insert into public\.crm_offer_catalog\([^)]*\)\s*values\s*\([^)]*(Vodafone|Orange)/is,'no invented live tariffs are seeded');

const sqlV2=fs.readFileSync(path.join(root,'db/proposals/offer-configurator-v2.sql'),'utf8');
assert.match(sqlV2,/crm_create_offer_execution_v2/);
assert.match(sqlV2,/CONTRAOFERTA '\|\|upper\(offer\.operator\)/);
assert.match(sqlV2,/offer_record_month\(rec\.id,opp_id,now\(\)\)/);
assert.match(sqlV2,/VDF · ESTÁNDAR 600 \+ 2×160/);
assert.match(sqlV2,/VDF · CONTRAOFERTA 1 GB \+ 2 ILIMITADAS/);
assert.match(sqlV2,/\(counter_id,'Netflix',null,7,30,'radio','contenido','Netflix incluido'\)/);
for(const price of ["'Fibra 1 Gb',10","'Líneas principales ilimitadas',4","'Línea adicional 160 GB',6","'Línea adicional 30 GB',30,6","'Línea adicional 60 GB',60,8.5","'Línea adicional 160 GB',160,11","'Línea adicional ilimitada',null,16"])assert.ok(sqlV2.includes(price),`expected configurable Vodafone price: ${price}`);
assert.match(source,/crm_create_offer_execution_v7/);
assert.match(source,/p_test_mode:CRM_TEST_MODE/);
assert.match(source,/CRM_TEST_PHONE='695661409'/);
assert.match(source,/p_request_key:offerRequestKey/);
assert.match(source,/crm_offer_delivery_status/);
assert.match(source,/Precio final para el cliente/);
assert.match(source,/Nombre interno \(no se envía\)/);
assert.match(source,/show_in_message/);
assert.match(source,/Ocultar del mensaje/);

const sqlV6=fs.readFileSync(path.join(root,'db/proposals/crm-integrity-v6.sql'),'utf8');
assert.match(sqlV6,/crm_offer_instances_request_key_uidx/);
assert.match(sqlV6,/crm_create_contact_guarded/);
assert.match(sqlV6,/crm_create_opportunity_guarded/);
assert.match(sqlV6,/crm_create_offer_execution_v5/);
assert.match(sqlV6,/crm_offer_delivery_status/);
const sqlSafety=fs.readFileSync(path.join(root,'db/proposals/offer-configurator-v5-safety.sql'),'utf8');
assert.match(sqlSafety,/v_offer_id uuid/);
assert.match(sqlSafety,/v_opportunity_id uuid/);
assert.doesNotMatch(sqlSafety,/\n\s*opportunity_id uuid;/);

const sqlV3=fs.readFileSync(path.join(root,'db/proposals/offer-configurator-v3.sql'),'utf8');
assert.match(sqlV3,/show_in_message/);
assert.match(sqlV3,/if show_message then features:=features/);
assert.match(sqlV3,/'TV con más de 80 canales',null,0,30,'checkbox'/);
assert.match(sqlV3,/'Amazon',null,0,40,'radio','contenido'/);
assert.match(sqlV3,/'Netflix',null,4,50,'radio','contenido'/);

const sqlV4=fs.readFileSync(path.join(root,'db/proposals/offer-configurator-v4.sql'),'utf8');
assert.match(sqlV4,/crm_create_offer_execution_v3/);
assert.match(sqlV4,/'CAMBIO '\|\|upper\(offer\.operator\)/);
assert.match(sqlV4,/process_date=today_madrid then opp_stage:=processed_stage/);
assert.match(sqlV4,/else opp_stage:=pending_stage/);
assert.match(sqlV4,/p_send_message/);
assert.match(sqlV4,/manual-offer-accepted:/);
assert.match(sqlV4,/name='VDF · ESTÁNDAR 600'/);
assert.match(sqlV4,/base_features='\["Fibra 600 Mb","2 líneas de 160 GB"\]'/);
assert.match(sqlV4,/case when coalesce\(opt\.message_text,opt\.name\)~\*'\^con/);
assert.match(sqlV4,/jsonb_array_elements\(line_features\)/);
assert.match(sqlV4,/jsonb_array_elements\(service_features\)/);
assert.match(sqlV4,/Netflix y devolución de router/);
assert.match(sqlV4,/set enabled=true/);
assert.match(sqlV4,/required_offer_flag/);
assert.match(sqlV4,/business_schedule','phone_house'/);
assert.match(sqlV4,/Línea con datos ilimitados/);
assert.match(sqlV4,/900 759 004/);
assert.match(source,/step="1"/);
assert.match(source,/Enviar también este mensaje al cliente/);
assert.match(source,/Fecha de tramitación/);
assert.match(source,/crm_create_direct_sale/);
assert.match(source,/waSideDirectSale/);
assert.match(source,/Venta directa/);
assert.match(source,/50 € de regalo para gastar en tienda/);
assert.match(source,/Abono de permanencia/);
assert.match(source,/completeExtraText\(\)/);
assert.match(source,/offerMode='followup'/);
assert.match(source,/setOfferMode\(offerMode\)/);
assert.match(source,/Crear y enviar oferta/);
assert.match(source,/Programar envío/);
assert.match(source,/id="opScheduleToggle" type="checkbox"/);
assert.match(source,/class="opDateTimeCombined"/,'date and time share one visual control');
assert.match(source,/id="opScheduleMinute"[\s\S]*option value="00"[\s\S]*option value="30"/,'minutes only expose 00 and 30');
assert.doesNotMatch(source,/type="datetime-local"|id="opScheduleTime"|name="opSendTiming"/,'the browser minute picker and large timing cards are removed');
assert.match(source,/id="opAcceptedMode" type="checkbox" name="opMode" value="accepted"/,'accepted mode uses a compact checkbox');
assert.match(source,/class="opAcceptedCheck"/,'the accepted-message option uses the same compact check treatment');
assert.match(source,/Los seguimientos de 2 y 5 días contarán desde el envío real/);
assert.match(source,/p_send_at:sendAt/);
assert.match(source,/event\.target\?\.closest\?\.\('#opSubmit'\)/);

const sqlV5=fs.readFileSync(path.join(root,'db/proposals/offer-configurator-v5-safety.sql'),'utf8');
assert.match(sqlV5,/security invoker\s+set search_path=''/);
assert.match(sqlV5,/right\(regexp_replace\(coalesce\(normalized_phone,''\),'\\\\D','','g'\),9\)<>'695661409'/);
assert.match(sqlV5,/crm_create_offer_execution_v3/);
assert.match(sqlV5,/crm_server_automation_jobs/);
assert.match(sqlV5,/raise exception 'Protección CRM: no se creó el trabajo del WhatsApp inicial/);
assert.match(sqlV5,/'safety_verified',true/);
assert.match(sqlV5,/revoke all on function public\.crm_create_offer_execution_v4/);
const greenApi=fs.readFileSync(path.join(root,'api/green.js'),'utf8');
const greenReply=fs.readFileSync(path.join(root,'api/green-reply.js'),'utf8');
assert.match(greenApi,/VERCEL_GIT_COMMIT_REF/);
assert.match(greenApi,/GREEN_TEST_PHONE = "695661409"/);
assert.match(greenApi,/action === "send"[\s\S]*GREEN_PROTECTED_TEST_BRANCH/);
assert.match(greenApi,/action === "sendfile"[\s\S]*GREEN_PROTECTED_TEST_BRANCH/);
assert.match(greenReply,/VERCEL_GIT_COMMIT_REF/);
assert.match(greenReply,/695661409/);

const directSaleSql=fs.readFileSync(path.join(root,'db/proposals/direct-sale.sql'),'utf8');
assert.match(directSaleSql,/security definer\s+set search_path=''/);
assert.match(directSaleSql,/current_user_can\('can_edit_sales'\)/);
assert.match(directSaleSql,/'CAMBIO '\|\|upper\(operator_name\)/);
assert.match(directSaleSql,/lower\(btrim\(name\)\)='tramitado'/);
assert.match(directSaleSql,/offer_record_sale\(inst,now\(\)\)/);
assert.match(directSaleSql,/enqueue_opportunity_stage\(opp_id\)/);
assert.match(directSaleSql,/direct-sale:/);
assert.match(directSaleSql,/revoke all on function public\.crm_create_direct_sale/);

const sqlMasMovil=fs.readFileSync(path.join(root,'db/proposals/offer-configurator-masmovil.sql'),'utf8');
for(const value of ["34.90::numeric,50","39.90::numeric,100","46.90::numeric,200","'Fibra 1 Gb',null,10","'TV',null,6","'Netflix',null,8.99","'Amazon',null,4","'Disney+',null,6.99","'Línea móvil 25 GB',25,5","'Línea móvil 45 GB',45,10","'Línea móvil 100 GB',100,12","'Descuento 10 €',null,-10","'Descuento 15 €',null,-15","'Descuento 17 €',null,-17"])assert.ok(sqlMasMovil.includes(value),`expected MásMóvil catalog value: ${value}`);
assert.match(sqlMasMovil,/lower\(coalesce\(opt\.group_name,''\)\)='shared_gb'/);
assert.match(sqlMasMovil,/shared_base_gb\+shared_added_gb/);
assert.match(sqlMasMovil,/lower\(coalesce\(opt\.group_name,''\)\)='discount'/);
assert.match(sqlMasMovil,/No crea envíos ni trabajos retroactivos/);

const runner=fs.readFileSync(path.join(root,'supabase/functions/crm-automation-runner/index.ts'),'utf8');
assert.match(runner,/replaceAll\("\{oferta_mensaje\}"/);
assert.match(runner,/replaceAll\("\{operador\}"/);
assert.match(runner,/replaceAll\("\{precio_total\}"/);
assert.match(runner,/action=\$\{interactive\?"sendbuttons":"send"\}/);
assert.match(runner,/providerResponsesSince/);
assert.match(runner,/count:200/);
const replyButtonsSql=fs.readFileSync(path.join(root,'supabase/migrations/20260909120000_offer_reply_buttons.sql'),'utf8');
assert.match(replyButtonsSql,/crm_create_offer_execution_v6/);
for(const label of ['No me interesa','Acepto','Quiero mirar otra cosa'])assert.ok(replyButtonsSql.includes(label),`missing reply button: ${label}`);
assert.match(replyButtonsSql,/\{steps,0,config,reply_buttons\}/);
assert.match(source,/crm_create_offer_execution_v7/);
assert.match(source,/reply_buttons_configured/);
const scheduledOfferSql=fs.readFileSync(path.join(root,'supabase/migrations/20260909180000_schedule_first_offer_whatsapp.sql'),'utf8');
assert.match(scheduledOfferSql,/crm_create_offer_execution_v7/);
assert.match(scheduledOfferSql,/p_send_at timestamptz/);
assert.match(scheduledOfferSql,/set run_at=requested_at/);
assert.match(scheduledOfferSql,/jsonb_set\(j\.context,'\{event_at\}',to_jsonb\(requested_at\),true\)/);
assert.match(scheduledOfferSql,/scheduled_send_at/);
assert.match(scheduledOfferSql,/interval '90 days'/);
const counterNetflixSql=fs.readFileSync(path.join(root,'supabase/migrations/20260909123000_vodafone_counteroffer_netflix_7.sql'),'utf8');
assert.match(counterNetflixSql,/offer\.name='VDF · CONTRAOFERTA 1 GB \+ 2 ILIMITADAS'/);
assert.match(counterNetflixSql,/offer\.is_counteroffer=true/);
assert.match(counterNetflixSql,/line\.name='Netflix'/);
assert.match(counterNetflixSql,/set price_delta=7/);
assert.doesNotMatch(counterNetflixSql,/VDF · ESTÁNDAR/);
assert.match(source,/\$\('opSubmit'\)\.onclick=\(\)=>submitOffer\(false\)/);
assert.doesNotMatch(source,/\$\('opSubmit'\)\.onclick=submitOffer/);
console.log('PASS: dynamic offer pricing, message composition, safe catalog, lifecycle and operator routing.');
