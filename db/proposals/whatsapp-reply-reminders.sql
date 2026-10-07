-- Personal notices only. No task/automation is created and no customer message is sent.
create table public.crm_whatsapp_reply_reminders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 source_kind text not null check (source_kind in ('message','schedule','offer')),
 source_id text not null,
 chat_id text not null check (chat_id ~ '^[1-9][0-9]{7,14}@c.us$'),
 message_id text,
 message_text text not null default '',
 delay_minutes integer check (delay_minutes between 1 and 525600),
 requested_at timestamptz,
 sent_at timestamptz,
 due_at timestamptz,
 status text not null default 'waiting' check (status in ('waiting','pending','answered','cancelled','attended')),
 answered_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,source_kind,source_id),
 check ((delay_minutes is not null)::integer + (requested_at is not null)::integer = 1)
);
create index crm_reply_reminders_owner_due on public.crm_whatsapp_reply_reminders(user_id,status,due_at);
create index crm_reply_reminders_chat on public.crm_whatsapp_reply_reminders(chat_id,sent_at) where status='pending';
alter table public.crm_whatsapp_reply_reminders enable row level security;
create policy reply_reminders_read on public.crm_whatsapp_reply_reminders for select to authenticated using (user_id=(select auth.uid()) and (select public.current_user_is_admin() or public.current_user_can('can_use_whatsapp')));
create policy reply_reminders_insert on public.crm_whatsapp_reply_reminders for insert to authenticated with check (user_id=(select auth.uid()) and (select public.current_user_is_admin() or public.current_user_can('can_use_whatsapp')));
create policy reply_reminders_update on public.crm_whatsapp_reply_reminders for update to authenticated using (user_id=(select auth.uid()) and (select public.current_user_is_admin() or public.current_user_can('can_use_whatsapp'))) with check (user_id=(select auth.uid()) and (select public.current_user_is_admin() or public.current_user_can('can_use_whatsapp')));
grant select,insert,update on public.crm_whatsapp_reply_reminders to authenticated;
grant all on public.crm_whatsapp_reply_reminders to service_role;

