const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={TPFModules:{register(){}}};let calls=0,fail=false,hold=null;
const assignments=Array.from({length:2501},(_,i)=>({contact_id:String(i),label_id:'a'}));
const sb={from(table){assert.equal(table,'crm_contact_labels');return {select(){return this},order(){return this},async range(a,b){calls++;if(hold)await hold;if(fail)return {error:new Error('offline')};return {data:assignments.slice(a,b+1)};}}}};
vm.runInNewContext(fs.readFileSync('js/modules/contacts-list-ui.js','utf8').replace("M.register('contacts-list-ui',","window.test={state,loadAllContactLabels};M.register('contacts-list-ui',"),{window,document:{},console,sb});
const {state,loadAllContactLabels}=window.test;
state.rows=Array.from({length:2600},(_,i)=>({id:String(i)}));state.labels=[{id:'a',name:'A'}];
(async()=>{
 await Promise.all([loadAllContactLabels(),loadAllContactLabels()]);
 assert.equal(calls,6,'2501 assignments need six paginated reads, shared across callers');
 assert.equal(state.labelsByContact.get('2500')[0].id,'a');assert.equal(state.labelsByContact.get('2599').length,0);
 assert.equal(state.labelsAllLoaded,true);
 state.labelsAllLoaded=false;fail=true;const previous=state.labelsByContact;
 await assert.rejects(loadAllContactLabels(),/offline/);assert.equal(state.labelsAllLoaded,false);assert.equal(state.labelsByContact,previous);assert.equal(previous.get('0')[0].id,'a');
 fail=false;let release;hold=new Promise(r=>release=r);const pending=loadAllContactLabels();
 state.rows=[{id:'new'}];state.labelsByContact=new Map();release();await pending;
 assert.equal(state.labelsAllLoaded,false);assert.equal(state.labelsByContact.size,0,'stale response must not replace fresh contact labels');
 console.log('Batch labels: pagination, shared reads, failure preservation and stale response checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
