-- Apply the same domain permissions to deleted data as to live CRM data.
-- No customer data is modified or removed.
begin;
drop policy if exists crm_trash_authenticated_all on public.crm_trash;
create policy crm_trash_select_by_permission on public.crm_trash for select to authenticated using (((select public.current_user_is_admin()) OR
 CASE entity_type
 WHEN 'contact' THEN CASE payload->'record'->>'source_sheet'
  WHEN 'BASE DE DATOS' THEN (select public.current_user_can('can_view_database'))
  WHEN 'LIQUIDACION' THEN (select public.current_user_can('can_view_liquidacion'))
  WHEN 'DATA' THEN (select public.current_user_can('can_view_data'))
  WHEN 'CLAWBACK' THEN (select public.current_user_can('can_view_clawback'))
  WHEN 'AJUSTES' THEN (select public.current_user_can('can_view_ajustes'))
  ELSE false END
 WHEN 'opportunity' THEN (select public.current_user_can('can_view_sales'))
 WHEN 'agenda' THEN (select public.current_user_can('can_view_agenda'))
 ELSE false END));
create policy crm_trash_insert_by_permission on public.crm_trash for insert to authenticated with check ((((select public.current_user_is_admin()) OR
 CASE entity_type
 WHEN 'contact' THEN CASE payload->'record'->>'source_sheet'
  WHEN 'BASE DE DATOS' THEN (select public.current_user_can('can_view_database'))
  WHEN 'LIQUIDACION' THEN (select public.current_user_can('can_view_liquidacion'))
  WHEN 'DATA' THEN (select public.current_user_can('can_view_data'))
  WHEN 'CLAWBACK' THEN (select public.current_user_can('can_view_clawback'))
  WHEN 'AJUSTES' THEN (select public.current_user_can('can_view_ajustes'))
  ELSE false END
 WHEN 'opportunity' THEN (select public.current_user_can('can_view_sales'))
 WHEN 'agenda' THEN (select public.current_user_can('can_view_agenda'))
 ELSE false END) AND ((select public.current_user_is_admin()) OR
 CASE entity_type
 WHEN 'contact' THEN (select public.current_user_can('can_delete_records'))
 WHEN 'opportunity' THEN (select public.current_user_can('can_edit_sales'))
 WHEN 'agenda' THEN (select public.current_user_can('can_manage_agenda'))
 ELSE false END)) AND deleted_by=(select auth.uid()));
create policy crm_trash_delete_by_permission on public.crm_trash for delete to authenticated using ((((select public.current_user_is_admin()) OR
 CASE entity_type
 WHEN 'contact' THEN CASE payload->'record'->>'source_sheet'
  WHEN 'BASE DE DATOS' THEN (select public.current_user_can('can_view_database'))
  WHEN 'LIQUIDACION' THEN (select public.current_user_can('can_view_liquidacion'))
  WHEN 'DATA' THEN (select public.current_user_can('can_view_data'))
  WHEN 'CLAWBACK' THEN (select public.current_user_can('can_view_clawback'))
  WHEN 'AJUSTES' THEN (select public.current_user_can('can_view_ajustes'))
  ELSE false END
 WHEN 'opportunity' THEN (select public.current_user_can('can_view_sales'))
 WHEN 'agenda' THEN (select public.current_user_can('can_view_agenda'))
 ELSE false END) AND ((select public.current_user_is_admin()) OR
 CASE entity_type
 WHEN 'contact' THEN (select public.current_user_can('can_delete_records'))
 WHEN 'opportunity' THEN (select public.current_user_can('can_edit_sales'))
 WHEN 'agenda' THEN (select public.current_user_can('can_manage_agenda'))
 ELSE false END)));
create policy crm_trash_update_admin on public.crm_trash for update to authenticated using ((select public.current_user_is_admin())) with check ((select public.current_user_is_admin()));
commit;