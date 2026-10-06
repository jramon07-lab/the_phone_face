-- Pausing an offer reminder pauses the whole shared follow-up, never another offer.
CREATE OR REPLACE FUNCTION public.crm_set_automation_job_pause(p_job_id uuid,p_paused boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare j public.crm_server_automation_jobs%rowtype; f public.crm_offer_instances%rowtype;
leader uuid; ids uuid[]; result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into j from public.crm_server_automation_jobs where id=p_job_id and user_id=auth.uid();
 if not found then raise exception 'Envío no encontrado';end if;
 if j.action_config->>'offer_phase' in ('reminder_2','reminder_5')
    and nullif(j.context->>'offer_instance_id','') is not null then
  select * into f from public.crm_offer_instances where id=(j.context->>'offer_instance_id')::uuid and created_by=auth.uid();
  if not found then raise exception 'Oferta no encontrada';end if;
  leader:=coalesce(nullif(f.snapshot->>'group_leader_offer_id','')::uuid,f.id);
  perform pg_advisory_xact_lock(hashtextextended(leader::text,0));
  select * into f from public.crm_offer_instances where id=leader and created_by=auth.uid() for update;
  if not found or not(public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para pausar esta oferta';end if;
  select array_agg(id) into ids from public.crm_offer_instances
   where created_by=auth.uid() and (id=leader or snapshot->>'group_leader_offer_id'=leader::text);
  perform 1 from public.crm_server_automation_jobs
   where user_id=auth.uid() and context->>'offer_instance_id'=any(select unnest(ids)::text)
    and status in ('pending','paused','running','failed') order by id for update;
  select * into j from public.crm_server_automation_jobs where id=p_job_id and user_id=auth.uid();
  if exists(select 1 from public.crm_server_automation_jobs
     where user_id=auth.uid() and context->>'offer_instance_id'=any(select unnest(ids)::text)
       and (status='running' or status in ('pending','paused','failed') and action_config ? '__delivery_receipt'))
     then raise exception 'Hay un mensaje en envío o pendiente de confirmar. Espera antes de pausar';end if;
  if p_paused then
   if j.status not in ('pending','paused') or f.status not in ('following','paused','queued') then raise exception 'Solo se pausa un seguimiento activo';end if;
   update public.crm_server_automation_jobs set status='paused',error_message='Seguimiento completo pausado desde Control de envíos',updated_at=now()
    where user_id=auth.uid() and context->>'offer_instance_id'=any(select unnest(ids)::text)
      and status in ('pending','paused');
   -- Remove timed wake-ups: this is an indefinite pause until explicitly resumed.
   update public.crm_server_automation_jobs set context=context-'timed_offer_pause'
    where user_id=auth.uid() and context->>'offer_instance_id'=any(select unnest(ids)::text) and status='paused';
   update public.crm_offer_instances set status='paused',paused_at=coalesce(paused_at,now()),
    pause_reason='Pausado desde Control de envíos',resume_at=null,resume_job_id=null,updated_at=clock_timestamp()
    where created_by=auth.uid() and id=any(ids) and status in ('following','paused','queued');
  else
   if f.status<>'paused' then raise exception 'Este seguimiento no está pausado';end if;
   -- Compatibility for older clients; current UI asks for the exact resumption time.
   result:=public.crm_resume_offer_at(f.id,'days',null,f.updated_at);
   if not coalesce((result->>'ok')::boolean,false) then raise exception 'No se pudo reanudar el seguimiento';end if;
  end if;
  return true;
 end if;
 select * into j from public.crm_server_automation_jobs where id=p_job_id and user_id=auth.uid() for update;
 if p_paused then
  if j.status<>'pending' then raise exception 'Solo se pueden pausar envíos pendientes';end if;
  update public.crm_server_automation_jobs set status='paused',error_message='Pausado manualmente',updated_at=now()
   where id=j.id and user_id=auth.uid() and status='pending';
 else
  if j.status<>'paused' then raise exception 'Este envío no está pausado';end if;
  update public.crm_server_automation_jobs set status='pending',run_at=greatest(run_at,now()+interval '1 minute'),
   error_message=null,completed_at=null,updated_at=now() where id=j.id and user_id=auth.uid() and status='paused';
 end if;
 return true;
end;$function$;
revoke all on function public.crm_set_automation_job_pause(uuid,boolean) from public,anon;
grant execute on function public.crm_set_automation_job_pause(uuid,boolean) to authenticated;
