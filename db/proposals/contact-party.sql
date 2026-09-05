-- Additive contact/contract-holder metadata. No existing records or jobs are rewritten.
alter table public.sales_opportunities add column if not exists contract_party jsonb;

create or replace function crm_private.party_snapshot(p jsonb, contact_name text, contact_phone text, contact_dni text)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare s boolean; recipient text; hn text; hp text; hd text; digits text;
begin
 if p is null or p='null'::jsonb then return null; end if;
 if jsonb_typeof(p)<>'object' then raise exception 'Datos de titular no válidos'; end if;
 s:=coalesce((p->>'same')::boolean,true);
 recipient:=case when not s and p->>'recipient'='holder' then 'holder' else 'contact' end;
 hn:=case when s then contact_name else crm_private.contact_name_case(p->>'holder_name') end;
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
   'recipient_name',coalesce(case when recipient='holder' then hn else contact_name end,''),'recipient_phone',coalesce(case when recipient='holder' then hp else contact_phone end,''));
end $$;

create or replace function crm_private.party_from_data(d jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select crm_private.party_snapshot(d->'TPF_TITULAR',
  coalesce(nullif(d->>'NOMBRE Y APELLIDOS',''),nullif(btrim(concat_ws(' ',d->>'NOMBRE',d->>'APELLIDOS')),''),d->>'CLIENTE',d->>'CLIENTE FINAL',''),
  coalesce(nullif(d->>'TELÉFONO',''),nullif(d->>'TELEFONO',''),nullif(d->>'PHONE',''),d->>'MOVIL',''),
  coalesce(d->>'DNI / NIF',d->>'DNI',d->>'NIF',''));
$$;

create or replace function crm_private.party_phone(value text)
returns text language plpgsql immutable security invoker set search_path='' as $
declare p text:=regexp_replace(coalesce(value,''),'[^0-9]','','g');
begin
 if left(p,2)='00' then p:=substr(p,3);end if;
 if length(p)=9 then p:='34'||p;end if;
 return p;
end $;
revoke all on function crm_private.party_phone(text) from public,anon;
grant execute on function crm_private.party_phone(text) to authenticated,service_role;

create or replace function crm_private.party_context(ctx jsonb, p jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
begin
 if p is null then return ctx;end if;
 return (coalesce(ctx,'{}'::jsonb)-'chat_id')||jsonb_build_object('contract_party',p,'contact_name',p->>'contact_name','contact_phone',p->>'contact_phone','contact_dni',p->>'contact_dni',
   'name',p->>'recipient_name','phone',crm_private.party_phone(p->>'recipient_phone'));
end $$;

create or replace function crm_private.party_record()
returns trigger language plpgsql security invoker set search_path='' as $$
declare p jsonb;
begin
 if not (new.data ? 'TPF_TITULAR') then return new;end if;
 p:=crm_private.party_from_data(new.data);
 if p is null then raise exception 'Datos de titular no válidos';end if;
 new.data:=jsonb_set(new.data,'{TPF_TITULAR}',jsonb_build_object('version',1,'same',p->'same','holder_name',case when p->>'same'='true' then '' else p->>'holder_name' end,'holder_dni',case when p->>'same'='true' then '' else p->>'holder_dni' end,'holder_phone',case when p->>'same'='true' then '' else p->>'holder_phone' end,'recipient',p->>'recipient'));
 return new;
end $$;
create trigger crm_party_record before insert or update of data on public.records for each row execute function crm_private.party_record();

create or replace function crm_private.party_opportunity()
returns trigger language plpgsql security invoker set search_path='' as $$
declare d jsonb;
begin
 if tg_op='UPDATE' then
   -- An unrelated title, stage, price or contact edit must not change this snapshot.
   if new.contract_party is not distinct from old.contract_party then return new;end if;
 end if;
 if new.contract_party is null then
   select data into d from public.records where id=new.record_id;
   new.contract_party:=crm_private.party_from_data(d);
 else
   new.contract_party:=crm_private.party_snapshot(new.contract_party,
    coalesce(new.contract_party->>'contact_name',new.client_name,''),coalesce(new.contract_party->>'contact_phone',new.phone,''),coalesce(new.contract_party->>'contact_dni',''));
 end if;
 return new;
end $$;
create trigger crm_party_opportunity before insert or update of contract_party on public.sales_opportunities for each row execute function crm_private.party_opportunity();

create or replace function crm_private.party_job_context()
returns trigger language plpgsql security invoker set search_path='' as $$
declare p jsonb; d jsonb; oid text; cid text;
begin
 -- A child job keeps the original recipient even if the contact is edited later.
 p:=new.context->'contract_party';
 oid:=new.context->>'opportunity_id';cid:=new.context->>'contact_id';
 if coalesce(new.context->>'flow_root','')='' and oid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
   select contract_party into d from public.sales_opportunities where id=oid::uuid;
   if d is not null then p:=d;
   elsif found then
     -- Legacy opportunities keep their established contact routing; no holder is inferred.
     if p is not null then new.context:=(new.context-'contract_party')||jsonb_build_object('name',coalesce(p->>'contact_name',new.context->>'name'),'phone',public.crm_server_normalize_phone(coalesce(p->>'contact_phone',new.context->>'phone')));end if;
     return new;
   end if;
 end if;
 if p is null and cid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
   select data into d from public.records where id=cid::uuid;p:=crm_private.party_from_data(d);
 end if;
 if p is null then return new;end if;
 new.context:=crm_private.party_context(new.context,p);
 if new.action_type in ('schedule_whatsapp','__send_whatsapp','send_template') and coalesce(new.context->>'phone','') !~ '^[1-9][0-9]{7,14}$' then
   new.status:='failed';new.error_message:='Falta un teléfono válido del destinatario elegido. No se ha enviado ningún mensaje.';
 end if;
 return new;
end $$;
create trigger crm_party_job_context before insert on public.crm_server_automation_jobs for each row execute function crm_private.party_job_context();

revoke all on function crm_private.party_snapshot(jsonb,text,text,text),crm_private.party_from_data(jsonb),crm_private.party_context(jsonb,jsonb),crm_private.party_record(),crm_private.party_opportunity(),crm_private.party_job_context() from public,anon;
grant execute on function crm_private.party_snapshot(jsonb,text,text,text),crm_private.party_from_data(jsonb),crm_private.party_context(jsonb,jsonb) to authenticated,service_role;
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
  return crm_private.party_context(jsonb_build_object('contact_id',v_contact,'name',nm,'dni',dni,'phone',public.crm_server_normalize_phone(ph),'contact_data',d),crm_private.party_from_data(d));
end;
$function$


