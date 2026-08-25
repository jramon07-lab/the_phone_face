-- The Phone Face CRM - P0 security hardening
-- PREPARADO PARA REVISION. NO APLICAR A PRODUCCION SIN VALIDAR EN PREVIEW/BRANCH.

begin;

-- ---------------------------------------------------------------------------
-- 1) update_records_by_dni: require authenticated user + edit permission.
-- ---------------------------------------------------------------------------
create or replace function public.update_records_by_dni(
  old_dni text,
  new_name text,
  new_phone text,
  new_dni text,
  new_email text,
  new_notes text
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  updated_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sesion requerida';
  end if;

  if not exists (
    select 1
    from public.user_permissions p
    where p.user_id = auth.uid()
      and (p.is_admin or p.can_edit_records)
  ) then
    raise exception 'Sin permiso para editar registros';
  end if;

  if coalesce(trim(old_dni),'') = '' then
    return 0;
  end if;

  with matched as (
    select id
    from public.records
    where upper(regexp_replace(coalesce(data->>'DNI / NIF', data->>'DNI', data->>'NIF', ''), '[^A-Z0-9]', '', 'g'))
        = upper(regexp_replace(old_dni, '[^A-Z0-9]', '', 'g'))
  ), upd as (
    update public.records r
    set data =
      (
        case
          when r.data ? 'NOMBRE Y APELLIDOS' then jsonb_set(r.data, '{NOMBRE Y APELLIDOS}', to_jsonb(coalesce(new_name,'')), true)
          when r.data ? 'NOMBRE' then jsonb_set(r.data, '{NOMBRE}', to_jsonb(coalesce(new_name,'')), true)
          when r.data ? 'CLIENTE' then jsonb_set(r.data, '{CLIENTE}', to_jsonb(coalesce(new_name,'')), true)
          when r.data ? 'CLIENTE FINAL' then jsonb_set(r.data, '{CLIENTE FINAL}', to_jsonb(coalesce(new_name,'')), true)
          else jsonb_set(r.data, '{NOMBRE Y APELLIDOS}', to_jsonb(coalesce(new_name,'')), true)
        end
      )
      || jsonb_build_object(
        'TELÉFONO', coalesce(new_phone,''),
        'DNI / NIF', coalesce(new_dni,''),
        'EMAIL', coalesce(new_email,''),
        'NOTAS', coalesce(new_notes,'')
      )
    where r.id in (select id from matched)
    returning r.id
  )
  select count(*) into updated_count from upd;

  return updated_count;
end;
$function$;

revoke all on function public.update_records_by_dni(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.update_records_by_dni(text,text,text,text,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Background automation processor: server/service-role only.
-- ---------------------------------------------------------------------------
revoke all on function public.crm_process_automation_jobs() from public, anon, authenticated;
grant execute on function public.crm_process_automation_jobs() to service_role;

-- ---------------------------------------------------------------------------
-- 3) Automation enqueue: authenticated user + automation permission.
-- This closes the gap where any signed-in user could enqueue jobs.
-- ---------------------------------------------------------------------------
create or replace function public.crm_enqueue_automation_job(
  p_automation_id uuid,
  p_contact_id uuid,
  p_opportunity_id uuid,
  p_job_type text,
  p_run_at timestamptz,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sesion requerida';
  end if;

  if not exists (
    select 1 from public.user_permissions p
    where p.user_id = auth.uid()
      and (p.is_admin or p.can_manage_automations)
  ) then
    raise exception 'Sin permiso para gestionar automatizaciones';
  end if;

  if p_job_type not in ('update_opportunity','add_label','remove_label') then
    raise exception 'Tipo de trabajo no soportado';
  end if;

  insert into public.crm_automation_jobs(
    automation_id, contact_id, opportunity_id, job_type, run_at, payload, created_by
  ) values (
    p_automation_id, p_contact_id, p_opportunity_id, p_job_type,
    coalesce(p_run_at, now()), coalesce(p_payload,'{}'::jsonb), auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.crm_enqueue_automation_job(uuid,uuid,uuid,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.crm_enqueue_automation_job(uuid,uuid,uuid,text,timestamptz,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Sales automation trigger: signed-in user with sales edit permission.
-- ---------------------------------------------------------------------------
create or replace function public.run_sales_automations_for_opportunity(target_opportunity uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o public.sales_opportunities%rowtype;
  r public.automation_rules%rowtype;
  aid uuid;
  made int := 0;
begin
  if auth.uid() is null then
    raise exception 'Sesion requerida';
  end if;

  if not exists (
    select 1 from public.user_permissions p
    where p.user_id = auth.uid()
      and (p.is_admin or p.can_edit_sales)
  ) then
    raise exception 'Sin permiso para ejecutar automatizaciones de ventas';
  end if;

  select * into o from public.sales_opportunities where id=target_opportunity;
  if not found then return jsonb_build_object('created',0); end if;

  for r in
    select * from public.automation_rules
    where active=true and trigger_type='stage_enter' and trigger_stage_id=o.stage_id
  loop
    begin
      insert into public.agenda_items(
        title,description,customer_name,customer_phone,starts_at,status,
        assigned_to,created_by,related_record_id
      ) values(
        r.reminder_title,coalesce('Automatizacion: '||o.title,''),o.client_name,o.phone,
        now() + make_interval(days=>r.delay_days),'pending',
        coalesce(o.owner_user_id,auth.uid()),auth.uid(),o.record_id
      ) returning id into aid;

      insert into public.automation_runs(rule_id,opportunity_id,trigger_stage_id,created_agenda_id)
      values(r.id,o.id,o.stage_id,aid);
      made := made + 1;
    exception when unique_violation then
      null;
    end;
  end loop;

  return jsonb_build_object('created',made);
end;
$function$;

revoke all on function public.run_sales_automations_for_opportunity(uuid) from public, anon, authenticated;
grant execute on function public.run_sales_automations_for_opportunity(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Admin/import helpers: remove inherited PUBLIC/anon execution.
-- Important: revoking only anon is insufficient while PUBLIC retains EXECUTE.
-- ---------------------------------------------------------------------------
revoke all on function public.admin_list_users_permissions() from public, anon;
revoke all on function public.admin_set_user_permission(uuid,text,boolean) from public, anon;
revoke all on function public.admin_set_field_permission(uuid,text,text,boolean) from public, anon;
revoke all on function public.bulk_import_records(text,jsonb,text) from public, anon;
revoke all on function public.import_records_batch(text,jsonb,text) from public, anon;
revoke all on function public.crm_delete_sales_opportunity_v2(uuid) from public, anon;

grant execute on function public.admin_list_users_permissions() to authenticated;
grant execute on function public.admin_set_user_permission(uuid,text,boolean) to authenticated;
grant execute on function public.admin_set_field_permission(uuid,text,text,boolean) to authenticated;
grant execute on function public.bulk_import_records(text,jsonb,text) to authenticated;
grant execute on function public.import_records_batch(text,jsonb,text) to authenticated;
grant execute on function public.crm_delete_sales_opportunity_v2(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) crm_trash: admin or users with delete permission only.
-- ---------------------------------------------------------------------------
drop policy if exists crm_trash_authenticated_all on public.crm_trash;

create policy crm_trash_select_authorized
on public.crm_trash for select to authenticated
using (
  exists (
    select 1 from public.user_permissions p
    where p.user_id = (select auth.uid())
      and (p.is_admin or p.can_delete_records)
  )
);

create policy crm_trash_insert_authorized
on public.crm_trash for insert to authenticated
with check (
  exists (
    select 1 from public.user_permissions p
    where p.user_id = (select auth.uid())
      and (p.is_admin or p.can_delete_records)
  )
);

create policy crm_trash_delete_authorized
on public.crm_trash for delete to authenticated
using (
  exists (
    select 1 from public.user_permissions p
    where p.user_id = (select auth.uid())
      and (p.is_admin or p.can_delete_records)
  )
);

-- ---------------------------------------------------------------------------
-- 7) app_settings: all signed-in users may read; only admins write global values.
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated can insert app settings" on public.app_settings;
drop policy if exists "authenticated can update app settings" on public.app_settings;

create policy app_settings_admin_insert
on public.app_settings for insert to authenticated
with check (public.current_user_is_admin());

create policy app_settings_admin_update
on public.app_settings for update to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

-- Existing authenticated read policy remains intentionally.

-- ---------------------------------------------------------------------------
-- 8) wa_messages: require WhatsApp permission instead of any authenticated user.
-- ---------------------------------------------------------------------------
drop policy if exists wa_messages_authenticated_select on public.wa_messages;
drop policy if exists wa_messages_authenticated_insert on public.wa_messages;
drop policy if exists wa_messages_authenticated_update on public.wa_messages;

create policy wa_messages_select_authorized
on public.wa_messages for select to authenticated
using (
  exists (
    select 1 from public.user_permissions p
    where p.user_id = (select auth.uid())
      and (p.is_admin or p.can_use_whatsapp)
  )
);

create policy wa_messages_insert_authorized
on public.wa_messages for insert to authenticated
with check (
  exists (
    select 1 from public.user_permissions p
    where p.user_id = (select auth.uid())
      and (p.is_admin or p.can_use_whatsapp)
  )
);

create policy wa_messages_update_authorized
on public.wa_messages for update to authenticated
using (
  exists (
    select 1 from public.user_permissions p
    where p.user_id = (select auth.uid())
      and (p.is_admin or p.can_use_whatsapp)
  )
)
with check (
  exists (
    select 1 from public.user_permissions p
    where p.user_id = (select auth.uid())
      and (p.is_admin or p.can_use_whatsapp)
  )
);

commit;
