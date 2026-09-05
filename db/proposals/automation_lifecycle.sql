-- Optional lifecycle support. Does not enable/change rules or enqueue jobs.
-- Existing WhatsApp transport and trigger functions are preserved.
create table if not exists crm_private.commercial_optouts (
  phone text primary key, contact_id uuid, received_at timestamptz not null default now()
);
create table if not exists crm_private.opportunity_month_labels (
  opportunity_id uuid primary key references public.sales_opportunities(id) on delete cascade,
  contact_id uuid not null references public.records(id) on delete cascade,
  offer_label_id uuid references public.crm_labels(id) on delete set null,
  sale_label_id uuid references public.crm_labels(id) on delete set null,
  offered_at timestamptz, sold_at timestamptz
);
alter table crm_private.commercial_optouts enable row level security;
alter table crm_private.opportunity_month_labels enable row level security;
revoke all on crm_private.commercial_optouts, crm_private.opportunity_month_labels from public, anon, authenticated;

create or replace function crm_private.month_label_name(p_kind text,p_at timestamptz)
returns text language sql immutable set search_path='' as $$
 select p_kind||' '||(array['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'])[extract(month from p_at at time zone 'Europe/Madrid')::int]||' '||extract(year from p_at at time zone 'Europe/Madrid')::int::text
$$;

-- Snapshot the optional policy on root/children; never infer it for legacy flows.
create or replace function crm_private.lifecycle_job_context()
returns trigger language plpgsql security definer set search_path='' as $$
declare p jsonb; r public.crm_automations%rowtype; ctx jsonb;
begin
 if new.action_type <> 'flow_v1' then return new; end if;
 p:=new.action_config->'lifecycle';
 if coalesce(p->>'mode','') not in ('offer','after_sale') then return new; end if;
 select * into r from public.crm_automations where id=new.automation_id;
 if p->>'mode'='offer' and r.trigger_type not in ('label_assigned','opportunity_stage') then raise exception 'Oferta: elige etiqueta o columna'; end if;
 if p->>'mode'='after_sale' and r.trigger_type<>'opportunity_stage' then raise exception 'Tramitado: elige una columna'; end if;
 if p->>'mode'='offer' and r.trigger_type='label_assigned' then
   p:=p||jsonb_build_object('label_id',r.trigger_config->>'label_id');
   -- A removed/reassigned label must not silently restart the same campaign.
   new.event_key:='lifecycle-offer:'||coalesce(new.context->>'contact_id','');
 end if;
 if p->>'mode'='after_sale' then p:=p||jsonb_build_object('stage_id',r.trigger_config->>'stage_id'); end if;
 ctx:=new.context;
 -- Stage hook's existing context may have empty phone/name; keep contact fallback.
 if coalesce(ctx->>'phone','')='' or coalesce(ctx->>'name','')='' then
   ctx:=public.crm_server_context_for_contact(nullif(ctx->>'contact_id','')::uuid,null)
     ||(ctx-'phone'-'name')
     ||case when coalesce(ctx->>'phone','')<>'' then jsonb_build_object('phone',ctx->>'phone') else '{}'::jsonb end
     ||case when coalesce(ctx->>'name','')<>'' then jsonb_build_object('name',ctx->>'name') else '{}'::jsonb end;
 end if;
 new.context:=ctx||jsonb_build_object('lifecycle',p,'event_at',coalesce(nullif(ctx->>'event_at','')::timestamptz,statement_timestamp()));
 return new;
end $$;
drop trigger if exists crm_lifecycle_job_context on public.crm_server_automation_jobs;
create trigger crm_lifecycle_job_context before insert on public.crm_server_automation_jobs for each row execute function crm_private.lifecycle_job_context();

