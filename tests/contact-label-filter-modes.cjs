'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const window={TPFModules:{register(){}}};let assignments=[],fail=false,reads=0;
const sb={from(){const q={select(){return q},order(){return q},range(from,to){reads++;return Promise.resolve(fail?{error:Error('No se pudo leer')}:{data:assignments.slice(from,to+1)});}};return q;}};
const source=fs.readFileSync('js/modules/contacts-list-ui.js','utf8').replace("M.register('contacts-list-ui',","window.test={state,applyFilters,matchesLabels,copyFilters,loadAllContactLabels};M.register('contacts-list-ui',");
vm.runInNewContext(source,{window,document:{},console,sb});const api=window.test,s=api.state;
s.rows=['both','only','other','empty','unknown'].map(id=>({id,fullName:id,data:{}}));s.labels=[{id:'a',name:'Vodafone'},{id:'b',name:'VENTA'}];
assignments=[{contact_id:'both',label_id:'a'},{contact_id:'both',label_id:'b'},{contact_id:'only',label_id:'a'},{contact_id:'other',label_id:'b'},{contact_id:'unknown',label_id:'not-in-catalogue'}];
const run=(mode,labels)=>{s.filters=api.copyFilters({labelMode:mode,labels});api.applyFilters();return Array.from(s.filtered,r=>r.id);};
(async()=>{
 await api.loadAllContactLabels();
 assert.deepEqual(run('all',['a']),['both','only'],'one selected label includes contacts with extras');
 assert.deepEqual(run('exact',['a']),['only'],'exactly one label excludes extras');
 assert.deepEqual(run('all',['a','b']),['both'],'multiple selected labels are all required');
 assert.deepEqual(run('exact',['a','b']),['both']);
 assert.deepEqual(run('none',[]),['empty'],'missing catalogue entry still counts as an assigned label');
 assert.equal(run('all',[]).length,5,'no selection leaves label filtering off');
 assert.equal(api.copyFilters({labelMode:'any',labels:['a','b']}).labelMode,'any','saved searches preserve the union of selected labels');
 assert.deepEqual(run('any',['a','b']),['both','only','other'],'one or the other includes either label, even with extras');
 assert.deepEqual(run('any',['a']),['both','only']);
 assert.equal(api.matchesLabels([{id:'a'},{id:'b'}],{labelMode:'all',labels:['a'],excludeLabels:['b']}),false);
 // Applying again must see an assignment added since the previous full read.
 assignments.push({contact_id:'empty',label_id:'a'});await api.loadAllContactLabels(true);
 assert.deepEqual(run('exact',['a']),['only','empty']);assert.equal(reads,2);
 fail=true;await assert.rejects(api.loadAllContactLabels(true),/No se pudo leer/);
 assert.deepEqual(run('exact',['a']),['only','empty'],'failed refresh keeps last successful label snapshot');
 console.log('PASS contact labels: one/all/exact/none, unknown assignments, any/all saved modes, exclusions and refreshed reads');
})().catch(e=>{console.error(e);process.exitCode=1;});
