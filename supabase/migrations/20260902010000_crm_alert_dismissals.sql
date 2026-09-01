create table if not exists public.crm_alert_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('task', 'opportunity')),
  entity_id uuid not null,
  alert_type text not null,
  dismissed_at timestamptz not null default now(),
  entity_updated_at timestamptz,
  unique (user_id, entity_type, entity_id, alert_type)
);
create index if not exists crm_alert_dismissals_user_entity_idx on public.crm_alert_dismissals (user_id, entity_type, entity_id);
alter table public.crm_alert_dismissals enable row level security;
drop policy if exists "Users read own alert dismissals" on public.crm_alert_dismissals;
create policy "Users read own alert dismissals" on public.crm_alert_dismissals for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users create own alert dismissals" on public.crm_alert_dismissals;
create policy "Users create own alert dismissals" on public.crm_alert_dismissals for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users update own alert dismissals" on public.crm_alert_dismissals;
create policy "Users update own alert dismissals" on public.crm_alert_dismissals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users delete own alert dismissals" on public.crm_alert_dismissals;
create policy "Users delete own alert dismissals" on public.crm_alert_dismissals for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.crm_alert_dismissals to authenticated;
