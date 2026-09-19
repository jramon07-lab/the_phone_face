-- Accepted offers must never leave their linked opportunity in Seguimiento.
-- The offer card can be accepted by different paths; this trigger is the final
-- database guard that keeps the real sales opportunity aligned.
create or replace function crm_private.offer_set_response_status()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  opp public.sales_opportunities%rowtype;
  current_stage text;
  pending_stage public.sales_stages%rowtype;
begin
  update public.crm_offer_instances
  set status=case when new.action='accept' then 'accepted' else 'lost' end,
      accepted_at=case when new.action='accept' then new.decided_at else accepted_at end,
      updated_at=now()
  where id=new.offer_instance_id;

  if new.action='accept' then
    select * into opp
    from public.sales_opportunities
    where id=new.opportunity_id
    for update;

    if found then
      select lower(btrim(name)) into current_stage
      from public.sales_stages
      where id=opp.stage_id;

      if current_stage in ('seguimiento','oferta pasada') then
        select * into pending_stage
        from public.sales_stages
        where active
          and pipeline_id=opp.pipeline_id
          and lower(btrim(name))='pendiente de tramitar'
        order by position
        limit 1;

        if pending_stage.id is null then
          raise exception 'Falta la columna Pendiente de tramitar';
        end if;

        update public.sales_opportunities
        set stage_id=pending_stage.id,
            expected_date=coalesce(opp.expected_date,(new.decided_at at time zone 'Europe/Madrid')::date),
            status='open',
            position=0,
            updated_at=now()
        where id=opp.id;
      end if;
    end if;
  end if;

  return new;
end
$$;

revoke all on function crm_private.offer_set_response_status() from public,anon,authenticated;

-- Repair accepted offers already left behind in Seguimiento.
with stuck as (
  select
    o.id as opportunity_id,
    o.expected_date,
    coalesce(i.accepted_at,i.updated_at,i.created_at) as accepted_at,
    pending.id as pending_stage_id
  from public.crm_offer_instances i
  join public.sales_opportunities o on o.id=i.opportunity_id
  join public.sales_stages current_stage on current_stage.id=o.stage_id
  join public.sales_stages pending on pending.pipeline_id=o.pipeline_id
    and pending.active
    and lower(btrim(pending.name))='pendiente de tramitar'
  where i.status='accepted'
    and lower(btrim(current_stage.name)) in ('seguimiento','oferta pasada')
)
update public.sales_opportunities o
set stage_id=stuck.pending_stage_id,
    expected_date=coalesce(stuck.expected_date,(stuck.accepted_at at time zone 'Europe/Madrid')::date),
    status='open',
    position=0,
    updated_at=now()
from stuck
where o.id=stuck.opportunity_id;

notify pgrst,'reload schema';
