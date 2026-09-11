-- Keep the offer instance aligned with the explicit customer decision. The
-- existing Telegram trigger emits the accepted event, and suppresses duplicate
-- generic lost events for decline/alternative response states.
create or replace function crm_private.offer_set_response_status()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.crm_offer_instances
  set status=case when new.action='accept' then 'accepted' else 'lost' end,
      accepted_at=case when new.action='accept' then new.decided_at else accepted_at end,
      updated_at=now()
  where id=new.offer_instance_id;
  return new;
end
$$;
revoke all on function crm_private.offer_set_response_status() from public,anon,authenticated;

drop trigger if exists crm_offer_response_instance_status on public.crm_offer_response_states;
create trigger crm_offer_response_instance_status
after insert on public.crm_offer_response_states
for each row execute function crm_private.offer_set_response_status();

notify pgrst,'reload schema';
