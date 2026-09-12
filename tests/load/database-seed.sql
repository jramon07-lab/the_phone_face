-- ONLY yebjacgqrycxcvpewmzq. Empty isolated branch; no real phones or users.
do $load$
declare pipeline uuid;
begin
  if exists(select 1 from auth.users) or exists(select 1 from cron.job where active)
     or exists(select 1 from public.crm_automations where enabled)
     or exists(select 1 from public.records) or exists(select 1 from public.sales_opportunities)
     or (select count(*) from public.agenda_items)>2
     or exists(select 1 from public.agenda_items where title not in ('Prueba WhatsApp segundo plano','TEST automatizacion backend OK') or notify_email or sync_google_calendar or (whatsapp_enabled and status<>'completed')) then
    raise exception 'Load seed requires isolated data, no users, crons or enabled automations';
  end if;
  insert into public.sales_pipelines(name) values('PERF_20260912 Pipeline') returning id into pipeline;
  insert into public.sales_stages(pipeline_id,name,position)
  select pipeline,name,ordinality-1 from unnest(array['Próximo','Seguimiento','Pendiente de tramitar','Tramitado','Ganado','Perdido','Antiguos']) with ordinality as s(name,ordinality);
  insert into public.records(source_sheet,source_row,data)
  select 'BASE DE DATOS',n,jsonb_build_object('NOMBRE','PERF_20260912','APELLIDOS','Cliente '||lpad(n::text,4,'0'),'NOMBRE Y APELLIDOS','PERF_20260912 Cliente '||lpad(n::text,4,'0'),'APODO','Prueba '||n,'TELÉFONO','','EMAIL','','NOTAS',repeat('Datos ficticios de capacidad. ',6)) from generate_series(1,4000) n;
  insert into public.sales_opportunities(pipeline_id,stage_id,record_id,title,client_name,amount,expected_date,position,notes)
  select pipeline,s.id,r.id,'PERF_20260912 Oferta '||n,'PERF_20260912 Cliente '||r.source_row,(n%100)+0.95,current_date+(n%120)-30,n,repeat('Oferta ficticia sin envíos. ',8)
  from generate_series(1,1200) n
  join public.records r on r.source_row=1+((n-1)%300)
  join public.sales_stages s on s.pipeline_id=pipeline and s.position=(n-1)%7;
  insert into public.agenda_items(title,customer_name,starts_at,status,related_record_id,notify_in_app,notify_email,whatsapp_enabled,sync_google_calendar)
  select 'PERF_20260912 Tarea '||n,'PERF_20260912 Cliente '||r.source_row,current_date+((n%60)-20)*interval '1 day',case when n%5=0 then 'completed' else 'pending' end,r.id,false,false,false,false
  from generate_series(1,600) n join public.records r on r.source_row=1+((n-1)%300);
end;
$load$;
select (select count(*) from public.records) as records,(select count(*) from public.sales_opportunities) as opportunities,(select count(*) from public.agenda_items) as agenda,(select count(*) from cron.job where active) as active_crons;
