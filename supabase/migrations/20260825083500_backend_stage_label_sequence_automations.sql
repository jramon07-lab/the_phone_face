-- Backend automations for label assignment, opportunity stage changes and sequence_v2.
-- Safe to validate on the Supabase development branch before production.

create or replace function public.crm_contact_context_by_id(p_contact_id uuid)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare r public.records%rowtype; d jsonb; v_phone text;
begin
  select * into r from public.records where id=p_contact_id;
  d:=coalesce(r.data,'{}'::jsonb);
  v_phone:=regexp_replace(coalesce(d->>'TELÉFONO',d->>'TELEFONO',d->>'TELÉFONO 1',d->>'TELEFONO 1',''),'\D','','g');
  return jsonb_build_object(
    'contact_id',p_contact_id,
    'name',coalesce(d->>'NOMBRE Y APELLIDOS',d->>'NOMBRE',d->>'CLIENTE',d->>'CLIENTE FINAL',''),
    'phone',v_phone,
    'dni',coalesce(d->>'DNI / NIF',d->>'DNI',d->>'NIF','')
  );
end;
$$;

create or replace function public.crm_execute_sequence_v2(p_rule public.crm_automations, p_ctx jsonb, p_event_key text)
returns boolean
language plpgsql
security definer
set search_path='public'
as $$
declare
  s record;
  step jsonb;
  delay_seconds bigint:=0;
  amount_n numeric;
  unit_t text;
  v_contact uuid:=nullif(p_ctx->>'contact_id','')::uuid;
  v_phone text:=nullif(p_ctx->>'phone','');
  v_name text:=nullif(p_ctx->>'name','');
  v_owner uuid:=public.crm_automation_valid_user(p_rule.user_id);
  v_stage uuid;
  v_pipeline uuid;
  v_opp uuid:=nullif(p_ctx->>'opportunity_id','')::uuid;
  v_text text;
  v_when timestamptz;
  v_existing boolean;
begin
  select exists(select 1 from public.crm_automation_runs where automation_id=p_rule.id and event_key=p_event_key) into v_existing;
  if v_existing then return false; end if;

  for s in
    select value as step, ordinality
    from jsonb_array_elements(coalesce(p_rule.action_config->'steps','[]'::jsonb)) with ordinality
    order by coalesce((value->>'position')::integer, ordinality::integer), ordinality
  loop
    step:=s.step;
    if step->>'type'='wait' then
      amount_n:=greatest(0,coalesce((step->>'amount')::numeric,0));
      unit_t:=lower(coalesce(step->>'unit','minutes'));
      delay_seconds:=delay_seconds + case unit_t
        when 'seconds' then amount_n::bigint
        when 'hours' then (amount_n*3600)::bigint
        when 'days' then (amount_n*86400)::bigint
        when 'weeks' then (amount_n*604800)::bigint
        else (amount_n*60)::bigint end;
      continue;
    end if;

    v_when:=now()+make_interval(secs=>delay_seconds::double precision);

    if step->>'type'='create_opportunity' then
      v_stage:=nullif(step->>'stage_id','')::uuid;
      select pipeline_id into v_pipeline from public.sales_stages where id=v_stage;
      if v_pipeline is null then raise exception 'Columna de ventas no válida'; end if;
      if delay_seconds=0 then
        insert into public.sales_opportunities(pipeline_id,stage_id,record_id,title,client_name,phone,amount,owner_user_id,notes)
        values(v_pipeline,v_stage,v_contact,coalesce(nullif(step->>'title',''),'Oportunidad automática'),v_name,v_phone,nullif(step->>'amount','')::numeric,v_owner,nullif(step->>'notes',''))
        returning id into v_opp;
      else
        -- Delayed opportunity creation is represented as a pending agenda task until a dedicated job type is added.
        insert into public.agenda_items(title,description,customer_name,customer_phone,starts_at,status,assigned_to,created_by,related_record_id)
        values(coalesce(nullif(step->>'title',''),'Crear oportunidad automática'),'Paso de secuencia pendiente',v_name,v_phone,v_when,'pending',v_owner,v_owner,v_contact);
      end if;

    elsif step->>'type'='whatsapp' then
      if v_phone is null then raise exception 'El contacto no tiene teléfono'; end if;
      v_text:=public.crm_render_automation_text(coalesce(step->>'message',''),p_ctx);
      if trim(v_text)='' then raise exception 'Mensaje vacío'; end if;
      insert into public.agenda_items(title,customer_name,customer_phone,starts_at,status,assigned_to,created_by,related_record_id,whatsapp_enabled,whatsapp_phone,whatsapp_message,whatsapp_scheduled_at)
      values('WhatsApp automático',v_name,v_phone,v_when,'pending',v_owner,v_owner,v_contact,true,v_phone,v_text,v_when);

    elsif step->>'type' in ('add_label','remove_label') then
      if v_contact is null then raise exception 'Falta contacto para etiqueta'; end if;
      insert into public.crm_automation_jobs(automation_id,contact_id,opportunity_id,job_type,run_at,payload,created_by)
      values(p_rule.id,v_contact,v_opp,step->>'type',v_when,jsonb_build_object('label_id',step->>'label_id'),v_owner);

    elsif step->>'type'='update_opportunity' then
      if v_opp is null then raise exception 'Falta oportunidad para actualizar'; end if;
      insert into public.crm_automation_jobs(automation_id,contact_id,opportunity_id,job_type,run_at,payload,created_by)
      values(p_rule.id,v_contact,v_opp,'update_opportunity',v_when,jsonb_build_object('title',step->>'title','stage_id',step->>'stage_id'),v_owner);
    end if;
  end loop;

  insert into public.crm_automation_runs(automation_id,user_id,event_key,context,status)
  values(p_rule.id,p_rule.user_id,p_event_key,coalesce(p_ctx,'{}'::jsonb),'ok');
  return true;
