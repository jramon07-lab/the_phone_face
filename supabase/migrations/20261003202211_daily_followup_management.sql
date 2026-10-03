-- Opt-in timed pauses and audited correction. Existing customer records and deliveries are untouched.
alter table public.crm_offer_instances add column resume_at timestamptz, add column resume_job_id uuid references public.crm_server_automation_jobs(id) on delete set null;
create index offer_timed_pause_due on public.crm_offer_instances(resume_at) where status='paused' and resume_at is not null;
create index offer_timed_pause_job on public.crm_offer_instances(resume_job_id) where resume_job_id is not null;
alter table public.crm_installations add column confirmation_reset_at timestamptz;

create function crm_private.followup_send_slot(p_day date,p_clock time) returns timestamptz language plpgsql immutable set search_path='' as $$
declare d date:=p_day;t time:=coalesce(p_clock,'10:00'::time);dow integer;
begin
 for guard in 1..8 loop
  dow:=extract(isodow from d);
  if dow=7 then d:=d+1;continue;end if;
  if dow=6 and t>='14:00'::time then d:=d+2;continue;end if;
  if t<'10:00'::time then t:='10:00';
  elsif t>='14:00'::time and t<'17:30'::time then t:='17:30';
  elsif t>='20:30'::time then d:=d+1;t:='10:00';continue;end if;
  return (d+t) at time zone 'Europe/Madrid';
 end loop;raise exception 'No se pudo calcular la siguiente franja';
end;$$;
revoke all on function crm_private.followup_send_slot(date,time) from public,anon,authenticated;

