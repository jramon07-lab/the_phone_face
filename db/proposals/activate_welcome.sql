-- SEPARATE ADMINISTRATOR ACTIVATION. Do not run during deployment or review.
-- Requires the main proposal to have been applied and a signed-in administrator.
-- No label is assigned to any customer here, so this queues no messages.
begin;
do $$ declare aid uuid;lid uuid;uid uuid:=auth.uid();begin
 if uid is null or not public.current_user_is_admin() then raise exception 'Se requiere una sesión de administrador';end if;
 if exists(select 1 from public.crm_welcome_settings where enabled or label_id is not null or automation_id is not null) then raise exception 'La bienvenida ya está configurada: revisar antes de cambiar';end if;
 if exists(select 1 from public.crm_labels where lower(name)='bienvenida') then raise exception 'Ya existe la etiqueta Bienvenida. Revisar sus automatizaciones antes de vincularla';end if;
 insert into public.crm_labels(name) values('Bienvenida') returning id into lid;
 insert into public.crm_automations(user_id,name,enabled,trigger_type,trigger_config,action_type,action_config)
 values(uid,'Bienvenida de cliente nuevo',true,'label_assigned',jsonb_build_object('label_id',lid),'__send_whatsapp','{}'::jsonb) returning id into aid;
 insert into public.crm_welcome_settings(id,enabled,label_id,automation_id) values(true,true,lid,aid) on conflict(id) do update set enabled=true,label_id=excluded.label_id,automation_id=excluded.automation_id;
end $$;
commit;
