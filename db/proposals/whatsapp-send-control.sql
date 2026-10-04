CREATE OR REPLACE FUNCTION crm_private.whatsapp_phone_key(p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$select case when length(d)=9 then '34'||d when length(d)=13 and left(d,4)='0034' then substring(d from 3) else d end from (select public.crm_server_normalize_phone(p) d) x;$$;
REVOKE ALL ON FUNCTION crm_private.whatsapp_phone_key(text) FROM public,anon,authenticated;
CREATE OR REPLACE FUNCTION crm_private.installation_defaults()
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select jsonb_build_object('netflix_extra_text','','slots','[]'::jsonb,'shop_phone','','return_time','10:00',
 'appointment_text',E'Hola {nombre} 👋\n\nLa instalación de {operador} está prevista para el {fecha}, {franja}. Estate pendiente del teléfono: el técnico podría llamarte para confirmar la visita o adelantarla.\n\nSi tienes algún problema durante la portabilidad, llámanos a la hora que sea o escríbenos por este WhatsApp.\n\nCuando la instalación esté terminada, pulsa «✓ Instalado» para confirmarlo.',
 'no_appointment_text',E'Hola {nombre} 👋\n\nHemos tramitado tu contrato con {operador}. Estamos pendientes de que el operador confirme la cita de instalación. Estate pendiente del teléfono: el técnico podría llamarte para concertar o adelantar la visita.\n\nSi tienes algún problema durante la portabilidad, llámanos a la hora que sea o escríbenos por este WhatsApp.\n\nCuando la instalación esté terminada, pulsa «✓ Instalado» para confirmarlo.',
 'date_prompt_text','Gracias, {nombre}. ¿Qué día te instalaron la fibra?',
 'date_other_text','Escribe la fecha de instalación con este formato: DD/MM/AAAA. ',
 'confirmed_text','Gracias, {nombre}. Hemos anotado tu instalación del {fecha_instalacion}. Si tienes algún problema, {ayuda}.');
$function$
;
CREATE OR REPLACE FUNCTION crm_private.installation_schedule_return(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare i public.crm_installations%rowtype;txt text;confirmation text;j uuid;due timestamptz;reply_context jsonb;
begin
 select * into i from public.crm_installations where id=p_id for update;
 if not found or i.installed_on is null or i.return_job_id is not null then return;end if;
 reply_context:=i.recipient_context-'contract_party';
 if i.previous_operator='Ninguno' then
  update public.crm_installations set return_due_at=null,incident='',updated_at=clock_timestamp() where id=i.id;return;
 end if;
 if nullif(btrim(i.previous_operator),'') is null or nullif(btrim(i.return_text),'') is null then
  update public.crm_installations set incident='Revisar compañía anterior e instrucciones de devolución',updated_at=clock_timestamp() where id=i.id;return;
 end if;
 -- This message responds to an installation confirmation. It has no commercial delay or window.
 due:=now();
 txt:=crm_private.installation_render(i.return_text,i.config_snapshot,reply_context,i.appointment_date,i.time_from,i.time_to,i.installed_on);
 -- The stored router block may contain the standard greeting. Keep a single greeting in the combined reply.
 txt:=crm_private.contract_message(txt,i.recipient_context->'contract_party');
 j:=crm_private.installation_enqueue(i.id,'return:'||i.revision,txt,'[]','installation_return',due);
 update public.crm_installations set return_due_at=due,return_job_id=j,incident=case when j is null then 'Motor pausado: devolución pendiente de enviar' else '' end,updated_at=clock_timestamp() where id=i.id;
end;$function$
;
CREATE OR REPLACE FUNCTION crm_private.lifecycle_incoming()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  ph text; cid uuid; optout boolean; selected text; quoted_id text;
  current_state public.crm_offer_response_states%rowtype;
  offer public.crm_offer_instances%rowtype; opp public.sales_opportunities%rowtype;
  stage_name text; target_stage public.sales_stages%rowtype;
  jobs_cancelled integer := 0; reason_text text; next_date date;
  first_reason_buttons jsonb := jsonb_build_array(
    jsonb_build_object('buttonId','offer_reason_price','buttonText','Es por el precio'),
    jsonb_build_object('buttonId','offer_reason_same','buttonText','Ahora no me interesa'),
    jsonb_build_object('buttonId','offer_reason_other','buttonText','Otro motivo')
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
  if crm_private.is_commercial_optout(new.text_content) then
    insert into crm_private.commercial_optouts(phone,contact_id,received_at) values(ph,cid,new.created_at)
    on conflict(phone) do update set contact_id=coalesce(excluded.contact_id,crm_private.commercial_optouts.contact_id),received_at=excluded.received_at;
    update public.crm_server_automation_jobs j set status='cancelled',error_message='Cliente solicita no recibir más mensajes',updated_at=now()
    where j.status in ('pending','paused') and not(j.action_config ? '__delivery_receipt')
    and j.action_type in ('flow_v1','send_template','send_whatsapp_now','__send_whatsapp','schedule_whatsapp')
    and crm_private.whatsapp_phone_key(j.context->>'phone')=crm_private.whatsapp_phone_key(ph);
    return new;
  end if;
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
        'Elige el motivo que mejor encaje:',first_reason_buttons,'decline_reason_more');
      return new;
    elsif selected='reason_back' then
      perform crm_private.offer_enqueue_message(offer,'offer-reason-back:'||offer.id||':'||new.id,
        'Gracias por responder. ¿Cuál es el motivo principal?',first_reason_buttons,'decline_reason_prompt');
      return new;
    elsif selected='reason_other' then
      update public.crm_offer_response_states set state='awaiting_text',reason='Otro motivo',updated_at=now() where offer_instance_id=offer.id and state='awaiting_reason';
      perform crm_private.offer_enqueue_message(offer,'offer-reason-text:'||offer.id||':'||new.id,'Cuéntanos el motivo en un mensaje, si quieres. Gracias por ayudarnos a mejorar.','[]'::jsonb,'decline_reason_text');
      return new;
    end if;
    reason_text := case selected when 'reason_price' then 'Es por el precio' when 'reason_same' then 'Ahora no me interesa' when 'reason_later' then 'Más adelante' end;
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
      where j.status in ('pending','running') and j.context#>>'{lifecycle,mode}'='after_sale' and (j.context->>'contact_id'=cid::text or crm_private.whatsapp_phone_key(j.context->>'phone')=crm_private.whatsapp_phone_key(ph));
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
$function$
;
CREATE OR REPLACE FUNCTION crm_private.whatsapp_stop_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
begin
 if new.status in ('pending','paused','running') and new.action_type in ('flow_v1','send_template','send_whatsapp_now','__send_whatsapp','schedule_whatsapp') and not(new.action_config ? '__delivery_receipt')
 and exists(select 1 from crm_private.commercial_optouts x where crm_private.whatsapp_phone_key(x.phone)=crm_private.whatsapp_phone_key(new.context->>'phone')) then
 new.status:='cancelled';new.error_message:='Cliente solicita no recibir más mensajes';
 end if;
 return new;
end;$$;
REVOKE ALL ON FUNCTION crm_private.whatsapp_stop_guard() FROM public,anon,authenticated;
CREATE TRIGGER z_whatsapp_stop_guard BEFORE INSERT OR UPDATE ON public.crm_server_automation_jobs FOR EACH ROW EXECUTE FUNCTION crm_private.whatsapp_stop_guard();
CREATE OR REPLACE FUNCTION public.crm_whatsapp_send_monitor() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
declare start_at timestamptz:=(current_timestamp at time zone 'Europe/Madrid')::date at time zone 'Europe/Madrid';end_at timestamptz:=((current_timestamp at time zone 'Europe/Madrid')::date+1) at time zone 'Europe/Madrid';result jsonb;
begin
 if auth.uid() is null or not public.current_user_is_admin() then raise exception 'Solo administración';end if;
 select jsonb_build_object(
 'enabled',public.crm_server_automations_enabled(),
 'sent_today',(select count(distinct (chat_id,id_message)) from public.wa_messages where direction='out' and created_at>=start_at and created_at<end_at),
 'pending_today',(select count(*) from public.crm_server_automation_jobs where status='pending' and action_type in ('send_template','send_whatsapp_now','__send_whatsapp','schedule_whatsapp') and run_at<end_at),
 'failed_24h',(select count(*) from public.crm_server_automation_jobs where status='failed' and updated_at>=now()-interval '24 hours' and action_type in ('send_template','send_whatsapp_now','__send_whatsapp','schedule_whatsapp')),
 'unanswered_reminders',(select count(*) from public.crm_server_automation_jobs j where status='pending' and action_config->>'offer_phase' in ('reminder_2','reminder_5') and not exists(select 1 from public.wa_messages m where m.direction='in' and public.crm_server_normalize_phone(split_part(m.chat_id,'@',1))=public.crm_server_normalize_phone(j.context->>'phone') and m.created_at>j.created_at)),
 'duplicate_pending',(select count(*) from (select public.crm_server_normalize_phone(context->>'phone'), action_config->>'text',date_trunc('hour',run_at) from public.crm_server_automation_jobs where status='pending' and action_type in ('send_whatsapp_now','__send_whatsapp','schedule_whatsapp') and nullif(action_config->>'text','') is not null group by 1,2,3 having count(*)>1) x),
 'manual_pending_today',(select count(*) from public.agenda_items where whatsapp_enabled and status='pending' and coalesce(whatsapp_delivery_status,'pending')='pending' and coalesce(whatsapp_scheduled_at,starts_at)<end_at),
 'daily_average',(select round(count(*)::numeric/7,1) from public.wa_messages where direction='out' and created_at>=start_at-interval '7 days' and created_at<start_at)
 ) into result;return result;
end;$$;
REVOKE ALL ON FUNCTION public.crm_whatsapp_send_monitor() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.crm_whatsapp_send_monitor() TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_whatsapp_pause_engine(p_paused boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
begin
 if auth.uid() is null or not public.current_user_is_admin() then raise exception 'Solo administración';end if;
 insert into public.app_settings(key,value,updated_at) values('crm_server_automations_enabled',to_jsonb(not p_paused),now())
 on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
 return not p_paused;
end;$$;
REVOKE ALL ON FUNCTION public.crm_whatsapp_pause_engine(boolean) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.crm_whatsapp_pause_engine(boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.crm_server_claim_jobs(p_limit integer DEFAULT 20)
 RETURNS SETOF crm_server_automation_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 ,u as(update public.crm_server_automation_jobs claimed set status='running',attempts=claimed.attempts+1,updated_at=now(),error_message=null from picked p where claimed.id=p.id returning claimed.*) select * from u where u.status='running';
end;$function$
;
CREATE OR REPLACE FUNCTION crm_private.offer_response_action(p_raw jsonb,p_type text,p_text text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
declare selected text:=coalesce(p_raw#>>'{messageData,interactiveButtonsResponse,interactiveButtonsResponse,selectedButtonId}',p_raw#>>'{interactiveButtonsResponse,interactiveButtonsResponse,selectedButtonId}',p_raw#>>'{messageData,interactiveButtonsResponse,selectedButtonId}',p_raw#>>'{messageData,interactiveButtonsResponse,selectedId}',p_raw#>>'{interactiveButtonsResponse,selectedButtonId}',p_raw#>>'{interactiveButtonsResponse,selectedId}',p_raw#>>'{messageData,buttonsResponseMessage,selectedButtonId}',p_raw#>>'{buttonsResponseMessage,selectedButtonId}',p_raw#>>'{messageData,templateButtonReplyMessage,selectedId}',p_raw#>>'{templateButtonReplyMessage,selectedId}','');normalized text;
begin
 if btrim(selected)='' and lower(coalesce(p_type,'')) not like '%button%' then return null;end if;
 normalized:=translate(lower(btrim(coalesce(nullif(selected,''),p_text,''))),'áéíóúüñ','aeiouun');
 return case normalized
 when 'offer_accept' then 'accept' when 'acepto' then 'accept' when 'me interesa' then 'accept'
 when 'offer_decline' then 'decline' when 'no me interesa' then 'decline'
 when 'offer_other' then 'alternative' when 'quiero mirar otra cosa' then 'alternative' when 'quiero otra oferta' then 'alternative'
 when 'offer_reason_price' then 'reason_price' when 'es por el precio' then 'reason_price'
 when 'offer_reason_same' then 'reason_same' when 'prefiero seguir igual' then 'reason_same' when 'ahora no me interesa' then 'reason_same'
 when 'offer_reason_more' then 'reason_more' when 'mas opciones' then 'reason_more'
 when 'offer_reason_later' then 'reason_later' when 'mas adelante' then 'reason_later'
 when 'offer_reason_other' then 'reason_other' when 'otro motivo' then 'reason_other'
 when 'offer_reason_back' then 'reason_back' when 'volver' then 'reason_back' else null end;
end;$$;

CREATE OR REPLACE FUNCTION crm_private.whatsapp_scheduled_stop_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
begin
 if new.whatsapp_enabled and new.whatsapp_delivery_status in ('pending','paused','sending')
 and exists(select 1 from crm_private.commercial_optouts x where crm_private.whatsapp_phone_key(x.phone)=crm_private.whatsapp_phone_key(coalesce(nullif(new.whatsapp_phone,''),new.customer_phone))) then
 new.whatsapp_delivery_status:='cancelled';new.whatsapp_delivery_error:='Cliente solicita no recibir más mensajes';
 end if;return new;
end;$$;
REVOKE ALL ON FUNCTION crm_private.whatsapp_scheduled_stop_guard() FROM public,anon,authenticated;
CREATE TRIGGER z_whatsapp_scheduled_stop_guard BEFORE INSERT OR UPDATE ON public.agenda_items FOR EACH ROW EXECUTE FUNCTION crm_private.whatsapp_scheduled_stop_guard();
CREATE OR REPLACE FUNCTION public.crm_claim_scheduled_whatsapp(p_limit integer DEFAULT 20)
 RETURNS SETOF agenda_items
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  with picked as (
    select a.id
    from public.agenda_items a
    where a.whatsapp_enabled = true
      and a.status = 'pending'
      and a.whatsapp_scheduled_at is not null
      and a.whatsapp_scheduled_at <= now()
      and a.whatsapp_delivery_status = 'pending'
    order by a.whatsapp_scheduled_at, a.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit,20),100))
  ), updated as (
    update public.agenda_items a
       set whatsapp_delivery_status = 'sending',
           whatsapp_attempted_at = now(),
           whatsapp_delivery_error = null,
           whatsapp_attempt_count = coalesce(a.whatsapp_attempt_count,0) + 1,
           updated_at = now()
      from picked p
     where a.id = p.id
     returning a.*
  )
  select * from updated where whatsapp_delivery_status='sending';
end;
$function$
;
CREATE OR REPLACE FUNCTION crm_private.lifecycle_incoming()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  ph text; cid uuid; optout boolean; selected text; quoted_id text;
  current_state public.crm_offer_response_states%rowtype;
  offer public.crm_offer_instances%rowtype; opp public.sales_opportunities%rowtype;
  stage_name text; target_stage public.sales_stages%rowtype;
  jobs_cancelled integer := 0; reason_text text; next_date date;
  first_reason_buttons jsonb := jsonb_build_array(
    jsonb_build_object('buttonId','offer_reason_price','buttonText','Es por el precio'),
    jsonb_build_object('buttonId','offer_reason_same','buttonText','Ahora no me interesa'),
    jsonb_build_object('buttonId','offer_reason_other','buttonText','Otro motivo')
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
  if crm_private.is_commercial_optout(new.text_content) then
    insert into crm_private.commercial_optouts(phone,contact_id,received_at) values(ph,cid,new.created_at)
    on conflict(phone) do update set contact_id=coalesce(excluded.contact_id,crm_private.commercial_optouts.contact_id),received_at=excluded.received_at;
    update public.crm_server_automation_jobs j set status='cancelled',error_message='Cliente solicita no recibir más mensajes',updated_at=now()
    where j.status in ('pending','paused') and not(j.action_config ? '__delivery_receipt')
    and j.action_type in ('flow_v1','send_template','send_whatsapp_now','__send_whatsapp','schedule_whatsapp')
    and crm_private.whatsapp_phone_key(j.context->>'phone')=crm_private.whatsapp_phone_key(ph);
    update public.agenda_items set whatsapp_delivery_status='cancelled',whatsapp_delivery_error='Cliente solicita no recibir más mensajes',updated_at=now()
    where whatsapp_enabled and status='pending' and whatsapp_delivery_status in ('pending','paused')
    and crm_private.whatsapp_phone_key(coalesce(nullif(whatsapp_phone,''),customer_phone))=crm_private.whatsapp_phone_key(ph);
    return new;
  end if;
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
        'Elige el motivo que mejor encaje:',first_reason_buttons,'decline_reason_more');
      return new;
    elsif selected='reason_back' then
      perform crm_private.offer_enqueue_message(offer,'offer-reason-back:'||offer.id||':'||new.id,
        'Gracias por responder. ¿Cuál es el motivo principal?',first_reason_buttons,'decline_reason_prompt');
      return new;
    elsif selected='reason_other' then
      update public.crm_offer_response_states set state='awaiting_text',reason='Otro motivo',updated_at=now() where offer_instance_id=offer.id and state='awaiting_reason';
      perform crm_private.offer_enqueue_message(offer,'offer-reason-text:'||offer.id||':'||new.id,'Cuéntanos el motivo en un mensaje, si quieres. Gracias por ayudarnos a mejorar.','[]'::jsonb,'decline_reason_text');
      return new;
    end if;
    reason_text := case selected when 'reason_price' then 'Es por el precio' when 'reason_same' then 'Ahora no me interesa' when 'reason_later' then 'Más adelante' end;
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
      where j.status in ('pending','running') and j.context#>>'{lifecycle,mode}'='after_sale' and (j.context->>'contact_id'=cid::text or crm_private.whatsapp_phone_key(j.context->>'phone')=crm_private.whatsapp_phone_key(ph));
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
$function$
;
CREATE OR REPLACE FUNCTION crm_private.offer_cancel_reminders(p_offer_id uuid,p_reason text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
declare changed integer;
begin
 update public.crm_server_automation_jobs set status='cancelled',error_message=p_reason,updated_at=now()
 where status in ('pending','paused','running') and context->>'offer_instance_id'=p_offer_id::text
 and action_type not in ('record_offer_month','record_sale_month') and not(action_config ? '__delivery_receipt');
 get diagnostics changed=row_count;return changed;
end;$$;
CREATE OR REPLACE FUNCTION crm_private.whatsapp_sent_records() RETURNS TABLE(message_key text,sent_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 with messages as (
 select coalesce(nullif(id_message,''),'wa:'||id::text) key,
 case when ts>1000000000000 then to_timestamp(ts::double precision/1000) when ts>0 then to_timestamp(ts::double precision) else created_at end at_time from public.wa_messages where direction='out'
 union all
 select action_config#>>'{__delivery_receipt,idMessage}',coalesce(nullif(action_config#>>'{__delivery_receipt,acceptedAt}','')::timestamptz,completed_at,updated_at)
 from public.crm_server_automation_jobs where action_type in ('send_template','send_whatsapp_now','__send_whatsapp','schedule_whatsapp') and nullif(action_config#>>'{__delivery_receipt,idMessage}','') is not null
 union all
 select coalesce(nullif(whatsapp_provider_message_id,''),'agenda:'||id::text),whatsapp_sent_at
 from public.agenda_items where whatsapp_delivery_status='sent' and whatsapp_sent_at is not null
 )
 select key,min(at_time) from messages where key is not null group by key;
$$;
REVOKE ALL ON FUNCTION crm_private.whatsapp_sent_records() FROM public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.crm_whatsapp_send_monitor() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
declare start_at timestamptz:=((current_timestamp at time zone 'Europe/Madrid')::date+time '00:00') at time zone 'Europe/Madrid';end_at timestamptz:=(((current_timestamp at time zone 'Europe/Madrid')::date+1)+time '00:00') at time zone 'Europe/Madrid';result jsonb;
begin
 if auth.uid() is null or not public.current_user_is_admin() then raise exception 'Solo administración';end if;
 select jsonb_build_object(
 'enabled',public.crm_server_automations_enabled(),
 'sent_today',(select count(*) from crm_private.whatsapp_sent_records() where sent_at>=start_at and sent_at<end_at),
 'pending_today',(select count(*) from public.crm_server_automation_jobs where status='pending' and action_type in ('send_template','send_whatsapp_now','__send_whatsapp','schedule_whatsapp') and run_at<end_at),
 'failed_24h',(select count(*) from public.crm_server_automation_jobs where status='failed' and updated_at>=now()-interval '24 hours' and action_type in ('send_template','send_whatsapp_now','__send_whatsapp','schedule_whatsapp')),
 'unanswered_reminders',(select count(*) from public.crm_server_automation_jobs j where status='pending' and action_config->>'offer_phase' in ('reminder_2','reminder_5') and not exists(select 1 from public.wa_messages m where m.direction='in' and public.crm_server_normalize_phone(split_part(m.chat_id,'@',1))=public.crm_server_normalize_phone(j.context->>'phone') and m.created_at>j.created_at)),
 'duplicate_pending',(select count(*) from (select public.crm_server_normalize_phone(context->>'phone'), action_config->>'text',date_trunc('hour',run_at) from public.crm_server_automation_jobs where status='pending' and action_type in ('send_whatsapp_now','__send_whatsapp','schedule_whatsapp') and nullif(action_config->>'text','') is not null group by 1,2,3 having count(*)>1) x),
 'manual_pending_today',(select count(*) from public.agenda_items where whatsapp_enabled and status='pending' and coalesce(whatsapp_delivery_status,'pending')='pending' and coalesce(whatsapp_scheduled_at,starts_at)<end_at),
 'daily_average',(select round(count(*)::numeric/7,1) from crm_private.whatsapp_sent_records() where sent_at>=start_at-interval '7 days' and sent_at<start_at)
 ) into result;return result;
end;$$;
REVOKE ALL ON FUNCTION public.crm_whatsapp_send_monitor() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.crm_whatsapp_send_monitor() TO authenticated;

