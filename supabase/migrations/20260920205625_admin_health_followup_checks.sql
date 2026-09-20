-- Read-only monitoring extension. Keeps the existing admin-only wrapper and grants.
create or replace function private.crm_system_health_snapshot_impl()
returns jsonb
language plpgsql
security definer
set search_path = public, cron, pg_temp
as $$
declare
  v_cron_active integer := 0;
  v_cron_latest_failed integer := 0;
  v_cron_stalled integer := 0;
  v_cron_failed_24h integer := 0;
  v_auto_stuck integer := 0;
  v_auto_failed_24h integer := 0;
  v_wa_overdue integer := 0;
  v_wa_failed_24h integer := 0;
  v_agenda_overdue integer := 0;
  v_agenda_failed_24h integer := 0;
  v_followup_checks jsonb;
  v_event_versions jsonb;
  v_events_active integer := 0;
  v_events_critical integer := 0;
begin
  if auth.uid() is null or not public.current_user_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select count(*) into v_cron_active from cron.job where active is true;
  select count(*) into v_cron_latest_failed
  from cron.job j
  left join lateral (
    select d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1
  ) latest on true
  where j.active is true and coalesce(latest.status, 'missing') <> 'succeeded';
  select count(*) into v_cron_stalled from cron.job_run_details
    where status = 'running' and start_time < now() - interval '10 minutes';
  select count(*) into v_cron_failed_24h from cron.job_run_details
    where start_time >= now() - interval '24 hours' and status not in ('succeeded', 'running');

  select count(*) into v_auto_stuck from public.crm_server_automation_jobs
    where (status = 'pending' and run_at < now() - interval '10 minutes')
       or (status = 'running' and updated_at < now() - interval '10 minutes');
  select count(*) into v_auto_failed_24h from public.crm_server_automation_jobs
    where status in ('failed', 'error') and updated_at >= now() - interval '24 hours';

  select count(*) into v_wa_overdue from public.whatsapp_jobs
    where status in ('pending', 'queued', 'scheduled') and scheduled_for < now() - interval '5 minutes';
  select count(*) into v_wa_failed_24h from public.whatsapp_jobs
    where status in ('failed', 'error') and updated_at >= now() - interval '24 hours';
  select count(*) into v_agenda_overdue from public.agenda_items
    where whatsapp_enabled is true and status = 'pending'
      and coalesce(whatsapp_delivery_status, 'pending') in ('pending', 'queued', 'scheduled')
      and coalesce(whatsapp_scheduled_at, starts_at) < now() - interval '5 minutes';
  select count(*) into v_agenda_failed_24h from public.agenda_items
    where whatsapp_enabled is true and coalesce(whatsapp_delivery_status, '') in ('failed', 'error')
      and updated_at >= now() - interval '24 hours';

  select count(*), count(*) filter (where severity = 'critical')
    into v_events_active, v_events_critical
  from public.crm_system_events where status = 'active';

  select coalesce(jsonb_agg(v), '[]'::jsonb) into v_event_versions
  from (select app_version as version, count(*) as active
        from public.crm_system_events where status='active' group by app_version) v;

  with accepted as (
    select i.id, o.title, 'Oferta aceptada que sigue en Seguimiento'::text as reason
    from public.crm_offer_instances i
    join public.sales_opportunities o on o.id=i.opportunity_id
    join public.sales_stages s on s.id=o.stage_id
    where i.status='accepted' and lower(btrim(s.name)) in ('seguimiento','oferta pasada')
  ), closed_messages as (
    select j.id, o.title, 'Envío pendiente con oportunidad perdida o eliminada'::text as reason
    from public.crm_server_automation_jobs j
    left join public.sales_opportunities o on o.id::text=j.context->>'opportunity_id'
    left join public.sales_stages s on s.id=o.stage_id
    where j.status in ('pending','running')
      and j.action_type in ('send_template','__send_whatsapp')
      and j.context#>>'{lifecycle,mode}' in ('offer','after_sale')
      and nullif(j.context->>'opportunity_id','') is not null
      and (o.id is null or lower(btrim(s.name))='perdido')
  ), cases as (select * from accepted union all select * from closed_messages)
  select jsonb_build_object(
    'accepted_in_followup',(select count(*) from accepted),
    'closed_pending_messages',(select count(*) from closed_messages),
    'items',coalesce((select jsonb_agg(x) from (select title,reason from cases order by id limit 30) x),'[]'::jsonb)
  ) into v_followup_checks;

  return jsonb_build_object(
    'checked_at', now(),
    'cron', jsonb_build_object('active', v_cron_active, 'latest_failed', v_cron_latest_failed, 'stalled', v_cron_stalled, 'failed_24h', v_cron_failed_24h),
    'automations', jsonb_build_object('stuck', v_auto_stuck, 'failed_24h', v_auto_failed_24h),
    'whatsapp', jsonb_build_object('overdue_jobs', v_wa_overdue, 'failed_jobs_24h', v_wa_failed_24h, 'overdue_agenda', v_agenda_overdue, 'failed_agenda_24h', v_agenda_failed_24h),
    'incidents', jsonb_build_object('active', v_events_active, 'critical', v_events_critical, 'by_version', v_event_versions),
    'followup_checks', v_followup_checks
  );
end;
$$;
