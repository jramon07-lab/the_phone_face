create or replace function crm_private.resolve_sale_party(hid uuid, mid uuid, rid uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare h public.records; m public.records; r public.records; p jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into h from public.records where id=hid and source_sheet='BASE DE DATOS';if not found then raise exception 'Titular no disponible';end if;
 mid:=coalesce(mid,hid);rid:=coalesce(rid,mid);
 select * into m from public.records where id=mid and source_sheet='BASE DE DATOS';if not found then raise exception 'Gestor no disponible';end if;
 if mid<>hid and not (m.data @> jsonb_build_object('TPF_RELACIONES',jsonb_build_object('managed_contacts',jsonb_build_array(jsonb_build_object('record_id',hid::text))))) then raise exception 'El gestor ya no está vinculado al titular';end if;
 if rid<>mid and rid<>hid then raise exception 'Destinatario no válido';end if;
 select * into r from public.records where id=rid;
 p:=crm_private.party_snapshot(jsonb_build_object('same',mid=hid,'holder_first_name',h.data->>'NOMBRE','holder_last_name',h.data->>'APELLIDOS','holder_name',h.data->>'NOMBRE Y APELLIDOS','holder_dni',coalesce(h.data->>'DNI / NIF',h.data->>'DNI',''),'holder_phone',coalesce(h.data->>'TELÉFONO',h.data->>'TELEFONO',''),'recipient',case when rid=hid and mid<>hid then 'holder' else 'contact' end),
 coalesce(nullif(m.data->>'NOMBRE Y APELLIDOS',''),btrim(concat_ws(' ',m.data->>'NOMBRE',m.data->>'APELLIDOS'))),coalesce(m.data->>'TELÉFONO',m.data->>'TELEFONO',''),coalesce(m.data->>'DNI / NIF',m.data->>'DNI',''));
 return p||jsonb_build_object('holder_record_id',hid,'manager_record_id',mid,'recipient_contact_id',rid,'recipient_first_name',coalesce(nullif(r.data->>'NOMBRE',''),split_part(p->>'recipient_name',' ',1)));
end $$;
revoke all on function crm_private.resolve_sale_party(uuid,uuid,uuid) from public,anon;
grant execute on function crm_private.resolve_sale_party(uuid,uuid,uuid) to authenticated,service_role;

CREATE OR REPLACE FUNCTION crm_private.party_opportunity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare d jsonb; chosen jsonb;
begin
 if tg_op='INSERT' and nullif(current_setting('crm.sale_party',true),'') is not null then
 chosen:=current_setting('crm.sale_party',true)::jsonb;
 if chosen->>'holder_record_id'=new.record_id::text then
 new.contract_party:=crm_private.resolve_sale_party(new.record_id,(chosen->>'manager_record_id')::uuid,(chosen->>'recipient_contact_id')::uuid);
 new.client_name:=new.contract_party->>'holder_name';new.phone:=new.contract_party->>'recipient_phone';return new;
 end if;end if;
 if tg_op='UPDATE' then
   -- An unrelated title, stage, price or contact edit must not change this snapshot.
   if new.contract_party is not distinct from old.contract_party then return new;end if;
 end if;
 if new.contract_party is null then
   select data into d from public.records where id=new.record_id;
   new.contract_party:=crm_private.party_from_data(d);
 else
   new.contract_party:=crm_private.party_snapshot(new.contract_party,
    coalesce(new.contract_party->>'contact_name',new.client_name,''),coalesce(new.contract_party->>'contact_phone',new.phone,''),coalesce(new.contract_party->>'contact_dni',''));
 end if;
 return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.crm_create_direct_sale_v4(p_contact_id uuid, p_operator text, p_total_price numeric, p_send_message boolean, p_netflix_followup boolean, p_counteroffer boolean, p_manager_contact_id uuid, p_recipient_contact_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid:=auth.uid();rec public.records%rowtype;processed_stage public.sales_stages%rowtype;
  inst public.crm_offer_instances%rowtype;rule public.crm_automations%rowtype;
  nm text;first_name text;phone text;operator_name text;message text;opp_id uuid;instance_id uuid;
  party jsonb;v_counter_label_id uuid;total numeric;flow jsonb;ctx jsonb;today_madrid date:=(now() at time zone 'Europe/Madrid')::date;
begin
  if uid is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para crear ventas';end if;
  operator_name:=case lower(btrim(coalesce(p_operator,''))) when 'vodafone' then 'Vodafone' when 'yoigo' then 'Yoigo' when 'másmóvil' then 'MásMóvil' when 'masmovil' then 'MásMóvil' when 'o2' then 'O2' when 'lowi' then 'Lowi' when 'orange' then 'Orange' else null end;
  if operator_name is null then raise exception 'Operador no válido';end if;
  if coalesce(p_counteroffer,false) and operator_name<>'Vodafone' then raise exception 'Contraoferta solo disponible para Vodafone';end if;
  total:=round(coalesce(p_total_price,-1),2);if total<0 then raise exception 'El precio final no puede ser negativo';end if;
  select * into rec from public.records where id=p_contact_id;if not found then raise exception 'Contacto no encontrado';end if;
  select * into processed_stage from public.sales_stages where active and lower(btrim(name))='tramitado' order by position limit 1;
  if processed_stage.id is null then raise exception 'Falta la columna Tramitado';end if;
  nm:=coalesce(nullif(btrim(rec.data->>'NOMBRE Y APELLIDOS'),''),nullif(btrim(concat_ws(' ',rec.data->>'NOMBRE',rec.data->>'APELLIDOS')),''),'Cliente');
  party:=crm_private.resolve_sale_party(p_contact_id,p_manager_contact_id,p_recipient_contact_id);
  first_name:=coalesce(nullif(btrim(rec.data->>'NOMBRE'),''),split_part(nm,' ',1));phone:=public.crm_server_normalize_phone(coalesce(rec.data->>'TELÉFONO',rec.data->>'TELEFONO',rec.data->>'PHONE',rec.data->>'MOVIL',''));
  first_name:=party->>'recipient_first_name';phone:=public.crm_server_normalize_phone(party->>'recipient_phone');
  if p_send_message and (phone is null or length(phone)<8) then raise exception 'El contacto no tiene un teléfono válido';end if;
  message:='Hola '||first_name||', te envío lo que hemos comentado:'||E'\n• Operador: '||operator_name||E'\nPrecio final: '||to_char(total,'FM999999990D00')||' €/mes';
  insert into public.sales_opportunities(pipeline_id,stage_id,record_id,title,client_name,phone,amount,expected_date,owner_user_id,status,notes,contract_party)
  values(processed_stage.pipeline_id,processed_stage.id,rec.id,'CAMBIO '||upper(operator_name),nm,phone,total,today_madrid,uid,'open','Venta directa creada desde el CRM',party) returning id into opp_id;
  insert into public.crm_offer_instances(opportunity_id,contact_id,catalog_offer_id,created_by,operator,offer_name,base_price,total_price,snapshot,message_text,status,accepted_at,processed_at)
  values(opp_id,rec.id,null,uid,operator_name,'Venta directa',total,total,jsonb_build_object('operator',operator_name,'offer_name','Venta directa','recipient_contact_id',party->>'recipient_contact_id','recipient_name',party->>'recipient_name','recipient_phone',party->>'recipient_phone','contract_party',party,'direct_sale',true,'is_counteroffer',coalesce(p_counteroffer,false),'netflix_followup',operator_name='Vodafone' and coalesce(p_netflix_followup,false),'total_price',total,'send_message',p_send_message,'processing_date',today_madrid),message,'processed',now(),now()) returning * into inst;
  if coalesce(p_counteroffer,false) then
    insert into public.crm_labels(name) values('CONTRAOFERTA VODAFONE') on conflict(name) do update set name=excluded.name returning id into v_counter_label_id;
    insert into public.crm_contact_labels(contact_id,label_id) values(rec.id,v_counter_label_id) on conflict(contact_id,label_id) do nothing;
    insert into public.app_settings(key,value,updated_at) values('crm_label_categories_v1',jsonb_build_object(v_counter_label_id::text,'Contraofertas'),now())
    on conflict(key) do update set value=(case when jsonb_typeof(public.app_settings.value)='object' then public.app_settings.value else '{}'::jsonb end)||excluded.value,updated_at=now();
  end if;
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
end $function$
;
CREATE OR REPLACE FUNCTION public.crm_create_offer_execution_v11(p_contact_id uuid, p_catalog_offer_id uuid, p_request_key uuid, p_selections jsonb DEFAULT '[]'::jsonb, p_extra_text text DEFAULT NULL::text, p_mode text DEFAULT 'followup'::text, p_final_price numeric DEFAULT NULL::numeric, p_send_message boolean DEFAULT false, p_processing_date date DEFAULT NULL::date, p_test_mode boolean DEFAULT false, p_allow_duplicate boolean DEFAULT false, p_send_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_welcome boolean DEFAULT false, p_recipient_contact_id uuid DEFAULT NULL::uuid, p_manager_contact_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  result jsonb; party jsonb; previous text;
begin
  party:=crm_private.resolve_sale_party(p_contact_id,p_manager_contact_id,p_recipient_contact_id);
  previous:=current_setting('crm.sale_party',true);
  perform set_config('crm.sale_party',party::text,true);
  result:=public.crm_create_offer_execution_v9(
    p_contact_id,p_catalog_offer_id,p_request_key,p_selections,p_extra_text,p_mode,
    p_final_price,p_send_message,p_processing_date,p_test_mode,p_allow_duplicate,
    p_send_at,p_welcome,p_recipient_contact_id
  );

  perform set_config('crm.sale_party',coalesce(previous,''),true);
  -- Scheduled offers remain scheduled.  Only an offer intended for now asks
  -- the runner to start immediately; the durable pending job is its fallback.
  if coalesce(p_send_message,false)
     and (p_send_at is null or p_send_at <= now()) then
    perform crm_private.dispatch_runner_now();
  end if;

  return result;
end;
$function$
;
revoke all on function public.crm_create_direct_sale_v4(uuid,text,numeric,boolean,boolean,boolean,uuid,uuid) from public,anon;
grant execute on function public.crm_create_direct_sale_v4(uuid,text,numeric,boolean,boolean,boolean,uuid,uuid) to authenticated;
revoke all on function public.crm_create_offer_execution_v11(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean,timestamptz,boolean,uuid,uuid) from public,anon;
grant execute on function public.crm_create_offer_execution_v11(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean,timestamptz,boolean,uuid,uuid) to authenticated;
