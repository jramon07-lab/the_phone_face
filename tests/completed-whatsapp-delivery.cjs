'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function extract(file,name){const src=fs.readFileSync(file,'utf8'),start=src.indexOf('function '+name+'(');assert(start>=0);let pos=src.indexOf('{',start),depth=1,end=pos+1;while(depth&&end<src.length){if(src[end]==='{')depth++;if(src[end]==='}')depth--;end++;}return src.slice(start,end);}
const context={norm:v=>String(v||'').toLowerCase(),delivery:r=>r.whatsapp_delivery_status,isDue:()=>true};vm.createContext(context);
vm.runInContext(extract('js/modules/whatsapp.js','scheduledStatus')+'\n'+extract('js/modules/automation-control-center.js','statusOf')+'\n'+extract('js/modules/whatsapp-programs-pro.js','group'),context);
for(const delivery of ['pending','uncertain','error',null]){const row={status:'completed',whatsapp_delivery_status:delivery};assert.equal(context.scheduledStatus(row).key,'uncertain');assert.equal(context.statusOf('program',row),'uncertain');assert.equal(context.group(row),'error');}
const sent={status:'completed',whatsapp_delivery_status:'sent'};assert.equal(context.scheduledStatus(sent).key,'sent');assert.equal(context.statusOf('program',sent),'sent');assert.equal(context.group(sent),'completed');
const cancelled={status:'cancelled',whatsapp_delivery_status:'pending'};assert.equal(context.scheduledStatus(cancelled).key,'cancelled');assert.equal(context.statusOf('program',cancelled),'cancelled');assert.equal(context.group(cancelled),'cancelled');
const pending={status:'pending',whatsapp_delivery_status:'pending'};assert.equal(context.scheduledStatus(pending).key,'pending');assert.equal(context.statusOf('program',pending),'pending');assert.equal(context.group(pending),'due');
console.log('Completed task never implies confirmed WhatsApp delivery across three views.');
