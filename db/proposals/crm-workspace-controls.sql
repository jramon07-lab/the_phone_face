-- Additive controls. No existing customer rows are rewritten.
CREATE TABLE IF NOT EXISTS public.crm_change_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text NOT NULL, entity_id uuid NOT NULL,
 opportunity_id uuid, contact_ids uuid[] NOT NULL DEFAULT '{}', actor_id uuid, actor_name text NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now(), before_values jsonb, after_values jsonb NOT NULL,
 operation text NOT NULL
);
ALTER TABLE public.crm_change_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_change_history FROM anon,authenticated;
GRANT SELECT ON public.crm_change_history TO authenticated;
CREATE POLICY crm_change_history_read ON public.crm_change_history FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.user_permissions p WHERE p.user_id=auth.uid() AND
 (p.is_admin OR (entity_type='records' AND p.can_view_database) OR (entity_type='sales_opportunities' AND p.can_view_sales) OR (entity_type='crm_server_automation_jobs' AND actor_id=auth.uid())))
);
CREATE INDEX crm_change_history_entity ON public.crm_change_history(entity_type,entity_id,changed_at DESC);
CREATE INDEX crm_change_history_opportunity ON public.crm_change_history(opportunity_id,changed_at DESC);
CREATE INDEX crm_change_history_contacts ON public.crm_change_history USING gin(contact_ids);
CREATE OR REPLACE FUNCTION crm_private.capture_workspace_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b jsonb; a jsonb; keys text[]; ids uuid[]:='{}'; x text; actor text;
BEGIN
 IF TG_TABLE_NAME='records' THEN
  keys:=ARRAY['NOMBRE','APELLIDOS','NOMBRE Y APELLIDOS','APODO','DNI','DNI / NIF','TELÉFONO','TELEFONO','EMAIL','CORREO ELECTRÓNICO','BANCO','IBAN','BANCO / IBAN','OBSERVACIONES','NOTAS','TPF_RELACIONES'];
  a:=NEW.data;b:=CASE WHEN TG_OP='UPDATE' THEN OLD.data ELSE NULL END;ids:=ARRAY[NEW.id];
 ELSIF TG_TABLE_NAME='sales_opportunities' THEN
  keys:=ARRAY['title','amount','expected_date','installation_date','annual_review_date','stage_id','status','notes','record_id','contract_party','import_reference'];
  a:=to_jsonb(NEW);b:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
  ids:=array_remove(ARRAY[NEW.record_id],NULL);
  FOR x IN SELECT v FROM (SELECT value v FROM jsonb_each_text(coalesce(a->'contract_party','{}')) WHERE key IN ('holder_record_id','manager_record_id','recipient_contact_id') UNION SELECT value FROM jsonb_each_text(coalesce(b->'contract_party','{}')) WHERE key IN ('holder_record_id','manager_record_id','recipient_contact_id')) s LOOP
   IF x ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN ids:=array_append(ids,x::uuid);END IF;
  END LOOP;
 ELSE
  IF auth.uid() IS NULL THEN RETURN NEW;END IF;
  keys:=ARRAY['status','run_at','action_type','action_config'];a:=to_jsonb(NEW);b:=to_jsonb(OLD);
  x:=NEW.context->>'contact_id';IF x ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN ids:=ARRAY[x::uuid];END IF;
 END IF;
 SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO a FROM jsonb_each(a) WHERE key=ANY(keys);
 IF b IS NOT NULL THEN SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO b FROM jsonb_each(b) WHERE key=ANY(keys);END IF;
 IF a IS NOT DISTINCT FROM b THEN RETURN NEW;END IF;
 SELECT display_name INTO actor FROM public.user_permissions WHERE user_id=auth.uid();
 INSERT INTO public.crm_change_history(entity_type,entity_id,opportunity_id,contact_ids,actor_id,actor_name,before_values,after_values,operation)
 VALUES(TG_TABLE_NAME,NEW.id,CASE WHEN TG_TABLE_NAME='crm_server_automation_jobs' AND to_jsonb(NEW)#>>'{context,opportunity_id}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (to_jsonb(NEW)#>>'{context,opportunity_id}')::uuid ELSE NULL END,ids,auth.uid(),coalesce(nullif(actor,''),CASE WHEN auth.uid() IS NULL THEN 'Sistema' ELSE 'Usuario' END),b,a,TG_OP);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_private.capture_workspace_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER crm_workspace_record_history AFTER INSERT OR UPDATE OF data ON public.records FOR EACH ROW EXECUTE FUNCTION crm_private.capture_workspace_change();
CREATE TRIGGER crm_workspace_sale_history AFTER INSERT OR UPDATE ON public.sales_opportunities FOR EACH ROW EXECUTE FUNCTION crm_private.capture_workspace_change();
CREATE TRIGGER crm_workspace_job_history AFTER UPDATE OF action_config,run_at,status ON public.crm_server_automation_jobs FOR EACH ROW EXECUTE FUNCTION crm_private.capture_workspace_change();

CREATE OR REPLACE FUNCTION public.crm_link_import_manager(p_holder uuid,p_manager uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE h public.records; m public.records; items jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.current_user_is_admin() THEN RAISE EXCEPTION 'Solo administración puede vincular desde la importación';END IF;
 SELECT * INTO h FROM public.records WHERE id=p_holder AND source_sheet='BASE DE DATOS';IF NOT FOUND THEN RAISE EXCEPTION 'Titular no disponible';END IF;
 SELECT * INTO m FROM public.records WHERE id=p_manager AND source_sheet='BASE DE DATOS' FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Gestor no disponible';END IF;
 IF h.id=m.id THEN RETURN m.data;END IF;
 items:=coalesce(m.data#>'{TPF_RELACIONES,managed_contacts}','[]');
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(items) i WHERE i->>'record_id'=h.id::text) THEN
  items:=items||jsonb_build_array(jsonb_build_object('record_id',h.id,'name',coalesce(h.data->>'NOMBRE Y APELLIDOS',h.data->>'NOMBRE'),'dni',coalesce(h.data->>'DNI / NIF',h.data->>'DNI'),'phone',coalesce(h.data->>'TELÉFONO',h.data->>'TELEFONO')));
  UPDATE public.records SET data=jsonb_set(data,'{TPF_RELACIONES}',coalesce(data->'TPF_RELACIONES','{}')||jsonb_build_object('version',1,'managed_contacts',items)) WHERE id=m.id RETURNING data INTO m.data;
 END IF;
 RETURN m.data;
END $$;
REVOKE ALL ON FUNCTION public.crm_link_import_manager(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_link_import_manager(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_edit_pending_message(p_job_id uuid,p_expected_updated_at timestamptz,p_text text DEFAULT NULL,p_run_at timestamptz DEFAULT NULL,p_cancel boolean DEFAULT false) RETURNS public.crm_server_automation_jobs
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE j public.crm_server_automation_jobs; local_time timestamp;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión';END IF;
 SELECT * INTO j FROM public.crm_server_automation_jobs WHERE id=p_job_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Envío no disponible para este usuario';END IF;
 IF j.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'El envío cambió. Actualiza antes de editar';END IF;
 IF j.status NOT IN ('pending','failed') OR j.action_config ? '__delivery_receipt' OR j.action_config ? '__send_started' THEN RAISE EXCEPTION 'El envío está en curso o ya fue aceptado por WhatsApp';END IF;
 IF coalesce(j.error_message,'') ~* '(desconocido|ambigu|sin devolver.*identificador)' THEN RAISE EXCEPTION 'Confirma primero en WhatsApp el resultado del envío';END IF;
 IF j.action_type NOT IN ('__send_whatsapp','schedule_whatsapp','send_template') THEN RAISE EXCEPTION 'Este paso no es un mensaje editable';END IF;
 IF p_cancel THEN
  UPDATE public.crm_server_automation_jobs SET status='cancelled',updated_at=now(),error_message='Cancelado por el usuario',completed_at=now() WHERE id=j.id RETURNING * INTO j;
 ELSE
  IF j.status<>'pending' THEN RAISE EXCEPTION 'Corrige el fallo desde el detalle de la automatización';END IF;
  IF p_text IS NOT NULL AND (length(btrim(p_text))=0 OR length(p_text)>10000) THEN RAISE EXCEPTION 'Mensaje vacío o demasiado largo';END IF;
  IF p_run_at IS NOT NULL THEN
   IF p_run_at<=now()+interval '1 minute' THEN RAISE EXCEPTION 'Elige una fecha futura con al menos un minuto de margen';END IF;
   local_time:=p_run_at AT TIME ZONE 'Europe/Madrid';
   IF extract(isodow FROM local_time)=7 OR NOT (local_time::time BETWEEN time '10:00' AND time '13:59' OR (extract(isodow FROM local_time)<6 AND local_time::time BETWEEN time '17:30' AND time '20:29')) THEN RAISE EXCEPTION 'Horario: lunes a viernes 10-14 y 17:30-20:30; sábado 10-14, hora de Madrid';END IF;
  END IF;
  UPDATE public.crm_server_automation_jobs SET
   action_config=CASE WHEN p_text IS NULL THEN action_config ELSE action_config||jsonb_build_object('text',p_text,'workspace_edited',true) END,
   action_type=CASE WHEN p_text IS NULL THEN action_type ELSE '__send_whatsapp' END,
   run_at=coalesce(p_run_at,run_at),updated_at=now()
  WHERE id=j.id RETURNING * INTO j;
 END IF;
 RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.crm_edit_pending_message(uuid,timestamptz,text,timestamptz,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_edit_pending_message(uuid,timestamptz,text,timestamptz,boolean) TO authenticated;
