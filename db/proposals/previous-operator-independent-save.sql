-- Saving a company is independent from installation/message preferences.
-- Keep the existing communication configuration, jobs, stage and optimistic locks unchanged.
create or replace function public.crm_set_previous_operator(p_opportunity_id uuid,p_expected_updated_at timestamptz,p_previous_operator text,p_offer_id uuid default null,p_expected_offer_updated_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.sales_opportunities%rowtype; f public.crm_offer_instances%rowtype; v text;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para editar oportunidades'; end if;
 v := pg_catalog.btrim(coalesce(p_previous_operator,''));
 if pg_catalog.length(v)>80 or v ~ '[[:cntrl:]]' then raise exception 'Indica una compañía válida (máximo 80 caracteres)'; end if;
 select * into o from public.sales_opportunities where id=p_opportunity_id for update;
 if not found then raise exception 'La oportunidad no está disponible'; end if;
 if p_expected_updated_at is null or o.updated_at is distinct from p_expected_updated_at then raise exception 'La oportunidad cambió en otro dispositivo. Reabre la ficha antes de guardar'; end if;
 if exists(select 1 from public.crm_installations where opportunity_id=o.id) then raise exception 'Cambia la compañía desde Editar instalación / devolución'; end if;
 if p_offer_id is not null then
  select * into f from public.crm_offer_instances where id=p_offer_id and opportunity_id=o.id for update;
  if not found or p_expected_offer_updated_at is null or f.updated_at is distinct from p_expected_offer_updated_at then raise exception 'La oferta cambió en otro dispositivo. Reabre la ficha antes de guardar'; end if;
 end if;
 update public.sales_opportunities set previous_operator=nullif(v,''),updated_at=pg_catalog.clock_timestamp() where id=o.id returning * into o;
 if p_offer_id is not null then
  update public.crm_offer_instances set snapshot=(case when pg_catalog.jsonb_typeof(snapshot)='object' then snapshot else '{}'::jsonb end)||pg_catalog.jsonb_build_object('previous_operator_override',v),updated_at=pg_catalog.clock_timestamp() where id=f.id returning * into f;
 end if;
 return pg_catalog.jsonb_build_object('opportunity',pg_catalog.to_jsonb(o),'offer',case when p_offer_id is not null then pg_catalog.to_jsonb(f) else null end);
end;$$;
revoke all on function public.crm_set_previous_operator(uuid,timestamptz,text,uuid,timestamptz) from public,anon;
grant execute on function public.crm_set_previous_operator(uuid,timestamptz,text,uuid,timestamptz) to authenticated;
notify pgrst,'reload schema';
