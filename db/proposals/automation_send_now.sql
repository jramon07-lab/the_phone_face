-- Advance the existing pending job; never create a second send.
create or replace function public.crm_send_automation_now(p_job_id uuid,p_expected_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.crm_server_automation_jobs%rowtype;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_use_whatsapp')) then raise exception 'No tienes permiso para enviar WhatsApp'; end if;
 select * into j from public.crm_server_automation_jobs where id=p_job_id and user_id=auth.uid() for update;
 if not found then raise exception 'Envío no disponible'; end if;
 if p_expected_at is null or j.updated_at is distinct from p_expected_at then raise exception 'El envío ha cambiado. Actualiza antes de continuar'; end if;
 if j.status <> 'pending' or j.completed_at is not null or j.action_config ? '__delivery_receipt' then raise exception 'Este envío ya se está procesando o no está pendiente'; end if;
 if j.action_type not in ('__send_whatsapp','send_template','schedule_whatsapp','send_whatsapp_now') then raise exception 'Este tipo de acción no permite envío inmediato'; end if;
 -- Offer reminders require the full follow-up flow, not an isolated advance.
 if coalesce(j.action_config->>'offer_phase','') in ('reminder_2','reminder_5') then raise exception 'Reanuda el seguimiento completo desde Gestionar origen'; end if;
 update public.crm_server_automation_jobs set run_at=now(),updated_at=clock_timestamp() where id=j.id returning * into j;
 if j.status='pending' and j.run_at <= now()+interval '2 minutes' then perform crm_private.dispatch_runner_now(); end if;
 return jsonb_build_object('id',j.id,'status',j.status,'run_at',j.run_at);
end $$;
revoke all on function public.crm_send_automation_now(uuid,timestamptz) from public,anon;
grant execute on function public.crm_send_automation_now(uuid,timestamptz) to authenticated;
