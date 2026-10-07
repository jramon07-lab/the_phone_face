const fs=require('fs'),assert=require('assert/strict'),{PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite();await db.exec(`
 create role anon;create role authenticated;create schema auth;create schema crm_private;
 create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''test.uid'',true),'''')::uuid';
 create function current_user_is_admin() returns boolean language sql as 'select false';
 create function current_user_can(text) returns boolean language sql as 'select current_setting(''test.can'',true)=''yes''';
 create table sales_stages(id uuid,pipeline_id uuid,name text,active boolean,position int);
 create table sales_opportunities(id uuid primary key,record_id uuid,contract_party jsonb,discount_end_date date,terminal_commitment_end date);
 create table crm_monthly_reviews(id uuid,opportunity_id uuid,kind text,target_date date,operator text,status text);
 create function crm_private.resolve_sale_party(uuid,uuid,uuid) returns jsonb language sql as 'select jsonb_build_object(''holder_record_id'',$1,''manager_record_id'',$2,''recipient_contact_id'',$3)';
 create function crm_create_opportunity_guarded(uuid,uuid,uuid,text,numeric,text,text,date,text,jsonb,boolean) returns uuid language plpgsql as $fn$
 declare oid uuid:=gen_random_uuid();begin insert into public.sales_opportunities(id,record_id,contract_party) values(oid,$3,$10);return oid;end $fn$;
 create function crm_private.create_manual_review_internal(uuid,date,text) returns uuid language plpgsql as $fn$
 declare rid uuid:=gen_random_uuid();begin if current_setting('test.fail',true)='yes' then raise exception 'simulated review failure';end if;insert into public.crm_monthly_reviews values(rid,$1,'manual',$2,$3,'active');return rid;end $fn$;
 insert into sales_stages values(gen_random_uuid(),gen_random_uuid(),'Próximo',true,1);
 `);
 await db.exec(fs.readFileSync('supabase/migrations/20261007113000_manual_review_contract_dates.sql','utf8'));
 const call="select crm_create_manual_review_v2('10000000-0000-0000-0000-000000000001','O2','2099-05-01','nota',null,'20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2099-06-01') as id";
 assert.equal((await db.query("select has_function_privilege('anon','crm_create_manual_review_v2(uuid,text,date,text,uuid,uuid,uuid,date)','execute') as allowed")).rows[0].allowed,false);
 await assert.rejects(db.exec(call),/permiso/);await db.exec("set test.uid='10000000-0000-0000-0000-000000000001';set test.can='yes';set test.fail='yes'");
 await assert.rejects(db.exec(call),/simulated/);assert.equal((await db.query('select count(*)::int as n from sales_opportunities')).rows[0].n,0);
 await db.exec("set test.fail='no'");const id=(await db.query(call)).rows[0].id;assert.equal((await db.query(call)).rows[0].id,id);
 const row=(await db.query('select discount_end_date::text as discount,terminal_commitment_end::text as terminal from sales_opportunities')).rows[0];assert.deepEqual(row,{discount:'2099-05-01',terminal:'2099-06-01'});
 await assert.rejects(db.exec(call.replace('2099-06-01','2099-07-01')),/Ya existe/);assert.equal((await db.query('select count(*)::int as n from crm_monthly_reviews')).rows[0].n,1);
 await db.close();console.log('PASS manual review atomic dates, rollback, repeat confirmation, conflicting dates and permissions');
})().catch(e=>{console.error(e);process.exit(1)});

