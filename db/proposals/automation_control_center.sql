-- Controles individuales del centro de envíos.
-- Mantiene el historial: pausar y cancelar nunca eliminan trabajos.

begin;

alter table public.crm_server_automation_jobs
  drop constraint if exists crm_server_automation_jobs_status_check;

alter table public.crm_server_automation_jobs
  add constraint crm_server_automation_jobs_status_check
  check (status in ('pending','running','paused','done','failed','cancelled'));

create or replace function public.crm_set_automation_job_pause(
  p_job_id uuid,
  p_paused boolean
)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.crm_server_automation_jobs
  where id = p_job_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Envío no encontrado';
  end if;

  if p_paused then
    if v_status <> 'pending' then
      raise exception 'Solo se pueden pausar envíos pendientes';
    end if;
    update public.crm_server_automation_jobs
       set status = 'paused',
           error_message = 'Pausado manualmente',
           updated_at = now()
     where id = p_job_id and user_id = auth.uid() and status = 'pending';
  else
    if v_status <> 'paused' then
      raise exception 'Este envío no está pausado';
    end if;
    update public.crm_server_automation_jobs
       set status = 'pending',
           run_at = greatest(run_at, now() + interval '1 minute'),
           error_message = null,
           completed_at = null,
           updated_at = now()
     where id = p_job_id and user_id = auth.uid() and status = 'paused';
  end if;

  return true;
end;
$$;

create or replace function public.crm_cancel_automation_job(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
begin
  update public.crm_server_automation_jobs
     set status = 'cancelled',
         error_message = 'Cancelado manualmente desde Control de envíos',
         completed_at = now(),
         updated_at = now()
   where id = p_job_id
     and user_id = auth.uid()
     and status in ('pending','paused');

  if not found then
    raise exception 'El envío ya cambió de estado. Actualiza antes de continuar.';
  end if;

  return true;
end;
$$;

revoke all on function public.crm_set_automation_job_pause(uuid,boolean) from public, anon;
revoke all on function public.crm_cancel_automation_job(uuid) from public, anon;
grant execute on function public.crm_set_automation_job_pause(uuid,boolean) to authenticated;
grant execute on function public.crm_cancel_automation_job(uuid) to authenticated;

-- The older controls are used only from an authenticated CRM session.
revoke all on function public.crm_retry_automation_step(uuid) from public, anon;
grant execute on function public.crm_retry_automation_step(uuid) to authenticated;
revoke all on function public.crm_cancel_automation_execution(uuid,text) from public, anon;
grant execute on function public.crm_cancel_automation_execution(uuid,text) to authenticated;
revoke all on function public.crm_cancel_automation_pending(uuid) from public, anon;
grant execute on function public.crm_cancel_automation_pending(uuid) to authenticated;

comment on function public.crm_set_automation_job_pause(uuid,boolean) is
  'Pausa o reanuda un trabajo pendiente del usuario autenticado sin borrar su historial.';
comment on function public.crm_cancel_automation_job(uuid) is
  'Cancela un trabajo pendiente o pausado del usuario autenticado sin eliminarlo.';

commit;
