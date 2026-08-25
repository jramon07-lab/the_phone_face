-- The Phone Face CRM - backend automation engine
-- PREVIEW FIRST. Do not merge to production until synthetic + live tests pass.

begin;

create unique index if not exists crm_automation_runs_rule_event_uidx
on public.crm_automation_runs (automation_id, event_key)
where automation_id is not null and event_key is not null;

create or replace function public.crm_render_automation_text(p_text text, p_ctx jsonb)
returns text
language sql
immutable
as $$
  select replace(
           replace(
             replace(coalesce(p_text,''), '{nombre}', coalesce(p_ctx->>'name','')),
             '{dni}', coalesce(p_ctx->>'dni','')
           ),
           '{telefono}', coalesce(p_ctx->>'phone','')
         );
$$;

create or replace function public.crm_execute_automation_action(
  p_rule public.crm_automations,
  p_ctx jsonb,
  p_event_key text
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a jsonb := coalesce(p_rule.action_config,'{}'::jsonb);
  v_contact uuid := nullif(p_ctx->>'contact_id','')::uuid;
  v_phone text := nullif(p_ctx->>'phone','');
  v_name text := nullif(p_ctx->>'name','');
  v_stage uuid;
  v_pipeline uuid;
  v_when timestamptz;
  v_text text;
  v_template text;
  v_template_index integer;
  v_existing boolean;
begin
  select exists(
    select 1 from public.crm_automation_runs
    where automation_id=p_rule.id and event_key=p_event_key
  ) into v_existing;
  if v_existing then return false; end if;

  if p_rule.action_type='create_task' then
    v_when := now() + make_interval(mins => greatest(0,coalesce((a->>'delay_minutes')::integer,0)));
    insert into public.agenda_items(
      title, customer_name, customer_phone, starts_at, status, assigned_to, created_by, related_record_id
    ) values (
      coalesce(nullif(a->>'title',''),'Seguimiento WhatsApp'), v_name, v_phone, v_when,
      'pending', p_rule.user_id, p_rule.user_id, v_contact
    );

  elsif p_rule.action_type='create_opportunity' then
    v_stage := nullif(a->>'stage_id','')::uuid;
    select pipeline_id into v_pipeline from public.sales_stages where id=v_stage;
    if v_pipeline is null then raise exception 'Columna de ventas no válida'; end if;
    insert into public.sales_opportunities(
      pipeline_id,stage_id,record_id,title,client_name,phone,owner_user_id
    ) values (
      v_pipeline,v_stage,v_contact,coalesce(nullif(a->>'title',''),'Oportunidad desde WhatsApp'),v_name,v_phone,p_rule.user_id
    );

  elsif p_rule.action_type='assign_label' then
    if v_contact is null or nullif(a->>'label_id','') is null then raise exception 'Falta contacto o etiqueta'; end if;
    insert into public.crm_contact_labels(contact_id,label_id)
    values(v_contact,(a->>'label_id')::uuid)
    on conflict (contact_id,label_id) do nothing;

  elsif p_rule.action_type='schedule_whatsapp' then
    if v_phone is null then raise exception 'El contacto no tiene teléfono'; end if;
    v_when := now() + make_interval(mins => greatest(0,coalesce((a->>'delay_minutes')::integer,30)));
    v_text := public.crm_render_automation_text(a->>'text',p_ctx);
    if trim(v_text)='' then raise exception 'Mensaje vacío'; end if;
    insert into public.agenda_items(
      title,customer_name,customer_phone,starts_at,status,assigned_to,created_by,related_record_id,
      whatsapp_enabled,whatsapp_phone,whatsapp_message,whatsapp_scheduled_at
    ) values (
      'WhatsApp programado',v_name,v_phone,v_when,'pending',p_rule.user_id,p_rule.user_id,v_contact,
      true,v_phone,v_text,v_when
    );

  elsif p_rule.action_type='send_template' then
    if v_phone is null then raise exception 'El contacto no tiene teléfono'; end if;
    v_template_index := greatest(0,coalesce((a->>'template_index')::integer,0));
    select body into v_template
    from public.wa_templates
    where user_id=p_rule.user_id
    order by id
    offset v_template_index limit 1;
    if v_template is null then raise exception 'Plantilla no encontrada'; end if;
    v_text := public.crm_render_automation_text(v_template,p_ctx);
    insert into public.agenda_items(
      title,customer_name,customer_phone,starts_at,status,assigned_to,created_by,related_record_id,
      whatsapp_enabled,whatsapp_phone,whatsapp_message,whatsapp_scheduled_at
    ) values (
      'WhatsApp automático',v_name,v_phone,now(),'pending',p_rule.user_id,p_rule.user_id,v_contact,
      true,v_phone,v_text,now()
    );

  else
    raise exception 'Acción de automatización aún no migrada: %', p_rule.action_type;
  end if;

  insert into public.crm_automation_runs(automation_id,user_id,event_key,context,status)
  values(p_rule.id,p_rule.user_id,p_event_key,coalesce(p_ctx,'{}'::jsonb),'ok');
  return true;
exception when unique_violation then
  return false;
end;
$function$;

revoke all on function public.crm_execute_automation_action(public.crm_automations,jsonb,text) from public,anon,authenticated;
grant execute on function public.crm_execute_automation_action(public.crm_automations,jsonb,text) to service_role;

create or replace function public.crm_find_contact_context_by_chat(p_chat_id text, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_phone text := regexp_replace(coalesce(p_chat_id,''),'\D','','g');
  r public.records%rowtype;
  d jsonb;
begin
  select * into r
  from public.records
  where source_sheet='BASE DE DATOS'
    and right(regexp_replace(coalesce(data->>'TELÉFONO',data->>'TELEFONO',data->>'TELÉFONO 1',data->>'TELEFONO 1',''),'\D','','g'),9)=right(v_phone,9)
  order by updated_at desc
  limit 1;
  d:=coalesce(r.data,'{}'::jsonb);
  return jsonb_build_object(
    'chat_id',p_chat_id,
    'contact_id',r.id,
    'name',coalesce(d->>'NOMBRE Y APELLIDOS',d->>'NOMBRE',d->>'CLIENTE',d->>'CLIENTE FINAL',''),
    'phone',v_phone,
    'dni',coalesce(d->>'DNI / NIF',d->>'DNI',d->>'NIF',''),
    'message',coalesce(p_message,'')
  );
end;
$function$;

revoke all on function public.crm_find_contact_context_by_chat(text,text) from public,anon,authenticated;
grant execute on function public.crm_find_contact_context_by_chat(text,text) to service_role;

create or replace function public.crm_fire_incoming_message_automations()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r public.crm_automations%rowtype;
  ctx jsonb;
  k text;
begin
  if new.direction <> 'in' then return new; end if;
  ctx := public.crm_find_contact_context_by_chat(new.chat_id,new.text_content);
  k := coalesce(new.id_message,new.id::text);

  for r in
    select * from public.crm_automations
    where enabled=true and trigger_type in ('message_received','message_contains')
  loop
    if r.trigger_type='message_contains'
       and position(lower(coalesce(r.trigger_config->>'keyword','')) in lower(coalesce(new.text_content,'')))=0 then
      continue;
    end if;
    begin
      perform public.crm_execute_automation_action(r,ctx,
        case when r.trigger_type='message_received' then 'msg:'||k else 'msgcontains:'||k end);
    exception when others then
      insert into public.crm_automation_runs(automation_id,user_id,event_key,context,status)
      values(r.id,r.user_id,'error:'||r.trigger_type||':'||k,ctx,'failed')
      on conflict do nothing;
    end;
  end loop;
  return new;
end;
$function$;

drop trigger if exists trg_crm_fire_incoming_message_automations on public.wa_messages;
create trigger trg_crm_fire_incoming_message_automations
after insert on public.wa_messages
for each row execute function public.crm_fire_incoming_message_automations();

create or replace function public.crm_process_unanswered_automations()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r public.crm_automations%rowtype;
  m record;
  ctx jsonb;
  mins integer;
  fired integer := 0;
  ev text;
begin
  for r in select * from public.crm_automations where enabled=true and trigger_type='unanswered'
  loop
    mins := greatest(1,coalesce((r.trigger_config->>'minutes')::integer,120));
    for m in
      with last_in as (
        select distinct on (chat_id) chat_id,id,id_message,ts,text_content,created_at
        from public.wa_messages
        where direction='in'
        order by chat_id,coalesce(ts,extract(epoch from created_at)::bigint) desc,id desc
      )
      select i.*
      from last_in i
      where coalesce(to_timestamp(i.ts),i.created_at) <= now()-make_interval(mins=>mins)
        and not exists (
          select 1 from public.wa_messages o
          where o.chat_id=i.chat_id and o.direction='out'
            and coalesce(o.ts,extract(epoch from o.created_at)::bigint) > coalesce(i.ts,extract(epoch from i.created_at)::bigint)
        )
    loop
      ctx := public.crm_find_contact_context_by_chat(m.chat_id,m.text_content)
             || jsonb_build_object('minutes_waiting',floor(extract(epoch from (now()-coalesce(to_timestamp(m.ts),m.created_at)))/60));
      ev := 'unanswered:'||m.chat_id||':'||coalesce(m.id_message,m.id::text)||':'||mins;
      begin
        if public.crm_execute_automation_action(r,ctx,ev) then fired:=fired+1; end if;
      exception when others then null;
      end;
    end loop;
  end loop;
  return fired;
end;
$function$;

revoke all on function public.crm_process_unanswered_automations() from public,anon,authenticated;
grant execute on function public.crm_process_unanswered_automations() to service_role;

-- Server-side check every minute. Safe because runs are idempotent by (automation_id,event_key).
do $block$
declare j record;
begin
  for j in select jobid from cron.job where jobname='tpf-unanswered-automations-every-minute' loop
    perform cron.unschedule(j.jobid);
  end loop;
  perform cron.schedule(
    'tpf-unanswered-automations-every-minute',
    '* * * * *',
    'select public.crm_process_unanswered_automations();'
  );
end;
$block$;

commit;
