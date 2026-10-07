'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
const reminder=require('../lib/whatsapp-reply-reminder');const req={headers:{authorization:'Bearer fixture-token'}};
let calls=[];global.fetch=async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});return {ok:true,json:async()=>url.endsWith('crm_prepare_reply_reminder')?'fixture-id':true}};
assert.equal(await reminder.prepare(req,{message:'Prueba'},'34999999999@c.us'),null);assert.equal(calls.length,0,'unchecked option has no database effect');
assert.equal(await reminder.prepare(req,{message:'Prueba',replyReminder:{delay_minutes:2880}},'34999999999@c.us'),'fixture-id');assert.equal(calls[0].options.headers.Authorization,'Bearer fixture-token');assert.equal(calls[0].body.p_spec.delay_minutes,2880);
assert.deepEqual(await reminder.finish(req,'fixture-id',{idMessage:'sent-id'}),{id:'fixture-id',ok:true});assert.equal(calls[1].body.p_message_id,'sent-id');
global.fetch=async()=>({ok:false,json:async()=>({message:'Offline'})});await assert.rejects(reminder.prepare(req,{replyReminder:{delay_minutes:1}},'34999999999@c.us'),/Offline/);
const failure=await reminder.finish(req,'fixture-id',{idMessage:'sent-id'});assert.equal(failure.ok,false);assert.match(failure.error,/ya se ha enviado/);assert.match(failure.error,/No repitas/);
const context={window:{},document:{readyState:'loading',addEventListener(){},getElementById(){}},Intl,Date,Map,Set,setTimeout,setInterval,console};vm.createContext(context);vm.runInContext(fs.readFileSync('js/modules/whatsapp-reply-reminders.js','utf8'),context);
const iso=context.window.TPFReplyReminders.madridIso;
assert.equal(iso('2026-10-08T10:00'),'2026-10-08T08:00:00.000Z');assert.equal(iso('2026-12-08T10:00'),'2026-12-08T09:00:00.000Z');assert.throws(()=>iso('2027-03-28T02:30'),/no existe/);
for(const file of ['api/green.js','api/green-reply.js']){const source=fs.readFileSync(file,'utf8'),prepare=source.indexOf("whatsapp-reply-reminder').prepare"),send=source.indexOf(file.endsWith('green-reply.js')?'const r=await fetch(':'const data = await greenFetch("sendMessage"',prepare),finish=source.indexOf("whatsapp-reply-reminder').finish",send);assert.ok(prepare>0&&send>prepare&&finish>send,'save before send and arm after acknowledgment');}
console.log('Reply-reminder API optionality, authenticated persistence, send-failure safety and Madrid DST passed.');
})().catch(e=>{console.error(e);process.exit(1)});
