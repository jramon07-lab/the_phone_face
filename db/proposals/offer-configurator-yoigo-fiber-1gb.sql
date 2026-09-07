-- Añade Fibra 1 Gb (+10 €/mes) a todas las tarifas Yoigo actuales.
-- No crea ofertas, oportunidades, trabajos ni mensajes.
do $$
declare v_offer_id uuid;
begin
 for v_offer_id in select id from public.crm_offer_catalog where operator='Yoigo' and active loop
   insert into public.crm_offer_line_options(
    offer_id,name,data_gb,price_delta,position,option_type,group_name,message_text,replaces_text,default_selected,active
   )
   select v_offer_id,'Fibra 1 Gb',null,10,5,'checkbox','fiber_speed','Fibra 1 Gb','Fibra 600 Mb',false,true
   where not exists(
    select 1 from public.crm_offer_line_options
    where crm_offer_line_options.offer_id=v_offer_id and lower(btrim(name))='fibra 1 gb'
   );
   update public.crm_offer_line_options set data_gb=null,price_delta=10,position=5,option_type='checkbox',
    group_name='fiber_speed',message_text='Fibra 1 Gb',replaces_text='Fibra 600 Mb',default_selected=false,active=true
   where crm_offer_line_options.offer_id=v_offer_id and lower(btrim(name))='fibra 1 gb';
 end loop;
end $$;

notify pgrst,'reload schema';
