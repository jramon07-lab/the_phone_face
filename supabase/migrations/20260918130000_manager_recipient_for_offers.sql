-- The profile that owns an offer and the WhatsApp recipient can differ when a
-- related contact is managed by another person.  Keep the offer on its own
-- profile, but freeze the verified manager as the delivery recipient.
create or replace function public.crm_create_offer_execution_v9(
  p_contact_id uuid,p_catalog_offer_id uuid,p_request_key uuid,
  p_selections jsonb default '[]'::jsonb,p_extra_text text default null,
  p_mode text default 'followup',p_final_price numeric default null,
  p_send_message boolean default false,p_processing_date date default null,
  p_test_mode boolean default false,p_allow_duplicate boolean default false,
  p_send_at timestamptz default null,p_welcome boolean default false,
  p_recipient_contact_id uuid default null
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  result jsonb;
  offer_id uuid;
  recipient public.records%rowtype;
  recipient_id uuid:=coalesce(p_recipient_contact_id,p_contact_id);
  recipient_name text;
  recipient_first_name text;
  recipient_phone text;
  message text;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select * into recipient from public.records where id=recipient_id;
  if not found then raise exception 'El destinatario de la oferta no existe'; end if;

  -- A different recipient is allowed only when that record explicitly manages
  -- this profile.  The browser never supplies a phone number to the server.
  if recipient_id is distinct from p_contact_id and not exists(
    select 1 from public.records manager
    where manager.id=recipient_id
      and manager.data @> jsonb_build_object(
        'TPF_RELACIONES',jsonb_build_object(
          'managed_contacts',jsonb_build_array(jsonb_build_object('record_id',p_contact_id::text))
        )
      )
  ) then
    raise exception 'El destinatario no gestiona este contacto';
  end if;

  recipient_name:=coalesce(
    nullif(btrim(recipient.data->>'NOMBRE Y APELLIDOS'),''),
    nullif(btrim(concat_ws(' ',recipient.data->>'NOMBRE',recipient.data->>'APELLIDOS')),''),
    'Cliente'
  );
  recipient_first_name:=split_part(recipient_name,' ',1);
  recipient_phone:=public.crm_server_normalize_phone(coalesce(
    recipient.data->>'TELÉFONO',recipient.data->>'TELEFONO',recipient.data->>'PHONE',recipient.data->>'MOVIL',''
  ));
  if (p_mode='followup' or p_send_message) and (recipient_phone is null or length(recipient_phone)<8) then
    raise exception 'El destinatario no tiene un teléfono válido';
  end if;

  result:=public.crm_create_offer_execution_v8(
    p_contact_id,p_catalog_offer_id,p_request_key,p_selections,p_extra_text,p_mode,
    p_final_price,p_send_message,p_processing_date,p_test_mode,p_allow_duplicate,p_send_at,p_welcome
  );
  offer_id:=nullif(result->>'offer_id','')::uuid;
  if offer_id is null then raise exception 'Protección CRM: no se pudo localizar la oferta creada'; end if;

  select message_text into message from public.crm_offer_instances
    where id=offer_id and created_by=uid for update;
  if message is null then raise exception 'Protección CRM: no se pudo preparar el mensaje de la oferta'; end if;
  message:=regexp_replace(message,E'^Hola [^,\\n]+', 'Hola '||recipient_first_name);

  update public.crm_offer_instances
  set message_text=message,
      snapshot=coalesce(snapshot,'{}'::jsonb)||jsonb_build_object(
        'recipient_contact_id',recipient_id,
        'recipient_name',recipient_name,
        'recipient_phone',recipient_phone
      ),
      updated_at=now()
  where id=offer_id and created_by=uid;

  -- This update is in the same transaction as the creation above.  The runner
  -- cannot claim the root flow until the recipient context has been frozen.
  update public.crm_server_automation_jobs
  set context=coalesce(context,'{}'::jsonb)||jsonb_build_object(
        'phone',recipient_phone,
        'name',recipient_first_name,
        'recipient_contact_id',recipient_id,
        'recipient_name',recipient_name,
        'oferta_mensaje',message
      ),
      updated_at=now()
  where user_id=uid
    and context->>'offer_instance_id'=offer_id::text
    and status='pending';

  return result||jsonb_build_object(
    'recipient_contact_id',recipient_id,
    'recipient_name',recipient_name,
    'recipient_phone',recipient_phone,
    'message',message
  );
end;
$$;

revoke all on function public.crm_create_offer_execution_v9(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean,timestamptz,boolean,uuid) from public,anon;
grant execute on function public.crm_create_offer_execution_v9(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean,timestamptz,boolean,uuid) to authenticated;
