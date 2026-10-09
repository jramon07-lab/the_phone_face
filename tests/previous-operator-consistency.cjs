const fs=require('fs'),assert=require('assert/strict');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create schema crm_private;
 create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''test.uid'',true),'''')::uuid';
 create function public.current_user_is_admin() returns boolean language sql as 'select false';
 create function public.current_user_can(text) returns boolean language sql as 'select coalesce(current_setting(''test.can'',true),'''')=''yes''';
 create table sales_opportunities(id uuid primary key,previous_operator text,after_sale_preferences jsonb,updated_at timestamptz);
 create table crm_offer_instances(id uuid primary key,opportunity_id uuid,snapshot jsonb,updated_at timestamptz);
 create table crm_installations(opportunity_id uuid);
 grant usage on schema auth to authenticated;grant select,update on sales_opportunities,crm_offer_instances to authenticated;grant select on crm_installations to authenticated;
 alter table sales_opportunities enable row level security;alter table crm_offer_instances enable row level security;
 create policy opportunity_access on sales_opportunities to authenticated using(id=auth.uid()) with check(id=auth.uid());
 create policy offer_access on crm_offer_instances to authenticated using(opportunity_id=auth.uid()) with check(opportunity_id=auth.uid());
 insert into sales_opportunities values('10000000-0000-0000-0000-000000000001',null,'{"keep":"yes"}','2026-10-07');
 insert into crm_offer_instances values('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','{"message":"unchanged","previous_operator_override":"O2"}','2026-10-07');`);
 await db.exec(fs.readFileSync('supabase/migrations/20261007100000_previous_operator_consistency.sql','utf8').replace("notify pgrst,'reload schema';",''));
 const triggerSource=fs.readFileSync('db/proposals/router-return.sql','utf8');
 await db.exec(triggerSource.slice(0,triggerSource.indexOf('create or replace function public.crm_router_return_preview')));
 await db.exec('grant usage on schema crm_private to authenticated');
 const call="select crm_set_previous_operator('10000000-0000-0000-0000-000000000001','2026-10-07','MásMóvil','20000000-0000-0000-0000-000000000001','2026-10-07') as saved";
 assert.equal((await db.query("select has_function_privilege('anon','crm_set_previous_operator(uuid,timestamptz,text,uuid,timestamptz)','execute') as allowed")).rows[0].allowed,false);
 await assert.rejects(db.exec(call),/permiso/);await db.exec("set role authenticated;set test.uid='10000000-0000-0000-0000-000000000001';set test.can='yes'");
 await assert.rejects(db.exec(call.replace("'2026-10-07')","'2026-10-06')")),/oferta cambió/);
 assert.equal((await db.query('select previous_operator from sales_opportunities')).rows[0].previous_operator,null);
 // Reproduce the real production failure with the actual BEFORE-write validator.
 await assert.rejects(db.exec(call),/Indica si se envía el mensaje/);
 assert.equal((await db.query('select previous_operator from sales_opportunities')).rows[0].previous_operator,null);
 await db.exec('reset role');
 await db.exec(fs.readFileSync('db/proposals/previous-operator-independent-save.sql','utf8').replace("notify pgrst,'reload schema';",''));
 await db.exec('set role authenticated');
 const saved=(await db.query(call)).rows[0].saved;assert.equal(saved.opportunity.previous_operator,'MásMóvil');assert.equal(saved.opportunity.after_sale_preferences.keep,'yes');assert.equal(saved.offer.snapshot.previous_operator_override,'MásMóvil');assert.equal(saved.offer.snapshot.message,'unchanged');
 await assert.rejects(db.exec(call),/oportunidad cambió/);
 // A company-only save must work with null, partial, old or complete message settings.
 for(const prefs of [null,{previous_operator:'O2'}, {previous_operator:'O2',previous_operator_saved:true}, {workflow:'installation_v1',send:true,previous_operator:'O2',text:'Texto original',return_text:'Devolución original',appointment_date:'2020-01-01',time_from:'10:00',communication_mode:'notice'}]){
  await db.exec('reset role;alter table sales_opportunities disable trigger router_return_before_write;');
  await db.query("update sales_opportunities set after_sale_preferences=$1,updated_at='2026-10-07'",[prefs&&JSON.stringify(prefs)]);
  await db.exec("alter table sales_opportunities enable trigger router_return_before_write;update crm_offer_instances set updated_at='2026-10-07';set role authenticated;");
  const updated=(await db.query(call)).rows[0].saved;
  assert.equal(updated.opportunity.previous_operator,'MásMóvil');assert.deepEqual(updated.opportunity.after_sale_preferences,prefs,'Saving the company must preserve communication settings byte-for-byte');
  assert.equal(updated.offer.snapshot.message,'unchanged');
  await db.exec("reset role;update sales_opportunities set updated_at='2026-10-07';update crm_offer_instances set updated_at='2026-10-07';set role authenticated;");
  const cleared=(await db.query(call.replace("'MásMóvil'","''"))).rows[0].saved;
  assert.equal(cleared.opportunity.previous_operator,null);assert.equal(cleared.offer.snapshot.previous_operator_override,'');assert.deepEqual(cleared.opportunity.after_sale_preferences,prefs);
 }
 await db.exec("reset role;update sales_opportunities set updated_at='2026-10-07';update crm_offer_instances set updated_at='2026-10-07';insert into crm_installations values('10000000-0000-0000-0000-000000000001');set role authenticated;");await assert.rejects(db.exec(call),/instalación/);
 await db.close();console.log('PASS atomic previous operator consistency, stale versions, installation guard, RLS, permissions and preserved messages');
})().catch(e=>{console.error(e);process.exit(1)});
