create or replace function crm_private.queue_contact_sync_after() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.source_sheet not in ('BASE DE DATOS') then return new; end if;
 if TG_OP='UPDATE' and public.crm_contact_sync_fields(new.data)=public.crm_contact_sync_fields(old.data) then return new; end if;
 insert into public.crm_contact_sync_queue(record_id,priority) values(new.id,10)
 on conflict(record_id) do update set revision=crm_contact_sync_queue.revision+1,status='pending',priority=10,attempts=0,next_attempt_at=now(),last_error=null,updated_at=now();
 return new;
end $$;
create or replace function crm_private.invalidate_contact_sync() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if new.source_sheet in ('BASE DE DATOS') and (TG_OP='INSERT' or public.crm_contact_sync_fields(new.data) is distinct from public.crm_contact_sync_fields(old.data)) then
 new.data=(new.data-'TPF_CONTACT_VERIFIED'-'TPF_CRM_GOOGLE_SYNC') || jsonb_build_object('TPF_CONTACT_SYNC',jsonb_build_object('status','pending','updated_at',now()));
 end if; return new;
end $$;
create or replace function public.crm_claim_contact_sync() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.crm_contact_sync_queue; r public.records; matches integer;
begin
 select * into q from public.crm_contact_sync_queue where status in ('pending','retry','processing') and next_attempt_at<=now() and (lease_until is null or lease_until<now()) order by priority desc, updated_at limit 1 for update skip locked;
 if not found then return null; end if;
 update public.crm_contact_sync_queue set status='processing',lease_until=now()+interval '5 minutes',attempts=attempts+1 where record_id=q.record_id;
 select * into r from public.records where id=q.record_id;
 select count(*) into matches from public.records x where x.source_sheet in ('BASE DE DATOS') and right(regexp_replace(public.crm_contact_sync_fields(x.data)->>3,'\D','','g'),9)=right(regexp_replace(public.crm_contact_sync_fields(r.data)->>3,'\D','','g'),9);
 return jsonb_build_object('id',r.id,'data',r.data,'revision',q.revision,'attempts',q.attempts+1,'duplicates',matches,'google_resource',q.google_resource,'google_account',q.google_account);
end $$;
create or replace function public.crm_finish_contact_sync(p_id uuid,p_revision bigint,p_status text,p_error text default null,p_metadata jsonb default null,p_resource text default null,p_account text default null) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.crm_contact_sync_queue;
begin
 select * into q from public.crm_contact_sync_queue where record_id=p_id for update;
 if not found then return false; end if;
 if q.revision<>p_revision then update public.crm_contact_sync_queue set lease_until=null where record_id=p_id; return false; end if;
 if p_status not in ('verified','retry','review','checkpoint') then raise exception 'invalid status'; end if;
 if p_status='checkpoint' then update public.crm_contact_sync_queue set google_resource=p_resource,google_account=p_account where record_id=p_id; return true; end if;
 update public.crm_contact_sync_queue set status=p_status,lease_until=null,google_resource=coalesce(p_resource,google_resource),google_account=coalesce(p_account,google_account),last_error=left(p_error,500),next_attempt_at=now()+make_interval(secs=>least(3600,60*power(2,least(attempts,6)))::integer),updated_at=now() where record_id=p_id;
 update public.records set data=(data-'TPF_CONTACT_VERIFIED'-'TPF_CRM_GOOGLE_SYNC') || coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('TPF_CONTACT_SYNC',jsonb_build_object('status',p_status,'error',left(p_error,500),'updated_at',now())) where id=p_id;
 return true;
end $$;
delete from public.crm_contact_sync_queue q using public.records r where q.record_id=r.id and r.source_sheet<>'BASE DE DATOS';
update public.records set data=data-'TPF_CONTACT_SYNC' where source_sheet='DATA' and data ? 'TPF_CONTACT_SYNC';
