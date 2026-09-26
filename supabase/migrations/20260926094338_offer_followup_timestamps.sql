-- Display dates are independent of incidental updates to an offer.
alter table public.crm_offer_instances add column if not exists paused_at timestamptz;
alter table public.crm_offer_instances add column if not exists status_changed_at timestamptz;

create or replace function crm_private.offer_touch_updated_at()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at:=now();
    new.paused_at:=case when new.status='paused' then now() else null end;
  end if;
  -- Metadata backfill must not rewrite the business modification date.
  if (to_jsonb(new)-'paused_at'-'status_changed_at') is distinct from
     (to_jsonb(old)-'paused_at'-'status_changed_at') then new.updated_at:=now(); end if;
  return new;
end $$;
revoke all on function crm_private.offer_touch_updated_at() from public,anon,authenticated;

-- Use recorded transitions, never assume updated_at is the pause date.
with dates as (
 select i.id,max(e.created_at) as changed_at
 from public.crm_offer_instances i join public.crm_telegram_business_events e
 on e.entity_type='offer' and e.entity_id=i.id and e.payload->>'status'=i.status
 where e.event_type in ('followup_paused','followup_resumed','offer_accepted','sale_processed','sale_won','sale_lost','offer_cancelled')
 group by i.id
)
update public.crm_offer_instances i set status_changed_at=d.changed_at,
 paused_at=case when i.status='paused' then d.changed_at else null end
from dates d where i.id=d.id and i.status_changed_at is null;
notify pgrst,'reload schema';
