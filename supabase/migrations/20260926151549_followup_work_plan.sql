alter table public.crm_offer_instances
 add column if not exists pause_reason text,
 add column if not exists next_action text,
 add column if not exists next_action_at timestamptz,
 add column if not exists followup_owner text,
 add column if not exists plan_task_id uuid references public.agenda_items(id) on delete set null;
create table public.crm_offer_work_history (
 id uuid primary key default gen_random_uuid(),
 offer_id uuid not null references public.crm_offer_instances(id) on delete cascade,
 actor_id uuid, actor_name text not null, created_at timestamptz not null default now(),
 previous_status text, status text, pause_reason text, next_action text, next_action_at timestamptz, followup_owner text
);
create index on public.crm_offer_work_history(offer_id,created_at desc);
alter table public.crm_offer_work_history enable row level security;
revoke all on public.crm_offer_work_history from public,anon,authenticated;
grant select on public.crm_offer_work_history to authenticated;
grant all on public.crm_offer_work_history to service_role;
create policy offer_work_history_read on public.crm_offer_work_history for select to authenticated using
 (exists(select 1 from public.crm_offer_instances o where o.id=offer_id));
create function private.offer_work_history_capture() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.status,new.pause_reason,new.next_action,new.next_action_at,new.followup_owner) is distinct from
 (old.status,old.pause_reason,old.next_action,old.next_action_at,old.followup_owner) then
 insert into public.crm_offer_work_history(offer_id,actor_id,actor_name,previous_status,status,pause_reason,next_action,next_action_at,followup_owner)
 values(new.id,auth.uid(),coalesce(nullif(auth.jwt()->>'email',''),'Automático'),old.status,new.status,new.pause_reason,new.next_action,new.next_action_at,new.followup_owner);
 end if;return new;
end $$;
revoke all on function private.offer_work_history_capture() from public,anon,authenticated;
create trigger offer_work_history_capture after update on public.crm_offer_instances for each row execute function private.offer_work_history_capture();
create function public.crm_save_offer_work_plan(p_offer_id uuid,p_reason text,p_next_action text,p_at timestamptz,p_owner text,p_pause boolean,p_remind boolean,p_expected_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.crm_offer_instances%rowtype; t uuid; opp public.sales_opportunities%rowtype;
begin
 if auth.uid() is null or not(public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para modificar ofertas';end if;
 select * into o from public.crm_offer_instances where id=p_offer_id for update;
 if not found then raise exception 'Oferta no disponible';end if;
 if o.updated_at is distinct from p_expected_at then raise exception 'La oferta cambió en otro equipo. Cierra y actualiza antes de guardar.';end if;
 if length(coalesce(p_reason,''))>500 or length(coalesce(p_next_action,''))>250 or length(coalesce(p_owner,''))>100 then raise exception 'Texto demasiado largo';end if;
 if p_pause and nullif(btrim(p_reason),'') is null then raise exception 'Indica el motivo de la pausa';end if;
 if p_pause and o.status not in ('following','queued','paused') then raise exception 'Esta oferta no se puede pausar';end if;
 if p_at is not null and nullif(btrim(p_next_action),'') is null then raise exception 'Indica la próxima acción';end if;
 if p_remind and (p_at is null or p_at<=now()) then raise exception 'El aviso necesita una fecha futura';end if;
 t:=o.plan_task_id;
 if p_remind then
 select * into opp from public.sales_opportunities where id=o.opportunity_id;
 if t is not null then
 update public.agenda_items set title=p_next_action,description=p_reason,starts_at=p_at,reminder_at=p_at,status='pending',assigned_to=auth.uid(),notify_in_app=true,reminder_methods='["in_app"]',reminder_minutes='[0]',updated_at=now() where id=t and not whatsapp_enabled;
 if not found then raise exception 'No se pudo actualizar el aviso vinculado';end if;
 else
 insert into public.agenda_items(title,description,starts_at,reminder_at,customer_name,customer_phone,related_record_id,assigned_to,created_by,reminder_methods,reminder_minutes,notify_in_app,whatsapp_enabled,agenda_meta)
 values(p_next_action,p_reason,p_at,p_at,opp.client_name,opp.phone,o.contact_id,auth.uid(),auth.uid(),'["in_app"]','[0]',true,false,jsonb_build_object('offer_work_plan',o.id)) returning id into t;
 end if;
 elsif t is not null then
 update public.agenda_items set status='cancelled',updated_at=now() where id=t and status='pending' and not whatsapp_enabled;
 end if;
 if p_pause and o.status<>'paused' then perform public.crm_control_offer(o.id,'pause');end if;
 update public.crm_offer_instances set pause_reason=nullif(btrim(p_reason),''),next_action=nullif(btrim(p_next_action),''),next_action_at=p_at,followup_owner=nullif(btrim(p_owner),''),plan_task_id=t,updated_at=now() where id=o.id;
 return jsonb_build_object('ok',true,'task_id',case when p_remind then t else null end);
end $$;
revoke all on function public.crm_save_offer_work_plan(uuid,text,text,timestamptz,text,boolean,boolean,timestamptz) from public,anon;
grant execute on function public.crm_save_offer_work_plan(uuid,text,text,timestamptz,text,boolean,boolean,timestamptz) to authenticated;
