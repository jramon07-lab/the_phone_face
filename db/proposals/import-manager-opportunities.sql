-- Explicit reconciliation of an old opportunity owned by a linked manager.
-- No customer data is changed by installing this function; the update happens
-- only when an administrator confirms the selected row in the import screen.
CREATE OR REPLACE FUNCTION public.crm_import_installed_sale_v3(
 p_row_id uuid,p_contact_id uuid,p_opportunity_id uuid DEFAULT NULL,
 p_amount numeric DEFAULT NULL,p_manager_contact_id uuid DEFAULT NULL,
 p_recipient_contact_id uuid DEFAULT NULL,p_confirm_manager_opportunity boolean DEFAULT false,
 p_expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.crm_sales_import_rows%rowtype;o public.sales_opportunities%rowtype;p jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.current_user_is_admin() THEN RAISE EXCEPTION 'Solo administración puede importar ventas';END IF;
 IF p_confirm_manager_opportunity IS TRUE THEN
  SELECT * INTO r FROM public.crm_sales_import_rows WHERE id=p_row_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fila de importación no disponible';END IF;
  -- Retrying an already imported row never rewrites a different opportunity.
  IF r.opportunity_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.sales_opportunities WHERE import_reference=r.source_key) THEN
   RETURN public.crm_import_installed_sale_v2(p_row_id,p_contact_id,p_opportunity_id,p_amount,p_manager_contact_id,p_recipient_contact_id);
  END IF;
  SELECT * INTO o FROM public.sales_opportunities WHERE id=p_opportunity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oportunidad no disponible';END IF;
  IF p_expected_updated_at IS NULL OR o.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'La oportunidad ha cambiado. Vuelve a cargar y revisarla';END IF;
  IF p_manager_contact_id IS NULL OR p_manager_contact_id=p_contact_id OR o.record_id IS DISTINCT FROM p_manager_contact_id THEN RAISE EXCEPTION 'La oportunidad no pertenece al gestor elegido';END IF;
  IF o.import_reference IS NOT NULL THEN RAISE EXCEPTION 'Esta oportunidad ya tiene otra venta importada';END IF;
  IF coalesce(o.contract_party->>'same','true')='false'
   OR nullif(btrim(coalesce(o.contract_party->>'holder_dni','')),'') IS NOT NULL
   OR (nullif(o.contract_party->>'holder_record_id','') IS NOT NULL AND o.contract_party->>'holder_record_id'<>o.record_id::text)
  THEN RAISE EXCEPTION 'La oportunidad ya tiene un titular definido. Revisa sus datos';END IF;
  IF p_recipient_contact_id IS NULL THEN RAISE EXCEPTION 'Selecciona el destinatario de las comunicaciones';END IF;
  -- Keep the relationship stable until the atomic import has completed.
  PERFORM 1 FROM public.records WHERE id IN (p_contact_id,p_manager_contact_id) FOR SHARE;
  p:=crm_private.resolve_sale_party(p_contact_id,p_manager_contact_id,p_recipient_contact_id);
  UPDATE public.sales_opportunities SET record_id=p_contact_id,client_name=p->>'holder_name',
   phone=p->>'recipient_phone',contract_party=p,updated_at=now() WHERE id=o.id;
  -- All original DNI/operator/date/reference checks still run. Any error rolls
  -- back the identity correction together with the import in this transaction.
 END IF;
 RETURN public.crm_import_installed_sale_v2(p_row_id,p_contact_id,p_opportunity_id,p_amount,p_manager_contact_id,p_recipient_contact_id);
END $$;
REVOKE ALL ON FUNCTION public.crm_import_installed_sale_v3(uuid,uuid,uuid,numeric,uuid,uuid,boolean,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_import_installed_sale_v3(uuid,uuid,uuid,numeric,uuid,uuid,boolean,timestamptz) TO authenticated;
