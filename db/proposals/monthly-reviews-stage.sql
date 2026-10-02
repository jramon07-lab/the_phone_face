CREATE OR REPLACE FUNCTION crm_private.monthly_review_stage_end() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record;stage text;
BEGIN
 IF new.stage_id IS NOT DISTINCT FROM old.stage_id AND new.status IS NOT DISTINCT FROM old.status THEN RETURN new;END IF;
 SELECT lower(translate(btrim(name),'óÓ','oO')) INTO stage FROM public.sales_stages WHERE id=new.stage_id;
 IF stage IN ('este mes','proximo') AND new.status='open' THEN RETURN new;END IF;
 FOR r IN SELECT id,job_id FROM public.crm_monthly_reviews WHERE opportunity_id=new.id AND status='active' LOOP
   UPDATE public.crm_monthly_reviews SET status=CASE WHEN stage IN ('perdido','viejo') THEN 'cancelled' ELSE 'completed' END,send_enabled=false,updated_at=now() WHERE id=r.id;
   UPDATE public.crm_server_automation_jobs SET status='cancelled',error_message='Revisión finalizada al cambiar de fase',updated_at=now() WHERE id=r.job_id AND status='pending' AND NOT(action_config ? '__delivery_receipt');
   PERFORM crm_private.review_labels(r.id,true);
 END LOOP;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION crm_private.monthly_review_stage_end() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS monthly_review_stage_end ON public.sales_opportunities;
CREATE TRIGGER monthly_review_stage_end AFTER UPDATE OF stage_id,status ON public.sales_opportunities FOR EACH ROW EXECUTE FUNCTION crm_private.monthly_review_stage_end();
