-- The existing FK sets plan_task_id to null when its Agenda task is deleted.
-- Clear that task's date in the same row, so it cannot become a standalone reminder.
create function crm_private.clear_deleted_offer_plan_date()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if old.plan_task_id is not null and new.plan_task_id is null
     and new.next_action_at is not distinct from old.next_action_at then
    new.next_action_at := null;
  end if;
  return new;
end;
$$;
revoke all on function crm_private.clear_deleted_offer_plan_date() from public, anon, authenticated;
create trigger clear_deleted_offer_plan_date
before update of plan_task_id on public.crm_offer_instances
for each row execute function crm_private.clear_deleted_offer_plan_date();
