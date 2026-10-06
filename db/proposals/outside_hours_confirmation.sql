-- Per-request choice, authenticated by the existing RPCs. No customer data backfill.
create or replace function crm_private.outside_hours_next(p_at timestamptz)
returns timestamptz language plpgsql immutable set search_path='' as $$
declare local_at timestamp:=p_at at time zone 'Europe/Madrid';d date:=local_at::date;t time:=local_at::time;dow integer:=extract(isodow from local_at);
begin
 if dow<>7 and ((t>=time '10:00' and t<time '14:00') or (dow<>6 and t>=time '17:30' and t<time '20:30')) then return null;end if;
 if dow<>7 and t<time '10:00' then return (d+time '10:00') at time zone 'Europe/Madrid';end if;
 if dow<6 and t<time '17:30' then return (d+time '17:30') at time zone 'Europe/Madrid';end if;
 d:=d+case when dow=6 then 2 else 1 end;
 return (d+time '10:00') at time zone 'Europe/Madrid';
end $$;
revoke all on function crm_private.outside_hours_next(timestamptz) from public;
grant execute on function crm_private.outside_hours_next(timestamptz) to authenticated,service_role;

create or replace function crm_private.outside_hours_job_choice()
returns trigger language plpgsql set search_path='' as $$
declare choice text;next_at timestamptz;approved jsonb;
begin
 -- A child job must never inherit consent given to a different job.
 if tg_op='INSERT' then new.context:=coalesce(new.context,'{}'::jsonb)-'outside_hours_approval';
 elsif new.context->'outside_hours_approval' is distinct from old.context->'outside_hours_approval' then
  new.context:=(coalesce(new.context,'{}'::jsonb)-'outside_hours_approval')||case when old.context ? 'outside_hours_approval' then jsonb_build_object('outside_hours_approval',old.context->'outside_hours_approval') else '{}'::jsonb end;
 end if;
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_use_whatsapp')) then return new;end if;
 choice:=coalesce(substring(nullif(current_setting('request.headers',true),'')::jsonb->>'x-client-info' from 'tpf-outside-hours=(now|next)'), '');
 if choice not in ('now','next') or new.status<>'pending' or new.run_at>now()+interval '2 minutes' then return new;end if;
 if new.action_type not in ('__send_whatsapp','schedule_whatsapp','send_template','flow_v1') then return new;end if;
 next_at:=crm_private.outside_hours_next(now());if next_at is null then return new;end if;
 if choice='next' then
  new.run_at:=next_at;
  new.context:=(new.context-'outside_hours_approval')||jsonb_build_object('outside_hours_choice','next','outside_hours_chosen_by',auth.uid(),'outside_hours_chosen_at',now());
  if new.action_type='flow_v1' then new.context:=new.context||jsonb_build_object('event_at',next_at);end if;
 else
  approved:=jsonb_build_object('job_id',new.id,'actor_id',auth.uid(),'approved_at',now(),'until',now()+interval '15 minutes');
  new.context:=new.context||jsonb_build_object('outside_hours_approval',approved);
 end if;
 return new;
end $$;
revoke all on function crm_private.outside_hours_job_choice() from public;
create trigger y_outside_hours_job_choice before insert or update of run_at,context on public.crm_server_automation_jobs for each row execute function crm_private.outside_hours_job_choice();

create or replace function crm_private.outside_hours_agenda_choice()
returns trigger language plpgsql set search_path='' as $$
declare choice text;next_at timestamptz;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_use_whatsapp')) then return new;end if;
 choice:=coalesce(substring(nullif(current_setting('request.headers',true),'')::jsonb->>'x-client-info' from 'tpf-outside-hours=(now|next)'), '');
 if choice<>'next' or not new.whatsapp_enabled or new.status<>'pending' or new.whatsapp_sent_at is not null or new.whatsapp_scheduled_at>now()+interval '2 minutes' then return new;end if;
 next_at:=crm_private.outside_hours_next(now());if next_at is null then return new;end if;
 new.whatsapp_scheduled_at:=next_at;new.starts_at:=next_at;return new;
end $$;
revoke all on function crm_private.outside_hours_agenda_choice() from public;
create trigger y_outside_hours_agenda_choice before insert or update of whatsapp_scheduled_at on public.agenda_items for each row execute function crm_private.outside_hours_agenda_choice();
