
create or replace function crm_private.installation_return_only(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare i public.crm_installations%rowtype;txt text;j uuid;
begin
 select * into i from public.crm_installations where id=p_id for update;
 if not found or i.return_job_id is not null then return;end if;
 if nullif(btrim(i.previous_operator),'') is null or i.previous_operator='Ninguno' or nullif(btrim(i.return_text),'') is null then raise exception 'Revisa el operador anterior y las instrucciones del router';end if;
 txt:=crm_private.contract_message(crm_private.installation_render(i.return_text,i.config_snapshot,i.recipient_context-'contract_party',i.appointment_date,i.time_from,i.time_to,i.installed_on),i.recipient_context->'contract_party');
 j:=crm_private.installation_enqueue(i.id,'return-only:'||i.revision,txt,'[]','installation_return',now());
 if j is null then raise exception 'El motor de mensajes está pausado. No se ha confirmado el envío';end if;
 update public.crm_installations set return_job_id=j,return_due_at=now(),updated_at=clock_timestamp() where id=i.id;
end;$$;
revoke all on function crm_private.installation_return_only(uuid) from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.crm_change_offer_stage(p_offer_id uuid, p_expected_offer_at timestamp with time zone, p_expected_opportunity_at timestamp with time zone, p_stage text, p_preferences jsonb DEFAULT NULL::jsonb, p_expected_installation_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
 if o.stage_id=s.id and target not in ('tramitado','pendiente de tramitar') then return jsonb_build_object('opportunity',to_jsonb(o),'offer',to_jsonb(f));end if;
 if target='tramitado' then
  if p_preferences is null or p_preferences->>'workflow' is distinct from 'installation_v1' then raise exception 'Revisa la cita y el aviso antes de confirmar la tramitación';end if;
  select * into i from public.crm_installations where opportunity_id=o.id;
  if i.id is not null and (p_expected_installation_at is null or i.updated_at is distinct from p_expected_installation_at) or i.id is null and p_expected_installation_at is not null then raise exception 'La instalación cambió en otro dispositivo. Cierra y vuelve a abrir Gestionar';end if;
  update public.sales_opportunities set stage_id=s.id,position=0,status='open',after_sale_preferences=p_preferences,updated_at=clock_timestamp() where id=o.id returning * into o;
  -- Re-entering Tramitado edits the existing installation; it never creates a second one.
  if i.id is not null then
   patch:=jsonb_build_object('communication_mode',coalesce(p_preferences->>'communication_mode','notice'));
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
end;$function$

;
CREATE OR REPLACE FUNCTION public.crm_installation_update(p_opportunity_id uuid, p_expected_at timestamp with time zone, p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare i public.crm_installations%rowtype;o public.sales_opportunities%rowtype;v jsonb;j uuid;phase text;appointment_changed boolean;notice_changed boolean;want_send boolean;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso';end if;
 select * into o from public.sales_opportunities where id=p_opportunity_id for update;
 select * into i from public.crm_installations where opportunity_id=p_opportunity_id for update;
 if not found then raise exception 'Instalación no disponible';end if;
 if i.updated_at is distinct from p_expected_at then raise exception 'La instalación cambió en otro dispositivo. Cierra y vuelve a abrir Gestionar';end if;
 if p_patch ? 'communication_mode' then
  if p_patch->>'communication_mode' not in ('notice','return','none') then raise exception 'Modo de comunicación no válido';end if;
  if exists(select 1 from public.crm_server_automation_jobs where context->>'installation_id'=i.id::text and (status='running' or status in ('pending','paused') and action_config ? '__delivery_receipt')) then raise exception 'Hay un mensaje en envío. Espera antes de cambiarlo';end if;
  if p_patch->>'communication_mode' in ('none','return') then
   update public.crm_server_automation_jobs set status='cancelled',error_message='Modo de comunicación cambiado',updated_at=now() where id=i.notice_job_id and status in ('pending','paused');
  end if;
  if p_patch->>'communication_mode'='none' then
   if exists(select 1 from public.crm_server_automation_jobs where id=i.return_job_id and status in ('pending','paused') and action_config ? '__delivery_receipt') then raise exception 'Devolución en envío';end if;
   update public.crm_server_automation_jobs set status='cancelled',error_message='Sin comunicaciones',updated_at=now() where id=i.return_job_id and status in ('pending','paused');
   if found then update public.crm_installations set return_job_id=null,return_due_at=null where id=i.id;end if;
  end if;
 end if;
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
  config_snapshot=case when p_patch ? 'communication_mode' then config_snapshot||jsonb_build_object('communication_mode',p_patch->>'communication_mode') else config_snapshot end,
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
 if want_send and coalesce(i.config_snapshot->>'communication_mode','notice')='notice' then
  if nullif(i.notice_text,'') is null then raise exception 'Escribe el mensaje de la cita';end if;
  j:=crm_private.installation_enqueue(i.id,'notice:'||i.revision,i.notice_text,jsonb_build_array(jsonb_build_object('buttonId','install_done:'||i.id,'buttonText','✓ Instalado')),'installation_notice',now());
  update public.crm_installations set notice_job_id=j,send_notice=true where id=i.id returning * into i;
 end if;
 if p_patch ? 'previous_operator' then
  update public.crm_offer_instances set snapshot=jsonb_set(coalesce(snapshot,'{}'::jsonb),'{previous_operator_override}',to_jsonb(i.previous_operator)),updated_at=clock_timestamp() where id=i.offer_instance_id;
  update public.crm_installations set config_snapshot=config_snapshot||jsonb_build_object('return_time',crm_private.installation_config(i.previous_operator)->>'return_time') where id=i.id;end if;
 if p_patch->>'communication_mode'='return' then perform crm_private.installation_return_only(i.id);else perform crm_private.installation_schedule_return(i.id);end if;
 select to_jsonb(x) into v from public.crm_installations x where id=i.id;return v;
end;$function$

;
CREATE OR REPLACE FUNCTION crm_private.installation_schedule_return(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare i public.crm_installations%rowtype;txt text;confirmation text;j uuid;due timestamptz;reply_context jsonb;
begin
 select * into i from public.crm_installations where id=p_id for update;
 if i.config_snapshot->>'communication_mode'='none' then return;end if;
 if not found or i.installed_on is null or i.return_job_id is not null then return;end if;
 reply_context:=i.recipient_context-'contract_party';
 if i.previous_operator='Ninguno' then
  update public.crm_installations set return_due_at=null,incident='',updated_at=clock_timestamp() where id=i.id;return;
 end if;
 if nullif(btrim(i.previous_operator),'') is null or nullif(btrim(i.return_text),'') is null then
  update public.crm_installations set incident='Revisar compañía anterior e instrucciones de devolución',updated_at=clock_timestamp() where id=i.id;return;
 end if;
 -- This message responds to an installation confirmation. It has no commercial delay or window.
 due:=now();
 txt:=crm_private.installation_render(i.return_text,i.config_snapshot,reply_context,i.appointment_date,i.time_from,i.time_to,i.installed_on);
 -- The stored router block may contain the standard greeting. Keep a single greeting in the combined reply.
 txt:=crm_private.contract_message(txt,i.recipient_context->'contract_party');
 j:=crm_private.installation_enqueue(i.id,'return:'||i.revision,txt,'[]','installation_return',due);
 update public.crm_installations set return_due_at=due,return_job_id=j,incident=case when j is null then 'Motor pausado: devolución pendiente de enviar' else '' end,updated_at=clock_timestamp() where id=i.id;
end;$function$

;
CREATE OR REPLACE FUNCTION crm_private.installation_sync(p_opportunity_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.sales_opportunities%rowtype;f public.crm_offer_instances%rowtype;i public.crm_installations%rowtype;p jsonb;ctx jsonb;cfg jsonb;op text;d date;tf time;tt time;txt text;rt text;j uuid;
begin
 select * into o from public.sales_opportunities where id=p_opportunity_id for update;
 if not found or not exists(select 1 from public.sales_stages where id=o.stage_id and lower(btrim(name))='tramitado') then return null;end if;
 p:=o.after_sale_preferences;
 if p->>'workflow' is distinct from 'installation_v1' then return null;end if;
 select * into f from public.crm_offer_instances where opportunity_id=o.id order by created_at desc limit 1;
 select * into i from public.crm_installations where opportunity_id=o.id for update;
 if found then return i.id;end if;
 op:=coalesce(nullif(p->>'operator',''),f.operator,'');cfg:=crm_private.installation_config(op)||jsonb_build_object('communication_mode',coalesce(p->>'communication_mode','notice'))||jsonb_build_object('return_time',crm_private.installation_config(p->>'previous_operator')->>'return_time');
 d:=nullif(p->>'appointment_date','')::date;tf:=nullif(p->>'time_from','')::time;tt:=nullif(p->>'time_to','')::time;
 ctx:=crm_private.party_context(public.crm_server_context_for_contact(o.record_id,o.phone)||jsonb_build_object('opportunity_id',o.id,'offer_instance_id',f.id,'operator',op,'previous_operator',p->>'previous_operator','event_at',now()),o.contract_party);
 txt:=coalesce(nullif(p->>'text',''),crm_private.installation_render(cfg->>case when d is null then 'no_appointment_text' else 'appointment_text' end,cfg,ctx,d,tf,tt));
 if nullif(p->>'text','') is null and op='Vodafone' and crm_private.offer_netflix_visible(f.snapshot) and nullif(cfg->>'netflix_extra_text','') is not null then txt:=txt||E'\n\n'||(cfg->>'netflix_extra_text');end if;
 rt:=coalesce(p->>'return_text','');
 insert into public.crm_installations(opportunity_id,offer_instance_id,user_id,operator,previous_operator,appointment_date,time_from,time_to,recipient_context,send_notice,notice_text,return_text,config_snapshot)
 values(o.id,f.id,coalesce(o.owner_user_id,f.created_by,auth.uid()),op,coalesce(p->>'previous_operator',''),d,tf,tt,ctx,coalesce((p->>'send')::boolean,true),txt,rt,cfg) returning * into i;
 if not exists(select 1 from public.crm_automations where enabled and trigger_type='opportunity_stage' and trigger_config->>'stage_id'=o.stage_id::text and trigger_config->>'automation_code' like '%_day_one' and lower(trigger_config->>'automation_operator')=lower(op)) then
  insert into public.crm_server_automation_jobs(automation_id,user_id,event_key,action_type,action_config,context,run_at) values(null,i.user_id,'installation:'||i.id||':sale-label','record_sale_month','{}',ctx||jsonb_build_object('installation_id',i.id,'installation_phase','installation_month_label','lifecycle',jsonb_build_object('mode','after_sale','stage_id',o.stage_id)),now()) on conflict do nothing;
 end if;
 if i.send_notice and coalesce(p->>'communication_mode','notice')='notice' then
  j:=crm_private.installation_enqueue(i.id,'notice:1',txt,jsonb_build_array(jsonb_build_object('buttonId','install_done:'||i.id,'buttonText','✓ Instalado')),'installation_notice',now());
  update public.crm_installations set notice_job_id=j,incident=case when j is null then 'Motor pausado: aviso pendiente de programar' else '' end where id=i.id;
 end if;
 if p->>'communication_mode'='return' then perform crm_private.installation_return_only(i.id);end if;
 return i.id;
end;$function$

;
CREATE OR REPLACE FUNCTION crm_private.router_return_preferences(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare d date;tf time;tt time;
begin
 if p->>'workflow' is distinct from 'installation_v1' then return crm_private.router_return_preferences_before_installations(p);end if;
 if jsonb_typeof(p)<>'object' or coalesce(p->>'send','') not in ('true','false') then raise exception 'Configuración de instalación no válida';end if;
 if jsonb_typeof(p->'previous_operator') is distinct from 'string' or length(p->>'previous_operator')>80 or p->>'previous_operator' ~ '[[:cntrl:]]' or p->>'previous_operator' in ('__proto__','prototype','constructor') then raise exception 'Compañía anterior no válida';end if;
 if length(coalesce(p->>'text',''))>10000 or length(coalesce(p->>'return_text',''))>10000 or p->>'send'='true' and length(btrim(coalesce(p->>'text','')))=0 then raise exception 'Revisa los textos';end if;
 if coalesce(p->>'communication_mode','notice') not in ('notice','return','none') then raise exception 'Modo de comunicación no válido';end if;
 if p->>'communication_mode'='return' and (nullif(btrim(p->>'previous_operator'),'') is null or p->>'previous_operator'='Ninguno' or nullif(btrim(p->>'return_text'),'') is null) then raise exception 'Revisa el operador anterior y las instrucciones';end if;
 d:=nullif(p->>'appointment_date','')::date;tf:=nullif(p->>'time_from','')::time;tt:=nullif(p->>'time_to','')::time;
 if (d is null)<>(tf is null) or tt is not null and (tf is null or tt<=tf) then raise exception 'Indica la fecha y la hora de la cita';end if;
 if d<(now() at time zone 'Europe/Madrid')::date then raise exception 'La cita debe ser de hoy o futura';end if;
 return jsonb_build_object('communication_mode',coalesce(p->>'communication_mode','notice'),'workflow','installation_v1','previous_operator',p->>'previous_operator','operator',p->>'operator','send',(p->>'send')::boolean,'text',coalesce(p->>'text',''),'return_text',coalesce(p->>'return_text',''),'appointment_date',d,'time_from',tf,'time_to',tt,'rule_id',p->>'rule_id','send_at',null);
end;$function$

;

create or replace function public.crm_offer_resume_preview(p_offer_id uuid,p_mode text,p_local_at text default null) returns jsonb language plpgsql set search_path='' as $$
declare f public.crm_offer_instances%rowtype;requested timestamptz;local_stamp timestamp;due timestamptz;d date;t time;dow integer;
begin
 if auth.uid() is null or not(public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso';end if;
 select * into f from public.crm_offer_instances where id=p_offer_id;
 if not found or f.status<>'paused' then raise exception 'El seguimiento ya no está pausado';end if;
 if p_mode='now' then requested:=now();
 elsif p_mode='days' then requested:=((now() at time zone 'Europe/Madrid')::date+2+coalesce((f.sent_at at time zone 'Europe/Madrid')::time,'10:00'::time)) at time zone 'Europe/Madrid';
 elsif p_mode='custom' then
  if p_local_at is null or p_local_at !~ '^\d{4}-\d\d-\d\dT\d\d:\d\d$' then raise exception 'Elige la fecha y la hora';end if;
  local_stamp:=p_local_at::timestamp;requested:=local_stamp at time zone 'Europe/Madrid';
  if requested at time zone 'Europe/Madrid'<>local_stamp then raise exception 'Esa hora no existe por el cambio de horario';end if;
  if requested<=now() then raise exception 'Elige una fecha y hora futuras';end if;
 else raise exception 'Opción no válida';end if;
 d:=(requested at time zone 'Europe/Madrid')::date;t:=(requested at time zone 'Europe/Madrid')::time;
 for guard in 1..8 loop
  dow:=extract(isodow from d);
  if dow=7 then d:=d+1;continue;end if;
  if dow=6 and t>='14:00'::time then d:=d+2;continue;end if;
  if t<'10:00'::time then t:='10:00';
  elsif t>='14:00'::time and t<'17:30'::time then t:='17:30';
  elsif t>='20:30'::time then d:=d+1;t:='10:00';continue;end if;
  due:=(d+t) at time zone 'Europe/Madrid';exit;
 end loop;
 if due is null then raise exception 'No se pudo calcular el horario';end if;
 return jsonb_build_object('send_at',due,'requested_at',requested);
end;$$;
revoke all on function public.crm_offer_resume_preview(uuid,text,text) from public,anon;
grant execute on function public.crm_offer_resume_preview(uuid,text,text) to authenticated;
create or replace function public.crm_resume_offer_at(p_offer_id uuid,p_mode text,p_local_at text,p_expected_at timestamptz) returns jsonb language plpgsql set search_path='' as $$
declare f public.crm_offer_instances%rowtype;leader uuid;ids uuid[];due timestamptz;j uuid;cfg jsonb;
begin
 if auth.uid() is null or not(public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso';end if;
 select * into f from public.crm_offer_instances where id=p_offer_id;
 if not found then raise exception 'Oferta no disponible';end if;
 leader:=coalesce(nullif(f.snapshot->>'group_leader_offer_id','')::uuid,f.id);
 perform pg_advisory_xact_lock(hashtextextended(leader::text,0));
 select * into f from public.crm_offer_instances where id=p_offer_id for update;
 if f.updated_at is distinct from p_expected_at then raise exception 'La oferta cambió en otro equipo. Actualiza antes de guardar';end if;
 due:=(public.crm_offer_resume_preview(p_offer_id,p_mode,p_local_at)->>'send_at')::timestamptz;
 select array_agg(id) into ids from public.crm_offer_instances where id=leader or snapshot->>'group_leader_offer_id'=leader::text;
 if exists(select 1 from public.crm_server_automation_jobs where context->>'offer_instance_id'=leader::text and (status='running' or status in ('pending','paused','failed') and action_config ? '__delivery_receipt')) then raise exception 'Hay un mensaje en envío. Espera antes de reanudar';end if;
 update public.crm_server_automation_jobs set status='cancelled',error_message='Reanudación sustituida',updated_at=now() where context->>'offer_instance_id'=leader::text and status in ('pending','paused');
 perform public.crm_control_offer_composition(p_offer_id,'resume');
 select id into j from public.crm_server_automation_jobs where user_id=auth.uid() and context->>'offer_instance_id'=leader::text and event_key like 'manual-offer-resume:%' and status='pending' and created_at>=now() order by created_at desc,id desc limit 1;
 if j is null then raise exception 'No se pudo preparar el seguimiento';end if;
 select jsonb_agg(case when ord=1 and value->>'kind'='wait' then value||jsonb_build_object('value',0,'business_schedule','phone_house') else value end order by ord) into cfg from public.crm_server_automation_jobs, jsonb_array_elements(action_config->'steps') with ordinality a(value,ord) where id=j;
 update public.crm_server_automation_jobs set action_config=jsonb_set(action_config,'{steps}',cfg),context=context||jsonb_build_object('event_at',due),run_at=due,updated_at=now() where id=j;
 update public.crm_offer_instances set resume_at=null,resume_job_id=null,pause_reason=null,updated_at=clock_timestamp() where id=any(ids) and status='following';
 return jsonb_build_object('ok',true,'send_at',due);
end;$$;
revoke all on function public.crm_resume_offer_at(uuid,text,text,timestamptz) from public,anon;
grant execute on function public.crm_resume_offer_at(uuid,text,text,timestamptz) to authenticated;
notify pgrst,'reload schema';

