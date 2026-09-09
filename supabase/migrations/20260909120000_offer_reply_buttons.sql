-- Add one-click replies to new follow-up offers without changing historical jobs.
create or replace function public.crm_create_offer_execution_v6(
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
  result jsonb;
  offer_id uuid;
  configured_job uuid;
  reply_buttons jsonb:=jsonb_build_array(
    jsonb_build_object('buttonId','offer_decline','buttonText','No me interesa'),
    jsonb_build_object('buttonId','offer_accept','buttonText','Acepto'),
    jsonb_build_object('buttonId','offer_other','buttonText','Quiero mirar otra cosa')
  );
begin
  if uid is null then raise exception 'Authentication required'; end if;

  result:=public.crm_create_offer_execution_v5(
    p_contact_id,p_catalog_offer_id,p_request_key,p_selections,p_extra_text,p_mode,
    p_final_price,p_send_message,p_processing_date,p_test_mode,p_allow_duplicate
  );
  offer_id:=nullif(result->>'offer_id','')::uuid;

  if p_mode='followup' and offer_id is not null then
    update public.crm_server_automation_jobs j
    set action_config=jsonb_set(
      j.action_config,
      '{steps,0,config,reply_buttons}',
      reply_buttons,
      true
    ), updated_at=now()
    where j.user_id=uid
      and j.event_key='manual-offer:'||offer_id
      and j.action_type='flow_v1'
      and j.status='pending'
    returning j.id into configured_job;

    if configured_job is null and coalesce((result->>'idempotent_replay')::boolean,false)=false then
      raise exception 'Protección CRM: no se pudieron configurar las respuestas de la oferta';
    end if;
  end if;

  return result||jsonb_build_object(
    'reply_buttons_configured',p_mode='followup' and (configured_job is not null or coalesce((result->>'idempotent_replay')::boolean,false))
  );
end;
$$;

revoke all on function public.crm_create_offer_execution_v6(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean) from public,anon;
grant execute on function public.crm_create_offer_execution_v6(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean) to authenticated;

comment on function public.crm_create_offer_execution_v6(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean)
is 'Creates a verified offer and adds exactly three reply buttons to the initial follow-up WhatsApp job.';
