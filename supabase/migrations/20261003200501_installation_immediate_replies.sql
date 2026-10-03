-- Confirmations and their router instructions reply immediately; commercial reminders remain scheduled.

create or replace function crm_private.installation_defaults() returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('netflix_extra_text','','slots','[]'::jsonb,'shop_phone','','return_time','10:00',
 'appointment_text',E'Hola {nombre} 👋\n\nLa instalación de {operador} está prevista para el {fecha}, {franja}. Estate pendiente del teléfono: el técnico podría llamarte para confirmar la visita o adelantarla.\n\nSi tienes algún problema, {ayuda}. Cuando esté instalada, pulsa «Instalado» para confirmarlo.',
 'no_appointment_text',E'Hola {nombre} 👋\n\nHemos tramitado tu contrato con {operador}. Estamos pendientes de que el operador confirme la cita de instalación. Estate pendiente del teléfono: el técnico podría llamarte para concertar o adelantar la visita.\n\nSi tienes algún problema, {ayuda}. Cuando esté instalada, pulsa «Instalado» para confirmarlo.',
 'date_prompt_text','Gracias, {nombre}. ¿Qué día te instalaron la fibra?',
 'date_other_text','Escribe la fecha de instalación con este formato: DD/MM/AAAA. ',
 'confirmed_text','Gracias, {nombre}. Hemos anotado tu instalación del {fecha_instalacion}. Si tienes algún problema, {ayuda}.');
$$;

