'use strict';
const assert=require('assert');
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY='service-test';
process.env.TELEGRAM_BOT_TOKEN='bot-test';
process.env.CRON_SECRET='cron-test-secret';

const now=Date.now(),task={id:'a1',status:'pending',title:'Llamar a Antonio',description:'Revisar oferta',customer_name:'Antonio López',customer_phone:'600333248',starts_at:new Date(now-1000).toISOString(),reminder_at:null,related_record_id:'c1',whatsapp_enabled:false};
const settings=new Map([
 ['team_notification_settings',{value:{agenda_telegram:true,telegram_chat_id:'8854110482'}}],
 ['telegram_agenda_server_enabled_at',{value:{at:new Date(now-60000).toISOString()}}]
]);
const telegramCalls=[];
global.fetch=async(url,options={})=>{
  const method=options.method||'GET',href=String(url);
  const response=(status,data)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(data),json:async()=>data});
  if(href.includes('api.telegram.org')){
    const name=href.split('/').pop(),body=JSON.parse(options.body||'{}');telegramCalls.push({name,body});
    if(name==='getWebhookInfo')return response(200,{ok:true,result:{url:'https://crm.example/api/telegram-agenda'}});
    if(name==='sendMessage')return response(200,{ok:true,result:{message_id:77}});
    return response(200,{ok:true,result:true});
  }
  const path=href.split('/rest/v1/')[1]||'';
  if(path.startsWith('app_settings?')&&method==='GET'){
    const key=decodeURIComponent((path.match(/key=eq\.([^&]+)/)||[])[1]||'');const row=settings.get(key);
    return response(200,row?[{key,...row,updated_at:new Date().toISOString()}]:[]);
  }
  if(path.startsWith('app_settings')&&method==='POST'){
    const body=JSON.parse(options.body);settings.set(body.key,{value:body.value});return response(201,[]);
  }
  if(path.startsWith('agenda_items?')&&method==='GET')return response(200,[task]);
  if(path.startsWith('agenda_items?')&&method==='PATCH'){Object.assign(task,JSON.parse(options.body||'{}'));return response(204,null);}
  if(path.startsWith('records?'))return response(200,[{id:'c1',data:{'DNI / NIF':'24053874Z'}}]);
  throw Error(`Petición no simulada: ${method} ${href}`);
};

const handler=require('../api/telegram-agenda');
function run(req){return new Promise(resolve=>{const res={statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.statusCode=code;return this},json(body){resolve({status:this.statusCode,body});return this}};handler(req,res);});}

(async()=>{
  let result=await run({method:'GET',headers:{authorization:'Bearer cron-test-secret',host:'crm.example'}});
  assert.equal(result.status,200);assert.equal(result.body.sent,1);assert.equal(result.body.failed,0);
  const sent=telegramCalls.find(call=>call.name==='sendMessage');assert(sent);
  assert.equal(sent.body.chat_id,'8854110482');
  assert.deepEqual(sent.body.reply_markup.inline_keyboard.flat().map(button=>button.text),['✅ Completar','📞 Llamar','⏰ Posponer','📅 Cambiar fecha']);
  assert.equal(sent.body.reply_markup.inline_keyboard.flat().find(button=>button.text==='📞 Llamar').url,'https://crm.example/api/telegram-call?phone=%2B34600333248');
  for(const value of ['Antonio López','600333248','24053874Z'])assert(sent.body.text.includes(value));
  const delivery=[...settings.entries()].find(([key])=>key.startsWith('telegram_delivery_agenda_main_a1_'));
  assert.equal(delivery[1].value.status,'sent');

  const secret=require('../lib/telegram-agenda-core').webhookSecret('cron-test-secret');
  result=await run({method:'POST',headers:{'x-telegram-bot-api-secret-token':secret},body:{callback_query:{id:'cb-menu',data:'tpf:task:postpone:a1',message:{message_id:77,chat:{id:8854110482},text:sent.body.text}}}});
  assert.equal(result.body.postponeMenu,true);
  assert(telegramCalls.some(call=>call.name==='editMessageReplyMarkup'&&call.body.reply_markup.inline_keyboard.flat().some(button=>button.text==='En 15 minutos')));

  const beforeSnooze=Date.now();
  result=await run({method:'POST',headers:{'x-telegram-bot-api-secret-token':secret},body:{callback_query:{id:'cb-snooze',data:'tpf:task:snooze:1h:a1',message:{message_id:77,chat:{id:8854110482},text:sent.body.text}}}});
  assert.equal(result.body.rescheduled,true);
  assert(new Date(task.starts_at).getTime()>=beforeSnooze+3599000);
  assert.equal(task.reminder_at,null);
  assert(telegramCalls.some(call=>call.name==='editMessageText'&&call.body.text.includes('⏰ POSPUESTA')));

  result=await run({method:'POST',headers:{'x-telegram-bot-api-secret-token':secret},body:{callback_query:{id:'cb-date-menu',data:'tpf:task:date:a1',message:{message_id:78,chat:{id:8854110482},text:sent.body.text}}}});
  assert.equal(result.body.dateMenu,true);
  assert(telegramCalls.some(call=>call.name==='editMessageReplyMarkup'&&call.body.reply_markup.inline_keyboard.flat().some(button=>button.text==='Mañana')));

  result=await run({method:'POST',headers:{'x-telegram-bot-api-secret-token':secret},body:{callback_query:{id:'cb-day',data:'tpf:task:day:1:a1',message:{message_id:78,chat:{id:8854110482},text:sent.body.text}}}});
  assert.equal(result.body.rescheduled,true);

  result=await run({method:'POST',headers:{'x-telegram-bot-api-secret-token':secret},body:{callback_query:{id:'cb1',data:'tpf:task:complete:a1',message:{message_id:77,chat:{id:8854110482},text:sent.body.text}}}});
  assert.equal(result.status,200);assert.equal(result.body.completed,true);assert.equal(task.status,'completed');
  assert(telegramCalls.some(call=>call.name==='answerCallbackQuery'));
  const completedEdit=telegramCalls.findLast(call=>call.name==='editMessageText');
  assert(completedEdit.body.text.endsWith('✅ COMPLETADA'));
  assert.deepEqual(completedEdit.body.reply_markup.inline_keyboard.flat().map(button=>button.text),['↩️ Reactivar tarea']);

  result=await run({method:'POST',headers:{'x-telegram-bot-api-secret-token':secret},body:{callback_query:{id:'cb-reopen',data:'tpf:task:reopen:a1',message:{message_id:77,chat:{id:8854110482},text:completedEdit.body.text}}}});
  assert.equal(result.status,200);assert.equal(result.body.reopened,true);assert.equal(task.status,'pending');
  const reopenedEdit=telegramCalls.findLast(call=>call.name==='editMessageText');
  assert(!reopenedEdit.body.text.includes('✅ COMPLETADA'));
  assert.deepEqual(reopenedEdit.body.reply_markup.inline_keyboard.flat().map(button=>button.text),['✅ Completar','📞 Llamar','⏰ Posponer','📅 Cambiar fecha']);
  console.log('PASS Telegram Agenda API: cron autenticado, envío único con datos, botón y actualización de la tarea.');
})().catch(error=>{console.error(error);process.exitCode=1});
