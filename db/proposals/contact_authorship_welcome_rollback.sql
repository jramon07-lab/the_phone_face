-- Rollback the behavior; retain new metadata/request tables to avoid losing audit data.
begin;
CREATE OR REPLACE FUNCTION public.crm_server_on_label_assigned()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.crm_automations%rowtype;
  ctx jsonb;
begin
  if not public.crm_server_automations_enabled() then return new; end if;
  ctx := public.crm_server_context_for_contact(new.contact_id,null)
    || jsonb_build_object(
      'label_id',new.label_id,
      'event_at',new.created_at,
      'event_date',(new.created_at at time zone 'Europe/Madrid')::date,
      'trigger_type','label_assigned'
    );
  for r in
    select * from public.crm_automations
    where enabled
      and trigger_type='label_assigned'
      and coalesce(trigger_config->>'label_id','')=new.label_id::text
  loop
    perform public.crm_server_enqueue(
      r,
      'label:'||new.contact_id::text||':'||new.label_id::text||':'||extract(epoch from new.created_at)::bigint,
      ctx
    );
  end loop;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_set_contact_labels(p_contact_id uuid, p_label_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  delete from public.crm_contact_labels where contact_id=p_contact_id;
  insert into public.crm_contact_labels(contact_id,label_id)
  select p_contact_id,x from unnest(coalesce(p_label_ids,'{}'::uuid[])) x
  on conflict do nothing;
end $function$;

do $$ declare t text;begin
 foreach t in array array['records','sales_opportunities','agenda_items','contact_activity','crm_contact_labels'] loop
  execute format('drop trigger if exists crm_stamp_actor on public.%I',t);
 end loop;
end $$;
drop trigger if exists crm_welcome_job_status on public.crm_server_automation_jobs;
-- Pending messages must be reviewed before rollback; never silently delete them.
revoke execute on function public.crm_create_contact_with_welcome(jsonb,uuid[],boolean) from authenticated;
-- Also remove the additive audit hooks if rolling back the proposal.
drop trigger if exists crm_audit_record on public.records;
drop trigger if exists crm_audit_opportunity on public.sales_opportunities;
drop trigger if exists crm_audit_task on public.agenda_items;

create or replace function public.crm_welcome_capability() returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$ select jsonb_build_object('installed',false,'enabled',false); $$;
commit;
