-- Accept all previous operators supported by the UI, including custom operators.
-- Changes validation only; no customer rows or scheduled messages are written.
CREATE OR REPLACE FUNCTION crm_private.router_return_preferences(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare send boolean;scheduled timestamptz;
begin
 if p is null then return null;end if;
 if jsonb_typeof(p)<>'object' then raise exception 'Configuración de devolución no válida';end if;
 if coalesce(p->>'send','') not in ('true','false') then raise exception 'Indica si se envía el mensaje';end if;
 send:=(p->>'send')::boolean;
 if jsonb_typeof(p->'previous_operator') is distinct from 'string'
    or length(btrim(coalesce(p->>'previous_operator','')))=0
    or length(p->>'previous_operator')>80
    or p->>'previous_operator' ~ '[[:cntrl:]]'
    or p->>'previous_operator' in ('__proto__','prototype','constructor')
 then raise exception 'Selecciona el operador anterior';end if;
 if send and (length(btrim(coalesce(p->>'text','')))=0 or length(p->>'text')>10000) then raise exception 'El mensaje debe tener entre 1 y 10000 caracteres';end if;
 if send and nullif(p->>'rule_id','') is null then raise exception 'No hay mensaje del día siguiente configurado';end if;
 if send and nullif(p->>'send_at','') is not null then
   scheduled:=(p->>'send_at')::timestamptz;
   if scheduled<=now()+interval '1 minute' then raise exception 'Elige una fecha y hora futuras';end if;
 end if;
 return jsonb_build_object('previous_operator',p->>'previous_operator','text',coalesce(p->>'text',''),'send',send,'send_at',case when send then scheduled end,'operator',coalesce(p->>'operator',''),'rule_id',p->>'rule_id');
end $function$;

DO $test$
declare op text; bad jsonb; result jsonb; rejected boolean; payload jsonb;
begin
 foreach op in array ARRAY['Yoigo','MásMóvil','O2','Vodafone','Ninguno','Otro','Orange','Digi','Pepephone','Jazztel','Lowi','Movistar','Operador añadido']
 loop
  payload:=jsonb_build_object('previous_operator',op,'send',true,'text','Mensaje de prueba','rule_id','test-only','operator','Vodafone','send_at',now()+interval '2 days');
  result:=crm_private.router_return_preferences(payload);
  if result->>'previous_operator' is distinct from op or result->>'text' <> 'Mensaje de prueba' or result->>'send' <> 'true' or (result->>'send_at')::timestamptz is distinct from (payload->>'send_at')::timestamptz then raise exception 'Regression for %',op;end if;
 end loop;
 foreach bad in array ARRAY['null'::jsonb,'""'::jsonb,'"   "'::jsonb,'42'::jsonb,'{}'::jsonb,'[]'::jsonb,to_jsonb(repeat('a',81)),to_jsonb(E'Orange\n'::text),to_jsonb('__proto__'::text)]
 loop
  rejected:=false;
  begin perform crm_private.router_return_preferences(jsonb_build_object('previous_operator',bad,'send',false));
  exception when raise_exception then rejected:=true;end;
  if not rejected then raise exception 'Invalid operator accepted: %',bad;end if;
 end loop;
 rejected:=false;
 begin perform crm_private.router_return_preferences('{"send":true,"previous_operator":"Orange","text":"","rule_id":"test-only"}');
 exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Empty message accepted';end if;
 rejected:=false;
 begin perform crm_private.router_return_preferences('{"send":true,"previous_operator":"Orange","text":"Message"}');
 exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Missing rule accepted';end if;
 rejected:=false;
 begin perform crm_private.router_return_preferences(jsonb_build_object('send',true,'previous_operator','Orange','text','Message','rule_id','test-only','send_at',now()-interval '1 day'));
 exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Past date accepted';end if;
 if crm_private.router_return_preferences(null) is not null then raise exception 'Null preferences changed';end if;
end $test$;
