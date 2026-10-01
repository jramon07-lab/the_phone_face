-- Read-only incident fields for administrators; no queue writes or provider metadata.
GRANT SELECT (record_id,status,last_error,attempts,updated_at) ON public.crm_contact_sync_queue TO authenticated;
CREATE POLICY crm_workspace_sync_incidents_admin_read ON public.crm_contact_sync_queue
FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.user_permissions p WHERE p.user_id=auth.uid() AND p.is_admin)
);