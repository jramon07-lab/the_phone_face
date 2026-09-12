-- Existing stable indexes copied only to the isolated test project.
CREATE INDEX agenda_items_created_by_idx ON public.agenda_items USING btree (created_by);
CREATE INDEX agenda_items_related_record_id_idx ON public.agenda_items USING btree (related_record_id);
CREATE INDEX agenda_items_whatsapp_delivery_idx ON public.agenda_items USING btree (whatsapp_delivery_status, whatsapp_scheduled_at) WHERE (whatsapp_enabled = true);
