const assert=require('node:assert/strict');
const C=require('../lib/whatsapp-auto-replies');
const s=C.DEFAULTS.schedule;
assert.equal(C.closure(new Date('2026-09-25T08:00:00Z'),s),null);
assert.equal(C.closure(new Date('2026-09-25T12:00:00Z'),s),'2026-09-25T14:00');
assert.equal(C.closure(new Date('2026-09-25T15:30:00Z'),s),null);
assert.equal(C.closure(new Date('2026-09-27T10:00:00Z'),s),'2026-09-26T14:00');
assert.equal(C.closure(new Date('2026-09-28T07:59:00Z'),s),'2026-09-26T14:00');
assert.equal(C.closure(new Date('2026-09-28T08:00:00Z'),s),null);
assert.equal(C.closure(new Date('2026-10-25T10:00:00Z'),s),'2026-10-24T14:00');
assert.throws(()=>C.validate({...C.DEFAULTS,schedule:Array(7).fill([])}));
assert.throws(()=>C.validate({...C.DEFAULTS,schedule:[[],[['14:00','10:00']],...s.slice(2)]}));
const date=new Date('2026-09-26T21:20:00Z');
const row={chat_id:'34600000001@c.us',id_message:'test',direction:'in',ts:date/1000-20,type_message:'textMessage',text_content:'Hola'};
assert(C.eligible(row,date,'2026-09-26T20:00:00Z'));
for(const patch of [{direction:'out'},{type_message:'audioMessage'},{chat_id:'1@g.us'},{ts:date/1000-600},{text_content:'Me interesa'}])assert(!C.eligible({...row,...patch},date,'2026-09-26T20:00:00Z'));
const RealDate=Date;global.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-09-26T21:20:00Z']))}static now(){return date.getTime()}};
Object.assign(process.env,{SUPABASE_SERVICE_ROLE_KEY:'test-service',GREEN_API_INSTANCE_ID:'test',GREEN_API_TOKEN:'test-token',CRON_SECRET:'test-cron',VERCEL_ENV:'production'});
const handler=require('../api/whatsapp-auto-replies');let records=new Map(),sends=0,fail=false,answered=false;
global.fetch=async(url,opts={})=>{let value=[];const path=url.split('/rest/v1/')[1];
 if(path?.startsWith('crm_whatsapp_reply_settings'))value=[{...C.DEFAULTS,enabled:true,enabled_since:'2026-09-26T20:00:00Z',updated_at:'v1'}];
 else if(path?.startsWith('wa_messages?direction'))value=[row];
 else if(path?.startsWith('wa_messages?chat_id'))value=answered?[{id:1}]:[];
 else if(path?.startsWith('crm_whatsapp_reply_receipts?on_conflict')){const data=JSON.parse(opts.body);if(!records.has(data.dedupe_key)){records.set(data.dedupe_key,data);value=[data];}}
 else if(path?.startsWith('crm_whatsapp_reply_receipts?dedupe_key')){Object.assign(records.get(path.split('eq.')[1]),JSON.parse(opts.body));}
 else if(url.includes('/sendMessage/')){sends++;if(fail)throw Error('timeout after possible delivery');value={idMessage:'receipt-1'};}
 else assert(path?.startsWith('crm_whatsapp_reply_receipts?created_at')||path==='wa_messages',url);
 return {ok:true,status:200,json:async()=>value};};
const call=async(secret='test-cron')=>{const result={setHeader(){},status(n){this.code=n;return this},json(v){this.body=v;return this}};await handler({method:'GET',query:{action:'cron'},headers:{authorization:'Bearer '+secret}},result);return result};
(async()=>{
 assert.equal((await call('wrong')).code,401);
 await Promise.all([call(),call()]);assert.equal(sends,1,'concurrent workers must not duplicate a reply');
 await call();assert.equal(sends,1);
 records.clear();fail=true;await call();await call();assert.equal(sends,2,'uncertain delivery must not retry');assert.equal([...records.values()][0].status,'uncertain');
 records.clear();answered=true;await call();assert.equal(sends,2,'human response prevents stale acknowledgement');
 console.log('PASS: Madrid hours/DST, eligibility, auth, concurrent dedupe, uncertain send, answered chat');
})().catch(e=>{console.error(e);process.exitCode=1});
