CREATE OR REPLACE FUNCTION crm_private.party_snapshot(p jsonb, contact_name text, contact_phone text, contact_dni text)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare s boolean; recipient text; hn text; hp text; hd text; digits text;
begin
 if p is null or p='null'::jsonb then return null; end if;
 if jsonb_typeof(p)<>'object' then raise exception 'Datos de titular no válidos'; end if;
 s:=coalesce((p->>'same')::boolean,true);
 recipient:=case when not s and p->>'recipient'='holder' then 'holder' else 'contact' end;
 hn:=case when s then contact_name else crm_private.contact_name_case(case when p ? 'holder_first_name' or p ? 'holder_last_name' then btrim(concat_ws(' ',p->>'holder_first_name',p->>'holder_last_name')) else p->>'holder_name' end) end;
 hp:=case when s then contact_phone else btrim(coalesce(p->>'holder_phone','')) end;
 hd:=case when s then contact_dni else upper(btrim(coalesce(p->>'holder_dni',''))) end;
 if not s and coalesce(btrim(hn),'')='' then raise exception 'Escribe el nombre y apellidos del titular';end if;
 if recipient='holder' then
   digits:=regexp_replace(coalesce(hp,''),'[^0-9]','','g');
   if left(digits,2)='00' then digits:=substr(digits,3);end if;
   if digits !~ '^[1-9][0-9]{7,14}$' then raise exception 'Para enviar al titular, escribe su teléfono válido o elige la persona de contacto';end if;
 end if;
 return jsonb_build_object('version',1,'same',s,'holder_name',coalesce(hn,''),'holder_dni',coalesce(hd,''),'holder_phone',coalesce(hp,''),'recipient',recipient,
   'contact_name',coalesce(contact_name,''),'contact_phone',coalesce(contact_phone,''),'contact_dni',coalesce(contact_dni,''),
   'recipient_name',coalesce(case when recipient='holder' then hn else contact_name end,''),'recipient_phone',coalesce(case when recipient='holder' then hp else contact_phone end,'')) || case when not s and (p ? 'holder_first_name' or p ? 'holder_last_name') then jsonb_build_object('holder_first_name',crm_private.contact_name_case(coalesce(p->>'holder_first_name','')),'holder_last_name',crm_private.contact_name_case(coalesce(p->>'holder_last_name',''))) else '{}'::jsonb end;
end $function$;

CREATE OR REPLACE FUNCTION crm_private.party_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare p jsonb;
begin
 if not (new.data ? 'TPF_TITULAR') then return new;end if;
 p:=crm_private.party_from_data(new.data);
 if p is null then raise exception 'Datos de titular no válidos';end if;
 new.data:=jsonb_set(new.data,'{TPF_TITULAR}',jsonb_build_object('version',1,'same',p->'same','holder_name',case when p->>'same'='true' then '' else p->>'holder_name' end,'holder_dni',case when p->>'same'='true' then '' else p->>'holder_dni' end,'holder_phone',case when p->>'same'='true' then '' else p->>'holder_phone' end,'recipient',p->>'recipient') || jsonb_strip_nulls(jsonb_build_object('holder_first_name',p->'holder_first_name','holder_last_name',p->'holder_last_name')));
 return new;
end $function$;

