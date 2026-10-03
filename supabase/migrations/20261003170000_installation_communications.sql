-- Explicit installation communication workflow. Existing jobs and sales are not rewritten.
create table public.crm_installations (
 id uuid primary key default gen_random_uuid(),
 opportunity_id uuid not null unique references public.sales_opportunities(id) on delete cascade,
 offer_instance_id uuid references public.crm_offer_instances(id) on delete set null,
 user_id uuid not null references auth.users(id),
 operator text not null,
 previous_operator text not null default '',
 appointment_date date,
 time_from time,
 time_to time,
 recipient_context jsonb not null,
 send_notice boolean not null default true,
 notice_text text not null default '',
 return_text text not null default '',
 config_snapshot jsonb not null default '{}',
 revision integer not null default 1,
 notice_job_id uuid references public.crm_server_automation_jobs(id) on delete set null,
 installed_on date,
 confirmed_at timestamptz,
 confirmation_message_id text,
 awaiting_date boolean not null default false,
 return_due_at timestamptz,
 return_job_id uuid references public.crm_server_automation_jobs(id) on delete set null,
 incident text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(time_to is null or time_from is not null and time_to>time_from)
);
create index crm_installations_appointment_idx on public.crm_installations(appointment_date,time_from,id);
create unique index crm_installation_job_event on public.crm_server_automation_jobs(event_key) where context ? 'installation_id';
create table public.crm_installation_outgoing_messages (
 provider_message_id text primary key,
 installation_id uuid not null references public.crm_installations(id) on delete cascade,
 job_id uuid references public.crm_server_automation_jobs(id) on delete set null,
 phase text not null,
 sent_at timestamptz not null default now()
);
alter table public.crm_installations enable row level security;
alter table public.crm_installation_outgoing_messages enable row level security;
create policy installations_read on public.crm_installations for select to authenticated using (public.current_user_is_admin() or public.current_user_can('can_view_sales'));
create policy installation_messages_read on public.crm_installation_outgoing_messages for select to authenticated using (public.current_user_is_admin() or public.current_user_can('can_view_sales'));
grant select on public.crm_installations,public.crm_installation_outgoing_messages to authenticated;
grant all on public.crm_installations,public.crm_installation_outgoing_messages to service_role;

create function crm_private.installation_defaults() returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('netflix_extra_text','','slots','[]'::jsonb,'shop_phone','','return_time','10:00',
 'appointment_text',E'Hola {nombre} 👋\n\nLa instalación de {operador} está prevista para el {fecha}, {franja}. Estate pendiente del teléfono: el técnico podría llamarte para confirmar la visita o adelantarla.\n\nSi tienes algún problema, {ayuda}. Cuando esté instalada, pulsa «Instalado» para indicarnos la fecha.',
 'no_appointment_text',E'Hola {nombre} 👋\n\nHemos tramitado tu contrato con {operador}. Estamos pendientes de que el operador confirme la cita de instalación. Estate pendiente del teléfono: el técnico podría llamarte para concertar o adelantar la visita.\n\nSi tienes algún problema, {ayuda}. Cuando esté instalada, pulsa «Instalado» para indicarnos la fecha.',
 'date_prompt_text','Gracias, {nombre}. ¿Qué día te instalaron la fibra?',
 'date_other_text','Escribe la fecha de instalación con este formato: DD/MM/AAAA. ',
 'confirmed_text','Gracias, {nombre}. Hemos anotado tu instalación del {fecha_instalacion}. Si tienes algún problema, {ayuda}.');
$$;

