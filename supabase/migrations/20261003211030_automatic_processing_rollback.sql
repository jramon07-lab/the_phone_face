-- Returning to Pending undoes processing in the same transaction as the stage change.
-- This is prospective: no existing opportunity or provider message is rewritten here.
alter table public.crm_installation_history drop constraint crm_installation_history_event_type_check;
alter table public.crm_installation_history add constraint crm_installation_history_event_type_check
 check(event_type in ('confirmation_cancelled','processing_reverted'));

create function crm_private.revert_processing_on_pending() returns trigger
language plpgsql security definer set search_path='' as $$
declare i public.crm_installations%rowtype;previous_stage text;
begin
 if not exists(select 1 from public.sales_stages where id=new.stage_id and lower(btrim(name))='pendiente de tramitar') then return new;end if;
 if old.installation_date is not null or new.installation_date is not null or
    exists(select 1 from public.sales_stages where id=old.stage_id and lower(btrim(name))='ganado') then
  raise exception 'La activación está registrada en el Excel mensual';
 end if;
 if auth.uid() is not null and not(public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para cambiar el estado';end if;
 select lower(btrim(name)) into previous_stage from public.sales_stages where id=old.stage_id;
 select * into i from public.crm_installations where opportunity_id=new.id for update;
 if previous_stage is distinct from 'tramitado' and i.installed_on is null and
    not exists(select 1 from public.crm_offer_instances where opportunity_id=new.id and (status='processed' or processed_at is not null)) then return new;end if;

 -- Lock delivery rows before checking them so a worker cannot claim a cancelled notice.
 perform 1 from public.crm_server_automation_jobs j where
  (i.id is not null and j.context->>'installation_id'=i.id::text or
   j.context->>'opportunity_id'=new.id::text and j.context#>>'{lifecycle,mode}'='after_sale')
  and j.status in ('pending','paused','failed','running') for update;
 if exists(select 1 from public.crm_server_automation_jobs j where
  (i.id is not null and j.context->>'installation_id'=i.id::text or
   j.context->>'opportunity_id'=new.id::text and j.context#>>'{lifecycle,mode}'='after_sale')
  and (j.status='running' or j.status in ('pending','paused','failed') and j.action_config ? '__delivery_receipt')) then
  raise exception 'Hay un mensaje en envío. Espera a que termine antes de volver a pendiente';
 end if;

 if i.id is not null then
  insert into public.crm_installation_history(installation_id,actor_id,actor_name,event_type,reason,previous)
  values(i.id,auth.uid(),coalesce(nullif(auth.jwt()->>'email',''),'Sistema'),'processing_reverted',
   'Tramitación anulada al volver a Pendiente de tramitar',
   to_jsonb(i)||jsonb_build_object('after_sale_preferences',old.after_sale_preferences,
    'processed_at',(select max(processed_at) from public.crm_offer_instances where opportunity_id=new.id)));
  -- The scheduled appointment remains a draft; the actual installation no longer exists.
  update public.crm_installations set installed_on=null,confirmed_at=null,confirmed_by=null,
   confirmation_source='customer',confirmation_message_id=null,awaiting_date=false,
   return_job_id=null,return_due_at=null,send_notice=false,incident='',
   confirmation_reset_at=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp() where id=i.id;
 end if;
 update public.crm_server_automation_jobs j set status='cancelled',error_message='Tramitación anulada al volver a pendiente',updated_at=clock_timestamp() where
  (i.id is not null and j.context->>'installation_id'=i.id::text or
   j.context->>'opportunity_id'=new.id::text and j.context#>>'{lifecycle,mode}'='after_sale')
  and j.status in ('pending','paused','failed');
 update public.crm_offer_instances set status='accepted',processed_at=null,updated_at=clock_timestamp() where opportunity_id=new.id;
 new.after_sale_preferences:=null;new.status:='open';
 return new;
end;$$;
-- Only the trigger may invoke this definer, after the writer's opportunity RLS has applied.
revoke all on function crm_private.revert_processing_on_pending() from public,anon,authenticated;
create trigger crm_revert_processing_on_pending before update of stage_id on public.sales_opportunities
 for each row execute function crm_private.revert_processing_on_pending();
-- Distinguish an automatic processing rollback from a manual confirmation correction.
CREATE OR REPLACE FUNCTION public.crm_installation_preview(p_opportunity_id uuid DEFAULT NULL::uuid, p_contact_id uuid DEFAULT NULL::uuid, p_manager_contact_id uuid DEFAULT NULL::uuid, p_recipient_contact_id uuid DEFAULT NULL::uuid, p_operator text DEFAULT NULL::text, p_netflix_followup boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v jsonb;cfg jsonb;o public.sales_opportunities%rowtype;f public.crm_offer_instances%rowtype;party jsonb;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso';end if;
 v:='{}'::jsonb;
 if p_opportunity_id is not null then
  select * into o from public.sales_opportunities where id=p_opportunity_id;if not found then raise exception 'Oportunidad no encontrada';end if;
  select * into f from public.crm_offer_instances where opportunity_id=o.id order by created_at desc limit 1;
  p_operator:=coalesce(f.operator,nullif(o.after_sale_preferences->>'operator',''),p_operator,o.installation_operator,(regexp_match(o.title,'(Vodafone|Yoigo|MásMóvil|Masmovil|O2|Orange|Lowi|Jazztel|Digi|Movistar|Pepephone)','i'))[1]);
  p_contact_id:=o.record_id;party:=o.contract_party;p_netflix_followup:=crm_private.offer_netflix_visible(f.snapshot);
 end if;
 if lower(p_operator)='masmovil' then p_operator:='MásMóvil';end if;
 if party is null and p_contact_id is not null then party:=crm_private.resolve_sale_party(p_contact_id,p_manager_contact_id,p_recipient_contact_id);end if;
 v:=jsonb_build_object('operator',p_operator,'preferences',o.after_sale_preferences,'netflix_followup',p_netflix_followup,'stage_name',(select name from public.sales_stages where id=o.stage_id));
 if party is not null then v:=v||jsonb_build_object('contract_party',party,'recipient',party->>'recipient_name','recipient_first_name',party->>'recipient_first_name','phone',party->>'recipient_phone');end if;
 cfg:=crm_private.installation_config(coalesce(v->>'operator',p_operator,''));
 return v||jsonb_build_object('workflow','installation_v1','available',length(coalesce(v->>'phone',''))>=8,'installation_config',cfg,'return_times',coalesce((select jsonb_object_agg(value->>'operator',value->>'return_time') from public.app_settings where key like 'crm_installation_template:%'),'{}'::jsonb),'opportunity_updated_at',o.updated_at,'excel_date',o.installation_date,'installation', (select to_jsonb(i)||jsonb_build_object('notice_status',nj.status,'notice_sent_at',nj.completed_at,'confirmation_history',coalesce((select jsonb_agg(jsonb_build_object('event_type',h.event_type,'actor_name',h.actor_name,'created_at',h.created_at,'reason',h.reason,'installed_on',h.previous->>'installed_on','return_message',(select action_config->>'text' from public.crm_server_automation_jobs where id=nullif(h.previous->>'return_job_id','')::uuid),'return_sent_at',(select completed_at from public.crm_server_automation_jobs where id=nullif(h.previous->>'return_job_id','')::uuid)) order by h.created_at desc) from public.crm_installation_history h where h.installation_id=i.id),'[]'::jsonb),'return_status',rj.status,'return_sent_at',rj.completed_at,'return_message',rj.action_config->>'text') from public.crm_installations i left join public.crm_server_automation_jobs nj on nj.id=i.notice_job_id left join public.crm_server_automation_jobs rj on rj.id=i.return_job_id where opportunity_id=p_opportunity_id));
end;$function$;

-- An explicit Pending action may repair stale metadata from a prior release, even in the same column.
-- Change a commercial stage atomically with the versions reviewed in Gestionar.
-- The caller retains its normal RLS permissions; official activation remains Excel-owned.
create or replace function public.crm_change_offer_stage(
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
 if o.stage_id=s.id and target not in ('tramitado','pendiente de tramitar') then return jsonb_build_object('opportunity',to_jsonb(o),'offer',to_jsonb(f));end if;
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

notify pgrst,'reload schema';
