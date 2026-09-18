-- Vodafone counteroffers are tracked by their offer record and opportunity,
-- not by a contact tag. Existing historical tags are intentionally preserved.
create or replace function crm_private.offer_add_label(
  p_contact uuid,
  p_name text,
  p_category text
) returns void
language plpgsql security definer set search_path=''
as $$
declare lid uuid;
begin
  if upper(btrim(coalesce(p_name,'')))='CONTRAOFERTA VODAFONE' then
    return;
  end if;

  insert into public.crm_labels(name)
  values(p_name)
  on conflict(name) do update set name=excluded.name
  returning id into lid;

  insert into public.app_settings(key,value,updated_at)
  values('crm_label_categories_v1',jsonb_build_object(lid::text,p_category),now())
  on conflict(key) do update set
    value=(case when jsonb_typeof(public.app_settings.value)='object' then public.app_settings.value else '{}'::jsonb end)||excluded.value,
    updated_at=now();

  insert into public.crm_contact_labels(contact_id,label_id)
  values(p_contact,lid)
  on conflict(contact_id,label_id) do nothing;
end;
$$;

revoke all on function crm_private.offer_add_label(uuid,text,text) from public,anon,authenticated;
