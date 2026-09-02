create table if not exists public.crm_edit_sessions (
  entity_type text not null check (entity_type in ('contact','opportunity')),
  entity_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  device text,
  opened_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  primary key (entity_type, entity_id, user_id)
);

create index if not exists crm_edit_sessions_live_idx
  on public.crm_edit_sessions (entity_type, entity_id, heartbeat_at desc);

alter table public.crm_edit_sessions enable row level security;
drop policy if exists "Authenticated users see live edit sessions" on public.crm_edit_sessions;
create policy "Authenticated users see live edit sessions" on public.crm_edit_sessions
  for select to authenticated using (heartbeat_at > now() - interval '2 minutes');
drop policy if exists "Users manage own edit sessions" on public.crm_edit_sessions;
create policy "Users manage own edit sessions" on public.crm_edit_sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.crm_edit_sessions to authenticated;

create table if not exists public.crm_backup_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running','completed','failed','verified')),
  provider text not null default 'google_drive',
  file_id text,
  file_name text,
  bytes bigint not null default 0,
  record_counts jsonb not null default '{}'::jsonb,
  checksum text,
  verified_at timestamptz,
  error_message text
);

create index if not exists crm_backup_runs_started_idx on public.crm_backup_runs (started_at desc);
alter table public.crm_backup_runs enable row level security;
revoke all on public.crm_backup_runs from anon, authenticated;
grant select on public.crm_backup_runs to authenticated;
drop policy if exists "Admins read backup history" on public.crm_backup_runs;
create policy "Admins read backup history" on public.crm_backup_runs for select to authenticated
  using (exists (select 1 from public.user_permissions p where p.user_id = auth.uid() and p.is_admin = true));

create table if not exists public.crm_external_credentials (
  provider text primary key,
  encrypted_value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.crm_external_credentials enable row level security;
revoke all on public.crm_external_credentials from public, anon, authenticated;

create or replace function public.crm_cleanup_stale_edit_sessions()
returns integer language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  delete from public.crm_edit_sessions where heartbeat_at < now() - interval '5 minutes';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.crm_cleanup_stale_edit_sessions() from public, anon;
grant execute on function public.crm_cleanup_stale_edit_sessions() to authenticated;

comment on table public.crm_edit_sessions is 'Presencia efímera para avisar cuando dos usuarios editan el mismo elemento.';
comment on table public.crm_backup_runs is 'Historial técnico de copias externas; no contiene datos comerciales.';