exception when unique_violation then return false;
end;
$$;

create or replace function public.crm_execute_automation_action(p_rule crm_automations, p_ctx jsonb, p_event_key text)
returns boolean
language plpgsql
security definer
set search_path='public'
as $$
declare a jsonb:=coalesce(p_rule.action_config,'{}'::jsonb); v_contact uuid:=nullif(p_ctx->>'contact_id','')::uuid; v_phone text:=nullif(p_ctx->>'phone',''); v_name text:=nullif(p_ctx->>'name',''); v_owner uuid:=public.crm_automation_valid_user(p_rule.user_id); v_stage uuid; v_pipeline uuid; v_when timestamptz; v_text text; v_template text; v_template_index integer; v_existing boolean;
begin
  if p_rule.action_type='sequence_v2' then return public.crm_execute_sequence_v2(p_rule,p_ctx,p_event_key); end if;
  select exists(select 1 from public.crm_automation_runs where automation_id=p_rule.id and event_key=p_event_key) into v_existing; if v_existing then return false; end if;
  if p_rule.action_type='create_task' then v_when:=now()+make_interval(mins=>greatest(0,coalesce((a->>'delay_minutes')::integer,0))); insert into public.agenda_items(title,customer_name,customer_phone,starts_at,status,assigned_to,created_by,related_record_id) values(coalesce(nullif(a->>'title',''),'Seguimiento WhatsApp'),v_name,v_phone,v_when,'pending',v_owner,v_owner,v_contact);
  elsif p_rule.action_type='create_opportunity' then v_stage:=nullif(a->>'stage_id','')::uuid; select pipeline_id into v_pipeline from public.sales_stages where id=v_stage; if v_pipeline is null then raise exception 'Columna de ventas no válida'; end if; insert into public.sales_opportunities(pipeline_id,stage_id,record_id,title,client_name,phone,owner_user_id) values(v_pipeline,v_stage,v_contact,coalesce(nullif(a->>'title',''),'Oportunidad desde WhatsApp'),v_name,v_phone,v_owner);
  elsif p_rule.action_type='assign_label' then if v_contact is null or nullif(a->>'label_id','') is null then raise exception 'Falta contacto o etiqueta'; end if; insert into public.crm_contact_labels(contact_id,label_id) values(v_contact,(a->>'label_id')::uuid) on conflict(contact_id,label_id) do nothing;
  elsif p_rule.action_type='schedule_whatsapp' then if v_phone is null then raise exception 'El contacto no tiene teléfono'; end if; v_when:=now()+make_interval(mins=>greatest(0,coalesce((a->>'delay_minutes')::integer,30))); v_text:=public.crm_render_automation_text(a->>'text',p_ctx); if trim(v_text)='' then raise exception 'Mensaje vacío'; end if; insert into public.agenda_items(title,customer_name,customer_phone,starts_at,status,assigned_to,created_by,related_record_id,whatsapp_enabled,whatsapp_phone,whatsapp_message,whatsapp_scheduled_at) values('WhatsApp programado',v_name,v_phone,v_when,'pending',v_owner,v_owner,v_contact,true,v_phone,v_text,v_when);
  elsif p_rule.action_type='send_template' then if v_phone is null then raise exception 'El contacto no tiene teléfono'; end if; v_template_index:=greatest(0,coalesce((a->>'template_index')::integer,0)); select body into v_template from public.wa_templates where user_id=p_rule.user_id order by id offset v_template_index limit 1; if v_template is null then raise exception 'Plantilla no encontrada'; end if; v_text:=public.crm_render_automation_text(v_template,p_ctx); insert into public.agenda_items(title,customer_name,customer_phone,starts_at,status,assigned_to,created_by,related_record_id,whatsapp_enabled,whatsapp_phone,whatsapp_message,whatsapp_scheduled_at) values('WhatsApp automático',v_name,v_phone,now(),'pending',v_owner,v_owner,v_contact,true,v_phone,v_text,now());
  else raise exception 'Acción de automatización aún no migrada: %',p_rule.action_type; end if;
  insert into public.crm_automation_runs(automation_id,user_id,event_key,context,status) values(p_rule.id,p_rule.user_id,p_event_key,coalesce(p_ctx,'{}'::jsonb),'ok'); return true;
