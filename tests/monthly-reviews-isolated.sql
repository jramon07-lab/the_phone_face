-- Run after proposal inside BEGIN / ROLLBACK. No external sends, triggers disabled.
SET LOCAL session_replication_role='replica';
SELECT set_config('request.jwt.claim.sub','fc4ec037-1174-4d17-aba5-44afea3c7691',true);
CREATE TEMP TABLE review_existing_before AS SELECT o.* FROM public.sales_opportunities o JOIN crm_private.review_legacy_exclusions x ON x.opportunity_id=o.id;
INSERT INTO public.records(id,source_sheet,data) VALUES
 ('f1000000-0000-4000-8000-000000000001','BASE DE DATOS','{"NOMBRE":"Persona de prueba","TELÉFONO":"600000000"}');
INSERT INTO public.sales_pipelines(id,name) VALUES('f1000000-0000-4000-8000-000000000002','PRUEBA AISLADA');
INSERT INTO public.sales_stages(id,pipeline_id,name) VALUES
 ('f1000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000002','Ganado'),
 ('f1000000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000002','Este mes'),
 ('f1000000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000002','Próximo');
INSERT INTO public.sales_opportunities(id,pipeline_id,stage_id,record_id,title,status,installation_date,installation_operator,owner_user_id,crm_created_by,amount)
 VALUES('f1000000-0000-4000-8000-000000000006','f1000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000001','CAMBIO VODAFONE','won','2026-09-08','Vodafone','fc4ec037-1174-4d17-aba5-44afea3c7691','fc4ec037-1174-4d17-aba5-44afea3c7691',32);
DO $$ DECLARE rid uuid;r public.crm_monthly_reviews%rowtype;jobs bigint;
BEGIN
 IF crm_private.review_dates('2027-09-08','activation')->>'deadline'<>'2027-09-03' THEN RAISE EXCEPTION 'Wrong deadline';END IF;
 IF crm_private.review_dates('2027-02-01','manual')->>'start_date'<>'2027-01-02' THEN RAISE EXCEPTION 'Day one not deferred';END IF;
 IF crm_private.review_dates('2028-03-31','manual')->>'start_date'<>'2028-02-29' THEN RAISE EXCEPTION 'Month end not clamped';END IF;
 rid:=crm_private.ensure_monthly_review('f1000000-0000-4000-8000-000000000006');
 IF rid IS NULL OR rid<>crm_private.ensure_monthly_review('f1000000-0000-4000-8000-000000000006') THEN RAISE EXCEPTION 'Duplicate review';END IF;
 SELECT * INTO r FROM public.crm_monthly_reviews WHERE id=rid;
 IF r.target_date<>'2027-09-08' OR r.deadline<>'2027-09-03' OR r.start_date<>'2027-08-08' THEN RAISE EXCEPTION 'Wrong activation dates';END IF;
 IF (r.sale_snapshot->>'amount')::numeric<>32 THEN RAISE EXCEPTION 'Sale history lost';END IF;
 -- Activation with sending disabled cannot queue a WhatsApp.
 SELECT count(*) INTO jobs FROM public.crm_server_automation_jobs;
 UPDATE public.crm_monthly_reviews SET start_date=(now() AT TIME ZONE 'Europe/Madrid')::date,send_enabled=false WHERE id=rid;
 PERFORM crm_private.activate_monthly_reviews();
 IF (SELECT count(*) FROM public.crm_server_automation_jobs)<>jobs THEN RAISE EXCEPTION 'Unexpected job';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sales_opportunities WHERE id=r.opportunity_id AND stage_id='f1000000-0000-4000-8000-000000000004' AND title='REVISIÓN VODAFONE' AND amount=32 AND installation_date='2026-09-08') THEN RAISE EXCEPTION 'Existing opportunity not preserved';END IF;
 IF EXISTS(SELECT 1 FROM public.sales_opportunities o JOIN review_existing_before b ON b.id=o.id WHERE to_jsonb(o) IS DISTINCT FROM to_jsonb(b)) THEN RAISE EXCEPTION 'Legacy opportunity changed';END IF;
 INSERT INTO public.crm_server_automation_jobs(id,automation_id,user_id,event_key,action_type,action_config,context,run_at,status) VALUES('f1000000-0000-4000-8000-000000000008','1e48df12-93d0-4b2a-aa4c-da48e923be53','fc4ec037-1174-4d17-aba5-44afea3c7691','fixture-monthly-receipt','__send_whatsapp','{"__delivery_receipt":{"idMessage":"fixture"}}',jsonb_build_object('review_id',rid),now(),'pending');
 UPDATE public.crm_monthly_reviews SET job_id='f1000000-0000-4000-8000-000000000008' WHERE id=rid;
 PERFORM crm_private.edit_monthly_review(rid,NULL,NULL,'complete');
 UPDATE public.crm_server_automation_jobs SET status='running' WHERE id='f1000000-0000-4000-8000-000000000008';
 IF public.crm_lifecycle_job_guard('f1000000-0000-4000-8000-000000000008')->>'allow'<>'true' THEN RAISE EXCEPTION 'Receipt verification stopped after completion';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.crm_monthly_reviews WHERE id=rid AND status='completed') THEN RAISE EXCEPTION 'Completion failed';END IF;
END $$;
SELECT 'isolated dates, idempotency, history, cancellation and legacy protection passed' result;
