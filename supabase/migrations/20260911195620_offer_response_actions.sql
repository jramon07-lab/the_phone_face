-- Customer-controlled offer follow-up actions.
-- Ordinary written replies remain informational. Only verified interactive
-- buttons (plus the requested free text after "Otro motivo") mutate the CRM.

create table if not exists public.crm_offer_outgoing_messages (
  provider_message_id text primary key,
  offer_instance_id uuid not null references public.crm_offer_instances(id) on delete cascade,
  job_id uuid references public.crm_server_automation_jobs(id) on delete set null,
  phase text not null,
  sent_at timestamptz not null default now()
);

create index if not exists crm_offer_outgoing_messages_offer_idx
  on public.crm_offer_outgoing_messages(offer_instance_id,sent_at desc);
create index if not exists crm_offer_outgoing_messages_job_idx
  on public.crm_offer_outgoing_messages(job_id);

alter table public.crm_offer_outgoing_messages enable row level security;
revoke all on public.crm_offer_outgoing_messages from public,anon,authenticated;
grant all on public.crm_offer_outgoing_messages to service_role;

create table if not exists public.crm_offer_response_states (
  offer_instance_id uuid primary key references public.crm_offer_instances(id) on delete cascade,
  opportunity_id uuid not null references public.sales_opportunities(id) on delete cascade,
  contact_id uuid not null references public.records(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('accept','decline','alternative')),
  state text not null check (state in ('decided','awaiting_reason','awaiting_text','resolved')),
  reason text,
  decision_message_id text,
  decided_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists crm_offer_response_states_contact_idx
  on public.crm_offer_response_states(contact_id,state,updated_at desc);
create index if not exists crm_offer_response_states_opportunity_idx
  on public.crm_offer_response_states(opportunity_id);
create index if not exists crm_offer_response_states_user_idx
  on public.crm_offer_response_states(user_id);

alter table public.crm_offer_response_states enable row level security;
revoke all on public.crm_offer_response_states from public,anon,authenticated;
grant all on public.crm_offer_response_states to service_role;

alter table public.crm_offer_followup_events
  drop constraint if exists crm_offer_followup_events_event_type_check;
alter table public.crm_offer_followup_events
  add constraint crm_offer_followup_events_event_type_check check (event_type in (
    'response_cancelled','pre_send_blocked','verification_deferred',
    'delivery_deferred','followup_failed','followup_sent',
    'offer_interest','offer_declined','offer_alternative_requested',
    'decline_reason_requested','decline_reason_saved','button_ignored'
  ));

create or replace function crm_private.offer_next_business_date(p_at timestamptz)
returns date
language plpgsql
stable
set search_path=''
as $$
declare result date:=(p_at at time zone 'Europe/Madrid')::date+1;
begin
  if extract(isodow from result)=7 then result:=result+1;end if;
  return result;
end $$;
revoke all on function crm_private.offer_next_business_date(timestamptz) from public,anon,authenticated;

create or replace function crm_private.offer_response_action(p_raw jsonb,p_type text,p_text text)
returns text
language plpgsql
immutable
set search_path=''
as $$
declare
  selected text:=coalesce(
    p_raw#>>'{messageData,interactiveButtonsResponse,selectedButtonId}',
    p_raw#>>'{messageData,interactiveButtonsResponse,selectedId}',
    p_raw#>>'{interactiveButtonsResponse,selectedButtonId}',
    p_raw#>>'{interactiveButtonsResponse,selectedId}',
    p_raw#>>'{messageData,buttonsResponseMessage,selectedButtonId}',
    p_raw#>>'{buttonsResponseMessage,selectedButtonId}',
    p_raw#>>'{messageData,templateButtonReplyMessage,selectedId}',
    p_raw#>>'{templateButtonReplyMessage,selectedId}',
    ''
  );
  normalized text;
  interactive boolean;
begin
  interactive:=btrim(selected)<>'' or lower(coalesce(p_type,'')) like '%button%';
  if not interactive then return null;end if;
  normalized:=translate(lower(btrim(coalesce(nullif(selected,''),p_text,''))),'áéíóúüñ','aeiouun');
  return case normalized
    when 'offer_accept' then 'accept'
    when 'acepto' then 'accept'
    when 'me interesa' then 'accept'
    when 'offer_decline' then 'decline'
    when 'no me interesa' then 'decline'
    when 'offer_other' then 'alternative'
    when 'quiero mirar otra cosa' then 'alternative'
    when 'quiero otra oferta' then 'alternative'
    when 'offer_reason_price' then 'reason_price'
    when 'es por el precio' then 'reason_price'
    when 'offer_reason_same' then 'reason_same'
    when 'prefiero seguir igual' then 'reason_same'
    when 'offer_reason_more' then 'reason_more'
    when 'mas opciones' then 'reason_more'
    when 'offer_reason_later' then 'reason_later'
    when 'mas adelante' then 'reason_later'
    when 'offer_reason_other' then 'reason_other'
    when 'otro motivo' then 'reason_other'
    when 'offer_reason_back' then 'reason_back'
    when 'volver' then 'reason_back'
    else null
  end;
end $$;
revoke all on function crm_private.offer_response_action(jsonb,text,text) from public,anon,authenticated;

create or replace function crm_private.offer_remove_month_label(p_offer public.crm_offer_instances)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare tracked crm_private.opportunity_month_labels%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_offer.contact_id::text,7741));
  select * into tracked from crm_private.opportunity_month_labels
    where opportunity_id=p_offer.opportunity_id for update;
  if tracked.offer_label_id is null then return;end if;
  update crm_private.opportunity_month_labels set offer_label_id=null
    where opportunity_id=p_offer.opportunity_id;
  if not exists(
    select 1
    from crm_private.opportunity_month_labels labels
    join public.crm_offer_instances active_offer on active_offer.opportunity_id=labels.opportunity_id
    where labels.contact_id=p_offer.contact_id
      and labels.offer_label_id=tracked.offer_label_id
      and labels.opportunity_id<>p_offer.opportunity_id
      and active_offer.status in ('queued','following','paused','accepted')
  ) then
    delete from public.crm_contact_labels
      where contact_id=p_offer.contact_id and label_id=tracked.offer_label_id;
  end if;
