-- Offers that are due now use the same immediate runner hand-off as a
-- welcome.  The minute cron remains the safe fallback if that hand-off is
-- unavailable, so this never creates a second send.
create or replace function public.crm_create_offer_execution_v10(
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
  result jsonb;
begin
  result:=public.crm_create_offer_execution_v9(
    p_contact_id,p_catalog_offer_id,p_request_key,p_selections,p_extra_text,p_mode,
    p_final_price,p_send_message,p_processing_date,p_test_mode,p_allow_duplicate,
    p_send_at,p_welcome,p_recipient_contact_id
  );

  -- Scheduled offers remain scheduled.  Only an offer intended for now asks
  -- the runner to start immediately; the durable pending job is its fallback.
  if coalesce(p_send_message,false)
     and (p_send_at is null or p_send_at <= now()) then
    perform crm_private.dispatch_runner_now();
  end if;

  return result;
end;
$$;

revoke all on function public.crm_create_offer_execution_v10(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean,timestamptz,boolean,uuid) from public,anon;
grant execute on function public.crm_create_offer_execution_v10(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean,timestamptz,boolean,uuid) to authenticated;