-- Service-only preflight. Fresh status and context also protect jobs already claimed.
create or replace function public.crm_lifecycle_job_guard(p_job uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.crm_server_automation_jobs%rowtype; p jsonb; cid uuid; oid uuid;
 reason text; prev public.crm_server_automation_jobs%rowtype; stamp timestamptz; ph text;
begin
 select * into j from public.crm_server_automation_jobs where id=p_job;
 if not found or j.status<>'running' then return jsonb_build_object('allow',false,'reason','Ejecución detenida'); end if;
 p:=j.context->'lifecycle';
 if coalesce(p->>'mode','') not in ('offer','after_sale') then return jsonb_build_object('allow',true,'context',j.context); end if;
 cid:=nullif(j.context->>'contact_id','')::uuid; oid:=nullif(j.context->>'opportunity_id','')::uuid;
 stamp:=coalesce(nullif(j.context->>'event_at','')::timestamptz,j.created_at);
 ph:=public.crm_server_normalize_phone(j.context->>'phone');
 if j.action_type in ('record_offer_month','record_sale_month') then
   -- Bookkeeping is not a commercial message. A reply/opt-out after an accepted
   -- send must not erase the fact that this offer was sent.
   if cid is null or oid is null or not exists(select 1 from public.sales_opportunities where id=oid and record_id=cid) then reason:='Oportunidad no disponible'; end if;
 elsif not public.crm_server_automations_enabled() then reason:='Motor pausado';
 elsif not exists(select 1 from public.crm_automations where id=j.automation_id and enabled) then reason:='Automatización pausada';
 elsif cid is null or not exists(select 1 from public.records where id=cid) then reason:='Contacto no disponible';
 elsif exists(select 1 from public.crm_automation_contact_exclusions where automation_id=j.automation_id and contact_id=cid) then reason:='Contacto excluido';
 elsif exists(select 1 from crm_private.commercial_optouts where phone=ph or contact_id=cid) then reason:='Baja comercial solicitada';
 elsif p->>'mode'='offer' then
   if nullif(p->>'label_id','') is not null and not exists(select 1 from public.crm_contact_labels where contact_id=cid and label_id::text=p->>'label_id') then reason:='Etiqueta de seguimiento retirada';
   elsif exists(select 1 from public.sales_opportunities o where o.record_id=cid and (oid is null or o.id=oid) and coalesce(p->'stop_stage_ids','[]'::jsonb) ? o.stage_id::text) then reason:='Oferta pasa a tramitación';
   elsif exists(select 1 from public.wa_messages m where m.direction='in' and m.created_at>=stamp and (public.crm_server_normalize_phone(split_part(m.chat_id,'@',1))=ph or public.crm_server_contact_for_phone(public.crm_server_normalize_phone(split_part(m.chat_id,'@',1)))=cid)) then reason:='Cliente respondió: seguimiento detenido'; end if;
 elsif p->>'mode'='after_sale' then
   if oid is null or not exists(select 1 from public.sales_opportunities where id=oid and record_id=cid and stage_id::text=p->>'stage_id') then reason:='Oportunidad fuera de Tramitado'; end if;
 end if;
 if reason is not null then
   update public.crm_server_automation_jobs set status='cancelled',error_message=reason,updated_at=now()
     where id=j.id and status in ('pending','running');
   return jsonb_build_object('allow',false,'reason',reason);
 end if;
 if nullif(j.action_config->>'__previous_event','') is not null then
   select * into prev from public.crm_server_automation_jobs where automation_id=j.automation_id and event_key=j.action_config->>'__previous_event';
   if not found or prev.status in ('pending','running') then return jsonb_build_object('allow',false,'retry',true,'reason','Esperando el paso anterior'); end if;
   if prev.status<>'done' or exists(select 1 from public.crm_automation_runs where automation_id=prev.automation_id and event_key=prev.event_key and context->>'skipped'='true') then
     update public.crm_server_automation_jobs set status='cancelled',error_message='Paso anterior no completado',updated_at=now() where id=j.id and status='running';
     return jsonb_build_object('allow',false,'reason','Paso anterior no completado');
   end if;
 end if;
 return jsonb_build_object('allow',true,'context',j.context);
end $$;
revoke all on function public.crm_lifecycle_job_guard(uuid) from public, anon, authenticated;
grant execute on function public.crm_lifecycle_job_guard(uuid) to service_role;

-- Cancellation hooks are additive and scoped to the opt-in policy.
create or replace function crm_private.lifecycle_label_removed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.crm_server_automation_jobs set status='cancelled',error_message='Etiqueta de seguimiento retirada',updated_at=now()
 where status in ('pending','running') and action_type not in ('record_offer_month','record_sale_month') and context->>'contact_id'=old.contact_id::text
   and context#>>'{lifecycle,mode}'='offer' and context#>>'{lifecycle,label_id}'=old.label_id::text;
 return old;
end $$;
drop trigger if exists crm_lifecycle_label_removed on public.crm_contact_labels;
create trigger crm_lifecycle_label_removed after delete on public.crm_contact_labels for each row execute function crm_private.lifecycle_label_removed();

create or replace function crm_private.lifecycle_stage_changed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.stage_id is not distinct from old.stage_id then return new; end if;
 update public.crm_server_automation_jobs set status='cancelled',error_message='Oportunidad cambia de fase',updated_at=now()
 where status in ('pending','running') and action_type not in ('record_offer_month','record_sale_month') and context->>'contact_id'=new.record_id::text
   and (nullif(context->>'opportunity_id','') is null or context->>'opportunity_id'=new.id::text)
   and ((context#>>'{lifecycle,mode}'='offer' and coalesce(context#>'{lifecycle,stop_stage_ids}','[]'::jsonb) ? new.stage_id::text)
     or (context#>>'{lifecycle,mode}'='after_sale' and context#>>'{lifecycle,stage_id}'<>new.stage_id::text));
 return new;
end $$;
drop trigger if exists crm_lifecycle_stage_changed on public.sales_opportunities;
create trigger crm_lifecycle_stage_changed after update of stage_id on public.sales_opportunities for each row execute function crm_private.lifecycle_stage_changed();

create or replace function crm_private.is_commercial_optout(p_text text)
returns boolean language sql immutable set search_path='' as $$
 select regexp_replace(trim(regexp_replace(lower(coalesce(p_text,'')),'[[:punct:]]',' ','g')),'\s+',' ','g')
 ~ '^(baja|stop|no me (escribas|escribáis|escribais|escriban) más|no me (escribas|escribáis|escribais|escriban) mas|no quiero (recibir )más (mensajes|ofertas|publicidad)|no quiero (recibir )mas (mensajes|ofertas|publicidad))( por favor)?$'
$$;
revoke all on function crm_private.is_commercial_optout(text) from public, anon, authenticated;

create or replace function crm_private.lifecycle_incoming()
returns trigger language plpgsql security definer set search_path='' as $$
declare ph text; cid uuid; msg text; optout boolean;
begin
 if new.direction is distinct from 'in' or new.chat_id like '%@g.us' then return new; end if;
 ph:=public.crm_server_normalize_phone(split_part(new.chat_id,'@',1));
 if ph is null or length(ph)<8 then return new; end if;
 cid:=public.crm_server_contact_for_phone(ph);
 optout:=crm_private.is_commercial_optout(new.text_content);
 if optout then
   insert into crm_private.commercial_optouts(phone,contact_id,received_at) values(ph,cid,new.created_at)
   on conflict(phone) do update set contact_id=coalesce(excluded.contact_id,crm_private.commercial_optouts.contact_id),received_at=excluded.received_at;
 end if;
 update public.crm_server_automation_jobs set status='cancelled',error_message=case when optout then 'Baja comercial solicitada' else 'Cliente respondió: seguimiento detenido' end,updated_at=now()
 where status in ('pending','running') and action_type not in ('record_offer_month','record_sale_month') and (context->>'contact_id'=cid::text or public.crm_server_normalize_phone(context->>'phone')=ph)
   and (context#>>'{lifecycle,mode}'='offer' or (optout and context#>>'{lifecycle,mode}'='after_sale'))
   and coalesce(nullif(context->>'event_at','')::timestamptz,created_at)<=new.created_at;
 return new;
end $$;
drop trigger if exists crm_lifecycle_incoming on public.wa_messages;
create trigger crm_lifecycle_incoming after insert on public.wa_messages for each row execute function crm_private.lifecycle_incoming();

-- Idempotent month assignment AFTER the preceding send completed successfully.
create or replace function public.crm_lifecycle_month_label(p_job uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.crm_server_automation_jobs%rowtype; g jsonb; cid uuid; oid uuid; lid uuid;
 stamp timestamptz; label_name text; tracked crm_private.opportunity_month_labels%rowtype; sale boolean;
begin
 g:=public.crm_lifecycle_job_guard(p_job);
 if g->>'allow'<>'true' then return g; end if;
 select * into j from public.crm_server_automation_jobs where id=p_job;
 if j.action_type not in ('record_offer_month','record_sale_month') or j.context->'lifecycle' is null then raise exception 'Acción mensual inválida'; end if;
 cid:=nullif(j.context->>'contact_id','')::uuid; oid:=nullif(j.context->>'opportunity_id','')::uuid;
 if oid is null or not exists(select 1 from public.sales_opportunities where id=oid and record_id=cid) then raise exception 'Falta la oportunidad vinculada'; end if;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,7741));
 select * into tracked from crm_private.opportunity_month_labels where opportunity_id=oid for update;
 sale:=j.action_type='record_sale_month';
 if (sale and tracked.sold_at is not null) or (not sale and tracked.offered_at is not null) then return jsonb_build_object('allow',true,'already_recorded',true); end if;
 if sale then stamp:=nullif(j.context->>'event_at','')::timestamptz;
 else
   select completed_at into stamp from public.crm_server_automation_jobs
    where automation_id=j.automation_id and event_key=j.action_config->>'__previous_event'
      and action_type in ('send_template','__send_whatsapp') and status='done';
   if stamp is null then raise exception 'Primero debe completarse el envío de la oferta'; end if;
 end if;
 label_name:=crm_private.month_label_name(case when sale then 'VENTAS' else 'OFERTA' end,coalesce(stamp,now()));
 insert into public.crm_labels(name) values(label_name) on conflict(name) do update set name=excluded.name returning id into lid;
 insert into public.app_settings(key,value,updated_at) values('crm_label_categories_v1',jsonb_build_object(lid::text,case when sale then 'Ventas' else 'Ofertas' end),now())
 on conflict(key) do update set value=(case when jsonb_typeof(public.app_settings.value)='object' then public.app_settings.value else '{}'::jsonb end)||excluded.value,updated_at=now();
 if sale or tracked.sold_at is null then
   insert into public.crm_contact_labels(contact_id,label_id) values(cid,lid) on conflict(contact_id,label_id) do nothing;
 end if;
 if sale then
   insert into crm_private.opportunity_month_labels(opportunity_id,contact_id,sale_label_id,sold_at) values(oid,cid,lid,stamp)
   on conflict(opportunity_id) do update set sale_label_id=excluded.sale_label_id,sold_at=excluded.sold_at;
   if tracked.offer_label_id is not null and not exists(select 1 from crm_private.opportunity_month_labels where contact_id=cid and offer_label_id=tracked.offer_label_id and sold_at is null) then
     delete from public.crm_contact_labels where contact_id=cid and label_id=tracked.offer_label_id;
   end if;
 else
   insert into crm_private.opportunity_month_labels(opportunity_id,contact_id,offer_label_id,offered_at) values(oid,cid,lid,stamp)
   on conflict(opportunity_id) do update set offer_label_id=excluded.offer_label_id,offered_at=excluded.offered_at;
 end if;
 return jsonb_build_object('allow',true,'label',label_name);
end $$;
revoke all on function public.crm_lifecycle_month_label(uuid) from public, anon, authenticated;
grant execute on function public.crm_lifecycle_month_label(uuid) to service_role;
revoke all on function crm_private.month_label_name(text,timestamptz),crm_private.lifecycle_job_context(),crm_private.lifecycle_label_removed(),crm_private.lifecycle_stage_changed(),crm_private.lifecycle_incoming() from public, anon, authenticated;

-- Validate activation on the server, including toggles outside the builder.
create or replace function crm_private.lifecycle_validate_rule()
returns trigger language plpgsql security definer set search_path='' as $$
declare p jsonb:=new.action_config->'lifecycle'; s jsonb; previous text:=''; has_opp boolean:=false; has_month boolean:=false; has_send boolean:=false; sid text;
begin
 if coalesce(p->>'mode','') not in ('offer','after_sale') or not new.enabled then return new; end if;
 if new.action_type<>'flow_v1' then raise exception 'Estas protecciones requieren un flujo'; end if;
 if p->>'mode'='offer' then
   if new.trigger_type<>'label_assigned' or not exists(select 1 from public.crm_labels where id::text=new.trigger_config->>'label_id') then raise exception 'Elige una etiqueta de seguimiento válida'; end if;
   if jsonb_typeof(p->'stop_stage_ids') is distinct from 'array' then raise exception 'Elige Pendiente de tramitar y Tramitado'; end if;
   if jsonb_array_length(p->'stop_stage_ids')<>2 or p#>>'{stop_stage_ids,0}'=p#>>'{stop_stage_ids,1}' then raise exception 'Elige dos columnas distintas'; end if;
   for sid in select jsonb_array_elements_text(p->'stop_stage_ids') loop
     if not exists(select 1 from public.sales_stages where id::text=sid and active) then raise exception 'Columna de parada no válida'; end if;
   end loop;
 else
   if new.trigger_type<>'opportunity_stage' or not exists(select 1 from public.sales_stages where id::text=new.trigger_config->>'stage_id' and active) then raise exception 'Elige la columna Tramitado'; end if;
   has_opp:=true;
 end if;
 if jsonb_typeof(new.action_config->'steps') is distinct from 'array' then raise exception 'Añade los pasos'; end if;
 for s in select value from jsonb_array_elements(new.action_config->'steps') loop
   if s->>'kind'='action' then
     if s->>'action_type'='create_opportunity' then
       if has_opp then raise exception 'El flujo ya tiene una oportunidad vinculada'; end if;
       if not exists(select 1 from public.sales_stages where id::text=s#>>'{config,stage_id}' and active) then raise exception 'Elige la columna inicial de la oportunidad'; end if;
       if coalesce(p->'stop_stage_ids','[]'::jsonb) ? (s#>>'{config,stage_id}') then raise exception 'La oferta debe comenzar antes de tramitación'; end if;
       has_opp:=true;
     elsif s->>'action_type' in ('send_template','send_whatsapp_now') then
       if not has_opp then raise exception 'Vincula la oportunidad antes de enviar'; end if;
       if s->>'action_type'='send_template' and not exists(select 1 from public.wa_templates where id::text=s#>>'{config,template_id}' and user_id=new.user_id) then raise exception 'Elige una plantilla propia en cada envío'; end if;
       if s->>'action_type'='send_whatsapp_now' and btrim(coalesce(s#>>'{config,text}',''))='' then raise exception 'Escribe el mensaje'; end if;
       has_send:=true;
     elsif s->>'action_type'='record_offer_month' then
       if p->>'mode'<>'offer' or previous not in ('send_template','send_whatsapp_now') or not has_opp or has_month then raise exception 'Registra OFERTA una vez, justo después de enviar la oferta'; end if;
       has_month:=true;
     elsif s->>'action_type'='record_sale_month' then
       if p->>'mode'<>'after_sale' or previous<>'' or has_month then raise exception 'Registra VENTAS al principio de Tramitado'; end if;
       has_month:=true;
     elsif s->>'action_type' not in ('create_task','assign_label','move_opportunity') then raise exception 'Acción no compatible';
     end if;
     previous:=s->>'action_type';
   elsif s->>'kind'='wait' then
     if coalesce(s->>'unit','') not in ('minutes','hours','days','weeks') or coalesce((s->>'value')::numeric,-1)<0 then raise exception 'Configura las esperas'; end if;
     if p->>'mode'='after_sale' and not has_month then raise exception 'Registra VENTAS antes de esperar'; end if;
   elsif s->>'kind'='repeat' then
     if previous not in ('send_template','send_whatsapp_now') then raise exception 'Repite solo los mensajes, no la creación de oportunidades ni las etiquetas mensuales'; end if;
     if coalesce((s->>'times')::int,0) not between 1 and 100 or coalesce((s->>'every_value')::numeric,0)<=0 or coalesce(s->>'every_unit','') not in ('minutes','hours','days','weeks') then raise exception 'Configura la repetición'; end if;
   elsif s->>'kind'='condition' then
     if s->>'condition_type'<>'no_response' then raise exception 'Condición no compatible'; end if;
   else raise exception 'Paso no compatible'; end if;
 end loop;
 if not has_month or not has_send then raise exception 'Añade el registro mensual y al menos una plantilla o mensaje'; end if;
 return new;
end $$;
revoke all on function crm_private.lifecycle_validate_rule() from public, anon, authenticated;
drop trigger if exists crm_lifecycle_validate_rule on public.crm_automations;
create trigger crm_lifecycle_validate_rule before insert or update on public.crm_automations for each row execute function crm_private.lifecycle_validate_rule();
