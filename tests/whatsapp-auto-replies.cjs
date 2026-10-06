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
const handler=require('../api/whatsapp-auto-replies');let records=new Map(),sends=0,fail=false,answered=false,phoneAnswered=false,historyFails=false,historyMissing=false,transactional=false,rpcFails=false,recentManual=false,previousReply=false,automatic=false,classificationFails=false;
global.fetch=async(url,opts={})=>{let value=[];const path=url.split('/rest/v1/')[1];
 if(path?.startsWith('crm_whatsapp_reply_settings'))value=[{...C.DEFAULTS,enabled:true,enabled_since:'2026-09-26T20:00:00Z',updated_at:'v1'}];
 else if(path==='rpc/crm_whatsapp_transactional_replies'){if(rpcFails)throw Error('classification unavailable');value=transactional?[{incoming_id:row.id_message}]:[];}
 else if(path?.startsWith('crm_whatsapp_manual_activity'))value=recentManual?[{chat_id:row.chat_id}]:[];
 else if(path?.startsWith('crm_server_automation_jobs?')){if(classificationFails)throw Error('automatic receipts unavailable');value=automatic?[{action_config:{__delivery_receipt:{idMessage:'previous-outgoing'}}}]:[];}
 else if(path?.startsWith('agenda_items?whatsapp_provider_message_id'))value=[];
 else if(path?.startsWith('crm_whatsapp_reply_receipts?chat_id'))value=[];
 else if(path?.startsWith('wa_messages?direction'))value=[row];
 else if(path?.startsWith('wa_messages?chat_id'))value=answered?[{id:1}]:[];
 else if(path?.startsWith('crm_whatsapp_reply_receipts?on_conflict')){const data=JSON.parse(opts.body);if(!records.has(data.dedupe_key)){records.set(data.dedupe_key,data);value=[data];}}
 else if(path?.startsWith('crm_whatsapp_reply_receipts?dedupe_key')&&opts.method==='GET')value=records.has(path.split('eq.')[1].split('&')[0])?[{}]:[];
 else if(path?.startsWith('crm_whatsapp_reply_receipts?dedupe_key')){Object.assign(records.get(path.split('eq.')[1]),JSON.parse(opts.body));}
 else if(url.includes('/getChatHistory/')){if(historyFails)throw Error('unavailable');value=historyMissing?[]:[{idMessage:row.id_message,type:'incoming',timestamp:row.ts},...(phoneAnswered?[{idMessage:'manual-phone',type:'outgoing',timestamp:row.ts+1}]:[]),...(previousReply?[{idMessage:'previous-outgoing',type:'outgoing',timestamp:row.ts-65,typeMessage:'quotedMessage',sendByApi:true,statusMessage:'read'}]:[])];}
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
 answered=false;fail=false;phoneAnswered=true;await call();assert.equal(sends,2,'native phone response prevents stale acknowledgement');
 phoneAnswered=false;historyFails=true;await call();assert.equal(sends,2,'unavailable provider history must fail closed');
 historyFails=false;historyMissing=true;await call();assert.equal(sends,2,'incomplete history must fail closed');
 historyMissing=false;await call();assert.equal(sends,3,'unanswered verified incoming message receives acknowledgement');
 records.clear();transactional=true;await call();assert.equal(sends,3,'bot-handled written reasons and return replies must not send absence, even before the bot sends');assert.equal(records.size,0);
 transactional=false;rpcFails=true;const unavailable=await call();assert.equal(sends,3,'an unavailable classification must not send a competing absence');assert.equal(unavailable.code,503);rpcFails=false;await call();assert.equal(sends,4,'ordinary unanswered enquiries keep the absence message');
 records.clear();recentManual=true;await call();assert.equal(sends,4,'recent manual activity suppresses absence before incoming');recentManual=false;await call();assert.equal(sends,5,'automatic traffic does not open human window');
 records.clear();previousReply=true;await call();assert.equal(sends,5,'quoted reply BEFORE incoming still suppresses absence when the manual activity receipt is missing');assert.equal(records.size,0);
 classificationFails=true;await call();assert.equal(sends,5,'unavailable automatic classification fails closed without sending');classificationFails=false;
 automatic=true;await call();assert.equal(sends,6,'positively identified automatic traffic does not open a human conversation');
 const history=[{idMessage:'human',type:'outgoing',timestamp:row.ts-65,sendByApi:false,statusMessage:'read'}];
 assert(C.recentConversation(history,row,date),'native-phone manual answer before incoming suppresses absence');
 assert(C.recentConversation([{...history[0],sendByApi:true,typeMessage:'textMessage'}],row,date),'manual CRM text is protected even without its database receipt');
 assert(!C.recentConversation([{...history[0],timestamp:row.ts-7201}],row,date),'old activity expires');
 for(const patch of [{statusMessage:'failed'},{statusMessage:'pending'},{statusMessage:'yellowCard'},{isDeleted:true},{timestamp:date/1000+60},{type:'incoming'}])assert(!C.recentConversation([{...history[0],...patch}],row,date),'failed, pending, deleted, future and incoming messages do not open the window');
 assert(!C.recentConversation(history,row,date,new Set(['human'])),'known automatic receipt is excluded');
 console.log('PASS: Madrid hours/DST, eligibility, auth, concurrent dedupe, uncertain send, answered chat');
})().catch(e=>{console.error(e);process.exitCode=1});
