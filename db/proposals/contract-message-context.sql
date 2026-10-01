CREATE OR REPLACE FUNCTION crm_private.contract_message(body text,party jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE holder text;different boolean;reference text;first_break integer;
BEGIN
 IF body IS NULL OR btrim(body)='' OR party IS NULL THEN RETURN body;END IF;
 holder:=btrim(regexp_replace(coalesce(party->>'holder_name',''),'\s+',' ','g'));
 different:=CASE WHEN nullif(party->>'holder_record_id','') IS NOT NULL AND nullif(party->>'recipient_contact_id','') IS NOT NULL THEN party->>'holder_record_id'<>party->>'recipient_contact_id' ELSE party->>'same'='false' AND party->>'recipient'='contact' END;
 IF NOT coalesce(different,false) OR holder='' THEN RETURN body;END IF;
 reference:='Sobre el contrato de '||holder||'.';
 IF position(reference IN body)>0 THEN RETURN body;END IF;
 first_break:=position(chr(10) IN body);
 IF body ~* '^Hola\y' AND first_break>0 THEN RETURN left(body,first_break-1)||chr(10)||reference||substr(body,first_break);END IF;
 RETURN reference||chr(10)||chr(10)||body;
END $$;
REVOKE ALL ON FUNCTION crm_private.contract_message(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION crm_private.contract_message(text,jsonb) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.crm_direct_sale_day_one_preview(p_contact_id uuid, p_manager_contact_id uuid, p_recipient_contact_id uuid, p_operator text, p_netflix_followup boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare party jsonb;r public.crm_automations%rowtype;tpl text;body text;n integer;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para crear ventas';end if;
 party:=crm_private.resolve_sale_party(p_contact_id,p_manager_contact_id,p_recipient_contact_id);
 select count(*) into n from public.crm_automations where enabled and trigger_type='opportunity_stage' and trigger_config->>'automation_code' like '%_day_one' and lower(trigger_config->>'automation_operator')=lower(p_operator);
 if n=0 then return jsonb_build_object('available',false);end if;
 if n<>1 then raise exception 'Hay varias reglas del día siguiente: revisa la configuración';end if;
 select * into r from public.crm_automations where enabled and trigger_type='opportunity_stage' and trigger_config->>'automation_code' like '%_day_one' and lower(trigger_config->>'automation_operator')=lower(p_operator);
 tpl:=case when r.trigger_config ? 'netflix_template_id' then case when p_netflix_followup then r.trigger_config->>'netflix_template_id' else r.trigger_config->>'general_template_id' end else r.action_config#>>'{steps,2,config,template_id}' end;
 select t.body into body from public.wa_templates t where t.id::text=tpl and t.user_id=r.user_id;
 if body is null then raise exception 'No se encuentra la plantilla del día siguiente';end if;
 body:=replace(body,'{nombre}',party->>'recipient_first_name');
 body:=crm_private.contract_message(body,party);
 return jsonb_build_object('available',true,'text',body,'rule_id',r.id,'recipient',party->>'recipient_name','phone',party->>'recipient_phone');
end $function$;
CREATE OR REPLACE FUNCTION public.crm_create_offer_execution_v12(p_contact_id uuid, p_catalog_offer_id uuid, p_request_key uuid, p_selections jsonb DEFAULT '[]'::jsonb, p_extra_text text DEFAULT NULL::text, p_mode text DEFAULT 'followup'::text, p_final_price numeric DEFAULT NULL::numeric, p_send_message boolean DEFAULT false, p_processing_date date DEFAULT NULL::date, p_test_mode boolean DEFAULT false, p_allow_duplicate boolean DEFAULT false, p_send_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_welcome boolean DEFAULT false, p_recipient_contact_id uuid DEFAULT NULL::uuid, p_manager_contact_id uuid DEFAULT NULL::uuid, p_message_text text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  result jsonb; party jsonb; previous text; offer_id uuid; message text; prior public.crm_offer_instances%rowtype;
begin
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required';END IF;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_key::text,0));
  SELECT * INTO prior FROM public.crm_offer_instances WHERE created_by=auth.uid() AND request_key=p_request_key;
  IF FOUND THEN RETURN coalesce(prior.snapshot->'execution_result_v12','{}'::jsonb)||jsonb_build_object('offer_id',prior.id,'opportunity_id',prior.opportunity_id,'idempotent_replay',true,'message',prior.message_text,'status',prior.status);END IF;
  party:=crm_private.resolve_sale_party(p_contact_id,p_manager_contact_id,p_recipient_contact_id);
  previous:=current_setting('crm.sale_party',true);
  perform set_config('crm.sale_party',party::text,true);
  result:=public.crm_create_offer_execution_v9(
    p_contact_id,p_catalog_offer_id,p_request_key,p_selections,p_extra_text,p_mode,
    p_final_price,p_send_message,p_processing_date,p_test_mode,p_allow_duplicate,
    p_send_at,p_welcome,p_recipient_contact_id
  );

  offer_id:=nullif(result->>'offer_id','')::uuid;
  IF NOT coalesce((result->>'idempotent_replay')::boolean,false) THEN
    SELECT message_text INTO message FROM public.crm_offer_instances WHERE id=offer_id AND created_by=auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No se encuentra la oferta creada';END IF;
    IF p_message_text IS NOT NULL AND (btrim(p_message_text)='' OR length(p_message_text)>20000) THEN RAISE EXCEPTION 'El mensaje debe contener entre 1 y 20000 caracteres';END IF;
    message:=crm_private.contract_message(coalesce(p_message_text,message),party);
    UPDATE public.crm_offer_instances SET message_text=message,updated_at=now() WHERE id=offer_id AND created_by=auth.uid();
    UPDATE public.crm_server_automation_jobs SET context=jsonb_set(context,'{oferta_mensaje}',to_jsonb(message),true),updated_at=now()
      WHERE user_id=auth.uid() AND context->>'offer_instance_id'=offer_id::text AND status='pending';
  ELSE
    SELECT message_text INTO message FROM public.crm_offer_instances WHERE id=offer_id AND created_by=auth.uid();
  END IF;
  result:=result||jsonb_build_object('message',message);
  UPDATE public.crm_offer_instances SET snapshot=jsonb_set(coalesce(snapshot,'{}'::jsonb),'{execution_result_v12}',result,true) WHERE id=offer_id AND created_by=auth.uid();
  perform set_config('crm.sale_party',coalesce(previous,''),true);
  -- Scheduled offers remain scheduled.  Only an offer intended for now asks
  -- the runner to start immediately; the durable pending job is its fallback.
  if coalesce(p_send_message,false)
     and (p_send_at is null or p_send_at <= now()) then
    perform crm_private.dispatch_runner_now();
  end if;

  return result;
end;
$function$;
REVOKE ALL ON FUNCTION public.crm_create_offer_execution_v12(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean,timestamptz,boolean,uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_create_offer_execution_v12(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean,timestamptz,boolean,uuid,uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION crm_private.schedule_installed_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a public.crm_automations%rowtype; j public.crm_server_automation_jobs%rowtype;
 cfg jsonb;ctx jsonb;due date;at_time timestamptz;action text;existing_count integer;phone text;
BEGIN
 IF new.installation_date IS NULL OR new.import_reference IS NULL THEN RETURN new;END IF;
 IF tg_op='UPDATE' AND new.installation_date IS NOT DISTINCT FROM old.installation_date AND new.installation_operator IS NOT DISTINCT FROM old.installation_operator THEN RETURN new;END IF;
 IF auth.uid() IS NULL OR NOT public.current_user_is_admin() THEN RAISE EXCEPTION 'Solo administración puede confirmar una instalación importada';END IF;
 ctx:=public.crm_server_context_for_contact(new.record_id,new.phone)||jsonb_build_object('opportunity_id',new.id,'operator',new.installation_operator,'event_at',new.installation_date::text||'T10:00:00','installation_date',new.installation_date,'import_reference',new.import_reference);
 ctx:=crm_private.party_context(ctx,new.contract_party);
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
END $function$;

CREATE OR REPLACE FUNCTION crm_private.party_context(ctx jsonb,p jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
 IF p IS NULL THEN RETURN ctx;END IF;
 RETURN (coalesce(ctx,'{}'::jsonb)-'chat_id')||jsonb_build_object('contract_party',p,'contact_name',p->>'contact_name','contact_phone',p->>'contact_phone','contact_dni',p->>'contact_dni','name',p->>'recipient_name','phone',crm_private.party_phone(p->>'recipient_phone'))||
 CASE WHEN nullif(p->>'recipient_first_name','') IS NOT NULL THEN jsonb_build_object('recipient_first_name',p->>'recipient_first_name','recipient_contact_id',p->>'recipient_contact_id') ELSE '{}'::jsonb END;
END $$;
