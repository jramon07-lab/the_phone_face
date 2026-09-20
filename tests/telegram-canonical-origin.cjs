'use strict';
const assert=require('assert');
const T=require('../lib/telegram-agenda-core');

const canonical='https://the-phone-face-app-whatsapp-fotos-y.vercel.app';
assert.equal(T.stableOrigin(),canonical);
assert.equal(T.stableOrigin('  '),canonical);
assert.equal(T.stableOrigin(' https://CRM.example:443/ '),'https://crm.example');
for(const value of ['http://crm.example','javascript:alert(1)','https://user:secret@crm.example','https://crm.example/path','https://crm.example/path/..','https://crm.example/?x=1','https://crm.example/?','https://crm.example/#','https://crm.example\\path','https:crm.example']){
  assert.throws(()=>T.stableOrigin(value),/CRM_STABLE_ORIGIN/);
}

process.env.SUPABASE_URL='https://canonical-origin-test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY='service-test';
process.env.TELEGRAM_BOT_TOKEN='bot-test';
process.env.CRON_SECRET='cron-test-secret';

const hosts=['new-deployment.example','historical-alias.example','untrusted-host.example'];
const fixedNow=Date.parse('2026-09-20T10:00:00.000Z');
const originalNow=Date.now,originalFetch=global.fetch;
Date.now=()=>fixedNow;
const response=(status,data)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(data),json:async()=>data});
async function run(handler,req){
  let result;
  const res={setHeader(){},status(code){this.statusCode=code;return this},json(body){result={status:this.statusCode,body};return this}};
  await handler(req,res);
  return result;
}

