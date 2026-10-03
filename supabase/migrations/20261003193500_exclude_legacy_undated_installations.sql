-- Legacy Tramitado rows without an installation record or Excel date are commercial history.
-- Exclude them from the installation register without changing sales, tags or jobs.
create or replace function public.crm_installations_list() returns setof jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_view_sales')) then raise exception 'No tienes permiso';end if;
 return query select coalesce(to_jsonb(i),'{}'::jsonb)||jsonb_build_object('opportunity_id',o.id,'client_name',o.client_name,'operator',coalesce(i.operator,f.operator,o.installation_operator,o.after_sale_preferences->>'operator',o.title),'price',o.amount,'notice_status',nj.status,'return_status',rj.status,'incident',coalesce(nullif(i.incident,''),case when rj.status='failed' then rj.error_message when nj.status='failed' then nj.error_message end,''),'offer_instance_id',coalesce(i.offer_instance_id,f.id),'offer_sent',f.sent_at is not null,'excel_date',o.installation_date,'status',case when o.installation_date is not null then 'excel' when coalesce(i.incident,'')<>'' or nj.status='failed' or rj.status='failed' then 'incident' when i.installed_on is not null then 'confirmed' when i.appointment_date is not null then 'scheduled' else 'undated' end,'legacy',i.id is null)
 from public.sales_opportunities o join public.sales_stages s on s.id=o.stage_id left join public.crm_installations i on i.opportunity_id=o.id
 left join public.crm_server_automation_jobs nj on nj.id=i.notice_job_id left join public.crm_server_automation_jobs rj on rj.id=i.return_job_id
 left join lateral(select * from public.crm_offer_instances where opportunity_id=o.id order by created_at desc limit 1) f on true
 where i.id is not null or o.installation_date is not null
 order by i.appointment_date nulls last,i.time_from nulls last,o.created_at,o.id;
end;$$;
revoke all on function public.crm_installations_list() from public,anon;
grant execute on function public.crm_installations_list() to authenticated;

