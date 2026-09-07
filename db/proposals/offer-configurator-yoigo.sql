-- Catálogo Yoigo aprobado. No crea oportunidades, trabajos ni mensajes.
do $$
declare
 standard_id uuid;pack_id uuid;
begin
 select id into standard_id from public.crm_offer_catalog
  where operator='Yoigo' and name='YGO · 600 + 2 ILIMITADAS' order by created_at limit 1;
 if standard_id is null then
   insert into public.crm_offer_catalog(operator,name,fiber_mbps,included_unlimited_lines,base_price,base_features,is_counteroffer,active,position)
   values('Yoigo','YGO · 600 + 2 ILIMITADAS',600,2,61,'["Fibra 600 Mb","2 líneas con datos ilimitados"]',false,true,10)
   returning id into standard_id;
 else
   update public.crm_offer_catalog set fiber_mbps=600,included_unlimited_lines=2,base_price=61,
    base_features='["Fibra 600 Mb","2 líneas con datos ilimitados"]',is_counteroffer=false,active=true,position=10
   where id=standard_id;
 end if;

 insert into public.crm_offer_line_options(offer_id,name,data_gb,price_delta,position,option_type,group_name,message_text,replaces_text,default_selected,active)
 select standard_id,v.name,v.data_gb,v.price_delta,v.position,v.option_type,v.group_name,v.message_text,null,false,true
 from (values
   ('Descuento 30 %',null::integer,-18.30::numeric,10,'radio','discount',null::text),
   ('Descuento 40 %',null::integer,-24.40::numeric,20,'radio','discount',null::text),
   ('Descuento 50 %',null::integer,-30.50::numeric,30,'radio','discount',null::text),
   ('TV +6 €',null::integer,6::numeric,40,'radio','yoigo_tv','TV incluida'),
   ('TV gratis',null::integer,0::numeric,50,'radio','yoigo_tv','TV incluida'),
   ('Netflix',null::integer,8.99::numeric,60,'checkbox',null::text,'Netflix incluido'),
   ('Amazon',null::integer,4::numeric,70,'checkbox',null::text,'Amazon incluido'),
   ('Disney+',null::integer,6.99::numeric,80,'checkbox',null::text,'Disney+ incluido'),
   ('Línea adicional ilimitada',null::integer,9::numeric,90,'quantity',null::text,'con datos ilimitados')
 ) as v(name,data_gb,price_delta,position,option_type,group_name,message_text)
 where not exists(select 1 from public.crm_offer_line_options o where o.offer_id=standard_id and lower(btrim(o.name))=lower(btrim(v.name)));

 update public.crm_offer_line_options o set
  data_gb=v.data_gb,price_delta=v.price_delta,position=v.position,option_type=v.option_type,
  group_name=v.group_name,message_text=v.message_text,replaces_text=null,default_selected=false,active=true
 from (values
   ('Descuento 30 %',null::integer,-18.30::numeric,10,'radio','discount',null::text),
   ('Descuento 40 %',null::integer,-24.40::numeric,20,'radio','discount',null::text),
   ('Descuento 50 %',null::integer,-30.50::numeric,30,'radio','discount',null::text),
   ('TV +6 €',null::integer,6::numeric,40,'radio','yoigo_tv','TV incluida'),
   ('TV gratis',null::integer,0::numeric,50,'radio','yoigo_tv','TV incluida'),
   ('Netflix',null::integer,8.99::numeric,60,'checkbox',null::text,'Netflix incluido'),
   ('Amazon',null::integer,4::numeric,70,'checkbox',null::text,'Amazon incluido'),
   ('Disney+',null::integer,6.99::numeric,80,'checkbox',null::text,'Disney+ incluido'),
   ('Línea adicional ilimitada',null::integer,9::numeric,90,'quantity',null::text,'con datos ilimitados')
 ) as v(name,data_gb,price_delta,position,option_type,group_name,message_text)
 where o.offer_id=standard_id and lower(btrim(o.name))=lower(btrim(v.name));

 select id into pack_id from public.crm_offer_catalog
  where operator='Yoigo' and name='YGO · 600 + 2 ILIMITADAS + TV + NETFLIX' order by created_at limit 1;
 if pack_id is null then
   insert into public.crm_offer_catalog(operator,name,fiber_mbps,included_unlimited_lines,base_price,base_features,is_counteroffer,active,position)
   values('Yoigo','YGO · 600 + 2 ILIMITADAS + TV + NETFLIX',600,2,47,'["Fibra 600 Mb","2 líneas con datos ilimitados","TV incluida","Netflix incluido"]',false,true,20)
   returning id into pack_id;
 else
   update public.crm_offer_catalog set fiber_mbps=600,included_unlimited_lines=2,base_price=47,
    base_features='["Fibra 600 Mb","2 líneas con datos ilimitados","TV incluida","Netflix incluido"]',is_counteroffer=false,active=true,position=20
   where id=pack_id;
 end if;

 insert into public.crm_offer_line_options(offer_id,name,data_gb,price_delta,position,option_type,group_name,message_text,replaces_text,default_selected,active)
 select pack_id,'Línea adicional ilimitada',null,9,10,'quantity',null,'con datos ilimitados',null,false,true
 where not exists(select 1 from public.crm_offer_line_options where offer_id=pack_id and lower(btrim(name))='línea adicional ilimitada');
 update public.crm_offer_line_options set data_gb=null,price_delta=9,position=10,option_type='quantity',group_name=null,
  message_text='con datos ilimitados',replaces_text=null,default_selected=false,active=true
 where offer_id=pack_id and lower(btrim(name))='línea adicional ilimitada';
end $$;

notify pgrst,'reload schema';
