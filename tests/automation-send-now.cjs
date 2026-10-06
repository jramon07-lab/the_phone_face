const assert=require('node:assert/strict'),fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');
(async()=>{const d=new PGlite();await d.exec(`create schema auth;create schema crm_private;create role authenticated;create role anon;
create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
create function current_user_is_admin() returns boolean language sql as $$select true$$;create function current_user_can(text) returns boolean language sql as $$select false$$;
create function crm_private.dispatch_runner_now() returns void language sql as $$select null::void$$;
create table crm_server_automation_jobs(id uuid,user_id uuid,updated_at timestamptz,status text,completed_at timestamptz,action_config jsonb,action_type text,run_at timestamptz);`);
await d.exec(fs.readFileSync('db/proposals/automation_send_now.sql','utf8'));
const id='00000000-0000-0000-0000-000000000011',at='2026-10-06T20:00:00Z';await d.query('insert into crm_server_automation_jobs values($1,auth.uid(),$2,\'pending\',null,\'{}\',\'__send_whatsapp\',\'2026-10-07T08:00Z\')',[id,at]);
let r=await d.query('select crm_send_automation_now($1,$2) result',[id,at]);assert.equal(r.rows[0].result.id,id);assert.equal((await d.query('select count(*) n from crm_server_automation_jobs')).rows[0].n,1);
await assert.rejects(d.query('select crm_send_automation_now($1,$2)',[id,at]),/ha cambiado/);
for(const [status,config] of [['running',{}],['sent',{}],['paused',{}],['pending',{__delivery_receipt:{idMessage:'accepted'}}],['pending',{offer_phase:'reminder_5'}]]){await d.query('update crm_server_automation_jobs set status=$1,action_config=$2,updated_at=$3',[status,JSON.stringify(config),at]);await assert.rejects(d.query('select crm_send_automation_now($1,$2)',[id,at]));}
await d.query('update crm_server_automation_jobs set user_id=$1,status=\'pending\',action_config=\'{}\'',['00000000-0000-0000-0000-000000000002']);await assert.rejects(d.query('select crm_send_automation_now($1,$2)',[id,at]),/no disponible/);
await d.close();console.log('PASS send-now existing job, stale clicks, ownership, terminal states, receipts and offer sequence');})().catch(e=>{console.error(e);process.exitCode=1});
