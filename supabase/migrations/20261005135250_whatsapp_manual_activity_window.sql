create table if not exists public.crm_whatsapp_manual_activity (
 chat_id text primary key,
 last_sent_at timestamptz not null,
 outgoing_id text not null
);
alter table public.crm_whatsapp_manual_activity enable row level security;
revoke all on public.crm_whatsapp_manual_activity from public, anon, authenticated;
grant select,insert,update on public.crm_whatsapp_manual_activity to service_role;
