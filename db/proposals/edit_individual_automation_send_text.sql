create or replace function public.crm_edit_automation_send_text(p_job_id uuid,p_expected_at timestamptz,p_text text)
returns text language plpgsql security invoker set search_path='' as $$
declare j public.crm_server_automation_jobs;
begin
 if auth.uid() is null then raise exception 'Inicia sesión';end if;
 select * into j from public.crm_server_automation_jobs where id=p_job_id and user_id=auth.uid() for update;
 if not found then raise exception 'Envío no encontrado o sin permiso';end if;
 if j.updated_at is distinct from p_expected_at then raise exception 'Este envío cambió en otro dispositivo. Actualiza antes de continuar.';end if;
 if j.status not in ('pending','paused') or j.action_type not in ('send_template','send_whatsapp_now','__send_whatsapp','schedule_whatsapp') or nullif(j.action_config->'__delivery_receipt'->>'idMessage','') is not null then raise exception 'Este envío está en curso, enviado o cancelado y no se puede editar';end if;
 if nullif(trim(p_text),'') is null or length(p_text)>10000 then raise exception 'Escribe un mensaje de hasta 10000 caracteres';end if;
 update public.crm_server_automation_jobs set action_type='__send_whatsapp',action_config=coalesce(j.action_config,'{}'::jsonb)||jsonb_build_object('text',trim(p_text),'__text_edited_at',now()),updated_at=now() where id=j.id and user_id=auth.uid();
 return (select status from public.crm_server_automation_jobs where id=j.id and user_id=auth.uid());
end;$$;
revoke all on function public.crm_edit_automation_send_text(uuid,timestamptz,text) from public,anon;
grant execute on function public.crm_edit_automation_send_text(uuid,timestamptz,text) to authenticated;