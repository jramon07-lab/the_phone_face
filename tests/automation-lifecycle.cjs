// Offline unit checks only: no real contacts, jobs, opportunities, or messages.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const root=require('node:path').resolve(__dirname,'..');
const runner=fs.readFileSync(root+'/supabase/functions/crm-automation-runner/index.ts','utf8');
const before=fs.readFileSync(root+'/db/proposals/automation_lifecycle_runner_before.ts','utf8');
const transport=s=>s.slice(s.indexOf('async function greenStateAuthorized'),s.indexOf('async function resolveTemplate('));
assert.equal(transport(runner),transport(before),'approved send transport must remain byte-identical');
let emitted=[],updates=[],guard={allow:true},fetches=0;
const sb={rpc:async()=>({data:guard,error:null}),from(table){return {
 upsert:async row=>{emitted.push({...row,table});return {error:null}},
 update(row){const conditions=[];const q={eq(k,v){conditions.push([k,v]);return q},select:async()=>{updates.push({table,row,conditions});return {data:[],error:null}},then(resolve){updates.push({table,row,conditions});resolve({error:null})}};return q;},
 insert:async()=>{throw Error('Unexpected insert');}
}}};
let source=runner.replace(/^import .*;\n/gm,'');
source=stripTypeScriptTypes(source)+'\nglobalThis.api={expandFlow,processJob,complete,eventBase};';
const helper=stripTypeScriptTypes(fs.readFileSync(root+'/supabase/functions/crm-automation-runner/lifecycle.ts','utf8')).replaceAll('export ','');
const businessTime=stripTypeScriptTypes(fs.readFileSync(root+'/supabase/functions/crm-automation-runner/business-time.ts','utf8')).replaceAll('export ','');
const ctx={createClient:()=>sb,Deno:{env:{get:()=>''},serve:()=>{}},fetch:()=>{fetches++;throw Error('Network forbidden')},Response,Intl,Date,console};
vm.createContext(ctx);vm.runInContext(helper+'\n'+businessTime+'\n'+source,ctx);
(async()=>{
 const action=type=>({kind:'action',action_type:type,config:{}});
 const steps=[action('record_sale_month'),{kind:'wait',value:2,unit:'days'},action('send_template'),{kind:'wait',value:5,unit:'days'},action('send_template')];
 const job={id:'fake',automation_id:'fake-rule',event_key:'stage:fake',context:{event_at:'2026-09-10T10:00:00Z',lifecycle:{mode:'after_sale'}},action_config:{steps}};
 await ctx.api.expandFlow(job);
 assert.equal(emitted.length,3);
 assert.equal(emitted[1].run_at,'2026-09-12T10:00:00.000Z','day 2 from Tramitado, not earlier Pending stage');
 assert.equal(emitted[2].run_at,'2026-09-17T10:00:00.000Z','waits accumulate: day 7');
 assert.equal(emitted[2].action_config.__previous_event,emitted[1].event_key);
 assert.equal(emitted[0].action_config.__previous_event,undefined);
 const keys=emitted.map(x=>x.event_key);emitted=[];await ctx.api.expandFlow(job);
 assert.deepEqual(emitted.map(x=>x.event_key),keys,'retry reuses deduplication keys');
 emitted=[];await ctx.api.expandFlow({...job,context:{event_at:job.context.event_at}});
 assert(emitted.every(x=>!x.action_config.__previous_event),'legacy flow scheduling preserved');
 emitted=[];guard={allow:false,reason:'Etiqueta retirada'};
 assert.equal(await ctx.api.processJob({...job,action_type:'__send_whatsapp'}),'requeued');
 assert.equal(fetches,0,'cancellation blocks all network sends');
 await ctx.api.processJob({...job,action_type:'flow_v1'});
 assert.equal(emitted.length,0,'cancelled root cannot expand into new jobs');
 guard={allow:false,retry:true,reason:'Esperando paso anterior'};
 await ctx.api.processJob({...job,attempts:4,action_type:'record_offer_month'});
 assert.equal(updates.at(-1).row.attempts,3,'dependency waits do not consume send retries');
 assert(updates.at(-1).conditions.some(([k,v])=>k==='status'&&v==='running'),'requeue cannot revive cancelled jobs');
 await ctx.api.complete(job,'done');
 assert(updates.at(-1).conditions.some(([k,v])=>k==='status'&&v==='running'),'completion cannot overwrite cancellation');
 emitted=[];guard={allow:true};
 const scheduled={...job,event_key:'stage:business',context:{event_at:'2026-09-12T15:30:00.000Z',lifecycle:{mode:'after_sale'}},action_config:{steps:[action('record_sale_month'),{kind:'wait',value:1,unit:'days',business_schedule:'phone_house'},action('send_template')]}};
 await ctx.api.expandFlow(scheduled);
 assert.equal(emitted[1].run_at,'2026-09-14T15:30:00.000Z','Saturday 17:30 Madrid skips Sunday and preserves Monday 17:30');
 emitted=[];
 await ctx.api.expandFlow({...scheduled,event_key:'stage:late',context:{event_at:'2026-09-12T20:00:00.000Z',lifecycle:{mode:'after_sale'}}});
 assert.equal(emitted[1].run_at,'2026-09-14T08:00:00.000Z','Saturday 22:00 Madrid moves to Monday 10:00');
 assert.equal(ctx.nextBusinessSendAt(new Date('2026-09-08T14:00:00.000Z'),1).toISOString(),'2026-09-09T15:30:00.000Z','16:00 Madrid moves to 17:30 next day');
 assert.equal(ctx.nextBusinessSendAt(new Date('2026-09-06T10:00:00.000Z'),3,'months').toISOString(),'2026-12-07T11:00:00.000Z','three calendar months landing on Sunday moves to Monday and preserves 12:00 Madrid');
 assert.equal(ctx.madridDateAfter(new Date('2028-02-29T10:00:00.000Z'),1,'years'),'2029-02-28','annual review clamps leap day safely');
 console.log('PASS: transport preserved; stage timing; ordered actions; deduplication; cancellation; retries; legacy compatibility. No network or real-data writes.');
})().catch(e=>{console.error(e);process.exitCode=1});
