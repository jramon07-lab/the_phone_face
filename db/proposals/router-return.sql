-- Future entries only. Existing contacts, opportunities and pending jobs are not updated.
alter table public.sales_opportunities add column if not exists after_sale_preferences jsonb;

create or replace function crm_private.router_return_preferences(p jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare send boolean;scheduled timestamptz;
begin
 if p is null then return null;end if;
 if jsonb_typeof(p)<>'object' then raise exception 'Configuración de devolución no válida';end if;
 if coalesce(p->>'send','') not in ('true','false') then raise exception 'Indica si se envía el mensaje';end if;
 send:=(p->>'send')::boolean;
 if coalesce(p->>'previous_operator','') not in ('Yoigo','MásMóvil','O2','Vodafone','Ninguno','Otro') then raise exception 'Selecciona el operador anterior';end if;
 if send and (length(btrim(coalesce(p->>'text','')))=0 or length(p->>'text')>10000) then raise exception 'El mensaje debe tener entre 1 y 10000 caracteres';end if;
 if send and nullif(p->>'rule_id','') is null then raise exception 'No hay mensaje del día siguiente configurado';end if;
 if send and nullif(p->>'send_at','') is not null then
   scheduled:=(p->>'send_at')::timestamptz;
   if scheduled<=now()+interval '1 minute' then raise exception 'Elige una fecha y hora futuras';end if;
 end if;
 return jsonb_build_object('previous_operator',p->>'previous_operator','text',coalesce(p->>'text',''),'send',send,'send_at',case when send then scheduled end,'operator',coalesce(p->>'operator',''),'rule_id',p->>'rule_id');
end $$;
revoke all on function crm_private.router_return_preferences(jsonb) from public,anon;
grant execute on function crm_private.router_return_preferences(jsonb) to authenticated;

create or replace function crm_private.router_return_before_write()
returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' and new.after_sale_preferences is null and nullif(current_setting('crm.router_return',true),'') is not null then
   new.after_sale_preferences:=crm_private.router_return_preferences(current_setting('crm.router_return',true)::jsonb);
 elsif TG_OP='INSERT' or new.after_sale_preferences is distinct from old.after_sale_preferences then
   new.after_sale_preferences:=crm_private.router_return_preferences(new.after_sale_preferences);
 end if;
 return new;
end $$;
revoke all on function crm_private.router_return_before_write() from public,anon,authenticated;
drop trigger if exists router_return_before_write on public.sales_opportunities;
create trigger router_return_before_write before insert or update of after_sale_preferences on public.sales_opportunities for each row execute function crm_private.router_return_before_write();

create or replace function public.crm_router_return_preview(p_opportunity_id uuid default null,p_contact_id uuid default null,p_manager_contact_id uuid default null,p_recipient_contact_id uuid default null,p_operator text default null,p_netflix_followup boolean default false)
returns jsonb language plpgsql set search_path='' as $$
declare opp public.sales_opportunities%rowtype;inst public.crm_offer_instances%rowtype;party jsonb;preview jsonb;operator_name text;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para editar ventas';end if;
 operator_name:=p_operator;
 if p_opportunity_id is not null then
   select * into opp from public.sales_opportunities where id=p_opportunity_id;
   if not found then raise exception 'Oportunidad no encontrada';end if;
   select * into inst from public.crm_offer_instances where opportunity_id=opp.id order by created_at desc limit 1;
   operator_name:=coalesce(nullif(inst.operator,''),nullif(opp.after_sale_preferences->>'operator',''),(regexp_match(opp.title,'(Vodafone|Yoigo|MásMóvil|Masmovil|O2|Orange|Lowi)','i'))[1]);
   p_contact_id:=coalesce(nullif(opp.contract_party->>'holder_record_id','')::uuid,opp.record_id);
   p_manager_contact_id:=coalesce(nullif(opp.contract_party->>'manager_record_id','')::uuid,nullif(opp.contract_party->>'manager_contact_id','')::uuid);
   p_recipient_contact_id:=nullif(opp.contract_party->>'recipient_contact_id','')::uuid;
   p_netflix_followup:=inst.operator='Vodafone' and coalesce((inst.snapshot->>'netflix_followup')::boolean,exists(select 1 from jsonb_array_elements(case when jsonb_typeof(inst.snapshot->'selections')='array' then inst.snapshot->'selections' else '[]'::jsonb end) x where coalesce(x->>'show_in_message','true')<>'false' and coalesce((x->>'quantity')::integer,0)>0 and lower(coalesce(x->>'name','')) like 'netflix%'));
 end if;
 if lower(coalesce(operator_name,''))='masmovil' then operator_name:='MásMóvil';end if;
 if p_contact_id is null then return jsonb_build_object('available',false,'operator',operator_name,'preferences',opp.after_sale_preferences);end if;
 preview:=public.crm_direct_sale_day_one_preview(p_contact_id,p_manager_contact_id,p_recipient_contact_id,operator_name,p_netflix_followup);
 return preview||jsonb_build_object('operator',operator_name,'preferences',opp.after_sale_preferences);
end $$;
revoke all on function public.crm_router_return_preview(uuid,uuid,uuid,uuid,text,boolean) from public,anon;
grant execute on function public.crm_router_return_preview(uuid,uuid,uuid,uuid,text,boolean) to authenticated;

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
  for r in select * from public.crm_automations where enabled and trigger_type='opportunity_stage' and coalesce(trigger_config->>'stage_id','')=coalesce(opp.stage_id::text,'') loop
    wanted:=coalesce(nullif(btrim(r.trigger_config->>'automation_operator'),''),nullif(btrim(r.trigger_config->>'operator'),''),'General');
    required_flag:=nullif(btrim(r.trigger_config->>'required_offer_flag'),'');
    if (wanted='General' or lower(wanted)=lower(new_operator))
       and (required_flag is null or lower(coalesce(ctx->>required_flag,'false'))='true') then
      day_rule:=coalesce(r.trigger_config->>'automation_code','') like '%_day_one';
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

revoke all on function crm_private.enqueue_opportunity_stage(uuid) from public,anon,authenticated;

create or replace function public.crm_create_direct_sale_v8(p_contact_id uuid, p_operator text, p_total_price numeric, p_send_message boolean, p_netflix_followup boolean, p_counteroffer boolean, p_manager_contact_id uuid, p_recipient_contact_id uuid, p_day_one_text text DEFAULT NULL::text, p_send_day_one boolean DEFAULT true, p_sale_month text DEFAULT NULL::text, p_after_sale jsonb DEFAULT NULL::jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare previous text;previous_defer text;result jsonb;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para editar ventas';end if;
 previous:=current_setting('crm.router_return',true);previous_defer:=current_setting('crm.router_return_defer',true);
 perform set_config('crm.router_return_defer',case when p_after_sale is null then '' else 'true' end,true);
 perform set_config('crm.router_return',coalesce(crm_private.router_return_preferences(p_after_sale)::text,''),true);
 result:=public.crm_create_direct_sale_v7(p_contact_id,p_operator,p_total_price,p_send_message,p_netflix_followup,p_counteroffer,p_manager_contact_id,p_recipient_contact_id,p_day_one_text,p_send_day_one,p_sale_month);
 perform set_config('crm.router_return',coalesce(previous,''),true);
 perform set_config('crm.router_return_defer',coalesce(previous_defer,''),true);
 return result;
exception when others then
 perform set_config('crm.router_return',coalesce(previous,''),true);
 perform set_config('crm.router_return_defer',coalesce(previous_defer,''),true);
 raise;
end $$;
revoke all on function public.crm_create_direct_sale_v8(uuid,text,numeric,boolean,boolean,boolean,uuid,uuid,text,boolean,text,jsonb) from public,anon;
grant execute on function public.crm_create_direct_sale_v8(uuid,text,numeric,boolean,boolean,boolean,uuid,uuid,text,boolean,text,jsonb) to authenticated;

create or replace function public.crm_create_offer_execution_v13(p_contact_id uuid, p_catalog_offer_id uuid, p_request_key uuid, p_selections jsonb DEFAULT '[]'::jsonb, p_extra_text text DEFAULT NULL::text, p_mode text DEFAULT 'followup'::text, p_final_price numeric DEFAULT NULL::numeric, p_send_message boolean DEFAULT false, p_processing_date date DEFAULT NULL::date, p_test_mode boolean DEFAULT false, p_allow_duplicate boolean DEFAULT false, p_send_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_welcome boolean DEFAULT false, p_recipient_contact_id uuid DEFAULT NULL::uuid, p_manager_contact_id uuid DEFAULT NULL::uuid, p_message_text text DEFAULT NULL::text, p_after_sale jsonb DEFAULT NULL::jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare previous text;previous_defer text;result jsonb;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para editar ventas';end if;
 previous:=current_setting('crm.router_return',true);previous_defer:=current_setting('crm.router_return_defer',true);
 perform set_config('crm.router_return_defer',case when p_after_sale is null then '' else 'true' end,true);
 perform set_config('crm.router_return',coalesce(crm_private.router_return_preferences(p_after_sale)::text,''),true);
 result:=public.crm_create_offer_execution_v12(p_contact_id,p_catalog_offer_id,p_request_key,p_selections,p_extra_text,p_mode,p_final_price,p_send_message,p_processing_date,p_test_mode,p_allow_duplicate,p_send_at,p_welcome,p_recipient_contact_id,p_manager_contact_id,p_message_text);
 perform set_config('crm.router_return',coalesce(previous,''),true);
 perform set_config('crm.router_return_defer',coalesce(previous_defer,''),true);
 return result;
exception when others then
 perform set_config('crm.router_return',coalesce(previous,''),true);
 perform set_config('crm.router_return_defer',coalesce(previous_defer,''),true);
 raise;
end $$;
revoke all on function public.crm_create_offer_execution_v13(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean,timestamp with time zone,boolean,uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.crm_create_offer_execution_v13(uuid,uuid,uuid,jsonb,text,text,numeric,boolean,date,boolean,boolean,timestamp with time zone,boolean,uuid,uuid,text,jsonb) to authenticated;

create or replace function public.crm_create_opportunity_guarded_v2(p_pipeline_id uuid, p_stage_id uuid, p_record_id uuid, p_title text, p_client_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_amount numeric DEFAULT NULL::numeric, p_expected_date date DEFAULT NULL::date, p_notes text DEFAULT NULL::text, p_contract_party jsonb DEFAULT NULL::jsonb, p_allow_duplicate boolean DEFAULT false, p_after_sale jsonb DEFAULT NULL::jsonb)
returns uuid language plpgsql set search_path='' as $$
declare previous text;result uuid;
begin
 if auth.uid() is null or not (public.current_user_is_admin() or public.current_user_can('can_edit_sales')) then raise exception 'No tienes permiso para editar ventas';end if;
 previous:=current_setting('crm.router_return',true);
 perform set_config('crm.router_return',coalesce(crm_private.router_return_preferences(p_after_sale)::text,''),true);
 result:=public.crm_create_opportunity_guarded(p_pipeline_id,p_stage_id,p_record_id,p_title,p_client_name,p_phone,p_amount,p_expected_date,p_notes,p_contract_party,p_allow_duplicate);
 perform set_config('crm.router_return',coalesce(previous,''),true);
 return result;
exception when others then
 perform set_config('crm.router_return',coalesce(previous,''),true);
 raise;
end $$;
revoke all on function public.crm_create_opportunity_guarded_v2(uuid,uuid,uuid,text,text,text,numeric,date,text,jsonb,boolean,jsonb) from public,anon;
grant execute on function public.crm_create_opportunity_guarded_v2(uuid,uuid,uuid,text,text,text,numeric,date,text,jsonb,boolean,jsonb) to authenticated;

notify pgrst,'reload schema';
