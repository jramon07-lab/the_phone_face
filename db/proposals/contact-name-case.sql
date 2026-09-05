-- Contact-name capitalization only. No labels, messages or opportunity changes.
create or replace function crm_private.contact_name_case(p_text text)
returns text language sql immutable strict set search_path='' as $$
 select pg_catalog.initcap(pg_catalog.regexp_replace(pg_catalog.btrim(p_text),'[[:space:]]+',' ','g'))
$$;
create or replace function crm_private.normalize_contact_names(p_data jsonb)
returns jsonb language plpgsql immutable strict set search_path='' as $$
declare result jsonb:=p_data; k text;
begin
 foreach k in array array['NOMBRE','APELLIDOS','APELLIDO','NOMBRE Y APELLIDOS','CLIENTE','CLIENTE FINAL'] loop
  if pg_catalog.jsonb_typeof(result->k)='string' then
   result:=pg_catalog.jsonb_set(result,array[k],pg_catalog.to_jsonb(crm_private.contact_name_case(result->>k)),false);
  end if;
 end loop;
 return result;
end $$;
create or replace function crm_private.normalize_record_contact_names()
returns trigger language plpgsql set search_path='' as $$
begin
 new.data:=crm_private.normalize_contact_names(new.data);
 return new;
end $$;
revoke all on function crm_private.contact_name_case(text) from public,anon;
revoke all on function crm_private.normalize_contact_names(jsonb) from public,anon;
revoke all on function crm_private.normalize_record_contact_names() from public,anon,authenticated;
grant usage on schema crm_private to authenticated,service_role;
grant execute on function crm_private.contact_name_case(text),crm_private.normalize_contact_names(jsonb) to authenticated,service_role;
create table if not exists crm_private.contact_name_case_backup(
 record_id uuid primary key,
 original_data jsonb not null,
 normalized_data jsonb not null,
 backed_up_at timestamptz not null default now()
);
alter table crm_private.contact_name_case_backup enable row level security;
revoke all on crm_private.contact_name_case_backup from public,anon,authenticated;
insert into crm_private.contact_name_case_backup(record_id,original_data,normalized_data)
 select id,data,crm_private.normalize_contact_names(data) from public.records
 where data is distinct from crm_private.normalize_contact_names(data)
 on conflict(record_id) do nothing;
create trigger crm_normalize_contact_names before insert or update of data on public.records
for each row execute function crm_private.normalize_record_contact_names();
update public.records r set data=b.normalized_data
from crm_private.contact_name_case_backup b
where r.id=b.record_id and r.data=b.original_data and r.data is distinct from b.normalized_data;
