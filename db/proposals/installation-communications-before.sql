CREATE OR REPLACE FUNCTION crm_private.router_return_preferences(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare send boolean;scheduled timestamptz;
begin
 if p is null then return null;end if;
 if jsonb_typeof(p)<>'object' then raise exception 'Configuración de devolución no válida';end if;
 if coalesce(p->>'send','') not in ('true','false') then raise exception 'Indica si se envía el mensaje';end if;
 send:=(p->>'send')::boolean;
 if jsonb_typeof(p->'previous_operator') is distinct from 'string'
    or length(btrim(coalesce(p->>'previous_operator','')))=0
    or length(p->>'previous_operator')>80
    or p->>'previous_operator' ~ '[[:cntrl:]]'
    or p->>'previous_operator' in ('__proto__','prototype','constructor')
 then raise exception 'Selecciona el operador anterior';end if;
 if send and (length(btrim(coalesce(p->>'text','')))=0 or length(p->>'text')>10000) then raise exception 'El mensaje debe tener entre 1 y 10000 caracteres';end if;
 if send and nullif(p->>'rule_id','') is null then raise exception 'No hay mensaje del día siguiente configurado';end if;
 if send and nullif(p->>'send_at','') is not null then
   scheduled:=(p->>'send_at')::timestamptz;
   if scheduled<=now()+interval '1 minute' then raise exception 'Elige una fecha y hora futuras';end if;
 end if;
 return jsonb_build_object('previous_operator',p->>'previous_operator','text',coalesce(p->>'text',''),'send',send,'send_at',case when send then scheduled end,'operator',coalesce(p->>'operator',''),'rule_id',p->>'rule_id');
end $function$;

CREATE OR REPLACE FUNCTION crm_private.enqueue_opportunity_stage(p_opportunity_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  opp public.sales_opportunities%rowtype;inst public.crm_offer_instances%rowtype;r public.crm_automations%rowtype;
  ctx jsonb;wanted text;required_flag text;made integer:=0;netflix_followup boolean:=false;variant_template text;prefs jsonb;day_rule boolean;new_operator text;
begin
  if not public.crm_server_automations_enabled() then return 0;end if;
  select * into opp from public.sales_opportunities where id=p_opportunity_id;if not found then return 0;end if;
  select * into inst from public.crm_offer_instances where opportunity_id=opp.id order by created_at desc limit 1;
  if inst.id is null and current_setting('crm.router_return_defer',true)='true' then return 0;end if;
  if found then netflix_followup:=crm_private.offer_netflix_visible(inst.snapshot);end if;
  prefs:=opp.after_sale_preferences;
  new_operator:=coalesce(nullif(inst.operator,''),nullif(prefs->>'operator',''),'');
  ctx:=public.crm_server_context_for_contact(opp.record_id,opp.phone)||jsonb_build_object(
    'opportunity_id',opp.id,'stage_id',opp.stage_id,'name',coalesce(opp.client_name,''),
    'phone',public.crm_server_normalize_phone(opp.phone),'operator',new_operator,
    'offer_instance_id',inst.id,'netflix_followup',netflix_followup,'event_at',now()
  );
  ctx:=crm_private.party_context(ctx,opp.contract_party);
  for r in select * from public.crm_automations where enabled and trigger_type='opportunity_stage' and coalesce(trigger_config->>'stage_id','')=coalesce(opp.stage_id::text,'') loop
    wanted:=coalesce(nullif(btrim(r.trigger_config->>'automation_operator'),''),nullif(btrim(r.trigger_config->>'operator'),''),'General');
    required_flag:=nullif(btrim(r.trigger_config->>'required_offer_flag'),'');
    if (wanted='General' or lower(wanted)=lower(new_operator))
       and (required_flag is null or lower(coalesce(ctx->>required_flag,'false'))='true') then
      day_rule:=coalesce(r.trigger_config->>'automation_code','') like '%_day_one';
      if prefs is not null and day_rule and prefs->>'send'='false' then continue;end if;
      if prefs is null and inst.snapshot->>'direct_sale'='true' and inst.snapshot->>'send_day_one'='false' and r.trigger_config->>'automation_code' like '%_day_one' then continue;end if;
      if r.trigger_config ? 'netflix_template_id' and r.trigger_config ? 'general_template_id' then
        variant_template:=case when netflix_followup then r.trigger_config->>'netflix_template_id' else r.trigger_config->>'general_template_id' end;
        r.action_config:=jsonb_set(r.action_config,'{steps,2,config,template_id}',to_jsonb(variant_template),true);
      end if;
      if prefs is null and inst.snapshot->>'direct_sale'='true' and inst.snapshot->>'day_one_rule_id'=r.id::text and nullif(inst.snapshot->>'day_one_text','') is not null then
        r.action_config:=jsonb_set(r.action_config,'{steps,2}',jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text',inst.snapshot->>'day_one_text')),false);
      end if;
      if prefs is not null and day_rule and prefs->>'send'='true' then
        if prefs->>'rule_id' is distinct from r.id::text then raise exception 'La regla del día siguiente cambió. Vuelve a abrir Tramitado';end if;
        r.action_config:=jsonb_set(r.action_config,'{steps,2}',jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text',prefs->>'text','offer_phase','router_return')),false);
        if nullif(prefs->>'send_at','') is not null then
          r.action_config:=jsonb_set(r.action_config,'{steps,1}',jsonb_build_object('kind','wait','unit','minutes','value',greatest(0,extract(epoch from ((prefs->>'send_at')::timestamptz-now()))/60)),false);
        end if;
      end if;
      perform public.crm_server_enqueue(r,'oppstage:'||opp.id::text||':'||coalesce(opp.stage_id::text,''),ctx);made:=made+1;
    end if;
  end loop;
  return made;
end $function$;

CREATE OR REPLACE FUNCTION public.crm_lifecycle_job_guard(p_job uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  j public.crm_server_automation_jobs%rowtype;p jsonb;cid uuid;oid uuid;offer_id uuid;
  reason text;prev public.crm_server_automation_jobs%rowtype;ph text;
begin
  select * into j from public.crm_server_automation_jobs where id=p_job;
  if not found or j.status<>'running' then return jsonb_build_object('allow',false,'reason','Ejecución detenida');end if;
  if nullif(j.context->>'review_id','') is not null then
    -- Receipt verification is read-only and continues after the review is completed.
    if j.action_config ? '__delivery_receipt' then return jsonb_build_object('allow',true,'context',j.context);end if;
    if not exists(select 1 from public.crm_monthly_reviews r join public.sales_opportunities o on o.id=r.opportunity_id where r.id::text=j.context->>'review_id' and r.job_id=j.id and r.status='active' and r.send_enabled and not r.needs_confirmation and o.status='open') then reason:='Revisión cancelada o completada';
    elsif exists(select 1 from crm_private.commercial_optouts where phone=public.crm_server_normalize_phone(j.context->>'phone') or contact_id::text=j.context->>'contact_id' or contact_id::text=j.context->>'recipient_contact_id') then reason:='Baja comercial solicitada';
    elsif not exists(select 1 from public.records where id::text=coalesce(j.context->>'recipient_contact_id',j.context->>'contact_id')) then reason:='Destinatario no disponible';
    elsif not exists(select 1 from public.crm_automations where id=j.automation_id and enabled) then reason:='Automatización pausada';end if;
    if reason is not null then update public.crm_server_automation_jobs set status='cancelled',error_message=reason,updated_at=now() where id=j.id;return jsonb_build_object('allow',false,'reason',reason);end if;
    return jsonb_build_object('allow',true,'context',j.context);
  end if;
  p:=j.context->'lifecycle';
  if coalesce(p->>'mode','') not in ('offer','after_sale') then return jsonb_build_object('allow',true,'context',j.context);end if;
  cid:=nullif(j.context->>'contact_id','')::uuid;
  oid:=nullif(j.context->>'opportunity_id','')::uuid;
  offer_id:=nullif(j.context->>'offer_instance_id','')::uuid;
  ph:=public.crm_server_normalize_phone(j.context->>'phone');
  if j.action_type in ('record_offer_month','record_sale_month') then
    if cid is null or oid is null or not exists(select 1 from public.sales_opportunities where id=oid and record_id=cid) then reason:='Oportunidad no disponible';end if;
  elsif not public.crm_server_automations_enabled() then reason:='Motor pausado';
  elsif not exists(select 1 from public.crm_automations where id=j.automation_id and enabled) then reason:='Automatización pausada';
  elsif cid is null or not exists(select 1 from public.records where id=cid) then reason:='Contacto no disponible';
  elsif exists(select 1 from public.crm_automation_contact_exclusions where automation_id=j.automation_id and contact_id=cid) then reason:='Contacto excluido';
  elsif exists(select 1 from crm_private.commercial_optouts where phone=ph or contact_id=cid) then reason:='Baja comercial solicitada';
  elsif p->>'mode'='offer' then
    if nullif(p->>'label_id','') is not null and not exists(select 1 from public.crm_contact_labels where contact_id=cid and label_id::text=p->>'label_id') then reason:='Etiqueta de seguimiento retirada';
    elsif exists(select 1 from public.sales_opportunities o where o.record_id=cid and (oid is null or o.id=oid) and coalesce(p->'stop_stage_ids','[]'::jsonb) ? o.stage_id::text) then reason:='Oferta pasa a tramitación';
    elsif offer_id is not null and exists(select 1 from public.crm_offer_response_states where offer_instance_id=offer_id) then reason:='Cliente eligió una respuesta de la oferta';
    end if;
  elsif p->>'mode'='after_sale' then
    if oid is null or not exists(select 1 from public.sales_opportunities where id=oid and record_id=cid and (stage_id::text=p->>'stage_id' or stage_id in (select id from public.sales_stages where lower(btrim(name))='ganado'))) then reason:='Oportunidad fuera de Tramitado';end if;
  end if;
  if reason is not null then
    update public.crm_server_automation_jobs set status='cancelled',error_message=reason,updated_at=now()
      where id=j.id and status in ('pending','running');
    return jsonb_build_object('allow',false,'reason',reason);
  end if;
  if nullif(j.action_config->>'__previous_event','') is not null then
    select * into prev from public.crm_server_automation_jobs where automation_id=j.automation_id and event_key=j.action_config->>'__previous_event';
    if not found or prev.status in ('pending','running') then return jsonb_build_object('allow',false,'retry',true,'reason','Esperando el paso anterior');end if;
    if prev.status<>'done' or exists(select 1 from public.crm_automation_runs where automation_id=prev.automation_id and event_key=prev.event_key and context->>'skipped'='true') then
      update public.crm_server_automation_jobs set status='cancelled',error_message='Paso anterior no completado',updated_at=now() where id=j.id and status='running';
      return jsonb_build_object('allow',false,'reason','Paso anterior no completado');
    end if;
  end if;
  return jsonb_build_object('allow',true,'context',j.context);
end $function$;
-- Original direct-sale wrapper, retained for release rollback.
CREATE OR REPLACE FUNCTION public.crm_create_direct_sale_v8(p_contact_id uuid, p_operator text, p_total_price numeric, p_send_message boolean, p_netflix_followup boolean, p_counteroffer boolean, p_manager_contact_id uuid, p_recipient_contact_id uuid, p_day_one_text text DEFAULT NULL::text, p_send_day_one boolean DEFAULT true, p_sale_month text DEFAULT NULL::text, p_after_sale jsonb DEFAULT NULL::jsonb)
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
 result:=public.crm_create_direct_sale_v7(p_contact_id,p_operator,p_total_price,p_send_message,p_netflix_followup,p_counteroffer,p_manager_contact_id,p_recipient_contact_id,p_day_one_text,p_send_day_one,p_sale_month);
 perform set_config('crm.router_return',coalesce(previous,''),true);
 perform set_config('crm.router_return_defer',coalesce(previous_defer,''),true);
 return result;
exception when others then
 perform set_config('crm.router_return',coalesce(previous,''),true);
 perform set_config('crm.router_return_defer',coalesce(previous_defer,''),true);
 raise;
end $function$;
