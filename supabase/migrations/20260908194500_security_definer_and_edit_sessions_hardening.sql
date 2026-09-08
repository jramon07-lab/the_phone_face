-- Close privileged RPCs to anonymous callers and keep only the two intentional
-- automation controls available to authenticated owners.
create or replace function public.crm_exclude_contact_from_automation(
  p_automation_id uuid,
  p_contact_id uuid,
  p_reason text default 'Excluido manualmente'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'Sesión no válida';
  end if;
  if not exists (
    select 1 from public.crm_automations a
    where a.id = p_automation_id and a.user_id = actor_id
  ) then
    raise exception 'Automatización no encontrada';
  end if;

  insert into public.crm_automation_contact_exclusions(automation_id, contact_id, user_id, reason)
  values (
    p_automation_id,
    p_contact_id,
    actor_id,
    coalesce(nullif(p_reason, ''), 'Excluido manualmente')
  )
  on conflict (automation_id, contact_id) do update
    set user_id = excluded.user_id,
        reason = excluded.reason,
        created_at = now();

  update public.crm_server_automation_jobs j
  set status = 'cancelled',
      error_message = 'Contacto excluido de esta automatización',
      completed_at = now(),
      updated_at = now()
  where j.automation_id = p_automation_id
    and j.user_id = actor_id
    and j.status in ('pending', 'running')
    and j.context->>'contact_id' = p_contact_id::text;
  return true;
end;
$$;

create or replace function public.crm_include_contact_in_automation(
  p_automation_id uuid,
  p_contact_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'Sesión no válida';
  end if;
  if not exists (
    select 1 from public.crm_automations a
    where a.id = p_automation_id and a.user_id = actor_id
  ) then
    raise exception 'Automatización no encontrada';
  end if;

  delete from public.crm_automation_contact_exclusions
  where automation_id = p_automation_id
    and contact_id = p_contact_id
    and user_id = actor_id;
  return true;
end;
$$;

revoke all on function public.crm_exclude_contact_from_automation(uuid, uuid, text) from public, anon;
revoke all on function public.crm_include_contact_in_automation(uuid, uuid) from public, anon;
grant execute on function public.crm_exclude_contact_from_automation(uuid, uuid, text) to authenticated;
grant execute on function public.crm_include_contact_in_automation(uuid, uuid) to authenticated;

-- Trigger helpers are internal and must never be callable as RPC endpoints.
revoke all on function public.crm_prepare_dynamic_label_job() from public, anon, authenticated;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Prevent that
-- for functions subsequently created by the migration owner.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;

-- Preserve the existing collaboration behaviour while using one SELECT policy,
-- and evaluate auth.uid() once per statement.
drop policy if exists "Authenticated users see live edit sessions" on public.crm_edit_sessions;
drop policy if exists "Users manage own edit sessions" on public.crm_edit_sessions;

create policy "Authenticated users see permitted edit sessions"
  on public.crm_edit_sessions for select to authenticated
  using (
    heartbeat_at > now() - interval '2 minutes'
    or user_id = (select auth.uid())
  );
create policy "Users insert own edit sessions"
  on public.crm_edit_sessions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Users update own edit sessions"
  on public.crm_edit_sessions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Users delete own edit sessions"
  on public.crm_edit_sessions for delete to authenticated
  using (user_id = (select auth.uid()));

create index if not exists crm_edit_sessions_user_idx
  on public.crm_edit_sessions(user_id);
create index if not exists crm_whatsapp_chat_state_archived_by_idx
  on public.crm_whatsapp_chat_state(archived_by);