end $$;
revoke all on function crm_private.offer_remove_month_label(public.crm_offer_instances) from public,anon,authenticated;

create or replace function crm_private.offer_append_loss_reason(p_opportunity_id uuid,p_reason text,p_pending boolean default false)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare marker text:='Motivo de pérdida:';existing text;line text;
begin
  select coalesce(notes,'') into existing from public.sales_opportunities where id=p_opportunity_id for update;
  line:=marker||' '||case when p_pending then 'pendiente de indicar' else btrim(coalesce(p_reason,'Sin indicar')) end;
  if existing like '%'||marker||'%' then
    existing:=regexp_replace(existing,'Motivo de pérdida:[^\n]*',line,'g');
  else
    existing:=btrim(existing||case when btrim(existing)='' then '' else E'\n' end||line);
  end if;
  update public.sales_opportunities set notes=existing,updated_at=now() where id=p_opportunity_id;
end $$;
revoke all on function crm_private.offer_append_loss_reason(uuid,text,boolean) from public,anon,authenticated;

create or replace function crm_private.offer_enqueue_message(
  p_offer public.crm_offer_instances,p_event_key text,p_text text,p_buttons jsonb default '[]'::jsonb,p_phase text default 'response'
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare rule public.crm_automations%rowtype;opp public.sales_opportunities%rowtype;ctx jsonb;
begin
  select * into opp from public.sales_opportunities where id=p_offer.opportunity_id;
  select * into rule from public.crm_automations
    where user_id=p_offer.created_by and trigger_type='manual_offer'
    order by enabled desc,created_at limit 1;
  ctx:=public.crm_server_context_for_contact(p_offer.contact_id,opp.phone)||jsonb_build_object(
    'opportunity_id',p_offer.opportunity_id,'offer_instance_id',p_offer.id,
    'operator',p_offer.operator,'precio_total',to_char(p_offer.total_price,'FM999999990D00'),
    'event_at',now(),'lifecycle',jsonb_build_object('mode','offer_response','version',2)
  );
  insert into public.crm_server_automation_jobs(
    automation_id,user_id,event_key,action_type,action_config,context,run_at,status
  ) values(
    rule.id,p_offer.created_by,p_event_key,'__send_whatsapp',
    jsonb_build_object('text',p_text,'reply_buttons',coalesce(p_buttons,'[]'::jsonb),'offer_phase',p_phase),
    ctx,now(),'pending'
  ) on conflict(automation_id,event_key) do nothing;
end $$;
revoke all on function crm_private.offer_enqueue_message(public.crm_offer_instances,text,text,jsonb,text) from public,anon,authenticated;

create or replace function crm_private.offer_cancel_reminders(p_offer_id uuid,p_reason text)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare changed integer;
begin
  update public.crm_server_automation_jobs
  set status='cancelled',error_message=p_reason,updated_at=now()
  where status in ('pending','running')
    and context->>'offer_instance_id'=p_offer_id::text
    and action_type not in ('record_offer_month','record_sale_month');
  get diagnostics changed=row_count;
  return changed;
end $$;
revoke all on function crm_private.offer_cancel_reminders(uuid,text) from public,anon,authenticated;

create or replace function crm_private.offer_event(
  p_message public.wa_messages,p_offer public.crm_offer_instances,p_type text,p_detail text,p_result text default 'success'
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.crm_offer_followup_events(
    event_key,offer_instance_id,opportunity_id,contact_id,user_id,message_id,
    event_type,result,response_text,detail,created_at
  ) values(
    'incoming:'||p_message.id::text||':'||p_offer.id::text||':'||p_type,
    p_offer.id,p_offer.opportunity_id,p_offer.contact_id,p_offer.created_by,p_message.id_message,
    p_type,p_result,left(coalesce(p_message.text_content,''),80),left(coalesce(p_detail,''),500),p_message.created_at
  ) on conflict(event_key) do nothing;
end $$;
revoke all on function crm_private.offer_event(public.wa_messages,public.crm_offer_instances,text,text,text) from public,anon,authenticated;

-- A normal written answer no longer satisfies the commercial offer guard.
-- Explicit button state, a configured stop column or a commercial opt-out do.
create or replace function public.crm_lifecycle_job_guard(p_job uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  j public.crm_server_automation_jobs%rowtype;p jsonb;cid uuid;oid uuid;offer_id uuid;
  reason text;prev public.crm_server_automation_jobs%rowtype;ph text;
begin
  select * into j from public.crm_server_automation_jobs where id=p_job;
  if not found or j.status<>'running' then return jsonb_build_object('allow',false,'reason','Ejecución detenida');end if;
  p:=j.context->'lifecycle';
  if coalesce(p->>'mode','') not in ('offer','after_sale') then return jsonb_build_object('allow',true,'context',j.context);end if;
  cid:=nullif(j.context->>'contact_id','')::uuid;
  oid:=nullif(j.context->>'opportunity_id','')::uuid;
  offer_id:=nullif(j.context->>'offer_instance_id','')::uuid;
  ph:=public.crm_server_normalize_phone(j.context->>'phone');
  if j.action_type in ('record_offer_month','record_sale_month') then
    if cid is null or oid is null or not exists(select 1 from public.sales_opportunities where id=oid and record_id=cid) then reason:='Oportunidad no disponible';end if;
  elsif not public.crm_server_automations_enabled() then reason:='Motor pausado';
  elsif not exists(select 1 from public.crm_automations where id=j.automation_id and enabled) then reason:='Automatización pausada';
  elsif cid is null or not exists(select 1 from public.records where id=cid) then reason:='Contacto no disponible';
  elsif exists(select 1 from public.crm_automation_contact_exclusions where automation_id=j.automation_id and contact_id=cid) then reason:='Contacto excluido';
  elsif exists(select 1 from crm_private.commercial_optouts where phone=ph or contact_id=cid) then reason:='Baja comercial solicitada';
  elsif p->>'mode'='offer' then
    if nullif(p->>'label_id','') is not null and not exists(select 1 from public.crm_contact_labels where contact_id=cid and label_id::text=p->>'label_id') then reason:='Etiqueta de seguimiento retirada';
    elsif exists(select 1 from public.sales_opportunities o where o.record_id=cid and (oid is null or o.id=oid) and coalesce(p->'stop_stage_ids','[]'::jsonb) ? o.stage_id::text) then reason:='Oferta pasa a tramitación';
    elsif offer_id is not null and exists(select 1 from public.crm_offer_response_states where offer_instance_id=offer_id) then reason:='Cliente eligió una respuesta de la oferta';
    end if;
  elsif p->>'mode'='after_sale' then
    if oid is null or not exists(select 1 from public.sales_opportunities where id=oid and record_id=cid and stage_id::text=p->>'stage_id') then reason:='Oportunidad fuera de Tramitado';end if;
  end if;
  if reason is not null then
    update public.crm_server_automation_jobs set status='cancelled',error_message=reason,updated_at=now()
      where id=j.id and status in ('pending','running');
    return jsonb_build_object('allow',false,'reason',reason);
  end if;
  if nullif(j.action_config->>'__previous_event','') is not null then
    select * into prev from public.crm_server_automation_jobs where automation_id=j.automation_id and event_key=j.action_config->>'__previous_event';
    if not found or prev.status in ('pending','running') then return jsonb_build_object('allow',false,'retry',true,'reason','Esperando el paso anterior');end if;
    if prev.status<>'done' or exists(select 1 from public.crm_automation_runs where automation_id=prev.automation_id and event_key=prev.event_key and context->>'skipped'='true') then
      update public.crm_server_automation_jobs set status='cancelled',error_message='Paso anterior no completado',updated_at=now() where id=j.id and status='running';
      return jsonb_build_object('allow',false,'reason','Paso anterior no completado');
    end if;
  end if;
  return jsonb_build_object('allow',true,'context',j.context);
end $$;
revoke all on function public.crm_lifecycle_job_guard(uuid) from public,anon,authenticated;
grant execute on function public.crm_lifecycle_job_guard(uuid) to service_role;

create or replace function crm_private.lifecycle_incoming()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  ph text;cid uuid;optout boolean;selected text;quoted_id text;
  current_state public.crm_offer_response_states%rowtype;
  offer public.crm_offer_instances%rowtype;opp public.sales_opportunities%rowtype;
  stage_name text;target_stage public.sales_stages%rowtype;
  jobs_cancelled integer:=0;reason_text text;next_date date;
  first_reason_buttons jsonb:=jsonb_build_array(
    jsonb_build_object('buttonId','offer_reason_price','buttonText','Es por el precio'),
    jsonb_build_object('buttonId','offer_reason_same','buttonText','Prefiero seguir igual'),
    jsonb_build_object('buttonId','offer_reason_more','buttonText','Más opciones')
  );
  more_reason_buttons jsonb:=jsonb_build_array(
    jsonb_build_object('buttonId','offer_reason_later','buttonText','Más adelante'),
    jsonb_build_object('buttonId','offer_reason_other','buttonText','Otro motivo'),
    jsonb_build_object('buttonId','offer_reason_back','buttonText','Volver')
  );
begin
  if new.direction is distinct from 'in' or new.chat_id like '%@g.us' then return new;end if;
  ph:=public.crm_server_normalize_phone(split_part(new.chat_id,'@',1));
  if ph is null or length(ph)<8 then return new;end if;
  cid:=public.crm_server_contact_for_phone(ph);
  selected:=crm_private.offer_response_action(new.raw,new.type_message,new.text_content);
  quoted_id:=coalesce(
    new.raw#>>'{messageData,interactiveButtonsResponse,stanzaId}',
    new.raw#>>'{interactiveButtonsResponse,stanzaId}',
    new.raw#>>'{messageData,quotedMessage,stanzaId}',
    new.raw#>>'{quotedMessage,stanzaId}'
  );

  -- The only free-text exception: it is consumed after the customer explicitly
  -- chose "Otro motivo" for a declined offer.
  select * into current_state
  from public.crm_offer_response_states
  where contact_id=cid and state in ('awaiting_reason','awaiting_text')
  order by updated_at desc limit 1 for update;

  if current_state.offer_instance_id is not null and current_state.state='awaiting_text'
     and selected is null and btrim(coalesce(new.text_content,''))<>'' then
    select * into offer from public.crm_offer_instances where id=current_state.offer_instance_id;
    reason_text:=left(btrim(new.text_content),500);
    update public.crm_offer_response_states set state='resolved',reason=reason_text,resolved_at=new.created_at,updated_at=now()
      where offer_instance_id=offer.id and state='awaiting_text';
    perform crm_private.offer_append_loss_reason(offer.opportunity_id,reason_text,false);
    perform crm_private.offer_event(new,offer,'decline_reason_saved','Motivo escrito guardado');
    insert into public.crm_telegram_business_events(topic,event_type,entity_type,entity_id,payload)
    select 'offers','offer_decline_reason','offer',offer.id,jsonb_build_object(
      'contact_id',offer.contact_id,'opportunity_id',offer.opportunity_id,
      'client_name',coalesce(o.client_name,''),'phone',coalesce(o.phone,''),
      'operator',offer.operator,'offer_name',offer.offer_name,'total_price',offer.total_price,
      'reason',reason_text
    ) from public.sales_opportunities o where o.id=offer.opportunity_id;
    return new;
  end if;

  if current_state.offer_instance_id is not null and current_state.state='awaiting_reason'
     and selected like 'reason_%' then
    select * into offer from public.crm_offer_instances where id=current_state.offer_instance_id;
    if selected='reason_more' then
      perform crm_private.offer_enqueue_message(offer,'offer-reason-more:'||offer.id,
        'Elige el motivo que mejor encaje:',more_reason_buttons,'decline_reason_more');
      return new;
    elsif selected='reason_back' then
      perform crm_private.offer_enqueue_message(offer,'offer-reason-back:'||offer.id||':'||new.id,
        'Gracias por responder. ¿Cuál es el motivo principal?',first_reason_buttons,'decline_reason_prompt');
      return new;
    elsif selected='reason_other' then
      update public.crm_offer_response_states set state='awaiting_text',reason='Otro motivo',updated_at=now()
        where offer_instance_id=offer.id and state='awaiting_reason';
      perform crm_private.offer_enqueue_message(offer,'offer-reason-text:'||offer.id,
        'Cuéntanos brevemente el motivo.','[]'::jsonb,'decline_reason_text');
      return new;
    end if;
    reason_text:=case selected when 'reason_price' then 'Es por el precio'
      when 'reason_same' then 'Prefiero seguir igual'
      when 'reason_later' then 'Más adelante' end;
    if reason_text is not null then
      update public.crm_offer_response_states set state='resolved',reason=reason_text,resolved_at=new.created_at,updated_at=now()
        where offer_instance_id=offer.id and state='awaiting_reason';
      perform crm_private.offer_append_loss_reason(offer.opportunity_id,reason_text,false);
      perform crm_private.offer_event(new,offer,'decline_reason_saved','Motivo seleccionado guardado');
      insert into public.crm_telegram_business_events(topic,event_type,entity_type,entity_id,payload)
      select 'offers','offer_decline_reason','offer',offer.id,jsonb_build_object(
        'contact_id',offer.contact_id,'opportunity_id',offer.opportunity_id,
        'client_name',coalesce(o.client_name,''),'phone',coalesce(o.phone,''),
        'operator',offer.operator,'offer_name',offer.offer_name,'total_price',offer.total_price,
        'reason',reason_text
      ) from public.sales_opportunities o where o.id=offer.opportunity_id;
    end if;
    return new;
  end if;

  -- Written replies, including words that happen to match a button label, do
  -- not change anything unless GREEN identifies them as an interactive reply.
  if selected is null or selected not in ('accept','decline','alternative') then
    optout:=crm_private.is_commercial_optout(new.text_content);
    if optout then
      insert into crm_private.commercial_optouts(phone,contact_id,received_at)
      values(ph,cid,new.created_at)
      on conflict(phone) do update set contact_id=coalesce(excluded.contact_id,crm_private.commercial_optouts.contact_id),received_at=excluded.received_at;
      update public.crm_server_automation_jobs j
      set status='cancelled',error_message='Baja comercial solicitada',updated_at=now()
      where j.status in ('pending','running')
        and j.context#>>'{lifecycle,mode}'='after_sale'
        and (j.context->>'contact_id'=cid::text or public.crm_server_normalize_phone(j.context->>'phone')=ph);
    end if;
    return new;
  end if;

  if quoted_id is not null then
    select i.* into offer
    from public.crm_offer_outgoing_messages sent
    join public.crm_offer_instances i on i.id=sent.offer_instance_id
    where sent.provider_message_id=quoted_id;
  end if;
  if offer.id is null then
    select i.* into offer
    from public.crm_offer_instances i
    join public.sales_opportunities o on o.id=i.opportunity_id
    join public.sales_stages s on s.id=o.stage_id
    where i.contact_id=cid and i.created_at<=new.created_at
      and i.status in ('queued','following','paused')
      and lower(btrim(s.name)) in ('seguimiento','oferta pasada')
    order by coalesce(i.sent_at,i.created_at) desc limit 1;
  end if;
  if offer.id is null then return new;end if;

  perform pg_advisory_xact_lock(hashtextextended(offer.id::text,8851));
  select * into current_state from public.crm_offer_response_states where offer_instance_id=offer.id for update;
  select * into opp from public.sales_opportunities where id=offer.opportunity_id for update;
  select lower(btrim(name)) into stage_name from public.sales_stages where id=opp.stage_id;
  if current_state.offer_instance_id is not null or stage_name not in ('seguimiento','oferta pasada') then
    perform crm_private.offer_event(new,offer,'button_ignored','La oportunidad ya había cambiado; no se sobrescribió','info');
    insert into public.crm_telegram_business_events(topic,event_type,entity_type,entity_id,payload)
    values('followups','offer_response_ignored','offer',offer.id,jsonb_build_object(
      'contact_id',offer.contact_id,'opportunity_id',offer.opportunity_id,'client_name',coalesce(opp.client_name,''),
      'phone',coalesce(opp.phone,''),'operator',offer.operator,'offer_name',offer.offer_name,
      'response',coalesce(new.text_content,''),'stage_name',coalesce(stage_name,'')
    ));
    return new;
  end if;

  jobs_cancelled:=crm_private.offer_cancel_reminders(offer.id,'Cliente eligió una respuesta de la oferta');
  next_date:=crm_private.offer_next_business_date(new.created_at);

  if selected='accept' then
    insert into public.crm_offer_response_states(offer_instance_id,opportunity_id,contact_id,user_id,action,state,decision_message_id,decided_at)
    values(offer.id,offer.opportunity_id,offer.contact_id,offer.created_by,'accept','decided',new.id_message,new.created_at);
    select * into target_stage from public.sales_stages
      where active and pipeline_id=opp.pipeline_id and lower(btrim(name))='pendiente de tramitar'
      order by position limit 1;
    if target_stage.id is null then raise exception 'Falta la columna Pendiente de tramitar';end if;
    update public.sales_opportunities set stage_id=target_stage.id,expected_date=next_date,status='open',updated_at=now()
      where id=opp.id;
    perform crm_private.offer_event(new,offer,'offer_interest',jobs_cancelled||' recordatorio(s) cancelado(s)');

  elsif selected='decline' then
    insert into public.crm_offer_response_states(offer_instance_id,opportunity_id,contact_id,user_id,action,state,reason,decision_message_id,decided_at)
    values(offer.id,offer.opportunity_id,offer.contact_id,offer.created_by,'decline','awaiting_reason','Pendiente de indicar',new.id_message,new.created_at);
    select * into target_stage from public.sales_stages
      where active and pipeline_id=opp.pipeline_id and lower(btrim(name))='perdido'
      order by position limit 1;
    if target_stage.id is null then raise exception 'Falta la columna Perdido';end if;
    perform crm_private.offer_append_loss_reason(opp.id,'',true);
    update public.sales_opportunities set stage_id=target_stage.id,expected_date=(new.created_at at time zone 'Europe/Madrid')::date,status='lost',updated_at=now()
      where id=opp.id;
    perform crm_private.offer_remove_month_label(offer);
    perform crm_private.offer_enqueue_message(offer,'offer-reason:'||offer.id,
      'Gracias por responder, {nombre}. Para ayudarnos a mejorar, ¿cuál es el motivo principal?',
      first_reason_buttons,'decline_reason_prompt');
    perform crm_private.offer_event(new,offer,'offer_declined',jobs_cancelled||' recordatorio(s) cancelado(s); esperando motivo');
    insert into public.crm_telegram_business_events(topic,event_type,entity_type,entity_id,payload)
    values('offers','offer_declined','offer',offer.id,jsonb_build_object(
      'contact_id',offer.contact_id,'opportunity_id',offer.opportunity_id,'client_name',coalesce(opp.client_name,''),
      'phone',coalesce(opp.phone,''),'operator',offer.operator,'offer_name',offer.offer_name,
      'total_price',offer.total_price,'reason','Pendiente de indicar'
    ));

  elsif selected='alternative' then
    insert into public.crm_offer_response_states(offer_instance_id,opportunity_id,contact_id,user_id,action,state,reason,decision_message_id,decided_at,resolved_at)
    values(offer.id,offer.opportunity_id,offer.contact_id,offer.created_by,'alternative','resolved','Cliente solicita otra oferta',new.id_message,new.created_at,new.created_at);
    select * into target_stage from public.sales_stages
      where active and pipeline_id=opp.pipeline_id and lower(btrim(name))='perdido'
      order by position limit 1;
    if target_stage.id is null then raise exception 'Falta la columna Perdido';end if;
    perform crm_private.offer_append_loss_reason(opp.id,'Cliente solicita otra oferta',false);
    update public.sales_opportunities set stage_id=target_stage.id,expected_date=(new.created_at at time zone 'Europe/Madrid')::date,status='lost',updated_at=now()
      where id=opp.id;
    perform crm_private.offer_remove_month_label(offer);
    insert into public.agenda_items(
      title,description,customer_name,customer_phone,starts_at,status,assigned_to,created_by,
      related_record_id,reminder_methods,reminder_minutes,notify_in_app,notify_email,agenda_type,agenda_meta
    ) values(
      'Preparar otra oferta','El cliente ha pedido revisar otra oferta. Oferta anterior: '||offer.operator||' · '||offer.offer_name,
      opp.client_name,opp.phone,(next_date::text||' 10:00 Europe/Madrid')::timestamptz,'pending',offer.created_by,offer.created_by,
      offer.contact_id,'["in_app"]'::jsonb,'[]'::jsonb,true,false,'Tarea',jsonb_build_object('source','offer_response','offer_instance_id',offer.id)
    );
    perform crm_private.offer_enqueue_message(offer,'offer-alternative-ack:'||offer.id,
      'Perfecto, revisamos otras opciones y contactamos contigo para buscar una oferta que encaje mejor.',
      '[]'::jsonb,'alternative_ack');
    perform crm_private.offer_event(new,offer,'offer_alternative_requested',jobs_cancelled||' recordatorio(s) cancelado(s); tarea creada para '||next_date);
    insert into public.crm_telegram_business_events(topic,event_type,entity_type,entity_id,payload)
    values('offers','offer_alternative_requested','offer',offer.id,jsonb_build_object(
      'contact_id',offer.contact_id,'opportunity_id',offer.opportunity_id,'client_name',coalesce(opp.client_name,''),
      'phone',coalesce(opp.phone,''),'operator',offer.operator,'offer_name',offer.offer_name,
      'total_price',offer.total_price,'task_date',next_date
    ));
  end if;
  return new;
end $$;
revoke all on function crm_private.lifecycle_incoming() from public,anon,authenticated;

-- New follow-up offers: the same three actions on days 0, 2 and 5.
create or replace function public.crm_create_offer_execution_v6(
  p_contact_id uuid,p_catalog_offer_id uuid,p_request_key uuid,
  p_selections jsonb default '[]'::jsonb,p_extra_text text default null,
  p_mode text default 'followup',p_final_price numeric default null,
  p_send_message boolean default false,p_processing_date date default null,
  p_test_mode boolean default false,p_allow_duplicate boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  uid uuid:=auth.uid();result jsonb;offer_id uuid;configured_job uuid;
  reply_buttons jsonb:=jsonb_build_array(
    jsonb_build_object('buttonId','offer_accept','buttonText','Me interesa'),
    jsonb_build_object('buttonId','offer_decline','buttonText','No me interesa'),
    jsonb_build_object('buttonId','offer_other','buttonText','Quiero otra oferta')
  );
begin
  if uid is null then raise exception 'Authentication required';end if;
  result:=public.crm_create_offer_execution_v5(
    p_contact_id,p_catalog_offer_id,p_request_key,p_selections,p_extra_text,p_mode,
    p_final_price,p_send_message,p_processing_date,p_test_mode,p_allow_duplicate
  );
  offer_id:=nullif(result->>'offer_id','')::uuid;
  if p_mode='followup' and offer_id is not null then
    update public.crm_server_automation_jobs j set action_config=
      jsonb_set(jsonb_set(jsonb_set(jsonb_set(
        j.action_config,
        '{steps,0,config,reply_buttons}',reply_buttons,true),
        '{steps,4,config,reply_buttons}',reply_buttons,true),
        '{steps,7,config,reply_buttons}',reply_buttons,true),
        '{steps,7,config,text}',to_jsonb('Hola, {nombre}. Vuelvo a escribirte sobre la oferta de {operador}, por si quieres que la revisemos juntos o prefieres dejarla para más adelante. Dime qué te viene mejor.'::text),true),
      updated_at=now()
    where j.user_id=uid and j.event_key='manual-offer:'||offer_id
      and j.action_type='flow_v1' and j.status='pending'
    returning j.id into configured_job;
    if configured_job is null and coalesce((result->>'idempotent_replay')::boolean,false)=false then
      raise exception 'Protección CRM: no se pudieron configurar las respuestas de la oferta';
    end if;
  end if;
  return result||jsonb_build_object('reply_buttons_configured',p_mode='followup' and (configured_job is not null or coalesce((result->>'idempotent_replay')::boolean,false)));
end $$;
revoke all on function public.crm_create_offer_execution_v6(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean) from public,anon;
grant execute on function public.crm_create_offer_execution_v6(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean) to authenticated;

create or replace function public.crm_control_offer(p_offer_id uuid,p_action text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
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
      jsonb_build_object('kind','wait','unit','days','value',2),jsonb_build_object('kind','condition','condition_type','no_response'),
      jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object(
        'text','Hola {nombre}, ¿has podido revisar la oferta de {operador} por {precio_total} €/mes? Si tienes alguna duda, te ayudo por aquí.',
        'offer_phase','reminder_2','reply_buttons',reply_buttons)),
      jsonb_build_object('kind','wait','unit','days','value',3),jsonb_build_object('kind','condition','condition_type','no_response'),
      jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object(
        'text','Hola, {nombre}. Vuelvo a escribirte sobre la oferta de {operador}, por si quieres que la revisemos juntos o prefieres dejarla para más adelante. Dime qué te viene mejor.',
        'offer_phase','reminder_5','reply_buttons',reply_buttons))));
    rule.action_config:=flow;
    ctx:=public.crm_server_context_for_contact(inst.contact_id,opp.phone)||jsonb_build_object(
      'opportunity_id',opp.id,'offer_instance_id',inst.id,'operator',inst.operator,
      'precio_total',to_char(inst.total_price,'FM999999990D00'),'trigger_type','manual_offer','event_at',now());
    perform public.crm_server_enqueue(rule,'manual-offer-resume:'||inst.id||':'||extract(epoch from now())::bigint,ctx);
    update public.crm_offer_instances set status='following' where id=inst.id;
  else raise exception 'Acción no válida';end if;
  return jsonb_build_object('ok',true,'action',p_action,'offer_id',inst.id);
end $$;
revoke all on function public.crm_control_offer(uuid,text) from public,anon;
grant execute on function public.crm_control_offer(uuid,text) to authenticated;

-- Pending roots and already-expanded reminders receive the corrected copy and
-- buttons without touching completed/historical messages.
with constants as (
  select jsonb_build_array(
    jsonb_build_object('buttonId','offer_accept','buttonText','Me interesa'),
    jsonb_build_object('buttonId','offer_decline','buttonText','No me interesa'),
    jsonb_build_object('buttonId','offer_other','buttonText','Quiero otra oferta')
  ) buttons
)
update public.crm_server_automation_jobs j set action_config=
  jsonb_set(jsonb_set(jsonb_set(jsonb_set(
    j.action_config,'{steps,0,config,reply_buttons}',c.buttons,true),
    '{steps,4,config,reply_buttons}',c.buttons,true),
    '{steps,7,config,reply_buttons}',c.buttons,true),
    '{steps,7,config,text}',to_jsonb('Hola, {nombre}. Vuelvo a escribirte sobre la oferta de {operador}, por si quieres que la revisemos juntos o prefieres dejarla para más adelante. Dime qué te viene mejor.'::text),true),
  updated_at=now()
from constants c
where j.status='pending' and j.action_type='flow_v1'
  and j.context#>>'{lifecycle,mode}'='offer';

with constants as (
  select jsonb_build_array(
    jsonb_build_object('buttonId','offer_accept','buttonText','Me interesa'),
    jsonb_build_object('buttonId','offer_decline','buttonText','No me interesa'),
    jsonb_build_object('buttonId','offer_other','buttonText','Quiero otra oferta')
  ) buttons
)
update public.crm_server_automation_jobs j set action_config=
  jsonb_set(
    case when j.action_config->>'offer_phase'='reminder_5'
      then jsonb_set(j.action_config,'{text}',to_jsonb('Hola, {nombre}. Vuelvo a escribirte sobre la oferta de {operador}, por si quieres que la revisemos juntos o prefieres dejarla para más adelante. Dime qué te viene mejor.'::text),true)
      else j.action_config end,
    '{reply_buttons}',c.buttons,true),
  updated_at=now()
from constants c
where j.status='pending' and j.action_type='__send_whatsapp'
  and j.action_config->>'offer_phase' in ('reminder_2','reminder_5');

-- Suppress generic "sale lost" duplicates when the loss was caused by one of
-- the explicit offer buttons; dedicated events carry the useful reason.
create or replace function crm_private.telegram_offer_event()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  previous_status text:=case when tg_op='UPDATE' then old.status else null end;
  previous_sent_at timestamptz:=case when tg_op='UPDATE' then old.sent_at else null end;
  event_name text;event_topic text;opportunity public.sales_opportunities%rowtype;stage_name text;
begin
  select * into opportunity from public.sales_opportunities where id=new.opportunity_id;
  select name into stage_name from public.sales_stages where id=opportunity.stage_id;
  if new.sent_at is not null and previous_sent_at is null then event_name:='offer_sent';event_topic:='offers';
  elsif tg_op='UPDATE' and previous_status='paused' and new.status='following' then event_name:='followup_resumed';event_topic:='followups';
  elsif (tg_op='INSERT' or previous_status is distinct from new.status) and new.status='paused' then event_name:='followup_paused';event_topic:='followups';
  elsif (tg_op='INSERT' or previous_status is distinct from new.status) and new.status='accepted' then event_name:='offer_accepted';event_topic:='offers';
  elsif (tg_op='INSERT' or previous_status is distinct from new.status) and new.status='processed' then event_name:='sale_processed';event_topic:='offers';
  elsif (tg_op='INSERT' or previous_status is distinct from new.status) and new.status='won' then event_name:='sale_won';event_topic:='offers';
  elsif (tg_op='INSERT' or previous_status is distinct from new.status) and new.status='lost' then
    if exists(select 1 from public.crm_offer_response_states where offer_instance_id=new.id and action in ('decline','alternative')) then return new;end if;
    event_name:='sale_lost';event_topic:='offers';
  elsif (tg_op='INSERT' or previous_status is distinct from new.status) and new.status='cancelled' then event_name:='offer_cancelled';event_topic:='offers';
  else return new;end if;
  insert into public.crm_telegram_business_events(topic,event_type,entity_type,entity_id,payload)
  values(event_topic,event_name,'offer',new.id,jsonb_build_object(
    'contact_id',new.contact_id,'opportunity_id',new.opportunity_id,
    'client_name',coalesce(opportunity.client_name,''),'phone',coalesce(opportunity.phone,''),
    'operator',coalesce(new.operator,''),'offer_name',coalesce(new.offer_name,''),
    'total_price',new.total_price,'stage_name',coalesce(stage_name,''),'status',coalesce(new.status,'')
  ));
  return new;
end $$;
revoke all on function crm_private.telegram_offer_event() from public,anon,authenticated;

notify pgrst,'reload schema';
