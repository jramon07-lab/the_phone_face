-- The Phone Face CRM - P0 automation cron cleanup
-- PREPARADO PARA REVISION. NO APLICAR A PRODUCCION SIN VALIDAR.

begin;

-- There are currently two identical active pg_cron jobs executing
-- public.crm_process_automation_jobs() every minute as postgres.
-- Keep the oldest matching job and remove only duplicate copies.
do $block$
declare
  keep_job bigint;
  r record;
begin
  select min(jobid)
    into keep_job
  from cron.job
  where active = true
    and regexp_replace(lower(command), '\s+', '', 'g') = 'selectpublic.crm_process_automation_jobs();';

  if keep_job is not null then
    for r in
      select jobid
      from cron.job
      where active = true
        and jobid <> keep_job
        and regexp_replace(lower(command), '\s+', '', 'g') = 'selectpublic.crm_process_automation_jobs();'
      order by jobid
    loop
      perform cron.unschedule(r.jobid);
    end loop;
  end if;
end;
$block$;

-- These legacy permission bootstrap functions are SECURITY DEFINER and are not
-- attached to any current public trigger. Prevent direct PUBLIC/anon execution
-- while keeping owner/service access for controlled maintenance if needed.
revoke all on function public.bootstrap_known_user_permissions() from public, anon, authenticated;
revoke all on function public.bootstrap_user_permissions() from public, anon, authenticated;
revoke all on function public.handle_new_user_permissions() from public, anon, authenticated;
grant execute on function public.bootstrap_known_user_permissions() to service_role;
grant execute on function public.bootstrap_user_permissions() to service_role;
grant execute on function public.handle_new_user_permissions() to service_role;

commit;
