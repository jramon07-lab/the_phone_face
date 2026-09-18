-- A welcome-style offer uses a distinct greeting while keeping the verified
-- offer, delivery, and follow-up flow intact.
create or replace function public.crm_create_offer_execution_v8(
  p_contact_id uuid,p_catalog_offer_id uuid,p_request_key uuid,
  p_selections jsonb default '[]'::jsonb,p_extra_text text default null,
  p_mode text default 'followup',p_final_price numeric default null,
  p_send_message boolean default false,p_processing_date date default null,
  p_test_mode boolean default false,p_allow_duplicate boolean default false,
  p_send_at timestamptz default null,p_welcome boolean default false
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
  uid uuid:=auth.uid();result jsonb;offer_id uuid;prior_message text;welcome_message text;sender_name text;
begin
  result:=public.crm_create_offer_execution_v7(
    p_contact_id,p_catalog_offer_id,p_request_key,p_selections,p_extra_text,p_mode,
    p_final_price,p_send_message,p_processing_date,p_test_mode,p_allow_duplicate,p_send_at
  );
  if not coalesce(p_welcome,false) then return result; end if;
  if uid is null then raise exception 'Authentication required'; end if;
  offer_id:=nullif(result->>'offer_id','')::uuid;
  if offer_id is null then raise exception 'Protección CRM: no se pudo localizar la oferta creada'; end if;
  select message_text into prior_message from public.crm_offer_instances
    where id=offer_id and created_by=uid for update;
  if prior_message is null then raise exception 'Protección CRM: no se pudo actualizar el mensaje de bienvenida'; end if;
  select nullif(btrim(display_name),'') into sender_name
    from public.user_permissions where user_id=uid;
  sender_name:=coalesce(sender_name,'el equipo de Phone House Albolote');
  select 'Hola '||split_part(coalesce(nullif(btrim(data->>'NOMBRE Y APELLIDOS'),''),nullif(btrim(concat_ws(' ',data->>'NOMBRE',data->>'APELLIDOS')),''),'Cliente'),' ',1)||', soy '||sender_name||' de Phone House Albolote. Te envío una oferta que puede interesarte:'
    into welcome_message from public.records where id=p_contact_id;
  if welcome_message is null then raise exception 'Contacto no encontrado'; end if;
  welcome_message:=regexp_replace(prior_message,E'^Hola [^\\n]*, te envío la oferta que hemos comentado:',welcome_message);
  update public.crm_offer_instances set message_text=welcome_message where id=offer_id and created_by=uid;
  update public.crm_server_automation_jobs
    set context=jsonb_set(coalesce(context,'{}'::jsonb),'{oferta_mensaje}',to_jsonb(welcome_message),true),updated_at=now()
    where user_id=uid and context->>'offer_instance_id'=offer_id::text and action_type='flow_v1' and status='pending';
  return result||jsonb_build_object('welcome_message',true,'message',welcome_message);
end;
$$;

revoke all on function public.crm_create_offer_execution_v8(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean,timestamptz,boolean) from public,anon;
grant execute on function public.crm_create_offer_execution_v8(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean,timestamptz,boolean) to authenticated;
