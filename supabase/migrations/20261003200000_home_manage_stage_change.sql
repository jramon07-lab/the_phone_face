-- Change a commercial stage atomically with the versions reviewed in Gestionar.
-- The caller retains its normal RLS permissions; official activation remains Excel-owned.
create function public.crm_change_offer_stage(
 p_offer_id uuid,p_expected_offer_at timestamptz,p_expected_opportunity_at timestamptz,p_stage text,
 p_preferences jsonb default null,p_expected_installation_at timestamptz default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare f public.crm_offer_instances%rowtype;o public.sales_opportunities%rowtype;s public.sales_stages%rowtype;i public.crm_installations%rowtype;target text:=lower(btrim(p_stage));patch jsonb;
begin
 if auth.uid() is null or not(public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para cambiar el estado';end if;
 if target not in ('seguimiento','pendiente de tramitar','tramitado','perdido') then raise exception 'Estado no permitido. La activación llega del Excel mensual';end if;
 select * into f from public.crm_offer_instances where id=p_offer_id;
 if not found then raise exception 'Oferta no disponible';end if;
 select * into o from public.sales_opportunities where id=f.opportunity_id for update;
 if not found then raise exception 'Oportunidad no disponible';end if;
 select * into f from public.crm_offer_instances where id=p_offer_id for update;
 if not found or f.opportunity_id is distinct from o.id then raise exception 'La oferta cambió en otro dispositivo. Cierra y vuelve a abrir Gestionar';end if;
 if p_expected_offer_at is null or p_expected_opportunity_at is null or f.updated_at is distinct from p_expected_offer_at or o.updated_at is distinct from p_expected_opportunity_at then raise exception 'La oportunidad o la oferta cambió en otro dispositivo. Cierra y vuelve a abrir Gestionar';end if;
 if o.installation_date is not null or exists(select 1 from public.sales_stages where id=o.stage_id and lower(btrim(name))='ganado') then raise exception 'La activación está registrada en el Excel mensual';end if;
 select * into s from public.sales_stages where active and pipeline_id=o.pipeline_id and lower(btrim(name))=target order by position,id limit 1;
 if not found then raise exception 'No está disponible la columna % en este panel de ventas',target;end if;
 if o.stage_id=s.id and target<>'tramitado' then return jsonb_build_object('opportunity',to_jsonb(o),'offer',to_jsonb(f));end if;
 if target='tramitado' then
  if p_preferences is null or p_preferences->>'workflow' is distinct from 'installation_v1' then raise exception 'Revisa la cita y el aviso antes de confirmar la tramitación';end if;
  select * into i from public.crm_installations where opportunity_id=o.id;
  if i.id is not null and (p_expected_installation_at is null or i.updated_at is distinct from p_expected_installation_at) or i.id is null and p_expected_installation_at is not null then raise exception 'La instalación cambió en otro dispositivo. Cierra y vuelve a abrir Gestionar';end if;
  update public.sales_opportunities set stage_id=s.id,position=0,status='open',after_sale_preferences=p_preferences,updated_at=clock_timestamp() where id=o.id returning * into o;
  -- Re-entering Tramitado edits the existing installation; it never creates a second one.
  if i.id is not null then
   patch:='{}'::jsonb;
   if nullif(p_preferences->>'appointment_date','')::date is distinct from i.appointment_date or nullif(p_preferences->>'time_from','')::time is distinct from i.time_from or nullif(p_preferences->>'time_to','')::time is distinct from i.time_to then patch:=patch||jsonb_build_object('appointment_date',p_preferences->'appointment_date','time_from',p_preferences->'time_from','time_to',p_preferences->'time_to');end if;
   if p_preferences->>'text' is distinct from i.notice_text then patch:=patch||jsonb_build_object('text',p_preferences->>'text');end if;
   if p_preferences->>'return_text' is distinct from i.return_text then patch:=patch||jsonb_build_object('return_text',p_preferences->>'return_text');end if;
   if p_preferences->>'previous_operator' is distinct from i.previous_operator then patch:=patch||jsonb_build_object('previous_operator',p_preferences->>'previous_operator');end if;
   if coalesce((p_preferences->>'send')::boolean,false) then patch:=patch||jsonb_build_object('send',true);end if;
   -- The existing write RPC locks the installation and checks its version without granting direct UPDATE.
   perform public.crm_installation_update(o.id,i.updated_at,patch);
  end if;
 else
  if target='pendiente de tramitar' then perform public.crm_control_offer_composition(f.id,'accept');
  else
   -- Stop the old follow-up (including its message group) before changing the stage.
   if f.status in ('queued','following','paused','error') and not exists(select 1 from public.crm_installations where opportunity_id=o.id) then perform public.crm_control_offer_composition(f.id,'pause');end if;
  end if;
  update public.sales_opportunities set stage_id=s.id,position=0,status=case when target='perdido' then 'lost' else 'open' end,updated_at=clock_timestamp() where id=o.id returning * into o;
  if target='seguimiento' then update public.crm_offer_instances set status='following',updated_at=clock_timestamp() where id=f.id;end if;
 end if;
 select * into f from public.crm_offer_instances where id=f.id;
 return jsonb_build_object('opportunity',to_jsonb(o),'offer',to_jsonb(f));
end;$$;
revoke all on function public.crm_change_offer_stage(uuid,timestamptz,timestamptz,text,jsonb,timestamptz) from public,anon;
grant execute on function public.crm_change_offer_stage(uuid,timestamptz,timestamptz,text,jsonb,timestamptz) to authenticated;

-- Editing or explicitly resending a notice works even when its date is unchanged.
-- Dispatch guards cover text and time edits as well as date edits.
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


-- Returning a sale to Seguimiento or Perdido removes it from pending installations.
-- Legacy Tramitado rows without an installation record or Excel date are commercial history.
-- Exclude them from the installation register without changing sales, tags or jobs.
create or replace function public.crm_installations_list() returns setof jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_view_sales')) then raise exception 'No tienes permiso';end if;
 return query select coalesce(to_jsonb(i),'{}'::jsonb)||jsonb_build_object('opportunity_id',o.id,'client_name',o.client_name,'operator',coalesce(i.operator,f.operator,o.installation_operator,o.after_sale_preferences->>'operator',o.title),'price',o.amount,'notice_status',nj.status,'return_status',rj.status,'incident',coalesce(nullif(i.incident,''),case when rj.status='failed' then rj.error_message when nj.status='failed' then nj.error_message end,''),'offer_instance_id',coalesce(i.offer_instance_id,f.id),'offer_sent',f.sent_at is not null,'excel_date',o.installation_date,'status',case when o.installation_date is not null then 'excel' when coalesce(i.incident,'')<>'' or nj.status='failed' or rj.status='failed' then 'incident' when i.installed_on is not null then 'confirmed' when i.appointment_date is not null then 'scheduled' else 'undated' end,'legacy',i.id is null)
 from public.sales_opportunities o join public.sales_stages s on s.id=o.stage_id left join public.crm_installations i on i.opportunity_id=o.id
 left join public.crm_server_automation_jobs nj on nj.id=i.notice_job_id left join public.crm_server_automation_jobs rj on rj.id=i.return_job_id
 left join lateral(select * from public.crm_offer_instances where opportunity_id=o.id order by created_at desc limit 1) f on true
 where (i.id is not null and lower(btrim(s.name)) in ('tramitado','ganado')) or o.installation_date is not null
 order by i.appointment_date nulls last,i.time_from nulls last,o.created_at,o.id;
end;$$;
revoke all on function public.crm_installations_list() from public,anon;
grant execute on function public.crm_installations_list() to authenticated;


notify pgrst,'reload schema';
