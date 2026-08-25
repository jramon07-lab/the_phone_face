-- Backend automation engine hardening after PREVIEW synthetic test.
-- Avoid FK failures from orphaned automation owners and persist failure reason.

begin;

create or replace function public.crm_automation_valid_user(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public','auth'
as $$
  select case when exists(select 1 from auth.users u where u.id=p_user) then p_user else null end;
$$;

revoke all on function public.crm_automation_valid_user(uuid) from public,anon,authenticated;
grant execute on function public.crm_automation_valid_user(uuid) to service_role;

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
  v_owner uuid := public.crm_automation_valid_user(p_rule.user_id);
  v_stage uuid;
  v_pipeline uuid;
  v_when timestamptz;
  v_text text;
  v_template text;
  v_template_index integer;
  v_existing boolean;
begin
  select exists(select 1 from public.crm_automation_runs where automation_id=p_rule.id and event_key=p_event_key) into v_existing;
  if v_existing then return false; end if;

  if p_rule.action_type='create_task' then
    v_when:=now()+make_interval(mins=>greatest(0,coalesce((a->>'delay_minutes')::integer,0)));
    insert into public.agenda_items(title,customer_name,customer_phone,starts_at,status,assigned_to,created_by,related_record_id)
    values(coalesce(nullif(a->>'title',''),'Seguimiento WhatsApp'),v_name,v_phone,v_when,'pending',v_owner,v_owner,v_contact);

  elsif p_rule.action_type='create_opportunity' then
    v_stage:=nullif(a->>'stage_id','')::uuid;
    select pipeline_id into v_pipeline from public.sales_stages where id=v_stage;
    if v_pipeline is null then raise exception 'Columna de ventas no válida'; end if;
    insert into public.sales_opportunities(pipeline_id,stage_id,record_id,title,client_name,phone,owner_user_id)
    values(v_pipeline,v_stage,v_contact,coalesce(nullif(a->>'title',''),'Oportunidad desde WhatsApp'),v_name,v_phone,v_owner);

  elsif p_rule.action_type='assign_label' then
    if v_contact is null or nullif(a->>'label_id','') is null then raise exception 'Falta contacto o etiqueta'; end if;
    insert into public.crm_contact_labels(contact_id,label_id) values(v_contact,(a->>'label_id')::uuid) on conflict(contact_id,label_id) do nothing;

  elsif p_rule.action_type='schedule_whatsapp' then
    if v_phone is null then raise exception 'El contacto no tiene teléfono'; end if;
    v_when:=now()+make_interval(mins=>greatest(0,coalesce((a->>'delay_minutes')::integer,30)));
    v_text:=public.crm_render_automation_text(a->>'text',p_ctx);
    if trim(v_text)='' then raise exception 'Mensaje vacío'; end if;
    insert into public.agenda_items(title,customer_name,customer_phone,starts_at,status,assigned_to,created_by,related_record_id,whatsapp_enabled,whatsapp_phone,whatsapp_message,whatsapp_scheduled_at)
    values('WhatsApp programado',v_name,v_phone,v_when,'pending',v_owner,v_owner,v_contact,true,v_phone,v_text,v_when);

  elsif p_rule.action_type='send_template' then
    if v_phone is null then raise exception 'El contacto no tiene teléfono'; end if;
    v_template_index:=greatest(0,coalesce((a->>'template_index')::integer,0));
    select body into v_template from public.wa_templates where user_id=p_rule.user_id order by id offset v_template_index limit 1;
    if v_template is null then raise exception 'Plantilla no encontrada'; end if;
    v_text:=public.crm_render_automation_text(v_template,p_ctx);
    insert into public.agenda_items(title,customer_name,customer_phone,starts_at,status,assigned_to,created_by,related_record_id,whatsapp_enabled,whatsapp_phone,whatsapp_message,whatsapp_scheduled_at)
    values('WhatsApp automático',v_name,v_phone,now(),'pending',v_owner,v_owner,v_contact,true,v_phone,v_text,now());

  else
    raise exception 'Acción de automatización aún no migrada: %',p_rule.action_type;
  end if;

  insert into public.crm_automation_runs(automation_id,user_id,event_key,context,status)
  values(p_rule.id,p_rule.user_id,p_event_key,coalesce(p_ctx,'{}'::jsonb),'ok');
  return true;
exception when unique_violation then
  return false;
end;
$function$;

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
  err text;
begin
  if new.direction <> 'in' then return new; end if;
  ctx:=public.crm_find_contact_context_by_chat(new.chat_id,new.text_content);
  k:=coalesce(new.id_message,new.id::text);
  for r in select * from public.crm_automations where enabled=true and trigger_type in ('message_received','message_contains') loop
    if r.trigger_type='message_contains' and position(lower(coalesce(r.trigger_config->>'keyword','')) in lower(coalesce(new.text_content,'')))=0 then continue; end if;
    begin
      perform public.crm_execute_automation_action(r,ctx,case when r.trigger_type='message_received' then 'msg:'||k else 'msgcontains:'||k end);
    exception when others then
      err:=sqlerrm;
      insert into public.crm_automation_runs(automation_id,user_id,event_key,context,status)
      values(r.id,r.user_id,'error:'||r.trigger_type||':'||k,ctx||jsonb_build_object('error',left(err,500)),'failed')
      on conflict do nothing;
    end;
  end loop;
  return new;
end;
$function$;

commit;
