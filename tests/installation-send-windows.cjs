const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
const ctx={Date,Intl};vm.createContext(ctx);vm.runInContext(stripTypeScriptTypes(fs.readFileSync('supabase/functions/crm-automation-runner/business-time.ts','utf8').replace(/^export /gm,'')),ctx);
const job={action_type:'__send_whatsapp',attempts:4};
for(const at of ['2026-10-03T21:00:00Z','2026-10-04T08:00:00Z','2026-10-04T23:00:00Z','2026-10-05T03:00:00Z']){
 for(const phase of ['installation_return','installation_date','installation_confirmed'])assert.equal(ctx.automaticSendWindow({...job,context:{installation_phase:phase}},new Date(at)),null,phase+' immediately, including retries');
 assert.equal(ctx.automaticSendWindow({...job,context:{lifecycle:{mode:'offer_response'}}},new Date(at)),null,'offer button and reason replies immediately');
 assert(ctx.automaticSendWindow({...job,context:{lifecycle:{mode:'offer'}}},new Date(at)) instanceof Date,'commercial reminders keep their hours');
 assert(ctx.automaticSendWindow({...job,context:{lifecycle:{mode:'after_sale'}}},new Date(at)) instanceof Date,'scheduled after-sale messages keep their hours');
}
assert.equal(ctx.automaticSendWindow({...job,attempts:1,context:{installation_phase:'installation_notice'}},new Date('2026-10-03T18:00:00Z')),null,'explicit processing notice is immediate');
console.log('PASS installation and offer responses: immediate replies at night and weekends, retries, commercial window unchanged');
