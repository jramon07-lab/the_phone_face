-- Catálogo de oferta flexible: componentes internos, texto comercial y contraofertas.
alter table public.crm_offer_catalog add column if not exists base_features jsonb not null default '[]'::jsonb;
alter table public.crm_offer_catalog add column if not exists is_counteroffer boolean not null default false;
alter table public.crm_offer_line_options add column if not exists option_type text not null default 'quantity';
alter table public.crm_offer_line_options add column if not exists group_name text;
alter table public.crm_offer_line_options add column if not exists message_text text;
alter table public.crm_offer_line_options add column if not exists replaces_text text;
alter table public.crm_offer_line_options add column if not exists default_selected boolean not null default false;
alter table public.crm_offer_line_options drop constraint if exists crm_offer_line_options_option_type_check;
alter table public.crm_offer_line_options add constraint crm_offer_line_options_option_type_check check(option_type in ('quantity','checkbox','radio'));
create index if not exists crm_offer_instances_catalog_offer_idx on public.crm_offer_instances(catalog_offer_id);
create index if not exists opportunity_month_labels_contact_idx on crm_private.opportunity_month_labels(contact_id);

create or replace function public.crm_save_offer_catalog(p_offer jsonb)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare oid uuid:=nullif(p_offer->>'id','')::uuid;item jsonb;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'Solo un administrador puede modificar el catálogo';end if;
  if btrim(coalesce(p_offer->>'operator',''))='' or btrim(coalesce(p_offer->>'name',''))='' then raise exception 'Indica operador y nombre interno';end if;
  if oid is null then
    insert into public.crm_offer_catalog(operator,name,fiber_mbps,included_unlimited_lines,base_price,intro_text,active,position,created_by,base_features,is_counteroffer)
    values(btrim(p_offer->>'operator'),btrim(p_offer->>'name'),nullif(p_offer->>'fiber_mbps','')::integer,greatest(0,coalesce((p_offer->>'included_unlimited_lines')::smallint,0)),greatest(0,coalesce((p_offer->>'base_price')::numeric,0)),nullif(btrim(p_offer->>'intro_text'),''),coalesce((p_offer->>'active')::boolean,true),coalesce((p_offer->>'position')::integer,0),auth.uid(),coalesce(p_offer->'base_features','[]'::jsonb),coalesce((p_offer->>'is_counteroffer')::boolean,false)) returning id into oid;
  else
    update public.crm_offer_catalog set operator=btrim(p_offer->>'operator'),name=btrim(p_offer->>'name'),fiber_mbps=nullif(p_offer->>'fiber_mbps','')::integer,included_unlimited_lines=greatest(0,coalesce((p_offer->>'included_unlimited_lines')::smallint,0)),base_price=greatest(0,coalesce((p_offer->>'base_price')::numeric,0)),intro_text=nullif(btrim(p_offer->>'intro_text'),''),active=coalesce((p_offer->>'active')::boolean,true),position=coalesce((p_offer->>'position')::integer,0),base_features=coalesce(p_offer->'base_features','[]'::jsonb),is_counteroffer=coalesce((p_offer->>'is_counteroffer')::boolean,false) where id=oid;
    if not found then raise exception 'Oferta no encontrada';end if;
    delete from public.crm_offer_line_options where offer_id=oid;
  end if;
  for item in select value from jsonb_array_elements(coalesce(p_offer->'line_options','[]'::jsonb)) loop
    if btrim(coalesce(item->>'name',''))<>'' then
      insert into public.crm_offer_line_options(offer_id,name,data_gb,price_delta,active,position,option_type,group_name,message_text,replaces_text,default_selected)
      values(oid,btrim(item->>'name'),nullif(item->>'data_gb','')::integer,coalesce((item->>'price_delta')::numeric,0),coalesce((item->>'active')::boolean,true),coalesce((item->>'position')::integer,0),coalesce(nullif(item->>'option_type',''),'quantity'),nullif(btrim(item->>'group_name'),''),nullif(btrim(item->>'message_text'),''),nullif(btrim(item->>'replaces_text'),''),coalesce((item->>'default_selected')::boolean,false));
    end if;
  end loop;
  return oid;
end $$;
revoke all on function public.crm_save_offer_catalog(jsonb) from public,anon;
grant execute on function public.crm_save_offer_catalog(jsonb) to authenticated;

