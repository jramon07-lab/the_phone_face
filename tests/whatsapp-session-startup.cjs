const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 for(const [file,start,end,name] of [
 ['whatsapp-inbox-manual.js','async function sync(){','async function save(','sync'],
 ['whatsapp-auto-replies.js','async function loadReceipts(){','function refresh(','loadReceipts'],
 ['whatsapp-read-guard.js','async function sync(){','async function safeRead(','sync']]){
  const source=fs.readFileSync('js/modules/'+file,'utf8');const section=source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
  let queries=0;const client={auth:{getSession:async()=>({data:{session:null}})},from(){queries++;throw Error('Unexpected anonymous query')},rpc(){queries++;throw Error('Unexpected anonymous RPC')}};
  const context={db:()=>client,document:{hidden:false},loading:false,syncing:false,generation:0,console,Map,Set,M:{report(){}}};vm.createContext(context);vm.runInContext(section,context);await context[name]();assert.equal(queries,0,file+' must wait for authentication');assert.equal(context.loading,false);assert.equal(context.syncing,false);
 }
 console.log('PASS: shared inbox, reply receipts and private reads wait for login');
})();
