const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
const ctx={Date,Intl};vm.createContext(ctx);vm.runInContext(stripTypeScriptTypes(fs.readFileSync('supabase/functions/crm-automation-runner/business-time.ts','utf8').replace(/^export /gm,'')),ctx);
const job={action_type:'__send_whatsapp',attempts:1,context:{installation_phase:'installation_return'}};
assert.equal(ctx.automaticSendWindow(job,new Date('2026-10-03T08:00:00Z')).toISOString(),'2026-10-05T08:00:00.000Z');
assert.equal(ctx.automaticSendWindow(job,new Date('2026-10-04T08:00:00Z')).toISOString(),'2026-10-05T08:00:00.000Z');
assert.equal(ctx.automaticSendWindow(job,new Date('2026-10-05T08:00:00Z')),null);
assert.equal(ctx.automaticSendWindow({...job,context:{installation_phase:'installation_date'}},new Date('2026-10-04T18:00:00Z')),null,'reply date questions are immediate, including Sunday');
assert.equal(ctx.automaticSendWindow({...job,context:{installation_phase:'installation_notice'}},new Date('2026-10-03T18:00:00Z')),null,'explicit processing notice is immediate');
console.log('PASS installation sends: weekday-only returns, business hours and immediate transactional questions');
