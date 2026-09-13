-- Every interactive press needs its own event key.  A customer can choose
-- "Más opciones", return, and choose it again in the same offer flow.
-- Reusing the offer-only key made the second press collide with the first job.
create or replace function crm_private.lifecycle_incoming()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  ph text; cid uuid; optout boolean; selected text; quoted_id text;
  current_state public.crm_offer_response_states%rowtype;
  offer public.crm_offer_instances%rowtype; opp public.sales_opportunities%rowtype;
  stage_name text; target_stage public.sales_stages%rowtype;
  jobs_cancelled integer := 0; reason_text text; next_date date;
  first_reason_buttons jsonb := jsonb_build_array(
    jsonb_build_object('buttonId','offer_reason_price','buttonText','Es por el precio'),
    jsonb_build_object('buttonId','offer_reason_same','buttonText','Prefiero seguir igual'),
    jsonb_build_object('buttonId','offer_reason_more','buttonText','Más opciones')
  );
  more_reason_buttons jsonb := jsonb_build_array(
    jsonb_build_object('buttonId','offer_reason_later','buttonText','Más adelante'),
    jsonb_build_object('buttonId','offer_reason_other','buttonText','Otro motivo'),
    jsonb_build_object('buttonId','offer_reason_back','buttonText','Volver')
  );
