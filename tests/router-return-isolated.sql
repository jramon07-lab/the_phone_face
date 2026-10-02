-- Run inside a transaction after router-return.sql; all rows below are temporary fixtures.

create temp table sales_opportunities as select * from public.sales_opportunities with no data;
create temp table crm_offer_instances as select * from public.crm_offer_instances with no data;
create temp table crm_automations as select * from public.crm_automations with no data;
create temp table captured(rule_id uuid,config jsonb,context jsonb);
create function pg_temp.capture(r pg_temp.crm_automations,k text,c jsonb) returns void language sql as $$insert into pg_temp.captured values(r.id,r.action_config,c)$$;
CREATE OR REPLACE FUNCTION pg_temp.router_enqueue(p_opportunity_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  opp pg_temp.sales_opportunities%rowtype;inst pg_temp.crm_offer_instances%rowtype;r pg_temp.crm_automations%rowtype;
  ctx jsonb;wanted text;required_flag text;made integer:=0;netflix_followup boolean:=false;variant_template text;prefs jsonb;day_rule boolean;new_operator text;
begin
  if false then return 0;end if;
  select * into opp from pg_temp.sales_opportunities where id=p_opportunity_id;if not found then return 0;end if;
  select * into inst from pg_temp.crm_offer_instances where opportunity_id=opp.id order by created_at desc limit 1;
  if inst.id is null and current_setting('crm.router_return_defer',true)='true' then return 0;end if;
  if found then netflix_followup:=crm_private.offer_netflix_visible(inst.snapshot);end if;
  prefs:=opp.after_sale_preferences;
  new_operator:=coalesce(nullif(inst.operator,''),nullif(prefs->>'operator',''),'');
  ctx:=jsonb_build_object('contact_id',opp.record_id)||jsonb_build_object(
    'opportunity_id',opp.id,'stage_id',opp.stage_id,'name',coalesce(opp.client_name,''),
    'phone',public.crm_server_normalize_phone(opp.phone),'operator',new_operator,
    'offer_instance_id',inst.id,'netflix_followup',netflix_followup,'event_at',now()
  );
  ctx:=crm_private.party_context(ctx,opp.contract_party);
  for r in select * from pg_temp.crm_automations where enabled and trigger_type='opportunity_stage' and coalesce(trigger_config->>'stage_id','')=coalesce(opp.stage_id::text,'') loop
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
      perform pg_temp.capture(r,'oppstage:'||opp.id::text||':'||coalesce(opp.stage_id::text,''),ctx);made:=made+1;
    end if;
  end loop;
  return made;
end $function$;
insert into pg_temp.sales_opportunities(id,stage_id,record_id,phone,contract_party,after_sale_preferences) values
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','600000000',
'{"holder_record_id":"30000000-0000-0000-0000-000000000001","recipient_contact_id":"30000000-0000-0000-0000-000000000002","recipient_name":"Gestor","recipient_phone":"600000001","recipient_first_name":"Gestor","holder_name":"Titular"}',
'{"previous_operator":"Yoigo","text":"Mensaje editado Netflix y router","send":true,"send_at":null,"operator":"Vodafone","rule_id":"40000000-0000-0000-0000-000000000001"}');
insert into pg_temp.crm_offer_instances(id,opportunity_id,operator,snapshot) values('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Vodafone','{"netflix_followup":true}');
insert into pg_temp.crm_automations(id,enabled,trigger_type,trigger_config,action_config) values
('40000000-0000-0000-0000-000000000001',true,'opportunity_stage','{"stage_id":"20000000-0000-0000-0000-000000000001","automation_operator":"Vodafone","automation_code":"vodafone_day_one"}','{"steps":[{"kind":"action","action_type":"record_sale_month"},{"kind":"wait","value":1,"unit":"days","business_schedule":"phone_house"},{"kind":"action","action_type":"send_template","config":{"template_id":"1"}}]}'),
('40000000-0000-0000-0000-000000000002',true,'opportunity_stage','{"stage_id":"20000000-0000-0000-0000-000000000001","automation_operator":"Vodafone","automation_code":"vodafone_security_3_months"}','{"steps":[{"kind":"wait","value":3,"unit":"months"},{"kind":"action","action_type":"send_template","config":{"template_id":"2"}}]}'),
('40000000-0000-0000-0000-000000000003',true,'opportunity_stage','{"stage_id":"20000000-0000-0000-0000-000000000001","automation_operator":"Vodafone","automation_code":"vodafone_annual_review"}','{"steps":[{"kind":"wait","value":11,"unit":"months"},{"kind":"action","action_type":"prepare_operator_review"}]}');
do $test$
declare n integer;c jsonb;
begin
 n:=pg_temp.router_enqueue('10000000-0000-0000-0000-000000000001');
 if n<>3 then raise exception 'Expected three rules';end if;
 select config into c from pg_temp.captured where rule_id='40000000-0000-0000-0000-000000000001';
 if c#>>'{steps,2,config,text}'<>'Mensaje editado Netflix y router' or c#>>'{steps,1,unit}'<>'days' then raise exception 'Custom text or default schedule lost';end if;
 if exists(select 1 from pg_temp.captured where right(context->>'phone',9)<>'600000001' or context->>'recipient_first_name'<>'Gestor') then raise exception 'Recipient changed to holder';end if;
 truncate pg_temp.captured;
 update pg_temp.sales_opportunities set after_sale_preferences=jsonb_set(after_sale_preferences,'{send}','false');
 n:=pg_temp.router_enqueue('10000000-0000-0000-0000-000000000001');
 if n<>2 or exists(select 1 from pg_temp.captured where rule_id='40000000-0000-0000-0000-000000000001') then raise exception 'Opt-out affected other followups';end if;
 truncate pg_temp.captured;
 update pg_temp.sales_opportunities set after_sale_preferences=jsonb_set(jsonb_set(after_sale_preferences,'{send}','true'),'{send_at}',to_jsonb((now()+interval '2 days')::text));
 n:=pg_temp.router_enqueue('10000000-0000-0000-0000-000000000001');
 select config into c from pg_temp.captured where rule_id='40000000-0000-0000-0000-000000000001';
 if c#>>'{steps,1,unit}'<>'minutes' or abs((c#>>'{steps,1,value}')::numeric-2880)>0.01 then raise exception 'Custom schedule lost';end if;
 if not exists(select 1 from pg_temp.captured where config#>>'{steps,0,value}'='3') or not exists(select 1 from pg_temp.captured where config#>>'{steps,0,value}'='11') then raise exception 'Annual/monthly flow changed';end if;
 truncate pg_temp.captured;delete from pg_temp.crm_offer_instances;
 perform set_config('crm.router_return_defer','true',true);
 n:=pg_temp.router_enqueue('10000000-0000-0000-0000-000000000001');
 if n<>0 or exists(select 1 from pg_temp.captured) then raise exception 'Creation queued before offer';end if;
 perform set_config('crm.router_return_defer','',true);
 n:=pg_temp.router_enqueue('10000000-0000-0000-0000-000000000001');
 if n<>3 then raise exception 'Manual opportunity does not use operator preference';end if;
end $test$;
