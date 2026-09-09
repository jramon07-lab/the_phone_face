const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
for(const file of ['js/modules/whatsapp-green-core.js','js/mobile-app.js','supabase/functions/crm-automation-runner/index.ts']){
 const source=fs.readFileSync(file,'utf8');
 const helper=source.slice(source.indexOf('function crmInteractiveText('),source.indexOf('\n}',source.indexOf('function crmInteractiveText('))+2);
 const ctx={};vm.createContext(ctx);vm.runInContext(helper,ctx);
 for(const choice of ['No me interesa','Acepto','Quiero mirar otra cosa']){
   for(const body of [{interactiveButtonsResponse:{selectedDisplayText:choice}},{interactiveButtonsResponse:{interactiveButtonsResponse:{selectedDisplayText:choice},quotedMessage:{text:'Wrong quoted offer'}}}]){
     assert.equal(ctx.crmInteractiveText(body),choice,file);
     assert.equal(ctx.crmInteractiveText({messageData:body}),choice,file);
   }
 }
 const card={contentText:'Oferta 32 €/mes',buttons:[{buttonText:'Acepto'},{buttonText:'No me interesa'}]};
 assert.equal(ctx.crmInteractiveText({interactiveButtons:card}),'Oferta 32 €/mes\nAcepto\nNo me interesa');
 assert.equal(ctx.crmInteractiveText({messageData:{interactiveButtonsReply:card}}),'Oferta 32 €/mes\nAcepto\nNo me interesa');
 assert.equal(ctx.crmInteractiveText({textMessage:'ordinary'}),'');
}
console.log('Interactive offer text and all three replies: PC, mobile, runner passed.');
