create or replace function crm_private.operator_message(p_operator text,p_kind text) returns text language sql stable security definer set search_path='' as $fn$
select coalesce((select value->>'body' from public.app_settings where key='crm_operator_message:'||lower(btrim(p_operator))||':'||p_kind),case p_kind
when 'offer_initial' then 'Hola {nombre}, te envío la oferta de {operador} que hemos comentado:
{servicios}
Precio final: {precio_total} €/mes'
when 'offer_reminder_2' then 'Hola {nombre}, ¿has podido revisar la oferta de {operador} por {precio_total} €/mes? Si tienes alguna duda, te ayudo por aquí.'
when 'offer_reminder_5' then 'Hola, {nombre}. Vuelvo a escribirte sobre la oferta de {operador}, por si quieres que la revisemos juntos o prefieres dejarla para más adelante. Dime qué te viene mejor.'
when 'offer_group_reminder' then 'Hola {nombre}, ¿has podido revisar las ofertas que te enviamos? Si tienes alguna duda, te ayudo por aquí.'
when 'annual_review' then 'Hola {nombre} 👋 Soy {responsable}, de Phone House Albolote.

El próximo {fecha_revision} cumples un año con {operador}. Nos gustaría revisar tu tarifa contigo para comprobar si el precio va a subir al cumplir el año y ver si podemos mejorarlo.

¿Te viene bien que lo veamos? 😊'
when 'manual_review' then 'Hola {nombre} 👋 Soy {responsable}, de Phone House Albolote.

El próximo {fecha_revision} termina el descuento de tu tarifa de {operador}. Nos gustaría revisarla contigo antes de esa fecha y ver si podemos mejorar el precio.

¿Te viene bien que lo veamos? 😊'
end);
$fn$;
revoke all on function crm_private.operator_message(text,text) from public,anon,authenticated;
grant execute on function crm_private.operator_message(text,text) to authenticated,service_role;

