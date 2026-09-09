'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const edge=fs.readFileSync('supabase/functions/crm-green-webhook/index.ts','utf8');
const runner=fs.readFileSync('supabase/functions/crm-automation-runner/index.ts','utf8');
const proxy=fs.readFileSync('api/green.js','utf8');
const pure=edge.slice(edge.indexOf('function interactiveText('),edge.indexOf('Deno.serve('));
const context={};vm.createContext(context);vm.runInContext(stripTypeScriptTypes(pure),context);
for(const choice of ['No me interesa','Acepto','Quiero mirar otra cosa']){
  assert.equal(context.interactiveText({messageData:{interactiveButtonsResponse:{selectedDisplayText:choice}}}),choice);
  assert.equal(context.interactiveText({messageData:{interactiveButtonsResponse:{interactiveButtonsResponse:{selectedDisplayText:choice}}}}),choice);
}
assert.equal(context.interactiveText({messageData:{textMessageData:{textMessage:'Hola'}}}),'Hola');
assert.equal(context.incoming({typeWebhook:'incomingMessageReceived'}),true);
assert.equal(context.incoming({typeWebhook:'outgoingAPIMessageReceived'}),false);
assert.match(edge,/crm_check_runner_secret/);
assert.match(edge,/authorization/);
assert.match(edge,/typeWebhook/);
assert.match(edge,/interactiveButtonsResponse/);
assert.match(edge,/selectedDisplayText/);
assert.match(edge,/\.from\("wa_messages"\)\.insert\(row\)/);
assert.doesNotMatch(runner,/syncPendingOfferResponses|responseSync/,'runner must not continuously poll future offer replies');
assert.match(runner,/__flow_guard==="no_response"&&await hasResponseSince/,'pre-send reply guard must remain');
assert.match(proxy,/action === "setwebhook"/);
assert.match(proxy,/webhookUrlToken: `Bearer \$\{secret\}`/);
assert.match(proxy,/webhookUrlToken: data\?\.webhookUrlToken \? "configured"/,'settings response must redact webhook token');
const ensure=proxy.slice(proxy.indexOf('action === "ensure"'),proxy.indexOf('action === "setwebhook"'));
assert.doesNotMatch(ensure,/webhookUrl:\s*""/,'ensure must never erase direct webhook configuration');
console.log('Authenticated direct GREEN webhook configured; continuous polling removed; pre-send safety retained.');
