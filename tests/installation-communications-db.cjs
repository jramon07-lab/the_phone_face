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
 await db.exec(`set request.jwt.claim.sub='${U}';insert into records values('${C}','{}');insert into sales_stages(id,name,pipeline_id) values('${S}','Tramitado','${S}'),('50000000-0000-0000-0000-000000000002','Ganado','${S}');
 insert into crm_automations(user_id,name,trigger_type,trigger_config,action_type,action_config) values('${U}','Etiqueta y aviso','opportunity_stage','{"stage_id":"${S}","automation_operator":"Vodafone","automation_code":"vodafone_day_one"}','flow_v1','{"steps":[{"kind":"action","action_type":"record_sale_month"},{"kind":"wait","value":1,"unit":"days"},{"kind":"action","action_type":"send_template","config":{"template_id":"1"}}]}'),('${U}','3 meses','opportunity_stage','{"stage_id":"${S}","automation_operator":"Vodafone","automation_code":"vodafone_security_3_months"}','flow_v1','{"steps":[{"kind":"wait","value":3,"unit":"months"},{"kind":"action","action_type":"send_template","config":{"template_id":"2"}}]}'),('${U}','11 meses','opportunity_stage','{"stage_id":"${S}","automation_operator":"Vodafone","automation_code":"vodafone_annual_review"}','flow_v1','{"steps":[{"kind":"wait","value":11,"unit":"months"},{"kind":"action","action_type":"prepare_operator_review"}]}'),('${U}','Manual','manual_offer','{}','__send_whatsapp','{}');
 insert into sales_opportunities(id,record_id,owner_user_id,stage_id,pipeline_id,phone,client_name,title,contract_party,after_sale_preferences) values('${O}','${C}','${U}','${S}','${S}','600000000','Titular Ejemplo','Vodafone','{"recipient_name":"Gestora Ejemplo","recipient_first_name":"Gestora","recipient_phone":"34600000001"}','{"workflow":"installation_v1","send":true,"text":"Hola Gestora, aviso de cita","return_text":"Hola {nombre}. Router de {operador_anterior}","previous_operator":"Yoigo","operator":"Vodafone"}');
 insert into crm_offer_instances(id,opportunity_id,contact_id,operator,created_by,snapshot,status) values('${F}','${O}','${C}','Vodafone','${U}','{}','processed');
 select crm_private.enqueue_opportunity_stage('${O}');`);
 const scalar=async(sql,args)=>(await db.query(sql,args)).rows[0];
 let i=await scalar('select * from crm_installations');assert.equal(i.previous_operator,'Yoigo');assert.equal(i.recipient_context.phone,'34600000001');assert.equal(i.notice_text,'Hola Gestora, aviso de cita');
 let jobs=(await db.query('select * from crm_server_automation_jobs')).rows;assert.equal(jobs.length,4);assert.equal(jobs.filter(j=>j.action_config.offer_phase==='installation_notice').length,1);const root=jobs.find(j=>j.action_config.steps?.[0]?.action_type==='record_sale_month');assert.equal(root.action_config.steps.length,1);assert(jobs.some(j=>j.action_config.steps?.[0]?.value===3));assert(jobs.some(j=>j.action_config.steps?.[0]?.value===11));
 await db.query(`select crm_private.enqueue_opportunity_stage($1)`,[O]);assert.equal((await db.query('select * from crm_installations')).rows.length,1);assert.equal((await db.query('select * from crm_server_automation_jobs')).rows.length,4);
 const incoming=async(id,action,phone='34600000001',text='',stamp=null)=>db.query('insert into wa_messages(id_message,chat_id,direction,raw,type_message,text_content,created_at) values($1,$2,\'in\',$3,\'interactiveButtonsResponse\',$4,coalesce($5,now()))',[id,phone+'@c.us',JSON.stringify({messageData:{interactiveButtonsResponse:{selectedButtonId:action}}}),text,stamp]);
 await incoming('wrong','install_done:'+i.id,'34600000002');assert.equal((await scalar('select * from crm_installations')).awaiting_date,false);
 await incoming('date-before-done','install_today:'+i.id);assert.equal((await scalar('select * from crm_installations')).installed_on,null);
 await incoming('installed','install_done:'+i.id);i=await scalar('select * from crm_installations');assert.equal(i.awaiting_date,true);assert.equal(i.installed_on,null);assert.equal((await scalar('select * from sales_opportunities')).installation_date,null);
 await incoming('invalid','',undefined,'31/02/2026');assert.equal((await scalar('select * from crm_installations')).installed_on,null);
 await incoming('confirm','install_yesterday:'+i.id);i=await scalar('select * from crm_installations');assert(i.installed_on);assert(i.return_job_id);let rj=await scalar('select * from crm_server_automation_jobs where id=$1',[i.return_job_id]);assert.equal(rj.action_config.text,'Hola Gestora. Router de Yoigo');assert.equal(new Date(rj.run_at).getUTCDay()===0||new Date(rj.run_at).getUTCDay()===6,false);
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
 await db.exec(`set request.jwt.claim.sub='';`);await assert.rejects(db.query('select crm_installations_list()'),/permiso/);await assert.rejects(db.query('select crm_installation_save_settings($1,$2,null)',['Yoigo',cfg]),/permiso/);
 console.log('PASS installation database integration: real SQL, actor routing, dates, idempotency, stage isolation, CAS and permissions');await db.close();}
main().catch(e=>{console.error(e.message, e.position||'',e.where||'');process.exit(1);});
