-- Configurador de ofertas y conexión con el motor de automatizaciones existente.
-- La instalación es aditiva: no crea tarifas, no activa flujos por operador y no envía mensajes.

create table if not exists public.crm_offer_catalog (
  id uuid primary key default gen_random_uuid(),
  operator text not null,
  name text not null,
  fiber_mbps integer,
  included_unlimited_lines smallint not null default 2 check (included_unlimited_lines between 0 and 20),
  base_price numeric(10,2) not null default 0 check (base_price >= 0),
  intro_text text,
  active boolean not null default true,
  position integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_offer_catalog_operator_not_blank check (btrim(operator) <> ''),
  constraint crm_offer_catalog_name_not_blank check (btrim(name) <> '')
);

create table if not exists public.crm_offer_line_options (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.crm_offer_catalog(id) on delete cascade,
  name text not null,
  data_gb integer check (data_gb is null or data_gb >= 0),
  price_delta numeric(10,2) not null default 0 check (price_delta >= 0),
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_offer_line_option_name_not_blank check (btrim(name) <> '')
);

create table if not exists public.crm_offer_instances (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null unique references public.sales_opportunities(id) on delete cascade,
  contact_id uuid not null references public.records(id) on delete cascade,
  catalog_offer_id uuid references public.crm_offer_catalog(id) on delete set null,
  created_by uuid not null default auth.uid(),
  operator text not null,
  offer_name text not null,
  base_price numeric(10,2) not null,
  total_price numeric(10,2) not null,
  snapshot jsonb not null default '{}'::jsonb,
  message_text text,
  extra_text text,
  status text not null default 'draft' check (status in ('draft','queued','following','paused','accepted','processed','won','lost','archived','cancelled','error')),
  sent_at timestamptz,
  accepted_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_offer_catalog_active_idx on public.crm_offer_catalog(active,operator,position);
create index if not exists crm_offer_line_options_offer_idx on public.crm_offer_line_options(offer_id,active,position);
create index if not exists crm_offer_instances_contact_idx on public.crm_offer_instances(contact_id,created_at desc);
create index if not exists crm_offer_instances_operator_idx on public.crm_offer_instances(operator,status,updated_at desc);

alter table public.crm_offer_catalog enable row level security;
alter table public.crm_offer_line_options enable row level security;
alter table public.crm_offer_instances enable row level security;

drop policy if exists crm_offer_catalog_select on public.crm_offer_catalog;
create policy crm_offer_catalog_select on public.crm_offer_catalog for select to authenticated
using ((select public.current_user_is_admin()) or (select public.current_user_can('can_view_sales')));
drop policy if exists crm_offer_catalog_insert on public.crm_offer_catalog;
create policy crm_offer_catalog_insert on public.crm_offer_catalog for insert to authenticated
with check ((select public.current_user_is_admin()));
drop policy if exists crm_offer_catalog_update on public.crm_offer_catalog;
create policy crm_offer_catalog_update on public.crm_offer_catalog for update to authenticated
using ((select public.current_user_is_admin())) with check ((select public.current_user_is_admin()));
drop policy if exists crm_offer_catalog_delete on public.crm_offer_catalog;
create policy crm_offer_catalog_delete on public.crm_offer_catalog for delete to authenticated
using ((select public.current_user_is_admin()));

drop policy if exists crm_offer_line_options_select on public.crm_offer_line_options;
create policy crm_offer_line_options_select on public.crm_offer_line_options for select to authenticated
using ((select public.current_user_is_admin()) or (select public.current_user_can('can_view_sales')));
drop policy if exists crm_offer_line_options_insert on public.crm_offer_line_options;
create policy crm_offer_line_options_insert on public.crm_offer_line_options for insert to authenticated
with check ((select public.current_user_is_admin()));
drop policy if exists crm_offer_line_options_update on public.crm_offer_line_options;
create policy crm_offer_line_options_update on public.crm_offer_line_options for update to authenticated
using ((select public.current_user_is_admin())) with check ((select public.current_user_is_admin()));
drop policy if exists crm_offer_line_options_delete on public.crm_offer_line_options;
create policy crm_offer_line_options_delete on public.crm_offer_line_options for delete to authenticated
using ((select public.current_user_is_admin()));

drop policy if exists crm_offer_instances_select on public.crm_offer_instances;
create policy crm_offer_instances_select on public.crm_offer_instances for select to authenticated
using ((select public.current_user_is_admin()) or (select public.current_user_can('can_view_sales')));
drop policy if exists crm_offer_instances_insert on public.crm_offer_instances;
create policy crm_offer_instances_insert on public.crm_offer_instances for insert to authenticated
with check ((select public.current_user_is_admin()) or (select public.current_user_can('can_edit_sales')));
drop policy if exists crm_offer_instances_update on public.crm_offer_instances;
create policy crm_offer_instances_update on public.crm_offer_instances for update to authenticated
using ((select public.current_user_is_admin()) or (select public.current_user_can('can_edit_sales')))
with check ((select public.current_user_is_admin()) or (select public.current_user_can('can_edit_sales')));
drop policy if exists crm_offer_instances_delete on public.crm_offer_instances;
create policy crm_offer_instances_delete on public.crm_offer_instances for delete to authenticated
using ((select public.current_user_is_admin()));

revoke all on public.crm_offer_catalog,public.crm_offer_line_options,public.crm_offer_instances from public,anon;
grant select on public.crm_offer_catalog,public.crm_offer_line_options,public.crm_offer_instances to authenticated;
grant insert,update,delete on public.crm_offer_catalog,public.crm_offer_line_options to authenticated;
grant insert,update,delete on public.crm_offer_instances to authenticated;
grant all on public.crm_offer_catalog,public.crm_offer_line_options,public.crm_offer_instances to service_role;

create or replace function crm_private.offer_touch_updated_at()
returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=now();return new;end $$;
revoke all on function crm_private.offer_touch_updated_at() from public,anon,authenticated;

drop trigger if exists crm_offer_catalog_touch on public.crm_offer_catalog;
create trigger crm_offer_catalog_touch before update on public.crm_offer_catalog
for each row execute function crm_private.offer_touch_updated_at();
drop trigger if exists crm_offer_line_options_touch on public.crm_offer_line_options;
create trigger crm_offer_line_options_touch before update on public.crm_offer_line_options
for each row execute function crm_private.offer_touch_updated_at();
drop trigger if exists crm_offer_instances_touch on public.crm_offer_instances;
create trigger crm_offer_instances_touch before update on public.crm_offer_instances
for each row execute function crm_private.offer_touch_updated_at();

create or replace function public.crm_save_offer_catalog(p_offer jsonb)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  oid uuid:=nullif(p_offer->>'id','')::uuid;
  item jsonb;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'Solo un administrador puede modificar el catálogo';end if;
  if btrim(coalesce(p_offer->>'operator',''))='' or btrim(coalesce(p_offer->>'name',''))='' then raise exception 'Indica operador y nombre de la oferta';end if;
  if oid is null then
    insert into public.crm_offer_catalog(operator,name,fiber_mbps,included_unlimited_lines,base_price,intro_text,active,position,created_by)
    values(btrim(p_offer->>'operator'),btrim(p_offer->>'name'),nullif(p_offer->>'fiber_mbps','')::integer,
      greatest(0,coalesce((p_offer->>'included_unlimited_lines')::smallint,2)),greatest(0,coalesce((p_offer->>'base_price')::numeric,0)),
      nullif(btrim(p_offer->>'intro_text'),''),coalesce((p_offer->>'active')::boolean,true),coalesce((p_offer->>'position')::integer,0),auth.uid())
    returning id into oid;
  else
    update public.crm_offer_catalog set operator=btrim(p_offer->>'operator'),name=btrim(p_offer->>'name'),
      fiber_mbps=nullif(p_offer->>'fiber_mbps','')::integer,
      included_unlimited_lines=greatest(0,coalesce((p_offer->>'included_unlimited_lines')::smallint,2)),
      base_price=greatest(0,coalesce((p_offer->>'base_price')::numeric,0)),intro_text=nullif(btrim(p_offer->>'intro_text'),''),
      active=coalesce((p_offer->>'active')::boolean,true),position=coalesce((p_offer->>'position')::integer,0)
    where id=oid;
    if not found then raise exception 'Oferta no encontrada';end if;
    delete from public.crm_offer_line_options where offer_id=oid;
  end if;
  for item in select value from jsonb_array_elements(coalesce(p_offer->'line_options','[]'::jsonb)) loop
    if btrim(coalesce(item->>'name',''))<>'' then
      insert into public.crm_offer_line_options(offer_id,name,data_gb,price_delta,active,position)
      values(oid,btrim(item->>'name'),nullif(item->>'data_gb','')::integer,greatest(0,coalesce((item->>'price_delta')::numeric,0)),
        coalesce((item->>'active')::boolean,true),coalesce((item->>'position')::integer,0));
    end if;
  end loop;
  return oid;
end $$;
revoke all on function public.crm_save_offer_catalog(jsonb) from public,anon;
grant execute on function public.crm_save_offer_catalog(jsonb) to authenticated;

-- Los flujos manuales de oferta usan una oportunidad ya creada por el configurador.
create or replace function crm_private.lifecycle_job_context()
returns trigger language plpgsql security definer set search_path='' as $$
declare p jsonb;r public.crm_automations%rowtype;ctx jsonb;
begin
  if new.action_type<>'flow_v1' then return new;end if;
  p:=new.action_config->'lifecycle';
  if coalesce(p->>'mode','') not in ('offer','after_sale') then return new;end if;
  select * into r from public.crm_automations where id=new.automation_id;
  if p->>'mode'='offer' and r.trigger_type not in ('label_assigned','opportunity_stage','manual_offer') then raise exception 'Oferta: elige etiqueta, columna o configurador';end if;
  if p->>'mode'='after_sale' and r.trigger_type<>'opportunity_stage' then raise exception 'Tramitado: elige una columna';end if;
  if p->>'mode'='offer' and r.trigger_type='label_assigned' then
    p:=p||jsonb_build_object('label_id',r.trigger_config->>'label_id');
    new.event_key:='lifecycle-offer:'||coalesce(new.context->>'contact_id','');
  end if;
  if p->>'mode'='after_sale' then p:=p||jsonb_build_object('stage_id',r.trigger_config->>'stage_id');end if;
  ctx:=new.context;
  if coalesce(ctx->>'phone','')='' or coalesce(ctx->>'name','')='' then
    ctx:=public.crm_server_context_for_contact(nullif(ctx->>'contact_id','')::uuid,null)||(ctx-'phone'-'name')
      ||case when coalesce(ctx->>'phone','')<>'' then jsonb_build_object('phone',ctx->>'phone') else '{}'::jsonb end
      ||case when coalesce(ctx->>'name','')<>'' then jsonb_build_object('name',ctx->>'name') else '{}'::jsonb end;
  end if;
  new.context:=ctx||jsonb_build_object('lifecycle',p,'event_at',coalesce(nullif(ctx->>'event_at','')::timestamptz,statement_timestamp()));
  return new;
end $$;
revoke all on function crm_private.lifecycle_job_context() from public,anon,authenticated;

create or replace function public.crm_create_offer_execution(
  p_contact_id uuid,p_catalog_offer_id uuid,p_additional_lines jsonb default '[]'::jsonb,
  p_extra_text text default null,p_mode text default 'followup'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();rec public.records%rowtype;offer public.crm_offer_catalog%rowtype;opt public.crm_offer_line_options%rowtype;
  item jsonb;qty integer;line_total numeric:=0;total numeric;lines jsonb:='[]'::jsonb;line_text text:='';
  nm text;first_name text;phone text;message text;opp_stage public.sales_stages%rowtype;pending_stage public.sales_stages%rowtype;processed_stage public.sales_stages%rowtype;
  opp_id uuid;instance_id uuid;rule public.crm_automations%rowtype;flow jsonb;ctx jsonb;event_key text;
begin
  if uid is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para crear ofertas';end if;
  if p_mode not in ('followup','accepted') then raise exception 'Modo de oferta no válido';end if;
  select * into rec from public.records where id=p_contact_id;if not found then raise exception 'Contacto no encontrado';end if;
  select * into offer from public.crm_offer_catalog where id=p_catalog_offer_id and active;if not found then raise exception 'Oferta no disponible';end if;
  for item in select value from jsonb_array_elements(coalesce(p_additional_lines,'[]'::jsonb)) loop
    qty:=greatest(0,least(20,coalesce((item->>'quantity')::integer,0)));
    if qty>0 then
      select * into opt from public.crm_offer_line_options where id=nullif(item->>'option_id','')::uuid and offer_id=offer.id and active;
      if not found then raise exception 'Una línea adicional ya no está disponible';end if;
      line_total:=line_total+(opt.price_delta*qty);
      lines:=lines||jsonb_build_array(jsonb_build_object('option_id',opt.id,'name',opt.name,'data_gb',opt.data_gb,'unit_price',opt.price_delta,'quantity',qty,'subtotal',opt.price_delta*qty));
      line_text:=line_text||E'\n• '||qty||case when qty=1 then ' línea adicional' else ' líneas adicionales' end||' · '||opt.name;
    end if;
  end loop;
  total:=offer.base_price+line_total;
  nm:=coalesce(nullif(btrim(rec.data->>'NOMBRE Y APELLIDOS'),''),nullif(btrim(concat_ws(' ',rec.data->>'NOMBRE',rec.data->>'APELLIDOS')),''),'Cliente');
  first_name:=split_part(nm,' ',1);
  phone:=public.crm_server_normalize_phone(coalesce(rec.data->>'TELÉFONO',rec.data->>'TELEFONO',rec.data->>'PHONE',rec.data->>'MOVIL',''));
  if p_mode='followup' and (phone is null or length(phone)<8) then raise exception 'El contacto no tiene un teléfono válido';end if;
  message:='Hola '||first_name||', te envío la oferta que hemos comentado:'||E'\n• '||offer.operator||' · '||offer.name;
  if offer.fiber_mbps is not null then message:=message||E'\n• Fibra '||offer.fiber_mbps||' Mb';end if;
  if offer.included_unlimited_lines>0 then message:=message||E'\n• '||offer.included_unlimited_lines||case when offer.included_unlimited_lines=1 then ' línea principal con datos ilimitados' else ' líneas principales con datos ilimitados' end;end if;
  message:=message||line_text||E'\nPrecio final: '||to_char(total,'FM999999990D00')||' €/mes';
  if btrim(coalesce(p_extra_text,''))<>'' then message:=message||E'\n\n'||btrim(p_extra_text);end if;
  select * into pending_stage from public.sales_stages where active and lower(btrim(name))='pendiente de tramitar' order by position limit 1;
  select * into processed_stage from public.sales_stages where active and lower(btrim(name))='tramitado' order by position limit 1;
  if p_mode='accepted' then opp_stage:=pending_stage;else
    select * into opp_stage from public.sales_stages where active and lower(btrim(name)) in ('seguimiento','oferta pasada') order by case when lower(btrim(name))='seguimiento' then 0 else 1 end,position limit 1;
  end if;
  if opp_stage.id is null then raise exception 'Falta la columna de ventas para esta oferta';end if;
  if p_mode='followup' and (pending_stage.id is null or processed_stage.id is null) then raise exception 'Faltan las columnas Pendiente de tramitar o Tramitado';end if;
  insert into public.sales_opportunities(pipeline_id,stage_id,record_id,title,client_name,phone,amount,expected_date,owner_user_id,status,notes)
  values(opp_stage.pipeline_id,opp_stage.id,rec.id,offer.operator||' · '||offer.name,nm,phone,total,(now() at time zone 'Europe/Madrid')::date,uid,'open','Oferta creada desde el configurador')
  returning id into opp_id;
  insert into public.crm_offer_instances(opportunity_id,contact_id,catalog_offer_id,created_by,operator,offer_name,base_price,total_price,snapshot,message_text,extra_text,status,accepted_at)
  values(opp_id,rec.id,offer.id,uid,offer.operator,offer.name,offer.base_price,total,
    jsonb_build_object('operator',offer.operator,'offer_name',offer.name,'fiber_mbps',offer.fiber_mbps,'included_unlimited_lines',offer.included_unlimited_lines,'base_price',offer.base_price,'additional_lines',lines,'total_price',total),
    message,nullif(btrim(coalesce(p_extra_text,'')),''),case when p_mode='accepted' then 'accepted' else 'queued' end,case when p_mode='accepted' then now() end)
  returning id into instance_id;
  if p_mode='followup' then
    perform pg_advisory_xact_lock(hashtextextended(uid::text,9417));
    select * into rule from public.crm_automations where user_id=uid and trigger_type='manual_offer' order by created_at limit 1;
    if not found then
      insert into public.crm_automations(user_id,name,enabled,trigger_type,trigger_config,action_type,action_config)
      values(uid,'OFERTAS · Seguimiento general',true,'manual_offer',jsonb_build_object('automation_operator','General','automation_category','Seguimiento'),'flow_v1',jsonb_build_object('version',1,'steps',jsonb_build_array()))
      returning * into rule;
    elsif not rule.enabled then raise exception 'La automatización general de ofertas está pausada';
    end if;
    flow:=jsonb_build_object('version',1,'lifecycle',jsonb_build_object('mode','offer','version',1,'stop_stage_ids',jsonb_build_array(pending_stage.id::text,processed_stage.id::text)),'steps',jsonb_build_array(
      jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text','{oferta_mensaje}','offer_phase','initial')),
      jsonb_build_object('kind','action','action_type','record_offer_month','config',jsonb_build_object()),
      jsonb_build_object('kind','wait','unit','days','value',2),
      jsonb_build_object('kind','condition','condition_type','no_response'),
      jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text','Hola {nombre}, ¿has podido revisar la oferta de {operador} por {precio_total} €/mes? Si tienes alguna duda, te ayudo por aquí.','offer_phase','reminder_2')),
      jsonb_build_object('kind','wait','unit','days','value',3),
      jsonb_build_object('kind','condition','condition_type','no_response'),
      jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text','Hola {nombre}, te escribo por última vez sobre la oferta de {operador}. Si quieres que la revisemos o la dejemos pendiente, dímelo por aquí.','offer_phase','reminder_5'))
    ));
    rule.action_config:=flow;
    ctx:=public.crm_server_context_for_contact(rec.id,phone)||jsonb_build_object('opportunity_id',opp_id,'offer_instance_id',instance_id,'operator',offer.operator,'precio_total',to_char(total,'FM999999990D00'),'oferta_mensaje',message,'trigger_type','manual_offer','event_at',now());
    event_key:='manual-offer:'||instance_id;
    perform public.crm_server_enqueue(rule,event_key,ctx);
  end if;
  return jsonb_build_object('offer_id',instance_id,'opportunity_id',opp_id,'status',case when p_mode='accepted' then 'accepted' else 'queued' end,'message',message,'total_price',total);
end $$;
revoke all on function public.crm_create_offer_execution(uuid,uuid,jsonb,text,text) from public,anon;
grant execute on function public.crm_create_offer_execution(uuid,uuid,jsonb,text,text) to authenticated;

create or replace function public.crm_control_offer(p_offer_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();inst public.crm_offer_instances%rowtype;opp public.sales_opportunities%rowtype;stage public.sales_stages%rowtype;rule public.crm_automations%rowtype;flow jsonb;ctx jsonb;
begin
  if uid is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para modificar ofertas';end if;
  select * into inst from public.crm_offer_instances where id=p_offer_id;if not found then raise exception 'Oferta no encontrada';end if;
  select * into opp from public.sales_opportunities where id=inst.opportunity_id;if not found then raise exception 'Oportunidad no encontrada';end if;
  if p_action='pause' then
    update public.crm_server_automation_jobs set status='cancelled',error_message='Seguimiento pausado manualmente',updated_at=now()
    where status in ('pending','running') and context->>'offer_instance_id'=inst.id::text;
    update public.crm_offer_instances set status='paused' where id=inst.id;
  elsif p_action='accept' then
    select * into stage from public.sales_stages where active and lower(btrim(name))='pendiente de tramitar' order by position limit 1;
    if stage.id is null then raise exception 'Falta la columna Pendiente de tramitar';end if;
    update public.crm_offer_instances set status='accepted',accepted_at=coalesce(accepted_at,now()) where id=inst.id;
    update public.sales_opportunities set stage_id=stage.id,updated_at=now() where id=opp.id;
  elsif p_action='cancel' then
    update public.crm_server_automation_jobs set status='cancelled',error_message='Seguimiento finalizado manualmente',updated_at=now()
    where status in ('pending','running') and context->>'offer_instance_id'=inst.id::text;
    update public.crm_offer_instances set status='cancelled' where id=inst.id;
  elsif p_action='resume' then
    select * into rule from public.crm_automations where user_id=uid and trigger_type='manual_offer' and enabled order by created_at limit 1;
    if not found then raise exception 'La automatización general de ofertas no está activa';end if;
    select * into stage from public.sales_stages where active and lower(btrim(name))='tramitado' order by position limit 1;
    flow:=jsonb_build_object('version',1,'lifecycle',jsonb_build_object('mode','offer','version',1,'stop_stage_ids',jsonb_build_array(
      (select id::text from public.sales_stages where active and lower(btrim(name))='pendiente de tramitar' order by position limit 1),stage.id::text)),'steps',jsonb_build_array(
      jsonb_build_object('kind','wait','unit','days','value',2),jsonb_build_object('kind','condition','condition_type','no_response'),
      jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text','Hola {nombre}, ¿has podido revisar la oferta de {operador} por {precio_total} €/mes? Si tienes alguna duda, te ayudo por aquí.','offer_phase','reminder_2')),
      jsonb_build_object('kind','wait','unit','days','value',3),jsonb_build_object('kind','condition','condition_type','no_response'),
      jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text','Hola {nombre}, te escribo por última vez sobre la oferta de {operador}. Si quieres que la revisemos o la dejemos pendiente, dímelo por aquí.','offer_phase','reminder_5'))));
    rule.action_config:=flow;
    ctx:=public.crm_server_context_for_contact(inst.contact_id,opp.phone)||jsonb_build_object('opportunity_id',opp.id,'offer_instance_id',inst.id,'operator',inst.operator,'precio_total',to_char(inst.total_price,'FM999999990D00'),'trigger_type','manual_offer','event_at',now());
    perform public.crm_server_enqueue(rule,'manual-offer-resume:'||inst.id||':'||extract(epoch from now())::bigint,ctx);
    update public.crm_offer_instances set status='following' where id=inst.id;
  else raise exception 'Acción no válida';
  end if;
  return jsonb_build_object('ok',true,'action',p_action,'offer_id',inst.id);
end $$;
revoke all on function public.crm_control_offer(uuid,text) from public,anon;
grant execute on function public.crm_control_offer(uuid,text) to authenticated;

create or replace function crm_private.offer_job_status()
returns trigger language plpgsql security definer set search_path='' as $$
declare oid uuid;
begin
  oid:=nullif(new.context->>'offer_instance_id','')::uuid;
  if oid is null then return new;end if;
  if new.action_type='__send_whatsapp' and new.action_config->>'offer_phase'='initial' then
    if new.status='done' then update public.crm_offer_instances set status='following',sent_at=coalesce(sent_at,new.completed_at,now()) where id=oid and status in ('queued','error');
    elsif new.status='failed' then update public.crm_offer_instances set status='error' where id=oid and status='queued';end if;
  elsif new.status='cancelled' and coalesce(new.error_message,'') like 'Cliente respondió:%' then
    update public.crm_offer_instances set status='paused' where id=oid and status='following';
  end if;
  return new;
end $$;
revoke all on function crm_private.offer_job_status() from public,anon,authenticated;
drop trigger if exists crm_offer_job_status on public.crm_server_automation_jobs;
create trigger crm_offer_job_status after update of status on public.crm_server_automation_jobs
for each row when (old.status is distinct from new.status) execute function crm_private.offer_job_status();

create or replace function crm_private.offer_record_sale(p_instance public.crm_offer_instances,p_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare tracked crm_private.opportunity_month_labels%rowtype;lid uuid;label_name text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_instance.contact_id::text,7741));
  select * into tracked from crm_private.opportunity_month_labels where opportunity_id=p_instance.opportunity_id for update;
  label_name:=crm_private.month_label_name('VENTAS',p_at);
  insert into public.crm_labels(name) values(label_name) on conflict(name) do update set name=excluded.name returning id into lid;
  insert into public.app_settings(key,value,updated_at) values('crm_label_categories_v1',jsonb_build_object(lid::text,'Ventas'),now())
    on conflict(key) do update set value=(case when jsonb_typeof(public.app_settings.value)='object' then public.app_settings.value else '{}'::jsonb end)||excluded.value,updated_at=now();
  insert into public.crm_contact_labels(contact_id,label_id) values(p_instance.contact_id,lid) on conflict(contact_id,label_id) do nothing;
  insert into crm_private.opportunity_month_labels(opportunity_id,contact_id,sale_label_id,sold_at)
    values(p_instance.opportunity_id,p_instance.contact_id,lid,p_at)
    on conflict(opportunity_id) do update set sale_label_id=excluded.sale_label_id,sold_at=excluded.sold_at;
  if tracked.offer_label_id is not null and not exists(
    select 1 from crm_private.opportunity_month_labels where contact_id=p_instance.contact_id and offer_label_id=tracked.offer_label_id and sold_at is null and opportunity_id<>p_instance.opportunity_id
  ) then delete from public.crm_contact_labels where contact_id=p_instance.contact_id and label_id=tracked.offer_label_id;end if;
end $$;
revoke all on function crm_private.offer_record_sale(public.crm_offer_instances,timestamptz) from public,anon,authenticated;

create or replace function crm_private.offer_stage_state()
returns trigger language plpgsql security definer set search_path='' as $$
declare inst public.crm_offer_instances%rowtype;stage_name text;
begin
  if new.stage_id is not distinct from old.stage_id then return new;end if;
  select * into inst from public.crm_offer_instances where opportunity_id=new.id;if not found then return new;end if;
  select lower(btrim(name)) into stage_name from public.sales_stages where id=new.stage_id;
  if stage_name='pendiente de tramitar' then update public.crm_offer_instances set status='accepted',accepted_at=coalesce(accepted_at,now()) where id=inst.id;
  elsif stage_name='tramitado' then
    update public.crm_offer_instances set status='processed',processed_at=coalesce(processed_at,now()) where id=inst.id;
    perform crm_private.offer_record_sale(inst,now());
  elsif stage_name='ganado' then update public.crm_offer_instances set status='won' where id=inst.id;
  elsif stage_name='perdido' then update public.crm_offer_instances set status='lost' where id=inst.id;
  elsif stage_name='archivo' then update public.crm_offer_instances set status='archived' where id=inst.id;
  end if;
  return new;
end $$;
revoke all on function crm_private.offer_stage_state() from public,anon,authenticated;
drop trigger if exists crm_offer_stage_state on public.sales_opportunities;
create trigger crm_offer_stage_state after update of stage_id on public.sales_opportunities
for each row execute function crm_private.offer_stage_state();

-- El disparador de Tramitado filtra el operador sin afectar reglas antiguas de tipo General.
create or replace function public.crm_server_on_opportunity_stage()
returns trigger language plpgsql security definer set search_path=public as $$
declare r public.crm_automations%rowtype;ctx jsonb;offer_operator text:='';wanted text;
begin
  if not public.crm_server_automations_enabled() then return new;end if;
  if tg_op='UPDATE' and new.stage_id is not distinct from old.stage_id then return new;end if;
  select operator into offer_operator from public.crm_offer_instances where opportunity_id=new.id;
  ctx:=public.crm_server_context_for_contact(new.record_id,new.phone)||jsonb_build_object('opportunity_id',new.id,'stage_id',new.stage_id,'name',coalesce(new.client_name,''),'phone',public.crm_server_normalize_phone(new.phone),'operator',coalesce(offer_operator,''));
  for r in select * from public.crm_automations where enabled and trigger_type='opportunity_stage' and coalesce(trigger_config->>'stage_id','')=coalesce(new.stage_id::text,'') loop
    wanted:=coalesce(nullif(btrim(r.trigger_config->>'automation_operator'),''),nullif(btrim(r.trigger_config->>'operator'),''),'General');
    if wanted='General' or lower(wanted)=lower(coalesce(offer_operator,'')) then
      perform public.crm_server_enqueue(r,'oppstage:'||new.id::text||':'||coalesce(new.stage_id::text,''),ctx);
    end if;
  end loop;
  return new;
end $$;
revoke all on function public.crm_server_on_opportunity_stage() from public,anon,authenticated;

create or replace function public.crm_prepare_operator_automation_drafts()
returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare op text;stage_id uuid;made integer:=0;
begin
  if auth.uid() is null then raise exception 'Inicia sesión';end if;
  select id into stage_id from public.sales_stages where active and lower(btrim(name))='tramitado' order by position limit 1;
  if stage_id is null then raise exception 'Falta la columna Tramitado';end if;
  foreach op in array array['Vodafone','Yoigo','MásMóvil','O2','Lowi','Orange'] loop
    if not exists(select 1 from public.crm_automations where user_id=auth.uid() and trigger_type='opportunity_stage' and lower(coalesce(trigger_config->>'automation_operator',''))=lower(op)) then
      insert into public.crm_automations(user_id,name,enabled,trigger_type,trigger_config,action_type,action_config)
      values(auth.uid(),'TRAMITACIÓN · '||op,false,'opportunity_stage',jsonb_build_object('stage_id',stage_id,'automation_operator',op,'automation_category','Tramitación'),'flow_v1',
        jsonb_build_object('version',1,'lifecycle',jsonb_build_object('mode','after_sale','version',1),'steps',jsonb_build_array(
          jsonb_build_object('kind','action','action_type','record_sale_month','config',jsonb_build_object()),
          jsonb_build_object('kind','wait','unit','days','value',2),
          jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text','Configura aquí el primer mensaje de '||op||' antes de activar.'))
        )));
      made:=made+1;
    end if;
  end loop;
  return made;
end $$;
revoke all on function public.crm_prepare_operator_automation_drafts() from public,anon;
grant execute on function public.crm_prepare_operator_automation_drafts() to authenticated;

notify pgrst,'reload schema';
