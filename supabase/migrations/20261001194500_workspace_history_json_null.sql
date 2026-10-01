-- Fix legacy opportunities whose SQL NULL serializes to JSON null.
-- Preserve the original payload in history; only skip non-object identity enumeration.
CREATE OR REPLACE FUNCTION crm_private.capture_workspace_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE b jsonb; a jsonb; keys text[]; ids uuid[]:='{}'; x text; actor text;
BEGIN
 IF TG_TABLE_NAME='records' THEN
  keys:=ARRAY['NOMBRE','APELLIDOS','NOMBRE Y APELLIDOS','APODO','DNI','DNI / NIF','TELÉFONO','TELEFONO','EMAIL','CORREO ELECTRÓNICO','BANCO','IBAN','BANCO / IBAN','OBSERVACIONES','NOTAS','TPF_RELACIONES'];
  a:=NEW.data;b:=CASE WHEN TG_OP='UPDATE' THEN OLD.data ELSE NULL END;ids:=ARRAY[NEW.id];
 ELSIF TG_TABLE_NAME='sales_opportunities' THEN
  keys:=ARRAY['title','amount','expected_date','installation_date','annual_review_date','stage_id','status','notes','record_id','contract_party','import_reference'];
  a:=to_jsonb(NEW);b:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
  ids:=array_remove(ARRAY[NEW.record_id],NULL);
  FOR x IN SELECT v FROM (SELECT value v FROM jsonb_each_text(CASE WHEN jsonb_typeof(a->'contract_party')='object' THEN a->'contract_party' ELSE '{}'::jsonb END) WHERE key IN ('holder_record_id','manager_record_id','recipient_contact_id') UNION SELECT value FROM jsonb_each_text(CASE WHEN jsonb_typeof(b->'contract_party')='object' THEN b->'contract_party' ELSE '{}'::jsonb END) WHERE key IN ('holder_record_id','manager_record_id','recipient_contact_id')) s LOOP
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
END $function$
;

