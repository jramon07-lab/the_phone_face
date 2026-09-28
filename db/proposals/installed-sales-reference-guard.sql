CREATE OR REPLACE FUNCTION public.crm_import_installed_sale(p_row_id uuid,p_contact_id uuid,p_opportunity_id uuid DEFAULT NULL,p_amount numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.crm_sales_import_rows%rowtype;c public.records%rowtype;o public.sales_opportunities%rowtype;g public.sales_stages%rowtype;
 installed date;dni text;op text;title text;key text;oid uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.current_user_is_admin() THEN RAISE EXCEPTION 'Solo administración puede importar ventas';END IF;
 SELECT * INTO r FROM public.crm_sales_import_rows WHERE id=p_row_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Fila de importación no disponible';END IF;
 IF r.opportunity_id IS NOT NULL THEN RETURN jsonb_build_object('id',r.opportunity_id,'already_imported',true);END IF;
 installed:=nullif(r.payload->>'activation_date','')::date;
 IF installed IS NULL OR installed>current_date OR installed<date '2000-01-01' THEN RAISE EXCEPTION 'Fecha de activación obligatoria y válida';END IF;
 dni:=upper(regexp_replace(coalesce(r.payload->>'dni',''),'[^A-Za-z0-9]','','g'));
 op:=btrim(coalesce(r.payload->>'operator',''));
 IF dni='' OR op='' OR btrim(coalesce(r.payload->>'orderline',''))='' THEN RAISE EXCEPTION 'Faltan DNI, operador o referencia OrderLine';END IF;
 IF upper(coalesce(r.payload->>'cancelled','')) IN ('SI','SÍ','YES') THEN RAISE EXCEPTION 'La venta está cancelada';END IF;
 IF p_amount IS NOT NULL AND (p_amount<0 OR p_amount>1000000 OR p_amount::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Importe no válido';END IF;
 SELECT * INTO c FROM public.records WHERE id=p_contact_id AND source_sheet='BASE DE DATOS';
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM unnest(ARRAY[c.data->>'DNI',c.data->>'DNI / NIF',c.data#>>'{TPF_TITULAR,holder_dni}']) d WHERE upper(regexp_replace(coalesce(d,''),'[^A-Za-z0-9]','','g'))=dni) THEN RAISE EXCEPTION 'El DNI no coincide con el cliente o su titular';END IF;
 key:=r.source_key;
 IF key<>coalesce(nullif(r.payload->>'shop',''),'8554')||':'||(r.payload->>'orderline') THEN RAISE EXCEPTION 'Referencia de importación inconsistente';END IF;
 SELECT * INTO o FROM public.sales_opportunities WHERE import_reference=key FOR UPDATE;
 IF FOUND THEN
   UPDATE public.crm_sales_import_rows SET opportunity_id=o.id,imported_at=now() WHERE id=r.id;
   RETURN jsonb_build_object('id',o.id,'already_imported',true);
 END IF;
 IF p_opportunity_id IS NOT NULL THEN
   SELECT * INTO o FROM public.sales_opportunities WHERE id=p_opportunity_id FOR UPDATE;
   IF NOT FOUND OR (o.record_id IS DISTINCT FROM c.id AND upper(regexp_replace(coalesce(o.contract_party->>'holder_dni',''),'[^A-Za-z0-9]','','g'))<>dni) THEN RAISE EXCEPTION 'La oportunidad no corresponde al cliente';END IF;
   IF o.import_reference IS NOT NULL THEN RAISE EXCEPTION 'Esta oportunidad ya tiene otra venta importada';END IF;
   IF position(upper(regexp_replace(op,'[^A-Za-z0-9]','','g')) IN upper(regexp_replace(o.title,'[^A-Za-z0-9]','','g')))=0 THEN RAISE EXCEPTION 'El operador no coincide con la oportunidad';END IF;
   IF o.installation_date IS NOT NULL AND o.installation_date<>installed THEN RAISE EXCEPTION 'La instalación existente tiene otra fecha: revisa antes de sustituirla';END IF;
   SELECT * INTO g FROM public.sales_stages WHERE pipeline_id=o.pipeline_id AND active AND lower(btrim(name))='ganado' ORDER BY position LIMIT 1;
 ELSE
   SELECT * INTO g FROM public.sales_stages WHERE active AND lower(btrim(name))='ganado' ORDER BY position LIMIT 1;
 END IF;
 IF g.id IS NULL THEN RAISE EXCEPTION 'No existe columna Ganado';END IF;
 IF p_opportunity_id IS NULL THEN
   INSERT INTO public.sales_opportunities(pipeline_id,stage_id,record_id,title,client_name,phone,amount,expected_date,owner_user_id,status,installation_date,annual_review_date,installation_operator,import_reference,installation_recorded_at)
   VALUES(g.pipeline_id,g.id,c.id,'CAMBIO '||upper(op),coalesce(c.data->>'NOMBRE Y APELLIDOS',concat_ws(' ',c.data->>'NOMBRE',c.data->>'APELLIDOS')),coalesce(nullif(c.data->>'TELÉFONO',''),nullif(c.data->>'TELEFONO','')),p_amount,NULL,auth.uid(),'won',installed,(installed+interval '1 year')::date,op,key,now()) RETURNING id INTO oid;
 ELSE
   UPDATE public.sales_opportunities SET stage_id=g.id,status='won',amount=coalesce(amount,p_amount),installation_date=installed,annual_review_date=(installed+interval '1 year')::date,installation_operator=op,import_reference=key,installation_recorded_at=now(),updated_at=now() WHERE id=o.id RETURNING id INTO oid;
 END IF;
 UPDATE public.crm_sales_import_rows SET opportunity_id=oid,imported_at=now() WHERE id=r.id;
 RETURN jsonb_build_object('id',oid,'already_imported',false);
END $$;
