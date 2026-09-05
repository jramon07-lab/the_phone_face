-- Manual rollback only; do not run during normal deployment.
begin;
drop trigger if exists crm_normalize_contact_names on public.records;
-- Restore each name only if it still matches our normalized value.
do $$
declare b record; k text; current_data jsonb; restored jsonb;
begin
 for b in select * from crm_private.contact_name_case_backup loop
  select data into current_data from public.records where id=b.record_id for update;
  if not found then continue; end if;
  restored:=current_data;
  foreach k in array array['NOMBRE','APELLIDOS','APELLIDO','NOMBRE Y APELLIDOS','CLIENTE','CLIENTE FINAL'] loop
   if b.original_data ? k and current_data->k=b.normalized_data->k then
    restored:=jsonb_set(restored,array[k],b.original_data->k,false);
   end if;
  end loop;
  if restored is distinct from current_data then update public.records set data=restored where id=b.record_id; end if;
 end loop;
end $$;
commit;
