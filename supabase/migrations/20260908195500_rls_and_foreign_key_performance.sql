-- Evaluate the authenticated user once per statement in frequently used RLS
-- policies. Behaviour remains unchanged.
drop policy if exists microsoft_mailboxes_owner on public.microsoft_mailboxes;
create policy microsoft_mailboxes_owner on public.microsoft_mailboxes
  for all to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

drop policy if exists email_activity_owner on public.email_activity_log;
create policy email_activity_owner on public.email_activity_log
  for all to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

drop policy if exists crm_automation_contact_exclusions_select on public.crm_automation_contact_exclusions;
create policy crm_automation_contact_exclusions_select on public.crm_automation_contact_exclusions
  for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists crm_automation_contact_exclusions_insert on public.crm_automation_contact_exclusions;
create policy crm_automation_contact_exclusions_insert on public.crm_automation_contact_exclusions
  for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists crm_automation_contact_exclusions_delete on public.crm_automation_contact_exclusions;
create policy crm_automation_contact_exclusions_delete on public.crm_automation_contact_exclusions
  for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Admins read backup history" on public.crm_backup_runs;
create policy "Admins read backup history" on public.crm_backup_runs
  for select to authenticated
  using (
    exists (
      select 1 from public.user_permissions p
      where p.user_id = (select auth.uid()) and p.is_admin = true
    )
  );

drop policy if exists welcome_request on public.crm_welcome_requests;
create policy welcome_request on public.crm_welcome_requests
  for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and status = 'requested'
    and actor_id is null
    and actor_name is null
    and job_id is null
    and sent_at is null
    and exists (
      select 1 from public.records r
      where r.id = crm_welcome_requests.contact_id
        and r.crm_created_by = (select auth.uid())
        and r.crm_creation_origin = 'manual'
        and r.created_at > now() - interval '5 minutes'
    )
  );

-- Cover remaining foreign keys so deletes and joins stay predictable as data grows.
create index if not exists opportunity_month_labels_offer_label_idx
  on crm_private.opportunity_month_labels(offer_label_id);
create index if not exists opportunity_month_labels_sale_label_idx
  on crm_private.opportunity_month_labels(sale_label_id);
create index if not exists crm_external_credentials_updated_by_idx
  on public.crm_external_credentials(updated_by);
create index if not exists crm_welcome_settings_automation_idx
  on public.crm_welcome_settings(automation_id);
create index if not exists crm_welcome_settings_label_idx
  on public.crm_welcome_settings(label_id);
create index if not exists email_activity_log_mailbox_idx
  on public.email_activity_log(mailbox_id);
