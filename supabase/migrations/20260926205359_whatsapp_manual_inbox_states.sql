alter table public.crm_whatsapp_chat_state
 add column if not exists inbox_state text not null default 'open' check (inbox_state in ('open','waiting','snoozed','pending')),
 add column if not exists inbox_reason text not null default '' check (length(inbox_reason)<=300),
 add column if not exists inbox_since timestamptz,
 add column if not exists inbox_until timestamptz;
create or replace function crm_private.whatsapp_inbox_incoming() returns trigger language plpgsql security invoker set search_path='' as $$
declare message_at timestamptz;
begin
 if new.direction is distinct from 'in' then return new; end if;
 message_at:=case when new.ts is null then coalesce(new.created_at,now()) when new.ts>1000000000000 then to_timestamp(new.ts/1000.0) else to_timestamp(new.ts) end;
 update public.crm_whatsapp_chat_state set inbox_state='pending',inbox_reason='',inbox_until=null,updated_at=now()
 where chat_id=new.chat_id and inbox_state in ('waiting','snoozed') and message_at>inbox_since;
 return new;
end;$$;
revoke all on function crm_private.whatsapp_inbox_incoming() from public,anon,authenticated;
create trigger crm_whatsapp_inbox_incoming after insert on public.wa_messages for each row execute function crm_private.whatsapp_inbox_incoming();
