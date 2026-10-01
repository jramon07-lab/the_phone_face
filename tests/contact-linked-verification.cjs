const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/modules/contact-google-inline.js','utf8');
let confirmed=0;
const context={googleContactsConnected:()=>true,contactData:row=>({phone:'611111111'}),phone:v=>String(v).replace(/\D/g,'').slice(-9),safe:v=>String(v||''),savedVerification:row=>row.data.verified,contactChat:()=>({id:'34611111111@c.us'}),waLiveState:{chats:[{id:'34611111111@c.us'}]},searchGoogle:async()=>[{resourceName:'people/c1'}],confirmThreeWayVerified:async()=>{confirmed++;return{};},rememberUnifiedName(){},clearGoogleCache(){},window:{dispatchEvent(){}},CustomEvent:class{},console};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('  async function autoConfirmCreatedWhatsapp'),source.indexOf('  const automaticVerificationChecks')),context);
(async()=>{
 await context.autoConfirmCreatedWhatsapp({id:'one',data:{TPF_WHATSAPP_CHAT_ID:'34611111111@c.us'}});
 assert.equal(confirmed,1,'a WhatsApp link must not prevent real verification');
 await context.autoConfirmCreatedWhatsapp({id:'one',data:{verified:true}});
 assert.equal(confirmed,1,'already verified contacts need no repeat');
 context.searchGoogle=async()=>[{},{ }];
 await context.autoConfirmCreatedWhatsapp({id:'one',data:{}});
 assert.equal(confirmed,1,'ambiguous Google contacts must not be marked verified');
 assert.match(source,/await verifyGoogleSaved\(saved,[\s\S]*?await autoConfirmCreatedWhatsapp\(row\)/);
 console.log('PASS linked contact verification and Google ambiguity protection');
})().catch(e=>{console.error(e);process.exitCode=1;});
