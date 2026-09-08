create table if not exists public.crm_whatsapp_chat_state (
  chat_id text primary key,
  archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  reopened_at timestamptz,
  reopened_by_message_id text,
  updated_at timestamptz not null default now(),
  constraint crm_whatsapp_chat_state_chat_id_not_blank check (btrim(chat_id) <> '')
);

alter table public.crm_whatsapp_chat_state enable row level security;
revoke all on table public.crm_whatsapp_chat_state from anon;
grant select, insert, update on table public.crm_whatsapp_chat_state to authenticated;
grant all on table public.crm_whatsapp_chat_state to service_role;

drop policy if exists crm_whatsapp_chat_state_select on public.crm_whatsapp_chat_state;
create policy crm_whatsapp_chat_state_select
on public.crm_whatsapp_chat_state
for select
to authenticated
using (
  exists (
    select 1
    from public.user_permissions up
    where up.user_id = (select auth.uid())
      and (up.is_admin or up.can_use_whatsapp)
  )
);

drop policy if exists crm_whatsapp_chat_state_insert on public.crm_whatsapp_chat_state;
create policy crm_whatsapp_chat_state_insert
on public.crm_whatsapp_chat_state
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_permissions up
    where up.user_id = (select auth.uid())
      and (up.is_admin or up.can_use_whatsapp)
  )
);

drop policy if exists crm_whatsapp_chat_state_update on public.crm_whatsapp_chat_state;
create policy crm_whatsapp_chat_state_update
on public.crm_whatsapp_chat_state
for update
to authenticated
using (
  exists (
    select 1
    from public.user_permissions up
    where up.user_id = (select auth.uid())
      and (up.is_admin or up.can_use_whatsapp)
  )
)
with check (
  exists (
    select 1
    from public.user_permissions up
    where up.user_id = (select auth.uid())
      and (up.is_admin or up.can_use_whatsapp)
  )
);

create or replace function public.crm_whatsapp_prepare_chat_state()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.archived and (tg_op = 'INSERT' or not old.archived) then
    new.archived_at := coalesce(new.archived_at, now());
    new.archived_by := coalesce(new.archived_by, (select auth.uid()));
    new.reopened_at := null;
    new.reopened_by_message_id := null;
  elsif not new.archived and tg_op = 'UPDATE' and old.archived then
    new.reopened_at := coalesce(new.reopened_at, now());
  end if;
  return new;
end;
$$;

revoke all on function public.crm_whatsapp_prepare_chat_state() from public, anon, authenticated;
grant execute on function public.crm_whatsapp_prepare_chat_state() to service_role;

drop trigger if exists crm_whatsapp_prepare_chat_state on public.crm_whatsapp_chat_state;
create trigger crm_whatsapp_prepare_chat_state
before insert or update on public.crm_whatsapp_chat_state
for each row execute function public.crm_whatsapp_prepare_chat_state();

create or replace function public.crm_whatsapp_reopen_on_incoming()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  message_at timestamptz;
begin
  if lower(coalesce(new.direction, '')) <> 'in' then
    return new;
  end if;

  message_at := case
    when new.ts is null then coalesce(new.created_at, now())
    when new.ts > 1000000000000 then to_timestamp(new.ts / 1000.0)
    else to_timestamp(new.ts)
  end;

  update public.crm_whatsapp_chat_state
     set archived = false,
         reopened_at = now(),
         reopened_by_message_id = new.id_message,
         updated_at = now()
   where chat_id = new.chat_id
     and archived = true
     and archived_at is not null
     and message_at > archived_at;

  return new;
end;
$$;

revoke all on function public.crm_whatsapp_reopen_on_incoming() from public, anon, authenticated;
grant execute on function public.crm_whatsapp_reopen_on_incoming() to service_role;

drop trigger if exists crm_whatsapp_reopen_on_incoming on public.wa_messages;
create trigger crm_whatsapp_reopen_on_incoming
after insert on public.wa_messages
for each row execute function public.crm_whatsapp_reopen_on_incoming();

comment on table public.crm_whatsapp_chat_state is
  'Shared WhatsApp archive state. A newer incoming message automatically returns an archived chat to the active inbox.';
