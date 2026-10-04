CREATE OR REPLACE FUNCTION public.crm_whatsapp_sent_history_filtered(p_from timestamptz DEFAULT NULL,p_to timestamptz DEFAULT NULL,p_offset integer DEFAULT 0,p_limit integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
 ), scoped as (select * from grouped where (p_from is null or sent_at>=p_from) and (p_to is null or sent_at<p_to)), page as (
 select * from scoped order by sent_at desc,message_key limit least(greatest(p_limit,1),500) offset greatest(p_offset,0)
 )
 select jsonb_build_object('total',(select count(*) from scoped),'rows',coalesce((select jsonb_agg(to_jsonb(page)||jsonb_build_object('message',coalesce(nullif((select m.text_content from public.wa_messages m where m.id_message=page.message_key and m.direction='out' order by m.created_at limit 1),''),page.message)) order by sent_at desc,message_key) from page),'[]'::jsonb));
$function$
;
revoke all on function public.crm_whatsapp_sent_history_filtered(timestamptz,timestamptz,integer,integer) from public,anon;
grant execute on function public.crm_whatsapp_sent_history_filtered(timestamptz,timestamptz,integer,integer) to authenticated;