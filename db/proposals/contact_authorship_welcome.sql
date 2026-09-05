-- Authorship and opt-in welcome schema. Welcome starts disabled; activation is separate.
-- No existing contacts, labels, jobs or messages are created/updated by this file.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
create schema if not exists crm_private;
revoke all on schema crm_private from public;

do $$ declare t text; begin
 foreach t in array array['records','sales_opportunities','agenda_items','contact_activity','crm_contact_labels'] loop
  execute format('alter table public.%I add column if not exists crm_created_by uuid, add column if not exists crm_created_by_name text, add column if not exists crm_updated_by uuid, add column if not exists crm_updated_by_name text, add column if not exists crm_actor_kind text',t);
 end loop;
end $$;
alter table public.records add column if not exists crm_creation_origin text;
alter table public.records add column if not exists crm_responsible_id uuid;

create or replace function crm_private.stamp_actor() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); actor_name text; begin
 select nullif(btrim(display_name),'') into actor_name from public.user_permissions where user_id=actor;
 if tg_op='INSERT' then
  new.crm_created_by:=actor;new.crm_created_by_name:=actor_name;
  new.crm_actor_kind:=case when actor is not null then 'user' else 'system' end;
  if tg_table_name='records' then
   new.crm_creation_origin:=case when current_setting('tpf.contact_origin',true)='manual' then 'manual' else 'unclassified' end;
  end if;
 else
  new.crm_created_by:=old.crm_created_by;new.crm_created_by_name:=old.crm_created_by_name;new.crm_actor_kind:=old.crm_actor_kind;
  if tg_table_name='records' then new.crm_creation_origin:=old.crm_creation_origin;end if;
 end if;
 new.crm_updated_by:=actor;new.crm_updated_by_name:=actor_name;return new;
end $$;
do $$ declare t text;begin
 foreach t in array array['records','sales_opportunities','agenda_items','contact_activity','crm_contact_labels'] loop
  execute format('create trigger crm_stamp_actor before insert or update on public.%I for each row execute function crm_private.stamp_actor()',t);
 end loop;
end $$;

-- Keep unchanged assignments (including their original actor and timestamp).
create or replace function public.crm_set_contact_labels(p_contact_id uuid,p_label_ids uuid[]) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_contact_id::text,0));
 perform 1 from public.records where id=p_contact_id;
 if not found then raise exception 'Contacto no accesible';end if;
 delete from public.crm_contact_labels where contact_id=p_contact_id and not(label_id=any(coalesce(p_label_ids,'{}'::uuid[])));
 insert into public.crm_contact_labels(contact_id,label_id)
 select p_contact_id,x from (select distinct unnest(coalesce(p_label_ids,'{}'::uuid[])) x) a where x is not null on conflict do nothing;
end $$;

create table public.crm_welcome_settings (
 id boolean primary key default true check(id), enabled boolean not null default false,
 label_id uuid references public.crm_labels(id), automation_id uuid references public.crm_automations(id),
 message text not null default 'Hola {{nombre_cliente}}, soy {{nombre_usuario}}, de The Phone Face. Estoy aquí para ayudarte.'
);
alter table public.crm_welcome_settings enable row level security;
revoke all on public.crm_welcome_settings from anon,authenticated;
grant select on public.crm_welcome_settings to authenticated;
create policy welcome_settings_read on public.crm_welcome_settings for select to authenticated using(public.current_user_is_admin() or public.current_user_can('can_view_database'));
-- Configuration is deliberately a separate activation step, not part of this migration.

create table public.crm_welcome_requests (
 contact_id uuid primary key references public.records(id) on delete cascade,
 requested_by uuid not null,requested_at timestamptz not null default now(),
 actor_id uuid,actor_name text,job_id uuid unique references public.crm_server_automation_jobs(id),
 status text not null default 'requested' check(status in ('requested','pending','running','sent','failed','cancelled')),
 sent_at timestamptz,error_message text
);
alter table public.crm_welcome_requests enable row level security;
revoke all on public.crm_welcome_requests from anon,authenticated;
grant select,insert on public.crm_welcome_requests to authenticated;
create policy welcome_read on public.crm_welcome_requests for select to authenticated using(exists(select 1 from public.records r where r.id=contact_id));
create policy welcome_request on public.crm_welcome_requests for insert to authenticated with check(requested_by=auth.uid() and status='requested' and actor_id is null and actor_name is null and job_id is null and sent_at is null and exists(select 1 from public.records r where r.id=contact_id and r.crm_created_by=auth.uid() and r.crm_creation_origin='manual' and r.created_at>now()-interval '5 minutes'));