create function crm_private.installation_config(p_operator text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cfg jsonb;legacy text;extra text:='';
begin
 select value into cfg from public.app_settings where key='crm_installation_template:'||lower(p_operator);
 if lower(p_operator)='vodafone' then
  select t.body into legacy from public.crm_automations a join public.wa_templates t on t.id::text=a.trigger_config->>'netflix_template_id' and t.user_id=a.user_id where lower(a.trigger_config->>'automation_operator')='vodafone' and a.trigger_config ? 'netflix_template_id' order by a.enabled desc,a.created_at limit 1;
  if position('⚠️' in coalesce(legacy,''))>0 then extra:=btrim(split_part(substring(legacy from position('⚠️' in legacy)),'📦',1));end if;
 end if;
 return crm_private.installation_defaults()||jsonb_build_object('netflix_extra_text',extra)||coalesce(cfg,'{}'::jsonb);
end;$$;

create function public.crm_installation_settings() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_view_settings') or public.current_user_can('can_view_sales')) then raise exception 'No tienes permiso';end if;
 return jsonb_build_object('defaults',crm_private.installation_defaults(),'operators',jsonb_build_object('Vodafone',crm_private.installation_config('Vodafone')||jsonb_build_object('updated_at',null))||coalesce((select jsonb_object_agg(value->>'operator',value||jsonb_build_object('updated_at',updated_at)) from public.app_settings where key like 'crm_installation_template:%'),'{}'::jsonb));
end;$$;
revoke all on function public.crm_installation_settings() from public,anon;
grant execute on function public.crm_installation_settings() to authenticated;

create function public.crm_installation_save_settings(p_operator text,p_config jsonb,p_expected_at timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare k text;cfg jsonb;old_at timestamptz;s jsonb;v jsonb;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para editar ventas';end if;
 p_operator:=btrim(p_operator);
 if coalesce(p_operator,'')='' or length(p_operator)>80 or p_operator ~ '[[:cntrl:]]' or p_operator in ('__proto__','constructor','prototype','Ninguno','Otro') then raise exception 'Operador no válido';end if;
 if jsonb_typeof(p_config) is distinct from 'object' then raise exception 'Configuración no válida';end if;
 cfg:=crm_private.installation_defaults()||p_config;
 if jsonb_typeof(cfg->'netflix_extra_text') is distinct from 'string' or length(cfg->>'netflix_extra_text')>4000 then raise exception 'Revisa las instrucciones de Netflix';end if;
 foreach k in array array['appointment_text','no_appointment_text','date_prompt_text','date_other_text','confirmed_text'] loop
  if jsonb_typeof(cfg->k) is distinct from 'string' or length(btrim(cfg->>k)) not between 1 and 4000 then raise exception 'Revisa el texto %',k;end if;
 end loop;
 if coalesce(cfg->>'return_time','') !~ '^(1[01]:[0-5][0-9]|12:[0-5][0-9]|13:[0-5][0-9]|17:(3[0-9]|[45][0-9])|1[89]:[0-5][0-9]|20:[012][0-9])$' then raise exception 'Elige una hora de devolución dentro del horario de la tienda';end if;
 if length(coalesce(cfg->>'shop_phone',''))>30 or cfg->>'shop_phone' ~ '[[:cntrl:]]' then raise exception 'Teléfono de tienda no válido';end if;
 if jsonb_typeof(cfg->'slots') is distinct from 'array' or jsonb_array_length(cfg->'slots')>30 then raise exception 'Franjas no válidas';end if;
 for s in select * from jsonb_array_elements(cfg->'slots') loop
  if coalesce(s->>'from','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(s->>'to','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (s->>'to')::time<=(s->>'from')::time then raise exception 'Revisa las franjas horarias';end if;
 end loop;
 k:='crm_installation_template:'||lower(p_operator);
 perform pg_advisory_xact_lock(hashtextextended(k,9013));
 select updated_at into old_at from public.app_settings where key=k for update;
 if old_at is distinct from p_expected_at then raise exception 'La configuración cambió en otro dispositivo. Recarga antes de guardar';end if;
 if cfg ? 'router_text' then
  if length(btrim(cfg->>'router_text')) not between 1 and 4000 then raise exception 'Escribe las instrucciones de devolución';end if;
  insert into public.app_settings(key,value,updated_at) values('crm_router_template:'||crm_private.installation_uri_component(lower(p_operator)),jsonb_build_object('operator',p_operator,'text','📦 '||regexp_replace(cfg->>'router_text','^📦\s*','')),clock_timestamp()) on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
 end if;
 cfg:=cfg||jsonb_build_object('operator',p_operator);
 insert into public.app_settings(key,value,updated_at) values(k,cfg,clock_timestamp()) on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at returning value||jsonb_build_object('updated_at',updated_at) into v;
 return v;
end;$$;
revoke all on function public.crm_installation_save_settings(text,jsonb,timestamptz) from public,anon;
grant execute on function public.crm_installation_save_settings(text,jsonb,timestamptz) to authenticated;

create function crm_private.installation_render(p_text text,p_cfg jsonb,p_context jsonb,p_date date default null,p_from time default null,p_to time default null,p_installed date default null) returns text language sql stable set search_path='' as $$
 select crm_private.contract_message(replace(replace(replace(replace(replace(replace(replace(replace(coalesce(p_text,''),
 '{nombre}',coalesce(nullif(p_context->>'recipient_first_name',''),split_part(coalesce(p_context->>'name','cliente'),' ',1))),
 '{operador}',coalesce(p_context->>'operator','')),
 '{fecha}',coalesce(to_char(p_date,'DD/MM/YYYY'),'')),
 '{franja}',case when p_to is not null then 'entre las '||left(p_from::text,5)||' y las '||left(p_to::text,5) when p_from is not null then 'a las '||left(p_from::text,5) else 'en horario pendiente de confirmar' end),
 '{telefono_tienda}',coalesce(p_cfg->>'shop_phone','')),
 '{ayuda}',case when nullif(btrim(p_cfg->>'shop_phone'),'') is not null then 'llámanos al '||btrim(p_cfg->>'shop_phone') else 'llámanos a la tienda o responde a este WhatsApp' end),
 '{fecha_instalacion}',coalesce(to_char(p_installed,'DD/MM/YYYY'),'')),
 '{operador_anterior}',coalesce(p_context->>'previous_operator','')),p_context->'contract_party');
$$;

create function crm_private.installation_due(p_date date,p_time time default '10:00') returns timestamptz language plpgsql immutable set search_path='' as $$
declare d date:=p_date;n integer:=0;
begin
 if d is null then return null;end if;
 while n<2 loop d:=d+1;if extract(isodow from d)<6 then n:=n+1;end if;end loop;
 return (d+p_time) at time zone 'Europe/Madrid';
end;$$;

create function crm_private.installation_enqueue(p_id uuid,p_suffix text,p_text text,p_buttons jsonb,p_phase text,p_due timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.crm_installations%rowtype;j uuid;aid uuid;
begin
 select * into i from public.crm_installations where id=p_id;
 if not found or not public.crm_server_automations_enabled() then return null;end if;
 select id into aid from public.crm_automations where enabled and user_id=i.user_id and trigger_type='manual_offer' order by created_at limit 1;
 insert into public.crm_server_automation_jobs(automation_id,user_id,event_key,action_type,action_config,context,run_at)
 values(aid,i.user_id,'installation:'||i.id||':'||p_suffix,'__send_whatsapp',jsonb_build_object('text',p_text,'reply_buttons',p_buttons,'offer_phase',p_phase),i.recipient_context||jsonb_build_object('installation_id',i.id,'installation_revision',i.revision,'installation_phase',p_phase,'flow_root','installation:'||i.id),p_due)
 on conflict do nothing returning id into j;
 if j is null then select id into j from public.crm_server_automation_jobs where event_key='installation:'||i.id||':'||p_suffix and context->>'installation_id'=i.id::text;end if;
 return j;
end;$$;

create function crm_private.installation_schedule_return(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare i public.crm_installations%rowtype;txt text;j uuid;due timestamptz;
begin
 select * into i from public.crm_installations where id=p_id for update;
 if not found or i.installed_on is null or i.return_job_id is not null then return;end if;
 if i.previous_operator='Ninguno' then update public.crm_installations set return_due_at=null,incident='',updated_at=clock_timestamp() where id=i.id;return;end if;
 if nullif(btrim(i.previous_operator),'') is null or nullif(btrim(i.return_text),'') is null then update public.crm_installations set incident='Revisar compañía anterior e instrucciones de devolución',updated_at=clock_timestamp() where id=i.id;return;end if;
 due:=crm_private.installation_due(i.installed_on,coalesce(nullif(i.config_snapshot->>'return_time',''),'10:00')::time);
 -- A late confirmation sends in the next available weekday, never at a past date or weekend.
 if due<now() then due:=now()+interval '1 minute';while extract(isodow from due at time zone 'Europe/Madrid')>=6 loop due:=(((due at time zone 'Europe/Madrid')::date+1)+'10:00'::time) at time zone 'Europe/Madrid';end loop;end if;
 txt:=crm_private.installation_render(i.return_text,i.config_snapshot,i.recipient_context,i.appointment_date,i.time_from,i.time_to,i.installed_on);
 j:=crm_private.installation_enqueue(i.id,'return:'||i.revision,txt,'[]','installation_return',due);
 update public.crm_installations set return_due_at=due,return_job_id=j,incident=case when j is null then 'Motor pausado: devolución pendiente de programar' else '' end,updated_at=clock_timestamp() where id=i.id;
end;$$;

create function crm_private.installation_sync(p_opportunity_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.sales_opportunities%rowtype;f public.crm_offer_instances%rowtype;i public.crm_installations%rowtype;p jsonb;ctx jsonb;cfg jsonb;op text;d date;tf time;tt time;txt text;rt text;j uuid;
begin
 select * into o from public.sales_opportunities where id=p_opportunity_id for update;
 if not found or not exists(select 1 from public.sales_stages where id=o.stage_id and lower(btrim(name))='tramitado') then return null;end if;
 p:=o.after_sale_preferences;
 if p->>'workflow' is distinct from 'installation_v1' then return null;end if;
 select * into f from public.crm_offer_instances where opportunity_id=o.id order by created_at desc limit 1;
 select * into i from public.crm_installations where opportunity_id=o.id for update;
 if found then return i.id;end if;
 op:=coalesce(nullif(p->>'operator',''),f.operator,'');cfg:=crm_private.installation_config(op)||jsonb_build_object('return_time',crm_private.installation_config(p->>'previous_operator')->>'return_time');
 d:=nullif(p->>'appointment_date','')::date;tf:=nullif(p->>'time_from','')::time;tt:=nullif(p->>'time_to','')::time;
 ctx:=crm_private.party_context(public.crm_server_context_for_contact(o.record_id,o.phone)||jsonb_build_object('opportunity_id',o.id,'offer_instance_id',f.id,'operator',op,'previous_operator',p->>'previous_operator','event_at',now()),o.contract_party);
 txt:=coalesce(nullif(p->>'text',''),crm_private.installation_render(cfg->>case when d is null then 'no_appointment_text' else 'appointment_text' end,cfg,ctx,d,tf,tt));
 if nullif(p->>'text','') is null and op='Vodafone' and crm_private.offer_netflix_visible(f.snapshot) and nullif(cfg->>'netflix_extra_text','') is not null then txt:=txt||E'\n\n'||(cfg->>'netflix_extra_text');end if;
 rt:=coalesce(p->>'return_text','');
 insert into public.crm_installations(opportunity_id,offer_instance_id,user_id,operator,previous_operator,appointment_date,time_from,time_to,recipient_context,send_notice,notice_text,return_text,config_snapshot)
 values(o.id,f.id,coalesce(o.owner_user_id,f.created_by,auth.uid()),op,coalesce(p->>'previous_operator',''),d,tf,tt,ctx,coalesce((p->>'send')::boolean,true),txt,rt,cfg) returning * into i;
 if not exists(select 1 from public.crm_automations where enabled and trigger_type='opportunity_stage' and trigger_config->>'stage_id'=o.stage_id::text and trigger_config->>'automation_code' like '%_day_one' and lower(trigger_config->>'automation_operator')=lower(op)) then
  insert into public.crm_server_automation_jobs(automation_id,user_id,event_key,action_type,action_config,context,run_at) values(null,i.user_id,'installation:'||i.id||':sale-label','record_sale_month','{}',ctx||jsonb_build_object('installation_id',i.id,'installation_phase','installation_month_label','lifecycle',jsonb_build_object('mode','after_sale','stage_id',o.stage_id)),now()) on conflict do nothing;
 end if;
 if i.send_notice then
  j:=crm_private.installation_enqueue(i.id,'notice:1',txt,jsonb_build_array(jsonb_build_object('buttonId','install_done:'||i.id,'buttonText','✓ Instalado')),'installation_notice',now());
  update public.crm_installations set notice_job_id=j,incident=case when j is null then 'Motor pausado: aviso pendiente de programar' else '' end where id=i.id;
 end if;
 return i.id;
end;$$;

create function public.crm_installation_preview(p_opportunity_id uuid default null,p_contact_id uuid default null,p_manager_contact_id uuid default null,p_recipient_contact_id uuid default null,p_operator text default null,p_netflix_followup boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;cfg jsonb;o public.sales_opportunities%rowtype;f public.crm_offer_instances%rowtype;party jsonb;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso';end if;
 v:='{}'::jsonb;
 if p_opportunity_id is not null then
  select * into o from public.sales_opportunities where id=p_opportunity_id;if not found then raise exception 'Oportunidad no encontrada';end if;
  select * into f from public.crm_offer_instances where opportunity_id=o.id order by created_at desc limit 1;
  p_operator:=coalesce(f.operator,nullif(o.after_sale_preferences->>'operator',''),p_operator,o.installation_operator,(regexp_match(o.title,'(Vodafone|Yoigo|MásMóvil|Masmovil|O2|Orange|Lowi|Jazztel|Digi|Movistar|Pepephone)','i'))[1]);
  p_contact_id:=o.record_id;party:=o.contract_party;p_netflix_followup:=crm_private.offer_netflix_visible(f.snapshot);
 end if;
 if lower(p_operator)='masmovil' then p_operator:='MásMóvil';end if;
 if party is null and p_contact_id is not null then party:=crm_private.resolve_sale_party(p_contact_id,p_manager_contact_id,p_recipient_contact_id);end if;
 v:=jsonb_build_object('operator',p_operator,'preferences',o.after_sale_preferences,'netflix_followup',p_netflix_followup);
 if party is not null then v:=v||jsonb_build_object('contract_party',party,'recipient',party->>'recipient_name','recipient_first_name',party->>'recipient_first_name','phone',party->>'recipient_phone');end if;
 cfg:=crm_private.installation_config(coalesce(v->>'operator',p_operator,''));
 return v||jsonb_build_object('workflow','installation_v1','available',length(coalesce(v->>'phone',''))>=8,'installation_config',cfg,'return_times',coalesce((select jsonb_object_agg(value->>'operator',value->>'return_time') from public.app_settings where key like 'crm_installation_template:%'),'{}'::jsonb),'opportunity_updated_at',o.updated_at,'excel_date',o.installation_date,'installation', (select to_jsonb(i) from public.crm_installations i where opportunity_id=p_opportunity_id));
end;$$;
revoke all on function public.crm_installation_preview(uuid,uuid,uuid,uuid,text,boolean) from public,anon;
grant execute on function public.crm_installation_preview(uuid,uuid,uuid,uuid,text,boolean) to authenticated;

create function public.crm_installation_update(p_opportunity_id uuid,p_expected_at timestamptz,p_patch jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.crm_installations%rowtype;o public.sales_opportunities%rowtype;v jsonb;j uuid;phase text;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso';end if;
 select * into o from public.sales_opportunities where id=p_opportunity_id for update;
 select * into i from public.crm_installations where opportunity_id=p_opportunity_id for update;
 if not found then raise exception 'Instalación no disponible';end if;
 if i.updated_at is distinct from p_expected_at then raise exception 'La instalación cambió en otro dispositivo. Cierra y vuelve a abrir Gestionar';end if;
 if (i.installed_on is not null or o.installation_date is not null) and (p_patch ? 'appointment_date' or p_patch ? 'text') then raise exception 'La instalación ya está confirmada';end if;
 if p_patch ? 'appointment_date' then
  if nullif(p_patch->>'appointment_date','')::date<(now() at time zone 'Europe/Madrid')::date then raise exception 'La cita no puede ser anterior a hoy';end if;
  -- Reject edits while an old notice is being dispatched or has an uncertain receipt.
  if exists(select 1 from public.crm_server_automation_jobs where id=i.notice_job_id and (status='running' or action_config ? '__delivery_receipt' and status='pending')) then raise exception 'El aviso está en envío. Espera a que termine antes de cambiar la cita';end if;
  update public.crm_server_automation_jobs set status='cancelled',error_message='Cita actualizada antes del envío',updated_at=now() where id=i.notice_job_id and status in ('pending','paused');
 end if;
 update public.crm_installations set
  appointment_date=case when p_patch ? 'appointment_date' then nullif(p_patch->>'appointment_date','')::date else appointment_date end,
  time_from=case when p_patch ? 'appointment_date' then nullif(p_patch->>'time_from','')::time else time_from end,
  time_to=case when p_patch ? 'appointment_date' then nullif(p_patch->>'time_to','')::time else time_to end,
  notice_text=case when p_patch ? 'text' then btrim(p_patch->>'text') else notice_text end,
  previous_operator=case when p_patch ? 'previous_operator' then btrim(p_patch->>'previous_operator') else previous_operator end,
  recipient_context=case when p_patch ? 'previous_operator' then jsonb_set(recipient_context,'{previous_operator}',to_jsonb(btrim(p_patch->>'previous_operator'))) else recipient_context end,
  return_text=case when p_patch ? 'return_text' then btrim(p_patch->>'return_text') else return_text end,
  incident=case when p_patch ? 'incident' then left(btrim(p_patch->>'incident'),1000) else incident end,
  revision=revision+1,updated_at=clock_timestamp() where id=i.id returning * into i;
 if (i.appointment_date is null)<>(i.time_from is null) then raise exception 'Indica la fecha y la hora de la cita';end if;
 if length(i.notice_text)>10000 or length(i.return_text)>10000 or length(i.previous_operator)>80 or i.previous_operator ~ '[[:cntrl:]]' then raise exception 'Revisa el operador o los textos';end if;
 if (p_patch ? 'previous_operator' or p_patch ? 'return_text') and i.return_job_id is not null then
  if exists(select 1 from public.crm_server_automation_jobs where id=i.return_job_id and (status in ('running','done','failed') or action_config ? '__delivery_receipt')) then raise exception 'La devolución ya está enviada o en envío. No se cambia automáticamente';end if;
  update public.crm_server_automation_jobs set status='cancelled',error_message='Instrucciones de devolución actualizadas',updated_at=now() where id=i.return_job_id and status in ('pending','paused','failed');
  update public.crm_installations set return_job_id=null,config_snapshot=config_snapshot||jsonb_build_object('return_time',crm_private.installation_config(i.previous_operator)->>'return_time') where id=i.id;
 end if;
 if p_patch ? 'appointment_date' and coalesce((p_patch->>'send')::boolean,false) then
  if nullif(i.notice_text,'') is null then raise exception 'Escribe el mensaje de la cita';end if;
  j:=crm_private.installation_enqueue(i.id,'notice:'||i.revision,i.notice_text,jsonb_build_array(jsonb_build_object('buttonId','install_done:'||i.id,'buttonText','✓ Instalado')),'installation_notice',now());
  update public.crm_installations set notice_job_id=j,send_notice=true where id=i.id returning * into i;
 end if;
 if p_patch ? 'previous_operator' then
  update public.crm_offer_instances set snapshot=jsonb_set(coalesce(snapshot,'{}'::jsonb),'{previous_operator_override}',to_jsonb(i.previous_operator)),updated_at=clock_timestamp() where id=i.offer_instance_id;
  update public.crm_installations set config_snapshot=config_snapshot||jsonb_build_object('return_time',crm_private.installation_config(i.previous_operator)->>'return_time') where id=i.id;end if;
 perform crm_private.installation_schedule_return(i.id);
 select to_jsonb(x) into v from public.crm_installations x where id=i.id;return v;
end;$$;
revoke all on function public.crm_installation_update(uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.crm_installation_update(uuid,timestamptz,jsonb) to authenticated;

create function public.crm_installations_list() returns setof jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_view_sales')) then raise exception 'No tienes permiso';end if;
 return query select coalesce(to_jsonb(i),'{}'::jsonb)||jsonb_build_object('opportunity_id',o.id,'client_name',o.client_name,'operator',coalesce(i.operator,f.operator,o.installation_operator,o.after_sale_preferences->>'operator',o.title),'price',o.amount,'notice_status',nj.status,'return_status',rj.status,'incident',coalesce(nullif(i.incident,''),case when rj.status='failed' then rj.error_message when nj.status='failed' then nj.error_message end,''),'offer_instance_id',coalesce(i.offer_instance_id,f.id),'offer_sent',f.sent_at is not null,'excel_date',o.installation_date,'status',case when o.installation_date is not null then 'excel' when coalesce(i.incident,'')<>'' or nj.status='failed' or rj.status='failed' then 'incident' when i.installed_on is not null then 'confirmed' when i.appointment_date is not null then 'scheduled' else 'undated' end,'legacy',i.id is null)
 from public.sales_opportunities o join public.sales_stages s on s.id=o.stage_id left join public.crm_installations i on i.opportunity_id=o.id
 left join public.crm_server_automation_jobs nj on nj.id=i.notice_job_id left join public.crm_server_automation_jobs rj on rj.id=i.return_job_id
 left join lateral(select * from public.crm_offer_instances where opportunity_id=o.id order by created_at desc limit 1) f on true
 where lower(btrim(s.name))='tramitado' or i.id is not null or o.installation_date is not null
 order by i.appointment_date nulls last,i.time_from nulls last,o.created_at,o.id;
end;$$;
revoke all on function public.crm_installations_list() from public,anon;
grant execute on function public.crm_installations_list() to authenticated;

create function crm_private.installation_incoming() returns trigger language plpgsql security definer set search_path='' as $$
declare selected text;txt text;ph text;i public.crm_installations%rowtype;iid uuid;kind text;d date;m text[];quote_id text;matches integer;ctx jsonb;j uuid;
begin
 if new.direction is distinct from 'in' or new.chat_id like '%@g.us' then return new;end if;
 selected:=coalesce(new.raw#>>'{messageData,interactiveButtonsResponse,selectedButtonId}',new.raw#>>'{messageData,interactiveButtonsResponse,selectedId}',new.raw#>>'{interactiveButtonsResponse,selectedButtonId}',new.raw#>>'{interactiveButtonsResponse,selectedId}',new.raw#>>'{messageData,buttonsResponseMessage,selectedButtonId}',new.raw#>>'{buttonsResponseMessage,selectedButtonId}',new.raw#>>'{messageData,templateButtonReplyMessage,selectedId}',new.raw#>>'{templateButtonReplyMessage,selectedId}','');
 ph:=public.crm_server_normalize_phone(split_part(new.chat_id,'@',1));txt:=lower(btrim(coalesce(new.text_content,'')));
 if selected ~ '^install_(done|today|yesterday|other):[0-9a-f-]{36}$' then
  iid:=split_part(selected,':',2)::uuid;kind:=split_part(selected,':',1);
  select * into i from public.crm_installations where id=iid for update;
 else
  quote_id:=coalesce(new.raw#>>'{messageData,interactiveButtonsResponse,stanzaId}',new.raw#>>'{interactiveButtonsResponse,stanzaId}',new.raw#>>'{messageData,quotedMessage,stanzaId}',new.raw#>>'{quotedMessage,stanzaId}',new.raw#>>'{extendedTextMessage,stanzaId}');
  if quote_id is not null then select x.* into i from public.crm_installations x join public.crm_installation_outgoing_messages sent on sent.installation_id=x.id where sent.provider_message_id=quote_id for update of x;end if;
  if quote_id is not null and i.id is null then return new;end if;
  if i.id is null and (txt in ('instalado','✓ instalado','hoy','ayer','otra fecha','1','2','3') or txt ~ '^\d{1,2}/\d{1,2}/\d{4}$') then
   select count(*) into matches from public.crm_installations x join public.sales_opportunities o on o.id=x.opportunity_id where x.installed_on is null and public.crm_server_normalize_phone(x.recipient_context->>'phone')=ph and o.status='open' and (txt in ('instalado','✓ instalado') or x.awaiting_date);
   if matches=1 then select x.* into i from public.crm_installations x join public.sales_opportunities o on o.id=x.opportunity_id where x.installed_on is null and public.crm_server_normalize_phone(x.recipient_context->>'phone')=ph and o.status='open' and (txt in ('instalado','✓ instalado') or x.awaiting_date) for update of x;end if;
  end if;
  kind:=case when txt in ('instalado','✓ instalado','1. ✓ instalado') then 'install_done' when i.awaiting_date and txt in ('hoy','1') then 'install_today' when i.awaiting_date and txt in ('ayer','2') then 'install_yesterday' when i.awaiting_date and txt in ('otra fecha','3') then 'install_other' when i.awaiting_date and txt ~ '^\d{1,2}/\d{1,2}/\d{4}$' then 'install_date' end;
 end if;
 if i.id is null or kind is null or i.installed_on is not null or public.crm_server_normalize_phone(i.recipient_context->>'phone') is distinct from ph then return new;end if;
 if not exists(select 1 from public.sales_opportunities o join public.sales_stages s on s.id=o.stage_id where o.id=i.opportunity_id and lower(btrim(s.name)) in ('tramitado','ganado')) then return new;end if;
 if kind='install_done' then
  if i.awaiting_date then return new;end if;
  update public.crm_installations set awaiting_date=true,updated_at=clock_timestamp() where id=i.id;
  perform crm_private.installation_enqueue(i.id,'date-question:'||new.id_message,crm_private.installation_render(i.config_snapshot->>'date_prompt_text',i.config_snapshot,i.recipient_context),jsonb_build_array(jsonb_build_object('buttonId','install_today:'||i.id,'buttonText','Hoy'),jsonb_build_object('buttonId','install_yesterday:'||i.id,'buttonText','Ayer'),jsonb_build_object('buttonId','install_other:'||i.id,'buttonText','Otra fecha')),'installation_date',now());
  return new;
 elsif not i.awaiting_date then return new;
 elsif kind='install_other' then
  perform crm_private.installation_enqueue(i.id,'date-other:'||new.id_message,i.config_snapshot->>'date_other_text','[]','installation_date',now());return new;
 elsif kind='install_today' then d:=(new.created_at at time zone 'Europe/Madrid')::date;
 elsif kind='install_yesterday' then d:=(new.created_at at time zone 'Europe/Madrid')::date-1;
 elsif kind='install_date' then
  m:=regexp_match(txt,'^(\d{1,2})/(\d{1,2})/(\d{4})$');
  begin d:=make_date(m[3]::integer,m[2]::integer,m[1]::integer);exception when others then d:=null;end;
 end if;
 if d is null or d>(now() at time zone 'Europe/Madrid')::date or d<(i.created_at at time zone 'Europe/Madrid')::date-30 then
  perform crm_private.installation_enqueue(i.id,'date-invalid:'||new.id_message,'Revisa la fecha: debe ser una fecha pasada o de hoy, con formato DD/MM/AAAA.','[]','installation_date',now());return new;end if;
 update public.crm_installations set installed_on=d,confirmed_at=new.created_at,confirmation_message_id=new.id_message,awaiting_date=false,updated_at=clock_timestamp() where id=i.id;
 perform crm_private.installation_schedule_return(i.id);
 perform crm_private.installation_enqueue(i.id,'confirmed',crm_private.installation_render(i.config_snapshot->>'confirmed_text',i.config_snapshot,i.recipient_context,i.appointment_date,i.time_from,i.time_to,d),'[]','installation_confirmed',now());
 -- No changes to sales_opportunities.installation_date, status, tags or 3m/11m.
 return new;
end;$$;
create trigger crm_installation_incoming after insert on public.wa_messages for each row execute function crm_private.installation_incoming();

-- Restrict every new private helper; only dedicated authenticated RPCs and the server use them.
do $$declare f record;begin for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='crm_private' and p.proname like 'installation_%' loop execute 'revoke all on function '||f.sig||' from public,anon,authenticated';end loop;end;$$;

-- Assert business-day and DST calendar arithmetic before accepting the migration.
do $$begin
 if (crm_private.installation_due('2026-10-02','10:00') at time zone 'Europe/Madrid')::date<>'2026-10-06'::date then raise exception 'Friday must schedule Tuesday';end if;
 if (crm_private.installation_due('2026-10-03','10:00') at time zone 'Europe/Madrid')::date<>'2026-10-06'::date then raise exception 'Saturday must schedule Tuesday';end if;
 if crm_private.installation_due('2026-10-23','10:00')<>'2026-10-27 09:00Z'::timestamptz then raise exception 'DST date failed';end if;
end;$$;

CREATE OR REPLACE FUNCTION crm_private.router_return_preferences_before_installations(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare send boolean;scheduled timestamptz;
begin
 if p is null then return null;end if;
 if jsonb_typeof(p)<>'object' then raise exception 'Configuración de devolución no válida';end if;
 if coalesce(p->>'send','') not in ('true','false') then raise exception 'Indica si se envía el mensaje';end if;
 send:=(p->>'send')::boolean;
 if jsonb_typeof(p->'previous_operator') is distinct from 'string'
    or length(btrim(coalesce(p->>'previous_operator','')))=0
    or length(p->>'previous_operator')>80
    or p->>'previous_operator' ~ '[[:cntrl:]]'
    or p->>'previous_operator' in ('__proto__','prototype','constructor')
 then raise exception 'Selecciona el operador anterior';end if;
 if send and (length(btrim(coalesce(p->>'text','')))=0 or length(p->>'text')>10000) then raise exception 'El mensaje debe tener entre 1 y 10000 caracteres';end if;
 if send and nullif(p->>'rule_id','') is null then raise exception 'No hay mensaje del día siguiente configurado';end if;
 if send and nullif(p->>'send_at','') is not null then
   scheduled:=(p->>'send_at')::timestamptz;
   if scheduled<=now()+interval '1 minute' then raise exception 'Elige una fecha y hora futuras';end if;
 end if;
 return jsonb_build_object('previous_operator',p->>'previous_operator','text',coalesce(p->>'text',''),'send',send,'send_at',case when send then scheduled end,'operator',coalesce(p->>'operator',''),'rule_id',p->>'rule_id');
end $function$
;
revoke all on function crm_private.router_return_preferences_before_installations(jsonb) from public,anon,authenticated;

create or replace function crm_private.router_return_preferences(p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare d date;tf time;tt time;
begin
 if p->>'workflow' is distinct from 'installation_v1' then return crm_private.router_return_preferences_before_installations(p);end if;
 if jsonb_typeof(p)<>'object' or coalesce(p->>'send','') not in ('true','false') then raise exception 'Configuración de instalación no válida';end if;
 if jsonb_typeof(p->'previous_operator') is distinct from 'string' or length(p->>'previous_operator')>80 or p->>'previous_operator' ~ '[[:cntrl:]]' or p->>'previous_operator' in ('__proto__','prototype','constructor') then raise exception 'Compañía anterior no válida';end if;
 if length(coalesce(p->>'text',''))>10000 or length(coalesce(p->>'return_text',''))>10000 or p->>'send'='true' and length(btrim(coalesce(p->>'text','')))=0 then raise exception 'Revisa los textos';end if;
 d:=nullif(p->>'appointment_date','')::date;tf:=nullif(p->>'time_from','')::time;tt:=nullif(p->>'time_to','')::time;
 if (d is null)<>(tf is null) or tt is not null and (tf is null or tt<=tf) then raise exception 'Indica la fecha y la hora de la cita';end if;
 if d<(now() at time zone 'Europe/Madrid')::date then raise exception 'La cita debe ser de hoy o futura';end if;
 return jsonb_build_object('workflow','installation_v1','previous_operator',p->>'previous_operator','operator',p->>'operator','send',(p->>'send')::boolean,'text',coalesce(p->>'text',''),'return_text',coalesce(p->>'return_text',''),'appointment_date',d,'time_from',tf,'time_to',tt,'rule_id',p->>'rule_id','send_at',null);
end;$$;
revoke all on function crm_private.router_return_preferences(jsonb) from public,anon;
grant execute on function crm_private.router_return_preferences(jsonb) to authenticated;

CREATE OR REPLACE FUNCTION crm_private.enqueue_opportunity_stage(p_opportunity_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  opp public.sales_opportunities%rowtype;inst public.crm_offer_instances%rowtype;r public.crm_automations%rowtype;
  ctx jsonb;wanted text;required_flag text;made integer:=0;netflix_followup boolean:=false;variant_template text;prefs jsonb;day_rule boolean;new_operator text;
begin
  if not public.crm_server_automations_enabled() then return 0;end if;
  select * into opp from public.sales_opportunities where id=p_opportunity_id;if not found then return 0;end if;
  select * into inst from public.crm_offer_instances where opportunity_id=opp.id order by created_at desc limit 1;
  if inst.id is null and current_setting('crm.router_return_defer',true)='true' then return 0;end if;
  if found then netflix_followup:=crm_private.offer_netflix_visible(inst.snapshot);end if;
  prefs:=opp.after_sale_preferences;
  new_operator:=coalesce(nullif(inst.operator,''),nullif(prefs->>'operator',''),'');
  ctx:=public.crm_server_context_for_contact(opp.record_id,opp.phone)||jsonb_build_object(
    'opportunity_id',opp.id,'stage_id',opp.stage_id,'name',coalesce(opp.client_name,''),
    'phone',public.crm_server_normalize_phone(opp.phone),'operator',new_operator,
    'offer_instance_id',inst.id,'netflix_followup',netflix_followup,'event_at',now()
  );
  ctx:=crm_private.party_context(ctx,opp.contract_party);
  if prefs->>'workflow'='installation_v1' then perform crm_private.installation_sync(opp.id);end if;
  for r in select * from public.crm_automations where enabled and trigger_type='opportunity_stage' and coalesce(trigger_config->>'stage_id','')=coalesce(opp.stage_id::text,'') loop
    wanted:=coalesce(nullif(btrim(r.trigger_config->>'automation_operator'),''),nullif(btrim(r.trigger_config->>'operator'),''),'General');
    required_flag:=nullif(btrim(r.trigger_config->>'required_offer_flag'),'');
    if (wanted='General' or lower(wanted)=lower(new_operator))
       and (required_flag is null or lower(coalesce(ctx->>required_flag,'false'))='true') then
      day_rule:=coalesce(r.trigger_config->>'automation_code','') like '%_day_one';
      if day_rule and prefs->>'workflow'='installation_v1' then
        r.action_config:=jsonb_set(r.action_config,'{steps}',coalesce((select jsonb_agg(s) from jsonb_array_elements(r.action_config->'steps') s where s->>'action_type'='record_sale_month'),'[]'::jsonb));
        if jsonb_array_length(r.action_config->'steps')>0 then perform public.crm_server_enqueue(r,'oppstage:'||opp.id::text||':'||coalesce(opp.stage_id::text,''),ctx);made:=made+1;end if;
        continue;
      end if;
      if prefs is not null and day_rule and prefs->>'send'='false' then continue;end if;
      if prefs is null and inst.snapshot->>'direct_sale'='true' and inst.snapshot->>'send_day_one'='false' and r.trigger_config->>'automation_code' like '%_day_one' then continue;end if;
      if r.trigger_config ? 'netflix_template_id' and r.trigger_config ? 'general_template_id' then
        variant_template:=case when netflix_followup then r.trigger_config->>'netflix_template_id' else r.trigger_config->>'general_template_id' end;
        r.action_config:=jsonb_set(r.action_config,'{steps,2,config,template_id}',to_jsonb(variant_template),true);
      end if;
      if prefs is null and inst.snapshot->>'direct_sale'='true' and inst.snapshot->>'day_one_rule_id'=r.id::text and nullif(inst.snapshot->>'day_one_text','') is not null then
        r.action_config:=jsonb_set(r.action_config,'{steps,2}',jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text',inst.snapshot->>'day_one_text')),false);
      end if;
      if prefs is not null and day_rule and prefs->>'send'='true' then
        if prefs->>'rule_id' is distinct from r.id::text then raise exception 'La regla del día siguiente cambió. Vuelve a abrir Tramitado';end if;
        r.action_config:=jsonb_set(r.action_config,'{steps,2}',jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text',prefs->>'text','offer_phase','router_return')),false);
        if nullif(prefs->>'send_at','') is not null then
          r.action_config:=jsonb_set(r.action_config,'{steps,1}',jsonb_build_object('kind','wait','unit','minutes','value',greatest(0,extract(epoch from ((prefs->>'send_at')::timestamptz-now()))/60)),false);
        end if;
      end if;
      perform public.crm_server_enqueue(r,'oppstage:'||opp.id::text||':'||coalesce(opp.stage_id::text,''),ctx);made:=made+1;
    end if;
  end loop;
  return made;
end $function$;

CREATE OR REPLACE FUNCTION public.crm_lifecycle_job_guard(p_job uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  j public.crm_server_automation_jobs%rowtype;p jsonb;cid uuid;oid uuid;offer_id uuid;
  reason text;prev public.crm_server_automation_jobs%rowtype;ph text;
begin
  select * into j from public.crm_server_automation_jobs where id=p_job;
  if not found or j.status<>'running' then return jsonb_build_object('allow',false,'reason','Ejecución detenida');end if;
  if nullif(j.context->>'review_id','') is not null then
    -- Receipt verification is read-only and continues after the review is completed.
    if j.action_config ? '__delivery_receipt' then return jsonb_build_object('allow',true,'context',j.context);end if;
    if not exists(select 1 from public.crm_monthly_reviews r join public.sales_opportunities o on o.id=r.opportunity_id where r.id::text=j.context->>'review_id' and r.job_id=j.id and r.status='active' and r.send_enabled and not r.needs_confirmation and o.status='open') then reason:='Revisión cancelada o completada';
    elsif exists(select 1 from crm_private.commercial_optouts where phone=public.crm_server_normalize_phone(j.context->>'phone') or contact_id::text=j.context->>'contact_id' or contact_id::text=j.context->>'recipient_contact_id') then reason:='Baja comercial solicitada';
    elsif not exists(select 1 from public.records where id::text=coalesce(j.context->>'recipient_contact_id',j.context->>'contact_id')) then reason:='Destinatario no disponible';
    elsif not exists(select 1 from public.crm_automations where id=j.automation_id and enabled) then reason:='Automatización pausada';end if;
    if reason is not null then update public.crm_server_automation_jobs set status='cancelled',error_message=reason,updated_at=now() where id=j.id;return jsonb_build_object('allow',false,'reason',reason);end if;
    return jsonb_build_object('allow',true,'context',j.context);
  end if;
  if nullif(j.context->>'installation_id','') is not null then
    if j.action_config ? '__delivery_receipt' then return jsonb_build_object('allow',true,'context',j.context);end if;
    if not public.crm_server_automations_enabled() then reason:='Motor pausado';
    elsif not exists(select 1 from public.crm_installations i join public.sales_opportunities o on o.id=i.opportunity_id join public.sales_stages s on s.id=o.stage_id where i.id::text=j.context->>'installation_id' and lower(btrim(s.name)) in ('tramitado','ganado') and public.crm_server_normalize_phone(i.recipient_context->>'phone')=public.crm_server_normalize_phone(j.context->>'phone')) then reason:='Instalación o destinatario no disponible';
    elsif j.context->>'installation_phase'='installation_notice' and not exists(select 1 from public.crm_installations i where i.id::text=j.context->>'installation_id' and i.notice_job_id=j.id and i.installed_on is null) then reason:='Cita actualizada o instalación confirmada';
    elsif j.context->>'installation_phase'='installation_return' and not exists(select 1 from public.crm_installations i where i.id::text=j.context->>'installation_id' and i.return_job_id=j.id and i.installed_on is not null and nullif(i.previous_operator,'') is not null and i.previous_operator<>'Ninguno') then reason:='Devolución no disponible';
    end if;
    if reason is not null then update public.crm_server_automation_jobs set status='cancelled',error_message=reason,updated_at=now() where id=j.id;return jsonb_build_object('allow',false,'reason',reason);end if;
    return jsonb_build_object('allow',true,'context',j.context);
  end if;
  p:=j.context->'lifecycle';
  if coalesce(p->>'mode','') not in ('offer','after_sale') then return jsonb_build_object('allow',true,'context',j.context);end if;
  cid:=nullif(j.context->>'contact_id','')::uuid;
  oid:=nullif(j.context->>'opportunity_id','')::uuid;
  offer_id:=nullif(j.context->>'offer_instance_id','')::uuid;
  ph:=public.crm_server_normalize_phone(j.context->>'phone');
  if j.action_type in ('record_offer_month','record_sale_month') then
    if cid is null or oid is null or not exists(select 1 from public.sales_opportunities where id=oid and record_id=cid) then reason:='Oportunidad no disponible';end if;
  elsif not public.crm_server_automations_enabled() then reason:='Motor pausado';
  elsif not exists(select 1 from public.crm_automations where id=j.automation_id and enabled) then reason:='Automatización pausada';
  elsif cid is null or not exists(select 1 from public.records where id=cid) then reason:='Contacto no disponible';
  elsif exists(select 1 from public.crm_automation_contact_exclusions where automation_id=j.automation_id and contact_id=cid) then reason:='Contacto excluido';
  elsif exists(select 1 from crm_private.commercial_optouts where phone=ph or contact_id=cid) then reason:='Baja comercial solicitada';
  elsif p->>'mode'='offer' then
    if nullif(p->>'label_id','') is not null and not exists(select 1 from public.crm_contact_labels where contact_id=cid and label_id::text=p->>'label_id') then reason:='Etiqueta de seguimiento retirada';
    elsif exists(select 1 from public.sales_opportunities o where o.record_id=cid and (oid is null or o.id=oid) and coalesce(p->'stop_stage_ids','[]'::jsonb) ? o.stage_id::text) then reason:='Oferta pasa a tramitación';
    elsif offer_id is not null and exists(select 1 from public.crm_offer_response_states where offer_instance_id=offer_id) then reason:='Cliente eligió una respuesta de la oferta';
    end if;
  elsif p->>'mode'='after_sale' then
    if oid is null or not exists(select 1 from public.sales_opportunities where id=oid and record_id=cid and (stage_id::text=p->>'stage_id' or stage_id in (select id from public.sales_stages where lower(btrim(name))='ganado'))) then reason:='Oportunidad fuera de Tramitado';end if;
  end if;
  if reason is not null then
    update public.crm_server_automation_jobs set status='cancelled',error_message=reason,updated_at=now()
      where id=j.id and status in ('pending','running');
    return jsonb_build_object('allow',false,'reason',reason);
  end if;
  if nullif(j.action_config->>'__previous_event','') is not null then
    select * into prev from public.crm_server_automation_jobs where automation_id=j.automation_id and event_key=j.action_config->>'__previous_event';
    if not found or prev.status in ('pending','running') then return jsonb_build_object('allow',false,'retry',true,'reason','Esperando el paso anterior');end if;
    if prev.status<>'done' or exists(select 1 from public.crm_automation_runs where automation_id=prev.automation_id and event_key=prev.event_key and context->>'skipped'='true') then
      update public.crm_server_automation_jobs set status='cancelled',error_message='Paso anterior no completado',updated_at=now() where id=j.id and status='running';
      return jsonb_build_object('allow',false,'reason','Paso anterior no completado');
    end if;
  end if;
  return jsonb_build_object('allow',true,'context',j.context);
end $function$;


create function crm_private.installation_uri_component(p text) returns text language plpgsql immutable set search_path='' as $$
declare bytes bytea:=convert_to(p,'UTF8');out text:='';n integer;b integer;c text;
begin for n in 0..length(bytes)-1 loop b:=get_byte(bytes,n);c:=chr(b);if b<128 and position(c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*''()')>0 then out:=out||c;else out:=out||'%'||upper(lpad(to_hex(b),2,'0'));end if;end loop;return out;end;$$;
revoke all on function crm_private.installation_uri_component(text) from public,anon,authenticated;

create function public.crm_installation_adopt(p_opportunity_id uuid,p_expected_at timestamptz,p_preferences jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.sales_opportunities%rowtype;iid uuid;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso';end if;
 select * into o from public.sales_opportunities where id=p_opportunity_id for update;
 if not found or o.updated_at is distinct from p_expected_at then raise exception 'La oportunidad cambió en otro dispositivo. Cierra y vuelve a abrir Gestionar';end if;
 if exists(select 1 from public.crm_installations where opportunity_id=o.id) then raise exception 'Ya existe seguimiento de instalación. Vuelve a abrir Gestionar';end if;
 if not exists(select 1 from public.sales_stages where id=o.stage_id and lower(btrim(name))='tramitado') then raise exception 'Solo se puede añadir seguimiento a una venta Tramitada';end if;
 if exists(select 1 from public.crm_server_automation_jobs j join public.crm_automations a on a.id=j.automation_id where j.context->>'opportunity_id'=o.id::text and a.trigger_config->>'automation_code' like '%_day_one' and (j.status='running' or j.status='pending' and j.action_config ? '__delivery_receipt')) then raise exception 'El mensaje anterior está en envío. Espera a que termine';end if;
 update public.crm_server_automation_jobs j set action_config=jsonb_set(j.action_config,'{steps}',coalesce((select jsonb_agg(s) from jsonb_array_elements(j.action_config->'steps') s where s->>'action_type'='record_sale_month'),'[]'::jsonb)),updated_at=now()
 from public.crm_automations a where a.id=j.automation_id and j.context->>'opportunity_id'=o.id::text and a.trigger_config->>'automation_code' like '%_day_one' and j.status in ('pending','paused') and j.action_type='flow_v1';
 update public.crm_server_automation_jobs j set status='cancelled',error_message='Sustituido por seguimiento de instalación confirmado',updated_at=now()
 from public.crm_automations a where a.id=j.automation_id and j.context->>'opportunity_id'=o.id::text and a.trigger_config->>'automation_code' like '%_day_one' and j.status in ('pending','paused') and j.action_type in ('__send_whatsapp','send_template','send_whatsapp_now','schedule_whatsapp');
 update public.sales_opportunities set after_sale_preferences=crm_private.router_return_preferences(p_preferences),updated_at=clock_timestamp() where id=o.id;
 iid:=crm_private.installation_sync(o.id);
 if iid is null then raise exception 'No se pudo iniciar el seguimiento';end if;
 if nullif(p_preferences->>'incident','') is not null then update public.crm_installations set incident=left(p_preferences->>'incident',1000) where id=iid;end if;
 return (select to_jsonb(i) from public.crm_installations i where id=iid);
end;$$;
revoke all on function public.crm_installation_adopt(uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.crm_installation_adopt(uuid,timestamptz,jsonb) to authenticated;

create function public.crm_operator_communication_templates(p_operator text) returns setof jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_view_settings') or public.current_user_can('can_view_sales')) then raise exception 'No tienes permiso';end if;
 return query select distinct jsonb_build_object('rule_id',a.id,'rule_name',a.name,'template_id',t.id,'template_name',t.name,'body',t.body,'schedule',case when a.trigger_config->>'automation_code' like '%_day_one' then 'Aviso anterior del día siguiente: conservado para las ventas antiguas.' else 'Regla existente: se mantienen sus fechas, etiquetas y condiciones.' end)
 from public.crm_automations a join public.wa_templates t on t.user_id=a.user_id and (exists(select 1 from jsonb_array_elements(coalesce(a.action_config->'steps','[]'::jsonb)) s where s#>>'{config,template_id}'=t.id::text) or t.id::text in (a.trigger_config->>'general_template_id',a.trigger_config->>'netflix_template_id'))
 where lower(coalesce(a.trigger_config->>'automation_operator',a.trigger_config->>'operator',''))=lower(p_operator);
end;$$;
revoke all on function public.crm_operator_communication_templates(text) from public,anon;
grant execute on function public.crm_operator_communication_templates(text) to authenticated;

create function public.crm_operator_communication_save(p_rule_id uuid,p_template_id text,p_expected_body text,p_body text) returns void language plpgsql security definer set search_path='' as $$
declare a public.crm_automations%rowtype;n integer;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_manage_templates')) then raise exception 'No tienes permiso para editar plantillas';end if;
 if length(btrim(p_body)) not between 1 and 10000 then raise exception 'Escribe un texto entre 1 y 10000 caracteres';end if;
 select * into a from public.crm_automations where id=p_rule_id;
 if not found or not (exists(select 1 from jsonb_array_elements(coalesce(a.action_config->'steps','[]'::jsonb)) s where s#>>'{config,template_id}'=p_template_id) or p_template_id in (a.trigger_config->>'general_template_id',a.trigger_config->>'netflix_template_id')) then raise exception 'La plantilla ya no pertenece a esta regla';end if;
 update public.wa_templates set body=btrim(p_body),updated_at=clock_timestamp() where id::text=p_template_id and user_id=a.user_id and body is not distinct from p_expected_body;
 get diagnostics n=row_count;if n<>1 then raise exception 'El texto cambió en otro dispositivo. Recarga antes de guardar';end if;
end;$$;
revoke all on function public.crm_operator_communication_save(uuid,text,text,text) from public,anon;
grant execute on function public.crm_operator_communication_save(uuid,text,text,text) to authenticated;

-- New communications bypass the legacy next-day template requirement, preserving the direct-sale creation and labels.
create or replace function public.crm_create_direct_sale_v8(p_contact_id uuid, p_operator text, p_total_price numeric, p_send_message boolean, p_netflix_followup boolean, p_counteroffer boolean, p_manager_contact_id uuid, p_recipient_contact_id uuid, p_day_one_text text DEFAULT NULL::text, p_send_day_one boolean DEFAULT true, p_sale_month text DEFAULT NULL::text, p_after_sale jsonb DEFAULT NULL::jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare previous text;previous_defer text;result jsonb;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para editar ventas';end if;
 previous:=current_setting('crm.router_return',true);previous_defer:=current_setting('crm.router_return_defer',true);
 perform set_config('crm.router_return_defer',case when p_after_sale is null then '' else 'true' end,true);
 perform set_config('crm.router_return',coalesce(crm_private.router_return_preferences(p_after_sale)::text,''),true);
 result:=public.crm_create_direct_sale_v7(p_contact_id,p_operator,p_total_price,p_send_message,p_netflix_followup,p_counteroffer,p_manager_contact_id,p_recipient_contact_id,case when p_after_sale->>'workflow'='installation_v1' then null else p_day_one_text end,case when p_after_sale->>'workflow'='installation_v1' then false else p_send_day_one end,p_sale_month);
 perform set_config('crm.router_return',coalesce(previous,''),true);
 perform set_config('crm.router_return_defer',coalesce(previous_defer,''),true);
 return result;
exception when others then
 perform set_config('crm.router_return',coalesce(previous,''),true);
 perform set_config('crm.router_return_defer',coalesce(previous_defer,''),true);
 raise;
end $$;
