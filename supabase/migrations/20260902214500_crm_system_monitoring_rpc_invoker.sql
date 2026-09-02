alter function public.crm_report_system_event(text,text,text,text,text,text,text,text,jsonb) security invoker;
alter function public.crm_list_system_events(integer,integer,text,text) security invoker;
alter function public.crm_set_system_event_status(bigint,text) security invoker;
alter function public.crm_cleanup_system_events(integer) security invoker;
alter function public.crm_system_health_snapshot() security invoker;

grant execute on function private.crm_report_system_event_impl(text,text,text,text,text,text,text,text,jsonb) to authenticated;
grant execute on function private.crm_list_system_events_impl(integer,integer,text,text) to authenticated;
grant execute on function private.crm_set_system_event_status_impl(bigint,text) to authenticated;
grant execute on function private.crm_cleanup_system_events_impl(integer) to authenticated;
grant execute on function private.crm_system_health_snapshot_impl() to authenticated;

-- The exposed wrappers remain SECURITY INVOKER. Privileged work stays in the
-- non-exposed private schema, where every function validates auth.uid() and
-- administrator access before bypassing RLS.
