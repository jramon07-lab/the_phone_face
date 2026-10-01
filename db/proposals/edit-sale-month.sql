-- Correct attribution only: never write stages, installation dates or scheduled jobs.
CREATE OR REPLACE FUNCTION public.crm_edit_sale_month(p_opportunity_id uuid,p_month text,p_expected_month text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.sales_opportunities%rowtype; f public.crm_offer_instances%rowtype; old_month text; old_label uuid; new_label uuid; actor text;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.current_user_is_admin() OR public.current_user_can('can_edit_sales')) THEN RAISE EXCEPTION 'No tienes permiso para editar ventas'; END IF;
 IF p_month IS NULL OR p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Mes de venta no válido'; END IF;
 SELECT * INTO o FROM public.sales_opportunities WHERE id=p_opportunity_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Oportunidad no encontrada'; END IF;
 PERFORM 1 FROM public.crm_offer_instances WHERE opportunity_id=o.id FOR UPDATE;
 PERFORM 1 FROM public.crm_sales_import_rows WHERE opportunity_id=o.id FOR UPDATE;
 SELECT * INTO f FROM public.crm_offer_instances WHERE opportunity_id=o.id AND processed_at IS NOT NULL ORDER BY processed_at DESC,id LIMIT 1;
 SELECT coalesce((SELECT to_char(sale_month,'YYYY-MM') FROM public.crm_sales_import_rows WHERE opportunity_id=o.id ORDER BY id LIMIT 1),f.snapshot->>'sale_month',to_char(f.processed_at AT TIME ZONE 'Europe/Madrid','YYYY-MM')) INTO old_month;
 IF old_month IS NULL THEN RAISE EXCEPTION 'Esta oportunidad todavía no tiene una venta registrada'; END IF;
 IF old_month IS DISTINCT FROM p_expected_month THEN RAISE EXCEPTION 'El mes ha cambiado en otro equipo. Cierra y vuelve a abrir para revisarlo'; END IF;
 IF old_month=p_month THEN RETURN jsonb_build_object('ok',true,'month',p_month); END IF;
 UPDATE public.crm_offer_instances SET snapshot=jsonb_set(coalesce(snapshot,'{}'),'{sale_month}',to_jsonb(p_month)) WHERE opportunity_id=o.id AND processed_at IS NOT NULL;
 UPDATE public.crm_sales_import_rows SET sale_month=(p_month||'-01')::date WHERE opportunity_id=o.id;
 IF f.id IS NULL THEN f.opportunity_id:=o.id;f.contact_id:=o.record_id; END IF;
 IF f.contact_id IS NOT NULL THEN
  SELECT sale_label_id INTO old_label FROM crm_private.opportunity_month_labels WHERE opportunity_id=o.id;
  PERFORM crm_private.offer_record_sale(f,((p_month||'-01')::date+time '12:00') AT TIME ZONE 'Europe/Madrid');
  SELECT sale_label_id INTO new_label FROM crm_private.opportunity_month_labels WHERE opportunity_id=o.id;
  IF old_label IS NOT NULL AND old_label IS DISTINCT FROM new_label AND NOT EXISTS(SELECT 1 FROM crm_private.opportunity_month_labels WHERE contact_id=f.contact_id AND sale_label_id=old_label) THEN
   DELETE FROM public.crm_contact_labels WHERE contact_id=f.contact_id AND label_id=old_label;
  END IF;
 END IF;
 SELECT display_name INTO actor FROM public.user_permissions WHERE user_id=auth.uid();
 INSERT INTO public.crm_change_history(entity_type,entity_id,contact_ids,actor_id,actor_name,before_values,after_values,operation)
 VALUES('sales_opportunities',o.id,array_remove(ARRAY[o.record_id],NULL),auth.uid(),coalesce(actor,'Usuario'),jsonb_build_object('Mes de la venta',old_month),jsonb_build_object('Mes de la venta',p_month),'UPDATE');
 RETURN jsonb_build_object('ok',true,'month',p_month);
END $$;
REVOKE ALL ON FUNCTION public.crm_edit_sale_month(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_edit_sale_month(uuid,text,text) TO authenticated;
