'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(path){let calls=0,release,fail=false;const wait=new Promise(r=>release=r);const window={TPFModules:{register(){}},async crmGetContactLabels(id){calls++;await wait;if(fail)throw Error('offline');return [{id:'old',name:id}]}};const source=fs.readFileSync(path,'utf8').replace("M.register('contacts-list-ui',","window.test={state,getContactLabels};M.register('contacts-list-ui',");vm.runInNewContext(source,{window,document:{},console});return {...window.test,release,get calls(){return calls},fail(){fail=true}};}
(async()=>{
 const h=harness('js/modules/contacts-list-ui.js');const jobs=[];
 for(let frame=0;frame<4;frame++)for(let id=0;id<25;id++)jobs.push(h.getContactLabels(String(id)));
 assert.equal(h.calls,25,'four renders must share 25 reads rather than start 100');
 h.state.labelsByContact.set('0',[{id:'new'}]);h.release();await Promise.all(jobs);assert.equal(h.state.labelsByContact.get('0')[0].id,'new','late response must not undo an edit');
 await h.getContactLabels('1');assert.equal(h.calls,25);
 const g=harness('js/modules/contacts-list-ui.js');const old=g.getContactLabels('a');g.state.labelsByContact=new Map();const fresh=g.getContactLabels('a');assert.equal(g.calls,2,'new snapshot must get a fresh request');g.release();await Promise.all([old,fresh]);assert.equal(g.state.labelsByContact.get('a')[0].id,'old');
 const f=harness('js/modules/contacts-list-ui.js');f.fail();f.release();await f.getContactLabels('a');assert.equal(f.state.labelsByContact.has('a'),false);await f.getContactLabels('a');assert.equal(f.calls,2,'errors must remain retryable');
 console.log('PASS shared label reads, newer edits, reload isolation and retry after failure');
})().catch(e=>{console.error(e);process.exitCode=1});