create or replace function crm_private.offer_add_label(p_contact uuid,p_name text,p_category text)
returns void language plpgsql security definer set search_path='' as $$
declare lid uuid;
begin
  insert into public.crm_labels(name) values(p_name) on conflict(name) do update set name=excluded.name returning id into lid;
  insert into public.app_settings(key,value,updated_at) values('crm_label_categories_v1',jsonb_build_object(lid::text,p_category),now()) on conflict(key) do update set value=(case when jsonb_typeof(public.app_settings.value)='object' then public.app_settings.value else '{}'::jsonb end)||excluded.value,updated_at=now();
  insert into public.crm_contact_labels(contact_id,label_id) values(p_contact,lid) on conflict(contact_id,label_id) do nothing;
end $$;
revoke all on function crm_private.offer_add_label(uuid,text,text) from public,anon,authenticated;

create or replace function crm_private.offer_record_month(p_contact uuid,p_opportunity uuid,p_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare lid uuid;label_name text;
begin
  label_name:=crm_private.month_label_name('OFERTA',p_at);
  perform crm_private.offer_add_label(p_contact,label_name,'Ofertas');
  select id into lid from public.crm_labels where name=label_name;
  insert into crm_private.opportunity_month_labels(opportunity_id,contact_id,offer_label_id,offered_at)
  values(p_opportunity,p_contact,lid,p_at)
  on conflict(opportunity_id) do update set offer_label_id=excluded.offer_label_id,offered_at=excluded.offered_at;
end $$;
revoke all on function crm_private.offer_record_month(uuid,uuid,timestamptz) from public,anon,authenticated;

create or replace function public.crm_create_offer_execution_v2(p_contact_id uuid,p_catalog_offer_id uuid,p_selections jsonb default '[]'::jsonb,p_extra_text text default null,p_mode text default 'followup',p_final_price numeric default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();rec public.records%rowtype;offer public.crm_offer_catalog%rowtype;opt public.crm_offer_line_options%rowtype;item jsonb;feature jsonb;qty integer;computed numeric:=0;total numeric;chosen jsonb:='[]'::jsonb;features jsonb;message text;nm text;first_name text;phone text;opp_stage public.sales_stages%rowtype;pending_stage public.sales_stages%rowtype;processed_stage public.sales_stages%rowtype;opp_id uuid;instance_id uuid;rule public.crm_automations%rowtype;flow jsonb;ctx jsonb;event_key text;
begin
  if uid is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para crear ofertas';end if;
  if p_mode not in ('followup','accepted') then raise exception 'Modo de oferta no válido';end if;
  select * into rec from public.records where id=p_contact_id;if not found then raise exception 'Contacto no encontrado';end if;
  select * into offer from public.crm_offer_catalog where id=p_catalog_offer_id and active;if not found then raise exception 'Oferta no disponible';end if;
  computed:=offer.base_price;features:=coalesce(offer.base_features,'[]'::jsonb);
  for item in select value from jsonb_array_elements(coalesce(p_selections,'[]'::jsonb)) loop
    qty:=greatest(0,least(20,coalesce((item->>'quantity')::integer,0)));if qty=0 then continue;end if;
    select * into opt from public.crm_offer_line_options where id=nullif(item->>'option_id','')::uuid and offer_id=offer.id and active;if not found then raise exception 'Una opción ya no está disponible';end if;
    if opt.option_type in ('checkbox','radio') then qty:=1;end if;
    if opt.option_type='radio' and opt.group_name is not null and exists(select 1 from jsonb_array_elements(chosen) c where c->>'group_name'=opt.group_name) then raise exception 'Elige solo una opción de cada grupo';end if;
    computed:=computed+(opt.price_delta*qty);
    if opt.replaces_text is not null then select coalesce(jsonb_agg(x),'[]'::jsonb) into features from jsonb_array_elements(features) x where trim(both '"' from x::text)<>opt.replaces_text;end if;
    features:=features||jsonb_build_array(coalesce(opt.message_text,opt.name)||case when opt.option_type='quantity' and qty>1 then ' × '||qty else '' end);
    chosen:=chosen||jsonb_build_array(jsonb_build_object('option_id',opt.id,'name',opt.name,'option_type',opt.option_type,'group_name',opt.group_name,'unit_price',opt.price_delta,'quantity',qty,'subtotal',opt.price_delta*qty));
  end loop;
  total:=coalesce(p_final_price,computed);if total<0 then raise exception 'El precio final no puede ser negativo';end if;
  nm:=coalesce(nullif(btrim(rec.data->>'NOMBRE Y APELLIDOS'),''),nullif(btrim(concat_ws(' ',rec.data->>'NOMBRE',rec.data->>'APELLIDOS')),''),'Cliente');first_name:=split_part(nm,' ',1);phone:=public.crm_server_normalize_phone(coalesce(rec.data->>'TELÉFONO',rec.data->>'TELEFONO',rec.data->>'PHONE',rec.data->>'MOVIL',''));
  if p_mode='followup' and (phone is null or length(phone)<8) then raise exception 'El contacto no tiene un teléfono válido';end if;
  message:='Hola '||first_name||', te envío la oferta que hemos comentado:';
  for feature in select value from jsonb_array_elements(features) loop message:=message||E'\n• '||trim(both '"' from feature::text);end loop;
  message:=message||E'\nPrecio final: '||to_char(total,'FM999999990D00')||' €/mes';if btrim(coalesce(p_extra_text,''))<>'' then message:=message||E'\n\n'||btrim(p_extra_text);end if;
  select * into pending_stage from public.sales_stages where active and lower(btrim(name))='pendiente de tramitar' order by position limit 1;select * into processed_stage from public.sales_stages where active and lower(btrim(name))='tramitado' order by position limit 1;
  if p_mode='accepted' then opp_stage:=pending_stage;else select * into opp_stage from public.sales_stages where active and lower(btrim(name)) in ('seguimiento','oferta pasada') order by case when lower(btrim(name))='seguimiento' then 0 else 1 end,position limit 1;end if;
  if opp_stage.id is null then raise exception 'Falta la columna de ventas para esta oferta';end if;if p_mode='followup' and (pending_stage.id is null or processed_stage.id is null) then raise exception 'Faltan las columnas Pendiente de tramitar o Tramitado';end if;
  insert into public.sales_opportunities(pipeline_id,stage_id,record_id,title,client_name,phone,amount,expected_date,owner_user_id,status,notes) values(opp_stage.pipeline_id,opp_stage.id,rec.id,offer.operator||' · '||offer.name,nm,phone,total,(now() at time zone 'Europe/Madrid')::date,uid,'open','Oferta creada desde el configurador') returning id into opp_id;
  insert into public.crm_offer_instances(opportunity_id,contact_id,catalog_offer_id,created_by,operator,offer_name,base_price,total_price,snapshot,message_text,extra_text,status,accepted_at) values(opp_id,rec.id,offer.id,uid,offer.operator,offer.name,offer.base_price,total,jsonb_build_object('operator',offer.operator,'offer_name',offer.name,'base_features',offer.base_features,'selections',chosen,'computed_price',computed,'total_price',total,'is_counteroffer',offer.is_counteroffer),message,nullif(btrim(coalesce(p_extra_text,'')),''),case when p_mode='accepted' then 'accepted' else 'queued' end,case when p_mode='accepted' then now() end) returning id into instance_id;
  if offer.is_counteroffer then perform crm_private.offer_add_label(rec.id,'CONTRAOFERTA '||upper(offer.operator),'Contraofertas');end if;
  if p_mode='accepted' then perform crm_private.offer_record_month(rec.id,opp_id,now());end if;
  if p_mode='followup' then
    perform pg_advisory_xact_lock(hashtextextended(uid::text,9417));select * into rule from public.crm_automations where user_id=uid and trigger_type='manual_offer' order by created_at limit 1;
    if not found then insert into public.crm_automations(user_id,name,enabled,trigger_type,trigger_config,action_type,action_config) values(uid,'OFERTAS · Seguimiento general',true,'manual_offer',jsonb_build_object('automation_operator','General','automation_category','Seguimiento'),'flow_v1',jsonb_build_object('version',1,'steps',jsonb_build_array())) returning * into rule;elsif not rule.enabled then raise exception 'La automatización general de ofertas está pausada';end if;
    flow:=jsonb_build_object('version',1,'lifecycle',jsonb_build_object('mode','offer','version',1,'stop_stage_ids',jsonb_build_array(pending_stage.id::text,processed_stage.id::text)),'steps',jsonb_build_array(jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text','{oferta_mensaje}','offer_phase','initial')),jsonb_build_object('kind','action','action_type','record_offer_month','config',jsonb_build_object()),jsonb_build_object('kind','wait','unit','days','value',2),jsonb_build_object('kind','condition','condition_type','no_response'),jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text','Hola {nombre}, ¿has podido revisar la oferta de {operador} por {precio_total} €/mes? Si tienes alguna duda, te ayudo por aquí.','offer_phase','reminder_2')),jsonb_build_object('kind','wait','unit','days','value',3),jsonb_build_object('kind','condition','condition_type','no_response'),jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text','Hola {nombre}, te escribo por última vez sobre la oferta de {operador}. Si quieres que la revisemos o la dejemos pendiente, dímelo por aquí.','offer_phase','reminder_5'))));rule.action_config:=flow;
    ctx:=public.crm_server_context_for_contact(rec.id,phone)||jsonb_build_object('opportunity_id',opp_id,'offer_instance_id',instance_id,'operator',offer.operator,'precio_total',to_char(total,'FM999999990D00'),'oferta_mensaje',message,'trigger_type','manual_offer','event_at',now());event_key:='manual-offer:'||instance_id;perform public.crm_server_enqueue(rule,event_key,ctx);
  end if;
  return jsonb_build_object('offer_id',instance_id,'opportunity_id',opp_id,'status',case when p_mode='accepted' then 'accepted' else 'queued' end,'message',message,'computed_price',computed,'total_price',total);
end $$;
revoke all on function public.crm_create_offer_execution_v2(uuid,uuid,jsonb,text,text,numeric) from public,anon;
grant execute on function public.crm_create_offer_execution_v2(uuid,uuid,jsonb,text,text,numeric) to authenticated;

-- Conserva la tarifa introducida y la convierte en la estándar acordada.
do $$declare standard_id uuid;counter_id uuid;begin
  select id into standard_id from public.crm_offer_catalog where operator='Vodafone' order by created_at limit 1;
  if standard_id is null then insert into public.crm_offer_catalog(operator,name,base_price,base_features,active) values('Vodafone','VDF · ESTÁNDAR 600 + 2×160',52,'["Fibra 600 Mb","2 líneas principales de 160 GB","TV con más de 80 canales","Amazon incluido"]',true) returning id into standard_id;
  else update public.crm_offer_catalog set name='VDF · ESTÁNDAR 600 + 2×160',fiber_mbps=600,included_unlimited_lines=0,base_price=52,base_features='["Fibra 600 Mb","2 líneas principales de 160 GB","TV con más de 80 canales","Amazon incluido"]',is_counteroffer=false where id=standard_id;delete from public.crm_offer_line_options where offer_id=standard_id;end if;
  insert into public.crm_offer_line_options(offer_id,name,price_delta,position,option_type,group_name,message_text,replaces_text) values
    (standard_id,'Fibra 1 Gb',10,10,'radio','fibra','Fibra 1 Gb','Fibra 600 Mb'),
    (standard_id,'Líneas principales ilimitadas',4,20,'radio','lineas_principales','2 líneas principales ilimitadas','2 líneas principales de 160 GB'),
    (standard_id,'Netflix en lugar de Amazon',4,30,'radio','contenido','Netflix incluido','Amazon incluido'),
    (standard_id,'Línea adicional 160 GB',6,40,'quantity',null,'Línea adicional de 160 GB',null);
  select id into counter_id from public.crm_offer_catalog where operator='Vodafone' and is_counteroffer order by created_at limit 1;
  if counter_id is null then insert into public.crm_offer_catalog(operator,name,base_price,base_features,is_counteroffer,active,position) values('Vodafone','VDF · CONTRAOFERTA 1 GB + 2 ILIMITADAS',25,'["Fibra 1 Gb","2 líneas principales ilimitadas"]',true,true,10) returning id into counter_id;else update public.crm_offer_catalog set name='VDF · CONTRAOFERTA 1 GB + 2 ILIMITADAS',base_price=25,base_features='["Fibra 1 Gb","2 líneas principales ilimitadas"]',is_counteroffer=true,active=true,position=10 where id=counter_id;delete from public.crm_offer_line_options where offer_id=counter_id;end if;
  insert into public.crm_offer_line_options(offer_id,name,data_gb,price_delta,position,option_type,group_name,message_text) values
    (counter_id,'TV con más de 80 canales',null,0,10,'checkbox',null,'TV con más de 80 canales'),
    (counter_id,'Amazon',null,2,20,'radio','contenido','Amazon incluido'),
    (counter_id,'Netflix',null,4,30,'radio','contenido','Netflix incluido'),
    (counter_id,'Línea adicional 30 GB',30,6,40,'quantity',null,'Línea adicional de 30 GB'),
    (counter_id,'Línea adicional 60 GB',60,8.5,50,'quantity',null,'Línea adicional de 60 GB'),
    (counter_id,'Línea adicional 160 GB',160,11,60,'quantity',null,'Línea adicional de 160 GB'),
    (counter_id,'Línea adicional ilimitada',null,16,70,'quantity',null,'Línea adicional ilimitada');
end $$;
notify pgrst,'reload schema';
