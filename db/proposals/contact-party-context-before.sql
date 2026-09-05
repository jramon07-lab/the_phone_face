CREATE OR REPLACE FUNCTION public.crm_server_context_for_contact(v_contact uuid, v_phone text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d jsonb := '{}'::jsonb;
  nm text := '';
  dni text := '';
  ph text := coalesce(v_phone,'');
  x record;
begin
  if v_contact is not null then select data into d from public.records where id=v_contact; end if;
  if d is null then d='{}'::jsonb; end if;
  for x in select key,value from jsonb_each_text(d) loop
    if nm='' and lower(x.key) in ('nombre y apellidos','nombre','cliente','cliente final') then nm=x.value; end if;
    if dni='' and (lower(x.key) like 'dni%' or lower(x.key) like 'nif%') then dni=x.value; end if;
    if ph='' and (lower(x.key) like '%tel%' or lower(x.key) like '%móvil%' or lower(x.key) like '%movil%' or lower(x.key) like '%phone%') then ph=x.value; end if;
  end loop;
  return jsonb_build_object('contact_id',v_contact,'name',nm,'dni',dni,'phone',public.crm_server_normalize_phone(ph),'contact_data',d);
end;
$function$

