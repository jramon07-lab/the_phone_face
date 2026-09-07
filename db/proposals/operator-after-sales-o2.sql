-- Posventa completa de O2. No crea ejecuciones retroactivas: solo configura futuras entradas en Tramitado.
do $$
declare
 uid uuid;tramitado_id uuid;proximo_id uuid;day_template_id bigint;security_template_id bigint;
 day_rule_id uuid;security_rule_id uuid;review_rule_id uuid;
 day_body text:=E'Hola {nombre} 👋\n\nCuando te instalen la fibra, avísanos. Si tienes algún problema, llámanos.\n\n📦 Las instrucciones para devolver el router anterior pueden tardar hasta 15 días.';
 security_body text:=E'Hola {nombre} 👋 ¿Qué tal va todo con O2?\n\n⚠️ Ten cuidado con llamadas que anuncien subidas de precio o amenacen con cortar tus líneas. No facilites datos y consúltanos antes.';
begin
 select id into tramitado_id from public.sales_stages where active and lower(btrim(name))='tramitado' order by position limit 1;
 select id into proximo_id from public.sales_stages where active and lower(regexp_replace(btrim(name),'[^a-zA-Z]','','g'))='proximo' order by position limit 1;
 if tramitado_id is null or proximo_id is null then raise exception 'Faltan las columnas Tramitado o Próximo';end if;

 for uid in select distinct user_id from public.crm_automations where lower(coalesce(trigger_config->>'automation_operator',''))='o2' loop
   select id into day_template_id from public.wa_templates where user_id=uid and lower(btrim(name))='o2 · instalación y devolución de router' order by created_at limit 1;
   if day_template_id is null then
     insert into public.wa_templates(user_id,name,body,category,shortcut) values(uid,'O2 · Instalación y devolución de router',day_body,'O2',null) returning id into day_template_id;
   else update public.wa_templates set body=day_body,category='O2',updated_at=now() where id=day_template_id;end if;

   select id into security_template_id from public.wa_templates where user_id=uid and lower(btrim(name))='o2 · seguimiento de seguridad a los 3 meses' order by created_at limit 1;
   if security_template_id is null then
     insert into public.wa_templates(user_id,name,body,category,shortcut) values(uid,'O2 · Seguimiento de seguridad a los 3 meses',security_body,'O2',null) returning id into security_template_id;
   else update public.wa_templates set body=security_body,category='O2',updated_at=now() where id=security_template_id;end if;

   select id into day_rule_id from public.crm_automations where user_id=uid and (trigger_config->>'automation_code'='o2_day_one' or (lower(name)='tramitación · o2' and trigger_config->>'automation_code' is null)) order by (trigger_config->>'automation_code'='o2_day_one') desc,created_at limit 1;
   if day_rule_id is null then
     insert into public.crm_automations(user_id,name,enabled,trigger_type,trigger_config,action_type,action_config) values(uid,'TRAMITACIÓN · O2',true,'opportunity_stage',jsonb_build_object('stage_id',tramitado_id,'automation_operator','O2','automation_category','Tramitación','automation_code','o2_day_one'),'flow_v1',jsonb_build_object('version',1,'lifecycle',jsonb_build_object('mode','after_sale','version',1),'steps',jsonb_build_array(jsonb_build_object('kind','action','action_type','record_sale_month','config',jsonb_build_object()),jsonb_build_object('kind','wait','unit','days','value',1,'business_schedule','phone_house'),jsonb_build_object('kind','action','action_type','send_template','config',jsonb_build_object('template_id',day_template_id::text))))) returning id into day_rule_id;
   else update public.crm_automations set name='TRAMITACIÓN · O2',enabled=true,trigger_type='opportunity_stage',trigger_config=jsonb_build_object('stage_id',tramitado_id,'automation_operator','O2','automation_category','Tramitación','automation_code','o2_day_one'),action_type='flow_v1',action_config=jsonb_build_object('version',1,'lifecycle',jsonb_build_object('mode','after_sale','version',1),'steps',jsonb_build_array(jsonb_build_object('kind','action','action_type','record_sale_month','config',jsonb_build_object()),jsonb_build_object('kind','wait','unit','days','value',1,'business_schedule','phone_house'),jsonb_build_object('kind','action','action_type','send_template','config',jsonb_build_object('template_id',day_template_id::text)))),updated_at=now() where id=day_rule_id;end if;

   select id into security_rule_id from public.crm_automations where user_id=uid and trigger_config->>'automation_code'='o2_security_3_months' limit 1;
   if security_rule_id is null then
     insert into public.crm_automations(user_id,name,enabled,trigger_type,trigger_config,action_type,action_config) values(uid,'POSVENTA · O2 · 3 meses',true,'opportunity_stage',jsonb_build_object('stage_id',tramitado_id,'automation_operator','O2','automation_category','Posventa','automation_code','o2_security_3_months'),'flow_v1',jsonb_build_object('version',1,'lifecycle',jsonb_build_object('mode','after_sale','version',1),'steps',jsonb_build_array(jsonb_build_object('kind','action','action_type','record_sale_month','config',jsonb_build_object()),jsonb_build_object('kind','wait','unit','months','value',3,'business_schedule','phone_house'),jsonb_build_object('kind','action','action_type','send_template','config',jsonb_build_object('template_id',security_template_id::text))))) returning id into security_rule_id;
   else update public.crm_automations set name='POSVENTA · O2 · 3 meses',enabled=true,trigger_type='opportunity_stage',trigger_config=jsonb_build_object('stage_id',tramitado_id,'automation_operator','O2','automation_category','Posventa','automation_code','o2_security_3_months'),action_type='flow_v1',action_config=jsonb_build_object('version',1,'lifecycle',jsonb_build_object('mode','after_sale','version',1),'steps',jsonb_build_array(jsonb_build_object('kind','action','action_type','record_sale_month','config',jsonb_build_object()),jsonb_build_object('kind','wait','unit','months','value',3,'business_schedule','phone_house'),jsonb_build_object('kind','action','action_type','send_template','config',jsonb_build_object('template_id',security_template_id::text)))),updated_at=now() where id=security_rule_id;end if;

   select id into review_rule_id from public.crm_automations where user_id=uid and trigger_config->>'automation_code'='o2_annual_review' limit 1;
   if review_rule_id is null then
     insert into public.crm_automations(user_id,name,enabled,trigger_type,trigger_config,action_type,action_config) values(uid,'RENOVACIÓN · O2 · 11 meses',true,'opportunity_stage',jsonb_build_object('stage_id',tramitado_id,'automation_operator','O2','automation_category','Renovaciones','automation_code','o2_annual_review'),'flow_v1',jsonb_build_object('version',1,'lifecycle',jsonb_build_object('mode','after_sale','version',1),'steps',jsonb_build_array(jsonb_build_object('kind','action','action_type','record_sale_month','config',jsonb_build_object()),jsonb_build_object('kind','action','action_type','set_review_date','config',jsonb_build_object('value',1,'unit','years')),jsonb_build_object('kind','wait','unit','months','value',11,'business_schedule','phone_house'),jsonb_build_object('kind','action','action_type','prepare_operator_review','config',jsonb_build_object('stage_id',proximo_id,'title','REVISIÓN O2'))))) returning id into review_rule_id;
   else update public.crm_automations set name='RENOVACIÓN · O2 · 11 meses',enabled=true,trigger_type='opportunity_stage',trigger_config=jsonb_build_object('stage_id',tramitado_id,'automation_operator','O2','automation_category','Renovaciones','automation_code','o2_annual_review'),action_type='flow_v1',action_config=jsonb_build_object('version',1,'lifecycle',jsonb_build_object('mode','after_sale','version',1),'steps',jsonb_build_array(jsonb_build_object('kind','action','action_type','record_sale_month','config',jsonb_build_object()),jsonb_build_object('kind','action','action_type','set_review_date','config',jsonb_build_object('value',1,'unit','years')),jsonb_build_object('kind','wait','unit','months','value',11,'business_schedule','phone_house'),jsonb_build_object('kind','action','action_type','prepare_operator_review','config',jsonb_build_object('stage_id',proximo_id,'title','REVISIÓN O2')))),updated_at=now() where id=review_rule_id;end if;
 end loop;
end $$;

notify pgrst,'reload schema';
