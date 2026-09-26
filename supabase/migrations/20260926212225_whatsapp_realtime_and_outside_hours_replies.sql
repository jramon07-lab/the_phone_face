create table public.crm_whatsapp_reply_settings (
 id smallint primary key check (id=1),
 enabled boolean not null default false,
 message text not null check (length(message) between 1 and 1500),
 schedule jsonb not null check (jsonb_typeof(schedule)='array' and jsonb_array_length(schedule)=7),
 enabled_since timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.crm_whatsapp_reply_receipts (
 dedupe_key text primary key,
 chat_id text not null,
 incoming_id text not null,
 closure text not null,
 status text not null check (status in ('reserved','sent','uncertain')),
 outgoing_id text,
 sent_at timestamptz,
 created_at timestamptz not null default now()
);
create index crm_whatsapp_reply_receipts_created_idx on public.crm_whatsapp_reply_receipts(created_at desc);
alter table public.crm_whatsapp_reply_settings enable row level security;
alter table public.crm_whatsapp_reply_receipts enable row level security;
revoke all on public.crm_whatsapp_reply_settings, public.crm_whatsapp_reply_receipts from anon,authenticated;
grant select on public.crm_whatsapp_reply_settings, public.crm_whatsapp_reply_receipts to authenticated;
grant all on public.crm_whatsapp_reply_settings, public.crm_whatsapp_reply_receipts to service_role;
create policy whatsapp_reply_settings_read on public.crm_whatsapp_reply_settings for select to authenticated using (exists(select 1 from public.user_permissions p where p.user_id=(select auth.uid()) and (p.is_admin or p.can_use_whatsapp)));
create policy whatsapp_reply_receipts_read on public.crm_whatsapp_reply_receipts for select to authenticated using (exists(select 1 from public.user_permissions p where p.user_id=(select auth.uid()) and (p.is_admin or p.can_use_whatsapp)));
insert into public.crm_whatsapp_reply_settings(id,message,schedule) values
(1,'Hola, gracias por escribir a Phone House Albolote. Ahora estamos fuera de horario. Te responderemos en cuanto volvamos a abrir.',
'[[],[["10:00","14:00"],["17:30","20:30"]],[["10:00","14:00"],["17:30","20:30"]],[["10:00","14:00"],["17:30","20:30"]],[["10:00","14:00"],["17:30","20:30"]],[["10:00","14:00"],["17:30","20:30"]],[["10:00","14:00"]]]');
do $$ declare t text; begin
 foreach t in array array['crm_whatsapp_chat_state','wa_messages','crm_whatsapp_reply_receipts'] loop
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
 execute format('alter publication supabase_realtime add table public.%I',t);
 end if; end loop;
end $$;