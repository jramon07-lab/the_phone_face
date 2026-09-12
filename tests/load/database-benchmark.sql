-- SQL execution only, as database owner. Does not measure HTTP, network or user RLS.
-- Run against isolated project yebjacgqrycxcvpewmzq, twice concurrently.
do $bench$
declare t timestamptz; timings jsonb:='[]'; cid uuid; v jsonb;
begin
 select id into cid from public.records where source_row=1 and data->>'NOMBRE'='PERF_20260912';
 for n in 1..12 loop
  t:=clock_timestamp();perform public.sales_board();
  timings:=timings||jsonb_build_object('query','sales_board','iteration',n,'ms',extract(epoch from clock_timestamp()-t)*1000);
  t:=clock_timestamp();perform * from public.search_records('Cliente 3999','BASE DE DATOS',100);
  timings:=timings||jsonb_build_object('query','search_records','iteration',n,'ms',extract(epoch from clock_timestamp()-t)*1000);
  t:=clock_timestamp();perform public.contact_related_items(cid);
  timings:=timings||jsonb_build_object('query','contact_related_items','iteration',n,'ms',extract(epoch from clock_timestamp()-t)*1000);
  t:=clock_timestamp();perform * from public.agenda_items where (whatsapp_enabled is null or whatsapp_enabled=false) and status='pending' order by starts_at limit 300;
  perform id,status,starts_at from public.agenda_items where whatsapp_enabled is null or whatsapp_enabled=false limit 1000;
  timings:=timings||jsonb_build_object('query','agenda_list_and_counts','iteration',n,'ms',extract(epoch from clock_timestamp()-t)*1000);
 end loop;
 perform set_config('crm_load.timings',timings::text,true);
end;$bench$;
select current_setting('crm_load.timings')::jsonb as timings;
