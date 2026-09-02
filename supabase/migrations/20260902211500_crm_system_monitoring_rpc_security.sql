alter function public.crm_report_system_event(text,text,text,text,text,text,text,text,jsonb) security definer;
alter function public.crm_list_system_events(integer,integer,text,text) security definer;
alter function public.crm_set_system_event_status(bigint,text) security definer;
alter function public.crm_cleanup_system_events(integer) security definer;
alter function public.crm_system_health_snapshot() security definer;

-- Public wrappers run with their owner's rights only so callers never need
-- direct access to the private implementations. Every privileged operation
-- still validates auth.uid() and, where applicable, administrator status.