create function public.crm_offer_pause_preview(p_offer_id uuid,p_days integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.crm_offer_instances%rowtype;due timestamptz;
begin
 if auth.uid() is null or not(public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso';end if;
 select * into f from public.crm_offer_instances where id=p_offer_id;
 if not found then raise exception 'Oferta no disponible';end if;
 if p_days is not null then
  if p_days<1 or p_days>365 then raise exception 'Elige entre 1 y 365 días';end if;
  if f.sent_at is null then raise exception 'Espera a que se envíe la oferta antes de programar su reanudación';end if;
  due:=crm_private.followup_send_slot((now() at time zone 'Europe/Madrid')::date+p_days,(f.sent_at at time zone 'Europe/Madrid')::time);
 end if;
 return jsonb_build_object('resume_at',due,'original_hour',to_char(f.sent_at at time zone 'Europe/Madrid','HH24:MI'),'days',p_days);
end;$$;
revoke all on function public.crm_offer_pause_preview(uuid,integer) from public,anon;
grant execute on function public.crm_offer_pause_preview(uuid,integer) to authenticated;

create function public.crm_pause_offer_days(p_offer_id uuid,p_days integer,p_reason text,p_expected_at timestamptz) returns jsonb language plpgsql security invoker set search_path='' as $$
declare f public.crm_offer_instances%rowtype;leader uuid;ids uuid[];due timestamptz;j public.crm_server_automation_jobs%rowtype;cfg jsonb;
begin
 if auth.uid() is null or not(public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso';end if;
 select * into f from public.crm_offer_instances where id=p_offer_id;
 if not found then raise exception 'Oferta no disponible';end if;
 leader:=coalesce(nullif(f.snapshot->>'group_leader_offer_id','')::uuid,f.id);
 perform pg_advisory_xact_lock(hashtextextended(leader::text,0));
 select * into f from public.crm_offer_instances where id=p_offer_id for update;
 if not found or f.updated_at is distinct from p_expected_at then raise exception 'La oferta cambió en otro equipo. Actualiza antes de guardar';end if;
 if f.status not in ('following','paused') then raise exception 'Solo se pausa un seguimiento que ya está enviado';end if;
 if nullif(btrim(p_reason),'') is null or length(p_reason)>500 then raise exception 'Indica el motivo de pausa (máximo 500 caracteres)';end if;
 due:=(public.crm_offer_pause_preview(f.id,p_days)->>'resume_at')::timestamptz;
 leader:=coalesce(nullif(f.snapshot->>'group_leader_offer_id','')::uuid,f.id);
 select array_agg(id) into ids from public.crm_offer_instances where id=leader or snapshot->>'group_leader_offer_id'=leader::text;
 if exists(select 1 from public.crm_server_automation_jobs where context->>'offer_instance_id'=leader::text and (status='running' or status in ('pending','paused','failed') and action_config ? '__delivery_receipt')) then raise exception 'Hay un mensaje en envío. Espera a que termine antes de pausar';end if;
 update public.crm_server_automation_jobs set status='cancelled',error_message='Pausa sustituida',updated_at=now() where id in(select resume_job_id from public.crm_offer_instances where id=any(ids)) and status='paused';
 perform public.crm_control_offer_composition(f.id,'pause');
 if due is not null then
  -- Reuse the established recipient/group flow; change its first wait and delivery date only.
  perform public.crm_control_offer_composition(f.id,'resume');
  select * into j from public.crm_server_automation_jobs where user_id=auth.uid() and context->>'offer_instance_id'=leader::text and event_key like 'manual-offer-resume:%' and status='pending' and created_at>=now() order by created_at desc,id desc limit 1;
  if j.id is null then raise exception 'No se pudo preparar el seguimiento';end if;
  select jsonb_agg(case when value->>'kind'='wait' then value||jsonb_build_object('business_schedule','phone_house','value',case when ord=1 then 0 else coalesce((value->>'value')::integer,0) end) else value end order by ord) into cfg from jsonb_array_elements(j.action_config->'steps') with ordinality a(value,ord);
  update public.crm_server_automation_jobs set action_config=jsonb_set(action_config,'{steps}',cfg),context=context||jsonb_build_object('event_at',due,'timed_offer_pause',leader),run_at=due,status='paused',updated_at=now() where id=j.id;
 end if;
 update public.crm_offer_instances set status='paused',pause_reason=btrim(p_reason),resume_at=due,resume_job_id=j.id,updated_at=clock_timestamp() where id=any(ids) and status in ('following','paused');
 return jsonb_build_object('ok',true,'resume_at',due,'shared_followup',array_length(ids,1)>1);
end;$$;
revoke all on function public.crm_pause_offer_days(uuid,integer,text,timestamptz) from public,anon;
grant execute on function public.crm_pause_offer_days(uuid,integer,text,timestamptz) to authenticated;

-- Clearing a timed pause on any state transition also cancels its dormant flow.
create function crm_private.clear_offer_timed_pause() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status<>'paused' and old.resume_job_id is not null then
  update public.crm_server_automation_jobs set status='cancelled',error_message='Pausa terminada por cambio de estado',updated_at=now() where id=old.resume_job_id and status='paused';
  if found then update public.crm_offer_instances set resume_at=null,resume_job_id=null where resume_job_id=old.resume_job_id and id<>old.id;end if;
  new.resume_at:=null;new.resume_job_id:=null;
 end if;return new;
end;$$;
revoke all on function crm_private.clear_offer_timed_pause() from public,anon,authenticated;
create trigger offer_clear_timed_pause before update on public.crm_offer_instances for each row execute function crm_private.clear_offer_timed_pause();

create or replace function public.crm_server_claim_jobs(p_limit integer default 20) returns setof public.crm_server_automation_jobs language plpgsql security definer set search_path='' as $$
declare j public.crm_server_automation_jobs%rowtype;leader uuid;
begin
 if not public.crm_server_automations_enabled() then return;end if;
 for j in select * from public.crm_server_automation_jobs where status='paused' and context ? 'timed_offer_pause' and run_at<=now() order by run_at,id limit 50 for update skip locked loop
  leader:=(j.context->>'timed_offer_pause')::uuid;
  if not pg_try_advisory_xact_lock(hashtextextended(leader::text,0)) then continue;end if;
  if exists(select 1 from public.crm_offer_instances where id=leader and status='paused' and resume_job_id=j.id and resume_at<=now()) and not exists(select 1 from public.crm_offer_instances where snapshot->>'group_leader_offer_id'=leader::text and status in ('accepted','processed','won','lost','cancelled')) then
   -- Make it pending before changing the offer: the state-change trigger cannot cancel it.
   update public.crm_server_automation_jobs set status='pending',updated_at=now() where id=j.id;
   update public.crm_offer_instances set status='following',updated_at=clock_timestamp() where resume_job_id=j.id and status='paused';
  else update public.crm_server_automation_jobs set status='cancelled',error_message='La oferta cambió durante la pausa',updated_at=now() where id=j.id;end if;
 end loop;
 return query with picked as(select id from public.crm_server_automation_jobs where status='pending' and run_at<=now() order by run_at,id for update skip locked limit greatest(1,least(coalesce(p_limit,20),50)))
 ,u as(update public.crm_server_automation_jobs claimed set status='running',attempts=claimed.attempts+1,updated_at=now(),error_message=null from picked p where claimed.id=p.id returning claimed.*) select * from u;
end;$$;
revoke all on function public.crm_server_claim_jobs(integer) from public,anon,authenticated;
grant execute on function public.crm_server_claim_jobs(integer) to service_role;

create table public.crm_installation_history(
 id uuid primary key default gen_random_uuid(),installation_id uuid not null references public.crm_installations(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,actor_name text not null,created_at timestamptz not null default now(),
 event_type text not null check(event_type='confirmation_cancelled'),reason text not null,previous jsonb not null
);
create index on public.crm_installation_history(installation_id,created_at desc);
create index on public.crm_installation_history(actor_id) where actor_id is not null;
alter table public.crm_installation_history enable row level security;
revoke all on public.crm_installation_history from public,anon,authenticated;
grant select on public.crm_installation_history to authenticated;
grant all on public.crm_installation_history to service_role;
create policy installation_history_read on public.crm_installation_history for select to authenticated using
 ((select public.current_user_is_admin()) or (select public.current_user_can('can_view_sales')));

create function public.crm_installation_cancel_confirmation(p_opportunity_id uuid,p_expected_at timestamptz,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.crm_installations%rowtype;o public.sales_opportunities%rowtype;
begin
 if auth.uid() is null or not(public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso';end if;
 if nullif(btrim(p_reason),'') is null or length(p_reason)>500 then raise exception 'Indica el motivo (máximo 500 caracteres)';end if;
 select * into o from public.sales_opportunities where id=p_opportunity_id for update;
 select * into i from public.crm_installations where opportunity_id=p_opportunity_id for update;
 if not found or i.updated_at is distinct from p_expected_at then raise exception 'La instalación cambió. Actualiza antes de anular';end if;
 if i.installed_on is null then raise exception 'No hay confirmación que anular';end if;
 if o.installation_date is not null or exists(select 1 from public.sales_stages where id=o.stage_id and lower(btrim(name))='ganado') then raise exception 'La activación del Excel no se anula desde aquí';end if;
 if exists(select 1 from public.crm_server_automation_jobs where context->>'installation_id'=i.id::text and (status='running' or status in ('pending','paused','failed') and action_config ? '__delivery_receipt')) then raise exception 'Hay un mensaje en envío. Espera a que termine antes de anular';end if;
 insert into public.crm_installation_history(installation_id,actor_id,actor_name,event_type,reason,previous) values(i.id,auth.uid(),coalesce(nullif(auth.jwt()->>'email',''),'Tienda'),'confirmation_cancelled',btrim(p_reason),to_jsonb(i));
 update public.crm_server_automation_jobs set status='cancelled',error_message='Confirmación de instalación anulada desde la tienda',updated_at=now() where context->>'installation_id'=i.id::text and status in ('pending','paused');
 update public.crm_installations set installed_on=null,confirmed_at=null,confirmed_by=null,confirmation_message_id=null,awaiting_date=false,return_job_id=null,return_due_at=null,confirmation_reset_at=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp() where id=i.id returning * into i;
 return to_jsonb(i);
end;$$;
revoke all on function public.crm_installation_cancel_confirmation(uuid,timestamptz,text) from public,anon;
grant execute on function public.crm_installation_cancel_confirmation(uuid,timestamptz,text) to authenticated;

CREATE OR REPLACE FUNCTION public.crm_installation_preview(p_opportunity_id uuid DEFAULT NULL::uuid, p_contact_id uuid DEFAULT NULL::uuid, p_manager_contact_id uuid DEFAULT NULL::uuid, p_recipient_contact_id uuid DEFAULT NULL::uuid, p_operator text DEFAULT NULL::text, p_netflix_followup boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v jsonb;cfg jsonb;o public.sales_opportunities%rowtype;f public.crm_offer_instances%rowtype;party jsonb;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso';end if;
 v:='{}'::jsonb;
 if p_opportunity_id is not null then
  select * into o from public.sales_opportunities where id=p_opportunity_id;if not found then raise exception 'Oportunidad no encontrada';end if;
  select * into f from public.crm_offer_instances where opportunity_id=o.id order by created_at desc limit 1;
  p_operator:=coalesce(f.operator,nullif(o.after_sale_preferences->>'operator',''),p_operator,o.installation_operator,(regexp_match(o.title,'(Vodafone|Yoigo|MásMóvil|Masmovil|O2|Orange|Lowi|Jazztel|Digi|Movistar|Pepephone)','i'))[1]);
  p_contact_id:=o.record_id;party:=o.contract_party;p_netflix_followup:=crm_private.offer_netflix_visible(f.snapshot);
 end if;
 if lower(p_operator)='masmovil' then p_operator:='MásMóvil';end if;
 if party is null and p_contact_id is not null then party:=crm_private.resolve_sale_party(p_contact_id,p_manager_contact_id,p_recipient_contact_id);end if;
 v:=jsonb_build_object('operator',p_operator,'preferences',o.after_sale_preferences,'netflix_followup',p_netflix_followup,'stage_name',(select name from public.sales_stages where id=o.stage_id));
 if party is not null then v:=v||jsonb_build_object('contract_party',party,'recipient',party->>'recipient_name','recipient_first_name',party->>'recipient_first_name','phone',party->>'recipient_phone');end if;
 cfg:=crm_private.installation_config(coalesce(v->>'operator',p_operator,''));
 return v||jsonb_build_object('workflow','installation_v1','available',length(coalesce(v->>'phone',''))>=8,'installation_config',cfg,'return_times',coalesce((select jsonb_object_agg(value->>'operator',value->>'return_time') from public.app_settings where key like 'crm_installation_template:%'),'{}'::jsonb),'opportunity_updated_at',o.updated_at,'excel_date',o.installation_date,'installation', (select to_jsonb(i)||jsonb_build_object('notice_status',nj.status,'notice_sent_at',nj.completed_at,'confirmation_history',coalesce((select jsonb_agg(jsonb_build_object('actor_name',h.actor_name,'created_at',h.created_at,'reason',h.reason,'installed_on',h.previous->>'installed_on','return_message',(select action_config->>'text' from public.crm_server_automation_jobs where id=nullif(h.previous->>'return_job_id','')::uuid),'return_sent_at',(select completed_at from public.crm_server_automation_jobs where id=nullif(h.previous->>'return_job_id','')::uuid)) order by h.created_at desc) from public.crm_installation_history h where h.installation_id=i.id),'[]'::jsonb),'return_status',rj.status,'return_sent_at',rj.completed_at,'return_message',rj.action_config->>'text') from public.crm_installations i left join public.crm_server_automation_jobs nj on nj.id=i.notice_job_id left join public.crm_server_automation_jobs rj on rj.id=i.return_job_id where opportunity_id=p_opportunity_id));
end;$function$;


create or replace function crm_private.installation_incoming() returns trigger language plpgsql security definer set search_path='' as $$
declare selected text;txt text;ph text;i public.crm_installations%rowtype;iid uuid;kind text;d date;m text[];quote_id text;matches integer;ctx jsonb;j uuid;pressed_at timestamptz;
begin
 if new.direction is distinct from 'in' or new.chat_id like '%@g.us' then return new;end if;
 selected:=coalesce(new.raw#>>'{messageData,interactiveButtonsResponse,interactiveButtonsResponse,selectedButtonId}',new.raw#>>'{interactiveButtonsResponse,interactiveButtonsResponse,selectedButtonId}',new.raw#>>'{messageData,interactiveButtonsResponse,selectedButtonId}',new.raw#>>'{messageData,interactiveButtonsResponse,selectedId}',new.raw#>>'{interactiveButtonsResponse,selectedButtonId}',new.raw#>>'{interactiveButtonsResponse,selectedId}',new.raw#>>'{messageData,buttonsResponseMessage,selectedButtonId}',new.raw#>>'{buttonsResponseMessage,selectedButtonId}',new.raw#>>'{messageData,templateButtonReplyMessage,selectedId}',new.raw#>>'{templateButtonReplyMessage,selectedId}','');
 ph:=public.crm_server_normalize_phone(split_part(new.chat_id,'@',1));txt:=lower(btrim(coalesce(new.text_content,'')));
 if selected ~ '^install_(done|today|yesterday|other):[0-9a-f-]{36}$' then
  iid:=split_part(selected,':',2)::uuid;kind:=split_part(selected,':',1);
  select * into i from public.crm_installations where id=iid for update;
 else
  quote_id:=coalesce(new.raw#>>'{messageData,interactiveButtonsResponse,stanzaId}',new.raw#>>'{interactiveButtonsResponse,stanzaId}',new.raw#>>'{messageData,quotedMessage,stanzaId}',new.raw#>>'{quotedMessage,stanzaId}',new.raw#>>'{extendedTextMessage,stanzaId}');
  if quote_id is not null then select x.* into i from public.crm_installations x join public.crm_installation_outgoing_messages sent on sent.installation_id=x.id where sent.provider_message_id=quote_id for update of x;end if;
  if quote_id is not null and i.id is null then return new;end if;
  if i.id is null and (txt in ('instalado','✓ instalado','hoy','ayer','otra fecha','1','2','3') or txt ~ '^\d{1,2}/\d{1,2}/\d{4}$') then
   select count(*) into matches from public.crm_installations x join public.sales_opportunities o on o.id=x.opportunity_id where x.installed_on is null and public.crm_server_normalize_phone(x.recipient_context->>'phone')=ph and o.status='open' and (txt in ('instalado','✓ instalado') or x.awaiting_date);
   if matches=1 then select x.* into i from public.crm_installations x join public.sales_opportunities o on o.id=x.opportunity_id where x.installed_on is null and public.crm_server_normalize_phone(x.recipient_context->>'phone')=ph and o.status='open' and (txt in ('instalado','✓ instalado') or x.awaiting_date) for update of x;end if;
  end if;
  kind:=case when txt in ('instalado','✓ instalado','1. ✓ instalado') then 'install_done' when i.awaiting_date and txt in ('hoy','1') then 'install_today' when i.awaiting_date and txt in ('ayer','2') then 'install_yesterday' when i.awaiting_date and txt in ('otra fecha','3') then 'install_other' when i.awaiting_date and txt ~ '^\d{1,2}/\d{1,2}/\d{4}$' then 'install_date' end;
 end if;
 if i.id is null or kind is null or i.installed_on is not null or public.crm_server_normalize_phone(i.recipient_context->>'phone') is distinct from ph then return new;end if;
 if not exists(select 1 from public.sales_opportunities o join public.sales_stages s on s.id=o.stage_id where o.id=i.opportunity_id and lower(btrim(s.name)) in ('tramitado','ganado')) then return new;end if;
 if kind='install_done' then
  pressed_at:=case when new.ts>0 then to_timestamp(new.ts::double precision/case when new.ts>1000000000000 then 1000 else 1 end) else new.created_at end;
  if pressed_at>clock_timestamp()+interval '5 minutes' then pressed_at:=new.created_at;end if;
  -- Backfilled history must not confirm a newly prepared installation.
  if pressed_at<i.created_at-interval '2 minutes' or pressed_at<i.confirmation_reset_at then return new;end if;
  d:=(pressed_at at time zone 'Europe/Madrid')::date;
 elsif not i.awaiting_date then return new;
 elsif kind='install_other' then
  perform crm_private.installation_enqueue(i.id,'date-other:'||new.id_message,i.config_snapshot->>'date_other_text','[]','installation_date',now());return new;
 elsif kind='install_today' then d:=(new.created_at at time zone 'Europe/Madrid')::date;
 elsif kind='install_yesterday' then d:=(new.created_at at time zone 'Europe/Madrid')::date-1;
 elsif kind='install_date' then
  m:=regexp_match(txt,'^(\d{1,2})/(\d{1,2})/(\d{4})$');
  begin d:=make_date(m[3]::integer,m[2]::integer,m[1]::integer);exception when others then d:=null;end;
 end if;
 if d is null or d>(now() at time zone 'Europe/Madrid')::date or d<(i.created_at at time zone 'Europe/Madrid')::date-30 then
  perform crm_private.installation_enqueue(i.id,'date-invalid:'||new.id_message,'Revisa la fecha: debe ser una fecha pasada o de hoy, con formato DD/MM/AAAA.','[]','installation_date',now());return new;end if;
 update public.crm_server_automation_jobs set status='cancelled',error_message='Instalación confirmada por el cliente',updated_at=now()
 where context->>'installation_id'=i.id::text and context->>'installation_phase' in ('installation_notice','installation_date') and status in ('pending','paused') and not action_config ? '__delivery_receipt';
 update public.crm_installations set installed_on=d,confirmed_at=coalesce(pressed_at,new.created_at),confirmation_source='customer',confirmed_by=null,confirmation_message_id=new.id_message,awaiting_date=false,updated_at=clock_timestamp() where id=i.id;
 perform crm_private.installation_schedule_return(i.id);
 -- No changes to sales_opportunities.installation_date, status, tags or 3m/11m.
 return new;
end;$$;



create or replace function crm_private.installation_schedule_return(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare i public.crm_installations%rowtype;txt text;confirmation text;j uuid;due timestamptz;reply_context jsonb;
begin
 select * into i from public.crm_installations where id=p_id for update;
 if not found or i.installed_on is null or i.return_job_id is not null then return;end if;
 reply_context:=i.recipient_context-'contract_party';
 confirmation:=crm_private.installation_render(i.config_snapshot->>'confirmed_text',i.config_snapshot,reply_context,i.appointment_date,i.time_from,i.time_to,i.installed_on);
 if i.previous_operator='Ninguno' then
  perform crm_private.installation_enqueue(i.id,'confirmed:'||i.revision,crm_private.contract_message(confirmation,i.recipient_context->'contract_party'),'[]','installation_confirmed',now());
  update public.crm_installations set return_due_at=null,incident='',updated_at=clock_timestamp() where id=i.id;return;
 end if;
 if nullif(btrim(i.previous_operator),'') is null or nullif(btrim(i.return_text),'') is null then
  perform crm_private.installation_enqueue(i.id,'confirmed:'||i.revision,crm_private.contract_message(confirmation,i.recipient_context->'contract_party'),'[]','installation_confirmed',now());
  update public.crm_installations set incident='Revisar compañía anterior e instrucciones de devolución',updated_at=clock_timestamp() where id=i.id;return;
 end if;
 -- This message responds to an installation confirmation. It has no commercial delay or window.
 due:=now();
 txt:=crm_private.installation_render(i.return_text,i.config_snapshot,reply_context,i.appointment_date,i.time_from,i.time_to,i.installed_on);
 -- The stored router block may contain the standard greeting. Keep a single greeting in the combined reply.
 txt:=regexp_replace(txt,E'^Hola [^\n]*\n[[:space:]]*','');
 if nullif(btrim(confirmation),'') is not null then txt:=confirmation||E'\n\n'||txt;end if;
 txt:=crm_private.contract_message(txt,i.recipient_context->'contract_party');
 j:=crm_private.installation_enqueue(i.id,'return:'||i.revision,txt,'[]','installation_return',due);
 update public.crm_installations set return_due_at=due,return_job_id=j,incident=case when j is null then 'Motor pausado: devolución pendiente de enviar' else '' end,updated_at=clock_timestamp() where id=i.id;
end;$$;



-- Manual resume keeps the sent offer's clock as well; groups retain the original recipient/context.
CREATE OR REPLACE FUNCTION public.crm_control_offer(p_offer_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid:=auth.uid();inst public.crm_offer_instances%rowtype;opp public.sales_opportunities%rowtype;
  stage public.sales_stages%rowtype;rule public.crm_automations%rowtype;flow jsonb;ctx jsonb;
  reply_buttons jsonb:=jsonb_build_array(
    jsonb_build_object('buttonId','offer_accept','buttonText','Me interesa'),
    jsonb_build_object('buttonId','offer_decline','buttonText','No me interesa'),
    jsonb_build_object('buttonId','offer_other','buttonText','Quiero otra oferta')
  );
begin
  if uid is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para modificar ofertas';end if;
  select * into inst from public.crm_offer_instances where id=p_offer_id;if not found then raise exception 'Oferta no encontrada';end if;
  select * into opp from public.sales_opportunities where id=inst.opportunity_id;if not found then raise exception 'Oportunidad no encontrada';end if;
  if p_action='pause' then
    update public.crm_server_automation_jobs set status='cancelled',error_message='Seguimiento pausado manualmente',updated_at=now()
      where status in ('pending','running') and context->>'offer_instance_id'=inst.id::text;
    update public.crm_offer_instances set status='paused' where id=inst.id;
  elsif p_action='accept' then
    select * into stage from public.sales_stages where active and pipeline_id=opp.pipeline_id and lower(btrim(name))='pendiente de tramitar' order by position limit 1;
    if stage.id is null then raise exception 'Falta la columna Pendiente de tramitar';end if;
    update public.crm_offer_instances set status='accepted',accepted_at=coalesce(accepted_at,now()) where id=inst.id;
    update public.sales_opportunities set stage_id=stage.id,updated_at=now() where id=opp.id;
  elsif p_action='cancel' then
    update public.crm_server_automation_jobs set status='cancelled',error_message='Seguimiento finalizado manualmente',updated_at=now()
      where status in ('pending','running') and context->>'offer_instance_id'=inst.id::text;
    update public.crm_offer_instances set status='cancelled' where id=inst.id;
  elsif p_action='resume' then
    select * into rule from public.crm_automations where user_id=uid and trigger_type='manual_offer' and enabled order by created_at limit 1;
    if not found then raise exception 'La automatización general de ofertas no está activa';end if;
    select * into stage from public.sales_stages where active and pipeline_id=opp.pipeline_id and lower(btrim(name))='tramitado' order by position limit 1;
    flow:=jsonb_build_object('version',1,'lifecycle',jsonb_build_object('mode','offer','version',2,'stop_stage_ids',jsonb_build_array(
      (select id::text from public.sales_stages where active and pipeline_id=opp.pipeline_id and lower(btrim(name))='pendiente de tramitar' order by position limit 1),stage.id::text)),'steps',jsonb_build_array(
      jsonb_build_object('kind','wait','unit','days','business_schedule','phone_house','value',2),jsonb_build_object('kind','condition','condition_type','no_response'),
      jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object(
        'text','Hola {nombre}, ¿has podido revisar la oferta de {operador} por {precio_total} €/mes? Si tienes alguna duda, te ayudo por aquí.',
        'offer_phase','reminder_2','reply_buttons',reply_buttons)),
      jsonb_build_object('kind','wait','unit','days','business_schedule','phone_house','value',3),jsonb_build_object('kind','condition','condition_type','no_response'),
      jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object(
        'text','Hola, {nombre}. Vuelvo a escribirte sobre la oferta de {operador}, por si quieres que la revisemos juntos o prefieres dejarla para más adelante. Dime qué te viene mejor.',
        'offer_phase','reminder_5','reply_buttons',reply_buttons))));
    rule.action_config:=flow;
    ctx:=public.crm_server_context_for_contact(inst.contact_id,opp.phone)||jsonb_build_object(
      'opportunity_id',opp.id,'offer_instance_id',inst.id,'operator',inst.operator,
      'precio_total',to_char(inst.total_price,'FM999999990D00'),'trigger_type','manual_offer','event_at',((now() at time zone 'Europe/Madrid')::date+coalesce((inst.sent_at at time zone 'Europe/Madrid')::time,'10:00'::time)) at time zone 'Europe/Madrid');
    perform public.crm_server_enqueue(rule,'manual-offer-resume:'||inst.id||':'||extract(epoch from now())::bigint,ctx);
    update public.crm_offer_instances set status='following' where id=inst.id;
  else raise exception 'Acción no válida';end if;
  return jsonb_build_object('ok',true,'action',p_action,'offer_id',inst.id);
end $function$
;
CREATE OR REPLACE FUNCTION public.crm_control_offer_composition(p_offer_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare inst public.crm_offer_instances%rowtype; leader public.crm_offer_instances%rowtype; ids uuid[]; r jsonb; old_context jsonb; resumed_id uuid;
begin
 select * into inst from public.crm_offer_instances where id=p_offer_id;
 if not found then raise exception 'Oferta no encontrada';end if;
 if inst.snapshot->>'composition' is distinct from 'group' then return public.crm_control_offer(p_offer_id,p_action);end if;
 if inst.created_by<>auth.uid() or not(public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para modificar este grupo';end if;
 select * into leader from public.crm_offer_instances where id=(inst.snapshot->>'group_leader_offer_id')::uuid and created_by=auth.uid();
 if not found or not(leader.snapshot->'offer_group_ids' ? inst.id::text) then raise exception 'Grupo de ofertas inválido';end if;
 select array_agg(id) into ids from public.crm_offer_instances where created_by=auth.uid() and snapshot->>'group_leader_offer_id'=leader.id::text;
 perform pg_advisory_xact_lock(hashtextextended(leader.id::text,0));
 if p_action='accept' then
  r:=public.crm_control_offer(p_offer_id,p_action);
  update public.crm_server_automation_jobs set status='cancelled',error_message='Cliente respondió: servicio aceptado; revisar el resto del grupo',updated_at=now() where user_id=auth.uid() and context->>'offer_instance_id'=leader.id::text and status in ('pending','running');
   update public.crm_offer_instances set status='paused' where id=any(ids) and status in ('queued','following');
 elsif p_action in ('pause','cancel') then
  r:=public.crm_control_offer(leader.id,p_action);
  update public.crm_offer_instances set status=case when p_action='pause' then 'paused' else 'cancelled' end where id=any(ids) and status in ('queued','following','paused','error');
 elsif p_action='resume' then
  if leader.status not in ('paused','following','queued') or exists(select 1 from public.crm_offer_instances where id=any(ids) and status in ('accepted','processed','won')) then raise exception 'Este grupo ya tiene un servicio aceptado. Prepara otro seguimiento para los servicios pendientes';end if;
  select context into old_context from public.crm_server_automation_jobs where user_id=auth.uid() and context->>'offer_instance_id'=leader.id::text and event_key='manual-offer:'||leader.id order by created_at limit 1;
  r:=public.crm_control_offer(leader.id,p_action);
  select id into resumed_id from public.crm_server_automation_jobs where user_id=auth.uid() and context->>'offer_instance_id'=leader.id::text and event_key like 'manual-offer-resume:%' order by created_at desc limit 1;
  update public.crm_server_automation_jobs j set context=coalesce(old_context,j.context)||jsonb_build_object('offer_group_ids',to_jsonb(ids),'event_at',((now() at time zone 'Europe/Madrid')::date+coalesce((leader.sent_at at time zone 'Europe/Madrid')::time,'10:00'::time)) at time zone 'Europe/Madrid'),
  action_config=jsonb_set(action_config,'{steps}',(select jsonb_agg(case when value->>'kind'='action' then jsonb_set(value,'{config}',(value->'config')-'reply_buttons'||jsonb_build_object('text','Hola {nombre}, ¿has podido revisar las ofertas que te enviamos? Si tienes alguna duda, te ayudo por aquí.'),true) else value end order by ord) from jsonb_array_elements(action_config->'steps') with ordinality a(value,ord)),true) where j.id=resumed_id;
  update public.crm_offer_instances set status='following' where id=any(ids) and status='paused';
 else raise exception 'Acción no válida';end if;
 return r||jsonb_build_object('shared_followup',true);
end $function$
;
notify pgrst,'reload schema';
