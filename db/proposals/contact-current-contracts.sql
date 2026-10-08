-- Additive metadata; existing contacts and reviews are not backfilled or resent.
ALTER TABLE public.sales_opportunities ADD COLUMN IF NOT EXISTS contact_contract_key uuid;
ALTER TABLE public.sales_opportunities ADD COLUMN IF NOT EXISTS contract_activation_date date;
ALTER TABLE public.sales_opportunities ADD COLUMN IF NOT EXISTS contact_contract_source_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS sales_contact_contract_key ON public.sales_opportunities(contact_contract_source_id,contact_contract_key) WHERE contact_contract_key IS NOT NULL;

CREATE OR REPLACE FUNCTION crm_private.contact_contract_dates(p_activation date,p_discount date)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE a date:=(p_activation+interval '11 months')::date;b date:=(p_discount-interval '1 month')::date;target date:=coalesce(p_discount,(p_activation+interval '1 year')::date);start date:=coalesce(b,a);
BEGIN
 IF extract(day FROM start)=1 THEN start:=start+1;END IF;
 RETURN jsonb_build_object('target',target,'start',start,'difference',CASE WHEN a IS NOT NULL AND b IS NOT NULL THEN abs(a-b) ELSE 0 END,'basis',CASE WHEN p_discount IS NOT NULL THEN 'discount' ELSE 'activation' END);
