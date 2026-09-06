-- Orden estable del mensaje, aceptación con fecha y envío opcional.
create or replace function public.crm_create_offer_execution_v3(
  p_contact_id uuid,
  p_catalog_offer_id uuid,
  p_selections jsonb default '[]'::jsonb,
  p_extra_text text default null,
  p_mode text default 'followup',
  p_final_price numeric default null,
  p_send_message boolean default false,
  p_processing_date date default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();rec public.records%rowtype;offer public.crm_offer_catalog%rowtype;opt public.crm_offer_line_options%rowtype;inst public.crm_offer_instances%rowtype;
  item jsonb;feature jsonb;qty integer;copy_no integer;show_message boolean;replace_index integer;computed numeric:=0;total numeric;chosen jsonb:='[]'::jsonb;features jsonb;message text;
  nm text;first_name text;phone text;today_madrid date:=(now() at time zone 'Europe/Madrid')::date;process_date date;
  opp_stage public.sales_stages%rowtype;pending_stage public.sales_stages%rowtype;processed_stage public.sales_stages%rowtype;opp_id uuid;instance_id uuid;
  rule public.crm_automations%rowtype;flow jsonb;ctx jsonb;event_key text;result_status text;
begin
  if uid is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para crear ofertas';end if;
  if p_mode not in ('followup','accepted') then raise exception 'Modo de oferta no válido';end if;
  select * into rec from public.records where id=p_contact_id;if not found then raise exception 'Contacto no encontrado';end if;
  select * into offer from public.crm_offer_catalog where id=p_catalog_offer_id and active;if not found then raise exception 'Oferta no disponible';end if;
  computed:=offer.base_price;features:=coalesce(offer.base_features,'[]'::jsonb);
  for item in
    select selected.value from jsonb_array_elements(coalesce(p_selections,'[]'::jsonb)) selected(value)
    join public.crm_offer_line_options ordering on ordering.id=nullif(selected.value->>'option_id','')::uuid and ordering.offer_id=offer.id
    order by ordering.position,ordering.name
  loop
    qty:=greatest(0,least(20,coalesce((item->>'quantity')::integer,0)));if qty=0 then continue;end if;
    show_message:=coalesce((item->>'show_in_message')::boolean,true);
    select * into opt from public.crm_offer_line_options where id=nullif(item->>'option_id','')::uuid and offer_id=offer.id and active;if not found then raise exception 'Una opción ya no está disponible';end if;
    if opt.option_type in ('checkbox','radio') then qty:=1;end if;
    if opt.option_type='radio' and opt.group_name is not null and exists(select 1 from jsonb_array_elements(chosen) c where c->>'group_name'=opt.group_name) then raise exception 'Elige solo una opción de cada grupo';end if;
    computed:=computed+(opt.price_delta*qty);replace_index:=null;
    if opt.replaces_text is not null then
      select (ordinality-1)::integer into replace_index from jsonb_array_elements_text(features) with ordinality f(value,ordinality) where f.value=opt.replaces_text limit 1;
    end if;
    if replace_index is not null then
      if show_message then features:=jsonb_set(features,array[replace_index::text],to_jsonb(coalesce(opt.message_text,opt.name)),false);else features:=features-replace_index;end if;
    elsif show_message then
      for copy_no in 1..case when opt.option_type='quantity' then qty else 1 end loop features:=features||jsonb_build_array(coalesce(opt.message_text,opt.name));end loop;
    end if;
    chosen:=chosen||jsonb_build_array(jsonb_build_object('option_id',opt.id,'name',opt.name,'option_type',opt.option_type,'group_name',opt.group_name,'unit_price',opt.price_delta,'quantity',qty,'subtotal',opt.price_delta*qty,'show_in_message',show_message));
  end loop;
  total:=coalesce(p_final_price,computed);if total<0 then raise exception 'El precio final no puede ser negativo';end if;
  nm:=coalesce(nullif(btrim(rec.data->>'NOMBRE Y APELLIDOS'),''),nullif(btrim(concat_ws(' ',rec.data->>'NOMBRE',rec.data->>'APELLIDOS')),''),'Cliente');
  first_name:=split_part(nm,' ',1);phone:=public.crm_server_normalize_phone(coalesce(rec.data->>'TELÉFONO',rec.data->>'TELEFONO',rec.data->>'PHONE',rec.data->>'MOVIL',''));
  if (p_mode='followup' or p_send_message) and (phone is null or length(phone)<8) then raise exception 'El contacto no tiene un teléfono válido';end if;
  message:='Hola '||first_name||', te envío la oferta que hemos comentado:';
  for feature in select value from jsonb_array_elements(features) loop message:=message||E'\n• '||trim(both '"' from feature::text);end loop;
  message:=message||E'\nPrecio final: '||to_char(total,'FM999999990D00')||' €/mes';if btrim(coalesce(p_extra_text,''))<>'' then message:=message||E'\n\n'||btrim(p_extra_text);end if;
  select * into pending_stage from public.sales_stages where active and lower(btrim(name))='pendiente de tramitar' order by position limit 1;
  select * into processed_stage from public.sales_stages where active and lower(btrim(name))='tramitado' order by position limit 1;
  process_date:=case when p_mode='accepted' then coalesce(p_processing_date,today_madrid) else today_madrid end;
  if process_date<today_madrid then raise exception 'La fecha de tramitación no puede ser anterior a hoy';end if;
  if p_mode='accepted' then
    if process_date=today_madrid then opp_stage:=processed_stage;result_status:='processed';else opp_stage:=pending_stage;result_status:='accepted';end if;
  else
    select * into opp_stage from public.sales_stages where active and lower(btrim(name)) in ('seguimiento','oferta pasada') order by case when lower(btrim(name))='seguimiento' then 0 else 1 end,position limit 1;result_status:='queued';
  end if;
  if opp_stage.id is null then raise exception 'Falta la columna de ventas para esta oferta';end if;
  if pending_stage.id is null or processed_stage.id is null then raise exception 'Faltan las columnas Pendiente de tramitar o Tramitado';end if;
  insert into public.sales_opportunities(pipeline_id,stage_id,record_id,title,client_name,phone,amount,expected_date,owner_user_id,status,notes)
  values(opp_stage.pipeline_id,opp_stage.id,rec.id,'CAMBIO '||upper(offer.operator),nm,phone,total,process_date,uid,'open','Oferta creada desde el configurador') returning id into opp_id;
  insert into public.crm_offer_instances(opportunity_id,contact_id,catalog_offer_id,created_by,operator,offer_name,base_price,total_price,snapshot,message_text,extra_text,status,accepted_at,processed_at)
  values(opp_id,rec.id,offer.id,uid,offer.operator,offer.name,offer.base_price,total,jsonb_build_object('operator',offer.operator,'offer_name',offer.name,'base_features',offer.base_features,'selections',chosen,'computed_price',computed,'total_price',total,'is_counteroffer',offer.is_counteroffer,'send_message',p_mode='followup' or p_send_message,'processing_date',process_date),message,nullif(btrim(coalesce(p_extra_text,'')),''),result_status,case when p_mode='accepted' then now() end,case when result_status='processed' then now() end) returning id into instance_id;
  if offer.is_counteroffer then perform crm_private.offer_add_label(rec.id,'CONTRAOFERTA '||upper(offer.operator),'Contraofertas');end if;
  if p_mode='accepted' then
    perform crm_private.offer_record_month(rec.id,opp_id,now());
    if result_status='processed' then select * into inst from public.crm_offer_instances where id=instance_id;perform crm_private.offer_record_sale(inst,now());end if;
  end if;
  if p_mode='followup' or p_send_message then
    perform pg_advisory_xact_lock(hashtextextended(uid::text,9417));select * into rule from public.crm_automations where user_id=uid and trigger_type='manual_offer' order by created_at limit 1;
    if not found then insert into public.crm_automations(user_id,name,enabled,trigger_type,trigger_config,action_type,action_config) values(uid,'OFERTAS · Seguimiento general',true,'manual_offer',jsonb_build_object('automation_operator','General','automation_category','Seguimiento'),'flow_v1',jsonb_build_object('version',1,'steps',jsonb_build_array())) returning * into rule;elsif p_mode='followup' and not rule.enabled then raise exception 'La automatización general de ofertas está pausada';end if;
    if p_mode='followup' then
      flow:=jsonb_build_object('version',1,'lifecycle',jsonb_build_object('mode','offer','version',1,'stop_stage_ids',jsonb_build_array(pending_stage.id::text,processed_stage.id::text)),'steps',jsonb_build_array(jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text','{oferta_mensaje}','offer_phase','initial')),jsonb_build_object('kind','action','action_type','record_offer_month','config',jsonb_build_object()),jsonb_build_object('kind','wait','unit','days','value',2),jsonb_build_object('kind','condition','condition_type','no_response'),jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text','Hola {nombre}, ¿has podido revisar la oferta de {operador} por {precio_total} €/mes? Si tienes alguna duda, te ayudo por aquí.','offer_phase','reminder_2')),jsonb_build_object('kind','wait','unit','days','value',3),jsonb_build_object('kind','condition','condition_type','no_response'),jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text','Hola {nombre}, te escribo por última vez sobre la oferta de {operador}. Si quieres que la revisemos o la dejemos pendiente, dímelo por aquí.','offer_phase','reminder_5'))));event_key:='manual-offer:'||instance_id;
    else
      flow:=jsonb_build_object('version',1,'steps',jsonb_build_array(jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text','{oferta_mensaje}','offer_phase','accepted'))));event_key:='manual-offer-accepted:'||instance_id;
    end if;
    rule.action_config:=flow;ctx:=public.crm_server_context_for_contact(rec.id,phone)||jsonb_build_object('opportunity_id',opp_id,'offer_instance_id',instance_id,'operator',offer.operator,'precio_total',to_char(total,'FM999999990D00'),'oferta_mensaje',message,'trigger_type','manual_offer','event_at',now());perform public.crm_server_enqueue(rule,event_key,ctx);
  end if;
  return jsonb_build_object('offer_id',instance_id,'opportunity_id',opp_id,'status',result_status,'stage',opp_stage.name,'message',message,'message_requested',p_mode='followup' or p_send_message,'processing_date',process_date,'computed_price',computed,'total_price',total);
end $$;
revoke all on function public.crm_create_offer_execution_v3(uuid,uuid,jsonb,text,text,numeric,boolean,date) from public,anon;
grant execute on function public.crm_create_offer_execution_v3(uuid,uuid,jsonb,text,text,numeric,boolean,date) to authenticated;

-- Textos comerciales más limpios; los nombres internos siguen sin enviarse.
do $$declare standard_id uuid;counter_id uuid;begin
  select id into standard_id from public.crm_offer_catalog where operator='Vodafone' and not is_counteroffer order by created_at limit 1;
  select id into counter_id from public.crm_offer_catalog where operator='Vodafone' and is_counteroffer order by created_at limit 1;
  if standard_id is null or counter_id is null then raise exception 'Faltan las dos tarifas Vodafone';end if;
  update public.crm_offer_catalog set name='VDF · ESTÁNDAR 600',base_features='["Fibra 600 Mb","160 GB"]' where id=standard_id;
  update public.crm_offer_catalog set base_features='["Fibra 1 Gb","Datos ilimitados"]' where id=counter_id;
  update public.crm_offer_line_options set name='Datos ilimitados',message_text='Datos ilimitados',replaces_text='160 GB' where offer_id=standard_id and group_name='lineas_principales';
  update public.crm_offer_line_options set message_text=case when data_gb is null then 'Datos ilimitados' else data_gb||' GB' end where offer_id in (standard_id,counter_id) and option_type='quantity';
end $$;
notify pgrst,'reload schema';
