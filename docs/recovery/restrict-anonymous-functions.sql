-- Preparado para revisión/aplicación controlada en la base compartida.
-- No cambia cuerpos, propietarios, datos ni permisos de usuarios autenticados.
-- Ejecutar en una transacción y verificar has_function_privilege antes/después.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.crm_cancel_automation_execution(uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.crm_cancel_automation_pending(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.crm_exclude_contact_from_automation(uuid,uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.crm_include_contact_in_automation(uuid,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.crm_retry_automation_step(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_cancel_automation_execution(uuid,text), public.crm_cancel_automation_pending(uuid), public.crm_exclude_contact_from_automation(uuid,uuid,text), public.crm_include_contact_in_automation(uuid,uuid), public.crm_retry_automation_step(uuid) TO authenticated, service_role;
-- Función de trigger; no necesita llamada directa desde clientes.
REVOKE EXECUTE ON FUNCTION public.crm_prepare_dynamic_label_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_prepare_dynamic_label_job() TO service_role;
COMMIT;
