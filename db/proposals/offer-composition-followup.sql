CREATE OR REPLACE FUNCTION public.crm_offer_delivery_status(p_offer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  uid uuid:=auth.uid();
  inst public.crm_offer_instances%rowtype;
  opp public.sales_opportunities%rowtype;
  stage_name text;
  root_count integer:=0;
  initial_count integer:=0;
  initial_done integer:=0;
  initial_failed integer:=0;
  pending_count integer:=0;
  failed_count integer:=0;
  last_error text;
  delivery text;
  delivery_id uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into inst from public.crm_offer_instances where id=p_offer_id;
  if not found then raise exception 'Oferta no encontrada'; end if;
  select * into opp from public.sales_opportunities where id=inst.opportunity_id;
  select s.name into stage_name from public.sales_stages s where s.id=opp.stage_id;

  delivery_id:=coalesce(nullif(inst.snapshot->>'group_leader_offer_id','')::uuid,inst.id);
  if delivery_id<>inst.id and not exists(select 1 from public.crm_offer_instances l where l.id=delivery_id and l.created_by=inst.created_by and l.snapshot->'offer_group_ids' ? inst.id::text) then raise exception 'Grupo de oferta inválido';end if;

  select
    count(*) filter(where j.action_type='flow_v1' and (j.event_key='manual-offer:'||delivery_id or j.event_key='manual-offer-accepted:'||delivery_id)),
    count(*) filter(where j.action_type='__send_whatsapp' and coalesce(j.action_config->>'offer_phase','') in ('initial','accepted','direct_sale')),
    count(*) filter(where j.action_type='__send_whatsapp' and coalesce(j.action_config->>'offer_phase','') in ('initial','accepted','direct_sale') and j.status='done'),
    count(*) filter(where j.action_type='__send_whatsapp' and coalesce(j.action_config->>'offer_phase','') in ('initial','accepted','direct_sale') and j.status='failed'),
    count(*) filter(where j.status in ('pending','running')),
    count(*) filter(where j.status='failed'),
    (array_agg(j.error_message order by j.updated_at desc) filter(where j.error_message is not null))[1]
  into root_count,initial_count,initial_done,initial_failed,pending_count,failed_count,last_error
  from public.crm_server_automation_jobs j
  where j.user_id=uid and j.context->>'offer_instance_id'=delivery_id::text;

  delivery:=case
    when inst.sent_at is not null and initial_done>0 then 'sent'
    when initial_failed>0 or (failed_count>0 and inst.sent_at is null) then 'failed'
    when initial_count>0 or root_count>0 then 'queued'
    else 'not_requested'
  end;

  return jsonb_build_object(
    'offer_id',inst.id,'offer_exists',true,
    'opportunity_exists',opp.id is not null,'opportunity_id',opp.id,
    'opportunity_title',opp.title,'opportunity_stage',stage_name,
    'delivery',delivery,'sent_at',inst.sent_at,
    'root_job_count',root_count,'initial_job_count',initial_count,
    'pending_job_count',pending_count,'failed_job_count',failed_count,
    'last_error',last_error,
    'integrity_ok',(opp.id is not null and (delivery='not_requested' or root_count=1 or initial_done=1) and failed_count=0),
    'duplicate_jobs',(root_count>1 or initial_done>1)
  );
end;
$function$
;
create or replace function public.crm_control_offer_composition(p_offer_id uuid,p_action text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare inst public.crm_offer_instances%rowtype; leader public.crm_offer_instances%rowtype; ids uuid[]; r jsonb; old_context jsonb; resumed_id uuid;
begin
 select * into inst from public.crm_offer_instances where id=p_offer_id;
 if not found then raise exception 'Oferta no encontrada';end if;
 if inst.snapshot->>'composition' is distinct from 'group' then return public.crm_control_offer(p_offer_id,p_action);end if;
 if inst.created_by<>auth.uid() or not(public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para modificar este grupo';end if;
 select * into leader from public.crm_offer_instances where id=(inst.snapshot->>'group_leader_offer_id')::uuid and created_by=auth.uid();
 if not found or not(leader.snapshot->'offer_group_ids' ? inst.id::text) then raise exception 'Grupo de ofertas inválido';end if;
 select array_agg(id) into ids from public.crm_offer_instances where created_by=auth.uid() and snapshot->>'group_leader_offer_id'=leader.id::text;
 perform pg_advisory_xact_lock(hashtextextended(leader.id::text,0));
 if p_action='accept' then
  r:=public.crm_control_offer(p_offer_id,p_action);
  update public.crm_server_automation_jobs set status='cancelled',error_message='Cliente respondió: servicio aceptado; revisar el resto del grupo',updated_at=now() where user_id=auth.uid() and context->>'offer_instance_id'=leader.id::text and status in ('pending','running');
   update public.crm_offer_instances set status='paused' where id=any(ids) and status in ('queued','following');
 elsif p_action in ('pause','cancel') then
  r:=public.crm_control_offer(leader.id,p_action);
  update public.crm_offer_instances set status=case when p_action='pause' then 'paused' else 'cancelled' end where id=any(ids) and status in ('queued','following','paused','error');
 elsif p_action='resume' then
  if leader.status not in ('paused','following','queued') or exists(select 1 from public.crm_offer_instances where id=any(ids) and status in ('accepted','processed','won')) then raise exception 'Este grupo ya tiene un servicio aceptado. Prepara otro seguimiento para los servicios pendientes';end if;
  select context into old_context from public.crm_server_automation_jobs where user_id=auth.uid() and context->>'offer_instance_id'=leader.id::text and event_key='manual-offer:'||leader.id order by created_at limit 1;
  r:=public.crm_control_offer(leader.id,p_action);
  select id into resumed_id from public.crm_server_automation_jobs where user_id=auth.uid() and context->>'offer_instance_id'=leader.id::text and event_key like 'manual-offer-resume:%' order by created_at desc limit 1;
  update public.crm_server_automation_jobs j set context=coalesce(old_context,j.context)||jsonb_build_object('offer_group_ids',to_jsonb(ids),'event_at',now()),
  action_config=jsonb_set(action_config,'{steps}',(select jsonb_agg(case when value->>'kind'='action' then jsonb_set(value,'{config}',(value->'config')-'reply_buttons'||jsonb_build_object('text','Hola {nombre}, ¿has podido revisar las ofertas que te enviamos? Si tienes alguna duda, te ayudo por aquí.'),true) else value end order by ord) from jsonb_array_elements(action_config->'steps') with ordinality a(value,ord)),true) where j.id=resumed_id;
  update public.crm_offer_instances set status='following' where id=any(ids) and status='paused';
 else raise exception 'Acción no válida';end if;
 return r||jsonb_build_object('shared_followup',true);
end $$;
revoke all on function public.crm_control_offer_composition(uuid,text) from public,anon;
grant execute on function public.crm_control_offer_composition(uuid,text) to authenticated;
