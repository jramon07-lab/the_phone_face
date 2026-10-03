-- Daily installation review and staff confirmation. No existing sales or jobs are rewritten.
alter table public.crm_installations add column confirmed_by uuid references auth.users(id) on delete set null, add column confirmation_source text not null default 'customer' check(confirmation_source in ('customer','store'));

create or replace function public.crm_installation_update(p_opportunity_id uuid,p_expected_at timestamptz,p_patch jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.crm_installations%rowtype;o public.sales_opportunities%rowtype;v jsonb;j uuid;phase text;appointment_changed boolean;notice_changed boolean;want_send boolean;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso';end if;
 select * into o from public.sales_opportunities where id=p_opportunity_id for update;
 select * into i from public.crm_installations where opportunity_id=p_opportunity_id for update;
 if not found then raise exception 'Instalación no disponible';end if;
 if i.updated_at is distinct from p_expected_at then raise exception 'La instalación cambió en otro dispositivo. Cierra y vuelve a abrir Gestionar';end if;
 want_send:=coalesce((p_patch->>'send')::boolean,false);
 appointment_changed:=(p_patch ? 'appointment_date' and nullif(p_patch->>'appointment_date','')::date is distinct from i.appointment_date) or (p_patch ? 'time_from' and nullif(p_patch->>'time_from','')::time is distinct from i.time_from) or (p_patch ? 'time_to' and nullif(p_patch->>'time_to','')::time is distinct from i.time_to);
 notice_changed:=appointment_changed or (p_patch ? 'text' and btrim(p_patch->>'text') is distinct from i.notice_text) or want_send;
 if not exists(select 1 from public.sales_stages where id=o.stage_id and lower(btrim(name)) in ('tramitado','ganado')) then raise exception 'Esta oportunidad ya no está Tramitada. Revisa su estado';end if;
 -- Staff confirmation uses the same authenticated, versioned write boundary as the editor.
 if p_patch ? 'confirm_installed_on' then
  if p_patch - array['confirm_installed_on','incident'] <> '{}'::jsonb then raise exception 'Confirma la instalación en un paso separado';end if;
  if i.installed_on is not null or o.installation_date is not null then raise exception 'La instalación ya está confirmada';end if;
  if nullif(p_patch->>'confirm_installed_on','') is null then raise exception 'Indica la fecha real de instalación';end if;
  if (p_patch->>'confirm_installed_on')::date>(now() at time zone 'Europe/Madrid')::date or (p_patch->>'confirm_installed_on')::date<(i.created_at at time zone 'Europe/Madrid')::date-30 then raise exception 'Revisa la fecha real de instalación: debe ser pasada o de hoy';end if;
  if exists(select 1 from public.crm_server_automation_jobs where context->>'installation_id'=i.id::text and context->>'installation_phase' in ('installation_notice','installation_date') and (status='running' or status in ('pending','paused') and action_config ? '__delivery_receipt')) then raise exception 'Hay un aviso en envío. Espera a que termine antes de confirmar';end if;
  update public.crm_server_automation_jobs set status='cancelled',error_message='Instalación confirmada desde la tienda',updated_at=now() where context->>'installation_id'=i.id::text and context->>'installation_phase' in ('installation_notice','installation_date') and status in ('pending','paused');
  update public.crm_installations set installed_on=(p_patch->>'confirm_installed_on')::date,confirmed_at=clock_timestamp(),confirmed_by=auth.uid(),confirmation_source='store',confirmation_message_id=null,awaiting_date=false,incident=case when p_patch ? 'incident' then left(btrim(p_patch->>'incident'),1000) else incident end,revision=revision+1,updated_at=clock_timestamp() where id=i.id;
  perform crm_private.installation_schedule_return(i.id);
  select to_jsonb(x) into v from public.crm_installations x where id=i.id;return v;
 end if;
 if (i.installed_on is not null or o.installation_date is not null) and notice_changed then raise exception 'La instalación ya está confirmada';end if;
 if appointment_changed and nullif(coalesce(p_patch->>'appointment_date',i.appointment_date::text),'')::date<(now() at time zone 'Europe/Madrid')::date then raise exception 'La cita no puede ser anterior a hoy';end if;
 if notice_changed then
  if exists(select 1 from public.crm_server_automation_jobs where id=i.notice_job_id and (status='running' or action_config ? '__delivery_receipt' and status='pending')) then raise exception 'El aviso está en envío. Espera a que termine antes de cambiarlo';end if;
  update public.crm_server_automation_jobs set status='cancelled',error_message='Aviso de instalación actualizado antes del envío',updated_at=now() where id=i.notice_job_id and status in ('pending','paused');
 end if;
 update public.crm_installations set
  appointment_date=case when p_patch ? 'appointment_date' then nullif(p_patch->>'appointment_date','')::date else appointment_date end,
  time_from=case when p_patch ? 'time_from' then nullif(p_patch->>'time_from','')::time else time_from end,
  time_to=case when p_patch ? 'time_to' then nullif(p_patch->>'time_to','')::time else time_to end,
  notice_text=case when p_patch ? 'text' then btrim(p_patch->>'text') else notice_text end,
  previous_operator=case when p_patch ? 'previous_operator' then btrim(p_patch->>'previous_operator') else previous_operator end,
  recipient_context=case when p_patch ? 'previous_operator' then jsonb_set(recipient_context,'{previous_operator}',to_jsonb(btrim(p_patch->>'previous_operator'))) else recipient_context end,
  return_text=case when p_patch ? 'return_text' then btrim(p_patch->>'return_text') else return_text end,
  incident=case when p_patch ? 'incident' then left(btrim(p_patch->>'incident'),1000) else incident end,
  revision=revision+1,updated_at=clock_timestamp() where id=i.id returning * into i;
 if (i.appointment_date is null)<>(i.time_from is null) then raise exception 'Indica la fecha y la hora de la cita';end if;
 if length(i.notice_text)>10000 or length(i.return_text)>10000 or length(i.previous_operator)>80 or i.previous_operator ~ '[[:cntrl:]]' then raise exception 'Revisa el operador o los textos';end if;
 if (p_patch ? 'previous_operator' or p_patch ? 'return_text') and i.return_job_id is not null then
  if exists(select 1 from public.crm_server_automation_jobs where id=i.return_job_id and (status in ('running','done','failed') or action_config ? '__delivery_receipt')) then raise exception 'La devolución ya está enviada o en envío. No se cambia automáticamente';end if;
  update public.crm_server_automation_jobs set status='cancelled',error_message='Instrucciones de devolución actualizadas',updated_at=now() where id=i.return_job_id and status in ('pending','paused','failed');
  update public.crm_installations set return_job_id=null,config_snapshot=config_snapshot||jsonb_build_object('return_time',crm_private.installation_config(i.previous_operator)->>'return_time') where id=i.id;
 end if;
 if want_send then
  if nullif(i.notice_text,'') is null then raise exception 'Escribe el mensaje de la cita';end if;
  j:=crm_private.installation_enqueue(i.id,'notice:'||i.revision,i.notice_text,jsonb_build_array(jsonb_build_object('buttonId','install_done:'||i.id,'buttonText','✓ Instalado')),'installation_notice',now());
  update public.crm_installations set notice_job_id=j,send_notice=true where id=i.id returning * into i;
 end if;
 if p_patch ? 'previous_operator' then
  update public.crm_offer_instances set snapshot=jsonb_set(coalesce(snapshot,'{}'::jsonb),'{previous_operator_override}',to_jsonb(i.previous_operator)),updated_at=clock_timestamp() where id=i.offer_instance_id;
  update public.crm_installations set config_snapshot=config_snapshot||jsonb_build_object('return_time',crm_private.installation_config(i.previous_operator)->>'return_time') where id=i.id;end if;
 perform crm_private.installation_schedule_return(i.id);
 select to_jsonb(x) into v from public.crm_installations x where id=i.id;return v;
end;$$;
revoke all on function public.crm_installation_update(uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.crm_installation_update(uuid,timestamptz,jsonb) to authenticated;


create or replace function public.crm_operator_communication_templates(p_operator text) returns setof jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_view_settings') or public.current_user_can('can_view_sales')) then raise exception 'No tienes permiso';end if;
 return query select distinct jsonb_build_object('rule_id',a.id,'rule_name',a.name,'template_id',t.id,'template_name',t.name,'body',t.body,'enabled',a.enabled,'trigger_type',a.trigger_type,'automation_code',a.trigger_config->>'automation_code','legacy',coalesce(a.trigger_config->>'automation_code','') like '%_day_one','stage_name',st.name,'label_name',lb.name,
 'schedule',case when a.trigger_config->>'automation_code' like '%_day_one' then 'Día siguiente a la tramitación, en horario comercial. Solo ventas anteriores al nuevo seguimiento de instalación.' when a.trigger_config->>'automation_code' like '%_security_3_months' then '3 meses después de pasar a '||coalesce(st.name,'la etapa configurada')||', en horario comercial.' when a.trigger_type='label_assigned' then 'Cuando se añade la etiqueta '||coalesce(lb.name,'configurada')||'. Se mantienen las esperas y condiciones de la regla.' else 'Regla existente: se mantienen sus fechas, etiquetas y condiciones.' end)
 from public.crm_automations a join public.wa_templates t on t.user_id=a.user_id and (exists(select 1 from jsonb_array_elements(coalesce(a.action_config->'steps','[]'::jsonb)) s where s#>>'{config,template_id}'=t.id::text) or t.id::text in (a.trigger_config->>'general_template_id',a.trigger_config->>'netflix_template_id'))
 left join public.sales_stages st on st.id::text=a.trigger_config->>'stage_id'
 left join public.crm_labels lb on lb.id::text=a.trigger_config->>'label_id'
 where lower(coalesce(a.trigger_config->>'automation_operator',a.trigger_config->>'operator',''))=lower(p_operator);
end;$$;
revoke all on function public.crm_operator_communication_templates(text) from public,anon;
grant execute on function public.crm_operator_communication_templates(text) to authenticated;

notify pgrst, 'reload schema';
