-- La acción terminal prepara la revisión y mueve ella misma la oportunidad.
-- El trigger no debe cancelar ese mismo trabajo mientras sigue ejecutándose.
create or replace function crm_private.lifecycle_stage_changed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.stage_id is not distinct from old.stage_id then return new; end if;
 update public.crm_server_automation_jobs set status='cancelled',error_message='Oportunidad cambia de fase',updated_at=now()
 where status in ('pending','running') and action_type not in ('record_offer_month','record_sale_month','prepare_operator_review') and context->>'contact_id'=new.record_id::text
   and (nullif(context->>'opportunity_id','') is null or context->>'opportunity_id'=new.id::text)
   and ((context#>>'{lifecycle,mode}'='offer' and coalesce(context#>'{lifecycle,stop_stage_ids}','[]'::jsonb) ? new.stage_id::text)
     or (context#>>'{lifecycle,mode}'='after_sale' and context#>>'{lifecycle,stage_id}'<>new.stage_id::text));
 return new;
end $$;

revoke all on function crm_private.lifecycle_stage_changed() from public, anon, authenticated;
