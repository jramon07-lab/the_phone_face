const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/core/20-main.js','utf8');
const start=source.indexOf('async function runOpportunityAutomations('),end=source.indexOf('\n\nloadSession();',start);
assert(start>=0&&end>start);
let writes=0;const c={sb:{rpc(){writes++;throw Error('retired runner must not be called');}}};
vm.createContext(c);vm.runInContext(source.slice(start,end),c);
(async()=>{await c.runOpportunityAutomations('existing-id');await c.runOpportunityAutomations();assert.equal(writes,0);assert(!source.includes('sb.rpc("run_sales_automations_for_opportunity"'));console.log('PASS: legacy callback cannot replay server automation work');})().catch(e=>{console.error(e);process.exitCode=1});
