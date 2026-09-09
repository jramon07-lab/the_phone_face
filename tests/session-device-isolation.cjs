const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const desktop=fs.readFileSync('js/core/00-bootstrap.js','utf8'),mobile=fs.readFileSync('js/mobile-app.js','utf8');
const noop=()=>{};
async function check(kind){
 const sessions={current:true,other:true},calls=[],button={};
 const auth={signOut:async options=>{calls.push(options);sessions.current=false;if(options?.scope!=='local')sessions.other=false;return {error:null}}};
 const c={ALERT_PAGE_SIZE:30,CONTACT_PAGE_SIZE:60,sb:{auth},client:{auth,rpc:async()=>{throw Error('Synthetic permission outage')}},state:{},$:()=>button,location:{reload:noop,hash:'#/more'},window:{},showLogin:noop,stopMobileWaRefresh:noop,stopGuidedCamera:noop,closeMobileWaSheet:noop,clearTimeout:noop,mobileTemplateRequestId:0,mobileLabelRequestId:0,contactSearchTimer:0,opportunitySearchTimer:0};
 vm.createContext(c);
 if(kind==='desktop'){
  vm.runInContext(desktop.split('\n').find(x=>x.includes('$("logout").onclick=')),c);await button.onclick();
 }else{
  const start=mobile.indexOf(kind==='mobile'?'  async function signOut(){':'  async function enter(user){');
  const end=mobile.indexOf(kind==='mobile'?'\n  async function fetchAllMobileContacts()':'\n  async function signIn(',start);
  assert(start>=0&&end>start);vm.runInContext(mobile.slice(start,end),c);
  if(kind==='mobile')await c.signOut();else await c.enter({id:'synthetic-user'});
 }
 assert.equal(calls.length,1);assert.equal(sessions.current,false);
 assert.equal(sessions.other,true,kind+' must preserve the other device session');
 assert.equal(calls[0]?.scope,'local');
}
(async()=>{for(const kind of ['desktop','mobile','mobile-permission-error'])await check(kind);console.log('PASS session isolation: PC logout, mobile logout and mobile permission failure preserve the other device');})().catch(e=>{console.error(e);process.exitCode=1});