create or replace function crm_private.installation_schedule_return(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare i public.crm_installations%rowtype;txt text;confirmation text;j uuid;due timestamptz;reply_context jsonb;
begin
 select * into i from public.crm_installations where id=p_id for update;
 if not found or i.installed_on is null or i.return_job_id is not null then return;end if;
 reply_context:=i.recipient_context-'contract_party';
 confirmation:=crm_private.installation_render(i.config_snapshot->>'confirmed_text',i.config_snapshot,reply_context,i.appointment_date,i.time_from,i.time_to,i.installed_on);
 if i.previous_operator='Ninguno' then
  perform crm_private.installation_enqueue(i.id,'confirmed',crm_private.contract_message(confirmation,i.recipient_context->'contract_party'),'[]','installation_confirmed',now());
  update public.crm_installations set return_due_at=null,incident='',updated_at=clock_timestamp() where id=i.id;return;
 end if;
 if nullif(btrim(i.previous_operator),'') is null or nullif(btrim(i.return_text),'') is null then
  perform crm_private.installation_enqueue(i.id,'confirmed',crm_private.contract_message(confirmation,i.recipient_context->'contract_party'),'[]','installation_confirmed',now());
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
  if pressed_at<i.created_at-interval '2 minutes' then return new;end if;
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

create or replace function public.crm_installation_preview(p_opportunity_id uuid default null,p_contact_id uuid default null,p_manager_contact_id uuid default null,p_recipient_contact_id uuid default null,p_operator text default null,p_netflix_followup boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
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
 v:=jsonb_build_object('operator',p_operator,'preferences',o.after_sale_preferences,'netflix_followup',p_netflix_followup);
 if party is not null then v:=v||jsonb_build_object('contract_party',party,'recipient',party->>'recipient_name','recipient_first_name',party->>'recipient_first_name','phone',party->>'recipient_phone');end if;
 cfg:=crm_private.installation_config(coalesce(v->>'operator',p_operator,''));
 return v||jsonb_build_object('workflow','installation_v1','available',length(coalesce(v->>'phone',''))>=8,'installation_config',cfg,'return_times',coalesce((select jsonb_object_agg(value->>'operator',value->>'return_time') from public.app_settings where key like 'crm_installation_template:%'),'{}'::jsonb),'opportunity_updated_at',o.updated_at,'excel_date',o.installation_date,'installation', (select to_jsonb(i)||jsonb_build_object('notice_status',nj.status,'return_status',rj.status,'return_sent_at',rj.completed_at,'return_message',rj.action_config->>'text') from public.crm_installations i left join public.crm_server_automation_jobs nj on nj.id=i.notice_job_id left join public.crm_server_automation_jobs rj on rj.id=i.return_job_id where opportunity_id=p_opportunity_id));
end;$$;

-- Legacy Tramitado rows without an installation record or Excel date are commercial history.
-- Exclude them from the installation register without changing sales, tags or jobs.
create or replace function public.crm_installations_list() returns setof jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_view_sales')) then raise exception 'No tienes permiso';end if;
 return query select coalesce(to_jsonb(i),'{}'::jsonb)||jsonb_build_object('opportunity_id',o.id,'client_name',o.client_name,'operator',coalesce(i.operator,f.operator,o.installation_operator,o.after_sale_preferences->>'operator',o.title),'price',o.amount,'notice_status',nj.status,'return_status',rj.status,'return_sent_at',rj.completed_at,'return_message',rj.action_config->>'text','incident',coalesce(nullif(i.incident,''),case when rj.status='failed' then rj.error_message when nj.status='failed' then nj.error_message end,''),'offer_instance_id',coalesce(i.offer_instance_id,f.id),'offer_sent',f.sent_at is not null,'excel_date',o.installation_date,'status',case when o.installation_date is not null then 'excel' when coalesce(i.incident,'')<>'' or nj.status='failed' or rj.status='failed' then 'incident' when i.installed_on is not null then 'confirmed' when i.appointment_date is not null then 'scheduled' else 'undated' end,'legacy',i.id is null)
 from public.sales_opportunities o join public.sales_stages s on s.id=o.stage_id left join public.crm_installations i on i.opportunity_id=o.id
 left join public.crm_server_automation_jobs nj on nj.id=i.notice_job_id left join public.crm_server_automation_jobs rj on rj.id=i.return_job_id
 left join lateral(select * from public.crm_offer_instances where opportunity_id=o.id order by created_at desc limit 1) f on true
 where (i.id is not null and lower(btrim(s.name)) in ('tramitado','ganado')) or o.installation_date is not null
 order by i.appointment_date nulls last,i.time_from nulls last,o.created_at,o.id;
end;$$;
revoke all on function public.crm_installations_list() from public,anon;
grant execute on function public.crm_installations_list() to authenticated;



CREATE OR REPLACE FUNCTION public.crm_lifecycle_job_guard(p_job uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  j public.crm_server_automation_jobs%rowtype;p jsonb;cid uuid;oid uuid;offer_id uuid;
  reason text;prev public.crm_server_automation_jobs%rowtype;ph text;
begin
  select * into j from public.crm_server_automation_jobs where id=p_job;
  if not found or j.status<>'running' then return jsonb_build_object('allow',false,'reason','Ejecución detenida');end if;
  if nullif(j.context->>'review_id','') is not null then
    -- Receipt verification is read-only and continues after the review is completed.
    if j.action_config ? '__delivery_receipt' then return jsonb_build_object('allow',true,'context',j.context);end if;
    if not exists(select 1 from public.crm_monthly_reviews r join public.sales_opportunities o on o.id=r.opportunity_id where r.id::text=j.context->>'review_id' and r.job_id=j.id and r.status='active' and r.send_enabled and not r.needs_confirmation and o.status='open') then reason:='Revisión cancelada o completada';
    elsif exists(select 1 from crm_private.commercial_optouts where phone=public.crm_server_normalize_phone(j.context->>'phone') or contact_id::text=j.context->>'contact_id' or contact_id::text=j.context->>'recipient_contact_id') then reason:='Baja comercial solicitada';
    elsif not exists(select 1 from public.records where id::text=coalesce(j.context->>'recipient_contact_id',j.context->>'contact_id')) then reason:='Destinatario no disponible';
    elsif not exists(select 1 from public.crm_automations where id=j.automation_id and enabled) then reason:='Automatización pausada';end if;
    if reason is not null then update public.crm_server_automation_jobs set status='cancelled',error_message=reason,updated_at=now() where id=j.id;return jsonb_build_object('allow',false,'reason',reason);end if;
    return jsonb_build_object('allow',true,'context',j.context);
  end if;
  if nullif(j.context->>'installation_id','') is not null then
    if j.action_config ? '__delivery_receipt' then return jsonb_build_object('allow',true,'context',j.context);end if;
    if not public.crm_server_automations_enabled() then reason:='Motor pausado';
    elsif not exists(select 1 from public.crm_installations i join public.sales_opportunities o on o.id=i.opportunity_id join public.sales_stages s on s.id=o.stage_id where i.id::text=j.context->>'installation_id' and lower(btrim(s.name)) in ('tramitado','ganado') and public.crm_server_normalize_phone(i.recipient_context->>'phone')=public.crm_server_normalize_phone(j.context->>'phone')) then reason:='Instalación o destinatario no disponible';
    elsif j.context->>'installation_phase'='installation_notice' and not exists(select 1 from public.crm_installations i where i.id::text=j.context->>'installation_id' and i.notice_job_id=j.id and i.installed_on is null) then reason:='Cita actualizada o instalación confirmada';
    elsif j.context->>'installation_phase'='installation_date' and not exists(select 1 from public.crm_installations i where i.id::text=j.context->>'installation_id' and i.awaiting_date and i.installed_on is null) then reason:='La fecha de instalación ya está confirmada';
    elsif j.context->>'installation_phase'='installation_return' and not exists(select 1 from public.crm_installations i where i.id::text=j.context->>'installation_id' and i.return_job_id=j.id and i.installed_on is not null and nullif(i.previous_operator,'') is not null and i.previous_operator<>'Ninguno') then reason:='Devolución no disponible';
    end if;
    if reason is not null then update public.crm_server_automation_jobs set status='cancelled',error_message=reason,updated_at=now() where id=j.id;return jsonb_build_object('allow',false,'reason',reason);end if;
    return jsonb_build_object('allow',true,'context',j.context);
  end if;
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
    if oid is null or not exists(select 1 from public.sales_opportunities where id=oid and record_id=cid and (stage_id::text=p->>'stage_id' or stage_id in (select id from public.sales_stages where lower(btrim(name))='ganado'))) then reason:='Oportunidad fuera de Tramitado';end if;
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
end $function$;



-- Apply the requested timing to queued replies only. Sent, running, paused and uncertain deliveries are untouched.
with changed as (
 update public.crm_server_automation_jobs j set run_at=now(),
 action_config=jsonb_set(j.action_config,'{text}',to_jsonb(
   crm_private.contract_message(coalesce(nullif(crm_private.installation_render(i.config_snapshot->>'confirmed_text',i.config_snapshot,i.recipient_context-'contract_party',i.appointment_date,i.time_from,i.time_to,i.installed_on),''),'Instalación confirmada.')||E'\n\n'||regexp_replace(coalesce(j.action_config->>'text',''),E'^Hola [^\n]*\n[[:space:]]*',''),i.recipient_context->'contract_party')
 )),updated_at=clock_timestamp()
 from public.crm_installations i join public.sales_opportunities o on o.id=i.opportunity_id join public.sales_stages s on s.id=o.stage_id
 where j.id=i.return_job_id and i.installed_on is not null and lower(btrim(s.name)) in ('tramitado','ganado') and j.status='pending' and j.run_at>now() and not j.action_config ? '__delivery_receipt' and j.context->>'installation_phase'='installation_return'
 returning j.id,j.run_at
)
update public.crm_installations i set return_due_at=c.run_at,updated_at=clock_timestamp() from changed c where i.return_job_id=c.id;
update public.crm_server_automation_jobs set run_at=now(),updated_at=clock_timestamp()
where status='pending' and run_at>now() and context#>>'{lifecycle,mode}'='offer_response' and created_at>now()-interval '1 day' and not action_config ? '__delivery_receipt';

-- Server-only read API: ordinary outside-hours enquiries keep their absence reply.
-- SECURITY INVOKER deliberately uses the service role's existing table permissions.
create function public.crm_whatsapp_transactional_replies(p_incoming_ids text[]) returns table(incoming_id text)
language sql stable security invoker set search_path='' as $$
 select m.id_message from public.wa_messages m
 where m.id_message=any(p_incoming_ids) and m.direction='in' and m.chat_id not like '%@g.us' and (
  exists(select 1 from public.crm_offer_followup_events e where e.message_id=m.id_message and e.event_type in ('offer_interest','offer_declined','offer_alternative_requested','decline_reason_saved','button_ignored'))
  or exists(select 1 from public.crm_server_automation_jobs j where j.context#>>'{lifecycle,mode}'='offer_response'
    and public.crm_server_normalize_phone(j.context->>'phone')=public.crm_server_normalize_phone(split_part(m.chat_id,'@',1))
    and j.event_key in ('offer-reason-more:'||(j.context->>'offer_instance_id')||':'||m.id,'offer-reason-back:'||(j.context->>'offer_instance_id')||':'||m.id,'offer-reason-text:'||(j.context->>'offer_instance_id')||':'||m.id))
  or exists(select 1 from public.crm_installations i where public.crm_server_normalize_phone(i.recipient_context->>'phone')=public.crm_server_normalize_phone(split_part(m.chat_id,'@',1)) and (
    i.confirmation_message_id=m.id_message
    or coalesce(m.raw#>>'{messageData,interactiveButtonsResponse,interactiveButtonsResponse,selectedButtonId}',m.raw#>>'{interactiveButtonsResponse,interactiveButtonsResponse,selectedButtonId}',m.raw#>>'{messageData,interactiveButtonsResponse,selectedButtonId}',m.raw#>>'{messageData,interactiveButtonsResponse,selectedId}',m.raw#>>'{interactiveButtonsResponse,selectedButtonId}',m.raw#>>'{interactiveButtonsResponse,selectedId}',m.raw#>>'{messageData,buttonsResponseMessage,selectedButtonId}',m.raw#>>'{buttonsResponseMessage,selectedButtonId}',m.raw#>>'{messageData,templateButtonReplyMessage,selectedId}',m.raw#>>'{templateButtonReplyMessage,selectedId}') in ('install_done:'||i.id,'install_today:'||i.id,'install_yesterday:'||i.id,'install_other:'||i.id)
    or exists(select 1 from public.crm_installation_outgoing_messages sent where sent.installation_id=i.id and (
      sent.provider_message_id=coalesce(m.raw#>>'{messageData,interactiveButtonsResponse,stanzaId}',m.raw#>>'{interactiveButtonsResponse,stanzaId}',m.raw#>>'{messageData,quotedMessage,stanzaId}',m.raw#>>'{quotedMessage,stanzaId}',m.raw#>>'{extendedTextMessage,stanzaId}')
      or sent.phase='installation_return' and sent.sent_at<=m.created_at and sent.sent_at>=m.created_at-interval '30 minutes'
        and not exists(select 1 from public.wa_messages other where other.chat_id=m.chat_id and other.direction='out' and other.id_message<>sent.provider_message_id and other.created_at>sent.sent_at and other.created_at<m.created_at)
    ))
  ))
  or exists(select 1 from public.crm_offer_outgoing_messages sent join public.crm_offer_instances f on f.id=sent.offer_instance_id join public.sales_opportunities o on o.id=f.opportunity_id
    where sent.provider_message_id=coalesce(m.raw#>>'{messageData,interactiveButtonsResponse,stanzaId}',m.raw#>>'{interactiveButtonsResponse,stanzaId}',m.raw#>>'{messageData,quotedMessage,stanzaId}',m.raw#>>'{quotedMessage,stanzaId}',m.raw#>>'{extendedTextMessage,stanzaId}')
    and public.crm_server_normalize_phone(coalesce(o.contract_party->>'recipient_phone',o.phone))=public.crm_server_normalize_phone(split_part(m.chat_id,'@',1)))
 );
$$;
revoke all on function public.crm_whatsapp_transactional_replies(text[]) from public,anon,authenticated;
grant execute on function public.crm_whatsapp_transactional_replies(text[]) to service_role;



update public.app_settings set value=jsonb_set(jsonb_set(value,'{appointment_text}',to_jsonb(replace(value->>'appointment_text','pulsa «Instalado» para indicarnos la fecha.','pulsa «Instalado» para confirmarlo.'))),'{no_appointment_text}',to_jsonb(replace(value->>'no_appointment_text','pulsa «Instalado» para indicarnos la fecha.','pulsa «Instalado» para confirmarlo.'))),updated_at=clock_timestamp()
where key like 'crm_installation_template:%' and value ? 'appointment_text' and value ? 'no_appointment_text' and (value->>'appointment_text' like '%pulsa «Instalado» para indicarnos la fecha.%' or value->>'no_appointment_text' like '%pulsa «Instalado» para indicarnos la fecha.%');



revoke all on function crm_private.installation_defaults(),crm_private.installation_schedule_return(uuid),crm_private.installation_incoming() from public,anon,authenticated;
revoke all on function public.crm_installation_preview(uuid,uuid,uuid,uuid,text,boolean),public.crm_lifecycle_job_guard(uuid) from public,anon;
grant execute on function public.crm_installation_preview(uuid,uuid,uuid,uuid,text,boolean) to authenticated;
revoke all on function public.crm_lifecycle_job_guard(uuid) from authenticated;
grant execute on function public.crm_lifecycle_job_guard(uuid) to service_role;
notify pgrst, 'reload schema';
