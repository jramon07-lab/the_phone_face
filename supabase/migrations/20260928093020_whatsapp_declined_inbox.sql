alter table public.crm_offer_instances add column if not exists customer_declined_at timestamptz;
alter table public.crm_whatsapp_chat_state add column if not exists declined_archived_at timestamptz;
create or replace function crm_private.capture_customer_decline()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.action='decline' then
  update public.crm_offer_instances set customer_declined_at=new.decided_at where id=new.offer_instance_id;
 end if;
 return new;
end $$;
revoke all on function crm_private.capture_customer_decline() from public,anon,authenticated;
create trigger crm_capture_customer_decline after insert or update of action,decided_at
on public.crm_offer_response_states for each row execute function crm_private.capture_customer_decline();
update public.crm_offer_instances o set customer_declined_at=r.decided_at
from public.crm_offer_response_states r where r.offer_instance_id=o.id and r.action='decline'
and o.customer_declined_at is distinct from r.decided_at;
