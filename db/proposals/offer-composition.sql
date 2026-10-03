-- Atomic offer compositions. Existing v13 routing, permissions and idempotency remain authoritative.
create or replace function public.crm_create_offer_composition(
 p_contact_id uuid,p_manager_contact_id uuid,p_recipient_contact_id uuid,p_request_key uuid,p_items jsonb,
 p_composition text default 'single',p_group_message text default null,p_mode text default 'followup',
 p_send_message boolean default false,p_processing_date date default null,p_test_mode boolean default false,
 p_allow_duplicate boolean default false,p_send_at timestamptz default null,p_welcome boolean default false,p_after_sale jsonb default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); item jsonb; result jsonb; results jsonb:='[]'; ids uuid[]:='{}'; first_id uuid; offer_id uuid; opp_id uuid; prior public.crm_offer_instances%rowtype; count_items int; idx int:=0; digest text; op text; first_op text; message text; expected_jobs int; changed_jobs int; prefs jsonb;
begin
 if uid is null or not(public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para crear ofertas';end if;
 if p_request_key is null then raise exception 'Falta la clave de la operación';end if;
 if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Las ofertas deben ser una lista';end if;
 count_items:=jsonb_array_length(p_items);
 if count_items<1 or count_items>5 or p_composition not in ('single','group','separate') or (p_composition='single' and count_items<>1) or (p_composition<>'single' and count_items<2) then raise exception 'Composición de ofertas inválida';end if;
 if p_composition='group' and (nullif(btrim(p_group_message),'') is null or length(p_group_message)>20000) then raise exception 'El mensaje agrupado debe contener entre 1 y 20000 caracteres';end if;
 digest:=md5(jsonb_build_object('items',p_items,'composition',p_composition,'group',p_group_message,'mode',p_mode,'send',p_send_message,'date',p_processing_date,'send_at',p_send_at,'recipient',p_recipient_contact_id,'manager',p_manager_contact_id,'contact',p_contact_id,'welcome',p_welcome,'after_sale',p_after_sale)::text);
 perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request_key::text,0));
 select * into prior from public.crm_offer_instances where created_by=uid and request_key=p_request_key;
 if found then
  if prior.snapshot->>'composition_digest' is distinct from digest then raise exception 'Esta petición ya se guardó con otros datos. Actualiza antes de continuar';end if;
  return prior.snapshot->'composition_result'||jsonb_build_object('idempotent_replay',true);
 end if;
 -- Validate all items before creating any sale or job.
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item) is distinct from 'object' then raise exception 'Oferta inválida';end if;
  select operator into op from public.crm_offer_catalog where id=(item->>'catalog_offer_id')::uuid and active;
  if not found then raise exception 'La tarifa no está disponible';end if;
  if first_op is null then first_op:=op;end if;
  if p_composition='group' and op<>first_op then raise exception 'Los servicios agrupados deben ser de la misma compañía';end if;
  if coalesce((item->>'permanence_refund')::boolean,false) and coalesce((item->>'permanence_amount')::numeric,0)<=0 then raise exception 'Indica el importe del abono de permanencia';end if;
 end loop;
 for item in select value from jsonb_array_elements(p_items) loop
  message:=case when p_composition='group' then p_group_message else item->>'message_text' end;
  result:=public.crm_create_offer_execution_v13(p_contact_id,(item->>'catalog_offer_id')::uuid,
   case when idx=0 then p_request_key else md5(p_request_key::text||':'||idx)::uuid end,
   coalesce(item->'selections','[]'),item->>'extra_text',p_mode,(item->>'final_price')::numeric,p_send_message,
   p_processing_date,p_test_mode,p_allow_duplicate,p_send_at,p_welcome,p_recipient_contact_id,p_manager_contact_id,
   message,coalesce(item->'after_sale',p_after_sale));
  if not coalesce((result->>'safety_verified')::boolean,false) then raise exception 'No se pudo verificar la oferta';end if;
  offer_id:=(result->>'offer_id')::uuid;opp_id:=(result->>'opportunity_id')::uuid;
  if idx=0 then first_id:=offer_id;end if;ids:=array_append(ids,offer_id);results:=results||jsonb_build_array(result);idx:=idx+1;
  update public.crm_offer_instances set snapshot=coalesce(snapshot,'{}')||jsonb_build_object('composition',p_composition,'composition_request_key',p_request_key,'previous_operator',coalesce(item->>'previous_operator',''),'shop_gift',coalesce((item->>'shop_gift')::boolean,false),'permanence_refund',coalesce((item->>'permanence_refund')::boolean,false),'permanence_amount',coalesce((item->>'permanence_amount')::numeric,0),'permanence_visible',coalesce((item->>'permanence_visible')::boolean,true)) where id=offer_id and created_by=uid;
  -- Preserve the chosen previous operator for the later router-return dialog.
  if nullif(item->>'previous_operator','') is not null then
   update public.sales_opportunities set after_sale_preferences=coalesce(after_sale_preferences,jsonb_build_object('send',false,'text','','operator',first_op,'rule_id',null))||jsonb_build_object('previous_operator',case when item->>'previous_operator' in ('Yoigo','MásMóvil','O2','Vodafone','Ninguno','Otro') then item->>'previous_operator' when item->>'previous_operator'='Sin compañía' then 'Ninguno' else 'Otro' end) where id=opp_id and owner_user_id=uid;
  end if;
 end loop;
 if p_composition='group' then
  expected_jobs:=case when p_mode='followup' or p_send_message then count_items-1 else 0 end;
  update public.crm_server_automation_jobs set status='cancelled',error_message='Envío agrupado: seguimiento compartido con '||first_id,updated_at=now()
   where user_id=uid and context->>'offer_instance_id'=any(array(select x::text from unnest(ids[2:]) x))
   and event_key in (select 'manual-offer:'||x from unnest(ids[2:]) x union all select 'manual-offer-accepted:'||x from unnest(ids[2:]) x)
   and action_type='flow_v1' and status='pending';
  get diagnostics changed_jobs=row_count;
  if changed_jobs<>expected_jobs then raise exception 'No se pudo verificar el envío agrupado; no se guardó nada';end if;
  update public.crm_server_automation_jobs set context=context||jsonb_build_object('offer_group_ids',to_jsonb(ids)),
   action_config=jsonb_set(coalesce(action_config,'{}'),'{steps}',coalesce((select jsonb_agg(case when jsonb_typeof(value->'config')='object' then jsonb_set(value,'{config}',(value->'config')-'reply_buttons'||case when value->'config'->>'offer_phase' in ('reminder_2','reminder_5') then jsonb_build_object('text','Hola {nombre}, ¿has podido revisar las ofertas que te enviamos? Si tienes alguna duda, te ayudo por aquí.') else '{}'::jsonb end,true) else value end order by ord) from jsonb_array_elements(action_config->'steps') with ordinality a(value,ord)),'[]'::jsonb),true)
   where user_id=uid and context->>'offer_instance_id'=first_id::text and event_key in ('manual-offer:'||first_id,'manual-offer-accepted:'||first_id) and status='pending';
  update public.crm_offer_instances set snapshot=snapshot||jsonb_build_object('group_leader_offer_id',first_id,'offer_group_ids',to_jsonb(ids)) where id=any(ids) and created_by=uid;
 end if;
 result:=(results->0)||jsonb_build_object('offers',results,'composition',p_composition,'offer_count',count_items,'composition_verified',true,'idempotent_replay',false);
 update public.crm_offer_instances set snapshot=snapshot||jsonb_build_object('composition_digest',digest,'composition_result',result) where id=first_id and created_by=uid;
 return result;
