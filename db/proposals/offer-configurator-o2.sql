-- Catálogo O2 aprobado. No crea oportunidades, trabajos ni mensajes retroactivos.
do $$
declare plan record;v_offer_id uuid;
begin
  for plan in
    select * from (values
      ('O2 · 600 + 60 GB',35::numeric,600,'["Fibra 600 Mb","1 línea de 60 GB"]'::jsonb,10),
      ('O2 · 600 + 10 GB + 40 GB',35::numeric,600,'["Fibra 600 Mb","1 línea de 10 GB","1 línea de 40 GB"]'::jsonb,20),
      ('O2 · 1 GB + 120 GB',38::numeric,1000,'["Fibra 1 Gb","1 línea de 120 GB"]'::jsonb,30),
      ('O2 TV · 600 + 35 GB',38::numeric,600,'["Fibra 600 Mb","1 línea de 35 GB","Movistar Plus+ incluido"]'::jsonb,110),
      ('O2 TV · 600 + 60 GB + DISNEY+',45::numeric,600,'["Fibra 600 Mb","1 línea de 60 GB","Movistar Plus+ incluido","Disney+ incluido"]'::jsonb,120),
      ('O2 TV · 600 + 60 GB + NETFLIX',47::numeric,600,'["Fibra 600 Mb","1 línea de 60 GB","Movistar Plus+ incluido","Netflix incluido"]'::jsonb,130),
      ('O2 TV · 1 GB + 350 GB',50::numeric,1000,'["Fibra 1 Gb","1 línea de 350 GB","Movistar Plus+ incluido"]'::jsonb,140),
      ('O2 TV · 600 + 60 GB + NETFLIX + DISNEY+',52::numeric,600,'["Fibra 600 Mb","1 línea de 60 GB","Movistar Plus+ incluido","Netflix incluido","Disney+ incluido"]'::jsonb,150),
      ('O2 TV · 1 GB + 375 GB + DISNEY+',56::numeric,1000,'["Fibra 1 Gb","1 línea de 375 GB","Movistar Plus+ incluido","Disney+ incluido"]'::jsonb,160),
      ('O2 TV · 1 GB + 375 GB + NETFLIX',58::numeric,1000,'["Fibra 1 Gb","1 línea de 375 GB","Movistar Plus+ incluido","Netflix incluido"]'::jsonb,170),
      ('O2 TV · 1 GB + 375 GB + NETFLIX + DISNEY+',62::numeric,1000,'["Fibra 1 Gb","1 línea de 375 GB","Movistar Plus+ incluido","Netflix incluido","Disney+ incluido"]'::jsonb,180)
    ) as p(name,price,fiber,features,position)
  loop
    select id into v_offer_id from public.crm_offer_catalog where operator='O2' and name=plan.name order by created_at limit 1;
    if v_offer_id is null then
      insert into public.crm_offer_catalog(operator,name,fiber_mbps,included_unlimited_lines,base_price,base_features,is_counteroffer,active,position)
      values('O2',plan.name,plan.fiber,0,plan.price,plan.features,false,true,plan.position) returning id into v_offer_id;
    else
      update public.crm_offer_catalog set fiber_mbps=plan.fiber,included_unlimited_lines=0,base_price=plan.price,
       base_features=plan.features,is_counteroffer=false,active=true,position=plan.position where id=v_offer_id;
    end if;
    delete from public.crm_offer_line_options where crm_offer_line_options.offer_id=v_offer_id;
    insert into public.crm_offer_line_options(offer_id,name,data_gb,price_delta,position,option_type,group_name,message_text,replaces_text,default_selected,active) values
      (v_offer_id,'Línea adicional 40 GB',40,5,10,'quantity',null,'40 GB',null,false,true),
      (v_offer_id,'Línea adicional 150 GB',150,10,20,'quantity',null,'150 GB',null,false,true),
      (v_offer_id,'Línea adicional 300 GB',300,15,30,'quantity',null,'300 GB',null,false,true);
  end loop;
end $$;

notify pgrst,'reload schema';
