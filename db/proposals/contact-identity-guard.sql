create table if not exists crm_private.contact_identity_history (
 id bigint generated always as identity primary key,
 record_id uuid not null,
 changed_at timestamptz not null default now(),
 actor_id uuid default auth.uid(),
 before_data jsonb not null,
 after_data jsonb not null,
 reason text
);
alter table crm_private.contact_identity_history enable row level security;
revoke all on crm_private.contact_identity_history from public, anon, authenticated;
create or replace function crm_private.guard_contact_identity() returns trigger
language plpgsql set search_path='' as $$
declare old_name text; new_name text; old_phone text; new_phone text; old_dni text; new_dni text;
begin
 if old.source_sheet not in ('BASE DE DATOS','DATA','CONTACTOS') then return new; end if;
 if current_user='postgres' and current_setting('crm.identity_repair',true)='on' then return new; end if;
 old_name:=lower(translate(trim(coalesce(nullif(trim(concat_ws(' ',old.data->>'NOMBRE',old.data->>'APELLIDOS')),''),old.data->>'NOMBRE Y APELLIDOS','')),'áéíóúüñ','aeiouun'));
 new_name:=lower(translate(trim(coalesce(nullif(trim(concat_ws(' ',new.data->>'NOMBRE',new.data->>'APELLIDOS')),''),new.data->>'NOMBRE Y APELLIDOS','')),'áéíóúüñ','aeiouun'));
 old_phone:=right(regexp_replace(coalesce(old.data->>'TELÉFONO',old.data->>'TELEFONO',''),'[^0-9]','','g'),9);
 new_phone:=right(regexp_replace(coalesce(new.data->>'TELÉFONO',new.data->>'TELEFONO',''),'[^0-9]','','g'),9);
 old_dni:=upper(regexp_replace(coalesce(nullif(old.data->>'DNI / NIF',''),old.data->>'DNI',''),'[^a-zA-Z0-9]','','g'));
 new_dni:=upper(regexp_replace(coalesce(nullif(new.data->>'DNI / NIF',''),new.data->>'DNI',''),'[^a-zA-Z0-9]','','g'));
 if old_name<>'' and old_name<>new_name and (
   (old_dni<>'' and old_dni<>new_dni) or
   (old_phone<>'' and old_phone<>new_phone and not(old_dni<>'' and old_dni=new_dni))
 ) then
  raise exception 'No se guardó: este cambio sustituye la identidad del contacto. Conserva su DNI si es la misma persona; si es otra persona, crea una ficha separada y vincúlala como titular o gestor.' using errcode='23514';
 end if;
 return new;
end $$;
create or replace function crm_private.audit_contact_identity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if public.crm_contact_sync_fields(old.data) is distinct from public.crm_contact_sync_fields(new.data) then
  insert into crm_private.contact_identity_history(record_id,before_data,after_data,reason)
  values(old.id,old.data,new.data,nullif(current_setting('crm.identity_repair_reason',true),''));
 end if;
 return new;
end $$;
revoke all on function crm_private.guard_contact_identity() from public,anon,authenticated;
revoke all on function crm_private.audit_contact_identity() from public,anon,authenticated;
create trigger crm_identity_guard before update of data on public.records for each row execute function crm_private.guard_contact_identity();
create trigger crm_identity_history after update of data on public.records for each row execute function crm_private.audit_contact_identity();
