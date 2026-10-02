-- New review lifecycle. Existing Próximo / Este mes opportunities are excluded.
CREATE TABLE IF NOT EXISTS crm_private.review_legacy_exclusions(opportunity_id uuid PRIMARY KEY REFERENCES public.sales_opportunities(id) ON DELETE CASCADE);
REVOKE ALL ON crm_private.review_legacy_exclusions FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.app_settings WHERE key='crm_monthly_reviews_legacy_snapshot') THEN
 INSERT INTO crm_private.review_legacy_exclusions SELECT o.id FROM public.sales_opportunities o JOIN public.sales_stages s ON s.id=o.stage_id WHERE lower(translate(btrim(s.name),'óÓ','oO')) IN ('proximo','este mes') ON CONFLICT DO NOTHING;
 INSERT INTO public.app_settings(key,value) VALUES('crm_monthly_reviews_legacy_snapshot','true'::jsonb);
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.crm_monthly_reviews(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), opportunity_id uuid NOT NULL REFERENCES public.sales_opportunities(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('activation','manual')), operator text NOT NULL,
 target_date date NOT NULL, deadline date NOT NULL, start_date date NOT NULL, send_at timestamptz NOT NULL,
 responsible_id uuid REFERENCES auth.users(id), responsible_name text NOT NULL DEFAULT '',
 message_text text NOT NULL DEFAULT '', send_enabled boolean NOT NULL DEFAULT true,
 status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','active','completed','cancelled')),
 needs_confirmation boolean NOT NULL DEFAULT false, job_id uuid REFERENCES public.crm_server_automation_jobs(id),
 sale_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb, activated_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(opportunity_id,target_date)
);
CREATE INDEX IF NOT EXISTS crm_monthly_reviews_start_idx ON public.crm_monthly_reviews(start_date,status);
ALTER TABLE public.crm_monthly_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS review_read ON public.crm_monthly_reviews;
CREATE POLICY review_read ON public.crm_monthly_reviews FOR SELECT TO authenticated USING(public.current_user_is_admin() OR public.current_user_can('can_view_sales'));
REVOKE ALL ON public.crm_monthly_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.crm_monthly_reviews TO authenticated;
GRANT ALL ON public.crm_monthly_reviews TO service_role;

CREATE OR REPLACE FUNCTION crm_private.review_dates(p_date date,p_kind text) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE d date:=(p_date-interval '1 month')::date;
BEGIN
 IF extract(day FROM d)=1 THEN d:=d+1;END IF;
 RETURN jsonb_build_object('target_date',p_date,'deadline',CASE WHEN p_kind='activation' THEN p_date-5 ELSE p_date END,'start_date',d);
