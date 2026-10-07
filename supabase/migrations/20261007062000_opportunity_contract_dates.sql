-- Optional contract dates. Existing opportunities are not backfilled or rescheduled.
alter table public.sales_opportunities
 add column if not exists terminal_commitment_end date,
 add column if not exists discount_end_date date,
 add column if not exists previous_operator text;
comment on column public.sales_opportunities.terminal_commitment_end is 'Fin de permanencia del terminal; independiente de la instalación y de la permanencia de fibra.';
comment on column public.sales_opportunities.discount_end_date is 'Fin de descuento de esta oportunidad.';
comment on column public.sales_opportunities.previous_operator is 'Operador anterior indicado por el usuario. La instalación registrada conserva su propio operador anterior.';

create or replace function public.crm_create_opportunity_guarded_v3(
 p_pipeline_id uuid, p_stage_id uuid, p_record_id uuid, p_title text,
 p_client_name text default null, p_phone text default null, p_amount numeric default null,
 p_expected_date date default null, p_notes text default null, p_contract_party jsonb default null,
 p_allow_duplicate boolean default false, p_after_sale jsonb default null,
 p_terminal_commitment_end date default null, p_discount_end_date date default null,
 p_previous_operator text default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 -- v2 performs the existing permission, party and duplicate checks. All writes
 -- belong to the same transaction and remain subject to the table's RLS.
 result:=public.crm_create_opportunity_guarded_v2(p_pipeline_id,p_stage_id,p_record_id,p_title,
 p_client_name,p_phone,p_amount,p_expected_date,p_notes,p_contract_party,p_allow_duplicate,p_after_sale);
 update public.sales_opportunities set terminal_commitment_end=p_terminal_commitment_end,
 discount_end_date=p_discount_end_date,previous_operator=nullif(btrim(p_previous_operator),'')
 where id=result;
 if not found then raise exception 'No se pudieron guardar las fechas de la oportunidad.'; end if;
 return result;
end;
$$;
revoke all on function public.crm_create_opportunity_guarded_v3(uuid,uuid,uuid,text,text,text,numeric,date,text,jsonb,boolean,jsonb,date,date,text) from public,anon;
grant execute on function public.crm_create_opportunity_guarded_v3(uuid,uuid,uuid,text,text,text,numeric,date,text,jsonb,boolean,jsonb,date,date,text) to authenticated;
notify pgrst,'reload schema';
