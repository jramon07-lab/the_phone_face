-- Explicit, atomic merge for two CRM contacts that share one telephone number.
-- The caller chooses the record to keep; the other record is archived before removal.

create table if not exists crm_private.contact_merge_archive (
  duplicate_record_id uuid primary key,
  kept_record_id uuid not null,
  duplicate_data jsonb not null,
  merged_by uuid not null,
  merged_at timestamptz not null default now()
);

alter table crm_private.contact_merge_archive enable row level security;
revoke all on table crm_private.contact_merge_archive from anon, authenticated, public;

create or replace function public.crm_merge_duplicate_contact(
  p_keep_id uuid,
  p_duplicate_id uuid,
  p_expected_keep_data jsonb,
  p_expected_duplicate_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, crm_private, pg_temp
as $$
declare
  keep_row public.records%rowtype;
  duplicate_row public.records%rowtype;
  keep_phone text;
  duplicate_phone text;
  keep_rel jsonb;
  duplicate_rel jsonb;
  merged_links jsonb;
  merged_rel jsonb;
  merged_data jsonb;
  keep_name text;
  keep_dni text;
  keep_phone_text text;
begin
  if auth.uid() is null or not public.current_user_is_admin() then
    raise exception 'No tienes permiso para unificar contactos.';
  end if;
  if p_keep_id is null or p_duplicate_id is null or p_keep_id = p_duplicate_id then
    raise exception 'Elige dos fichas distintas para unificar.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(least(p_keep_id::text,p_duplicate_id::text), 921));
  perform pg_advisory_xact_lock(hashtextextended(greatest(p_keep_id::text,p_duplicate_id::text), 921));

  select * into keep_row from public.records where id=p_keep_id for update;
  select * into duplicate_row from public.records where id=p_duplicate_id for update;
  if not found or keep_row.id is null or duplicate_row.id is null then
    raise exception 'Una de las fichas ya no existe. Actualiza antes de unificar.';
  end if;
  if keep_row.source_sheet <> 'BASE DE DATOS' or duplicate_row.source_sheet <> 'BASE DE DATOS' then
    raise exception 'Solo se pueden unificar fichas de Contactos.';
  end if;
  if keep_row.data is distinct from p_expected_keep_data or duplicate_row.data is distinct from p_expected_duplicate_data then
    raise exception 'Una ficha cambió mientras la revisabas. No se ha unificado nada.';
  end if;

  keep_phone := right(regexp_replace(coalesce(keep_row.data->>'TELÉFONO',keep_row.data->>'TELEFONO',keep_row.data->>'PHONE',''),'\D','','g'),9);
  duplicate_phone := right(regexp_replace(coalesce(duplicate_row.data->>'TELÉFONO',duplicate_row.data->>'TELEFONO',duplicate_row.data->>'PHONE',''),'\D','','g'),9);
  if keep_phone='' or keep_phone <> duplicate_phone then
    raise exception 'Las fichas no comparten el mismo teléfono. No se ha unificado nada.';
  end if;
  if exists(select 1 from public.crm_welcome_requests where contact_id=p_keep_id)
     and exists(select 1 from public.crm_welcome_requests where contact_id=p_duplicate_id) then
    raise exception 'Las dos fichas tienen una bienvenida registrada. Revísalas una a una antes de unificarlas.';
  end if;

  keep_name := coalesce(nullif(btrim(keep_row.data->>'NOMBRE Y APELLIDOS'),''),nullif(btrim(concat_ws(' ',keep_row.data->>'NOMBRE',keep_row.data->>'APELLIDOS')),''),'Contacto');
  keep_dni := coalesce(keep_row.data->>'DNI / NIF',keep_row.data->>'DNI','');
  keep_phone_text := coalesce(keep_row.data->>'TELÉFONO',keep_row.data->>'TELEFONO',keep_row.data->>'PHONE','');
  keep_rel := case when jsonb_typeof(keep_row.data->'TPF_RELACIONES')='object' then keep_row.data->'TPF_RELACIONES' else '{}'::jsonb end;
  duplicate_rel := case when jsonb_typeof(duplicate_row.data->'TPF_RELACIONES')='object' then duplicate_row.data->'TPF_RELACIONES' else '{}'::jsonb end;

  select coalesce(jsonb_agg(x.item order by x.ord),'[]'::jsonb) into merged_links
  from (
    select distinct on (item->>'record_id') item, ord
    from jsonb_array_elements(coalesce(keep_rel->'managed_contacts','[]'::jsonb) || coalesce(duplicate_rel->'managed_contacts','[]'::jsonb)) with ordinality as e(item,ord)
    where coalesce(item->>'record_id','') <> ''
      and item->>'record_id' not in (p_keep_id::text,p_duplicate_id::text)
    order by item->>'record_id',ord
  ) x;
  merged_rel := jsonb_set(jsonb_set(keep_rel,'{version}','1'::jsonb,true),'{managed_contacts}',merged_links,true);
  merged_data := jsonb_set(keep_row.data,'{TPF_RELACIONES}',merged_rel,true);
  if coalesce(merged_data->'TPF_TITULAR','null'::jsonb)='null'::jsonb and duplicate_row.data ? 'TPF_TITULAR' then
    merged_data := jsonb_set(merged_data,'{TPF_TITULAR}',duplicate_row.data->'TPF_TITULAR',true);
  end if;

  -- Any other contact that named the removed record as its associated holder now names the kept record.
  with candidates as (
    select r.id,r.data
    from public.records r
    where r.id <> p_duplicate_id
      and jsonb_typeof(r.data #> '{TPF_RELACIONES,managed_contacts}')='array'
      and exists (
        select 1 from jsonb_array_elements(r.data #> '{TPF_RELACIONES,managed_contacts}') item
        where item->>'record_id'=p_duplicate_id::text
      )
  ), expanded as (
    select c.id,e.ord,
      case when e.item->>'record_id'=p_duplicate_id::text then
        jsonb_set(jsonb_set(jsonb_set(jsonb_set(e.item,'{record_id}',to_jsonb(p_keep_id::text),true),'{name}',to_jsonb(keep_name),true),'{phone}',to_jsonb(keep_phone_text),true),'{dni}',to_jsonb(keep_dni),true)
      else e.item end as item
    from candidates c
    cross join lateral jsonb_array_elements(c.data #> '{TPF_RELACIONES,managed_contacts}') with ordinality as e(item,ord)
  ), deduplicated as (
    select distinct on (id,item->>'record_id') id,ord,item
    from expanded
    order by id,item->>'record_id',ord
  ), grouped as (
    select id,jsonb_agg(item order by ord) as items
    from deduplicated group by id
  )
  update public.records r
  set data=jsonb_set(r.data,'{TPF_RELACIONES,managed_contacts}',g.items,true)
  from grouped g where r.id=g.id;

  insert into public.crm_contact_labels(contact_id,label_id)
  select p_keep_id,label_id from public.crm_contact_labels where contact_id=p_duplicate_id
  on conflict do nothing;
  update public.agenda_items set related_record_id=p_keep_id,customer_name=keep_name,customer_phone=keep_phone_text where related_record_id=p_duplicate_id;
  update public.contact_activity set contact_id=p_keep_id where contact_id=p_duplicate_id;
  update public.crm_automation_jobs set contact_id=p_keep_id,payload=jsonb_set(coalesce(payload,'{}'::jsonb),'{contact_id}',to_jsonb(p_keep_id::text),true) where contact_id=p_duplicate_id;
  update public.crm_server_automation_jobs set context=jsonb_set(coalesce(context,'{}'::jsonb),'{contact_id}',to_jsonb(p_keep_id::text),true) where context->>'contact_id'=p_duplicate_id::text;
  update public.crm_offer_followup_events set contact_id=p_keep_id where contact_id=p_duplicate_id;
  update public.crm_offer_instances set contact_id=p_keep_id where contact_id=p_duplicate_id;
  update public.crm_offer_response_states set contact_id=p_keep_id where contact_id=p_duplicate_id;
  update public.crm_welcome_requests set contact_id=p_keep_id where contact_id=p_duplicate_id;
  update crm_private.opportunity_month_labels set contact_id=p_keep_id where contact_id=p_duplicate_id;
  update public.sales_opportunities set record_id=p_keep_id,client_name=keep_name,phone=keep_phone_text where record_id=p_duplicate_id;
  update public.whatsapp_jobs set record_id=p_keep_id,client_name=keep_name,phone=keep_phone_text where record_id=p_duplicate_id;

  update public.records set data=merged_data where id=p_keep_id;
  insert into crm_private.contact_merge_archive(duplicate_record_id,kept_record_id,duplicate_data,merged_by)
  values(p_duplicate_id,p_keep_id,duplicate_row.data,auth.uid());
  insert into public.contact_activity(contact_id,activity_type,title,description,created_by)
  values(p_keep_id,'contact_merged','Ficha duplicada unificada','Se incorporó de forma segura la ficha '+p_duplicate_id::text+' con el mismo teléfono.',auth.uid());
  delete from public.records where id=p_duplicate_id;
  return p_keep_id;
end;
$$;

revoke all on function public.crm_merge_duplicate_contact(uuid,uuid,jsonb,jsonb) from anon, public;
grant execute on function public.crm_merge_duplicate_contact(uuid,uuid,jsonb,jsonb) to authenticated;
