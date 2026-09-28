-- Imported sales use the Excel sale month; unrelated offers and aftercare stay intact.
BEGIN;
CREATE OR REPLACE FUNCTION crm_private.installed_sale_month_labels()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.sales_opportunities%rowtype; tracked crm_private.opportunity_month_labels%rowtype;
 lid uuid; label_name text; stamp timestamptz;
BEGIN
 IF new.opportunity_id IS NULL THEN RETURN new;END IF;
 IF auth.uid() IS NULL OR NOT public.current_user_is_admin() THEN RAISE EXCEPTION 'Solo administración puede confirmar etiquetas de ventas importadas';END IF;
 SELECT * INTO o FROM public.sales_opportunities WHERE id=new.opportunity_id AND import_reference=new.source_key;
 IF NOT FOUND OR o.record_id IS NULL THEN RAISE EXCEPTION 'Venta importada sin cliente vinculado';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(o.record_id::text,7741));
 SELECT * INTO tracked FROM crm_private.opportunity_month_labels WHERE opportunity_id=o.id FOR UPDATE;
 stamp:=(new.sale_month+time '12:00') AT TIME ZONE 'Europe/Madrid';
 label_name:=crm_private.month_label_name('VENTAS',stamp);
 INSERT INTO public.crm_labels(name) VALUES(label_name) ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING id INTO lid;
 INSERT INTO public.app_settings(key,value,updated_at) VALUES('crm_label_categories_v1',jsonb_build_object(lid::text,'Ventas'),now())
 ON CONFLICT(key) DO UPDATE SET value=(CASE WHEN jsonb_typeof(public.app_settings.value)='object' THEN public.app_settings.value ELSE '{}'::jsonb END)||excluded.value,updated_at=now();
 INSERT INTO public.crm_contact_labels(contact_id,label_id) VALUES(o.record_id,lid) ON CONFLICT(contact_id,label_id) DO NOTHING;
 INSERT INTO crm_private.opportunity_month_labels(opportunity_id,contact_id,sale_label_id,sold_at) VALUES(o.id,o.record_id,lid,stamp)
 ON CONFLICT(opportunity_id) DO UPDATE SET contact_id=excluded.contact_id,sale_label_id=excluded.sale_label_id,sold_at=excluded.sold_at;
 -- A known offer-month link can be retired individually. Unmapped labels are only
 -- retired when there is no other active opportunity/offer that might own them.
 WITH active_other AS (
  SELECT s.id FROM public.sales_opportunities s LEFT JOIN public.sales_stages st ON st.id=s.stage_id
  WHERE s.record_id=o.record_id AND s.id<>o.id AND s.status NOT IN ('won','lost')
    AND lower(coalesce(st.name,'')) NOT IN ('ganado','perdido','viejo')
  UNION
  SELECT f.opportunity_id FROM public.crm_offer_instances f LEFT JOIN public.sales_opportunities s ON s.id=f.opportunity_id
  WHERE (f.contact_id=o.record_id OR s.record_id=o.record_id) AND f.opportunity_id IS DISTINCT FROM o.id
    AND f.status IN ('following','queued','paused','error','accepted','processed')
 )
 DELETE FROM public.crm_contact_labels cl USING public.crm_labels l
 WHERE cl.contact_id=o.record_id AND cl.label_id=l.id
   AND l.name ~ '^OFERTAS? (ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE) [0-9]{4}$'
   AND (tracked.offer_label_id=l.id OR NOT EXISTS(SELECT 1 FROM active_other))
   AND NOT EXISTS(SELECT 1 FROM active_other a LEFT JOIN crm_private.opportunity_month_labels m ON m.opportunity_id=a.id WHERE m.offer_label_id IS NULL OR m.offer_label_id=l.id);
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION crm_private.installed_sale_month_labels() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER crm_installed_sale_month_labels AFTER INSERT OR UPDATE OF opportunity_id ON public.crm_sales_import_rows
 FOR EACH ROW EXECUTE FUNCTION crm_private.installed_sale_month_labels();
COMMIT;
