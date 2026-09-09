-- Keep shared label visibility; enforce the existing UI management permission
-- for direct table writes and SECURITY INVOKER label RPCs.
alter policy crm_labels_insert on public.crm_labels
  with check (exists (select 1 from public.user_permissions p where p.user_id=(select auth.uid()) and (p.is_admin or p.can_manage_labels)));
alter policy crm_labels_update on public.crm_labels
  using (exists (select 1 from public.user_permissions p where p.user_id=(select auth.uid()) and (p.is_admin or p.can_manage_labels)))
  with check (exists (select 1 from public.user_permissions p where p.user_id=(select auth.uid()) and (p.is_admin or p.can_manage_labels)));
alter policy crm_labels_delete on public.crm_labels
  using (exists (select 1 from public.user_permissions p where p.user_id=(select auth.uid()) and (p.is_admin or p.can_manage_labels)));
