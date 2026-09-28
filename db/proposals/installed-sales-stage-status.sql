BEGIN;
CREATE OR REPLACE FUNCTION crm_private.installed_sale_stage_status()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE stage_name text;
BEGIN
 IF new.import_reference IS NULL OR new.stage_id IS NOT DISTINCT FROM old.stage_id THEN RETURN new;END IF;
 SELECT lower(btrim(name)) INTO stage_name FROM public.sales_stages WHERE id=new.stage_id;
 IF stage_name='ganado' THEN new.status:='won';
 ELSIF stage_name IN ('próximo','proximo','este mes') THEN new.status:='open';END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION crm_private.installed_sale_stage_status() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER crm_installed_sale_stage_status BEFORE UPDATE OF stage_id ON public.sales_opportunities FOR EACH ROW EXECUTE FUNCTION crm_private.installed_sale_stage_status();
COMMIT;
