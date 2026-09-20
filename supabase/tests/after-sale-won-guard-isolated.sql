-- All fixtures and functions are temporary. No public data or routine changed.
BEGIN;
CREATE TEMP TABLE records AS SELECT * FROM public.records WITH NO DATA;
CREATE TEMP TABLE sales_opportunities AS SELECT * FROM public.sales_opportunities WITH NO DATA;
CREATE TEMP TABLE sales_stages AS SELECT * FROM public.sales_stages WITH NO DATA;
CREATE TEMP TABLE crm_automations AS SELECT * FROM public.crm_automations WITH NO DATA;
CREATE TEMP TABLE crm_server_automation_jobs AS SELECT * FROM public.crm_server_automation_jobs WITH NO DATA;
CREATE TEMP TABLE crm_automation_runs AS SELECT * FROM public.crm_automation_runs WITH NO DATA;
CREATE TEMP TABLE crm_automation_contact_exclusions AS SELECT * FROM public.crm_automation_contact_exclusions WITH NO DATA;
CREATE TEMP TABLE crm_contact_labels AS SELECT * FROM public.crm_contact_labels WITH NO DATA;
CREATE TEMP TABLE crm_offer_response_states AS SELECT * FROM public.crm_offer_response_states WITH NO DATA;
CREATE TEMP TABLE commercial_optouts AS SELECT * FROM crm_private.commercial_optouts WITH NO DATA;
CREATE TEMP TABLE guard_results(test text,passed boolean);
CREATE FUNCTION pg_temp.crm_server_automations_enabled() RETURNS boolean LANGUAGE sql AS 'SELECT true';
CREATE FUNCTION pg_temp.crm_server_normalize_phone(text) RETURNS text LANGUAGE sql AS 'SELECT $1';
INSERT INTO pg_temp.records(id) VALUES ('00000000-0000-4000-8000-000000000001');
INSERT INTO pg_temp.sales_stages(id,name) VALUES ('00000000-0000-4000-8000-000000000010','Tramitado'),('00000000-0000-4000-8000-000000000011','Ganado'),('00000000-0000-4000-8000-000000000012','Perdido');
INSERT INTO pg_temp.sales_opportunities(id,record_id,stage_id) VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011');
INSERT INTO pg_temp.crm_automations(id,enabled) VALUES ('00000000-0000-4000-8000-000000000003',true);
INSERT INTO pg_temp.crm_server_automation_jobs(id,automation_id,status,action_type,action_config,context) VALUES ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000003','running','send_template','{}','{"contact_id":"00000000-0000-4000-8000-000000000001","opportunity_id":"00000000-0000-4000-8000-000000000002","phone":"000000000","lifecycle":{"mode":"after_sale","stage_id":"00000000-0000-4000-8000-000000000010"}}');
CREATE OR REPLACE FUNCTION pg_temp.crm_lifecycle_job_guard(p_job uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  j pg_temp.crm_server_automation_jobs%rowtype;p jsonb;cid uuid;oid uuid;offer_id uuid;
  reason text;prev pg_temp.crm_server_automation_jobs%rowtype;ph text;
begin
  select * into j from pg_temp.crm_server_automation_jobs where id=p_job;
  if not found or j.status<>'running' then return jsonb_build_object('allow',false,'reason','Ejecución detenida');end if;
  p:=j.context->'lifecycle';
  if coalesce(p->>'mode','') not in ('offer','after_sale') then return jsonb_build_object('allow',true,'context',j.context);end if;
  cid:=nullif(j.context->>'contact_id','')::uuid;
  oid:=nullif(j.context->>'opportunity_id','')::uuid;
  offer_id:=nullif(j.context->>'offer_instance_id','')::uuid;
  ph:=pg_temp.crm_server_normalize_phone(j.context->>'phone');
  if j.action_type in ('record_offer_month','record_sale_month') then
    if cid is null or oid is null or not exists(select 1 from pg_temp.sales_opportunities where id=oid and record_id=cid) then reason:='Oportunidad no disponible';end if;
  elsif not pg_temp.crm_server_automations_enabled() then reason:='Motor pausado';
  elsif not exists(select 1 from pg_temp.crm_automations where id=j.automation_id and enabled) then reason:='Automatización pausada';
  elsif cid is null or not exists(select 1 from pg_temp.records where id=cid) then reason:='Contacto no disponible';
  elsif exists(select 1 from pg_temp.crm_automation_contact_exclusions where automation_id=j.automation_id and contact_id=cid) then reason:='Contacto excluido';
  elsif exists(select 1 from pg_temp.commercial_optouts where phone=ph or contact_id=cid) then reason:='Baja comercial solicitada';
  elsif p->>'mode'='offer' then
    if nullif(p->>'label_id','') is not null and not exists(select 1 from pg_temp.crm_contact_labels where contact_id=cid and label_id::text=p->>'label_id') then reason:='Etiqueta de seguimiento retirada';
    elsif exists(select 1 from pg_temp.sales_opportunities o where o.record_id=cid and (oid is null or o.id=oid) and coalesce(p->'stop_stage_ids','[]'::jsonb) ? o.stage_id::text) then reason:='Oferta pasa a tramitación';
    elsif offer_id is not null and exists(select 1 from pg_temp.crm_offer_response_states where offer_instance_id=offer_id) then reason:='Cliente eligió una respuesta de la oferta';
    end if;
  elsif p->>'mode'='after_sale' then
    if oid is null or not exists(select 1 from pg_temp.sales_opportunities where id=oid and record_id=cid and stage_id::text=p->>'stage_id') then reason:='Oportunidad fuera de Tramitado';end if;
  end if;
  if reason is not null then
    update pg_temp.crm_server_automation_jobs set status='cancelled',error_message=reason,updated_at=now()
      where id=j.id and status in ('pending','running');
    return jsonb_build_object('allow',false,'reason',reason);
  end if;
  if nullif(j.action_config->>'__previous_event','') is not null then
    select * into prev from pg_temp.crm_server_automation_jobs where automation_id=j.automation_id and event_key=j.action_config->>'__previous_event';
    if not found or prev.status in ('pending','running') then return jsonb_build_object('allow',false,'retry',true,'reason','Esperando el paso anterior');end if;
    if prev.status<>'done' or exists(select 1 from pg_temp.crm_automation_runs where automation_id=prev.automation_id and event_key=prev.event_key and context->>'skipped'='true') then
      update pg_temp.crm_server_automation_jobs set status='cancelled',error_message='Paso anterior no completado',updated_at=now() where id=j.id and status='running';
      return jsonb_build_object('allow',false,'reason','Paso anterior no completado');
    end if;
  end if;
  return jsonb_build_object('allow',true,'context',j.context);
end $function$;

DO $$DECLARE r jsonb; BEGIN r:=pg_temp.crm_lifecycle_job_guard('00000000-0000-4000-8000-000000000004'); IF (r->>'allow')::boolean IS DISTINCT FROM false OR r->>'reason' IS DISTINCT FROM 'Oportunidad fuera de Tramitado' THEN RAISE EXCEPTION 'Original regression not reproduced'; END IF; INSERT INTO guard_results VALUES ('Original cancels won: reproduced',true); END$$;
CREATE OR REPLACE FUNCTION pg_temp.crm_lifecycle_job_guard(p_job uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  j pg_temp.crm_server_automation_jobs%rowtype;p jsonb;cid uuid;oid uuid;offer_id uuid;
  reason text;prev pg_temp.crm_server_automation_jobs%rowtype;ph text;
begin
  select * into j from pg_temp.crm_server_automation_jobs where id=p_job;
  if not found or j.status<>'running' then return jsonb_build_object('allow',false,'reason','Ejecución detenida');end if;
  p:=j.context->'lifecycle';
  if coalesce(p->>'mode','') not in ('offer','after_sale') then return jsonb_build_object('allow',true,'context',j.context);end if;
  cid:=nullif(j.context->>'contact_id','')::uuid;
  oid:=nullif(j.context->>'opportunity_id','')::uuid;
  offer_id:=nullif(j.context->>'offer_instance_id','')::uuid;
  ph:=pg_temp.crm_server_normalize_phone(j.context->>'phone');
  if j.action_type in ('record_offer_month','record_sale_month') then
    if cid is null or oid is null or not exists(select 1 from pg_temp.sales_opportunities where id=oid and record_id=cid) then reason:='Oportunidad no disponible';end if;
  elsif not pg_temp.crm_server_automations_enabled() then reason:='Motor pausado';
  elsif not exists(select 1 from pg_temp.crm_automations where id=j.automation_id and enabled) then reason:='Automatización pausada';
  elsif cid is null or not exists(select 1 from pg_temp.records where id=cid) then reason:='Contacto no disponible';
  elsif exists(select 1 from pg_temp.crm_automation_contact_exclusions where automation_id=j.automation_id and contact_id=cid) then reason:='Contacto excluido';
  elsif exists(select 1 from pg_temp.commercial_optouts where phone=ph or contact_id=cid) then reason:='Baja comercial solicitada';
  elsif p->>'mode'='offer' then
    if nullif(p->>'label_id','') is not null and not exists(select 1 from pg_temp.crm_contact_labels where contact_id=cid and label_id::text=p->>'label_id') then reason:='Etiqueta de seguimiento retirada';
    elsif exists(select 1 from pg_temp.sales_opportunities o where o.record_id=cid and (oid is null or o.id=oid) and coalesce(p->'stop_stage_ids','[]'::jsonb) ? o.stage_id::text) then reason:='Oferta pasa a tramitación';
    elsif offer_id is not null and exists(select 1 from pg_temp.crm_offer_response_states where offer_instance_id=offer_id) then reason:='Cliente eligió una respuesta de la oferta';
    end if;
  elsif p->>'mode'='after_sale' then
    if oid is null or not exists(select 1 from pg_temp.sales_opportunities where id=oid and record_id=cid and (stage_id::text=p->>'stage_id' or stage_id in (select id from pg_temp.sales_stages where lower(btrim(name))='ganado'))) then reason:='Oportunidad fuera de Tramitado';end if;
  end if;
  if reason is not null then
    update pg_temp.crm_server_automation_jobs set status='cancelled',error_message=reason,updated_at=now()
      where id=j.id and status in ('pending','running');
    return jsonb_build_object('allow',false,'reason',reason);
  end if;
  if nullif(j.action_config->>'__previous_event','') is not null then
    select * into prev from pg_temp.crm_server_automation_jobs where automation_id=j.automation_id and event_key=j.action_config->>'__previous_event';
    if not found or prev.status in ('pending','running') then return jsonb_build_object('allow',false,'retry',true,'reason','Esperando el paso anterior');end if;
    if prev.status<>'done' or exists(select 1 from pg_temp.crm_automation_runs where automation_id=prev.automation_id and event_key=prev.event_key and context->>'skipped'='true') then
      update pg_temp.crm_server_automation_jobs set status='cancelled',error_message='Paso anterior no completado',updated_at=now() where id=j.id and status='running';
      return jsonb_build_object('allow',false,'reason','Paso anterior no completado');
    end if;
  end if;
  return jsonb_build_object('allow',true,'context',j.context);
end $function$;

DO $$DECLARE r jsonb; a text; s record; BEGIN
FOR a IN SELECT unnest(ARRAY['send_template','prepare_operator_review']) LOOP
 FOR s IN SELECT id,name FROM pg_temp.sales_stages LOOP
  UPDATE pg_temp.sales_opportunities SET stage_id=s.id;
  UPDATE pg_temp.crm_server_automation_jobs SET status='running',action_type=a;
  r:=pg_temp.crm_lifecycle_job_guard('00000000-0000-4000-8000-000000000004');
  IF (r->>'allow')::boolean IS DISTINCT FROM (s.name IN ('Tramitado','Ganado')) THEN RAISE EXCEPTION 'Unexpected result for %, %: %',a,s.name,r; END IF;
  INSERT INTO guard_results VALUES (a||' / '||s.name,true);
 END LOOP;
END LOOP;
UPDATE pg_temp.sales_opportunities SET stage_id='00000000-0000-4000-8000-000000000011';
UPDATE pg_temp.crm_server_automation_jobs SET status='running',action_type='send_template';
UPDATE pg_temp.crm_automations SET enabled=false;
r:=pg_temp.crm_lifecycle_job_guard('00000000-0000-4000-8000-000000000004');
IF r->>'reason' IS DISTINCT FROM 'Automatización pausada' THEN RAISE EXCEPTION 'Pause protection broken'; END IF;
INSERT INTO guard_results VALUES ('Paused automation remains blocked',true);
UPDATE pg_temp.crm_automations SET enabled=true;
UPDATE pg_temp.crm_server_automation_jobs SET status='running';
DELETE FROM pg_temp.records;
r:=pg_temp.crm_lifecycle_job_guard('00000000-0000-4000-8000-000000000004');
IF r->>'reason' IS DISTINCT FROM 'Contacto no disponible' THEN RAISE EXCEPTION 'Deleted contact protection broken'; END IF;
INSERT INTO guard_results VALUES ('Missing contact remains blocked',true);
END$$;
SELECT jsonb_agg(to_jsonb(r)) as isolated_tests FROM pg_temp.guard_results r;
ROLLBACK;