create or replace function public.crm_operator_message_defaults() returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare result jsonb:='{}';op text;kind text;cfg jsonb;
begin
if auth.uid() is null then raise exception 'Authentication required';end if;
for op in select distinct operator from public.crm_offer_catalog union select distinct trigger_config->>'automation_operator' from public.crm_automations where trigger_config->>'automation_operator' is not null loop
cfg:='{}';foreach kind in array array['offer_initial','offer_reminder_2','offer_reminder_5','offer_group_reminder','annual_review','manual_review'] loop cfg:=cfg||jsonb_build_object(kind,crm_private.operator_message(op,kind));end loop;
result:=result||jsonb_build_object(op,cfg);
end loop;
return result;
end $fn$;
revoke all on function public.crm_operator_message_defaults() from public,anon;
grant execute on function public.crm_operator_message_defaults() to authenticated;
CREATE OR REPLACE FUNCTION public.crm_operator_communication_templates(p_operator text)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_view_settings') or public.current_user_can('can_view_sales')) then raise exception 'No tienes permiso';end if;
 return query select jsonb_build_object('rule_id',null,'rule_name','Textos generales de '||p_operator,'template_id','communication:'||k||':'||p_operator,'template_name',n,'body',crm_private.operator_message(p_operator,k),'enabled',true,'automation_code',k,'section',case when k like 'offer_%' then 'offers' else 'others' end,'schedule',case when k like 'offer_%' then 'Se aplica a las nuevas ofertas y seguimientos. Se mantienen las fechas y condiciones.' else 'Se aplica a las nuevas revisiones. Las revisiones ya preparadas conservan su texto y pueden editarse individualmente.' end) from (values ('offer_initial','Oferta inicial'),('offer_reminder_2','Recordatorio de oferta · 2 días'),('offer_reminder_5','Recordatorio de oferta · 5 días'),('offer_group_reminder','Recordatorio de ofertas agrupadas'),('annual_review','Revisión anual / 11 meses'),('manual_review','Revisión manual · Fin del descuento')) v(k,n);
 return query select distinct jsonb_build_object('rule_id',a.id,'rule_name',a.name,'template_id',t.id,'template_name',t.name,'body',t.body,'enabled',a.enabled,'trigger_type',a.trigger_type,'automation_code',a.trigger_config->>'automation_code','legacy',coalesce(a.trigger_config->>'automation_code','') like '%_day_one','stage_name',st.name,'label_name',lb.name,
 'schedule',case when a.trigger_config->>'automation_code' like '%_day_one' then 'Día siguiente a la tramitación, en horario comercial. Solo ventas anteriores al nuevo seguimiento de instalación.' when a.trigger_config->>'automation_code' like '%_security_3_months' then '3 meses después de pasar a '||coalesce(st.name,'la etapa configurada')||', en horario comercial.' when a.trigger_type='label_assigned' then 'Cuando se añade la etiqueta '||coalesce(lb.name,'configurada')||'. Se mantienen las esperas y condiciones de la regla.' else 'Regla existente: se mantienen sus fechas, etiquetas y condiciones.' end)
 from public.crm_automations a join public.wa_templates t on t.user_id=a.user_id and (exists(select 1 from jsonb_array_elements(coalesce(a.action_config->'steps','[]'::jsonb)) s where s#>>'{config,template_id}'=t.id::text) or t.id::text in (a.trigger_config->>'general_template_id',a.trigger_config->>'netflix_template_id'))
 left join public.sales_stages st on st.id::text=a.trigger_config->>'stage_id'
 left join public.crm_labels lb on lb.id::text=a.trigger_config->>'label_id'
 where lower(coalesce(a.trigger_config->>'automation_operator',a.trigger_config->>'operator',''))=lower(p_operator);
end;$function$;

CREATE OR REPLACE FUNCTION public.crm_operator_communication_save(p_rule_id uuid, p_template_id text, p_expected_body text, p_body text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.crm_automations%rowtype;n integer;k text;op text;kind text;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_manage_templates')) then raise exception 'No tienes permiso para editar plantillas';end if;
 if length(btrim(p_body)) not between 1 and 10000 then raise exception 'Escribe un texto entre 1 y 10000 caracteres';end if;
 if p_template_id like 'communication:%' then
kind:=split_part(p_template_id,':',2);op:=btrim(substring(p_template_id from length('communication:'||kind||':')+1));
if kind not in ('offer_initial','offer_reminder_2','offer_reminder_5','offer_group_reminder','annual_review','manual_review') or coalesce(op,'')='' or length(op)>80 or op ~ '[[:cntrl:]]' then raise exception 'Texto no válido';end if;
if kind='offer_initial' and (position('{servicios}' in p_body)=0 or position('{precio_total}' in p_body)=0) then raise exception 'Conserva {servicios} y {precio_total} para incluir los servicios y el precio';end if;
k:='crm_operator_message:'||lower(op)||':'||kind;
perform pg_advisory_xact_lock(hashtextextended(k,9014));
if crm_private.operator_message(op,kind) is distinct from p_expected_body then raise exception 'El texto cambió en otro dispositivo. Recarga antes de guardar';end if;
insert into public.app_settings(key,value,updated_at) values(k,jsonb_build_object('operator',op,'kind',kind,'body',btrim(p_body)),clock_timestamp()) on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
return;
end if;
 select * into a from public.crm_automations where id=p_rule_id;
 if not found or not (exists(select 1 from jsonb_array_elements(coalesce(a.action_config->'steps','[]'::jsonb)) s where s#>>'{config,template_id}'=p_template_id) or p_template_id in (a.trigger_config->>'general_template_id',a.trigger_config->>'netflix_template_id')) then raise exception 'La plantilla ya no pertenece a esta regla';end if;
 update public.wa_templates set body=btrim(p_body),updated_at=clock_timestamp() where id::text=p_template_id and user_id=a.user_id and body is not distinct from p_expected_body;
 get diagnostics n=row_count;if n<>1 then raise exception 'El texto cambió en otro dispositivo. Recarga antes de guardar';end if;
end;$function$;

CREATE OR REPLACE FUNCTION crm_private.review_message(p_name text, p_actor text, p_operator text, p_date date, p_kind text, p_party jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE months text[]:=ARRAY['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];body text;date_label text;
BEGIN
 date_label:=extract(day FROM p_date)::int||' de '||months[extract(month FROM p_date)::int];
 body:=crm_private.operator_message(p_operator,case when p_kind='activation' then 'annual_review' else 'manual_review' end);
 body:=replace(replace(replace(replace(body,'{nombre}',coalesce(p_name,'')),'{responsable}',coalesce(p_actor,'')),'{operador}',p_operator),'{fecha_revision}',date_label);
 RETURN crm_private.contract_message(body,p_party);
END $function$;

CREATE OR REPLACE FUNCTION public.crm_create_offer_execution_v13(p_contact_id uuid, p_catalog_offer_id uuid, p_request_key uuid, p_selections jsonb DEFAULT '[]'::jsonb, p_extra_text text DEFAULT NULL::text, p_mode text DEFAULT 'followup'::text, p_final_price numeric DEFAULT NULL::numeric, p_send_message boolean DEFAULT false, p_processing_date date DEFAULT NULL::date, p_test_mode boolean DEFAULT false, p_allow_duplicate boolean DEFAULT false, p_send_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_welcome boolean DEFAULT false, p_recipient_contact_id uuid DEFAULT NULL::uuid, p_manager_contact_id uuid DEFAULT NULL::uuid, p_message_text text DEFAULT NULL::text, p_after_sale jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare previous text;previous_defer text;result jsonb;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para editar ventas';end if;
 previous:=current_setting('crm.router_return',true);previous_defer:=current_setting('crm.router_return_defer',true);
 perform set_config('crm.router_return_defer',case when p_after_sale is null then '' else 'true' end,true);
 perform set_config('crm.router_return',coalesce(crm_private.router_return_preferences(p_after_sale)::text,''),true);
 result:=public.crm_create_offer_execution_v12(p_contact_id,p_catalog_offer_id,p_request_key,p_selections,p_extra_text,p_mode,p_final_price,p_send_message,p_processing_date,p_test_mode,p_allow_duplicate,p_send_at,p_welcome,p_recipient_contact_id,p_manager_contact_id,p_message_text);
 perform set_config('crm.router_return',coalesce(previous,''),true);
 perform set_config('crm.router_return_defer',coalesce(previous_defer,''),true);
 if not coalesce((result->>'idempotent_replay')::boolean,false) then
 update public.crm_server_automation_jobs j set action_config=jsonb_set(j.action_config,'{steps}',(select jsonb_agg(case when value#>>'{config,offer_phase}' in ('reminder_2','reminder_5') then jsonb_set(value,'{config,text}',to_jsonb(crm_private.operator_message((select operator from public.crm_offer_instances where id=(result->>'offer_id')::uuid),'offer_'||(value#>>'{config,offer_phase}'))),true) else value end order by ord) from jsonb_array_elements(j.action_config->'steps') with ordinality s(value,ord)),true)
 where j.user_id=auth.uid() and j.context->>'offer_instance_id'=result->>'offer_id' and j.status='pending' and j.action_type='flow_v1';
 end if;
 return result;
exception when others then
 perform set_config('crm.router_return',coalesce(previous,''),true);
 perform set_config('crm.router_return_defer',coalesce(previous_defer,''),true);
 raise;
end $function$;

CREATE OR REPLACE FUNCTION public.crm_control_offer(p_offer_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid:=auth.uid();inst public.crm_offer_instances%rowtype;opp public.sales_opportunities%rowtype;
  stage public.sales_stages%rowtype;rule public.crm_automations%rowtype;flow jsonb;ctx jsonb;
  reply_buttons jsonb:=jsonb_build_array(
    jsonb_build_object('buttonId','offer_accept','buttonText','Me interesa'),
    jsonb_build_object('buttonId','offer_decline','buttonText','No me interesa'),
    jsonb_build_object('buttonId','offer_other','buttonText','Quiero otra oferta')
  );
begin
  if uid is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para modificar ofertas';end if;
  select * into inst from public.crm_offer_instances where id=p_offer_id;if not found then raise exception 'Oferta no encontrada';end if;
  select * into opp from public.sales_opportunities where id=inst.opportunity_id;if not found then raise exception 'Oportunidad no encontrada';end if;
  if p_action='pause' then
    update public.crm_server_automation_jobs set status='cancelled',error_message='Seguimiento pausado manualmente',updated_at=now()
      where status in ('pending','running') and context->>'offer_instance_id'=inst.id::text;
    update public.crm_offer_instances set status='paused' where id=inst.id;
  elsif p_action='accept' then
    select * into stage from public.sales_stages where active and pipeline_id=opp.pipeline_id and lower(btrim(name))='pendiente de tramitar' order by position limit 1;
    if stage.id is null then raise exception 'Falta la columna Pendiente de tramitar';end if;
    update public.crm_offer_instances set status='accepted',accepted_at=coalesce(accepted_at,now()) where id=inst.id;
    update public.sales_opportunities set stage_id=stage.id,updated_at=now() where id=opp.id;
  elsif p_action='cancel' then
    update public.crm_server_automation_jobs set status='cancelled',error_message='Seguimiento finalizado manualmente',updated_at=now()
      where status in ('pending','running') and context->>'offer_instance_id'=inst.id::text;
    update public.crm_offer_instances set status='cancelled' where id=inst.id;
  elsif p_action='resume' then
    select * into rule from public.crm_automations where user_id=uid and trigger_type='manual_offer' and enabled order by created_at limit 1;
    if not found then raise exception 'La automatización general de ofertas no está activa';end if;
    select * into stage from public.sales_stages where active and pipeline_id=opp.pipeline_id and lower(btrim(name))='tramitado' order by position limit 1;
    flow:=jsonb_build_object('version',1,'lifecycle',jsonb_build_object('mode','offer','version',2,'stop_stage_ids',jsonb_build_array(
      (select id::text from public.sales_stages where active and pipeline_id=opp.pipeline_id and lower(btrim(name))='pendiente de tramitar' order by position limit 1),stage.id::text)),'steps',jsonb_build_array(
      jsonb_build_object('kind','wait','unit','days','business_schedule','phone_house','value',2),jsonb_build_object('kind','condition','condition_type','no_response'),
      jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object(
        'text',crm_private.operator_message(inst.operator,'offer_reminder_2'),
        'offer_phase','reminder_2','reply_buttons',reply_buttons)),
      jsonb_build_object('kind','wait','unit','days','business_schedule','phone_house','value',3),jsonb_build_object('kind','condition','condition_type','no_response'),
      jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object(
        'text',crm_private.operator_message(inst.operator,'offer_reminder_5'),
        'offer_phase','reminder_5','reply_buttons',reply_buttons))));
    rule.action_config:=flow;
    ctx:=public.crm_server_context_for_contact(inst.contact_id,opp.phone)||jsonb_build_object(
      'opportunity_id',opp.id,'offer_instance_id',inst.id,'operator',inst.operator,
      'precio_total',to_char(inst.total_price,'FM999999990D00'),'trigger_type','manual_offer','event_at',((now() at time zone 'Europe/Madrid')::date+coalesce((inst.sent_at at time zone 'Europe/Madrid')::time,'10:00'::time)) at time zone 'Europe/Madrid');
    perform public.crm_server_enqueue(rule,'manual-offer-resume:'||inst.id||':'||extract(epoch from now())::bigint,ctx);
    update public.crm_offer_instances set status='following' where id=inst.id;
  else raise exception 'Acción no válida';end if;
  return jsonb_build_object('ok',true,'action',p_action,'offer_id',inst.id);
end $function$;

CREATE OR REPLACE FUNCTION public.crm_control_offer_composition(p_offer_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare inst public.crm_offer_instances%rowtype; leader public.crm_offer_instances%rowtype; ids uuid[]; r jsonb; old_context jsonb; resumed_id uuid;
begin
 select * into inst from public.crm_offer_instances where id=p_offer_id;
 if not found then raise exception 'Oferta no encontrada';end if;
 if inst.snapshot->>'composition' is distinct from 'group' then return public.crm_control_offer(p_offer_id,p_action);end if;
 if inst.created_by<>auth.uid() or not(public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para modificar este grupo';end if;
 select * into leader from public.crm_offer_instances where id=(inst.snapshot->>'group_leader_offer_id')::uuid and created_by=auth.uid();
 if not found or not(leader.snapshot->'offer_group_ids' ? inst.id::text) then raise exception 'Grupo de ofertas inválido';end if;
 select array_agg(id) into ids from public.crm_offer_instances where created_by=auth.uid() and snapshot->>'group_leader_offer_id'=leader.id::text;
 perform pg_advisory_xact_lock(hashtextextended(leader.id::text,0));
 if p_action='accept' then
  r:=public.crm_control_offer(p_offer_id,p_action);
  update public.crm_server_automation_jobs set status='cancelled',error_message='Cliente respondió: servicio aceptado; revisar el resto del grupo',updated_at=now() where user_id=auth.uid() and context->>'offer_instance_id'=leader.id::text and status in ('pending','running');
   update public.crm_offer_instances set status='paused' where id=any(ids) and status in ('queued','following');
 elsif p_action in ('pause','cancel') then
  r:=public.crm_control_offer(leader.id,p_action);
  update public.crm_offer_instances set status=case when p_action='pause' then 'paused' else 'cancelled' end where id=any(ids) and status in ('queued','following','paused','error');
 elsif p_action='resume' then
  if leader.status not in ('paused','following','queued') or exists(select 1 from public.crm_offer_instances where id=any(ids) and status in ('accepted','processed','won')) then raise exception 'Este grupo ya tiene un servicio aceptado. Prepara otro seguimiento para los servicios pendientes';end if;
  select context into old_context from public.crm_server_automation_jobs where user_id=auth.uid() and context->>'offer_instance_id'=leader.id::text and event_key='manual-offer:'||leader.id order by created_at limit 1;
  r:=public.crm_control_offer(leader.id,p_action);
  select id into resumed_id from public.crm_server_automation_jobs where user_id=auth.uid() and context->>'offer_instance_id'=leader.id::text and event_key like 'manual-offer-resume:%' order by created_at desc limit 1;
  update public.crm_server_automation_jobs j set context=coalesce(old_context,j.context)||jsonb_build_object('offer_group_ids',to_jsonb(ids),'event_at',((now() at time zone 'Europe/Madrid')::date+coalesce((leader.sent_at at time zone 'Europe/Madrid')::time,'10:00'::time)) at time zone 'Europe/Madrid'),
  action_config=jsonb_set(action_config,'{steps}',(select jsonb_agg(case when value->>'kind'='action' then jsonb_set(value,'{config}',(value->'config')-'reply_buttons'||jsonb_build_object('text',crm_private.operator_message(leader.operator,'offer_group_reminder')),true) else value end order by ord) from jsonb_array_elements(action_config->'steps') with ordinality a(value,ord)),true) where j.id=resumed_id;
  update public.crm_offer_instances set status='following' where id=any(ids) and status='paused';
 else raise exception 'Acción no válida';end if;
 return r||jsonb_build_object('shared_followup',true);
end $function$;

CREATE OR REPLACE FUNCTION public.crm_create_offer_composition(p_contact_id uuid, p_manager_contact_id uuid, p_recipient_contact_id uuid, p_request_key uuid, p_items jsonb, p_composition text DEFAULT 'single'::text, p_group_message text DEFAULT NULL::text, p_mode text DEFAULT 'followup'::text, p_send_message boolean DEFAULT false, p_processing_date date DEFAULT NULL::date, p_test_mode boolean DEFAULT false, p_allow_duplicate boolean DEFAULT false, p_send_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_welcome boolean DEFAULT false, p_after_sale jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid(); item jsonb; result jsonb; results jsonb:='[]'; ids uuid[]:='{}'; first_id uuid; offer_id uuid; opp_id uuid; prior public.crm_offer_instances%rowtype; count_items int; idx int:=0; digest text; op text; first_op text; message text; expected_jobs int; changed_jobs int; prefs jsonb;
begin
 if uid is null or not(public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para crear ofertas';end if;
 if p_request_key is null then raise exception 'Falta la clave de la operación';end if;
 if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Las ofertas deben ser una lista';end if;
 count_items:=jsonb_array_length(p_items);
 if count_items<1 or count_items>5 or p_composition not in ('single','group','separate') or (p_composition='single' and count_items<>1) or (p_composition<>'single' and count_items<2) then raise exception 'Composición de ofertas inválida';end if;
 if p_composition='group' and (nullif(btrim(p_group_message),'') is null or length(p_group_message)>20000) then raise exception 'El mensaje agrupado debe contener entre 1 y 20000 caracteres';end if;
 digest:=md5(jsonb_build_object('items',p_items,'composition',p_composition,'group',p_group_message,'mode',p_mode,'send',p_send_message,'date',p_processing_date,'send_at',p_send_at,'recipient',p_recipient_contact_id,'manager',p_manager_contact_id,'contact',p_contact_id,'welcome',p_welcome,'after_sale',p_after_sale)::text);
 perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_key::text,0));
 select * into prior from public.crm_offer_instances where created_by=uid and request_key=p_request_key;
 if found then
  if prior.snapshot->>'composition_digest' is distinct from digest then raise exception 'Esta petición ya se guardó con otros datos. Actualiza antes de continuar';end if;
  return prior.snapshot->'composition_result'||jsonb_build_object('idempotent_replay',true);
 end if;
 -- Validate all items before creating any sale or job.
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item) is distinct from 'object' then raise exception 'Oferta inválida';end if;
  select operator into op from public.crm_offer_catalog where id=(item->>'catalog_offer_id')::uuid and active;
  if not found then raise exception 'La tarifa no está disponible';end if;
  if first_op is null then first_op:=op;end if;
  if p_composition='group' and op<>first_op then raise exception 'Los servicios agrupados deben ser de la misma compañía';end if;
  if coalesce((item->>'permanence_refund')::boolean,false) and coalesce((item->>'permanence_amount')::numeric,0)<=0 then raise exception 'Indica el importe del abono de permanencia';end if;
 end loop;
 for item in select value from jsonb_array_elements(p_items) loop
  message:=case when p_composition='group' then p_group_message else item->>'message_text' end;
  result:=public.crm_create_offer_execution_v13(p_contact_id,(item->>'catalog_offer_id')::uuid,
   case when idx=0 then p_request_key else md5(p_request_key::text||':'||idx)::uuid end,
   coalesce(item->'selections','[]'),item->>'extra_text',p_mode,(item->>'final_price')::numeric,p_send_message,
   p_processing_date,p_test_mode,p_allow_duplicate,p_send_at,p_welcome,p_recipient_contact_id,p_manager_contact_id,
   message,coalesce(nullif(item->'after_sale','null'::jsonb),p_after_sale));
  if not coalesce((result->>'safety_verified')::boolean,false) then raise exception 'No se pudo verificar la oferta';end if;
  offer_id:=(result->>'offer_id')::uuid;opp_id:=(result->>'opportunity_id')::uuid;
  if idx=0 then first_id:=offer_id;end if;ids:=array_append(ids,offer_id);results:=results||jsonb_build_array(result);idx:=idx+1;
  update public.crm_offer_instances set snapshot=coalesce(snapshot,'{}')||jsonb_build_object('composition',p_composition,'composition_request_key',p_request_key,'previous_operator',coalesce(item->>'previous_operator',''),'shop_gift',coalesce((item->>'shop_gift')::boolean,false),'permanence_refund',coalesce((item->>'permanence_refund')::boolean,false),'permanence_amount',coalesce((item->>'permanence_amount')::numeric,0),'permanence_visible',coalesce((item->>'permanence_visible')::boolean,true)) where id=offer_id and created_by=uid;
  -- Preserve the chosen previous operator for the later router-return dialog.
  if nullif(item->>'previous_operator','') is not null and coalesce(nullif(item->'after_sale','null'::jsonb),p_after_sale) is null then
   update public.sales_opportunities set after_sale_preferences=coalesce(after_sale_preferences,jsonb_build_object('send',false,'text','','operator',first_op,'rule_id',null))||jsonb_build_object('previous_operator',case when item->>'previous_operator' in ('Yoigo','MásMóvil','O2','Vodafone','Ninguno','Otro') then item->>'previous_operator' when item->>'previous_operator'='Sin compañía' then 'Ninguno' else 'Otro' end) where id=opp_id and owner_user_id=uid;
  end if;
 end loop;
 if p_composition='group' then
  expected_jobs:=case when p_mode='followup' or p_send_message then count_items-1 else 0 end;
  update public.crm_server_automation_jobs set status='cancelled',error_message='Envío agrupado: seguimiento compartido con '||first_id,updated_at=now()
   where user_id=uid and context->>'offer_instance_id'=any(array(select x::text from unnest(ids[2:]) x))
   and event_key in (select 'manual-offer:'||x from unnest(ids[2:]) x union all select 'manual-offer-accepted:'||x from unnest(ids[2:]) x)
   and action_type='flow_v1' and status='pending';
  get diagnostics changed_jobs=row_count;
  if changed_jobs<>expected_jobs then raise exception 'No se pudo verificar el envío agrupado; no se guardó nada';end if;
  update public.crm_server_automation_jobs set context=context||jsonb_build_object('offer_group_ids',to_jsonb(ids)),
   action_config=jsonb_set(coalesce(action_config,'{}'),'{steps}',coalesce((select jsonb_agg(case when jsonb_typeof(value->'config')='object' then jsonb_set(value,'{config}',(value->'config')-'reply_buttons'||case when value->'config'->>'offer_phase' in ('reminder_2','reminder_5') then jsonb_build_object('text',crm_private.operator_message(first_op,'offer_group_reminder')) else '{}'::jsonb end,true) else value end order by ord) from jsonb_array_elements(action_config->'steps') with ordinality a(value,ord)),'[]'::jsonb),true)
   where user_id=uid and context->>'offer_instance_id'=first_id::text and event_key in ('manual-offer:'||first_id,'manual-offer-accepted:'||first_id) and status='pending';
  update public.crm_offer_instances set snapshot=snapshot||jsonb_build_object('group_leader_offer_id',first_id,'offer_group_ids',to_jsonb(ids)) where id=any(ids) and created_by=uid;
 end if;
 result:=(results->0)||jsonb_build_object('offers',results,'composition',p_composition,'offer_count',count_items,'composition_verified',true,'idempotent_replay',false);
 update public.crm_offer_instances set snapshot=snapshot||jsonb_build_object('composition_digest',digest,'composition_result',result) where id=first_id and created_by=uid;
 return result;
end $function$;