create or replace function public.crm_welcome_capability() returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object('installed',true,'enabled',coalesce((select enabled and label_id is not null and automation_id is not null from public.crm_welcome_settings where id),false));
$$;
revoke all on function public.crm_welcome_capability() from public,anon;
grant execute on function public.crm_welcome_capability() to authenticated;

-- One transaction: create, opt in, then assign labels. Imports never call this RPC.
create or replace function public.crm_create_contact_with_welcome(p_data jsonb,p_labels uuid[],p_welcome boolean default false) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare cid uuid;cfg public.crm_welcome_settings%rowtype;labels uuid[]:=coalesce(p_labels,'{}'::uuid[]);begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_welcome then
  select * into cfg from public.crm_welcome_settings where id and enabled;
  if not found or cfg.label_id is null or cfg.automation_id is null then raise exception 'Bienvenida pendiente de activar';end if;
  if not(public.current_user_is_admin() or public.current_user_can('can_use_whatsapp')) then raise exception 'No tienes permiso para enviar la bienvenida';end if;
  labels:=array_append(labels,cfg.label_id);
 end if;
 perform set_config('tpf.contact_origin','manual',true);
 insert into public.records(source_sheet,data) values('BASE DE DATOS',p_data) returning id into cid;
 perform set_config('tpf.contact_origin','',true);
 if p_welcome then insert into public.crm_welcome_requests(contact_id,requested_by) values(cid,auth.uid());end if;
 perform public.crm_set_contact_labels(cid,labels);
 return cid;
end $$;
revoke all on function public.crm_create_contact_with_welcome(jsonb,uuid[],boolean) from public,anon;
grant execute on function public.crm_create_contact_with_welcome(jsonb,uuid[],boolean) to authenticated;

