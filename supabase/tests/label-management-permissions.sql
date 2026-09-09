-- Run as database administrator. All changes, including synthetic rows, roll back.
-- Existing identities are used only to evaluate RLS; no user permissions change.
begin;
select set_config('audit.label_allowed', (select user_id::text from public.user_permissions where not is_admin and can_manage_labels limit 1), true);
select set_config('audit.label_denied', (select user_id::text from public.user_permissions where not is_admin and not can_manage_labels limit 1), true);
select set_config('audit.label_admin', (select user_id::text from public.user_permissions where is_admin limit 1), true);
do $audit$ begin
 if coalesce(current_setting('audit.label_allowed'), '')='' or coalesce(current_setting('audit.label_denied'), '')='' or coalesce(current_setting('audit.label_admin'), '')='' then
  raise exception 'Missing allowed, denied or administrator fixture';
 end if;
end $audit$;
with seed as (insert into public.crm_labels(name) values ('AUDIT LABEL PERMISSIONS ROLLBACK') returning id)
select set_config('audit.label_seed',(select id::text from seed),true);
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('audit.label_denied'),'role','authenticated')::text,true);
do $audit$ declare changed integer; blocked boolean:=false; begin
 if auth.uid()::text<>current_setting('audit.label_denied') then raise exception 'Invalid denied identity'; end if;
 begin insert into public.crm_labels(name) values ('AUDIT LABEL DENIED'); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Denied role inserted a label'; end if;
 update public.crm_labels set name='AUDIT LABEL ILLEGAL CHANGE' where id=current_setting('audit.label_seed')::uuid;
 get diagnostics changed=row_count; if changed<>0 then raise exception 'Denied role updated a label'; end if;
 perform public.crm_delete_label(current_setting('audit.label_seed')::uuid);
 if not exists(select 1 from public.crm_labels where id=current_setting('audit.label_seed')::uuid and name='AUDIT LABEL PERMISSIONS ROLLBACK') then raise exception 'Denied role deleted a label or shared reading failed'; end if;
end $audit$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('audit.label_allowed'),'role','authenticated')::text,true);
do $audit$ declare own_id uuid; changed integer; begin
 if auth.uid()::text<>current_setting('audit.label_allowed') then raise exception 'Invalid allowed identity'; end if;
 insert into public.crm_labels(name) values ('AUDIT LABEL ALLOWED') returning id into own_id;
 update public.crm_labels set name='AUDIT LABEL ALLOWED UPDATED' where id=own_id;
 get diagnostics changed=row_count; if changed<>1 then raise exception 'Allowed role could not update'; end if;
 perform public.crm_delete_label(own_id);
 if exists(select 1 from public.crm_labels where id=own_id) then raise exception 'Allowed role could not delete'; end if;
end $audit$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('audit.label_admin'),'role','authenticated')::text,true);
do $audit$ declare own_id uuid; begin
 insert into public.crm_labels(name) values ('AUDIT LABEL ADMIN') returning id into own_id;
 perform public.crm_delete_label(own_id);
 if exists(select 1 from public.crm_labels where id=own_id) then raise exception 'Administrator could not delete'; end if;
end $audit$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $audit$ declare blocked boolean:=false; begin
 if exists(select 1 from public.crm_labels where id=current_setting('audit.label_seed')::uuid) then raise exception 'Anonymous label access'; end if;
 begin insert into public.crm_labels(name) values ('AUDIT LABEL ANONYMOUS'); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Anonymous label write'; end if;
end $audit$;
reset role;
rollback;
