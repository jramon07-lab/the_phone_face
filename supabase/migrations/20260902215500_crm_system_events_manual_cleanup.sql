create or replace function private.crm_delete_closed_system_event_impl(p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  delete from public.crm_system_events
  where id = p_id
    and status in ('resolved', 'ignored');

  return found;
end;
$$;

create or replace function public.crm_delete_closed_system_event(p_id bigint)
returns boolean
language sql
security invoker
set search_path = private, public, pg_temp
as $$
  select private.crm_delete_closed_system_event_impl(p_id);
$$;

create or replace function private.crm_clear_closed_system_events_impl()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not public.current_user_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  delete from public.crm_system_events
  where status in ('resolved', 'ignored');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.crm_clear_closed_system_events()
returns integer
language sql
security invoker
set search_path = private, public, pg_temp
as $$
  select private.crm_clear_closed_system_events_impl();
$$;

revoke all on function private.crm_delete_closed_system_event_impl(bigint) from public, anon, authenticated;
revoke all on function private.crm_clear_closed_system_events_impl() from public, anon, authenticated;
revoke all on function public.crm_delete_closed_system_event(bigint) from public, anon, authenticated;
revoke all on function public.crm_clear_closed_system_events() from public, anon, authenticated;

grant execute on function private.crm_delete_closed_system_event_impl(bigint) to authenticated;
grant execute on function private.crm_clear_closed_system_events_impl() to authenticated;
grant execute on function public.crm_delete_closed_system_event(bigint) to authenticated;
grant execute on function public.crm_clear_closed_system_events() to authenticated;

comment on function public.crm_delete_closed_system_event(bigint) is
  'Permite al administrador eliminar definitivamente una incidencia técnica ya resuelta o ignorada.';
comment on function public.crm_clear_closed_system_events() is
  'Permite al administrador vaciar el historial técnico cerrado; nunca elimina incidencias activas ni datos comerciales.';
