-- Installed-sales reconciliation. Existing forecasts and WhatsApp dates are preserved.
BEGIN;
ALTER TABLE public.sales_opportunities ADD COLUMN IF NOT EXISTS installation_date date;
ALTER TABLE public.sales_opportunities ADD COLUMN IF NOT EXISTS installation_operator text;
ALTER TABLE public.sales_opportunities ADD COLUMN IF NOT EXISTS import_reference text;
ALTER TABLE public.sales_opportunities ADD COLUMN IF NOT EXISTS installation_recorded_at timestamptz;
ALTER TABLE public.sales_opportunities ADD COLUMN IF NOT EXISTS annual_review_date date;
CREATE UNIQUE INDEX IF NOT EXISTS sales_installed_reference_unique ON public.sales_opportunities(import_reference) WHERE import_reference IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.crm_sales_import_rows(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 source_key text NOT NULL UNIQUE,
 source_file text NOT NULL,
 sale_month date NOT NULL,
 payload jsonb NOT NULL,
 opportunity_id uuid REFERENCES public.sales_opportunities(id) ON DELETE SET NULL,
 imported_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_sales_import_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY installed_import_admin_read ON public.crm_sales_import_rows FOR SELECT TO authenticated USING(public.current_user_is_admin());
CREATE POLICY installed_import_admin_insert ON public.crm_sales_import_rows FOR INSERT TO authenticated WITH CHECK(public.current_user_is_admin() AND user_id=(select auth.uid()) AND opportunity_id IS NULL AND imported_at IS NULL);
CREATE POLICY installed_import_admin_update ON public.crm_sales_import_rows FOR UPDATE TO authenticated USING(public.current_user_is_admin()) WITH CHECK(public.current_user_is_admin());
GRANT SELECT,INSERT,UPDATE ON public.crm_sales_import_rows TO authenticated;
REVOKE ALL ON public.crm_sales_import_rows FROM anon;

CREATE OR REPLACE FUNCTION crm_private.schedule_installed_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.crm_automations%rowtype; j public.crm_server_automation_jobs%rowtype;
 cfg jsonb;ctx jsonb;due date;at_time timestamptz;action text;existing_count integer;phone text;
BEGIN
 IF new.installation_date IS NULL OR new.import_reference IS NULL THEN RETURN new;END IF;
 IF tg_op='UPDATE' AND new.installation_date IS NOT DISTINCT FROM old.installation_date AND new.installation_operator IS NOT DISTINCT FROM old.installation_operator THEN RETURN new;END IF;
 IF auth.uid() IS NULL OR NOT public.current_user_is_admin() THEN RAISE EXCEPTION 'Solo administración puede confirmar una instalación importada';END IF;
 ctx:=public.crm_server_context_for_contact(new.record_id,new.phone)||jsonb_build_object('opportunity_id',new.id,'operator',new.installation_operator,'event_at',new.installation_date::text||'T10:00:00','installation_date',new.installation_date,'import_reference',new.import_reference);
 phone:=public.crm_server_normalize_phone(ctx->>'phone');
 FOR a IN SELECT * FROM public.crm_automations WHERE user_id=auth.uid() AND enabled AND lower(trigger_config->>'automation_operator')=lower(new.installation_operator)
 AND (trigger_config->>'automation_code' LIKE '%_security_3_months' OR trigger_config->>'automation_code' LIKE '%_annual_review') LOOP
   IF EXISTS(SELECT 1 FROM public.crm_server_automation_jobs WHERE automation_id=a.id AND context->>'opportunity_id'=new.id::text AND status IN ('pending','running') AND action_type='flow_v1') THEN RAISE EXCEPTION 'Automatización en curso; espera a que termine antes de importar esta venta';END IF;
   action:=CASE WHEN a.trigger_config->>'automation_code' LIKE '%_annual_review' THEN 'prepare_operator_review' ELSE 'send_template' END;
   SELECT value->'config' INTO cfg FROM jsonb_array_elements(a.action_config->'steps') WHERE value->>'action_type'=action LIMIT 1;
   IF cfg IS NULL THEN CONTINUE;END IF;
   due:=(new.installation_date+CASE WHEN action='prepare_operator_review' THEN interval '11 months' ELSE interval '3 months' END)::date;
   IF extract(isodow FROM due)=7 THEN due:=due+1;END IF;
   at_time:=(due+time '10:00') AT TIME ZONE 'Europe/Madrid';
   SELECT count(*) INTO existing_count FROM public.crm_server_automation_jobs WHERE automation_id=a.id AND context->>'opportunity_id'=new.id::text AND action_type=action;
   IF existing_count>0 THEN
     -- Rebase only the annual move; keep all existing WhatsApp sends/dates untouched.
     IF action='prepare_operator_review' THEN
       IF EXISTS(SELECT 1 FROM public.crm_server_automation_jobs WHERE automation_id=a.id AND context->>'opportunity_id'=new.id::text AND action_type=action AND status='running') THEN RAISE EXCEPTION 'Revisión en curso; vuelve a intentarlo';END IF;
       UPDATE public.crm_server_automation_jobs SET run_at=greatest(at_time,now()+interval '1 minute'),context=context||jsonb_build_object('installation_date',new.installation_date),updated_at=now()
       WHERE automation_id=a.id AND context->>'opportunity_id'=new.id::text AND action_type=action AND status='pending';
     END IF;
     CONTINUE;
   END IF;
   -- Never backfill an overdue customer message, or invent a phone from the Excel.
   IF action='send_template' AND (at_time<=now() OR phone !~ '^(34)?[6789][0-9]{8}$') THEN CONTINUE;END IF;
   INSERT INTO public.crm_server_automation_jobs(automation_id,user_id,event_key,action_type,action_config,context,run_at)
   VALUES(a.id,a.user_id,'installed:'||new.id::text||':'||action,action,cfg||jsonb_build_object('business_schedule','phone_house'),ctx||jsonb_build_object('lifecycle',jsonb_build_object('mode','after_sale','version',1,'stage_id',a.trigger_config->>'stage_id')),greatest(at_time,now()+interval '1 minute'))
   ON CONFLICT(automation_id,event_key) DO NOTHING;
 END LOOP;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION crm_private.schedule_installed_sale() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER crm_schedule_installed_sale AFTER INSERT OR UPDATE OF installation_date,installation_operator ON public.sales_opportunities FOR EACH ROW EXECUTE FUNCTION crm_private.schedule_installed_sale();

CREATE OR REPLACE FUNCTION public.crm_import_installed_sale(p_row_id uuid,p_contact_id uuid,p_opportunity_id uuid DEFAULT NULL,p_amount numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.crm_sales_import_rows%rowtype;c public.records%rowtype;o public.sales_opportunities%rowtype;g public.sales_stages%rowtype;
 installed date;dni text;op text;title text;key text;oid uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.current_user_is_admin() THEN RAISE EXCEPTION 'Solo administración puede importar ventas';END IF;
 SELECT * INTO r FROM public.crm_sales_import_rows WHERE id=p_row_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Fila de importación no disponible';END IF;
 IF r.opportunity_id IS NOT NULL THEN RETURN jsonb_build_object('id',r.opportunity_id,'already_imported',true);END IF;
 installed:=nullif(r.payload->>'activation_date','')::date;
 IF installed IS NULL OR installed>current_date OR installed<date '2000-01-01' THEN RAISE EXCEPTION 'Fecha de activación obligatoria y válida';END IF;
 dni:=upper(regexp_replace(coalesce(r.payload->>'dni',''),'[^A-Za-z0-9]','','g'));
 op:=btrim(coalesce(r.payload->>'operator',''));
 IF dni='' OR op='' OR btrim(coalesce(r.payload->>'orderline',''))='' THEN RAISE EXCEPTION 'Faltan DNI, operador o referencia OrderLine';END IF;
 IF upper(coalesce(r.payload->>'cancelled','')) IN ('SI','SÍ','YES') THEN RAISE EXCEPTION 'La venta está cancelada';END IF;
 IF p_amount IS NOT NULL AND (p_amount<0 OR p_amount>1000000 OR p_amount::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Importe no válido';END IF;
 SELECT * INTO c FROM public.records WHERE id=p_contact_id AND source_sheet='BASE DE DATOS';
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM unnest(ARRAY[c.data->>'DNI',c.data->>'DNI / NIF',c.data#>>'{TPF_TITULAR,holder_dni}']) d WHERE upper(regexp_replace(coalesce(d,''),'[^A-Za-z0-9]','','g'))=dni) THEN RAISE EXCEPTION 'El DNI no coincide con el cliente o su titular';END IF;
 key:=r.source_key;
 IF key<>coalesce(nullif(r.payload->>'shop',''),'8554')||':'||(r.payload->>'orderline') THEN RAISE EXCEPTION 'Referencia de importación inconsistente';END IF;
 SELECT * INTO o FROM public.sales_opportunities WHERE import_reference=key FOR UPDATE;
 IF FOUND THEN
   UPDATE public.crm_sales_import_rows SET opportunity_id=o.id,imported_at=now() WHERE id=r.id;
   RETURN jsonb_build_object('id',o.id,'already_imported',true);
 END IF;
 IF p_opportunity_id IS NOT NULL THEN
   SELECT * INTO o FROM public.sales_opportunities WHERE id=p_opportunity_id FOR UPDATE;
   IF NOT FOUND OR (o.record_id IS DISTINCT FROM c.id AND upper(regexp_replace(coalesce(o.contract_party->>'holder_dni',''),'[^A-Za-z0-9]','','g'))<>dni) THEN RAISE EXCEPTION 'La oportunidad no corresponde al cliente';END IF;
   IF o.import_reference IS NOT NULL THEN RAISE EXCEPTION 'Esta oportunidad ya tiene otra venta importada';END IF;
   IF position(upper(regexp_replace(op,'[^A-Za-z0-9]','','g')) IN upper(regexp_replace(o.title,'[^A-Za-z0-9]','','g')))=0 THEN RAISE EXCEPTION 'El operador no coincide con la oportunidad';END IF;
   IF o.installation_date IS NOT NULL AND o.installation_date<>installed THEN RAISE EXCEPTION 'La instalación existente tiene otra fecha: revisa antes de sustituirla';END IF;
   SELECT * INTO g FROM public.sales_stages WHERE pipeline_id=o.pipeline_id AND active AND lower(btrim(name))='ganado' ORDER BY position LIMIT 1;
 ELSE
   SELECT * INTO g FROM public.sales_stages WHERE active AND lower(btrim(name))='ganado' ORDER BY position LIMIT 1;
 END IF;
 IF g.id IS NULL THEN RAISE EXCEPTION 'No existe columna Ganado';END IF;
 IF p_opportunity_id IS NULL THEN
   INSERT INTO public.sales_opportunities(pipeline_id,stage_id,record_id,title,client_name,phone,amount,expected_date,owner_user_id,status,installation_date,annual_review_date,installation_operator,import_reference,installation_recorded_at)
   VALUES(g.pipeline_id,g.id,c.id,'CAMBIO '||upper(op),coalesce(c.data->>'NOMBRE Y APELLIDOS',concat_ws(' ',c.data->>'NOMBRE',c.data->>'APELLIDOS')),coalesce(nullif(c.data->>'TELÉFONO',''),nullif(c.data->>'TELEFONO','')),p_amount,NULL,auth.uid(),'won',installed,(installed+interval '1 year')::date,op,key,now()) RETURNING id INTO oid;
 ELSE
   UPDATE public.sales_opportunities SET stage_id=g.id,status='won',amount=coalesce(amount,p_amount),installation_date=installed,annual_review_date=(installed+interval '1 year')::date,installation_operator=op,import_reference=key,installation_recorded_at=now(),updated_at=now() WHERE id=o.id RETURNING id INTO oid;
 END IF;
 UPDATE public.crm_sales_import_rows SET opportunity_id=oid,imported_at=now() WHERE id=r.id;
 RETURN jsonb_build_object('id',oid,'already_imported',false);
END $$;
REVOKE ALL ON FUNCTION public.crm_import_installed_sale(uuid,uuid,uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_import_installed_sale(uuid,uuid,uuid,numeric) TO authenticated;
COMMIT;
