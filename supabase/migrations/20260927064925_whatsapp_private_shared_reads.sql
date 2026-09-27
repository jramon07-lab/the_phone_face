alter table public.crm_whatsapp_chat_state add column if not exists internal_read_ts bigint not null default 0;
create or replace function public.crm_whatsapp_mark_internal_read(p_chat_id text,p_ts bigint)
returns bigint language plpgsql security invoker set search_path='' as $$
declare result bigint;
begin
 if nullif(trim(p_chat_id),'') is null or p_ts<0 then raise exception 'Invalid read marker'; end if;
 insert into public.crm_whatsapp_chat_state(chat_id,internal_read_ts)
 values(p_chat_id,least(p_ts,extract(epoch from now())::bigint))
 on conflict(chat_id) do update set internal_read_ts=greatest(public.crm_whatsapp_chat_state.internal_read_ts,excluded.internal_read_ts)
 returning internal_read_ts into result;
 return result;
end; $$;
create or replace function public.crm_whatsapp_internal_reads(p_after text default '')
returns table(chat_id text,read_ts bigint,unread_count bigint,last_incoming_ts bigint)
language sql stable security invoker set search_path='' as $$
 select s.chat_id,s.internal_read_ts,
 (select count(*) from public.wa_messages m where m.chat_id=s.chat_id and m.direction='in' and m.ts>s.internal_read_ts),
 coalesce((select max(m.ts) from public.wa_messages m where m.chat_id=s.chat_id and m.direction='in'),0)
 from public.crm_whatsapp_chat_state s where s.internal_read_ts>0 and s.chat_id>p_after order by s.chat_id limit 500
$$;
revoke all on function public.crm_whatsapp_mark_internal_read(text,bigint) from public,anon;
revoke all on function public.crm_whatsapp_internal_reads(text) from public,anon;
grant execute on function public.crm_whatsapp_mark_internal_read(text,bigint) to authenticated;
grant execute on function public.crm_whatsapp_internal_reads(text) to authenticated;
