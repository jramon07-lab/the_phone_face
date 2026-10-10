'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const links=require('../js/modules/record-links.js');
const window={TPFModules:{register(){}},TPFRecordLinks:links};
const source=fs.readFileSync('js/modules/contacts-list-ui.js','utf8').replace("M.register('contacts-list-ui',","window.test={state,applyFilters};M.register('contacts-list-ui',");
vm.runInNewContext(source,{window,document:{},console});
const {state,applyFilters}=window.test;
const row=(id,fullName,more={})=>({id,fullName,nickname:'',dni:'',phone:'',email:'',bank:'',source:'DATA',data:{},...more});
state.rows=[row('omar','Ómar Ortiz García',{nickname:'Encargado',dni:'GESTOR-1',phone:'600000001'}),row('pilar','Pilar Fernández'),row('a','Abelardo Delgado'),row('b','Francisco Ortiz'),row('c','Manuel Madrid'),row('d','Sin vínculo',{phone:'600000001'}),row('legacy','Gestor anterior',{data:{TPF_RELACIONES:{managed_contacts:[{record_id:'c'}]}}})];
state.opportunities=[
 {id:'1',record_id:'a',status:'won',contract_party:{holder_record_id:'a',manager_record_id:'omar'}},
 {id:'2',record_id:'omar',status:'open',contract_party:{holder_record_id:'b',manager_record_id:'omar'}},
 {id:'3',record_id:'c',status:'open',contract_party:{holder_record_id:'c',manager_record_id:'pilar'}},
 {id:'stale',record_id:'deleted',client_name:'Fantasma',phone:'600000001',status:'won'}
];
function search(q){state.filters.q=q;applyFilters();return Array.from(state.filtered,r=>r.id).sort();}
assert.deepEqual(search('omar ortiz'),['a','b','omar']);
assert.deepEqual(search('GESTOR-1'),['a','b','omar']);
assert.deepEqual(search('encargado'),['a','b','omar']);
assert.deepEqual(search('Abelardo'),['a','omar'],'another holder sharing a manager must not inherit Abelardo');
assert.deepEqual(search('Pilar Fernández'),['c','pilar']);
assert.deepEqual(search('Gestor anterior'),['c','legacy'],'an explicit contact relationship works without an opportunity');
assert.deepEqual(search('Fantasma'),[],'a deleted explicit owner cannot be recovered by a shared phone');
state.filters.oppStatus='won';assert.deepEqual(search('omar ortiz'),['a','omar'],'sales filters still apply to linked search');state.filters.oppStatus='';
state.opportunities=state.opportunities.filter(o=>o.id!=='1');assert.deepEqual(search('omar ortiz'),['b','omar'],'deleted opportunities cannot leave a stale search association');
state.opportunities[0].contract_party.manager_record_id='pilar';state.opportunities[0].record_id='b';state.salesRevision++;
assert.deepEqual(search('omar ortiz'),['omar'],'a refreshed manager role invalidates the cache');
assert.deepEqual(search('Pilar Fernández'),['b','c','pilar']);
state.rows=state.rows.map(r=>r.id==='pilar'?{...r,fullName:'Gestora actualizada'}:r);
assert.deepEqual(search('Gestora actualizada'),['b','c','pilar'],'contact reloads update names in linked searches');
assert.deepEqual(search('Pilar Fernández'),[]);
console.log('Linked contact search preserves holder/manager identity, filters and refreshes without transitive matches');
