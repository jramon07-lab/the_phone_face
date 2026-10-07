-- Manual review dates are saved atomically with opportunity and review creation.
CREATE OR REPLACE FUNCTION public.crm_create_manual_review_v2(
 p_contact uuid,p_operator text,p_discount_end date,p_note text DEFAULT '',
 p_request_key uuid DEFAULT NULL,p_manager uuid DEFAULT NULL,p_recipient uuid DEFAULT NULL,
 p_terminal_commitment_end date DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $function$
DECLARE s public.sales_stages%rowtype;oid uuid;r uuid;party jsonb;existing public.sales_opportunities%rowtype;
BEGIN
 IF auth.uid() IS NULL OR NOT(public.current_user_is_admin() OR public.current_user_can('can_edit_sales')) THEN RAISE EXCEPTION 'No tienes permiso';END IF;
 IF p_discount_end IS NULL OR p_discount_end <= (now() AT TIME ZONE 'Europe/Madrid')::date OR nullif(btrim(p_operator),'') IS NULL THEN RAISE EXCEPTION 'Indica el operador y una fecha futura de fin del descuento';END IF;
 party:=crm_private.resolve_sale_party(p_contact,p_manager,p_recipient);
 SELECT * INTO s FROM public.sales_stages WHERE active AND lower(translate(btrim(name),'óÓ','oO'))='proximo' ORDER BY position LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'No existe la columna Próximo';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_contact::text||p_operator||p_discount_end,0));
 SELECT o.* INTO existing FROM public.sales_opportunities o JOIN public.crm_monthly_reviews rr ON rr.opportunity_id=o.id WHERE o.record_id=p_contact AND rr.kind='manual' AND rr.target_date=p_discount_end AND lower(rr.operator)=lower(p_operator) AND rr.status NOT IN ('cancelled','completed') LIMIT 1 FOR UPDATE OF o;
 IF FOUND THEN
  IF existing.discount_end_date IS DISTINCT FROM p_discount_end OR existing.terminal_commitment_end IS DISTINCT FROM p_terminal_commitment_end OR existing.contract_party IS DISTINCT FROM party THEN
   RAISE EXCEPTION 'Ya existe una revisión para esta fecha y operador. Ábrela para revisar sus fechas y vinculación.';
  END IF;
  RETURN existing.id;
 END IF;
 oid:=public.crm_create_opportunity_guarded(s.pipeline_id,s.id,p_contact,'REVISIÓN '||upper(btrim(p_operator)),NULL,NULL,NULL,p_discount_end,'Revisión manual · Fin del descuento: '||p_discount_end||CASE WHEN btrim(p_note)<>'' THEN chr(10)||p_note ELSE '' END,party,false);
 UPDATE public.sales_opportunities SET discount_end_date=p_discount_end,terminal_commitment_end=p_terminal_commitment_end WHERE id=oid;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se pudieron guardar las fechas de la revisión';END IF;
 r:=crm_private.create_manual_review_internal(oid,p_discount_end,p_operator);
 RETURN oid;
END $function$;
REVOKE ALL ON FUNCTION public.crm_create_manual_review_v2(uuid,text,date,text,uuid,uuid,uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_create_manual_review_v2(uuid,text,date,text,uuid,uuid,uuid,date) TO authenticated;

