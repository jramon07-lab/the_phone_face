create index if not exists crm_system_events_reporter_id_idx
  on public.crm_system_events (reporter_id);
create index if not exists crm_system_events_resolved_by_idx
  on public.crm_system_events (resolved_by);
