const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const api=fs.readFileSync('api/green.js','utf8');
const start=api.indexOf('      let downloadUrl=',api.indexOf('action === "file"'));
const end=api.indexOf('\n    }',start);
async function request(provider,saved){
 let result,status,cancelled=false,lookups=0;
 const context={chatId:'synthetic-chat',idMessage:'synthetic-file',id:'123',
  greenFetch:async(method,options)=>{assert.equal(method,'downloadFile');assert.equal(options.method,'POST');return provider();},
  require:()=>({savedMediaSource:async(chat,message,instance)=>{assert.equal(chat,'synthetic-chat');assert.equal(message,'synthetic-file');assert.equal(instance,'123');lookups++;return saved?{url:saved,response:{body:{cancel:async()=>cancelled=true}}}:null;}}),
  res:{status(n){status=n;return this},json(x){result=x;return x;}}
 };
 vm.createContext(context);
 await vm.runInContext('(async()=>{'+api.slice(start,end)+'})()',context);
 return {result,status,cancelled,lookups};
}
(async()=>{
 let r=await request(()=>({downloadUrl:'https://media.test/new'}));assert.equal(r.result.available,true);assert.equal(r.lookups,0);
 r=await request(()=>({downloadUrl:''}),'https://media.test/saved');assert.equal(r.result.downloadUrl,'https://media.test/saved');assert(r.cancelled);
 const missing=()=>{throw Object.assign(Error('File message encrypted url not found'),{status:400})};
 r=await request(missing,'https://media.test/saved');assert.equal(r.result.available,true);
 r=await request(missing);assert.equal(r.status,200);assert.equal(r.result.available,false);assert.equal(r.result.reason,'file_unavailable');
 await assert.rejects(request(()=>{throw Object.assign(Error('permission denied'),{status:403})}),/permission denied/);
 const client=fs.readFileSync('js/modules/whatsapp.js','utf8');
 const from=client.indexOf('        const guardedApi=async'),to=client.indexOf('        guardedApi.__tpfGreenGuard',from);
 let reads=0;
 const c={baseApi:async(action)=>{assert.equal(action,'file');reads++;return {downloadUrl:reads===1?'':'https://media.test/recovered'};}};
 vm.createContext(c);vm.runInContext(client.slice(from,to)+';this.read=guardedApi;',c);
 assert.equal((await c.read('file',{})).downloadUrl,'');
 assert.equal((await c.read('file',{})).downloadUrl,'https://media.test/recovered','A transient miss must not be cached for the entire session');
 assert.equal(reads,2);
 console.log('PASS file API: renewal, verified saved fallback, missing files, visible permission errors and no sticky client failure cache');
})().catch(e=>{console.error(e);process.exitCode=1});
