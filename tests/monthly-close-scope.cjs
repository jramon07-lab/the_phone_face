const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/monthly-close.js','utf8').replace("M.register('monthly-close',{install(){mount();window.addEventListener('tpf:sales-updated',mount);setInterval(mount,1000)}});","window.test={board,moveSelected,formatDay,processedDate,processingDay};");
const writes=[],ctx={window:{TPFModules:{}},Intl,console,salesCache:{stages:[{id:'t',name:'Tramitado'},{id:'p',name:'Pendiente de tramitar'},{id:'w',name:'Ganado'}],opportunities:[{id:'a',stage_id:'t',expected_date:'2027-09-25'},{id:'b',stage_id:'p'}]},sb:{from:()=>({update:patch=>({eq:async(key,id)=>{writes.push({key,id,patch});return{}}})})}};
vm.runInNewContext(source,ctx);const api=ctx.window.test;
assert.deepEqual(Array.from(api.board().tramitado,x=>x.id),['a']);assert.deepEqual(Array.from(api.board().pending,x=>x.id),['b']);
assert.equal(api.formatDay('2027-09-25'),'25/09/2027');assert.equal(api.processedDate(ctx.salesCache.opportunities[0]),'','Never substitute the annual review for the processing date');
assert.equal(api.processingDay('2026-09-30T22:30:00Z'),'2026-10-01','Processing month uses Madrid time');
api.moveSelected(['a'],ctx.salesCache.stages).then(()=>{assert.deepEqual(writes.map(x=>({id:x.id,keys:Object.keys(x.patch),stage:x.patch.stage_id})),[{id:'a',keys:['stage_id','position'],stage:'w'}]);console.log('Monthly close excludes pending processing and preserves dates');}).catch(e=>{console.error(e);process.exitCode=1});