-- Private trigger hook: snapshots the assigning user; no access to HTTP secrets.
create or replace function crm_private.enqueue_welcome(p_contact uuid,p_label uuid,p_actor uuid,p_actor_name text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare cfg public.crm_welcome_settings%rowtype;req public.crm_welcome_requests%rowtype;r public.crm_automations%rowtype;ctx jsonb;body text;jid uuid;begin
 select * into cfg from public.crm_welcome_settings where id;
 if not found or cfg.label_id is distinct from p_label then return false;end if;
 -- A configured welcome label must never bypass opt-in through the old trigger.
 if not cfg.enabled or p_actor is null or nullif(btrim(p_actor_name),'') is null then return true;end if;
 select * into req from public.crm_welcome_requests where contact_id=p_contact for update;
 if not found or req.status<>'requested' or req.job_id is not null then return true;end if;
 if not exists(select 1 from public.records where id=p_contact and crm_creation_origin='manual') then return true;end if;
 select * into r from public.crm_automations where id=cfg.automation_id and enabled;
 if not found or r.action_type<>'__send_whatsapp' then raise exception 'Configuración de bienvenida no válida';end if;
 ctx:=public.crm_server_context_for_contact(p_contact,null)||jsonb_build_object('actor_id',p_actor,'actor_name',p_actor_name,'welcome',true);
 if coalesce(ctx->>'phone','')='' then raise exception 'Falta el teléfono de la bienvenida';end if;
 body:=replace(replace(cfg.message,'{{nombre_cliente}}',coalesce(ctx->>'name','')),'{{nombre_usuario}}',p_actor_name);
 if body like '%{{%' then raise exception 'Variable de bienvenida desconocida';end if;
 if not public.crm_server_automations_enabled() then raise exception 'Motor de automatizaciones desactivado';end if;
 -- Unique contact request + stable event key prevent remove/re-add and double-click duplicates.
 insert into public.crm_server_automation_jobs(automation_id,user_id,event_key,action_type,action_config,context,run_at)
 values(r.id,r.user_id,'welcome:'||p_contact::text,'__send_whatsapp',jsonb_build_object('text',body),ctx,now())
 on conflict(automation_id,event_key) do nothing returning id into jid;
 if jid is null then raise exception 'La bienvenida ya tiene una ejecución registrada';end if;
 update public.crm_welcome_requests set actor_id=p_actor,actor_name=p_actor_name,job_id=jid,status='pending' where contact_id=p_contact;
 return true;
end $$;
revoke all on function crm_private.enqueue_welcome(uuid,uuid,uuid,text) from public,anon,authenticated;

create or replace function crm_private.welcome_job_status() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.event_key not like 'welcome:%' then return new;end if;
 update public.crm_welcome_requests set status=case new.status when 'done' then 'sent' when 'failed' then 'failed' when 'cancelled' then 'cancelled' when 'running' then 'running' else 'pending' end,
 sent_at=case when new.status='done' then coalesce(sent_at,new.completed_at,now()) else sent_at end,error_message=new.error_message where job_id=new.id;
 return new;
end $$;
create trigger crm_welcome_job_status after update of status on public.crm_server_automation_jobs for each row execute function crm_private.welcome_job_status();

-- Author display is read through existing RLS, not an unrestricted user directory.
create or replace function public.crm_contact_authorship(p_contact_id uuid) returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object(
 'contact',to_jsonb(r),
 'tasks',coalesce((select jsonb_agg(to_jsonb(t)) from public.agenda_items t where t.related_record_id=r.id),'[]'::jsonb),
 'opportunities',coalesce((select jsonb_agg(to_jsonb(o)) from public.sales_opportunities o where o.record_id=r.id),'[]'::jsonb),
 'activity',coalesce((select jsonb_agg(to_jsonb(a)) from (select * from public.contact_activity where contact_id=r.id order by created_at desc limit 100) a),'[]'::jsonb),
 'labels',coalesce((select jsonb_agg(jsonb_build_object('name',l.name,'crm_created_by_name',cl.crm_created_by_name,'created_at',cl.created_at)) from public.crm_contact_labels cl join public.crm_labels l on l.id=cl.label_id where cl.contact_id=r.id),'[]'::jsonb),
 'welcome',(select to_jsonb(w) from public.crm_welcome_requests w where w.contact_id=r.id))
 from public.records r where r.id=p_contact_id;
$$;
revoke all on function public.crm_contact_authorship(uuid) from public,anon;
grant execute on function public.crm_contact_authorship(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.crm_server_on_label_assigned()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.crm_automations%rowtype;
  ctx jsonb;
begin
  if crm_private.enqueue_welcome(new.contact_id,new.label_id,new.crm_created_by,new.crm_created_by_name) then return new;end if;
  if not public.crm_server_automations_enabled() then return new; end if;
  ctx := public.crm_server_context_for_contact(new.contact_id,null)
    || jsonb_build_object(
      'label_id',new.label_id,
      'actor_id',new.crm_created_by,
      'actor_name',new.crm_created_by_name,
      'event_at',new.created_at,
      'event_date',(new.created_at at time zone 'Europe/Madrid')::date,
      'trigger_type','label_assigned'
    );
  for r in
    select * from public.crm_automations
    where enabled
      and trigger_type='label_assigned'
      and coalesce(trigger_config->>'label_id','')=new.label_id::text
  loop
    perform public.crm_server_enqueue(
      r,
      'label:'||new.contact_id::text||':'||new.label_id::text||':'||extract(epoch from new.created_at)::bigint,
      ctx
    );
  end loop;
  return new;
end;
$function$;


-- Record meaningful changes without logging every background updated_at refresh.
create or replace function crm_private.audit_entity() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare cid uuid;title_text text;old_row jsonb;new_row jsonb;begin
 if tg_table_name='records' then cid:=new.id;title_text:=case when tg_op='INSERT' then 'Cliente creado' else 'Datos del cliente actualizados' end;
 elsif tg_table_name='sales_opportunities' then cid:=new.record_id;title_text:=case when tg_op='INSERT' then 'Oportunidad creada' else 'Oportunidad actualizada' end;
 else cid:=new.related_record_id;title_text:='Tarea actualizada';end if;
 if cid is null then return new;end if;
 if tg_op='UPDATE' then
  old_row:=to_jsonb(old)-array['updated_at','crm_updated_by','crm_updated_by_name'];
  new_row:=to_jsonb(new)-array['updated_at','crm_updated_by','crm_updated_by_name'];
  if old_row=new_row then return new;end if;
 end if;
 insert into public.contact_activity(contact_id,activity_type,title,description,created_by)
 values(cid,'audit_change',title_text,case when tg_table_name='records' then '' else coalesce(to_jsonb(new)->>'title','') end,auth.uid());
 return new;
end $$;
create trigger crm_audit_record after insert or update on public.records for each row execute function crm_private.audit_entity();
create trigger crm_audit_opportunity after insert or update on public.sales_opportunities for each row execute function crm_private.audit_entity();
create trigger crm_audit_task after update of title,description,status,assigned_to,starts_at,reminder_at on public.agenda_items for each row execute function crm_private.audit_entity();
revoke all on function crm_private.stamp_actor(),crm_private.audit_entity(),crm_private.welcome_job_status() from public,anon,authenticated;
commit;