end $$;
revoke all on function public.crm_create_offer_composition(uuid,uuid,uuid,uuid,jsonb,text,text,text,boolean,date,boolean,boolean,timestamptz,boolean,jsonb) from public,anon;
grant execute on function public.crm_create_offer_composition(uuid,uuid,uuid,uuid,jsonb,text,text,text,boolean,date,boolean,boolean,timestamptz,boolean,jsonb) to authenticated;

-- Mirror delivery state only, never accept/decline another service automatically.
create or replace function crm_private.offer_group_delivery_status() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_typeof(new.context->'offer_group_ids') is distinct from 'array' then return new;end if;
 if new.action_type='__send_whatsapp' and new.action_config->>'offer_phase' in ('initial','accepted') and new.status in ('done','failed') then
  update public.crm_offer_instances i set status=case when i.status in ('accepted','processed') then i.status when new.status='done' then 'following' else 'error' end,
   sent_at=case when new.status='done' then coalesce(i.sent_at,new.completed_at,now()) else i.sent_at end
   where i.created_by=new.user_id and i.snapshot->>'group_leader_offer_id'=new.context->>'offer_instance_id' and i.id::text in(select jsonb_array_elements_text(new.context->'offer_group_ids')) and i.status in ('queued','error','accepted','processed');
 elsif new.status='cancelled' and coalesce(new.error_message,'') like 'Cliente respondió:%' then
  update public.crm_offer_instances i set status='paused' where i.created_by=new.user_id and i.snapshot->>'group_leader_offer_id'=new.context->>'offer_instance_id' and i.id::text in(select jsonb_array_elements_text(new.context->'offer_group_ids')) and i.status='following';
 end if;
 return new;
end $$;
revoke all on function crm_private.offer_group_delivery_status() from public,anon,authenticated;
drop trigger if exists crm_offer_group_delivery_status on public.crm_server_automation_jobs;
create trigger crm_offer_group_delivery_status after update of status on public.crm_server_automation_jobs for each row when(old.status is distinct from new.status) execute function crm_private.offer_group_delivery_status();
