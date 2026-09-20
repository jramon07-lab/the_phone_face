const assert=require('node:assert/strict');
const L=require('../js/modules/record-links.js');
const contacts=[
{id:'manager',data:{NOMBRE:'Gestor',DNI:'11111111A',TPF_RELACIONES:{managed_contacts:[{record_id:'holder'},{record_id:'holder'}]}}},
{id:'holder',data:{NOMBRE:'Titular',DNI:'22222222B'}},
{id:'other',data:{NOMBRE:'Otro',DNI:'33333333C'}}
];
const lookup=L.index(contacts);
const current={id:'new',record_id:'holder'};
const legacy={id:'old',record_id:'manager',contract_party:{same:false,holder_dni:'22222222B',contact_dni:'11111111A'}};
assert.deepEqual([...L.opportunityContacts(current,lookup)].sort(),['holder','manager']);
assert.deepEqual([...L.opportunityContacts(legacy,lookup)].sort(),['holder','manager']);
assert.equal(L.related([current,legacy],contacts,'manager','opportunity').length,2);
assert.equal(L.related([current,legacy],contacts,'holder','opportunity').length,2);
assert.equal(L.related([current,legacy],contacts,'other','opportunity').length,0);
assert.equal(L.owner(legacy,lookup,'opportunity'),'manager','Display association changed stored ownership');
const ambiguous=L.index([...contacts,{id:'duplicate',data:{DNI:'22222222B'}}]);
assert(!L.opportunityContacts(legacy,ambiguous).has('holder'),'Ambiguous DNI must not guess holder');
assert.equal(L.opportunityContacts({...legacy,record_id:'deleted'},lookup).size,0,'Stale explicit ownership must not attach to another person');
console.log('PASS: linked holder and manager display, legacy contract, duplicate DNI, stale links');
// Exercise the real paginated reader with a contact beyond the server page limit.
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/contacts-final-fix.js','utf8');
const reader=source.slice(source.indexOf('async function allRows('),source.indexOf('async function load('));
const many=Array.from({length:1501},(_,i)=>({id:String(i)}));let pages=0;
const sandbox={sb:{from(){let start,end;const q={select(){return q},eq(){return q},order(){return q},range(a,b){start=a;end=b;return q},then(resolve){pages++;return Promise.resolve({data:many.slice(start,end+1)}).then(resolve)}};return q}}};
vm.createContext(sandbox);vm.runInContext(reader,sandbox);
sandbox.allRows('records','id,data',true).then(rows=>{assert.equal(rows.length,1501);assert.equal(rows.at(-1).id,'1500');assert.equal(pages,4);console.log('PASS: paginated reader includes contacts beyond 1000')}).catch(e=>{console.error(e);process.exitCode=1});
