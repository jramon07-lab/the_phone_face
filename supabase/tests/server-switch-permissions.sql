-- No changes persist. Existing server-switch values are never changed.
begin;
select set_config('audit.switch_denied',(select user_id::text from public.user_permissions where not is_admin and not can_manage_automations limit 1),true);
select set_config('audit.switch_admin',(select user_id::text from public.user_permissions where is_admin limit 1),true);
do $audit$ begin
 if coalesce(current_setting('audit.switch_denied'),'')='' or coalesce(current_setting('audit.switch_admin'),'')='' then raise exception 'Missing role fixtures'; end if;
 if (select count(*) from public.app_settings where key in ('crm_server_automations_enabled','crm_server_scheduled_whatsapp_enabled'))<>2 then raise exception 'Missing server switches'; end if;
end $audit$;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('audit.switch_denied'),'role','authenticated')::text,true);
do $audit$ declare changed integer; blocked boolean; target text; begin
 if (select count(*) from public.app_settings where key in ('crm_server_automations_enabled','crm_server_scheduled_whatsapp_enabled'))<>2 then raise exception 'Shared switch reads broken'; end if;
 update public.app_settings set value=value where key in ('crm_server_automations_enabled','crm_server_scheduled_whatsapp_enabled');
 get diagnostics changed=row_count; if changed<>0 then raise exception 'Limited role can modify global server switches'; end if;
 foreach target in array array['crm_server_automations_enabled','crm_server_scheduled_whatsapp_enabled'] loop
  blocked:=false;
  begin insert into public.app_settings(key,value) values(target,'true') on conflict(key) do update set value=excluded.value; exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Limited role can upsert a server switch'; end if;
 end loop;
 insert into public.app_settings(key,value) values('AUDIT SERVER SWITCH GUARD ROLLBACK','true');
 update public.app_settings set value='false' where key='AUDIT SERVER SWITCH GUARD ROLLBACK';
 get diagnostics changed=row_count; if changed<>1 then raise exception 'Unrelated shared settings broken'; end if;
 blocked:=false;
 begin update public.app_settings set key='crm_server_automations_enabled' where key='AUDIT SERVER SWITCH GUARD ROLLBACK'; exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Renaming can bypass server-switch guard'; end if;
end $audit$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('audit.switch_admin'),'role','authenticated')::text,true);
do $audit$ declare changed integer; begin
 update public.app_settings set value=value where key in ('crm_server_automations_enabled','crm_server_scheduled_whatsapp_enabled');
 get diagnostics changed=row_count; if changed<>2 then raise exception 'Administrator cannot manage server switches'; end if;
end $audit$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $audit$ begin
 if exists(select 1 from public.app_settings where key in ('crm_server_automations_enabled','crm_server_scheduled_whatsapp_enabled')) then raise exception 'Anonymous switch access'; end if;
end $audit$;
reset role;
rollback;