END $$;
REVOKE ALL ON FUNCTION crm_private.contact_contract_dates(date,date) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION crm_private.contact_contract_message(p_relationship text,p_name text,p_actor text,p_operator text,p_target date,p_activation_only boolean,p_party jsonb)
RETURNS text LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE body text;months text[]:=ARRAY['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
BEGIN
 IF p_relationship='store' THEN
  RETURN crm_private.review_message(p_name,p_actor,p_operator,p_target,CASE WHEN p_activation_only THEN 'activation' ELSE 'manual' END,p_party);
 END IF;
 body:='Hola '||coalesce(p_name,'')||' 👋 Soy '||coalesce(p_actor,'')||', de Phone House Albolote.'||chr(10)||chr(10);
 IF p_activation_only THEN
  body:=body||'Se acerca la revisión de tu tarifa con '||p_operator||'. Queremos comprobar cuándo termina tu descuento y si tu cuota va a subir.';
 ELSE
  body:=body||'El próximo '||extract(day FROM p_target)::int||' de '||months[extract(month FROM p_target)::int]||' termina el descuento que tienes con '||p_operator||'. Queremos revisar tu tarifa antes de esa fecha y ver qué podemos ofrecerte.';
 END IF;
 RETURN crm_private.contract_message(body||chr(10)||chr(10)||'¿Te viene bien que lo veamos? 😊',p_party);
END $$;
REVOKE ALL ON FUNCTION crm_private.contact_contract_message(text,text,text,text,date,boolean,jsonb) FROM PUBLIC,anon,authenticated;

-- Only the records trigger can invoke this function. The original record write
-- still obeys records RLS, and scheduling additionally requires sales permission.
CREATE OR REPLACE FUNCTION crm_private.sync_contact_contracts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE value jsonb;prior jsonb;old_value jsonb;c jsonb;old_c jsonb;dates jsonb;activation date;discount date;target date;start date;operator text;relationship text;oid uuid;rid uuid;key uuid;holder uuid;recipient uuid;party jsonb;s public.sales_stages%rowtype;o public.sales_opportunities%rowtype;r public.crm_monthly_reviews%rowtype;j public.crm_server_automation_jobs%rowtype;actor_name text;context jsonb;body text;need_confirm boolean;timing_changed boolean;enabled boolean;today date:=(now() AT TIME ZONE 'Europe/Madrid')::date;
BEGIN
 IF NEW.source_sheet<>'BASE DE DATOS' THEN RETURN NEW;END IF;
 value:=NEW.data->'TPF_CURRENT_CONTRACTS';old_value:=CASE WHEN TG_OP='UPDATE' THEN OLD.data->'TPF_CURRENT_CONTRACTS' ELSE NULL END;
 IF value IS NOT DISTINCT FROM old_value THEN RETURN NEW;END IF;
 IF auth.uid() IS NULL THEN RETURN NEW;END IF; -- Imports/sync do not invent a sales actor.
 IF value IS NULL THEN RETURN NEW;END IF;
 IF jsonb_typeof(value)<>'object' OR jsonb_typeof(value->'contracts')<>'array' THEN RAISE EXCEPTION 'Datos de servicios no válidos';END IF;
 IF jsonb_array_length(value->'contracts')>20 THEN RAISE EXCEPTION 'Demasiados servicios';END IF;
 relationship:=coalesce(value->>'relationship','unknown');
 IF relationship NOT IN ('store','external','unknown') THEN RAISE EXCEPTION 'Relación con la tienda no válida';END IF;
 IF NOT(public.current_user_is_admin() OR public.current_user_can('can_edit_sales')) THEN
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(value->'contracts') item WHERE coalesce(item->>'activation_date','')<>'' OR coalesce(item->>'discount_end','')<>'') THEN RAISE EXCEPTION 'Necesitas permiso de ventas para preparar la revisión';END IF;
  RETURN NEW;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('contact-contract:'||NEW.id,0));
 SELECT nullif(btrim(display_name),'') INTO actor_name FROM public.user_permissions WHERE user_id=auth.uid();
 FOR c IN SELECT * FROM jsonb_array_elements(value->'contracts') LOOP
  key:=(c->>'id')::uuid;IF key IS NULL THEN RAISE EXCEPTION 'Falta el identificador del servicio';END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(value->'contracts') x WHERE x->>'id'=c->>'id')>1 THEN RAISE EXCEPTION 'Servicio duplicado';END IF;
  operator:=nullif(btrim(c->>'operator'),'');activation:=nullif(c->>'activation_date','')::date;discount:=nullif(c->>'discount_end','')::date;
  old_c:=NULL;IF jsonb_typeof(old_value->'contracts')='array' THEN SELECT item INTO old_c FROM jsonb_array_elements(old_value->'contracts') item WHERE item->>'id'=c->>'id';END IF;
  holder:=coalesce(nullif(c->>'holder_record_id','')::uuid,NEW.id);
  recipient:=CASE WHEN holder<>NEW.id AND NEW.data->'TPF_TITULAR'->>'recipient'='holder' THEN holder ELSE NEW.id END;
  IF holder<>NEW.id AND NOT NEW.data @> jsonb_build_object('TPF_RELACIONES',jsonb_build_object('managed_contacts',jsonb_build_array(jsonb_build_object('record_id',holder::text)))) THEN RAISE EXCEPTION 'El titular no está vinculado a este contacto';END IF;
  SELECT * INTO o FROM public.sales_opportunities WHERE contact_contract_source_id=NEW.id AND contact_contract_key=key FOR UPDATE;
  oid:=o.id;
  dates:=crm_private.contact_contract_dates(activation,discount);target:=(dates->>'target')::date;start:=(dates->>'start')::date;
  IF oid IS NULL AND (operator IS NULL OR target IS NULL) THEN CONTINUE;END IF;
  party:=crm_private.resolve_sale_party(holder,NEW.id,recipient);
  IF oid IS NULL THEN
   -- Reuse a matching review, including one already prepared by a sale.
   SELECT so.* INTO o FROM public.sales_opportunities so JOIN public.crm_monthly_reviews rr ON rr.opportunity_id=so.id WHERE so.record_id=holder AND so.contact_contract_key IS NULL AND rr.status IN ('planned','active') AND lower(rr.operator)=lower(operator) AND abs(rr.target_date-target)<=31 AND coalesce(so.contract_party->>'manager_record_id',holder::text)=NEW.id::text ORDER BY abs(rr.target_date-target),rr.created_at DESC LIMIT 1 FOR UPDATE OF so;
   oid:=o.id;
  END IF;
  IF oid IS NULL THEN
   SELECT * INTO s FROM public.sales_stages WHERE active AND lower(translate(btrim(name),'óÓ','oO'))='proximo' ORDER BY position LIMIT 1;
   IF NOT FOUND THEN RAISE EXCEPTION 'No existe la columna Próximo';END IF;
   oid:=public.crm_create_opportunity_guarded(s.pipeline_id,s.id,holder,'REVISIÓN '||upper(operator),party->>'holder_name',party->>'recipient_phone',nullif(c->>'monthly_total','')::numeric,target,'Datos del servicio actual · revisión desde contacto',party,true);
  END IF;
  SELECT * INTO r FROM public.crm_monthly_reviews WHERE opportunity_id=oid AND status IN ('planned','active') ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  rid:=r.id;j:=NULL;
  IF rid IS NOT NULL AND r.job_id IS NOT NULL THEN SELECT * INTO j FROM public.crm_server_automation_jobs WHERE id=r.job_id FOR UPDATE;END IF;
  timing_changed:=old_c IS NULL OR (old_c->>'activation_date') IS DISTINCT FROM (c->>'activation_date') OR (old_c->>'discount_end') IS DISTINCT FROM (c->>'discount_end') OR (old_c->>'operator') IS DISTINCT FROM (c->>'operator') OR (old_c->>'holder_record_id') IS DISTINCT FROM (c->>'holder_record_id');
  IF timing_changed AND j.id IS NOT NULL AND (j.status IN ('running','done') OR j.action_config ? '__delivery_receipt') THEN RAISE EXCEPTION 'Esta revisión ya se está enviando o fue enviada. Gestiona sus fechas en Revisiones del mes';END IF;
  IF r.status IS NULL AND o.id IS NOT NULL AND EXISTS(SELECT 1 FROM public.crm_monthly_reviews WHERE opportunity_id=oid AND status IN ('completed','cancelled')) THEN
   -- Editing contact facts must not silently reopen a completed/cancelled review.
   UPDATE public.sales_opportunities SET contact_contract_source_id=NEW.id,contact_contract_key=key,contract_activation_date=activation,discount_end_date=discount WHERE id=oid;CONTINUE;
  END IF;
  UPDATE public.sales_opportunities SET record_id=holder,contact_contract_source_id=NEW.id,contact_contract_key=key,contract_activation_date=activation,discount_end_date=discount,terminal_commitment_end=(SELECT min(nullif(d->>'commitment_end','')::date) FROM jsonb_array_elements(coalesce(c->'devices','[]')) d),contract_party=party WHERE id=oid;
  IF operator IS NULL OR target IS NULL THEN
   IF j.id IS NOT NULL AND j.status NOT IN ('running','done') AND NOT(j.action_config ? '__delivery_receipt') THEN UPDATE public.crm_server_automation_jobs SET status='cancelled' WHERE id=j.id;END IF;
   PERFORM crm_private.review_labels(rid,true);
   UPDATE public.crm_monthly_reviews SET status='cancelled',send_enabled=false,updated_at=now() WHERE id=rid;CONTINUE;
  END IF;
  IF rid IS NULL THEN rid:=crm_private.ensure_monthly_review(oid,target,operator);SELECT * INTO r FROM public.crm_monthly_reviews WHERE id=rid;END IF;
  IF rid IS NULL THEN RAISE EXCEPTION 'No se pudo preparar la revisión';END IF;
  enabled:=CASE WHEN old_c IS NOT NULL AND old_c->>'review_enabled' IS NOT DISTINCT FROM c->>'review_enabled' THEN r.send_enabled ELSE coalesce((c->>'review_enabled')::boolean,true) END;
  need_confirm:=actor_name IS NULL OR target<=today OR start<today OR ((dates->>'difference')::int>31 AND NOT coalesce((c->>'dates_confirmed')::boolean,false));
  IF NOT timing_changed AND old_c->>'dates_confirmed' IS NOT DISTINCT FROM c->>'dates_confirmed' THEN need_confirm:=r.needs_confirmation;END IF;
  IF start<today THEN start:=today+1;END IF;
  context:=crm_private.party_context(public.crm_server_context_for_contact(holder,party->>'recipient_phone'),party);
  IF old_c IS NULL OR old_c->>'message' IS DISTINCT FROM c->>'message' OR old_value->>'relationship' IS DISTINCT FROM relationship OR timing_changed THEN
   body:=coalesce(nullif(btrim(c->>'message'),''),crm_private.contact_contract_message(relationship,coalesce(context->>'recipient_first_name',split_part(context->>'name',' ',1)),actor_name,operator,target,discount IS NULL,party));
  ELSE body:=r.message_text;END IF;
  IF j.id IS NOT NULL AND j.status IN ('running','done') THEN CONTINUE;END IF;
  IF j.id IS NOT NULL AND j.action_config ? '__delivery_receipt' THEN CONTINUE;END IF;
  IF j.id IS NOT NULL AND (timing_changed OR NOT enabled OR need_confirm) THEN UPDATE public.crm_server_automation_jobs SET status='cancelled' WHERE id=j.id;END IF;
  UPDATE public.crm_monthly_reviews SET kind=CASE WHEN discount IS NULL THEN 'activation' ELSE 'manual' END,operator=operator,target_date=target,deadline=CASE WHEN discount IS NULL THEN target-5 ELSE target END,start_date=CASE WHEN timing_changed THEN start ELSE start_date END,send_at=CASE WHEN timing_changed THEN (start+time '10:00') AT TIME ZONE 'Europe/Madrid' ELSE send_at END,message_text=coalesce(body,''),send_enabled=enabled,needs_confirmation=CASE WHEN timing_changed OR old_c->>'dates_confirmed' IS DISTINCT FROM c->>'dates_confirmed' THEN need_confirm ELSE needs_confirmation END,job_id=CASE WHEN timing_changed OR NOT enabled OR need_confirm THEN NULL ELSE job_id END,updated_at=now() WHERE id=rid;
  IF j.id IS NOT NULL AND NOT timing_changed AND enabled AND NOT need_confirm THEN UPDATE public.crm_server_automation_jobs SET action_config=jsonb_set(action_config,'{text}',to_jsonb(coalesce(body,''))) WHERE id=j.id;END IF;
  UPDATE public.sales_opportunities SET amount=CASE WHEN installation_date IS NULL AND notes='Datos del servicio actual · revisión desde contacto' THEN nullif(c->>'monthly_total','')::numeric ELSE amount END,expected_date=CASE WHEN discount IS NULL THEN target-5 ELSE target END WHERE id=oid;
 END LOOP;
 -- Removed services cancel only this contact's own pending reviews.
 FOR o IN SELECT so.* FROM public.sales_opportunities so WHERE so.contact_contract_key IS NOT NULL AND so.contact_contract_source_id=NEW.id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(value->'contracts') item WHERE item->>'id'=so.contact_contract_key::text) LOOP
  SELECT * INTO r FROM public.crm_monthly_reviews WHERE opportunity_id=o.id AND status IN ('planned','active') LIMIT 1 FOR UPDATE;
  IF r.id IS NULL THEN CONTINUE;END IF;
  IF r.job_id IS NOT NULL THEN
   SELECT * INTO j FROM public.crm_server_automation_jobs WHERE id=r.job_id FOR UPDATE;
   IF j.status IN ('running','done') OR j.action_config ? '__delivery_receipt' THEN RAISE EXCEPTION 'No puedes quitar un servicio mientras su revisión se está enviando';END IF;
   UPDATE public.crm_server_automation_jobs SET status='cancelled' WHERE id=j.id;
  END IF;
  PERFORM crm_private.review_labels(r.id,true);
  UPDATE public.crm_monthly_reviews SET status='cancelled',send_enabled=false,updated_at=now() WHERE id=r.id;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_private.sync_contact_contracts() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS contact_current_contracts_review ON public.records;
