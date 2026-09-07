-- Transactional safety wrapper for the protected CRM test branch.
-- The existing v3 function remains unchanged for the stable CRM.

create or replace function public.crm_create_offer_execution_v4(
  p_contact_id uuid,
  p_catalog_offer_id uuid,
  p_selections jsonb default '[]'::jsonb,
  p_extra_text text default null,
  p_mode text default 'followup',
  p_final_price numeric default null,
  p_send_message boolean default false,
  p_processing_date date default null,
  p_test_mode boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  rec public.records%rowtype;
  result jsonb;
  v_offer_id uuid;
  v_opportunity_id uuid;
  expected_event_key text;
  message_requested boolean:=p_mode='followup' or p_send_message;
  normalized_phone text;
begin
  if uid is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then
    raise exception 'No tienes permiso para crear ofertas';
  end if;

  select * into rec from public.records where id=p_contact_id;
  if not found then raise exception 'Contacto no encontrado'; end if;

  normalized_phone:=public.crm_server_normalize_phone(
    coalesce(rec.data->>'TELÉFONO',rec.data->>'TELEFONO',rec.data->>'PHONE',rec.data->>'MOVIL','')
  );

  if p_test_mode and message_requested and right(regexp_replace(coalesce(normalized_phone,''),'\\D','','g'),9)<>'695661409' then
    raise exception 'CRM DE PRUEBAS: solo se permiten envíos al 695661409';
  end if;

  result:=public.crm_create_offer_execution_v3(
    p_contact_id,p_catalog_offer_id,p_selections,p_extra_text,p_mode,
    p_final_price,p_send_message,p_processing_date
  );
  v_offer_id:=nullif(result->>'offer_id','')::uuid;
  v_opportunity_id:=nullif(result->>'opportunity_id','')::uuid;

  if v_offer_id is null or v_opportunity_id is null
     or not exists(
       select 1
       from public.crm_offer_instances i
       join public.sales_opportunities o on o.id=i.opportunity_id
       where i.id=v_offer_id
         and i.opportunity_id=v_opportunity_id
         and i.contact_id=p_contact_id
         and i.created_by=uid
         and o.record_id=p_contact_id
         and o.owner_user_id=uid
     ) then
    raise exception 'Protección CRM: no se pudo verificar la oferta y su oportunidad; no se ha guardado nada';
  end if;

  if message_requested then
    expected_event_key:=case when p_mode='followup'
      then 'manual-offer:'||v_offer_id
      else 'manual-offer-accepted:'||v_offer_id
    end;

    if not exists(
      select 1
      from public.crm_server_automation_jobs j
      where j.user_id=uid
        and j.event_key=expected_event_key
        and j.action_type='flow_v1'
        and j.context->>'offer_instance_id'=v_offer_id::text
        and j.context->>'opportunity_id'=v_opportunity_id::text
        and j.status in ('pending','running','done')
    ) then
      raise exception 'Protección CRM: no se creó el trabajo del WhatsApp inicial; no se ha guardado nada';
    end if;
  end if;

  return result||jsonb_build_object(
    'safety_verified',true,
    'test_mode',p_test_mode,
    'delivery_job_verified',message_requested
  );
end;
$$;

revoke all on function public.crm_create_offer_execution_v4(uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean) from public,anon;
grant execute on function public.crm_create_offer_execution_v4(uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean) to authenticated;

comment on function public.crm_create_offer_execution_v4(uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean)
is 'Creates an offer atomically and rolls it back unless its opportunity and requested initial WhatsApp job are verifiably present. Test mode limits sends to Ramon test phone.';
