-- The two global server switches control all customers' scheduled work.
-- Client code reads them; only administrators may change these switches.
-- Keep unrelated shared settings and service-role workers unchanged.
create policy app_settings_server_switch_insert on public.app_settings
 as restrictive for insert to authenticated
 with check (key not in ('crm_server_automations_enabled','crm_server_scheduled_whatsapp_enabled') or public.current_user_is_admin());
create policy app_settings_server_switch_update on public.app_settings
 as restrictive for update to authenticated
 using (key not in ('crm_server_automations_enabled','crm_server_scheduled_whatsapp_enabled') or public.current_user_is_admin())
 with check (key not in ('crm_server_automations_enabled','crm_server_scheduled_whatsapp_enabled') or public.current_user_is_admin());
create policy app_settings_server_switch_delete on public.app_settings
 as restrictive for delete to authenticated
 using (key not in ('crm_server_automations_enabled','crm_server_scheduled_whatsapp_enabled') or public.current_user_is_admin());
