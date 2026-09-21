-- A Vodafone counteroffer is marked only when its opportunity reaches Tramitado.
-- The normal OFERTA/VENTAS monthly labels remain managed by the existing lifecycle.
create or replace function crm_private.offer_stage_state()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare
  inst public.crm_offer_instances%rowtype;
  stage_name text;
  v_counteroffer_label_id uuid;
begin
  if new.stage_id is not distinct from old.stage_id then return new; end if;
  select * into inst from public.crm_offer_instances where opportunity_id=new.id;
  if not found then return new; end if;
  select lower(btrim(name)) into stage_name from public.sales_stages where id=new.stage_id;

  if stage_name='pendiente de tramitar' then
    update public.crm_offer_instances
    set status='accepted',accepted_at=coalesce(accepted_at,now())
    where id=inst.id;
  elsif stage_name='tramitado' then
    update public.crm_offer_instances
    set status='processed',processed_at=coalesce(processed_at,now())
    where id=inst.id;
    perform crm_private.offer_record_sale(inst,now());

    if inst.operator='Vodafone'
       and coalesce((inst.snapshot->>'is_counteroffer')::boolean,false) then
      insert into public.crm_labels(name)
      values('CONTRAOFERTA VODAFONE')
      on conflict(name) do update set name=excluded.name
      returning id into v_counteroffer_label_id;

      insert into public.app_settings(key,value,updated_at)
      values('crm_label_categories_v1',jsonb_build_object(v_counteroffer_label_id::text,'Contraofertas'),now())
      on conflict(key) do update set
        value=(case when jsonb_typeof(public.app_settings.value)='object' then public.app_settings.value else '{}'::jsonb end)||excluded.value,
        updated_at=now();

      insert into public.crm_contact_labels(contact_id,label_id)
      values(inst.contact_id,v_counteroffer_label_id)
      on conflict(contact_id,label_id) do nothing;
    end if;
  elsif stage_name='ganado' then
    update public.crm_offer_instances set status='won' where id=inst.id;
  elsif stage_name='perdido' then
    update public.crm_offer_instances set status='lost' where id=inst.id;
  elsif stage_name='archivo' then
    update public.crm_offer_instances set status='archived' where id=inst.id;
  end if;
  return new;
end;
$$;

revoke all on function crm_private.offer_stage_state() from public,anon,authenticated;

