/* Run the real RPCs against isolated PostgreSQL with synthetic contacts. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite');
async function main(){
 const db=new PGlite();
 const fixture=fs.readFileSync('tests/installation-communications-db.cjs','utf8');
 const U='10000000-0000-0000-0000-000000000001',C='30000000-0000-0000-0000-000000000001',S='50000000-0000-0000-0000-000000000001',P='50000000-0000-0000-0000-000000000002';
 const setup=fixture.split('await db.exec(`')[1].split('`);')[0].replaceAll('${U}',U);
 await db.exec(setup);
 await db.exec(`alter table sales_opportunities add expected_date date,add notes text;
 alter table crm_offer_instances alter id set default gen_random_uuid(),add catalog_offer_id uuid,add offer_name text,add base_price numeric,add message_text text,add accepted_at timestamptz,add processed_at timestamptz;
 alter table crm_labels alter id set default gen_random_uuid(),add unique(name);alter table crm_contact_labels add unique(contact_id,label_id);
 create table sale_month_probe(opportunity_id uuid,stamp timestamptz);
 create function crm_private.offer_record_sale(public.crm_offer_instances,timestamptz) returns void language sql as $$insert into public.sale_month_probe values($1.opportunity_id,$2)$$;
 create function crm_private.enqueue_opportunity_stage(uuid) returns integer language plpgsql as $$begin if exists(select 1 from public.sales_opportunities where id=$1 and stage_id='${S}') then insert into public.crm_server_automation_jobs(user_id,event_key,context) values('${U}','installation-notice:'||$1,'{}');end if;return 0;end$$;
 create function public.crm_direct_sale_day_one_preview(uuid,uuid,uuid,text,boolean) returns jsonb language sql as $$select '{"available":true,"text":"Aviso tramitado","rule_id":"10000000-0000-0000-0000-000000000003"}'::jsonb$$;
 insert into records values('${C}','{"NOMBRE":"Cliente de prueba","TELÉFONO":"600000001"}');
 insert into sales_stages values('${S}','Tramitado','${S}',true,1),('${P}','Pendiente de tramitar','${S}',true,0);
 select set_config('request.jwt.claim.sub','${U}',false);`);
 await db.exec(fs.readFileSync('db/proposals/direct-sale-month.sql','utf8'));
 // Use the current v8 wrapper (which defers installation communication until the instance exists).
 const installation=fs.readFileSync('supabase/migrations/20261003170000_installation_communications.sql','utf8');
 await db.exec(installation.slice(installation.indexOf('create or replace function public.crm_create_direct_sale_v8'),installation.indexOf('create or replace function public.crm_send_offer_v8')));
 await db.exec(fs.readFileSync('db/proposals/direct-sale-pending.sql','utf8'));
 await db.exec('create trigger offer_stage_state after update of stage_id on sales_opportunities for each row execute function crm_private.offer_stage_state();');
 const call=async(status='accepted',month=null,send=false)=> (await db.query('select crm_create_direct_sale_v9($1,$2,$3,$4,false,false,null,null,null,true,$5,null,$6) v',[C,'Vodafone',27,send,month,status])).rows[0].v;
 const offer=async(id)=>(await db.query('select * from crm_offer_instances where id=$1',[id])).rows[0];
 const pending=await call(),p=await offer(pending.offer_id);
 assert.equal(pending.stage,'Pendiente de tramitar');assert.equal(p.status,'accepted');assert(p.accepted_at);assert.equal(p.processed_at,null);assert.equal(p.snapshot.send_day_one,false);assert.equal(p.snapshot.processing_date,undefined);
 assert.equal(p.snapshot.sale_month,(await db.query("select to_char(now() at time zone 'Europe/Madrid','YYYY-MM') m")).rows[0].m);
 assert.equal((await db.query('select count(*)::int n from crm_server_automation_jobs')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from sale_month_probe')).rows[0].n,0);
 const historical=await call('accepted','2026-09');assert.equal((await offer(historical.offer_id)).snapshot.sale_month,'2026-09');
 await db.query('update sales_opportunities set stage_id=$1 where id=$2',[S,historical.opportunity_id]);
 assert.equal((await offer(historical.offer_id)).status,'processed');assert((await offer(historical.offer_id)).processed_at);
 assert.equal((await db.query("select to_char(stamp at time zone 'Europe/Madrid','YYYY-MM') m from sale_month_probe where opportunity_id=$1",[historical.opportunity_id])).rows[0].m,'2026-09');
 const processed=await call('processed','2026-10');assert.equal(processed.stage,'Tramitado');assert((await offer(processed.offer_id)).processed_at);
 assert.equal((await db.query('select count(*)::int n from crm_server_automation_jobs')).rows[0].n,1,'Only the processed flow starts processing notices');
 const requested=await call('accepted','2026-10',true);assert.equal((await offer(requested.offer_id)).status,'accepted');
 assert.equal((await db.query('select count(*)::int n from crm_server_automation_jobs where event_key=$1',['direct-sale:'+requested.offer_id])).rows[0].n,1,'Explicit optional offer message is allowed, without processing');
 await assert.rejects(()=>call('wrong'),/Estado de venta/);await assert.rejects(()=>call('accepted','2026-13'),/Mes de venta/);await assert.rejects(()=>call('accepted','0000-01'),/Mes de venta/);
 await db.exec("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(()=>call(),/permiso/);
 await db.close();console.log('direct-sale-pending-db: pending, processed, sale month, later transition, optional message and permission checks passed');
}
main().catch(error=>{console.error(error);process.exit(1)});
