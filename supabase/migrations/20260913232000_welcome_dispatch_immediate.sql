-- A welcome message should not wait for the once-per-minute runner tick.
-- The call is asynchronous and deliberately best-effort: if it cannot start,
-- the pending job remains untouched for the normal runner to deliver later.
create or replace function crm_private.dispatch_runner_now()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  runner_secret text;
  request_id bigint;
begin
  select decrypted_secret into runner_secret
  from vault.decrypted_secrets
  where name = 'crm_runner_cron_secret';

  if coalesce(length(runner_secret), 0) < 64 then
    return;
  end if;

  select net.http_post(
    'https://overfzbjtpjqxzbujezg.supabase.co/functions/v1/crm-automation-runner',
    '{}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'content-type', 'application/json',
      'x-tpf-cron-secret', runner_secret
    ),
    5000
  ) into request_id;
exception when others then
  -- The welcome job is already stored as pending. Never fail contact creation
  -- or retry here; the normal runner is the safe fallback.
  null;
end;
$function$;

create or replace function crm_private.enqueue_welcome(p_contact uuid, p_label uuid, p_actor uuid, p_actor_name text)
returns boolean
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  cfg public.crm_welcome_settings%rowtype;
  req public.crm_welcome_requests%rowtype;
  r public.crm_automations%rowtype;
  ctx jsonb;
  body text;
  jid uuid;
  client_first_name text;
begin
  select * into cfg from public.crm_welcome_settings where id;
  if not found or cfg.label_id is distinct from p_label then return false; end if;
  if not cfg.enabled or p_actor is null or nullif(btrim(p_actor_name),'') is null then return true; end if;
  select * into req from public.crm_welcome_requests where contact_id=p_contact for update;
  if not found or req.status<>'requested' or req.job_id is not null then return true; end if;
  if not exists(select 1 from public.records where id=p_contact and crm_creation_origin='manual') then return true; end if;
  select * into r from public.crm_automations where id=cfg.automation_id and enabled;
  if not found or r.action_type<>'__send_whatsapp' then raise exception 'Configuración de bienvenida no válida'; end if;
  ctx:=public.crm_server_context_for_contact(p_contact,null)||jsonb_build_object('actor_id',p_actor,'actor_name',p_actor_name,'welcome',true);
  if coalesce(ctx->>'phone','')='' then raise exception 'Falta el teléfono de la bienvenida'; end if;
  client_first_name:=nullif(split_part(regexp_replace(btrim(coalesce(ctx->>'name','')),'\s+',' ','g'),' ',1),'');
  body:=replace(replace(case req.variant when 'offer' then cfg.offer_message else cfg.message end,'{{nombre_cliente}}',coalesce(client_first_name,'cliente')),'{{nombre_usuario}}',p_actor_name);
  if body like '%{{%' then raise exception 'Variable de bienvenida desconocida'; end if;
  if not public.crm_server_automations_enabled() then raise exception 'Motor de automatizaciones desactivado'; end if;
  insert into public.crm_server_automation_jobs(automation_id,user_id,event_key,action_type,action_config,context,run_at)
  values(r.id,r.user_id,'welcome:'||p_contact::text,'__send_whatsapp',jsonb_build_object('text',body),ctx,now())
  on conflict(automation_id,event_key) do nothing returning id into jid;
  if jid is null then raise exception 'La bienvenida ya tiene una ejecución registrada'; end if;
  update public.crm_welcome_requests set actor_id=p_actor,actor_name=p_actor_name,job_id=jid,status='pending' where contact_id=p_contact;
  perform crm_private.dispatch_runner_now();
  return true;
end;
$function$;