CREATE TRIGGER contact_current_contracts_review AFTER INSERT OR UPDATE OF data ON public.records FOR EACH ROW EXECUTE FUNCTION crm_private.sync_contact_contracts();
NOTIFY pgrst,'reload schema';

CREATE OR REPLACE FUNCTION crm_private.preview_contact_review(p_relationship text,p_operator text,p_target date,p_activation_only boolean,p_name text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor_name text;
BEGIN
 IF auth.uid() IS NULL OR NOT(public.current_user_is_admin() OR public.current_user_can('can_edit_sales') OR public.current_user_can('can_create_database') OR public.current_user_can('can_edit_records')) THEN RAISE EXCEPTION 'No tienes permiso';END IF;
 SELECT nullif(btrim(display_name),'') INTO actor_name FROM public.user_permissions WHERE user_id=auth.uid();
 RETURN crm_private.contact_contract_message(p_relationship,p_name,actor_name,p_operator,p_target,p_activation_only,'{}'::jsonb);
END $$;
REVOKE ALL ON FUNCTION crm_private.preview_contact_review(text,text,date,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION crm_private.preview_contact_review(text,text,date,boolean,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.crm_preview_contact_review(p_relationship text,p_operator text,p_target date,p_activation_only boolean,p_name text)
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT crm_private.preview_contact_review(p_relationship,p_operator,p_target,p_activation_only,p_name) $$;
REVOKE ALL ON FUNCTION public.crm_preview_contact_review(text,text,date,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_preview_contact_review(text,text,date,boolean,text) TO authenticated;
NOTIFY pgrst,'reload schema';
