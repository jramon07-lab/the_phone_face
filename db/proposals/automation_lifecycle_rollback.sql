-- Reviewed rollback only. Stops the new lifecycle flows; preserves existing rules,
-- commercial opt-outs, month history, and all client data. Does not send anything.
update public.crm_automations set enabled=false where action_config->'lifecycle'->>'mode' in ('offer','after_sale');
update public.crm_server_automation_jobs set status='cancelled',error_message='Soporte de seguimiento retirado',updated_at=now()
 where status in ('pending','running') and context->'lifecycle'->>'mode' in ('offer','after_sale');
-- Restore runner from automation_lifecycle_runner_before.ts BEFORE removing RPCs.
-- Leave the guard/RPCs installed for compatibility until that runner is restored.
drop trigger if exists crm_lifecycle_validate_rule on public.crm_automations;
drop trigger if exists crm_lifecycle_job_context on public.crm_server_automation_jobs;
drop trigger if exists crm_lifecycle_label_removed on public.crm_contact_labels;
drop trigger if exists crm_lifecycle_stage_changed on public.sales_opportunities;
drop trigger if exists crm_lifecycle_incoming on public.wa_messages;
