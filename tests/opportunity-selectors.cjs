const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let version='v1',calls=[];const q={select(){return q},eq(){return q},single:async()=>({data:{id:'op',updated_at:version}})};
const context={document:{readyState:'loading',addEventListener(){},getElementById(){}},window:{addEventListener(){},TPFHomeManage:{openOpportunity:async(id,options)=>calls.push(['manage',id,options.stage])},moveOpp:async(id,stage)=>{calls.push(['move',id,stage]);return true;}},sb:{from:()=>q}};
vm.createContext(context);vm.runInContext(fs.readFileSync('js/modules/opportunity-contract-details.js','utf8'),context);const api=context.window.TPFOpportunityDetails;
(async()=>{
 const o={id:'op',stage_id:'current',updated_at:'v1'},ctx={ready:true,offer:{status:'accepted'}};
 for(const name of ['Seguimiento','Pendiente de tramitar','Tramitado','Perdido']){calls=[];assert.equal(await api.changeColumn(o,{id:'next',name},ctx),false);assert.deepEqual(calls,[['manage','op',name.toLowerCase()]]);}
 calls=[];await assert.rejects(api.changeColumn(o,{id:'won',name:'Ganado'},ctx),/Excel/);assert.equal(calls.length,0);
 await assert.rejects(api.changeColumn({...o,installation_date:'2026-09-01'},{id:'next',name:'Perdido'},ctx),/Excel/);
 await assert.rejects(api.changeColumn(o,{id:'next',name:'Tramitado'},{ready:false}),/comprobación/);
 version='v2';await assert.rejects(api.changeColumn(o,{id:'next',name:'Perdido'},ctx),/otro dispositivo/);assert.equal(calls.length,0);version='v1';
 assert.equal(await api.changeColumn(o,{id:'next',name:'Próximo'},ctx),true);assert.deepEqual(calls,[['move','op','next']]);calls=[];
 assert.equal(await api.changeColumn(o,{id:'next',name:'Tramitado'},{ready:true}),true);assert.deepEqual(calls,[['move','op','next']]);
 assert.equal(await api.changeColumn(o,{id:'current',name:'Tramitado'},ctx),false);
 assert.match(api.operatorChoices('Yoigo'),/value="Yoigo" selected/);assert.match(api.operatorChoices('New & Company'),/value="__other" selected/);assert.match(api.operatorChoices(''),/value=""/);
 console.log('PASS opportunity selectors: shared management routes, legacy move flow, Excel locks, stale edits and existing/custom operators');
})().catch(e=>{console.error(e);process.exit(1)});
