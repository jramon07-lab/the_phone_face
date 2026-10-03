/* Real PostgreSQL/WASM integration; synthetic fixtures only, with no provider or production connection. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.TPF_PGLITE_MODULE||'@electric-sql/pglite');
const U='10000000-0000-0000-0000-000000000001',O='20000000-0000-0000-0000-000000000001',C='30000000-0000-0000-0000-000000000001',F='40000000-0000-0000-0000-000000000001',S='50000000-0000-0000-0000-000000000001';
async function main(){const db=new PGlite();await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema crm_private;
 create table auth.users(id uuid primary key);insert into auth.users values('${U}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.current_user_is_admin() returns boolean language sql stable as $$select auth.uid() is not null$$;
 create function public.current_user_can(text) returns boolean language sql stable as $$select auth.uid() is not null$$;
 create table public.records(id uuid primary key,data jsonb);
 create table public.sales_stages(id uuid primary key,name text,pipeline_id uuid,active boolean default true,position integer default 0);
 create table public.sales_opportunities(id uuid primary key default gen_random_uuid(),record_id uuid,owner_user_id uuid,stage_id uuid,pipeline_id uuid,phone text,client_name text,title text,amount numeric,contract_party jsonb,after_sale_preferences jsonb,installation_date date,installation_operator text,status text default 'open',created_at timestamptz default now(),updated_at timestamptz default now());
 create table public.crm_offer_instances(id uuid primary key,opportunity_id uuid,contact_id uuid,operator text,snapshot jsonb,created_by uuid,total_price numeric,status text,created_at timestamptz default now(),sent_at timestamptz,updated_at timestamptz default now());
 create table public.crm_automations(id uuid primary key default gen_random_uuid(),user_id uuid,enabled boolean default true,name text,trigger_type text,trigger_config jsonb,action_type text,action_config jsonb,created_at timestamptz default now());
 create table public.crm_server_automation_jobs(id uuid primary key default gen_random_uuid(),automation_id uuid,user_id uuid not null,event_key text,action_type text,action_config jsonb,context jsonb,run_at timestamptz,status text default 'pending',attempts integer default 0,error_message text,created_at timestamptz default now(),updated_at timestamptz default now(),completed_at timestamptz,unique(automation_id,event_key));
 create table public.app_settings(key text primary key,value jsonb,updated_at timestamptz default now());
 create table public.wa_messages(id uuid primary key default gen_random_uuid(),id_message text unique,chat_id text,direction text,created_at timestamptz default now(),raw jsonb,type_message text,text_content text);
 create table public.wa_templates(id bigint primary key,user_id uuid,name text,body text,updated_at timestamptz default now());
 create table public.crm_automation_contact_exclusions(automation_id uuid,contact_id uuid);
 create table crm_private.commercial_optouts(phone text,contact_id uuid);
 create table public.crm_offer_response_states(offer_instance_id uuid);
 create table public.crm_automation_runs(automation_id uuid,event_key text,context jsonb);
 create table public.crm_contact_labels(contact_id uuid,label_id uuid);
 create table public.crm_monthly_reviews(id uuid,opportunity_id uuid,job_id uuid,status text,send_enabled boolean,needs_confirmation boolean);
 create function public.crm_server_automations_enabled() returns boolean language sql stable as $$select coalesce(current_setting('fixture.engine',true),'true')<>'false'$$;
 create function public.crm_server_normalize_phone(text) returns text language sql immutable as $$select case when length(regexp_replace($1,'[^0-9]','','g'))=9 then '34' else '' end||regexp_replace($1,'[^0-9]','','g')$$;
 create function public.crm_server_context_for_contact(uuid,text) returns jsonb language sql stable as $$select jsonb_build_object('contact_id',$1,'phone',$2,'name','Titular')$$;
 create function crm_private.party_phone(text) returns text language sql immutable as $$select public.crm_server_normalize_phone($1)$$;
 create function crm_private.party_context(jsonb,jsonb) returns jsonb language sql immutable as $$select $1||jsonb_build_object('name',$2->>'recipient_name','phone',$2->>'recipient_phone','recipient_first_name',$2->>'recipient_first_name','contract_party',$2)$$;
 create function crm_private.resolve_sale_party(uuid,uuid,uuid) returns jsonb language sql stable as $$select jsonb_build_object('recipient_name','Gestora Ejemplo','recipient_first_name','Gestora','recipient_phone','34600000001')$$;
 create function crm_private.contract_message(text,jsonb) returns text language sql immutable as $$select $1$$;
 create function crm_private.offer_netflix_visible(jsonb) returns boolean language sql immutable as $$select coalesce(($1->>'netflix_followup')::boolean,false)$$;
 create function public.crm_router_return_preview(uuid,uuid,uuid,uuid,text,boolean) returns jsonb language sql stable as $$select jsonb_build_object('available',true,'operator',coalesce($5,'Vodafone'),'recipient','Gestora Ejemplo','phone','34600000001')$$;
 create function public.crm_server_enqueue(public.crm_automations,text,jsonb) returns void language sql as $$insert into public.crm_server_automation_jobs(automation_id,user_id,event_key,action_type,action_config,context,run_at) values($1.id,$1.user_id,$2,$1.action_type,$1.action_config,$3,now()) on conflict do nothing$$;
 create function public.crm_create_direct_sale_v7(p_contact_id uuid,p_operator text,p_total_price numeric,p_send_message boolean,p_netflix_followup boolean,p_counteroffer boolean,p_manager_contact_id uuid,p_recipient_contact_id uuid,p_day_one_text text,p_send_day_one boolean,p_sale_month text) returns jsonb language sql as $$select jsonb_build_object('legacy_day_one',p_send_day_one,'legacy_text',p_day_one_text)$$;
 create function crm_private.router_return_preferences(jsonb) returns jsonb language sql as $$select $1$$;
 `);
 await db.exec(fs.readFileSync('supabase/migrations/20261003170000_installation_communications.sql','utf8'));
 // Reproduce the real caller's failure, then verify the narrow permission repair.
 await db.exec('grant usage on schema crm_private,auth to authenticated;set role authenticated;');
 await assert.rejects(db.query('select crm_private.router_return_preferences(null::jsonb)'),/permission denied for function router_return_preferences_before_installations/);
 await db.exec('reset role;');
 await db.exec(fs.readFileSync('supabase/migrations/20261003193000_restore_offer_validation_permissions.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261003193500_exclude_legacy_undated_installations.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261003200000_home_manage_stage_change.sql','utf8'));
 await db.exec('set role authenticated;');
 assert.equal((await db.query('select crm_private.router_return_preferences(null::jsonb) v')).rows[0].v,null);
 assert.equal((await db.query('select crm_private.router_return_preferences($1) v',[JSON.stringify({previous_operator:'Yoigo',send:false})])).rows[0].v.previous_operator,'Yoigo');
 assert.equal((await db.query('select crm_private.router_return_preferences($1) v',[JSON.stringify({workflow:'installation_v1',previous_operator:'Yoigo',send:true,text:'Cita nueva'})])).rows[0].v.workflow,'installation_v1');
 await assert.rejects(db.query('select crm_private.router_return_preferences($1)',[JSON.stringify({previous_operator:'',send:false})]),/Selecciona el operador anterior/);
 await db.exec('reset role;');
 assert.equal((await db.query("select has_function_privilege('anon','crm_private.router_return_preferences_before_installations(jsonb)','EXECUTE') allowed")).rows[0].allowed,false);
 await db.exec(`set request.jwt.claim.sub='${U}';insert into records values('${C}','{}');insert into sales_stages(id,name,pipeline_id) values('${S}','Tramitado','${S}'),('50000000-0000-0000-0000-000000000002','Ganado','${S}');
 insert into crm_automations(user_id,name,trigger_type,trigger_config,action_type,action_config) values('${U}','Etiqueta y aviso','opportunity_stage','{"stage_id":"${S}","automation_operator":"Vodafone","automation_code":"vodafone_day_one"}','flow_v1','{"steps":[{"kind":"action","action_type":"record_sale_month"},{"kind":"wait","value":1,"unit":"days"},{"kind":"action","action_type":"send_template","config":{"template_id":"1"}}]}'),('${U}','3 meses','opportunity_stage','{"stage_id":"${S}","automation_operator":"Vodafone","automation_code":"vodafone_security_3_months"}','flow_v1','{"steps":[{"kind":"wait","value":3,"unit":"months"},{"kind":"action","action_type":"send_template","config":{"template_id":"2"}}]}'),('${U}','11 meses','opportunity_stage','{"stage_id":"${S}","automation_operator":"Vodafone","automation_code":"vodafone_annual_review"}','flow_v1','{"steps":[{"kind":"wait","value":11,"unit":"months"},{"kind":"action","action_type":"prepare_operator_review"}]}'),('${U}','Manual','manual_offer','{}','__send_whatsapp','{}');
 insert into sales_opportunities(id,record_id,owner_user_id,stage_id,pipeline_id,phone,client_name,title,contract_party,after_sale_preferences) values('${O}','${C}','${U}','${S}','${S}','600000000','Titular Ejemplo','Vodafone','{"recipient_name":"Gestora Ejemplo","recipient_first_name":"Gestora","recipient_phone":"34600000001"}','{"workflow":"installation_v1","send":true,"text":"Hola Gestora, aviso de cita","return_text":"Hola {nombre}. Router de {operador_anterior}","previous_operator":"Yoigo","operator":"Vodafone"}');
 insert into crm_offer_instances(id,opportunity_id,contact_id,operator,created_by,snapshot,status) values('${F}','${O}','${C}','Vodafone','${U}','{}','processed');
 select crm_private.enqueue_opportunity_stage('${O}');`);
 // Exercise the new invoker RPC with the existing commercial control and stage hooks.
 await db.exec('alter table crm_offer_instances add accepted_at timestamptz,add processed_at timestamptz;alter table sales_opportunities add position integer default 0;');
 const controls=fs.readFileSync('supabase/migrations/20260911195620_offer_response_actions.sql','utf8');await db.exec(controls.slice(controls.indexOf('create or replace function public.crm_control_offer('),controls.indexOf('grant execute on function public.crm_control_offer(uuid,text) to authenticated;')+'grant execute on function public.crm_control_offer(uuid,text) to authenticated;'.length));
 const composition=fs.readFileSync('db/proposals/offer-composition-followup.sql','utf8');await db.exec(composition.slice(composition.indexOf('create or replace function public.crm_control_offer_composition(')));
 await db.exec(`create function crm_private.offer_record_sale(public.crm_offer_instances,timestamptz) returns void language plpgsql as $$begin return;end;$$;`);
 await db.exec(fs.readFileSync('supabase/migrations/20260921120633_fix_counteroffer_label_variable.sql','utf8'));
 const trigger=fs.readFileSync('db/proposals/offer-configurator-v4.sql','utf8');await db.exec(trigger.slice(trigger.indexOf('create or replace function public.crm_server_on_opportunity_stage()')));
 await db.exec(`create trigger crm_offer_stage_state after update of stage_id on sales_opportunities for each row execute function crm_private.offer_stage_state();create trigger crm_server_opportunity_stage_trigger after update of stage_id on sales_opportunities for each row execute function public.crm_server_on_opportunity_stage();
 grant select,update on sales_opportunities,crm_offer_instances,crm_server_automation_jobs to authenticated;grant select on sales_stages,crm_installations to authenticated;
 alter table sales_opportunities enable row level security;create policy fixture_actor on sales_opportunities for all to authenticated using(owner_user_id=auth.uid()) with check(owner_user_id=auth.uid());
 alter table crm_offer_instances enable row level security;create policy fixture_actor on crm_offer_instances for all to authenticated using(created_by=auth.uid()) with check(created_by=auth.uid());`);
 const O2='20000000-0000-0000-0000-000000000022',F2='40000000-0000-0000-0000-000000000022',FOLLOW='50000000-0000-0000-0000-000000000011',PENDING='50000000-0000-0000-0000-000000000012',LOST='50000000-0000-0000-0000-000000000013';
 await db.exec(`begin;insert into sales_stages(id,name,pipeline_id) values('${FOLLOW}','Seguimiento','${S}'),('${PENDING}','Pendiente de tramitar','${S}'),('${LOST}','Perdido','${S}');insert into sales_opportunities(id,record_id,owner_user_id,stage_id,pipeline_id,phone,contract_party) values('${O2}','${C}','${U}','${FOLLOW}','${S}','600000001','{"recipient_name":"Gestora Ejemplo","recipient_phone":"34600000001"}');insert into crm_offer_instances(id,opportunity_id,contact_id,operator,created_by,status,snapshot) values('${F2}','${O2}','${C}','Lowi','${U}','following','{}');set role authenticated;`);
 const row=async(table,id)=>(await db.query('select * from '+table+' where id=$1',[id])).rows[0];
 const stageChange=async(stage,prefs=null,installation=null,oldOffer=null,oldOpportunity=null)=>{const o=oldOpportunity||await row('sales_opportunities',O2),f=oldOffer||await row('crm_offer_instances',F2);return (await db.query('select crm_change_offer_stage($1,$2,$3,$4,$5,$6) v',[F2,f.updated_at,o.updated_at,stage,prefs&&JSON.stringify(prefs),installation?.updated_at||null])).rows[0].v;};
 const stageReject=async(fn,re)=>{await db.exec('savepoint expected_error');try{await assert.rejects(fn,re);}finally{await db.exec('rollback to savepoint expected_error;release savepoint expected_error;');}};
 const staleOffer=await row('crm_offer_instances',F2),staleOpportunity=await row('sales_opportunities',O2);
 await stageReject(()=>stageChange('ganado'),/Excel/);await stageReject(()=>stageChange('tramitado'),/Revisa la cita/);
 let change=await stageChange('pendiente de tramitar');assert.equal(change.offer.status,'accepted');assert.equal(change.opportunity.stage_id,PENDING);assert(change.offer.accepted_at);
 await stageReject(()=>stageChange('perdido',null,null,staleOffer,staleOpportunity),/otro dispositivo/);assert.equal((await row('sales_opportunities',O2)).stage_id,PENDING);
 change=await stageChange('seguimiento');assert.equal(change.offer.status,'following');assert.equal(change.opportunity.stage_id,FOLLOW);
 change=await stageChange('perdido');assert.equal(change.offer.status,'lost');assert.equal(change.opportunity.status,'lost');
 const prefs={workflow:'installation_v1',operator:'Lowi',previous_operator:'Yoigo',text:'Aviso revisado',return_text:'Router anterior',send:true};
 change=await stageChange('tramitado',prefs);assert.equal(change.offer.status,'processed');assert.equal(change.opportunity.stage_id,S);assert.equal(change.opportunity.status,'open');
 let existing=(await db.query('select * from crm_installations where opportunity_id=$1',[O2])).rows[0];assert(existing);const firstId=existing.id;
 await stageChange('seguimiento');assert(!(await db.query('select * from crm_installations_list()')).rows.some(r=>Object.values(r)[0].opportunity_id===O2));
 await stageReject(()=>stageChange('tramitado',{...prefs,send:false}),/instalación cambió/);
 await stageChange('tramitado',{...prefs,send:false},existing);existing=(await db.query('select * from crm_installations where opportunity_id=$1',[O2])).rows[0];assert.equal(existing.id,firstId);
 await stageChange('tramitado',{...prefs,text:'Aviso editado sin cambiar fecha',send:true},existing);assert.equal((await db.query('select count(*)::int n from crm_installations where opportunity_id=$1',[O2])).rows[0].n,1);
 await db.query("update sales_opportunities set installation_date='2026-10-01' where id=$1",[O2]);await stageReject(()=>stageChange('perdido'),/Excel/);
 await db.exec(`set request.jwt.claim.sub='10000000-0000-0000-0000-000000000099';`);await stageReject(()=>db.query('select crm_change_offer_stage($1,$2,$3,$4,null,null)',[F2,staleOffer.updated_at,staleOpportunity.updated_at,'perdido']),/no disponible/);
 await db.exec(`reset role;rollback;set request.jwt.claim.sub='${U}';`);
 assert.equal((await db.query("select prosecdef from pg_proc where proname='crm_change_offer_stage'")).rows[0].prosecdef,false);assert.equal((await db.query("select has_function_privilege('anon','crm_change_offer_stage(uuid,timestamptz,timestamptz,text,jsonb,timestamptz)','EXECUTE') allowed")).rows[0].allowed,false);
 const scalar=async(sql,args)=>(await db.query(sql,args)).rows[0];
 let i=await scalar('select * from crm_installations');assert.equal(i.previous_operator,'Yoigo');assert.equal(i.recipient_context.phone,'34600000001');assert.equal(i.notice_text,'Hola Gestora, aviso de cita');
 let jobs=(await db.query('select * from crm_server_automation_jobs')).rows;assert.equal(jobs.length,4);assert.equal(jobs.filter(j=>j.action_config.offer_phase==='installation_notice').length,1);const root=jobs.find(j=>j.action_config.steps?.[0]?.action_type==='record_sale_month');assert.equal(root.action_config.steps.length,1);assert(jobs.some(j=>j.action_config.steps?.[0]?.value===3));assert(jobs.some(j=>j.action_config.steps?.[0]?.value===11));
 await db.query(`select crm_private.enqueue_opportunity_stage($1)`,[O]);assert.equal((await db.query('select * from crm_installations')).rows.length,1);assert.equal((await db.query('select * from crm_server_automation_jobs')).rows.length,4);
 // Resend an edited notice without changing its date, and cancel only the superseded notice.
 const beforeNotice=i.notice_job_id;
 await db.query('select crm_installation_update($1,$2,$3)',[O,i.updated_at,JSON.stringify({text:'Aviso revisado sin cambiar cita',send:true})]);i=await scalar('select * from crm_installations');assert.notEqual(i.notice_job_id,beforeNotice);assert.equal((await scalar('select status from crm_server_automation_jobs where id=$1',[beforeNotice])).status,'cancelled');assert.equal(i.notice_text,'Aviso revisado sin cambiar cita');assert.equal(i.appointment_date,null);
 const versionBefore=i.updated_at,jobBefore=i.notice_job_id;
 await assert.rejects(db.query('select crm_installation_update($1,$2,$3)',[O,versionBefore,JSON.stringify({text:'Un único reenvío',send:true})]).then(async()=>db.query('select crm_installation_update($1,$2,$3)',[O,versionBefore,JSON.stringify({text:'Un único reenvío',send:true})])),/otro dispositivo/);
 i=await scalar('select * from crm_installations');assert.notEqual(i.notice_job_id,jobBefore);
 await db.query("update crm_server_automation_jobs set status='running' where id=$1",[i.notice_job_id]);await assert.rejects(db.query('select crm_installation_update($1,$2,$3)',[O,i.updated_at,JSON.stringify({text:'No cambiar mientras se envía'})]),/en envío/);await db.query("update crm_server_automation_jobs set status='pending' where id=$1",[i.notice_job_id]);
 // Time edits preserve the current appointment date, and confirmed historical dates permit observations.
 const future=(await scalar("select ((now() at time zone 'Europe/Madrid')::date+3)::text d")).d;
 await db.query('select crm_installation_update($1,$2,$3)',[O,i.updated_at,JSON.stringify({appointment_date:future,time_from:'10:00',time_to:'12:00',send:false})]);i=await scalar('select * from crm_installations');await db.query('select crm_installation_update($1,$2,$3)',[O,i.updated_at,JSON.stringify({time_from:'10:30',send:false})]);i=await scalar('select * from crm_installations');assert.equal(i.appointment_date.toISOString().slice(0,10),future);assert.equal(i.time_from,'10:30:00');
 const incoming=async(id,action,phone='34600000001',text='',stamp=null)=>db.query('insert into wa_messages(id_message,chat_id,direction,raw,type_message,text_content,created_at) values($1,$2,\'in\',$3,\'interactiveButtonsResponse\',$4,coalesce($5,now()))',[id,phone+'@c.us',JSON.stringify({messageData:{interactiveButtonsResponse:{selectedButtonId:action}}}),text,stamp]);
 await incoming('wrong','install_done:'+i.id,'34600000002');assert.equal((await scalar('select * from crm_installations')).awaiting_date,false);
 await incoming('date-before-done','install_today:'+i.id);assert.equal((await scalar('select * from crm_installations')).installed_on,null);
 await incoming('installed','install_done:'+i.id);i=await scalar('select * from crm_installations');assert.equal(i.awaiting_date,true);assert.equal(i.installed_on,null);assert.equal((await scalar('select * from sales_opportunities')).installation_date,null);
 await incoming('invalid','',undefined,'31/02/2026');assert.equal((await scalar('select * from crm_installations')).installed_on,null);
 await incoming('confirm','install_yesterday:'+i.id);i=await scalar('select * from crm_installations');assert(i.installed_on);assert(i.return_job_id);await db.query('select crm_installation_update($1,$2,$3)',[O,i.updated_at,JSON.stringify({incident:'Observación sobre cita anterior'})]);i=await scalar('select * from crm_installations');assert.equal(i.incident,'Observación sobre cita anterior');await assert.rejects(db.query('select crm_installation_update($1,$2,$3)',[O,i.updated_at,JSON.stringify({send:true})]),/confirmada/);let rj=await scalar('select * from crm_server_automation_jobs where id=$1',[i.return_job_id]);assert.equal(rj.action_config.text,'Hola Gestora. Router de Yoigo');assert.equal(new Date(rj.run_at).getUTCDay()===0||new Date(rj.run_at).getUTCDay()===6,false);
 assert.equal((await scalar('select * from sales_opportunities')).installation_date,null);assert.equal((await scalar('select * from sales_opportunities')).stage_id,S);
 await incoming('repeated','install_done:'+i.id);assert.equal((await db.query("select * from crm_server_automation_jobs where context->>'installation_phase'='installation_return'")).rows.length,1);
 // Guard cancels a late appointment notice after customer confirmation, but permits the return.
 await db.query("update crm_server_automation_jobs set status='running' where id=$1",[i.notice_job_id]);assert.equal((await scalar('select crm_lifecycle_job_guard($1) g',[i.notice_job_id])).g.allow,false);
 await db.query("update crm_server_automation_jobs set status='running' where id=$1",[i.return_job_id]);assert.equal((await scalar('select crm_lifecycle_job_guard($1) g',[i.return_job_id])).g.allow,true);
 // The row version blocks stale edits, including from a second PC.
 await assert.rejects(db.query('select crm_installation_update($1,$2,$3)',[O,'2000-01-01',JSON.stringify({incident:'stale'})]),/otro dispositivo/);
 // Direct sales with new communications bypass the old next-day template requirement.
 const direct=(await scalar('select crm_create_direct_sale_v8($1,$2,30,false,false,false,null,null,$3,true,null,$4) v',[C,'Lowi','Aviso nuevo',JSON.stringify({workflow:'installation_v1',send:true,text:'Aviso nuevo',return_text:'Router',previous_operator:'Yoigo',operator:'Lowi'})])).v;assert.equal(direct.legacy_day_one,false);assert.equal(direct.legacy_text,null);
 // Current recipient preview does not depend on a legacy day-one template.
 const preview=(await scalar('select crm_installation_preview($1) p',[O])).p;assert.equal(preview.recipient,'Gestora Ejemplo');assert.equal(preview.workflow,'installation_v1');
 // Old Netflix instructions are retained as an editable extra, without a router paragraph.
 await db.query("insert into wa_templates(id,user_id,name,body) values(663,$1,'Netflix','Hola {nombre}\\n\\n⚠️ Activa Netflix cuando tu línea esté en Vodafone.\\n\\n📦 Router antiguo')",[U]);
 await db.exec("update crm_automations set trigger_config=trigger_config||'{\"netflix_template_id\":\"663\"}'::jsonb where trigger_config->>'automation_code'='vodafone_day_one'");
 assert((await scalar("select crm_private.installation_config('Vodafone') c")).c.netflix_extra_text.includes('Activa Netflix'));
 assert(!(await scalar("select crm_private.installation_config('Vodafone') c")).c.netflix_extra_text.includes('Router antiguo'));
 // Config and router instructions save atomically, including accents and CAS.
 const cfg=JSON.stringify({router_text:'Entrega según las instrucciones del operador',slots:[{from:'09:00',to:'12:00'}],return_time:'10:30'});
 const saved=(await scalar('select crm_installation_save_settings($1,$2,null) v',['MásMóvil',cfg])).v;
 assert(saved.updated_at);assert.equal((await scalar("select key from app_settings where key like 'crm_router_template:%'")).key,'crm_router_template:m%C3%A1sm%C3%B3vil');
 await assert.rejects(db.query('select crm_installation_save_settings($1,$2,null)',['MásMóvil',cfg]),/otro dispositivo/);
 await assert.rejects(db.query('select crm_installation_save_settings($1,$2,null)',['Bad',JSON.stringify({slots:[{from:'12:00',to:'09:00'}]})]),/franjas/);
 assert.equal((await scalar("select count(*)::int n from app_settings where key='crm_installation_template:bad'")).n,0);
 // The calendar is evaluated in Madrid, including the autumn DST transition.
 assert.equal((await scalar("select crm_private.installation_due('2026-10-23','10:00') d")).d.toISOString(),'2026-10-27T09:00:00.000Z');
 await db.query("update crm_installations set incident='' where opportunity_id=$1",[O]);
 // Legacy undated Tramitado rows are excluded, while Excel dates remain consultable.
 await db.exec(`insert into sales_opportunities(id,stage_id,client_name,installation_date) values('20000000-0000-0000-0000-000000000002','${S}','Legacy sin fecha',null),('20000000-0000-0000-0000-000000000003','${S}','Legacy Excel','2026-09-01');`);
 const list=(await db.query('select * from crm_installations_list()')).rows.map(r=>Object.values(r)[0]);
 assert.equal(list.length,2);assert(list.some(r=>r.opportunity_id===O));assert(list.some(r=>r.excel_date==='2026-09-01'&&r.status==='excel'));assert(!list.some(r=>r.client_name==='Legacy sin fecha'));
 await db.exec(`set request.jwt.claim.sub='';`);await assert.rejects(db.query('select crm_installations_list()'),/permiso/);await assert.rejects(db.query('select crm_installation_save_settings($1,$2,null)',['Yoigo',cfg]),/permiso/);
 console.log('PASS installation database integration: real SQL, actor routing, dates, idempotency, stage isolation, CAS and permissions');await db.close();}
main().catch(e=>{console.error(e.message, e.position||'',e.where||'');process.exit(1);});