begin
  if new.direction is distinct from 'in' or new.chat_id like '%@g.us' then return new; end if;
  ph := public.crm_server_normalize_phone(split_part(new.chat_id,'@',1));
  if ph is null or length(ph) < 8 then return new; end if;
  cid := public.crm_server_contact_for_phone(ph);
  selected := crm_private.offer_response_action(new.raw,new.type_message,new.text_content);
  quoted_id := coalesce(new.raw#>>'{messageData,interactiveButtonsResponse,stanzaId}',new.raw#>>'{interactiveButtonsResponse,stanzaId}',new.raw#>>'{messageData,quotedMessage,stanzaId}',new.raw#>>'{quotedMessage,stanzaId}');

  select * into current_state from public.crm_offer_response_states where contact_id=cid and state in ('awaiting_reason','awaiting_text') order by updated_at desc limit 1 for update;
  if current_state.offer_instance_id is not null and current_state.state='awaiting_text' and selected is null and btrim(coalesce(new.text_content,''))<>'' then
    select * into offer from public.crm_offer_instances where id=current_state.offer_instance_id;
    reason_text := left(btrim(new.text_content),500);
    update public.crm_offer_response_states set state='resolved',reason=reason_text,resolved_at=new.created_at,updated_at=now() where offer_instance_id=offer.id and state='awaiting_text';
    perform crm_private.offer_append_loss_reason(offer.opportunity_id,reason_text,false);
    perform crm_private.offer_event(new,offer,'decline_reason_saved','Motivo escrito guardado');
    insert into public.crm_telegram_business_events(topic,event_type,entity_type,entity_id,payload)
    select 'offers','offer_decline_reason','offer',offer.id,jsonb_build_object('contact_id',offer.contact_id,'opportunity_id',offer.opportunity_id,'client_name',coalesce(o.client_name,''),'phone',coalesce(o.phone,''),'operator',offer.operator,'offer_name',offer.offer_name,'total_price',offer.total_price,'reason',reason_text) from public.sales_opportunities o where o.id=offer.opportunity_id;
    return new;
  end if;

  if current_state.offer_instance_id is not null and current_state.state='awaiting_reason' and selected like 'reason_%' then
    select * into offer from public.crm_offer_instances where id=current_state.offer_instance_id;
    if selected='reason_more' then
      perform crm_private.offer_enqueue_message(offer,'offer-reason-more:'||offer.id||':'||new.id,
        'Elige el motivo que mejor encaje:',more_reason_buttons,'decline_reason_more');
      return new;
    elsif selected='reason_back' then
      perform crm_private.offer_enqueue_message(offer,'offer-reason-back:'||offer.id||':'||new.id,
        'Gracias por responder. ¿Cuál es el motivo principal?',first_reason_buttons,'decline_reason_prompt');
      return new;
    elsif selected='reason_other' then
      update public.crm_offer_response_states set state='awaiting_text',reason='Otro motivo',updated_at=now() where offer_instance_id=offer.id and state='awaiting_reason';
      perform crm_private.offer_enqueue_message(offer,'offer-reason-text:'||offer.id||':'||new.id,'Cuéntanos brevemente el motivo.','[]'::jsonb,'decline_reason_text');
      return new;
    end if;
    reason_text := case selected when 'reason_price' then 'Es por el precio' when 'reason_same' then 'Prefiero seguir igual' when 'reason_later' then 'Más adelante' end;
    if reason_text is not null then
      update public.crm_offer_response_states set state='resolved',reason=reason_text,resolved_at=new.created_at,updated_at=now() where offer_instance_id=offer.id and state='awaiting_reason';
      perform crm_private.offer_append_loss_reason(offer.opportunity_id,reason_text,false);
      perform crm_private.offer_event(new,offer,'decline_reason_saved','Motivo seleccionado guardado');
      insert into public.crm_telegram_business_events(topic,event_type,entity_type,entity_id,payload)
      select 'offers','offer_decline_reason','offer',offer.id,jsonb_build_object('contact_id',offer.contact_id,'opportunity_id',offer.opportunity_id,'client_name',coalesce(o.client_name,''),'phone',coalesce(o.phone,''),'operator',offer.operator,'offer_name',offer.offer_name,'total_price',offer.total_price,'reason',reason_text) from public.sales_opportunities o where o.id=offer.opportunity_id;
    end if;
    return new;
  end if;

  if selected is null or selected not in ('accept','decline','alternative') then
    optout := crm_private.is_commercial_optout(new.text_content);
    if optout then
      insert into crm_private.commercial_optouts(phone,contact_id,received_at) values(ph,cid,new.created_at)
      on conflict(phone) do update set contact_id=coalesce(excluded.contact_id,crm_private.commercial_optouts.contact_id),received_at=excluded.received_at;
      update public.crm_server_automation_jobs j set status='cancelled',error_message='Baja comercial solicitada',updated_at=now()
      where j.status in ('pending','running') and j.context#>>'{lifecycle,mode}'='after_sale' and (j.context->>'contact_id'=cid::text or public.crm_server_normalize_phone(j.context->>'phone')=ph);
    end if;
    return new;
  end if;

  if quoted_id is not null then select i.* into offer from public.crm_offer_outgoing_messages sent join public.crm_offer_instances i on i.id=sent.offer_instance_id where sent.provider_message_id=quoted_id; end if;
  if offer.id is null then select i.* into offer from public.crm_offer_instances i join public.sales_opportunities o on o.id=i.opportunity_id join public.sales_stages s on s.id=o.stage_id where i.contact_id=cid and i.created_at<=new.created_at and i.status in ('queued','following','paused') and lower(btrim(s.name)) in ('seguimiento','oferta pasada') order by coalesce(i.sent_at,i.created_at) desc limit 1; end if;
  if offer.id is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(offer.id::text,8851));
  select * into current_state from public.crm_offer_response_states where offer_instance_id=offer.id for update;
  select * into opp from public.sales_opportunities where id=offer.opportunity_id for update;
  select lower(btrim(name)) into stage_name from public.sales_stages where id=opp.stage_id;
  if current_state.offer_instance_id is not null or stage_name not in ('seguimiento','oferta pasada') then
    perform crm_private.offer_event(new,offer,'button_ignored','La oportunidad ya había cambiado; no se sobrescribió','info');
    insert into public.crm_telegram_business_events(topic,event_type,entity_type,entity_id,payload) values('followups','offer_response_ignored','offer',offer.id,jsonb_build_object('contact_id',offer.contact_id,'opportunity_id',offer.opportunity_id,'client_name',coalesce(opp.client_name,''),'phone',coalesce(opp.phone,''),'operator',offer.operator,'offer_name',offer.offer_name,'response',coalesce(new.text_content,''),'stage_name',coalesce(stage_name,'')));
    return new;
  end if;
  jobs_cancelled := crm_private.offer_cancel_reminders(offer.id,'Cliente eligió una respuesta de la oferta');
  next_date := crm_private.offer_next_business_date(new.created_at);
  if selected='accept' then
    insert into public.crm_offer_response_states(offer_instance_id,opportunity_id,contact_id,user_id,action,state,decision_message_id,decided_at) values(offer.id,offer.opportunity_id,offer.contact_id,offer.created_by,'accept','decided',new.id_message,new.created_at);
    select * into target_stage from public.sales_stages where active and pipeline_id=opp.pipeline_id and lower(btrim(name))='pendiente de tramitar' order by position limit 1;
    if target_stage.id is null then raise exception 'Falta la columna Pendiente de tramitar'; end if;
    update public.sales_opportunities set stage_id=target_stage.id,expected_date=next_date,status='open',updated_at=now() where id=opp.id;
    perform crm_private.offer_event(new,offer,'offer_interest',jobs_cancelled||' recordatorio(s) cancelado(s)');
  elsif selected='decline' then
    insert into public.crm_offer_response_states(offer_instance_id,opportunity_id,contact_id,user_id,action,state,reason,decision_message_id,decided_at) values(offer.id,offer.opportunity_id,offer.contact_id,offer.created_by,'decline','awaiting_reason','Pendiente de indicar',new.id_message,new.created_at);
    select * into target_stage from public.sales_stages where active and pipeline_id=opp.pipeline_id and lower(btrim(name))='perdido' order by position limit 1;
    if target_stage.id is null then raise exception 'Falta la columna Perdido'; end if;
    perform crm_private.offer_append_loss_reason(opp.id,'',true);
    update public.sales_opportunities set stage_id=target_stage.id,expected_date=(new.created_at at time zone 'Europe/Madrid')::date,status='lost',updated_at=now() where id=opp.id;
    perform crm_private.offer_remove_month_label(offer);
    perform crm_private.offer_enqueue_message(offer,'offer-reason:'||offer.id,'Gracias por responder, {nombre}. Para ayudarnos a mejorar, ¿cuál es el motivo principal?',first_reason_buttons,'decline_reason_prompt');
    perform crm_private.offer_event(new,offer,'offer_declined',jobs_cancelled||' recordatorio(s) cancelado(s); esperando motivo');
    insert into public.crm_telegram_business_events(topic,event_type,entity_type,entity_id,payload) values('offers','offer_declined','offer',offer.id,jsonb_build_object('contact_id',offer.contact_id,'opportunity_id',offer.opportunity_id,'client_name',coalesce(opp.client_name,''),'phone',coalesce(opp.phone,''),'operator',offer.operator,'offer_name',offer.offer_name,'total_price',offer.total_price,'reason','Pendiente de indicar'));
  elsif selected='alternative' then
    insert into public.crm_offer_response_states(offer_instance_id,opportunity_id,contact_id,user_id,action,state,reason,decision_message_id,decided_at,resolved_at) values(offer.id,offer.opportunity_id,offer.contact_id,offer.created_by,'alternative','resolved','Cliente solicita otra oferta',new.id_message,new.created_at,new.created_at);
    select * into target_stage from public.sales_stages where active and pipeline_id=opp.pipeline_id and lower(btrim(name))='perdido' order by position limit 1;
    if target_stage.id is null then raise exception 'Falta la columna Perdido'; end if;
    perform crm_private.offer_append_loss_reason(opp.id,'Cliente solicita otra oferta',false);
    update public.sales_opportunities set stage_id=target_stage.id,expected_date=(new.created_at at time zone 'Europe/Madrid')::date,status='lost',updated_at=now() where id=opp.id;
    perform crm_private.offer_remove_month_label(offer);
    insert into public.agenda_items(title,description,customer_name,customer_phone,starts_at,status,assigned_to,created_by,related_record_id,reminder_methods,reminder_minutes,notify_in_app,notify_email,agenda_type,agenda_meta) values('Preparar otra oferta','El cliente ha pedido revisar otra oferta. Oferta anterior: '||offer.operator||' · '||offer.offer_name,opp.client_name,opp.phone,(next_date::text||' 10:00 Europe/Madrid')::timestamptz,'pending',offer.created_by,offer.created_by,offer.contact_id,'["in_app"]'::jsonb,'[]'::jsonb,true,false,'Tarea',jsonb_build_object('source','offer_response','offer_instance_id',offer.id));
    perform crm_private.offer_enqueue_message(offer,'offer-alternative-ack:'||offer.id,'Perfecto, revisamos otras opciones y contactamos contigo para buscar una oferta que encaje mejor.','[]'::jsonb,'alternative_ack');
    perform crm_private.offer_event(new,offer,'offer_alternative_requested',jobs_cancelled||' recordatorio(s) cancelado(s); tarea creada para '||next_date);
    insert into public.crm_telegram_business_events(topic,event_type,entity_type,entity_id,payload) values('offers','offer_alternative_requested','offer',offer.id,jsonb_build_object('contact_id',offer.contact_id,'opportunity_id',offer.opportunity_id,'client_name',coalesce(opp.client_name,''),'phone',coalesce(opp.phone,''),'operator',offer.operator,'offer_name',offer.offer_name,'total_price',offer.total_price,'task_date',next_date));
  end if;
  return new;
end;
$function$;
