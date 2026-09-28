create or replace function public.crm_whatsapp_message_summary(p_after text default '')
returns table(chat_id text,id_message text,direction text,ts bigint,last_incoming_at bigint,last_outgoing_at bigint)
language sql stable security invoker set search_path='' as $$
 with ids as (select distinct m.chat_id from public.wa_messages m where m.chat_id>coalesce(p_after,'') order by m.chat_id limit 500)
 select i.chat_id,l.id_message,l.direction,l.ts,t.inc,t.outgoing
 from ids i
 cross join lateral (select m.id_message,m.direction,m.ts from public.wa_messages m where m.chat_id=i.chat_id order by m.ts desc nulls last,m.id desc limit 1) l
 cross join lateral (select coalesce(max(m.ts) filter(where m.direction='in'),0) inc,coalesce(max(m.ts) filter(where m.direction='out'),0) outgoing from public.wa_messages m where m.chat_id=i.chat_id) t
 order by i.chat_id;
$$;
revoke all on function public.crm_whatsapp_message_summary(text) from public,anon;
grant execute on function public.crm_whatsapp_message_summary(text) to authenticated,service_role;