exception when unique_violation then return false;
end;
$$;

create or replace function public.crm_fire_label_assigned_automations()
returns trigger
language plpgsql
security definer
set search_path='public'
as $$
declare r public.crm_automations%rowtype; ctx jsonb; ev text; err text;
begin
  ctx:=public.crm_contact_context_by_id(new.contact_id)||jsonb_build_object('label_id',new.label_id);
  ev:='label:'||new.contact_id||':'||new.label_id;
  for r in select * from public.crm_automations where enabled=true and trigger_type='label_assigned' loop
    if nullif(r.trigger_config->>'label_id','') is not null and (r.trigger_config->>'label_id')::uuid<>new.label_id then continue; end if;
    begin perform public.crm_execute_automation_action(r,ctx,ev); exception when others then err:=sqlerrm; insert into public.crm_automation_runs(automation_id,user_id,event_key,context,status) values(r.id,r.user_id,'error:'||ev,ctx||jsonb_build_object('error',left(err,500)),'failed') on conflict do nothing; end;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_crm_fire_label_assigned_automations on public.crm_contact_labels;
create trigger trg_crm_fire_label_assigned_automations after insert on public.crm_contact_labels for each row execute function public.crm_fire_label_assigned_automations();

create or replace function public.crm_fire_opportunity_stage_automations()
returns trigger
language plpgsql
security definer
set search_path='public'
as $$
declare r public.crm_automations%rowtype; ctx jsonb; ev text; err text;
begin
  if tg_op='UPDATE' and new.stage_id is not distinct from old.stage_id then return new; end if;
  ctx:=case when new.record_id is not null then public.crm_contact_context_by_id(new.record_id) else jsonb_build_object('contact_id',null,'name',coalesce(new.client_name,''),'phone',regexp_replace(coalesce(new.phone,''),'\D','','g'),'dni','') end;
  ctx:=ctx||jsonb_build_object('opportunity_id',new.id,'stage_id',new.stage_id,'opportunity_title',new.title);
  ev:='stage:'||new.id||':'||coalesce(new.stage_id::text,'none')||':'||extract(epoch from now())::bigint;
  for r in select * from public.crm_automations where enabled=true and trigger_type='opportunity_stage' loop
    if nullif(r.trigger_config->>'stage_id','') is not null and (r.trigger_config->>'stage_id')::uuid<>new.stage_id then continue; end if;
    begin perform public.crm_execute_automation_action(r,ctx,ev); exception when others then err:=sqlerrm; insert into public.crm_automation_runs(automation_id,user_id,event_key,context,status) values(r.id,r.user_id,'error:'||ev,ctx||jsonb_build_object('error',left(err,500)),'failed') on conflict do nothing; end;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_crm_fire_opportunity_stage_automations on public.sales_opportunities;
create trigger trg_crm_fire_opportunity_stage_automations after insert or update of stage_id on public.sales_opportunities for each row execute function public.crm_fire_opportunity_stage_automations();
