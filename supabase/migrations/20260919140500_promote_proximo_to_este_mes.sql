create or replace function crm_private.promote_due_proximo_opportunities()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_madrid_today date := (now() at time zone 'Europe/Madrid')::date;
  v_next_month date := (date_trunc('month', (now() at time zone 'Europe/Madrid')) + interval '1 month')::date;
  v_count integer := 0;
begin
  with stage_pairs as (
    select
      p.id as pipeline_id,
      proximo.id as proximo_stage_id,
      este_mes.id as este_mes_stage_id
    from public.sales_pipelines p
    join public.sales_stages proximo
      on proximo.pipeline_id = p.id
     and proximo.active
     and lower(translate(btrim(proximo.name), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) = 'proximo'
    join public.sales_stages este_mes
      on este_mes.pipeline_id = p.id
     and este_mes.active
     and lower(translate(btrim(este_mes.name), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) = 'este mes'
  ),
  moved as (
    update public.sales_opportunities o
    set stage_id = sp.este_mes_stage_id,
        updated_at = now()
    from stage_pairs sp
    where o.pipeline_id = sp.pipeline_id
      and o.stage_id = sp.proximo_stage_id
      and o.expected_date is not null
      and o.expected_date < v_next_month
      and coalesce(lower(o.status), 'open') not in ('won','lost','closed','ganado','perdido','cerrado','cerrada')
    returning o.id
  )
  select count(*) into v_count from moved;

  return v_count;
end;
$$;

revoke all on function crm_private.promote_due_proximo_opportunities() from public;
revoke all on function crm_private.promote_due_proximo_opportunities() from anon;
revoke all on function crm_private.promote_due_proximo_opportunities() from authenticated;

select cron.schedule(
  'crm-promote-proximo-to-este-mes',
  '15 0 * * *',
  $$select crm_private.promote_due_proximo_opportunities();$$
)
where not exists (
  select 1 from cron.job where jobname = 'crm-promote-proximo-to-este-mes'
);
