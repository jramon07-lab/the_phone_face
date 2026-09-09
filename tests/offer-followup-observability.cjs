const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const migration=read('supabase/migrations/20260909153000_offer_followup_observability.sql');
const indexes=read('supabase/migrations/20260909154500_offer_followup_fk_indexes.sql');
const runner=read('supabase/functions/crm-automation-runner/index.ts');
const webhook=read('supabase/functions/crm-green-webhook/index.ts');
const desktop=read('js/modules/system-monitoring.js');
const mobileSystem=read('js/mobile-system-monitor.js');
const mobile=read('js/mobile-app.js');
const offers=read('js/modules/offers-pro.js');

assert.match(migration,/create table if not exists public\.crm_offer_followup_events/);
assert.match(migration,/alter table public\.crm_offer_followup_events enable row level security/);
assert.match(migration,/current_user_is_admin\(\)[\s\S]*current_user_can\('can_view_sales'\)/);
assert.match(migration,/create or replace function public\.crm_list_offer_followup_events/);
assert.match(migration,/create or replace function public\.crm_offer_followup_latest/);
assert.match(migration,/'response_cancelled','success'/);
const incoming=migration.match(/create or replace function crm_private\.lifecycle_incoming\(\)[\s\S]*?\$\$;/i)?.[0]||'';
assert.match(incoming,/set status='cancelled'/);
assert.match(incoming,/insert into public\.crm_offer_followup_events/);
assert.doesNotMatch(incoming,/update\s+public\.sales_opportunities/i);
assert.doesNotMatch(incoming,/stage_id\s*=/i);
for(const column of ['contact_id','user_id','job_id'])assert.match(indexes,new RegExp(`crm_offer_followup_events\\(${column}\\)`));

for(const event of ['pre_send_blocked','verification_deferred','delivery_deferred','followup_failed','followup_sent'])assert.match(runner,new RegExp(`auditFollowup\\(job,"${event}"`));
assert.match(runner,/if\(a\.__flow_guard==="no_response"&&await hasResponseSince/);
assert.match(runner,/await requeue\(job,msg,5,true\)/);
assert.match(runner,/await requeue\(job,msg,2\)/);

assert.match(webhook,/async function recordFailure/);
assert.match(webhook,/from\("crm_system_events"\)/);
assert.match(webhook,/\[REDACTADO\]/);
assert.match(webhook,/interactiveButtonsResponse/);

for(const source of [desktop,mobileSystem]){
  assert.match(source,/crm_list_offer_followup_events/);
  assert.match(source,/Seguimientos de WhatsApp/);
  assert.match(source,/no mueve oportunidades|no mueve las oportunidades|nunca mueve la oportunidad/i);
}
assert.match(offers,/crm_offer_followup_latest/);
assert.match(offers,/oppFollowupAudit/);
assert.match(offers,/oppFullFollowupAudit/);
assert.match(mobile,/mobileOpportunityFollowup/);
assert.match(mobile,/Movimiento de columna','No automático/);

console.log('offer follow-up observability and no-auto-move guard: ok');
