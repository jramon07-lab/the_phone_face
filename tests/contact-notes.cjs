const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const nodes=new Map();
for(const id of ['cpNotesPanel','cpNotesNew','cpNotesForm','cpNotesTitle','cpNotesBody','cpNotesCancel','cpNotesSave','cpNotesStatus','cpNotesList'])nodes.set(id,{value:'',innerHTML:'',textContent:'',classList:{add(){},remove(){}},focus(){},reset(){},addEventListener(type,fn){this[type]=fn}});
let records=[{id:'old',contact_id:'c1',activity_type:'note',title:'Nota',description:'Original',created_at:'2026-09-08T10:00:00Z',crm_created_by_name:'Ramon'}];
const writes=[];
const db={auth:{getUser:async()=>({data:{user:{id:'user'}}})},from(table){assert.equal(table,'contact_activity');let patch=null,filters=[];const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},is(k,v){return q.eq(k,v)},in(k,v){filters.push(r=>v.includes(r[k]));return q},order(){return q},range(){return q},update(p){patch=p;return q},insert(p){writes.push(p);records.push({...p,id:'new'+records.length,created_at:'2026-09-08T12:00:00Z'});return Promise.resolve({error:null})},then(resolve){const data=records.filter(r=>filters.every(f=>f(r)));if(patch)data.forEach(r=>Object.assign(r,patch));resolve({data:JSON.parse(JSON.stringify(data)),error:null})}};return q}};
const c={document:{getElementById:id=>nodes.get(id),addEventListener(){}},window:{addEventListener(){}},currentContact:{id:'c1'},sb:db,confirm:()=>true,renderContactProfile:async()=>{}};
vm.createContext(c);vm.runInContext(fs.readFileSync('js/modules/contact-notes.js','utf8'),c);
const flush=()=>new Promise(r=>setImmediate(r));
(async()=>{
 await flush();assert.match(nodes.get('cpNotesList').innerHTML,/Original/);
 nodes.get('cpNotesNew').onclick();nodes.get('cpNotesTitle').value='Instalación';nodes.get('cpNotesBody').value='Llamar mañana';
 await nodes.get('cpNotesForm').onsubmit({preventDefault(){}});
 assert.equal(writes[0].contact_id,'c1');assert.equal(writes[0].title,'Instalación');
 await nodes.get('cpNotesPanel').click({target:{closest:s=>s==='[data-note-edit]'?{dataset:{noteEdit:'old'}}:null}});
 nodes.get('cpNotesTitle').value='Renombrada';nodes.get('cpNotesBody').value='Editada';
 await nodes.get('cpNotesForm').onsubmit({preventDefault(){}});
 assert.equal(records[0].description,'Editada');assert.ok(writes.some(r=>r.activity_type==='note_edited'&&r.description.includes('Original')));
 await nodes.get('cpNotesPanel').click({target:{closest:s=>s==='[data-note-delete]'?{dataset:{noteDelete:'old'}}:null}});
 assert.equal(records[0].activity_type,'note_deleted');assert.equal(records[0].description,'Editada');assert.doesNotMatch(nodes.get('cpNotesList').innerHTML,/Renombrada/);
 // A save remains scoped to the editor's original contact.
 nodes.get('cpNotesNew').onclick();nodes.get('cpNotesTitle').value='No guardar';nodes.get('cpNotesBody').value='Cambio de ficha';c.currentContact={id:'c2'};const count=writes.length;
 await nodes.get('cpNotesForm').onsubmit({preventDefault(){}});assert.equal(writes.length,count);
 console.log('PASS notes: existing data, titled create, edit audit, recoverable removal, contact isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
