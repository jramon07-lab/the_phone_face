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
  v_events_active integer := 0;
  v_events_critical integer := 0;
begin
  if not public.current_user_is_admin() then
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

  return jsonb_build_object(
    'checked_at', now(),
    'cron', jsonb_build_object('active', v_cron_active, 'latest_failed', v_cron_latest_failed, 'stalled', v_cron_stalled, 'failed_24h', v_cron_failed_24h),
    'automations', jsonb_build_object('stuck', v_auto_stuck, 'failed_24h', v_auto_failed_24h),
    'whatsapp', jsonb_build_object('overdue_jobs', v_wa_overdue, 'failed_jobs_24h', v_wa_failed_24h, 'overdue_agenda', v_agenda_overdue, 'failed_agenda_24h', v_agenda_failed_24h),
    'incidents', jsonb_build_object('active', v_events_active, 'critical', v_events_critical)
  );
end;
$$;