END $$;
CREATE OR REPLACE FUNCTION crm_private.review_message(p_name text,p_actor text,p_operator text,p_date date,p_kind text,p_party jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE months text[]:=ARRAY['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];body text;date_label text;
BEGIN
 date_label:=extract(day FROM p_date)::int||' de '||months[extract(month FROM p_date)::int];
 body:='Hola '||coalesce(nullif(btrim(p_name),''),'')||' 👋 Soy '||p_actor||', de Phone House Albolote.'||chr(10)||chr(10)||
 CASE WHEN p_kind='activation' THEN 'El próximo '||date_label||' cumples un año con '||p_operator||'. Nos gustaría revisar tu tarifa contigo para comprobar si el precio va a subir al cumplir el año y ver si podemos mejorarlo.'
 ELSE 'El próximo '||date_label||' termina el descuento de tu tarifa de '||p_operator||'. Nos gustaría revisarla contigo antes de esa fecha y ver si podemos mejorar el precio.' END||chr(10)||chr(10)||'¿Te viene bien que lo veamos? 😊';
 RETURN crm_private.contract_message(body,p_party);
END $$;

CREATE OR REPLACE FUNCTION crm_private.ensure_monthly_review(p_id uuid,p_manual_date date DEFAULT NULL,p_operator text DEFAULT NULL) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.sales_opportunities%rowtype;r public.crm_monthly_reviews%rowtype;rid uuid;kind text;target date;dates jsonb;actor uuid;actor_name text;op text;ctx jsonb;stage text;late boolean;
BEGIN
 SELECT * INTO o FROM public.sales_opportunities WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM crm_private.review_legacy_exclusions WHERE opportunity_id=p_id) THEN RETURN NULL;END IF;
 IF p_manual_date IS NULL AND o.installation_date IS NULL THEN RETURN NULL;END IF;
 SELECT lower(btrim(name)) INTO stage FROM public.sales_stages WHERE id=o.stage_id;
 IF p_manual_date IS NULL AND (o.status='lost' OR stage IN ('perdido','viejo')) THEN RETURN NULL;END IF;
 kind:=CASE WHEN p_manual_date IS NULL THEN 'activation' ELSE 'manual' END;
 target:=coalesce(p_manual_date,(o.installation_date+interval '1 year')::date);
 SELECT id INTO rid FROM public.crm_monthly_reviews WHERE opportunity_id=p_id AND target_date=target;
 IF FOUND THEN RETURN rid;END IF;
 IF p_manual_date IS NULL AND target < (now() AT TIME ZONE 'Europe/Madrid')::date THEN RETURN NULL;END IF;
 op:=coalesce(nullif(btrim(p_operator),''),nullif(o.installation_operator,''),nullif(regexp_replace(o.title,'^(CAMBIO|REVISI[ÓO]N)\s+','','i'),''));
 actor:=CASE WHEN p_manual_date IS NOT NULL THEN auth.uid() ELSE coalesce(o.owner_user_id,o.crm_created_by) END;
 SELECT nullif(btrim(display_name),'') INTO actor_name FROM public.user_permissions WHERE user_id=actor;
 dates:=crm_private.review_dates(target,kind);
 late:=(dates->>'start_date')::date < (now() AT TIME ZONE 'Europe/Madrid')::date;
 IF late THEN dates:=jsonb_set(dates,'{start_date}',to_jsonb(((now() AT TIME ZONE 'Europe/Madrid')::date+1)::text));END IF;
 ctx:=crm_private.party_context(public.crm_server_context_for_contact(o.record_id,o.phone),o.contract_party);
 INSERT INTO public.crm_monthly_reviews(opportunity_id,kind,operator,target_date,deadline,start_date,send_at,responsible_id,responsible_name,message_text,needs_confirmation,sale_snapshot)
 VALUES(p_id,kind,coalesce(op,'Sin operador'),target,(dates->>'deadline')::date,(dates->>'start_date')::date,((dates->>'start_date')::date+time '10:00') AT TIME ZONE 'Europe/Madrid',actor,coalesce(actor_name,''),
 CASE WHEN actor_name IS NOT NULL AND op IS NOT NULL THEN crm_private.review_message(coalesce(ctx->>'recipient_first_name',split_part(ctx->>'name',' ',1)),actor_name,op,target,kind,o.contract_party) ELSE '' END,
 actor_name IS NULL OR op IS NULL OR late,to_jsonb(o)) RETURNING id INTO rid;
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION crm_private.ensure_monthly_review(uuid,date,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION crm_private.review_labels(p_review uuid,p_remove boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.crm_monthly_reviews%rowtype;o public.sales_opportunities%rowtype;cid uuid;label text;prior_label text;other_label text;
BEGIN
 SELECT * INTO r FROM public.crm_monthly_reviews WHERE id=p_review;SELECT * INTO o FROM public.sales_opportunities WHERE id=r.opportunity_id;
 label:=crm_private.month_label_name('REVISIÓN',r.start_date::timestamp AT TIME ZONE 'Europe/Madrid');
 prior_label:=CASE WHEN o.installation_date IS NOT NULL THEN crm_private.month_label_name('VENTA',o.installation_date::timestamp AT TIME ZONE 'Europe/Madrid') END;
 FOR cid IN SELECT DISTINCT x FROM unnest(ARRAY[o.record_id,nullif(o.contract_party->>'manager_record_id','')::uuid]) x WHERE x IS NOT NULL LOOP
   IF p_remove THEN
     IF NOT EXISTS(SELECT 1 FROM public.crm_monthly_reviews rr JOIN public.sales_opportunities oo ON oo.id=rr.opportunity_id WHERE rr.id<>r.id AND rr.status='active' AND (oo.record_id=cid OR oo.contract_party->>'manager_record_id'=cid::text) AND date_trunc('month',rr.start_date)=date_trunc('month',r.start_date)) THEN
       DELETE FROM public.crm_contact_labels cl USING public.crm_labels l WHERE cl.contact_id=cid AND cl.label_id=l.id AND l.name=label;
     END IF;
   ELSE
     -- Only remove the original sale's month label; other contracts retain their labels.
     IF prior_label IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sales_opportunities oo WHERE oo.id<>o.id AND (oo.record_id=cid OR oo.contract_party->>'manager_record_id'=cid::text) AND oo.installation_date IS NOT NULL AND date_trunc('month',oo.installation_date)=date_trunc('month',o.installation_date) AND NOT EXISTS(SELECT 1 FROM public.crm_monthly_reviews rr WHERE rr.opportunity_id=oo.id AND rr.status='active')) THEN
       DELETE FROM public.crm_contact_labels cl USING public.crm_labels l WHERE cl.contact_id=cid AND cl.label_id=l.id AND l.name=prior_label;
     END IF;
     PERFORM crm_private.offer_add_label(cid,label,'Revisiones');
   END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION crm_private.review_labels(uuid,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION crm_private.activate_monthly_reviews() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.crm_monthly_reviews%rowtype;o public.sales_opportunities%rowtype;sid uuid;a uuid;ctx jsonb;j uuid;n integer:=0;
BEGIN
 FOR r IN SELECT * FROM public.crm_monthly_reviews WHERE status IN ('planned','active') AND start_date <= (now() AT TIME ZONE 'Europe/Madrid')::date FOR UPDATE SKIP LOCKED LOOP
   SELECT * INTO o FROM public.sales_opportunities WHERE id=r.opportunity_id;
   IF r.status='planned' AND (o.status IN ('lost','closed') OR EXISTS(SELECT 1 FROM public.sales_stages WHERE id=o.stage_id AND lower(btrim(name)) IN ('perdido','viejo'))) THEN UPDATE public.crm_monthly_reviews SET status='cancelled',send_enabled=false,updated_at=now() WHERE id=r.id;CONTINUE;END IF;
   IF r.status='planned' THEN
     SELECT id INTO sid FROM public.sales_stages WHERE pipeline_id=o.pipeline_id AND active AND lower(btrim(name))='este mes' ORDER BY position LIMIT 1;
     IF sid IS NULL THEN CONTINUE;END IF;
     UPDATE public.crm_monthly_reviews SET status='active',activated_at=now(),updated_at=now() WHERE id=r.id;
     UPDATE public.sales_opportunities SET stage_id=sid,title='REVISIÓN '||upper(r.operator),expected_date=r.deadline,status='open',updated_at=now() WHERE id=o.id;
     PERFORM crm_private.review_labels(r.id);n:=n+1;
   END IF;
   IF r.send_enabled AND NOT r.needs_confirmation AND r.job_id IS NULL AND btrim(r.message_text)<>'' AND r.responsible_id IS NOT NULL THEN
     SELECT id INTO a FROM public.crm_automations WHERE enabled AND trigger_config->>'automation_code' LIKE '%_annual_review' ORDER BY (lower(trigger_config->>'automation_operator')=lower(r.operator)) DESC,id LIMIT 1;
     IF a IS NULL THEN CONTINUE;END IF;
     ctx:=crm_private.party_context(public.crm_server_context_for_contact(o.record_id,o.phone),o.contract_party)||jsonb_build_object('opportunity_id',o.id,'review_id',r.id,'operator',r.operator,'event_at',now(),'lifecycle',jsonb_build_object('mode','review'));
     INSERT INTO public.crm_server_automation_jobs(automation_id,user_id,event_key,action_type,action_config,context,run_at)
       VALUES(a,r.responsible_id,'monthly-review:'||r.id,'__send_whatsapp',jsonb_build_object('text',r.message_text,'business_schedule','phone_house'),ctx,r.send_at)
       ON CONFLICT(automation_id,event_key) DO NOTHING RETURNING id INTO j;
     IF j IS NULL THEN SELECT id INTO j FROM public.crm_server_automation_jobs WHERE automation_id=a AND event_key='monthly-review:'||r.id;END IF;
     UPDATE public.crm_monthly_reviews SET job_id=j,updated_at=now() WHERE id=r.id;
   END IF;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION crm_private.activate_monthly_reviews() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION crm_private.review_candidate_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF new.installation_date IS NOT NULL AND (tg_op='INSERT' OR new.installation_date IS DISTINCT FROM old.installation_date) THEN PERFORM crm_private.ensure_monthly_review(new.id);END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION crm_private.review_candidate_trigger() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS monthly_review_candidate ON public.sales_opportunities;
CREATE TRIGGER monthly_review_candidate AFTER INSERT OR UPDATE OF installation_date ON public.sales_opportunities FOR EACH ROW EXECUTE FUNCTION crm_private.review_candidate_trigger();

CREATE OR REPLACE FUNCTION crm_private.review_job(p_job uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.crm_server_automation_jobs%rowtype;r uuid;
BEGIN
 SELECT * INTO j FROM public.crm_server_automation_jobs WHERE id=p_job AND status='running' AND action_type IN ('set_review_date','prepare_operator_review');
 IF NOT FOUND THEN RAISE EXCEPTION 'Revisión no disponible';END IF;
 IF EXISTS(SELECT 1 FROM crm_private.review_legacy_exclusions WHERE opportunity_id::text=j.context->>'opportunity_id') THEN RETURN jsonb_build_object('legacy',true);END IF;
 r:=crm_private.ensure_monthly_review((j.context->>'opportunity_id')::uuid);
 PERFORM crm_private.activate_monthly_reviews();
 RETURN jsonb_build_object('legacy',r IS NULL,'review_id',r);
END $$;
REVOKE ALL ON FUNCTION crm_private.review_job(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION crm_private.review_job(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.crm_review_job(p_job uuid) RETURNS jsonb LANGUAGE sql SET search_path='' AS $$ SELECT crm_private.review_job(p_job) $$;
REVOKE ALL ON FUNCTION public.crm_review_job(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_review_job(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.crm_create_manual_review(p_contact uuid,p_operator text,p_discount_end date,p_note text DEFAULT '',p_request_key uuid DEFAULT NULL,p_manager uuid DEFAULT NULL,p_recipient uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s public.sales_stages%rowtype;oid uuid;r uuid;party jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT(public.current_user_is_admin() OR public.current_user_can('can_edit_sales')) THEN RAISE EXCEPTION 'No tienes permiso';END IF;
 IF p_discount_end IS NULL OR p_discount_end <= (now() AT TIME ZONE 'Europe/Madrid')::date OR nullif(btrim(p_operator),'') IS NULL THEN RAISE EXCEPTION 'Indica el operador y una fecha futura de fin del descuento';END IF;
 party:=crm_private.resolve_sale_party(p_contact,p_manager,p_recipient);
 SELECT * INTO s FROM public.sales_stages WHERE active AND lower(translate(btrim(name),'óÓ','oO'))='proximo' ORDER BY position LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'No existe la columna Próximo';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_contact::text||p_operator||p_discount_end,0));
 SELECT o.id INTO oid FROM public.sales_opportunities o JOIN public.crm_monthly_reviews rr ON rr.opportunity_id=o.id WHERE o.record_id=p_contact AND rr.kind='manual' AND rr.target_date=p_discount_end AND lower(rr.operator)=lower(p_operator) AND rr.status NOT IN ('cancelled','completed');
 IF oid IS NOT NULL THEN RETURN oid;END IF;
 oid:=public.crm_create_opportunity_guarded(s.pipeline_id,s.id,p_contact,'REVISIÓN '||upper(btrim(p_operator)),NULL,NULL,NULL,p_discount_end,'Revisión manual · Fin del descuento: '||p_discount_end||CASE WHEN btrim(p_note)<>'' THEN chr(10)||p_note ELSE '' END,party,false);
 r:=crm_private.create_manual_review_internal(oid,p_discount_end,p_operator);
 RETURN oid;
END $$;

CREATE OR REPLACE FUNCTION crm_private.create_manual_review_internal(p_id uuid,p_date date,p_operator text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT(public.current_user_is_admin() OR public.current_user_can('can_edit_sales')) OR NOT EXISTS(SELECT 1 FROM public.sales_opportunities WHERE id=p_id AND owner_user_id=auth.uid()) THEN RAISE EXCEPTION 'No tienes permiso';END IF;
 RETURN crm_private.ensure_monthly_review(p_id,p_date,p_operator);
END $$;
REVOKE ALL ON FUNCTION crm_private.create_manual_review_internal(uuid,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION crm_private.create_manual_review_internal(uuid,date,text) TO authenticated;
REVOKE ALL ON FUNCTION public.crm_create_manual_review(uuid,text,date,text,uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_create_manual_review(uuid,text,date,text,uuid,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION crm_private.edit_monthly_review(p_id uuid,p_text text,p_send_at timestamptz,p_action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.crm_monthly_reviews%rowtype;j public.crm_server_automation_jobs%rowtype;
BEGIN
 IF auth.uid() IS NULL OR NOT(public.current_user_is_admin() OR public.current_user_can('can_edit_sales')) THEN RAISE EXCEPTION 'No tienes permiso';END IF;
 SELECT * INTO r FROM public.crm_monthly_reviews WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Revisión no disponible';END IF;
 IF r.job_id IS NOT NULL THEN
   SELECT * INTO j FROM public.crm_server_automation_jobs WHERE id=r.job_id FOR UPDATE;
   IF j.status='running' OR (p_action IN ('save','cancel_send') AND (j.status='done' OR j.action_config ? '__delivery_receipt')) THEN RAISE EXCEPTION 'El envío ya está en curso o confirmado. No se puede editar ni cancelar';END IF;
 END IF;
 IF p_action='save' THEN
   IF j.status='failed' THEN RAISE EXCEPTION 'El envío tiene un error. Revisa su resultado antes de reintentarlo desde Próximos pasos de la oportunidad';END IF;
   IF r.status NOT IN ('planned','active') OR btrim(coalesce(p_text,''))='' OR length(p_text)>20000 OR p_send_at<=now() OR p_send_at IS NULL OR extract(minute FROM p_send_at AT TIME ZONE 'Europe/Madrid') NOT IN (0,30) OR extract(second FROM p_send_at)<>0 THEN RAISE EXCEPTION 'Indica un mensaje y una fecha futura con minutos 00 o 30';END IF;
   IF r.responsible_name='' OR r.operator='Sin operador' THEN RAISE EXCEPTION 'Completa el nombre del responsable y el operador antes de confirmar';END IF;
   IF r.status='active' THEN PERFORM crm_private.review_labels(p_id,true);END IF;
   UPDATE public.crm_monthly_reviews SET message_text=p_text,send_at=p_send_at,start_date=(p_send_at AT TIME ZONE 'Europe/Madrid')::date,needs_confirmation=false,updated_at=now() WHERE id=p_id;
   IF r.job_id IS NOT NULL THEN UPDATE public.crm_server_automation_jobs SET action_config=jsonb_set(action_config,'{text}',to_jsonb(p_text)),run_at=p_send_at,updated_at=now() WHERE id=r.job_id AND status='pending';END IF;
   IF r.status='active' THEN PERFORM crm_private.review_labels(p_id);END IF;
 ELSIF p_action IN ('cancel_send','cancel_review','complete') THEN
   UPDATE public.crm_monthly_reviews SET send_enabled=false,status=CASE p_action WHEN 'cancel_review' THEN 'cancelled' WHEN 'complete' THEN 'completed' ELSE status END,updated_at=now() WHERE id=p_id;
   UPDATE public.crm_server_automation_jobs SET status='cancelled',error_message='Cancelado desde Revisiones del mes',updated_at=now() WHERE id=r.job_id AND status IN ('pending','failed') AND NOT(action_config ? '__delivery_receipt');
   IF p_action<>'cancel_send' THEN
 PERFORM crm_private.review_labels(p_id,true);
 UPDATE public.sales_opportunities SET stage_id=coalesce((SELECT s.id FROM public.sales_stages s WHERE s.pipeline_id=public.sales_opportunities.pipeline_id AND s.active AND lower(btrim(s.name))=CASE p_action WHEN 'complete' THEN 'ganado' ELSE 'viejo' END ORDER BY s.position LIMIT 1),stage_id),status=CASE p_action WHEN 'complete' THEN 'won' ELSE 'closed' END,updated_at=now() WHERE id=r.opportunity_id;
 END IF;
 ELSE RAISE EXCEPTION 'Acción no válida';END IF;
END $$;
REVOKE ALL ON FUNCTION crm_private.edit_monthly_review(uuid,text,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION crm_private.edit_monthly_review(uuid,text,timestamptz,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.crm_edit_monthly_review(p_id uuid,p_text text DEFAULT NULL,p_send_at timestamptz DEFAULT NULL,p_action text DEFAULT 'save') RETURNS void LANGUAGE sql SET search_path='' AS $$ SELECT crm_private.edit_monthly_review(p_id,p_text,p_send_at,p_action) $$;
REVOKE ALL ON FUNCTION public.crm_edit_monthly_review(uuid,text,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_edit_monthly_review(uuid,text,timestamptz,text) TO authenticated;

CREATE OR REPLACE FUNCTION crm_private.list_monthly_reviews(p_month date,p_after uuid DEFAULT NULL,p_opportunity uuid DEFAULT NULL) RETURNS SETOF jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
 BEGIN
 IF auth.uid() IS NULL OR NOT(public.current_user_is_admin() OR public.current_user_can('can_view_sales')) THEN RAISE EXCEPTION 'No tienes permiso';END IF;
 RETURN QUERY SELECT to_jsonb(r)||jsonb_build_object('client_name',o.client_name,'phone',coalesce(o.contract_party->>'recipient_phone',o.phone),'contact_id',o.record_id,'contract_party',o.contract_party,'installation_date',o.installation_date,'job_status',j.status,'job_run_at',j.run_at,'receipt',j.action_config->'__delivery_receipt','error',j.error_message,'stage_name',s.name)
 FROM public.crm_monthly_reviews r JOIN public.sales_opportunities o ON o.id=r.opportunity_id JOIN public.sales_stages s ON s.id=o.stage_id LEFT JOIN public.crm_server_automation_jobs j ON j.id=r.job_id
 WHERE (p_opportunity IS NOT NULL AND r.opportunity_id=p_opportunity OR p_opportunity IS NULL AND (p_month IS NULL AND r.status IN ('planned','active') OR r.start_date>=date_trunc('month',p_month)::date AND r.start_date<(date_trunc('month',p_month)+interval '1 month')::date))
 AND (p_after IS NULL OR r.id>p_after) ORDER BY r.id LIMIT 200;
END $$;
REVOKE ALL ON FUNCTION crm_private.list_monthly_reviews(date,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION crm_private.list_monthly_reviews(date,uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.crm_list_monthly_reviews(p_month date,p_after uuid DEFAULT NULL,p_opportunity uuid DEFAULT NULL) RETURNS SETOF jsonb LANGUAGE sql STABLE SET search_path='' AS $$ SELECT * FROM crm_private.list_monthly_reviews(p_month,p_after,p_opportunity) $$;
REVOKE ALL ON FUNCTION public.crm_list_monthly_reviews(date,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_list_monthly_reviews(date,uuid,uuid) TO authenticated;

DO $$ DECLARE o record; BEGIN
 FOR o IN SELECT id FROM public.sales_opportunities WHERE installation_date IS NOT NULL LOOP PERFORM crm_private.ensure_monthly_review(o.id);END LOOP;
END $$;
SELECT cron.schedule('crm-monthly-reviews','5 * * * *','select crm_private.activate_monthly_reviews();');
