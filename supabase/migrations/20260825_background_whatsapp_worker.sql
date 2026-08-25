-- The Phone Face CRM - scheduled WhatsApp background worker
-- PREPARADO PARA REVISION. NO APLICAR A PRODUCCION HASTA DESPLEGAR/CONFIGURAR EL EDGE WORKER.
-- Requisitos antes de aplicar:
--   1) Desplegar Edge Function: process-whatsapp-schedules (verify_jwt=false; autenticacion propia por x-tpf-worker-secret).
--   2) Configurar en Edge Function: TPF_WHATSAPP_WORKER_SECRET + GREEN_API_INSTANCE_ID + GREEN_API_TOKEN (+ GREEN_API_API_URL si procede).
--   3) Crear en Supabase Vault los secretos:
--        tpf_whatsapp_worker_url    = URL completa de la Edge Function
--        tpf_whatsapp_worker_secret = mismo valor que TPF_WHATSAPP_WORKER_SECRET

begin;

create extension if not exists pg_net with schema extensions;

alter table public.agenda_items
  add column if not exists whatsapp_processing_at timestamptz,
  add column if not exists whatsapp_attempts integer not null default 0,
  add column if not exists whatsapp_last_error text,
  add column if not exists whatsapp_sent_at timestamptz,
  add column if not exists whatsapp_green_message_id text;

create index if not exists agenda_items_whatsapp_due_idx
on public.agenda_items (whatsapp_scheduled_at)
where whatsapp_enabled = true and status = 'pending';

-- Reclama trabajos de forma atomica. Solo service_role puede llamarla.
create or replace function public.crm_claim_due_whatsapp_schedules(p_limit integer default 10)
returns setof public.agenda_items
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return query
  with due as (
    select a.id
    from public.agenda_items a
    where a.whatsapp_enabled = true
      and a.status = 'pending'
      and a.whatsapp_scheduled_at is not null
      and a.whatsapp_scheduled_at <= now()
      and coalesce(a.whatsapp_attempts,0) < 5
      and (a.whatsapp_processing_at is null or a.whatsapp_processing_at < now() - interval '10 minutes')
    order by a.whatsapp_scheduled_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit,10),50))
  )
  update public.agenda_items a
  set whatsapp_processing_at = now(),
      whatsapp_attempts = coalesce(a.whatsapp_attempts,0) + 1,
      whatsapp_last_error = null,
      updated_at = now()
  where a.id in (select id from due)
  returning a.*;
end;
$function$;

revoke all on function public.crm_claim_due_whatsapp_schedules(integer) from public, anon, authenticated;
grant execute on function public.crm_claim_due_whatsapp_schedules(integer) to service_role;

-- Finaliza el intento. Si falla, queda pending para reintento hasta un maximo de 5 intentos.
create or replace function public.crm_finish_whatsapp_schedule(
  p_id uuid,
  p_ok boolean,
  p_message_id text default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_id is null then return false; end if;

  if coalesce(p_ok,false) then
    update public.agenda_items
    set status = 'completed',
        whatsapp_processing_at = null,
        whatsapp_last_error = null,
        whatsapp_sent_at = now(),
        whatsapp_green_message_id = nullif(p_message_id,''),
        updated_at = now()
    where id = p_id
      and whatsapp_enabled = true;
  else
    update public.agenda_items
    set whatsapp_processing_at = null,
        whatsapp_last_error = left(coalesce(p_error,'Error de envio'),1000),
        updated_at = now()
    where id = p_id
      and whatsapp_enabled = true;
  end if;

  return found;
end;
$function$;

revoke all on function public.crm_finish_whatsapp_schedule(uuid,boolean,text,text) from public, anon, authenticated;
grant execute on function public.crm_finish_whatsapp_schedule(uuid,boolean,text,text) to service_role;

-- El cron se crea solo si Vault contiene URL y secreto. Si faltan, se aborta para no dejar un worker roto.
do $do$
declare
  v_url text;
  v_secret text;
  v_job record;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'tpf_whatsapp_worker_url'
  order by created_at desc
  limit 1;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'tpf_whatsapp_worker_secret'
  order by created_at desc
  limit 1;

  if coalesce(v_url,'') = '' or coalesce(v_secret,'') = '' then
    raise exception 'Faltan secretos Vault tpf_whatsapp_worker_url / tpf_whatsapp_worker_secret';
  end if;

  -- Evitar cron duplicado por nombre.
  for v_job in select jobid from cron.job where jobname = 'tpf-whatsapp-schedules-every-minute' loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  perform cron.schedule(
    'tpf-whatsapp-schedules-every-minute',
    '* * * * *',
    format($cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-tpf-worker-secret',%L
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 25000
      );
    $cmd$, v_url, v_secret)
  );
end
$do$;

commit;
