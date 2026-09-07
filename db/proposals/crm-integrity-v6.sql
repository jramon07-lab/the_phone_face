-- CRM test hardening: idempotent offer creation, duplicate guards and delivery status.
-- Stable clients keep using v3/v4; the protected test client uses v5.

alter table public.crm_offer_instances
  add column if not exists request_key uuid;

create unique index if not exists crm_offer_instances_request_key_uidx
  on public.crm_offer_instances(created_by, request_key)
  where request_key is not null;

create or replace function public.crm_create_contact_guarded(
  p_data jsonb,
  p_labels uuid[] default '{}'::uuid[],
  p_welcome boolean default false,
  p_variant text default 'general',
  p_allow_duplicate boolean default false
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  duplicate_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select r.id into duplicate_id
  from public.find_possible_duplicate_contact(
    coalesce(p_data->>'TELÉFONO',p_data->>'TELEFONO',p_data->>'PHONE',''),
    coalesce(p_data->>'DNI / NIF',p_data->>'DNI',p_data->>'NIF',''),
    coalesce(p_data->>'EMAIL',p_data->>'E-MAIL',p_data->>'CORREO','')
  ) r
  limit 1;

  if duplicate_id is not null and not p_allow_duplicate then
    raise exception 'DUPLICATE_CONTACT:%', duplicate_id;
  end if;

  return public.crm_create_contact_with_welcome_variant(
    p_data,coalesce(p_labels,'{}'::uuid[]),coalesce(p_welcome,false),coalesce(p_variant,'general')
  );
end;
$$;

revoke all on function public.crm_create_contact_guarded(jsonb,uuid[],boolean,text,boolean) from public,anon;
grant execute on function public.crm_create_contact_guarded(jsonb,uuid[],boolean,text,boolean) to authenticated;

create or replace function public.crm_create_opportunity_guarded(
  p_pipeline_id uuid,
  p_stage_id uuid,
  p_record_id uuid,
  p_title text,
  p_client_name text default null,
  p_phone text default null,
  p_amount numeric default null,
  p_expected_date date default null,
  p_notes text default null,
  p_contract_party jsonb default null,
  p_allow_duplicate boolean default false
) returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  duplicate_id uuid;
  created_id uuid;
  normalized_phone text:=right(regexp_replace(coalesce(p_phone,''),'\D','','g'),9);
begin
  if uid is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then
    raise exception 'No tienes permiso para crear oportunidades';
  end if;
  if nullif(btrim(coalesce(p_title,'')),'') is null then raise exception 'Escribe el título de la oportunidad'; end if;
  if not exists(select 1 from public.sales_stages s where s.id=p_stage_id and s.pipeline_id=p_pipeline_id) then
    raise exception 'La columna seleccionada ya no existe';
  end if;

  select o.id into duplicate_id
  from public.sales_opportunities o
  where o.status='open'
    and lower(btrim(o.title))=lower(btrim(p_title))
    and (
      (p_record_id is not null and o.record_id=p_record_id)
      or (p_record_id is null and normalized_phone<>'' and right(regexp_replace(coalesce(o.phone,''),'\D','','g'),9)=normalized_phone)
    )
  order by o.created_at desc
  limit 1;

  if duplicate_id is not null and not p_allow_duplicate then
    raise exception 'DUPLICATE_OPPORTUNITY:%', duplicate_id;
  end if;

  insert into public.sales_opportunities(
    pipeline_id,stage_id,record_id,title,client_name,phone,amount,expected_date,owner_user_id,notes,contract_party
  ) values(
    p_pipeline_id,p_stage_id,p_record_id,btrim(p_title),nullif(btrim(coalesce(p_client_name,'')),''),
    nullif(btrim(coalesce(p_phone,'')),''),p_amount,p_expected_date,uid,nullif(btrim(coalesce(p_notes,'')),''),p_contract_party
  ) returning id into created_id;
  return created_id;
end;
$$;

revoke all on function public.crm_create_opportunity_guarded(uuid,uuid,uuid,text,text,text,numeric,date,text,jsonb,boolean) from public,anon;
grant execute on function public.crm_create_opportunity_guarded(uuid,uuid,uuid,text,text,text,numeric,date,text,jsonb,boolean) to authenticated;

create or replace function public.crm_create_offer_execution_v5(
  p_contact_id uuid,
  p_catalog_offer_id uuid,
  p_request_key uuid,
  p_selections jsonb default '[]'::jsonb,
  p_extra_text text default null,
  p_mode text default 'followup',
  p_final_price numeric default null,
  p_send_message boolean default false,
  p_processing_date date default null,
  p_test_mode boolean default false,
  p_allow_duplicate boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  existing public.crm_offer_instances%rowtype;
  duplicate_offer public.crm_offer_instances%rowtype;
  result jsonb;
  offer_id uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_request_key is null then raise exception 'Falta la clave segura de la operación'; end if;

  select * into existing
  from public.crm_offer_instances i
  where i.created_by=uid and i.request_key=p_request_key;
  if found then
    return jsonb_build_object(
      'offer_id',existing.id,'opportunity_id',existing.opportunity_id,
      'safety_verified',true,'delivery_job_verified',
      exists(select 1 from public.crm_server_automation_jobs j where j.user_id=uid and j.context->>'offer_instance_id'=existing.id::text),
      'idempotent_replay',true,'duplicate_prevented',true,'test_mode',p_test_mode
    );
  end if;

  select * into duplicate_offer
  from public.crm_offer_instances i
  where i.created_by=uid
    and i.contact_id=p_contact_id
    and i.catalog_offer_id=p_catalog_offer_id
    and i.status in ('queued','following','paused','accepted','processed')
    and i.created_at>now()-interval '24 hours'
  order by i.created_at desc
  limit 1;
  if found and not p_allow_duplicate then
    raise exception 'DUPLICATE_OFFER:%', duplicate_offer.id;
  end if;

  begin
    result:=public.crm_create_offer_execution_v4(
      p_contact_id,p_catalog_offer_id,p_selections,p_extra_text,p_mode,
      p_final_price,p_send_message,p_processing_date,p_test_mode
    );
    offer_id:=nullif(result->>'offer_id','')::uuid;
    update public.crm_offer_instances set request_key=p_request_key where id=offer_id and created_by=uid;
  exception when unique_violation then
    select * into existing from public.crm_offer_instances i where i.created_by=uid and i.request_key=p_request_key;
    if not found then raise; end if;
    return jsonb_build_object(
      'offer_id',existing.id,'opportunity_id',existing.opportunity_id,
      'safety_verified',true,'delivery_job_verified',
      exists(select 1 from public.crm_server_automation_jobs j where j.user_id=uid and j.context->>'offer_instance_id'=existing.id::text),
      'idempotent_replay',true,'duplicate_prevented',true,'test_mode',p_test_mode
    );
  end;

  return result||jsonb_build_object(
    'idempotent_replay',false,'duplicate_prevented',false,'request_key',p_request_key
  );
end;
$$;

revoke all on function public.crm_create_offer_execution_v5(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean) from public,anon;
grant execute on function public.crm_create_offer_execution_v5(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean) to authenticated;

create or replace function public.crm_offer_delivery_status(p_offer_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  inst public.crm_offer_instances%rowtype;
  opp public.sales_opportunities%rowtype;
  stage_name text;
  root_count integer:=0;
  initial_count integer:=0;
  initial_done integer:=0;
  initial_failed integer:=0;
  pending_count integer:=0;
  failed_count integer:=0;
  last_error text;
  delivery text;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into inst from public.crm_offer_instances where id=p_offer_id;
  if not found then raise exception 'Oferta no encontrada'; end if;
  select * into opp from public.sales_opportunities where id=inst.opportunity_id;
  select s.name into stage_name from public.sales_stages s where s.id=opp.stage_id;

  select
    count(*) filter(where j.action_type='flow_v1' and (j.event_key='manual-offer:'||inst.id or j.event_key='manual-offer-accepted:'||inst.id)),
    count(*) filter(where j.action_type='__send_whatsapp' and coalesce(j.action_config->>'offer_phase','') in ('initial','accepted','direct_sale')),
    count(*) filter(where j.action_type='__send_whatsapp' and coalesce(j.action_config->>'offer_phase','') in ('initial','accepted','direct_sale') and j.status='done'),
    count(*) filter(where j.action_type='__send_whatsapp' and coalesce(j.action_config->>'offer_phase','') in ('initial','accepted','direct_sale') and j.status='failed'),
    count(*) filter(where j.status in ('pending','running')),
    count(*) filter(where j.status='failed'),
    (array_agg(j.error_message order by j.updated_at desc) filter(where j.error_message is not null))[1]
  into root_count,initial_count,initial_done,initial_failed,pending_count,failed_count,last_error
  from public.crm_server_automation_jobs j
  where j.user_id=uid and j.context->>'offer_instance_id'=inst.id::text;

  delivery:=case
    when inst.sent_at is not null and initial_done>0 then 'sent'
    when initial_failed>0 or (failed_count>0 and inst.sent_at is null) then 'failed'
    when initial_count>0 or root_count>0 then 'queued'
    else 'not_requested'
  end;

  return jsonb_build_object(
    'offer_id',inst.id,'offer_exists',true,
    'opportunity_exists',opp.id is not null,'opportunity_id',opp.id,
    'opportunity_title',opp.title,'opportunity_stage',stage_name,
    'delivery',delivery,'sent_at',inst.sent_at,
    'root_job_count',root_count,'initial_job_count',initial_count,
    'pending_job_count',pending_count,'failed_job_count',failed_count,
    'last_error',last_error,
    'integrity_ok',(opp.id is not null and (delivery='not_requested' or root_count=1 or initial_done=1) and failed_count=0),
    'duplicate_jobs',(root_count>1 or initial_done>1)
  );
end;
$$;

revoke all on function public.crm_offer_delivery_status(uuid) from public,anon;
grant execute on function public.crm_offer_delivery_status(uuid) to authenticated;