create or replace function public.crm_prepare_reply_reminder(p_chat_id text,p_message text,p_spec jsonb,p_source_kind text default 'message',p_source_id text default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare rid uuid; d integer; requested timestamptz; phone text;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_use_whatsapp')) then raise exception 'No tienes permiso para los avisos de WhatsApp'; end if;
 if jsonb_typeof(p_spec) is distinct from 'object' then raise exception 'Elige cuándo recibir el aviso';end if;
 d:=nullif(p_spec->>'delay_minutes','')::integer;requested:=nullif(p_spec->>'at','')::timestamptz;
 if (d is null)=(requested is null) or d<1 or d>525600 or requested<=now() then raise exception 'Elige un plazo o una fecha futura para el aviso';end if;
 phone:=regexp_replace(split_part(coalesce(p_chat_id,''),'@',1),'[^0-9]','','g');
 if phone like '0034%' then phone:=substr(phone,3);end if;
 if length(phone)=9 then phone:='34'||phone;end if;
 if p_chat_id like '%@g.us' or phone !~ '^[1-9][0-9]{7,14}$' then raise exception 'El aviso necesita una conversación individual válida';end if;
 insert into public.crm_whatsapp_reply_reminders(user_id,source_kind,source_id,chat_id,message_text,delay_minutes,requested_at)
 values(auth.uid(),p_source_kind,coalesce(p_source_id,gen_random_uuid()::text),phone||'@c.us',left(coalesce(p_message,''),20000),d,requested)
 on conflict(user_id,source_kind,source_id) do update set delay_minutes=excluded.delay_minutes,requested_at=excluded.requested_at,message_text=excluded.message_text,
 chat_id=case when crm_whatsapp_reply_reminders.sent_at is null then excluded.chat_id else crm_whatsapp_reply_reminders.chat_id end,
 due_at=case when crm_whatsapp_reply_reminders.sent_at is not null then greatest(crm_whatsapp_reply_reminders.sent_at,coalesce(excluded.requested_at,crm_whatsapp_reply_reminders.sent_at+make_interval(mins=>excluded.delay_minutes))) end,
 updated_at=now()
 returning id into rid;
 return rid;
end $$;
revoke all on function public.crm_prepare_reply_reminder(text,text,jsonb,text,text) from public,anon;
grant execute on function public.crm_prepare_reply_reminder(text,text,jsonb,text,text) to authenticated;

-- A private trigger performs cross-owner cancellation; callers cannot execute it.
create or replace function crm_private.reply_reminder_check() returns trigger
language plpgsql security definer set search_path='' as $$
declare reply_at timestamptz;
begin
 if new.sent_at is not null and new.status in ('waiting','pending') then
  new.status:='pending';new.due_at:=greatest(new.sent_at,coalesce(new.requested_at,new.sent_at+make_interval(mins=>new.delay_minutes)));
  select min(to_timestamp(m.ts)) into reply_at from public.wa_messages m where m.chat_id=new.chat_id and m.direction='in' and m.ts>=extract(epoch from new.sent_at);
  if reply_at is not null then new.status:='answered';new.answered_at:=reply_at;end if;
 end if;
 new.updated_at:=now();return new;
end $$;
revoke all on function crm_private.reply_reminder_check() from public,anon,authenticated;
create trigger crm_reply_reminder_check before insert or update on public.crm_whatsapp_reply_reminders for each row execute function crm_private.reply_reminder_check();

create or replace function public.crm_arm_reply_reminder(p_id uuid,p_message_id text,p_sent_at timestamptz default now()) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if nullif(btrim(p_message_id),'') is null or p_sent_at>now()+interval '1 minute' then raise exception 'No se confirmó el mensaje enviado';end if;
 update public.crm_whatsapp_reply_reminders set message_id=p_message_id,sent_at=date_trunc('second',p_sent_at),source_id=case when source_kind='message' then p_message_id else source_id end
 where id=p_id and user_id=auth.uid() and status='waiting';
 return found;
end $$;
revoke all on function public.crm_arm_reply_reminder(uuid,text,timestamptz) from public,anon;
grant execute on function public.crm_arm_reply_reminder(uuid,text,timestamptz) to authenticated;

create or replace function crm_private.reply_reminder_incoming() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.direction='in' then
  update public.crm_whatsapp_reply_reminders set status='answered',answered_at=to_timestamp(new.ts)
  where chat_id=new.chat_id and status='pending' and new.ts>=extract(epoch from sent_at);
 end if;return new;
end $$;
revoke all on function crm_private.reply_reminder_incoming() from public,anon,authenticated;
create trigger crm_reply_reminder_incoming after insert on public.wa_messages for each row execute function crm_private.reply_reminder_incoming();

alter table public.agenda_items add column whatsapp_reply_reminder jsonb;
create or replace function crm_private.reply_reminder_schedule() returns trigger
language plpgsql security definer set search_path='' as $$
declare d integer; requested timestamptz; phone text; uid uuid;
begin
 if new.whatsapp_reply_reminder is null then
  if tg_op='UPDATE' and old.whatsapp_reply_reminder is not null then update public.crm_whatsapp_reply_reminders set status='cancelled' where source_kind='schedule' and source_id=new.id::text and status in ('waiting','pending');end if;
  return new;
 end if;
 if not new.whatsapp_enabled then raise exception 'El aviso necesita un WhatsApp programado';end if;
 d:=nullif(new.whatsapp_reply_reminder->>'delay_minutes','')::integer;requested:=nullif(new.whatsapp_reply_reminder->>'at','')::timestamptz;
 if jsonb_typeof(new.whatsapp_reply_reminder) is distinct from 'object' or (d is null)=(requested is null) or d<1 or d>525600 then raise exception 'El aviso necesita un plazo o una fecha válida';end if;
 phone:=regexp_replace(coalesce(new.whatsapp_phone,new.customer_phone,''),'[^0-9]','','g');if phone like '0034%' then phone:=substr(phone,3);end if;if length(phone)=9 then phone:='34'||phone;end if;
 if tg_op='INSERT' or new.whatsapp_reply_reminder is distinct from old.whatsapp_reply_reminder then
  uid:=auth.uid();
  if uid is null or not (public.current_user_is_admin() or public.current_user_can('can_use_whatsapp')) then raise exception 'No tienes permiso para activar el aviso';end if;
  if requested<=now() or requested<=new.whatsapp_scheduled_at then raise exception 'El aviso debe ser posterior al envío programado';end if;
  insert into public.crm_whatsapp_reply_reminders(user_id,source_kind,source_id,chat_id,message_text,delay_minutes,requested_at)
  values(uid,'schedule',new.id::text,phone||'@c.us',coalesce(new.whatsapp_message,''),d,requested)
  on conflict(user_id,source_kind,source_id) do update set chat_id=excluded.chat_id,message_text=excluded.message_text,delay_minutes=excluded.delay_minutes,requested_at=excluded.requested_at;
 end if;
 if new.whatsapp_delivery_status='sent' and new.whatsapp_sent_at is not null and new.whatsapp_provider_message_id is not null then
  update public.crm_whatsapp_reply_reminders set sent_at=date_trunc('second',new.whatsapp_sent_at),message_id=new.whatsapp_provider_message_id where source_kind='schedule' and source_id=new.id::text and status='waiting';
 elsif new.status='cancelled' or new.whatsapp_delivery_status='cancelled' then
  update public.crm_whatsapp_reply_reminders set status='cancelled' where source_kind='schedule' and source_id=new.id::text and status in ('waiting','pending');
 end if;return new;
end $$;
revoke all on function crm_private.reply_reminder_schedule() from public,anon,authenticated;
create trigger crm_reply_reminder_schedule after insert or update of whatsapp_reply_reminder,whatsapp_delivery_status,whatsapp_sent_at,status on public.agenda_items for each row execute function crm_private.reply_reminder_schedule();

-- Keep the existing, validated offer operation unchanged. The optional wrapper
-- creates the notice in the same transaction, before a queue worker can send.
create or replace function public.crm_create_offer_with_reply_reminder(p_args jsonb,p_reminder jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; item jsonb; offer public.crm_offer_instances%rowtype; rid uuid; job public.crm_server_automation_jobs%rowtype; existing public.crm_offer_outgoing_messages%rowtype; phone text; count_notices integer:=0;
begin
 if not coalesce((p_args->>'p_send_message')::boolean,false) then raise exception 'Activa el envío de la oferta para recordar su respuesta';end if;
 result:=public.crm_create_offer_composition((p_args->>'p_contact_id')::uuid,(p_args->>'p_manager_contact_id')::uuid,(p_args->>'p_recipient_contact_id')::uuid,(p_args->>'p_request_key')::uuid,p_args->'p_items',coalesce(p_args->>'p_composition','single'),p_args->>'p_group_message',coalesce(p_args->>'p_mode','followup'),(p_args->>'p_send_message')::boolean,(p_args->>'p_processing_date')::date,coalesce((p_args->>'p_test_mode')::boolean,false),coalesce((p_args->>'p_allow_duplicate')::boolean,false),(p_args->>'p_send_at')::timestamptz,coalesce((p_args->>'p_welcome')::boolean,false),nullif(p_args->'p_after_sale','null'::jsonb));
 for item in select value from jsonb_array_elements(result->'offers') loop
  select * into offer from public.crm_offer_instances where id=(item->>'offer_id')::uuid and created_by=auth.uid();
  if not found then raise exception 'No se pudo asociar el aviso a la oferta';end if;
  if offer.snapshot->>'group_leader_offer_id' is not null and offer.snapshot->>'group_leader_offer_id'<>offer.id::text then continue;end if;
  select * into job from public.crm_server_automation_jobs where user_id=auth.uid() and context->>'offer_instance_id'=offer.id::text and event_key in ('manual-offer:'||offer.id,'manual-offer-accepted:'||offer.id) limit 1;
  if not found then raise exception 'No se encontró el envío de la oferta';end if;
  phone:=coalesce(job.context->>'telefono',job.context->>'phone',job.context->>'customer_phone');
  rid:=public.crm_prepare_reply_reminder(phone,offer.message_text,p_reminder,'offer',offer.id::text);
  if (p_reminder->>'at')::timestamptz<=job.run_at then raise exception 'El aviso debe ser posterior al envío de la oferta';end if;
  select * into existing from public.crm_offer_outgoing_messages where offer_instance_id=offer.id and phase in ('initial','offer') order by sent_at limit 1;
  if found and exists(select 1 from public.crm_server_automation_jobs j where j.id=existing.job_id and j.status='done') then perform public.crm_arm_reply_reminder(rid,existing.provider_message_id,existing.sent_at);end if;
  count_notices:=count_notices+1;
 end loop;
 if count_notices=0 then raise exception 'No se pudo verificar el aviso';end if;
 return result||jsonb_build_object('reply_reminder_verified',true);
end $$;
revoke all on function public.crm_create_offer_with_reply_reminder(jsonb,jsonb) from public,anon;
grant execute on function public.crm_create_offer_with_reply_reminder(jsonb,jsonb) to authenticated;

create or replace function crm_private.reply_reminder_offer_sent() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='done' then
  update public.crm_whatsapp_reply_reminders r set sent_at=date_trunc('second',m.sent_at),message_id=m.provider_message_id
  from public.crm_offer_outgoing_messages m where m.job_id=new.id and m.phase in ('initial','offer') and r.source_kind='offer' and r.source_id=m.offer_instance_id::text and r.status='waiting';
 elsif new.status='cancelled' then
  update public.crm_whatsapp_reply_reminders set status='cancelled' where source_kind='offer' and source_id=new.context->>'offer_instance_id' and status='waiting' and (new.event_key in ('manual-offer:'||source_id,'manual-offer-accepted:'||source_id) or new.action_config->>'offer_phase'='initial');
 end if;return new;
end $$;
revoke all on function crm_private.reply_reminder_offer_sent() from public,anon,authenticated;
create trigger crm_reply_reminder_offer_sent after update of status on public.crm_server_automation_jobs for each row execute function crm_private.reply_reminder_offer_sent();
notify pgrst,'reload schema';
-- Reconcile before reading too, covering simultaneous receipt/arming and delayed webhooks.
create or replace function public.crm_list_reply_reminders() returns setof public.crm_whatsapp_reply_reminders
language plpgsql security invoker set search_path='' as $$
begin
 update public.crm_whatsapp_reply_reminders r set status='answered',answered_at=(select min(to_timestamp(m.ts)) from public.wa_messages m where m.chat_id=r.chat_id and m.direction='in' and m.ts>=extract(epoch from r.sent_at))
 where r.user_id=auth.uid() and r.status='pending' and exists(select 1 from public.wa_messages m where m.chat_id=r.chat_id and m.direction='in' and m.ts>=extract(epoch from r.sent_at));
 return query select * from public.crm_whatsapp_reply_reminders where user_id=auth.uid() order by case when status='pending' then 0 when status='waiting' then 1 else 2 end,due_at nulls last,created_at desc limit 300;
end $$;
revoke all on function public.crm_list_reply_reminders() from public,anon;
grant execute on function public.crm_list_reply_reminders() to authenticated;

create or replace function crm_private.reply_reminder_schedule_deleted() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.crm_whatsapp_reply_reminders set status='cancelled' where source_kind='schedule' and source_id=old.id::text and status in ('waiting','pending');return old;
end $$;
revoke all on function crm_private.reply_reminder_schedule_deleted() from public,anon,authenticated;
create trigger crm_reply_reminder_schedule_deleted after delete on public.agenda_items for each row execute function crm_private.reply_reminder_schedule_deleted();
notify pgrst,'reload schema';
