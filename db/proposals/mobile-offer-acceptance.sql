-- Atomic mobile acceptance: date plan only; processing requires a separate reviewed confirmation.
create or replace function public.crm_accept_offer_mobile(
 p_offer_id uuid,p_expected_offer_at timestamptz,p_expected_opportunity_at timestamptz,
 p_processing_date date,p_appointment_date date default null,p_time_from time default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare f public.crm_offer_instances%rowtype;o public.sales_opportunities%rowtype;r jsonb;p jsonb;today date:=(now() at time zone 'Europe/Madrid')::date;
begin
 if auth.uid() is null or not(public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para aceptar ofertas';end if;
 select * into f from public.crm_offer_instances where id=p_offer_id;
 if not found then raise exception 'Oferta no disponible';end if;
 select * into o from public.sales_opportunities where id=f.opportunity_id for update;
 if not found then raise exception 'Oportunidad no disponible';end if;
 select * into f from public.crm_offer_instances where id=p_offer_id for update;
 if f.updated_at is distinct from p_expected_offer_at or o.updated_at is distinct from p_expected_opportunity_at or p_expected_offer_at is null or p_expected_opportunity_at is null then raise exception 'La oferta cambió en otro dispositivo. Vuelve a abrirla';end if;
 if f.status not in ('following','queued','paused','accepted') then raise exception 'Esta oferta ya no está pendiente de aceptar';end if;
 if p_processing_date is null or p_processing_date<today then raise exception 'Elige una fecha de tramitación de hoy o futura';end if;
 if (p_appointment_date is null)<>(p_time_from is null) or p_appointment_date<p_processing_date then raise exception 'Revisa la fecha y hora de instalación prevista';end if;
 p:=o.contract_party;
 if coalesce(public.crm_server_normalize_phone(p->>'recipient_phone'),'')='' then raise exception 'Revisa el destinatario del contrato antes de aceptar';end if;
 if public.crm_server_normalize_phone(coalesce(f.snapshot->'current_delivery_party'->>'recipient_phone',f.snapshot->>'recipient_phone')) is distinct from public.crm_server_normalize_phone(p->>'recipient_phone') then raise exception 'El destinatario de la oferta y el contrato no coinciden. Revisa titular y gestor';end if;
 r:=public.crm_change_offer_stage(f.id,p_expected_offer_at,p_expected_opportunity_at,'Pendiente de tramitar');
 update public.crm_offer_instances set snapshot=coalesce(snapshot,'{}'::jsonb)||jsonb_build_object('processing_date',p_processing_date,'mobile_acceptance_plan',jsonb_build_object('processing_date',p_processing_date,'appointment_date',p_appointment_date,'time_from',p_time_from)),resume_at=null,next_action='Tramitar contrato',next_action_at=(p_processing_date+'10:00'::time) at time zone 'Europe/Madrid',updated_at=clock_timestamp() where id=f.id;
 update public.sales_opportunities set expected_date=p_processing_date,after_sale_preferences=coalesce(after_sale_preferences,'{}'::jsonb)||jsonb_build_object('workflow','installation_v1','operator',f.operator,'previous_operator',coalesce(after_sale_preferences->>'previous_operator',f.snapshot->>'previous_operator',''),'send',false,'appointment_date',p_appointment_date,'time_from',p_time_from,'time_to',null),updated_at=clock_timestamp() where id=o.id returning * into o;
 update public.crm_server_automation_jobs set status='cancelled',error_message='Oferta aceptada: recordatorios detenidos',updated_at=clock_timestamp() where context->>'offer_instance_id'=f.id::text and status in ('pending','running') and (action_config->>'offer_phase' in ('reminder_2','reminder_5') or event_key like 'manual-offer:%' or event_key like 'manual-offer-resume:%');
 select * into f from public.crm_offer_instances where id=p_offer_id;
 return jsonb_build_object('opportunity',to_jsonb(o),'offer',to_jsonb(f));
end;$$;
revoke all on function public.crm_accept_offer_mobile(uuid,timestamptz,timestamptz,date,date,time) from public,anon;
grant execute on function public.crm_accept_offer_mobile(uuid,timestamptz,timestamptz,date,date,time) to authenticated;
