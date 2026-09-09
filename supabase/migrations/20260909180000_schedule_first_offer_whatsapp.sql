-- Allow the test CRM to delay the root offer flow. Stable clients keep calling v6.
create or replace function public.crm_create_offer_execution_v7(
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
  p_allow_duplicate boolean default false,
  p_send_at timestamptz default null
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  result jsonb;
  offer_id uuid;
  requested_at timestamptz;
  scheduled_job uuid;
  replay boolean;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_mode<>'followup' and p_send_at is not null then
    raise exception 'La programación solo está disponible para ofertas con seguimiento';
  end if;
  if p_send_at is not null and p_send_at<now()+interval '1 minute' then
    raise exception 'La hora programada debe dejar al menos un minuto de margen';
  end if;
  if p_send_at is not null and p_send_at>now()+interval '90 days' then
    raise exception 'La oferta no puede programarse con más de 90 días de antelación';
  end if;

  result:=public.crm_create_offer_execution_v6(
    p_contact_id,p_catalog_offer_id,p_request_key,p_selections,p_extra_text,p_mode,
    p_final_price,p_send_message,p_processing_date,p_test_mode,p_allow_duplicate
  );
  offer_id:=nullif(result->>'offer_id','')::uuid;
  replay:=coalesce((result->>'idempotent_replay')::boolean,false);
  requested_at:=coalesce(p_send_at,now());

  if p_mode='followup' and p_send_at is not null and not replay then
    update public.crm_server_automation_jobs j
    set run_at=requested_at,
        context=jsonb_set(j.context,'{event_at}',to_jsonb(requested_at),true),
        updated_at=now()
    where j.user_id=uid
      and j.event_key='manual-offer:'||offer_id
      and j.action_type='flow_v1'
      and j.status='pending'
    returning j.id into scheduled_job;

    if scheduled_job is null then
      raise exception 'Protección CRM: no se pudo programar el primer WhatsApp; no se ha guardado nada';
    end if;

    update public.crm_offer_instances i
    set snapshot=jsonb_set(coalesce(i.snapshot,'{}'::jsonb),'{scheduled_send_at}',to_jsonb(requested_at),true)
    where i.id=offer_id and i.created_by=uid;
  elsif p_mode='followup' and p_send_at is not null and replay then
    select j.id,j.run_at into scheduled_job,requested_at
    from public.crm_server_automation_jobs j
    where j.user_id=uid
      and j.event_key='manual-offer:'||offer_id
      and j.action_type='flow_v1'
    order by j.created_at
    limit 1;
  end if;

  return result||jsonb_build_object(
    'scheduled_send',p_mode='followup' and p_send_at is not null,
    'scheduled_for',case when p_mode='followup' then requested_at else null end,
    'scheduled_send_verified',p_mode<>'followup' or p_send_at is null or scheduled_job is not null
  );
end;
$$;

revoke all on function public.crm_create_offer_execution_v7(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean,timestamptz) from public,anon;
grant execute on function public.crm_create_offer_execution_v7(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean,timestamptz) to authenticated;

comment on function public.crm_create_offer_execution_v7(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean,timestamptz)
is 'Creates a verified offer and optionally delays its root flow so the initial WhatsApp and the day-2/day-5 waits share the real send origin.';