async function scenario(configuredOrigin,expectedOrigin){
  if(configuredOrigin===undefined)delete process.env.CRM_STABLE_ORIGIN;
  else process.env.CRM_STABLE_ORIGIN=configuredOrigin;
  for(const name of ['../api/telegram-agenda','../api/telegram-operations'])delete require.cache[require.resolve(name)];
  const agenda=require('../api/telegram-agenda'),operations=require('../api/telegram-operations');
  const task={id:'a1',status:'pending',title:'Tarea sintética',customer_name:'Prueba',customer_phone:'600000001',starts_at:new Date(fixedNow-1000).toISOString(),reminder_at:null,whatsapp_enabled:false};
  const event={id:10,topic:'offers',event_type:'offer_accepted',payload:{client_name:'Prueba',contact_id:'c1'},created_at:new Date(fixedNow-1000).toISOString()};
  const settings=new Map([
    ['team_notification_settings',{value:{agenda_telegram:true,telegram_chat_id:'test-chat',offers_telegram_thread_id:6}}],
    ['telegram_agenda_server_enabled_at',{value:{at:new Date(fixedNow-60000).toISOString()}}],
    ['telegram_operations_server_enabled_at',{value:{at:new Date(fixedNow-60000).toISOString()}}]
  ]);
  const taskBefore=JSON.stringify(task),eventBefore=JSON.stringify(event);
  const calls=[],writes=[];
  let webhook='https://previous-deployment.example/api/telegram-agenda';
  global.fetch=async(input,options={})=>{
    const url=new URL(String(input)),method=options.method||'GET',body=JSON.parse(options.body||'{}');
    if(url.origin==='https://api.telegram.org'){
      const name=url.pathname.split('/').pop();calls.push({name,body});
      if(name==='getWebhookInfo')return response(200,{ok:true,result:{url:webhook}});
      if(name==='setWebhook'){webhook=body.url;return response(200,{ok:true,result:true})}
      if(name==='sendMessage')return response(200,{ok:true,result:{message_id:calls.length}});
      if(['answerCallbackQuery','editMessageText','editMessageReplyMarkup'].includes(name))return response(200,{ok:true,result:true});
      throw Error('Unexpected Telegram method: '+name);
    }
    assert.equal(url.origin,'https://canonical-origin-test.supabase.co','All network calls must be mocked');
    if(url.pathname==='/rest/v1/app_settings'&&method==='GET'){
      const key=(url.searchParams.get('key')||'').replace(/^eq\./,'');
      return response(200,settings.has(key)?[{key,...settings.get(key)}]:[]);
    }
    if(url.pathname==='/rest/v1/app_settings'&&method==='POST'){
      writes.push(body);settings.set(body.key,{value:body.value});return response(201,[]);
    }
    if(url.pathname==='/rest/v1/agenda_items'&&method==='GET')return response(200,[task]);
    if(url.pathname==='/rest/v1/crm_telegram_business_events'&&method==='GET')return response(200,[event]);
    throw Error(`Unexpected mocked request: ${method} ${url.pathname}`);
  };
  const headers={authorization:'Bearer cron-test-secret',host:hosts[0]};
  const first=await run(agenda,{method:'GET',headers});
  assert.equal(first.status,200);assert.equal(first.body.sent,1);
  const initial=calls.find(call=>call.name==='sendMessage');
  const expectedCall=`${expectedOrigin}/api/telegram-call?phone=%2B34600000001`;
  assert.equal(initial.body.reply_markup.inline_keyboard.flat().find(button=>button.url)?.url,expectedCall);
  const changed=calls.filter(call=>call.name==='setWebhook');
  assert.equal(changed.length,1);
  assert.deepEqual(changed[0].body,{url:`${expectedOrigin}/api/telegram-agenda`,secret_token:T.webhookSecret('cron-test-secret'),allowed_updates:['callback_query'],drop_pending_updates:false});

  const firstOperations=await run(operations,{method:'GET',headers});
  assert.equal(firstOperations.status,200);assert.equal(firstOperations.body.sent,1);
  const operationMessage=calls.filter(call=>call.name==='sendMessage')[1];
  assert(operationMessage.body.text.includes(`${expectedOrigin}/?contact=c1`));

  const settingsBefore=JSON.stringify([...settings]),writeCount=writes.length;
  const secret=T.webhookSecret('cron-test-secret');
  for(const host of hosts){
    const nextHeaders={authorization:'Bearer cron-test-secret',host};
    const next=await run(agenda,{method:'GET',headers:nextHeaders});
    assert.equal(next.status,200);assert.equal(next.body.sent,0);assert.equal(next.body.webhookChanged,false);
    const nextOperations=await run(operations,{method:'GET',headers:nextHeaders});
    assert.equal(nextOperations.status,200);assert.equal(nextOperations.body.sent,0);
    for(const action of ['menu','reopen']){
      const callback=await run(agenda,{method:'POST',headers:{host,'x-telegram-bot-api-secret-token':secret},body:{callback_query:{id:`cb-${host}-${action}`,data:`tpf:task:${action}:a1`,message:{message_id:1,chat:{id:'test-chat'},text:'Tarea sintética'}}}});
      assert.equal(callback.status,200);
      const edited=calls.findLast(call=>call.name==='editMessageText'||call.name==='editMessageReplyMarkup');
      assert.equal(edited.body.reply_markup.inline_keyboard.flat().find(button=>button.url)?.url,expectedCall);
    }
  }
  assert.equal(calls.filter(call=>call.name==='setWebhook').length,1,'Changing invocation host must not move the webhook');
  assert.equal(calls.filter(call=>call.name==='sendMessage').length,2,'Repeated runs must preserve delivery deduplication');
  assert.equal(writes.length,writeCount,'Repeated runs and menu callbacks must not rewrite delivery state');
  assert.equal(JSON.stringify([...settings]),settingsBefore);
  assert.equal(JSON.stringify(task),taskBefore,'The origin change must preserve task status and dates');
  assert.equal(JSON.stringify(event),eventBefore);
  const beforeUnauthorized=calls.length;
  assert.equal((await run(agenda,{method:'GET',headers:{host:hosts[0]}})).status,401);
  assert.equal((await run(operations,{method:'GET',headers:{host:hosts[0]}})).status,401);
  assert.equal((await run(agenda,{method:'POST',headers:{host:hosts[0],'x-telegram-bot-api-secret-token':'wrong'},body:{}})).status,401);
  assert.equal(calls.length,beforeUnauthorized,'Unauthorized requests must not reach the provider');
}

(async()=>{
  await scenario(undefined,canonical);
  await scenario('https://configured-crm.example/','https://configured-crm.example');
  console.log('PASS Telegram canonical origin: configured/default origins, stable webhook and buttons across hosts, auth and delivery state preserved without network.');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>{Date.now=originalNow;global.fetch=originalFetch});
