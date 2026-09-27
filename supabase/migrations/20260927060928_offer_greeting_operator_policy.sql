-- Preserve recipient routing and schedules; persist greeting policy with each offer.
CREATE OR REPLACE FUNCTION public.crm_create_offer_execution_v9(p_contact_id uuid, p_catalog_offer_id uuid, p_request_key uuid, p_selections jsonb DEFAULT '[]'::jsonb, p_extra_text text DEFAULT NULL::text, p_mode text DEFAULT 'followup'::text, p_final_price numeric DEFAULT NULL::numeric, p_send_message boolean DEFAULT false, p_processing_date date DEFAULT NULL::date, p_test_mode boolean DEFAULT false, p_allow_duplicate boolean DEFAULT false, p_send_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_welcome boolean DEFAULT false, p_recipient_contact_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  uid uuid:=auth.uid();
  result jsonb;
  offer_id uuid;
  recipient public.records%rowtype;
  recipient_id uuid:=coalesce(p_recipient_contact_id,p_contact_id);
  recipient_name text;
  recipient_first_name text;
  recipient_phone text;
  message text;
  offer_operator text;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into recipient from public.records where id=recipient_id;
  if not found then raise exception 'El destinatario de la oferta no existe'; end if;
  if recipient_id is distinct from p_contact_id and not exists(
    select 1 from public.records manager
    where manager.id=recipient_id
      and manager.data @> jsonb_build_object(
        'TPF_RELACIONES',jsonb_build_object(
          'managed_contacts',jsonb_build_array(jsonb_build_object('record_id',p_contact_id::text))
        )
      )
  ) then
    raise exception 'El destinatario no gestiona este contacto';
  end if;
  recipient_name:=coalesce(
    nullif(btrim(recipient.data->>'NOMBRE Y APELLIDOS'),''),
    nullif(btrim(concat_ws(' ',recipient.data->>'NOMBRE',recipient.data->>'APELLIDOS')),''),
    'Cliente'
  );
  recipient_first_name:=coalesce(
    nullif(btrim(recipient.data->>'NOMBRE'),''),
    split_part(recipient_name,' ',1)
  );
  recipient_phone:=public.crm_server_normalize_phone(coalesce(
    recipient.data->>'TELÉFONO',recipient.data->>'TELEFONO',recipient.data->>'PHONE',recipient.data->>'MOVIL',''
  ));
  if (p_mode='followup' or p_send_message) and (recipient_phone is null or length(recipient_phone)<8) then
    raise exception 'El destinatario no tiene un teléfono válido';
  end if;
  result:=public.crm_create_offer_execution_v8(
    p_contact_id,p_catalog_offer_id,p_request_key,p_selections,p_extra_text,p_mode,
    p_final_price,p_send_message,p_processing_date,p_test_mode,p_allow_duplicate,p_send_at,p_welcome
  );
  offer_id:=nullif(result->>'offer_id','')::uuid;
  if offer_id is null then raise exception 'Protección CRM: no se pudo localizar la oferta creada'; end if;
  select message_text,operator into message,offer_operator from public.crm_offer_instances
    where id=offer_id and created_by=uid for update;
  if message is null then raise exception 'Protección CRM: no se pudo preparar el mensaje de la oferta'; end if;
  message:=regexp_replace(message,'^Hola [^,'||chr(10)||']+', 'Hola '||recipient_first_name);
  if not coalesce(p_welcome,false) and nullif(btrim(offer_operator),'') is not null then
    message:=replace(message,'te envío la oferta que hemos comentado:',
      'te envío la oferta de '||offer_operator||' que hemos comentado:');
  end if;

  update public.crm_offer_instances
  set message_text=message,
      snapshot=coalesce(snapshot,'{}'::jsonb)||jsonb_build_object(
        'offer_welcome',coalesce(p_welcome,false),
        'recipient_first_name',recipient_first_name,
        'recipient_contact_id',recipient_id,
        'recipient_name',recipient_name,
        'recipient_phone',recipient_phone
      ),
      updated_at=now()
  where id=offer_id and created_by=uid;
  update public.crm_server_automation_jobs
  set context=coalesce(context,'{}'::jsonb)||jsonb_build_object(
        'phone',recipient_phone,
        'name',recipient_first_name,
        'offer_welcome',coalesce(p_welcome,false),
        'recipient_first_name',recipient_first_name,
        'recipient_contact_id',recipient_id,
        'recipient_name',recipient_name,
        'oferta_mensaje',message
      ),
      updated_at=now()
  where user_id=uid
    and context->>'offer_instance_id'=offer_id::text
    and status='pending';
  return result||jsonb_build_object(
    'offer_welcome',coalesce(p_welcome,false),
        'recipient_first_name',recipient_first_name,
        'recipient_contact_id',recipient_id,
    'recipient_name',recipient_name,
    'recipient_phone',recipient_phone,
    'message',message
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_create_direct_sale_v2(p_contact_id uuid, p_operator text, p_total_price numeric, p_send_message boolean, p_netflix_followup boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid:=auth.uid();rec public.records%rowtype;processed_stage public.sales_stages%rowtype;
  inst public.crm_offer_instances%rowtype;rule public.crm_automations%rowtype;
  nm text;first_name text;phone text;operator_name text;message text;opp_id uuid;instance_id uuid;
  total numeric;flow jsonb;ctx jsonb;today_madrid date:=(now() at time zone 'Europe/Madrid')::date;
begin
  if uid is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para crear ventas';end if;
  operator_name:=case lower(btrim(coalesce(p_operator,''))) when 'vodafone' then 'Vodafone' when 'yoigo' then 'Yoigo' when 'másmóvil' then 'MásMóvil' when 'masmovil' then 'MásMóvil' when 'o2' then 'O2' when 'lowi' then 'Lowi' when 'orange' then 'Orange' else null end;
  if operator_name is null then raise exception 'Operador no válido';end if;
  total:=round(coalesce(p_total_price,-1),2);if total<0 then raise exception 'El precio final no puede ser negativo';end if;
  select * into rec from public.records where id=p_contact_id;if not found then raise exception 'Contacto no encontrado';end if;
  select * into processed_stage from public.sales_stages where active and lower(btrim(name))='tramitado' order by position limit 1;
  if processed_stage.id is null then raise exception 'Falta la columna Tramitado';end if;
  nm:=coalesce(nullif(btrim(rec.data->>'NOMBRE Y APELLIDOS'),''),nullif(btrim(concat_ws(' ',rec.data->>'NOMBRE',rec.data->>'APELLIDOS')),''),'Cliente');
  first_name:=coalesce(nullif(btrim(rec.data->>'NOMBRE'),''),split_part(nm,' ',1));phone:=public.crm_server_normalize_phone(coalesce(rec.data->>'TELÉFONO',rec.data->>'TELEFONO',rec.data->>'PHONE',rec.data->>'MOVIL',''));
  if p_send_message and (phone is null or length(phone)<8) then raise exception 'El contacto no tiene un teléfono válido';end if;
  message:='Hola '||first_name||', te envío lo que hemos comentado:'||E'\n• Operador: '||operator_name||E'\nPrecio final: '||to_char(total,'FM999999990D00')||' €/mes';
  insert into public.sales_opportunities(pipeline_id,stage_id,record_id,title,client_name,phone,amount,expected_date,owner_user_id,status,notes)
  values(processed_stage.pipeline_id,processed_stage.id,rec.id,'CAMBIO '||upper(operator_name),nm,phone,total,today_madrid,uid,'open','Venta directa creada desde el CRM') returning id into opp_id;
  insert into public.crm_offer_instances(opportunity_id,contact_id,catalog_offer_id,created_by,operator,offer_name,base_price,total_price,snapshot,message_text,status,accepted_at,processed_at)
  values(opp_id,rec.id,null,uid,operator_name,'Venta directa',total,total,jsonb_build_object('operator',operator_name,'offer_name','Venta directa','direct_sale',true,'netflix_followup',operator_name='Vodafone' and coalesce(p_netflix_followup,false),'total_price',total,'send_message',p_send_message,'processing_date',today_madrid),message,'processed',now(),now()) returning * into inst;
  instance_id:=inst.id;perform crm_private.offer_record_sale(inst,now());perform crm_private.enqueue_opportunity_stage(opp_id);
  if p_send_message then
    perform pg_advisory_xact_lock(hashtextextended(uid::text,9417));
    select * into rule from public.crm_automations where user_id=uid and trigger_type='manual_offer' order by created_at limit 1;
    if not found then insert into public.crm_automations(user_id,name,enabled,trigger_type,trigger_config,action_type,action_config) values(uid,'OFERTAS · Seguimiento general',true,'manual_offer',jsonb_build_object('automation_operator','General','automation_category','Seguimiento'),'flow_v1',jsonb_build_object('version',1,'steps',jsonb_build_array())) returning * into rule;end if;
    flow:=jsonb_build_object('version',1,'steps',jsonb_build_array(jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text','{oferta_mensaje}','offer_phase','direct_sale'))));rule.action_config:=flow;
    ctx:=public.crm_server_context_for_contact(rec.id,phone)||jsonb_build_object('opportunity_id',opp_id,'offer_instance_id',instance_id,'operator',operator_name,'precio_total',to_char(total,'FM999999990D00'),'oferta_mensaje',message,'trigger_type','manual_offer','event_at',now());
    perform public.crm_server_enqueue(rule,'direct-sale:'||instance_id,ctx);
  end if;
  return jsonb_build_object('ok',true,'opportunity_id',opp_id,'offer_id',instance_id,'operator',operator_name,'total_price',total,'stage',processed_stage.name,'message_requested',p_send_message,'netflix_followup',operator_name='Vodafone' and coalesce(p_netflix_followup,false));
end $function$;

