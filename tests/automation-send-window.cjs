// Offline: exercise the real runner with fake storage and a forbidden network.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const dir='supabase/functions/crm-automation-runner/';
let now='2026-09-25T06:06:03Z',updates=[],calls=0;
class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return new Date(now).getTime();}}
const sb={rpc:async()=>({data:{allow:true},error:null}),from(table){return {update(row){const predicates=[];const q={eq(k,v){predicates.push([k,v]);return q;},then(resolve){updates.push({table,row,predicates});resolve({error:null});}};return q;}};}};
const ctx={Date:Clock,Intl,console,Response,createClient:()=>sb,Deno:{env:{get:()=>''},serve(){}},fetch(){calls++;throw Error('Network forbidden');}};
vm.createContext(ctx);
for(const name of ['lifecycle.ts','contact-party.ts','business-time.ts','delivery-receipt.ts','index.ts']){
 const source=fs.readFileSync(dir+name,'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
 vm.runInContext(stripTypeScriptTypes(source),ctx);
}
const job={id:'test',action_type:'__send_whatsapp',attempts:2,action_config:{offer_phase:'reminder_2'},context:{trigger_type:'manual_offer',offer_instance_id:'offer'}};
const next=iso=>ctx.automaticSendWindow(job,new Date(iso))?.toISOString()||null;
assert.equal(next('2026-09-25T06:06:03Z'),'2026-09-25T08:00:00.000Z');
assert.equal(next('2026-09-25T08:00:00Z'),null);
assert.equal(next('2026-09-25T12:00:00Z'),'2026-09-25T15:30:00.000Z');
assert.equal(next('2026-09-25T18:30:00Z'),'2026-09-26T08:00:00.000Z');
assert.equal(next('2026-09-26T11:59:59Z'),null);
assert.equal(next('2026-09-26T12:00:00Z'),'2026-09-28T08:00:00.000Z');
assert.equal(next('2026-09-27T15:00:00Z'),'2026-09-28T08:00:00.000Z');
assert.equal(next('2026-10-25T08:00:00Z'),'2026-10-26T09:00:00.000Z','winter DST');
assert.equal(next('2027-03-28T08:00:00Z'),'2027-03-29T08:00:00.000Z','summer DST');
assert.equal(ctx.automaticSendWindow({...job,attempts:1,action_config:{offer_phase:'initial'}},new Date(now)),null,'manual initial offer stays immediate');
assert.equal(ctx.automaticSendWindow({...job,action_config:{offer_phase:'initial'}},new Date(now)).toISOString(),'2026-09-25T08:00:00.000Z','later retries of initial offers also respect hours');
assert.equal(ctx.automaticSendWindow({...job,action_type:'create_task'},new Date(now)),null,'internal tasks stay on time');
(async()=>{
 assert.equal(await ctx.processJob(job),'requeued');
 assert.equal(calls,0,'no provider calls outside business hours');
 assert.equal(updates.length,1,'one update, no new job');
 assert.equal(updates[0].row.run_at,'2026-09-25T08:00:00.000Z');
 assert.equal(updates[0].row.attempts,1,'waiting does not consume retries');
 assert(updates[0].predicates.some(([k,v])=>k==='status'&&v==='running'),'cannot revive cancelled jobs');
 // Provider state lookup can cross closing time. Recheck before the POST.
 now='2026-09-25T18:29:59Z';
 ctx.fetch=async url=>{assert.equal(new URL(url).searchParams.get('action'),'state');now='2026-09-25T18:30:01Z';return Response.json({state:'authorized'});};
 assert.equal(await ctx.sendGreen('34600000000@c.us','fake','fake',[],job),null);
 assert.equal(updates.at(-1).row.run_at,'2026-09-26T08:00:00.000Z');
 // Receipt verification remains ahead of the time guard: never resend a message
 // just because its confirmation arrives after closing time.
 const source=fs.readFileSync(dir+'index.ts','utf8');
 assert(source.indexOf('const delivery=await verifyGreenDelivery')<source.indexOf('if(await deferOutsideBusinessHours(job))'));
 console.log('PASS automatic send windows, overdue retry, DST, cancellation and manual offer exception');
})().catch(e=>{console.error(e);process.exitCode=1;});
