-- Cover every foreign key used by the durable offer follow-up audit.
create index if not exists crm_offer_followup_events_contact_idx
  on public.crm_offer_followup_events(contact_id);
create index if not exists crm_offer_followup_events_user_idx
  on public.crm_offer_followup_events(user_id);
create index if not exists crm_offer_followup_events_job_idx
  on public.crm_offer_followup_events(job_id);
