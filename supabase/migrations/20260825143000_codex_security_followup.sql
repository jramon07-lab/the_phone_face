-- The Phone Face CRM - Codex Security follow-up
-- Candidate branch only. Validate on Supabase preview before production.

begin;

-- Internal helper returns contact PII (name, phone, DNI). It must not be
-- directly executable by browser roles. SECURITY DEFINER callers/triggers run
-- under the function owner and keep working internally.
revoke all on function public.crm_contact_context_by_id(uuid) from public, anon, authenticated;
grant execute on function public.crm_contact_context_by_id(uuid) to service_role;

-- Internal sequence executor can create opportunities/tasks and schedule
-- WhatsApp work. Do not expose it as an RPC to browser roles.
revoke all on function public.crm_execute_sequence_v2(public.crm_automations, jsonb, text) from public, anon, authenticated;
grant execute on function public.crm_execute_sequence_v2(public.crm_automations, jsonb, text) to service_role;

-- The generic automation action executor has the same privileged execution
-- surface and is kept server/internal-only as defense in depth.
revoke all on function public.crm_execute_automation_action(public.crm_automations, jsonb, text) from public, anon, authenticated;
grant execute on function public.crm_execute_automation_action(public.crm_automations, jsonb, text) to service_role;

commit;
