'use strict';
const assert=require('assert');
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY='service-test';
process.env.TELEGRAM_BOT_TOKEN='bot-test';
process.env.CRON_SECRET='cron-test-secret';

const fixedNow=new Date('2026-09-11T18:31:00.000Z').getTime(),realNow=Date.now;Date.now=()=>fixedNow;
const settings=new Map([
  ['team_notification_settings',{value:{telegram_chat_id:'8854110482',whatsapp_telegram:true,whatsapp_telegram_thread_id:5,incidents_telegram_thread_id:8,daily_summary_telegram_thread_id:9}}],
  ['telegram_operations_server_enabled_at',{value:{at:new Date(fixedNow-60000).toISOString()}}]
]);
const manual={id:'m1',status:'pending',whatsapp_enabled:true,customer_name:'Ana',customer_phone:'600000001',whatsapp_phone:'600000001',whatsapp_message:'Hola Ana',whatsapp_scheduled_at:new Date(fixedNow-1000).toISOString(),whatsapp_delivery_status:'pending'};
const failed={id:'f1',action_type:'__send_whatsapp',status:'failed',action_config:{text:'Mensaje automático'},context:{contact_name:'Luis',phone:'611111111'},error_message:'Proveedor no disponible',updated_at:new Date(fixedNow-2000).toISOString()};
const done={id:'d1',action_type:'send_template',status:'done',action_config:{template_id:'t1'},context:{contact_name:'Eva',phone:'622222222'},completed_at:new Date(fixedNow-3600000).toISOString()};
const telegramCalls=[];
global.fetch=async(url,options={})=>{
  const method=options.method||'GET',href=String(url),response=(status,data)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(data),json:async()=>data});
  if(href.includes('api.telegram.org')){const body=JSON.parse(options.body||'{}');telegramCalls.push(body);return response(200,{ok:true,result:{message_id:telegramCalls.length}})}
  const path=href.split('/rest/v1/')[1]||'';
  if(path.startsWith('app_settings?')&&method==='GET'){const key=decodeURIComponent((path.match(/key=eq\.([^&]+)/)||[])[1]||'');const row=settings.get(key);return response(200,row?[{key,...row}]:[])}
  if(path.startsWith('app_settings')&&method==='POST'){const body=JSON.parse(options.body);settings.set(body.key,{value:body.value});return response(201,[])}
  if(path.startsWith('agenda_items?'))return response(200,[manual]);
  if(path.startsWith('crm_server_automation_jobs?'))return response(200,path.includes('status=eq.done')?[done]:[failed]);
  if(path.startsWith('whatsapp_templates?'))return response(200,[{id:'t1',name:'Saludo',body:'Hola desde plantilla'}]);
  throw Error(`Petición no simulada: ${method} ${href}`);
};
const handler=require('../api/telegram-operations');
function run(req){return new Promise(resolve=>{const res={setHeader(){},status(code){this.statusCode=code;return this},json(body){resolve({status:this.statusCode,body});return this}};handler(req,res)})}
(async()=>{
  const unauthorized=await run({method:'GET',headers:{}});assert.equal(unauthorized.status,401);
  const result=await run({method:'GET',headers:{authorization:'Bearer cron-test-secret'}});
  assert.equal(result.status,200);assert.equal(result.body.ok,true);assert.equal(result.body.manual,1);assert.equal(result.body.incidents,1);assert.equal(result.body.daily,1);
  assert.deepEqual(telegramCalls.map(call=>call.message_thread_id),[5,8,9]);
  assert(telegramCalls[0].text.includes('WhatsApp programado'));assert(telegramCalls[1].text.includes('Proveedor no disponible'));
  assert(telegramCalls[2].text.includes('WhatsApp automáticos enviados: 1'));assert(telegramCalls[2].text.includes('WhatsApp manuales pendientes: 1'));
  const again=await run({method:'GET',headers:{authorization:'Bearer cron-test-secret'}});assert.equal(again.body.sent,0,'No debe duplicar entregas');
  console.log('PASS Telegram operaciones API: rutas por tema, resumen y deduplicación.');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>{Date.now=realNow});
