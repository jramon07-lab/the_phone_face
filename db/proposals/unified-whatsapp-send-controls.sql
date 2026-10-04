
-- Individual manual send controls: lock and compare state to avoid editing an in-flight send.
create or replace function public.crm_control_scheduled_whatsapp(p_id uuid,p_expected_at timestamptz,p_action text,p_text text default null,p_when timestamptz default null)
returns text language plpgsql security invoker set search_path='' as $$
declare a public.agenda_items; next_at timestamptz;
begin
 if auth.uid() is null then raise exception 'Inicia sesión';end if;
 select * into a from public.agenda_items where id=p_id for update;
 if not found then raise exception 'Envío no encontrado o sin permiso';end if;
 if a.updated_at is distinct from p_expected_at then raise exception 'Este envío cambió en otro dispositivo. Actualiza antes de continuar.';end if;
 if not a.whatsapp_enabled or a.status<>'pending' or a.whatsapp_sent_at is not null or nullif(a.whatsapp_provider_message_id,'') is not null then raise exception 'Este envío ya no se puede modificar';end if;
 if coalesce(a.whatsapp_delivery_status,'pending') not in ('pending','paused','error','failed') then raise exception 'El envío está en curso o necesita revisión. No se ha modificado.';end if;
 if p_action='edit' then
  if coalesce(a.whatsapp_delivery_status,'pending') not in ('pending','paused') then raise exception 'Solo se pueden editar envíos pendientes o pausados';end if;
  if nullif(trim(p_text),'') is null or p_when is null or p_when<=now() then raise exception 'Indica un mensaje y una fecha futura';end if;
  update public.agenda_items set whatsapp_message=trim(p_text),whatsapp_scheduled_at=p_when,starts_at=p_when,updated_at=now() where id=p_id;
  if a.whatsapp_delivery_status='paused' then update public.agenda_items set whatsapp_delivery_status='paused' where id=p_id and whatsapp_delivery_status='pending';end if;
 elsif p_action='pause' and coalesce(a.whatsapp_delivery_status,'pending')='pending' then
  update public.agenda_items set whatsapp_delivery_status='paused',whatsapp_delivery_error=null,updated_at=now() where id=p_id;
 elsif p_action='resume' and a.whatsapp_delivery_status='paused' then
  next_at=greatest(coalesce(a.whatsapp_scheduled_at,a.starts_at),now()+interval '1 minute');
  update public.agenda_items set whatsapp_delivery_status='pending',whatsapp_delivery_error=null,whatsapp_scheduled_at=next_at,starts_at=next_at,updated_at=now() where id=p_id;
 elsif p_action='cancel' then
  update public.agenda_items set status='cancelled',whatsapp_delivery_status='cancelled',whatsapp_delivery_error=null,updated_at=now() where id=p_id;
 elsif p_action='retry' and a.whatsapp_delivery_status in ('error','failed') then
  next_at=now()+interval '1 minute';
  update public.agenda_items set whatsapp_delivery_status='pending',whatsapp_delivery_error=null,whatsapp_scheduled_at=next_at,starts_at=next_at,updated_at=now() where id=p_id;
 else raise exception 'El estado del envío no permite esta acción';end if;
 return (select whatsapp_delivery_status from public.agenda_items where id=p_id);
end;$$;
revoke all on function public.crm_control_scheduled_whatsapp(uuid,timestamptz,text,text,timestamptz) from public,anon;
grant execute on function public.crm_control_scheduled_whatsapp(uuid,timestamptz,text,text,timestamptz) to authenticated;

-- Sent history follows table RLS and deduplicates the provider's message ID.
create or replace function public.crm_whatsapp_sent_history(p_offset integer default 0,p_limit integer default 200)
returns jsonb language sql stable security invoker set search_path='' as $$
 with sent as (
 select coalesce(nullif(m.id_message,''),'wa:'||m.id) message_key,
 case when m.ts>1000000000000 then to_timestamp(m.ts::double precision/1000) when m.ts>0 then to_timestamp(m.ts::double precision) else m.created_at end sent_at,
 3 priority,'history' source,m.id::text id,'' contact,split_part(m.chat_id,'@',1) phone,coalesce(m.text_content,'') message,'WhatsApp enviado' reason,'' operator,'' contact_id
 from public.wa_messages m where m.direction='out'
 union all
 select j.action_config#>>'{__delivery_receipt,idMessage}',coalesce(nullif(j.action_config#>>'{__delivery_receipt,acceptedAt}','')::timestamptz,j.completed_at,j.updated_at),
 1,'automation',j.id::text,coalesce(j.context->>'name',j.context->>'contact_name',''),coalesce(j.context->>'phone',j.context->>'contact_phone',''),coalesce(j.action_config->>'text',''),'Envío automático',coalesce(j.context->>'operator',''),coalesce(j.context->>'contact_id','')
 from public.crm_server_automation_jobs j where j.action_type in ('send_template','send_whatsapp_now','__send_whatsapp','schedule_whatsapp') and nullif(j.action_config#>>'{__delivery_receipt,idMessage}','') is not null
 union all
 select coalesce(nullif(a.whatsapp_provider_message_id,''),'agenda:'||a.id),a.whatsapp_sent_at,
 2,'program',a.id::text,coalesce(a.customer_name,''),coalesce(a.whatsapp_phone,a.customer_phone,''),coalesce(a.whatsapp_message,''),coalesce(a.title,'WhatsApp programado'),'',coalesce(a.related_record_id::text,'')
 from public.agenda_items a where a.whatsapp_delivery_status='sent' and a.whatsapp_sent_at is not null
 ), grouped as (
 select distinct on(message_key) * from sent where message_key is not null order by message_key,priority
 ), page as (
 select * from grouped order by sent_at desc,message_key limit least(greatest(p_limit,1),500) offset greatest(p_offset,0)
 )
 select jsonb_build_object('total',(select count(*) from grouped),'rows',coalesce((select jsonb_agg(to_jsonb(page)||jsonb_build_object('message',coalesce(nullif((select m.text_content from public.wa_messages m where m.id_message=page.message_key and m.direction='out' order by m.created_at limit 1),''),page.message)) order by sent_at desc,message_key) from page),'[]'::jsonb));
$$;
revoke all on function public.crm_whatsapp_sent_history(integer,integer) from public,anon;
grant execute on function public.crm_whatsapp_sent_history(integer,integer) to authenticated;
