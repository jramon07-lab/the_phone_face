create or replace function public.crm_direct_sale_day_one_preview(p_contact_id uuid,p_manager_contact_id uuid,p_recipient_contact_id uuid,p_operator text,p_netflix_followup boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare party jsonb;r public.crm_automations%rowtype;tpl text;body text;n integer;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para crear ventas';end if;
 party:=crm_private.resolve_sale_party(p_contact_id,p_manager_contact_id,p_recipient_contact_id);
 select count(*) into n from public.crm_automations where enabled and trigger_type='opportunity_stage' and trigger_config->>'automation_code' like '%_day_one' and lower(trigger_config->>'automation_operator')=lower(p_operator);
 if n=0 then return jsonb_build_object('available',false);end if;
 if n<>1 then raise exception 'Hay varias reglas del día siguiente: revisa la configuración';end if;
 select * into r from public.crm_automations where enabled and trigger_type='opportunity_stage' and trigger_config->>'automation_code' like '%_day_one' and lower(trigger_config->>'automation_operator')=lower(p_operator);
 tpl:=case when r.trigger_config ? 'netflix_template_id' then case when p_netflix_followup then r.trigger_config->>'netflix_template_id' else r.trigger_config->>'general_template_id' end else r.action_config#>>'{steps,2,config,template_id}' end;
 select t.body into body from public.wa_templates t where t.id::text=tpl and t.user_id=r.user_id;
 if body is null then raise exception 'No se encuentra la plantilla del día siguiente';end if;
 body:=replace(body,'{nombre}',party->>'recipient_first_name');
 return jsonb_build_object('available',true,'text',body,'rule_id',r.id,'recipient',party->>'recipient_name','phone',party->>'recipient_phone');
end $$;
revoke all on function public.crm_direct_sale_day_one_preview(uuid,uuid,uuid,text,boolean) from public,anon;
grant execute on function public.crm_direct_sale_day_one_preview(uuid,uuid,uuid,text,boolean) to authenticated;
CREATE OR REPLACE FUNCTION public.crm_create_direct_sale_v5(p_contact_id uuid, p_operator text, p_total_price numeric, p_send_message boolean, p_netflix_followup boolean, p_counteroffer boolean, p_manager_contact_id uuid, p_recipient_contact_id uuid, p_day_one_text text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid:=auth.uid();rec public.records%rowtype;processed_stage public.sales_stages%rowtype;
  inst public.crm_offer_instances%rowtype;rule public.crm_automations%rowtype;
  nm text;first_name text;phone text;operator_name text;message text;opp_id uuid;instance_id uuid;
  preview jsonb;party jsonb;v_counter_label_id uuid;total numeric;flow jsonb;ctx jsonb;today_madrid date:=(now() at time zone 'Europe/Madrid')::date;
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
  preview:=public.crm_direct_sale_day_one_preview(p_contact_id,p_manager_contact_id,p_recipient_contact_id,operator_name,p_netflix_followup);
  if p_day_one_text is not null and (length(btrim(p_day_one_text))=0 or length(p_day_one_text)>10000) then raise exception 'El mensaje debe tener entre 1 y 10000 caracteres';end if;
  if p_day_one_text is not null and not coalesce((preview->>'available')::boolean,false) then raise exception 'No hay mensaje del día siguiente configurado para este operador';end if;
  first_name:=party->>'recipient_first_name';phone:=public.crm_server_normalize_phone(party->>'recipient_phone');
  if p_send_message and (phone is null or length(phone)<8) then raise exception 'El contacto no tiene un teléfono válido';end if;
  message:='Hola '||first_name||', te envío lo que hemos comentado:'||E'\n• Operador: '||operator_name||E'\nPrecio final: '||to_char(total,'FM999999990D00')||' €/mes';
  insert into public.sales_opportunities(pipeline_id,stage_id,record_id,title,client_name,phone,amount,expected_date,owner_user_id,status,notes,contract_party)
  values(processed_stage.pipeline_id,processed_stage.id,rec.id,'CAMBIO '||upper(operator_name),nm,phone,total,today_madrid,uid,'open','Venta directa creada desde el CRM',party) returning id into opp_id;
  insert into public.crm_offer_instances(opportunity_id,contact_id,catalog_offer_id,created_by,operator,offer_name,base_price,total_price,snapshot,message_text,status,accepted_at,processed_at)
  values(opp_id,rec.id,null,uid,operator_name,'Venta directa',total,total,jsonb_build_object('operator',operator_name,'offer_name','Venta directa','recipient_contact_id',party->>'recipient_contact_id','recipient_name',party->>'recipient_name','recipient_phone',party->>'recipient_phone','contract_party',party,'day_one_text',coalesce(p_day_one_text,preview->>'text'),'day_one_rule_id',preview->>'rule_id','direct_sale',true,'is_counteroffer',coalesce(p_counteroffer,false),'netflix_followup',operator_name='Vodafone' and coalesce(p_netflix_followup,false),'total_price',total,'send_message',p_send_message,'processing_date',today_madrid),message,'processed',now(),now()) returning * into inst;
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
create or replace function crm_private.enqueue_opportunity_stage(p_opportunity_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare
  opp public.sales_opportunities%rowtype;inst public.crm_offer_instances%rowtype;r public.crm_automations%rowtype;
  ctx jsonb;wanted text;required_flag text;made integer:=0;netflix_followup boolean:=false;variant_template text;
begin
  if not public.crm_server_automations_enabled() then return 0;end if;
  select * into opp from public.sales_opportunities where id=p_opportunity_id;if not found then return 0;end if;
  select * into inst from public.crm_offer_instances where opportunity_id=opp.id order by created_at desc limit 1;
  if found then netflix_followup:=crm_private.offer_netflix_visible(inst.snapshot);end if;
  ctx:=public.crm_server_context_for_contact(opp.record_id,opp.phone)||jsonb_build_object(
    'opportunity_id',opp.id,'stage_id',opp.stage_id,'name',coalesce(opp.client_name,''),
    'phone',public.crm_server_normalize_phone(opp.phone),'operator',coalesce(inst.operator,''),
    'offer_instance_id',inst.id,'netflix_followup',netflix_followup,'event_at',now()
  );
  for r in select * from public.crm_automations where enabled and trigger_type='opportunity_stage' and coalesce(trigger_config->>'stage_id','')=coalesce(opp.stage_id::text,'') loop
    wanted:=coalesce(nullif(btrim(r.trigger_config->>'automation_operator'),''),nullif(btrim(r.trigger_config->>'operator'),''),'General');
    required_flag:=nullif(btrim(r.trigger_config->>'required_offer_flag'),'');
    if (wanted='General' or lower(wanted)=lower(coalesce(inst.operator,'')))
       and (required_flag is null or lower(coalesce(ctx->>required_flag,'false'))='true') then
      if r.trigger_config ? 'netflix_template_id' and r.trigger_config ? 'general_template_id' then
        variant_template:=case when netflix_followup then r.trigger_config->>'netflix_template_id' else r.trigger_config->>'general_template_id' end;
        r.action_config:=jsonb_set(r.action_config,'{steps,2,config,template_id}',to_jsonb(variant_template),true);
      end if;
      if inst.snapshot->>'direct_sale'='true' and inst.snapshot->>'day_one_rule_id'=r.id::text and nullif(inst.snapshot->>'day_one_text','') is not null then
        r.action_config:=jsonb_set(r.action_config,'{steps,2}',jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text',inst.snapshot->>'day_one_text')),false);
      end if;
      perform public.crm_server_enqueue(r,'oppstage:'||opp.id::text||':'||coalesce(opp.stage_id::text,''),ctx);made:=made+1;
    end if;
  end loop;
  return made;
end $$;
revoke all on function crm_private.enqueue_opportunity_stage(uuid) from public,anon,authenticated;


revoke all on function public.crm_create_direct_sale_v5(uuid,text,numeric,boolean,boolean,boolean,uuid,uuid,text) from public,anon;
grant execute on function public.crm_create_direct_sale_v5(uuid,text,numeric,boolean,boolean,boolean,uuid,uuid,text) to authenticated;
