-- Restore the exact function captured on 2026-09-20. No job replay.
BEGIN;
CREATE OR REPLACE FUNCTION public.crm_lifecycle_job_guard(p_job uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  j public.crm_server_automation_jobs%rowtype;p jsonb;cid uuid;oid uuid;offer_id uuid;
  reason text;prev public.crm_server_automation_jobs%rowtype;ph text;
begin
  select * into j from public.crm_server_automation_jobs where id=p_job;
  if not found or j.status<>'running' then return jsonb_build_object('allow',false,'reason','Ejecución detenida');end if;
  p:=j.context->'lifecycle';
  if coalesce(p->>'mode','') not in ('offer','after_sale') then return jsonb_build_object('allow',true,'context',j.context);end if;
  cid:=nullif(j.context->>'contact_id','')::uuid;
  oid:=nullif(j.context->>'opportunity_id','')::uuid;
  offer_id:=nullif(j.context->>'offer_instance_id','')::uuid;
  ph:=public.crm_server_normalize_phone(j.context->>'phone');
  if j.action_type in ('record_offer_month','record_sale_month') then
    if cid is null or oid is null or not exists(select 1 from public.sales_opportunities where id=oid and record_id=cid) then reason:='Oportunidad no disponible';end if;
  elsif not public.crm_server_automations_enabled() then reason:='Motor pausado';
  elsif not exists(select 1 from public.crm_automations where id=j.automation_id and enabled) then reason:='Automatización pausada';
  elsif cid is null or not exists(select 1 from public.records where id=cid) then reason:='Contacto no disponible';
  elsif exists(select 1 from public.crm_automation_contact_exclusions where automation_id=j.automation_id and contact_id=cid) then reason:='Contacto excluido';
  elsif exists(select 1 from crm_private.commercial_optouts where phone=ph or contact_id=cid) then reason:='Baja comercial solicitada';
  elsif p->>'mode'='offer' then
    if nullif(p->>'label_id','') is not null and not exists(select 1 from public.crm_contact_labels where contact_id=cid and label_id::text=p->>'label_id') then reason:='Etiqueta de seguimiento retirada';
    elsif exists(select 1 from public.sales_opportunities o where o.record_id=cid and (oid is null or o.id=oid) and coalesce(p->'stop_stage_ids','[]'::jsonb) ? o.stage_id::text) then reason:='Oferta pasa a tramitación';
    elsif offer_id is not null and exists(select 1 from public.crm_offer_response_states where offer_instance_id=offer_id) then reason:='Cliente eligió una respuesta de la oferta';
    end if;
  elsif p->>'mode'='after_sale' then
    if oid is null or not exists(select 1 from public.sales_opportunities where id=oid and record_id=cid and stage_id::text=p->>'stage_id') then reason:='Oportunidad fuera de Tramitado';end if;
  end if;
  if reason is not null then
    update public.crm_server_automation_jobs set status='cancelled',error_message=reason,updated_at=now()
      where id=j.id and status in ('pending','running');
    return jsonb_build_object('allow',false,'reason',reason);
  end if;
  if nullif(j.action_config->>'__previous_event','') is not null then
    select * into prev from public.crm_server_automation_jobs where automation_id=j.automation_id and event_key=j.action_config->>'__previous_event';
    if not found or prev.status in ('pending','running') then return jsonb_build_object('allow',false,'retry',true,'reason','Esperando el paso anterior');end if;
    if prev.status<>'done' or exists(select 1 from public.crm_automation_runs where automation_id=prev.automation_id and event_key=prev.event_key and context->>'skipped'='true') then
      update public.crm_server_automation_jobs set status='cancelled',error_message='Paso anterior no completado',updated_at=now() where id=j.id and status='running';
      return jsonb_build_object('allow',false,'reason','Paso anterior no completado');
    end if;
  end if;
  return jsonb_build_object('allow',true,'context',j.context);
end $function$;

COMMIT;
