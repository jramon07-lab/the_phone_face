'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
const db=new PGlite();
await db.exec(`
create role anon;create role authenticated;create role service_role;create schema auth;create schema crm_private;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function public.current_user_is_admin() returns boolean language sql as $$select false$$;
create function public.current_user_can(text) returns boolean language sql as $$select coalesce(current_setting('test.allowed',true),'yes')<>'no'$$;
create table wa_messages(id serial primary key,chat_id text,id_message text,direction text,ts bigint);
create table agenda_items(id uuid primary key default gen_random_uuid(),whatsapp_phone text,customer_phone text,whatsapp_message text,whatsapp_enabled boolean,whatsapp_scheduled_at timestamptz,whatsapp_sent_at timestamptz,whatsapp_provider_message_id text,whatsapp_delivery_status text,status text);
create table crm_offer_instances(id uuid primary key,created_by uuid,snapshot jsonb default '{}',message_text text);
create table crm_server_automation_jobs(id uuid primary key default gen_random_uuid(),user_id uuid,context jsonb,event_key text,run_at timestamptz,status text,action_config jsonb);
create table crm_offer_outgoing_messages(provider_message_id text primary key,offer_instance_id uuid,job_id uuid,phase text,sent_at timestamptz);
create function crm_create_offer_composition(uuid,uuid,uuid,uuid,jsonb,text,text,text,boolean,date,boolean,boolean,timestamptz,boolean,jsonb) returns jsonb language plpgsql set search_path=public as $$
declare oid uuid:=$4;begin
 insert into crm_offer_instances(id,created_by,message_text) values(oid,auth.uid(),'Oferta ficticia') on conflict do nothing;
 insert into crm_server_automation_jobs(user_id,context,event_key,run_at,status) select auth.uid(),jsonb_build_object('offer_instance_id',oid,'phone','34999999999'),'manual-offer:'||oid,coalesce($13,now()),'pending' where not exists(select 1 from crm_server_automation_jobs where event_key='manual-offer:'||oid);
 return jsonb_build_object('offers',jsonb_build_array(jsonb_build_object('offer_id',oid)),'composition_verified',true);end$$;
insert into auth.users values('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');
set test.uid='11111111-1111-1111-1111-111111111111';
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
grant select on wa_messages to authenticated;
`);
await db.exec(fs.readFileSync('db/proposals/whatsapp-reply-reminders.sql','utf8'));
const query=async(sql,args=[])=>(await db.query(sql,args)).rows;
const spec={delay_minutes:1440};
const prep=async(chat,source='message',id=null,s=spec)=>(await query('select crm_prepare_reply_reminder($1,$2,$3,$4,$5) as id',[chat,'Mensaje ficticio',s,source,id]))[0].id;
const one=await prep('999999999');
assert.equal((await query('select status from crm_whatsapp_reply_reminders where id=$1',[one]))[0].status,'waiting','notices never activate before a confirmed send');
const sent='2026-10-01T10:00:00Z';
await query('select crm_arm_reply_reminder($1,$2,$3)',[one,'message-1',sent]);
let row=(await query('select * from crm_whatsapp_reply_reminders where id=$1',[one]))[0];
assert.equal(new Date(row.due_at).toISOString(),'2026-10-02T10:00:00.000Z');
assert.equal(row.chat_id,'34999999999@c.us');
await db.exec("insert into wa_messages(chat_id,direction,ts) values('34888888888@c.us','in',extract(epoch from timestamptz '2026-10-01T11:00Z'));");
assert.equal((await query('select status from crm_whatsapp_reply_reminders where id=$1',[one]))[0].status,'pending','another customer cannot cancel');
await db.exec("insert into wa_messages(chat_id,direction,ts) values('34999999999@c.us','out',extract(epoch from timestamptz '2026-10-01T11:00Z'));");
assert.equal((await query('select status from crm_whatsapp_reply_reminders where id=$1',[one]))[0].status,'pending','outgoing messages cannot cancel');
await db.exec("insert into wa_messages(chat_id,direction,ts) values('34999999999@c.us','in',extract(epoch from timestamptz '2026-10-01T11:00Z'));");
assert.equal((await query('select status from crm_whatsapp_reply_reminders where id=$1',[one]))[0].status,'answered');
const late=await prep('34999999999@c.us');await query('select crm_arm_reply_reminder($1,$2,$3)',[late,'message-late',sent]);
assert.equal((await query('select status from crm_whatsapp_reply_reminders where id=$1',[late]))[0].status,'answered','response before reminder is armed is caught');
await assert.rejects(prep('34999999999@g.us'),/conversación individual/);
await assert.rejects(prep('999999999','message',null,{delay_minutes:0}),/fecha futura/);
await assert.rejects(prep('999999999','message',null,{at:'2020-01-01'}),/fecha futura/);
await assert.rejects(prep('999999999','message',null,{at:'2030-01-01',delay_minutes:10}),/fecha futura/);
// Queue trigger: selected option is persisted atomically, delayed until actual delivery.
const schedule=(await query("insert into agenda_items(whatsapp_phone,whatsapp_message,whatsapp_enabled,whatsapp_scheduled_at,status,whatsapp_reply_reminder) values('777777777','Programado ficticio',true,now()+interval '2 days','pending',$1) returning id",[spec]))[0].id;
assert.equal((await query("select status from crm_whatsapp_reply_reminders where source_id=$1",[schedule]))[0].status,'waiting');
await query("update agenda_items set whatsapp_delivery_status='uncertain' where id=$1",[schedule]);
assert.equal((await query("select status from crm_whatsapp_reply_reminders where source_id=$1",[schedule]))[0].status,'waiting');
await query("update agenda_items set whatsapp_delivery_status='sent',whatsapp_provider_message_id='scheduled-1',whatsapp_sent_at=now()+interval '3 days',status='completed' where id=$1",[schedule]);
row=(await query("select * from crm_whatsapp_reply_reminders where source_id=$1",[schedule]))[0];assert.equal(row.status,'pending');assert.equal(new Date(row.due_at)-new Date(row.sent_at),86400000);
const removed=(await query("insert into agenda_items(whatsapp_phone,whatsapp_message,whatsapp_enabled,status,whatsapp_reply_reminder) values('666666666','Cancelar ficticio',true,'pending',$1) returning id",[spec]))[0].id;
await query('delete from agenda_items where id=$1',[removed]);assert.equal((await query('select status from crm_whatsapp_reply_reminders where source_id=$1',[removed]))[0].status,'cancelled');
// Offer wrapper preserves the existing function and creates no additional sends.
const args={p_contact_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',p_manager_contact_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',p_recipient_contact_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',p_request_key:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',p_items:[],p_send_message:true};
let result=(await query('select crm_create_offer_with_reply_reminder($1,$2) as result',[args,spec]))[0].result;assert.equal(result.reply_reminder_verified,true);
await query('select crm_create_offer_with_reply_reminder($1,$2)',[args,spec]);assert.equal((await query("select count(*)::integer as n from crm_whatsapp_reply_reminders where source_kind='offer'"))[0].n,1,'idempotent retries cannot duplicate notices');
const job=(await query("select id from crm_server_automation_jobs where event_key=$1",['manual-offer:'+args.p_request_key]))[0].id;
await query("insert into crm_offer_outgoing_messages values('offer-initial',$1,$2,'initial',now())",[args.p_request_key,job]);
assert.equal((await query("select status from crm_whatsapp_reply_reminders where source_kind='offer'"))[0].status,'waiting');
await query("update crm_server_automation_jobs set status='done' where id=$1",[job]);assert.equal((await query("select status from crm_whatsapp_reply_reminders where source_kind='offer'"))[0].status,'pending');
const before=(await query('select count(*)::integer as n from crm_offer_instances'))[0].n;
await assert.rejects(query('select crm_create_offer_with_reply_reminder($1,$2)',[{...args,p_request_key:'cccccccc-cccc-cccc-cccc-cccccccccccc'},{delay_minutes:0}]),/fecha futura/);
assert.equal((await query('select count(*)::integer as n from crm_offer_instances'))[0].n,before,'invalid reminder rolls back the complete offer operation');
// RLS: the same account sees the same state on two PCs; another account sees none.
await db.exec('set role authenticated');let pc1=await query('select * from crm_list_reply_reminders()'),pc2=await query('select * from crm_list_reply_reminders()');assert.equal(pc1.length,pc2.length);assert.ok(pc1.length>0);
await query("update crm_whatsapp_reply_reminders set status='attended' where id=$1",[row.id]);assert.equal((await query('select status from crm_whatsapp_reply_reminders where id=$1',[row.id]))[0].status,'attended');
await db.exec("set test.uid='22222222-2222-2222-2222-222222222222'");assert.equal((await query('select * from crm_whatsapp_reply_reminders')).length,0);assert.equal((await query('select * from crm_list_reply_reminders()')).length,0);
await db.exec("set test.uid='11111111-1111-1111-1111-111111111111';set test.allowed='no'");await assert.rejects(prep('999999999'),/No tienes permiso/);assert.equal((await query('select * from crm_whatsapp_reply_reminders')).length,0);
await db.close();console.log('Personal reply reminders: delivery timing, cancellation, retries, atomic offers, RLS and two-PC synchronization passed (offline fixtures only).');
})().catch(e=>{console.error(e);process.exit(1)});
