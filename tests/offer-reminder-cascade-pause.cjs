const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
const db=new PGlite();
await db.exec(`
create role anon; create role authenticated; create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function public.current_user_is_admin() returns boolean language sql as $$select false$$;
create function public.current_user_can(text) returns boolean language sql as $$select true$$;
create table public.crm_offer_instances(id uuid primary key,created_by uuid,snapshot jsonb default '{}',status text,paused_at timestamptz,pause_reason text,resume_at timestamptz,resume_job_id uuid,updated_at timestamptz default now());
create table public.crm_server_automation_jobs(id uuid primary key,user_id uuid,context jsonb,action_config jsonb,status text,run_at timestamptz,updated_at timestamptz,completed_at timestamptz,error_message text);
create function public.crm_resume_offer_at(uuid,text,text,timestamptz) returns jsonb language sql as $$select '{"ok":true}'::jsonb$$;
set test.uid='11111111-1111-1111-1111-111111111111';
insert into crm_offer_instances(id,created_by,status,snapshot) values
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',auth.uid(),'following','{}'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',auth.uid(),'following','{"group_leader_offer_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}'),
('cccccccc-cccc-cccc-cccc-cccccccccccc',auth.uid(),'following','{}');
insert into crm_server_automation_jobs(id,user_id,context,action_config,status,run_at) values
('00000000-0000-0000-0000-000000000001',auth.uid(),'{"offer_instance_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}','{"offer_phase":"initial","__delivery_receipt":{}}','done',now()),
('00000000-0000-0000-0000-000000000002',auth.uid(),'{"offer_instance_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}','{"offer_phase":"reminder_2"}','pending',now()),
('00000000-0000-0000-0000-000000000003',auth.uid(),'{"offer_instance_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","timed_offer_pause":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}','{"offer_phase":"reminder_5"}','pending',now()),
('00000000-0000-0000-0000-000000000004',auth.uid(),'{"offer_instance_id":"cccccccc-cccc-cccc-cccc-cccccccccccc"}','{"offer_phase":"reminder_5"}','pending',now()),
('00000000-0000-0000-0000-000000000005',auth.uid(),'{}','{}','pending',now());
`);
await db.exec(fs.readFileSync('db/proposals/offer-reminder-cascade-pause.sql','utf8'));
await db.query("select crm_set_automation_job_pause('00000000-0000-0000-0000-000000000002',true)");
let rows=(await db.query('select id,status,context from crm_server_automation_jobs order by id')).rows;
assert.deepEqual(rows.map(x=>x.status),['done','paused','paused','pending','pending']);
assert.equal('timed_offer_pause' in rows[2].context,false);
assert.deepEqual((await db.query('select status from crm_offer_instances order by id')).rows.map(x=>x.status),['paused','paused','following']);
await db.query("select crm_set_automation_job_pause('00000000-0000-0000-0000-000000000005',true)");
assert.equal((await db.query("select status from crm_server_automation_jobs where id='00000000-0000-0000-0000-000000000004'")).rows[0].status,'pending');
await db.exec("update crm_server_automation_jobs set status='running' where id='00000000-0000-0000-0000-000000000003'");
await assert.rejects(db.query("select crm_set_automation_job_pause('00000000-0000-0000-0000-000000000002',true)"),/Hay un mensaje en envío/);
await db.exec("update crm_server_automation_jobs set status='pending',action_config=action_config||'{\"__delivery_receipt\":{}}' where id='00000000-0000-0000-0000-000000000003'");
await assert.rejects(db.query("select crm_set_automation_job_pause('00000000-0000-0000-0000-000000000002',true)"),/Hay un mensaje en envío/);
await db.exec("set test.uid='22222222-2222-2222-2222-222222222222'");
await assert.rejects(db.query("select crm_set_automation_job_pause('00000000-0000-0000-0000-000000000002',true)"),/Envío no encontrado/);
await db.close();console.log('PASS cascade offer pause: whole group, unrelated offers untouched, no timed wakeup, running/receipt protection and ownership');
})().catch(e=>{console.error(e);process.exitCode=1});
