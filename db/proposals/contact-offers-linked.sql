create or replace function public.crm_contact_offer_ids(p_contact_id uuid)
returns table(id uuid) language sql stable security invoker set search_path='' as $$
 select i.id from public.crm_offer_instances i
 where i.contact_id=p_contact_id
 or i.snapshot->>'recipient_contact_id'=p_contact_id::text
 or exists(select 1 from public.sales_opportunities o where o.id=i.opportunity_id and (
 o.record_id=p_contact_id or o.contract_party->>'manager_record_id'=p_contact_id::text
 or o.contract_party->>'holder_record_id'=p_contact_id::text
 or o.contract_party->>'recipient_contact_id'=p_contact_id::text))
 or exists(select 1 from public.records r cross join lateral jsonb_array_elements(
 case when jsonb_typeof(r.data#>'{TPF_RELACIONES,managed_contacts}')='array'
 then r.data#>'{TPF_RELACIONES,managed_contacts}' else '[]'::jsonb end) link
 where r.id=p_contact_id and link->>'record_id'=i.contact_id::text);
$$;
revoke all on function public.crm_contact_offer_ids(uuid) from public,anon;
grant execute on function public.crm_contact_offer_ids(uuid) to authenticated,service_role;
