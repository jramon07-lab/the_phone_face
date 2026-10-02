-- Previous enqueue implementation, retained for deployment recovery.
CREATE OR REPLACE FUNCTION crm_private.enqueue_opportunity_stage(p_opportunity_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  opp public.sales_opportunities%rowtype;inst public.crm_offer_instances%rowtype;r public.crm_automations%rowtype;
  ctx jsonb;wanted text;required_flag text;made integer:=0;netflix_followup boolean:=false;variant_template text;
begin
  if not public.crm_server_automations_enabled() then return 0;end if;
  select * into opp from public.sales_opportunities where id=p_opportunity_id;if not found then return 0;end if;
  select * into inst from public.crm_offer_instances where opportunity_id=opp.id order by created_at desc limit 1;
  if found then netflix_followup:=crm_private.offer_netflix_visible(inst.snapshot);end if;
  ctx:=public.crm_server_context_for_contact(opp.record_id,opp.phone)||jsonb_build_object(
    'opportunity_id',opp.id,'stage_id',opp.stage_id,'name',coalesce(opp.client_name,''),
    'phone',public.crm_server_normalize_phone(opp.phone),'operator',coalesce(inst.operator,''),
    'offer_instance_id',inst.id,'netflix_followup',netflix_followup,'event_at',now()
  );
  for r in select * from public.crm_automations where enabled and trigger_type='opportunity_stage' and coalesce(trigger_config->>'stage_id','')=coalesce(opp.stage_id::text,'') loop
    wanted:=coalesce(nullif(btrim(r.trigger_config->>'automation_operator'),''),nullif(btrim(r.trigger_config->>'operator'),''),'General');
    required_flag:=nullif(btrim(r.trigger_config->>'required_offer_flag'),'');
    if (wanted='General' or lower(wanted)=lower(coalesce(inst.operator,'')))
       and (required_flag is null or lower(coalesce(ctx->>required_flag,'false'))='true') then
      if inst.snapshot->>'direct_sale'='true' and inst.snapshot->>'send_day_one'='false' and r.trigger_config->>'automation_code' like '%_day_one' then continue;end if;
      if r.trigger_config ? 'netflix_template_id' and r.trigger_config ? 'general_template_id' then
        variant_template:=case when netflix_followup then r.trigger_config->>'netflix_template_id' else r.trigger_config->>'general_template_id' end;
        r.action_config:=jsonb_set(r.action_config,'{steps,2,config,template_id}',to_jsonb(variant_template),true);
      end if;
      if inst.snapshot->>'direct_sale'='true' and inst.snapshot->>'day_one_rule_id'=r.id::text and nullif(inst.snapshot->>'day_one_text','') is not null then
        r.action_config:=jsonb_set(r.action_config,'{steps,2}',jsonb_build_object('kind','action','action_type','send_whatsapp_now','config',jsonb_build_object('text',inst.snapshot->>'day_one_text')),false);
      end if;
      perform public.crm_server_enqueue(r,'oppstage:'||opp.id::text||':'||coalesce(opp.stage_id::text,''),ctx);made:=made+1;
    end if;
  end loop;
  return made;
end $function$;
