-- Vodafone: carpetas operativas, posventa a 3 meses y revisión anual.
-- No crea ejecuciones retroactivas: solo configura reglas para futuras entradas en Tramitado.

create or replace function crm_private.lifecycle_validate_rule()
returns trigger language plpgsql security definer set search_path='' as $$
declare p jsonb:=new.action_config->'lifecycle';s jsonb;previous text:='';has_opp boolean:=false;has_month boolean:=false;has_send boolean:=false;sid text;annual_review boolean:=false;
begin
 annual_review:=coalesce(new.trigger_config->>'automation_code','')='vodafone_annual_review';
 if coalesce(p->>'mode','') not in ('offer','after_sale') or not new.enabled then return new;end if;
 if new.action_type<>'flow_v1' then raise exception 'Estas protecciones requieren un flujo';end if;
 if p->>'mode'='offer' then
   if new.trigger_type<>'label_assigned' or not exists(select 1 from public.crm_labels where id::text=new.trigger_config->>'label_id') then raise exception 'Elige una etiqueta de seguimiento válida';end if;
   if jsonb_typeof(p->'stop_stage_ids') is distinct from 'array' then raise exception 'Elige Pendiente de tramitar y Tramitado';end if;
   if jsonb_array_length(p->'stop_stage_ids')<>2 or p#>>'{stop_stage_ids,0}'=p#>>'{stop_stage_ids,1}' then raise exception 'Elige dos columnas distintas';end if;
   for sid in select jsonb_array_elements_text(p->'stop_stage_ids') loop if not exists(select 1 from public.sales_stages where id::text=sid and active) then raise exception 'Columna de parada no válida';end if;end loop;
 else
   if new.trigger_type<>'opportunity_stage' or not exists(select 1 from public.sales_stages where id::text=new.trigger_config->>'stage_id' and active) then raise exception 'Elige la columna Tramitado';end if;has_opp:=true;
 end if;
 if jsonb_typeof(new.action_config->'steps') is distinct from 'array' then raise exception 'Añade los pasos';end if;
 for s in select value from jsonb_array_elements(new.action_config->'steps') loop
   if s->>'kind'='action' then
     if s->>'action_type'='create_opportunity' then
       if has_opp then raise exception 'El flujo ya tiene una oportunidad vinculada';end if;
       if not exists(select 1 from public.sales_stages where id::text=s#>>'{config,stage_id}' and active) then raise exception 'Elige la columna inicial de la oportunidad';end if;
       if coalesce(p->'stop_stage_ids','[]'::jsonb)?(s#>>'{config,stage_id}') then raise exception 'La oferta debe comenzar antes de tramitación';end if;has_opp:=true;
     elsif s->>'action_type' in ('send_template','send_whatsapp_now') then
       if not has_opp then raise exception 'Vincula la oportunidad antes de enviar';end if;
       if s->>'action_type'='send_template' and not exists(select 1 from public.wa_templates where id::text=s#>>'{config,template_id}' and user_id=new.user_id) then raise exception 'Elige una plantilla propia en cada envío';end if;
       if s->>'action_type'='send_whatsapp_now' and btrim(coalesce(s#>>'{config,text}',''))='' then raise exception 'Escribe el mensaje';end if;has_send:=true;
     elsif s->>'action_type'='record_offer_month' then
       if p->>'mode'<>'offer' or previous not in ('send_template','send_whatsapp_now') or not has_opp or has_month then raise exception 'Registra OFERTA una vez, justo después de enviar la oferta';end if;has_month:=true;
     elsif s->>'action_type'='record_sale_month' then
       if p->>'mode'<>'after_sale' or previous<>'' or has_month then raise exception 'Registra VENTAS al principio de Tramitado';end if;has_month:=true;
     elsif s->>'action_type' in ('set_review_date','prepare_operator_review') then
       if not annual_review or p->>'mode'<>'after_sale' then raise exception 'Acción de revisión no compatible';end if;
       if s->>'action_type'='prepare_operator_review' and not exists(select 1 from public.sales_stages where id::text=s#>>'{config,stage_id}' and active) then raise exception 'Elige la columna Próximo';end if;
     elsif s->>'action_type' not in ('create_task','assign_label','move_opportunity') then raise exception 'Acción no compatible';end if;
     previous:=s->>'action_type';
   elsif s->>'kind'='wait' then
     if coalesce(s->>'unit','') not in ('minutes','hours','days','weeks','months','years') or coalesce((s->>'value')::numeric,-1)<0 then raise exception 'Configura las esperas';end if;
     if p->>'mode'='after_sale' and not has_month then raise exception 'Registra VENTAS antes de esperar';end if;
   elsif s->>'kind'='repeat' then
     if previous not in ('send_template','send_whatsapp_now') then raise exception 'Repite solo los mensajes, no la creación de oportunidades ni las etiquetas mensuales';end if;
     if coalesce((s->>'times')::int,0) not between 1 and 100 or coalesce((s->>'every_value')::numeric,0)<=0 or coalesce(s->>'every_unit','') not in ('minutes','hours','days','weeks') then raise exception 'Configura la repetición';end if;
   elsif s->>'kind'='condition' then if s->>'condition_type'<>'no_response' then raise exception 'Condición no compatible';end if;
   else raise exception 'Paso no compatible';end if;
 end loop;
 if not has_month or (not annual_review and not has_send) then raise exception 'Añade el registro mensual y al menos una plantilla o mensaje';end if;
 return new;
end $$;
revoke all on function crm_private.lifecycle_validate_rule() from public,anon,authenticated;

do $$
declare base_rule public.crm_automations%rowtype;tramitado_id uuid;proximo_id uuid;template_id bigint;posventa_id uuid;review_id uuid;
begin
 select id into tramitado_id from public.sales_stages where active and lower(btrim(name))='tramitado' order by position limit 1;
 select id into proximo_id from public.sales_stages where active and lower(regexp_replace(btrim(name),'[^a-zA-Z]','','g'))='proximo' order by position limit 1;
 if tramitado_id is null or proximo_id is null then raise exception 'Faltan las columnas Tramitado o Próximo';end if;

 for base_rule in select * from public.crm_automations where trigger_type='opportunity_stage' and lower(coalesce(trigger_config->>'automation_operator',''))='vodafone' order by created_at loop
   select id into template_id from public.wa_templates where user_id=base_rule.user_id and lower(btrim(name))='seguimiento de seguridad a los 3 meses' order by created_at limit 1;
   if template_id is null then
     insert into public.wa_templates(user_id,name,body,category,shortcut) values(base_rule.user_id,'Seguimiento de seguridad a los 3 meses',$body$Hola {nombre} 👋 ¿Qué tal va todo con Vodafone?

⚠️ Ten cuidado con llamadas que anuncien subidas de precio o amenacen con cortar tus líneas. No facilites datos y consúltanos antes.

📱 Si te llaman ofreciendo un terminal gratis o financiado, consúltanos antes. Pueden aplicarte permanencias elevadas de 24 o 36 meses y después no respetar el precio que te ofrecieron.$body$,'Vodafone',null) returning id into template_id;
   else
     update public.wa_templates set body=$body$Hola {nombre} 👋 ¿Qué tal va todo con Vodafone?

⚠️ Ten cuidado con llamadas que anuncien subidas de precio o amenacen con cortar tus líneas. No facilites datos y consúltanos antes.

📱 Si te llaman ofreciendo un terminal gratis o financiado, consúltanos antes. Pueden aplicarte permanencias elevadas de 24 o 36 meses y después no respetar el precio que te ofrecieron.$body$,category='Vodafone',updated_at=now() where id=template_id;
   end if;

   select id into posventa_id from public.crm_automations where user_id=base_rule.user_id and trigger_config->>'automation_code'='vodafone_security_3_months' limit 1;
   if posventa_id is null then
     insert into public.crm_automations(user_id,name,enabled,trigger_type,trigger_config,action_type,action_config)
     values(base_rule.user_id,'POSVENTA · Vodafone · 3 meses',true,'opportunity_stage',jsonb_build_object('stage_id',tramitado_id,'automation_operator','Vodafone','automation_category','Posventa','automation_code','vodafone_security_3_months'),'flow_v1',jsonb_build_object('version',1,'lifecycle',jsonb_build_object('mode','after_sale','version',1),'steps',jsonb_build_array(jsonb_build_object('kind','action','action_type','record_sale_month','config',jsonb_build_object()),jsonb_build_object('kind','wait','unit','months','value',3,'business_schedule','phone_house'),jsonb_build_object('kind','action','action_type','send_template','config',jsonb_build_object('template_id',template_id::text))))) returning id into posventa_id;
   else
     update public.crm_automations set name='POSVENTA · Vodafone · 3 meses',enabled=true,trigger_type='opportunity_stage',trigger_config=jsonb_build_object('stage_id',tramitado_id,'automation_operator','Vodafone','automation_category','Posventa','automation_code','vodafone_security_3_months'),action_type='flow_v1',action_config=jsonb_build_object('version',1,'lifecycle',jsonb_build_object('mode','after_sale','version',1),'steps',jsonb_build_array(jsonb_build_object('kind','action','action_type','record_sale_month','config',jsonb_build_object()),jsonb_build_object('kind','wait','unit','months','value',3,'business_schedule','phone_house'),jsonb_build_object('kind','action','action_type','send_template','config',jsonb_build_object('template_id',template_id::text)))),updated_at=now() where id=posventa_id;
   end if;

   select id into review_id from public.crm_automations where user_id=base_rule.user_id and trigger_config->>'automation_code'='vodafone_annual_review' limit 1;
   if review_id is null then
     insert into public.crm_automations(user_id,name,enabled,trigger_type,trigger_config,action_type,action_config)
     values(base_rule.user_id,'RENOVACIÓN · Vodafone · 11 meses',true,'opportunity_stage',jsonb_build_object('stage_id',tramitado_id,'automation_operator','Vodafone','automation_category','Renovaciones','automation_code','vodafone_annual_review'),'flow_v1',jsonb_build_object('version',1,'lifecycle',jsonb_build_object('mode','after_sale','version',1),'steps',jsonb_build_array(jsonb_build_object('kind','action','action_type','record_sale_month','config',jsonb_build_object()),jsonb_build_object('kind','action','action_type','set_review_date','config',jsonb_build_object('value',1,'unit','years')),jsonb_build_object('kind','wait','unit','months','value',11,'business_schedule','phone_house'),jsonb_build_object('kind','action','action_type','prepare_operator_review','config',jsonb_build_object('stage_id',proximo_id,'title','REVISIÓN VODAFONE'))))) returning id into review_id;
   else
     update public.crm_automations set name='RENOVACIÓN · Vodafone · 11 meses',enabled=true,trigger_type='opportunity_stage',trigger_config=jsonb_build_object('stage_id',tramitado_id,'automation_operator','Vodafone','automation_category','Renovaciones','automation_code','vodafone_annual_review'),action_type='flow_v1',action_config=jsonb_build_object('version',1,'lifecycle',jsonb_build_object('mode','after_sale','version',1),'steps',jsonb_build_array(jsonb_build_object('kind','action','action_type','record_sale_month','config',jsonb_build_object()),jsonb_build_object('kind','action','action_type','set_review_date','config',jsonb_build_object('value',1,'unit','years')),jsonb_build_object('kind','wait','unit','months','value',11,'business_schedule','phone_house'),jsonb_build_object('kind','action','action_type','prepare_operator_review','config',jsonb_build_object('stage_id',proximo_id,'title','REVISIÓN VODAFONE')))),updated_at=now() where id=review_id;
   end if;
 end loop;

 update public.crm_automations set trigger_config=trigger_config||jsonb_build_object('automation_operator','Vodafone','automation_category','Ofertas'),updated_at=now() where lower(name)='oferta vodafone';
 update public.crm_automations set trigger_config=trigger_config||jsonb_build_object('automation_operator','Vodafone','automation_category','Tramitación'),updated_at=now() where lower(name)='cambio vodafone';
end $$;

notify pgrst,'reload schema';
