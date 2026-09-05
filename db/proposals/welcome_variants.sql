-- Two welcome variants; configuration remains disabled. No contact or job is created.
begin;
set local lock_timeout='5s';
alter table public.crm_welcome_settings add column offer_message text not null default 'Hola, {{nombre_cliente}} 👋 Soy {{nombre_usuario}}, de Phone House Albolote. Te paso por aquí la oferta que hemos comentado.';
alter table public.crm_welcome_requests add column variant text not null default 'general' check(variant in ('general','offer'));
insert into public.crm_welcome_settings(id,enabled,message,offer_message)
values(true,false,'Hola, {{nombre_cliente}} 👋 Soy {{nombre_usuario}}, de Phone House Albolote. Puedes contactar conmigo por aquí cuando lo necesites.','Hola, {{nombre_cliente}} 👋 Soy {{nombre_usuario}}, de Phone House Albolote. Te paso por aquí la oferta que hemos comentado.')
on conflict(id) do update set message=excluded.message,offer_message=excluded.offer_message;
CREATE OR REPLACE FUNCTION public.crm_create_contact_with_welcome_variant(p_data jsonb, p_labels uuid[], p_welcome boolean, p_variant text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cid uuid;cfg public.crm_welcome_settings%rowtype;labels uuid[]:=coalesce(p_labels,'{}'::uuid[]);begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_variant is null or p_variant not in ('general','offer') then raise exception 'Tipo de bienvenida no válido';end if;
 if p_welcome then
  select * into cfg from public.crm_welcome_settings where id and enabled;
  if not found or cfg.label_id is null or cfg.automation_id is null then raise exception 'Bienvenida pendiente de activar';end if;
  if not(public.current_user_is_admin() or public.current_user_can('can_use_whatsapp')) then raise exception 'No tienes permiso para enviar la bienvenida';end if;
  labels:=array_append(labels,cfg.label_id);
 end if;
 perform set_config('tpf.contact_origin','manual',true);
 insert into public.records(source_sheet,data) values('BASE DE DATOS',p_data) returning id into cid;
 perform set_config('tpf.contact_origin','',true);
 if p_welcome then insert into public.crm_welcome_requests(contact_id,requested_by,variant) values(cid,auth.uid(),p_variant);end if;
 perform public.crm_set_contact_labels(cid,labels);
 return cid;
end $function$;
CREATE OR REPLACE FUNCTION crm_private.enqueue_welcome(p_contact uuid, p_label uuid, p_actor uuid, p_actor_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
 body:=replace(replace(case req.variant when 'offer' then cfg.offer_message else cfg.message end,'{{nombre_cliente}}',coalesce(ctx->>'name','')),'{{nombre_usuario}}',p_actor_name);
 if body like '%{{%' then raise exception 'Variable de bienvenida desconocida';end if;
 if not public.crm_server_automations_enabled() then raise exception 'Motor de automatizaciones desactivado';end if;
 -- Unique contact request + stable event key prevent remove/re-add and double-click duplicates.
 insert into public.crm_server_automation_jobs(automation_id,user_id,event_key,action_type,action_config,context,run_at)
 values(r.id,r.user_id,'welcome:'||p_contact::text,'__send_whatsapp',jsonb_build_object('text',body),ctx,now())
 on conflict(automation_id,event_key) do nothing returning id into jid;
 if jid is null then raise exception 'La bienvenida ya tiene una ejecución registrada';end if;
 update public.crm_welcome_requests set actor_id=p_actor,actor_name=p_actor_name,job_id=jid,status='pending' where contact_id=p_contact;
 return true;
end $function$;
create or replace function public.crm_create_contact_with_welcome(p_data jsonb,p_labels uuid[],p_welcome boolean default false) returns uuid language sql security invoker set search_path=public,pg_temp as $$
 select public.crm_create_contact_with_welcome_variant(p_data,p_labels,p_welcome,'general');
$$;
revoke all on function public.crm_create_contact_with_welcome_variant(jsonb,uuid[],boolean,text) from public,anon;
grant execute on function public.crm_create_contact_with_welcome_variant(jsonb,uuid[],boolean,text) to authenticated;
commit;

