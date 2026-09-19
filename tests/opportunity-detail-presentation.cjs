'use strict';
// Run the actual read-only detail renderer, never connect to a database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/core/20-main.js', 'utf8');
const start = source.indexOf('window.openOpportunityFull=async(id)=>{');
const end = source.indexOf('window.returnToContactFromOpportunity=', start);
assert.ok(start >= 0 && end > start);
const nodes = new Map();
const calls = [];
const escape = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opportunity = {id:'demo-opportunity',record_id:'demo-contact',client_name:'María José Demo',title:'CAMBIO DEMO',phone:'000000000',stage_id:'follow',amount:34,expected_date:'2026-09-22',updated_at:'2026-09-19T10:00:00Z',notes:'Nota de ejemplo\n<script>unsafe()</script>'};
const sandbox = {
  window:{}, salesCache:{opportunities:[opportunity],stages:[{id:'follow',name:'Seguimiento'}]},
  currentFullOpportunity:null, rememberOpportunityReturnContext(){calls.push('remember');},tpfRememberScreen(){},
  sb:{from(){throw new Error('Unexpected database access');}}, alert(){throw new Error('Unexpected alert');},
  oppVal:v=>v===null||v===undefined||v===''?'—':escape(v), fmtMoney:v=>`${v.toFixed(2)} €`,fmtDateOnly:v=>v,
  returnToContactFromOpportunity:(contact,id)=>calls.push([contact,id]),
  $(id){
    if(id==='oppFullContactLink'&&!nodes.get('oppFullContent')?.innerHTML?.includes('id="oppFullContactLink"'))return null;
    if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',classList:{remove:name=>calls.push(name)}});
    return nodes.get(id);
  }
};
vm.runInNewContext(source.slice(start,end),sandbox);
(async()=>{
  await sandbox.window.openOpportunityFull('demo-opportunity');
  assert.equal(nodes.get('oppFullTitle').textContent,'CAMBIO DEMO');
  const html=nodes.get('oppFullContent').innerHTML;
  assert.doesNotMatch(html,/<h2>/,'Title must not be repeated');
  assert.match(html,/María José Demo/);
  assert.match(html,/34.00 €/);
  assert.match(html,/2026-09-22/);
  assert.match(html,/&lt;script&gt;unsafe\(\)&lt;\/script&gt;/,'Notes remain escaped');
  assert.doesNotMatch(html,/onclick=/,'No identifiers embedded in executable HTML');
  nodes.get('oppFullContactLink').onclick();
  assert.deepEqual(calls.at(-1),['demo-contact','demo-opportunity']);
  assert.equal(sandbox.currentFullOpportunity,opportunity,'Existing edit/delete context preserved');
  opportunity.record_id=null; opportunity.notes=''; opportunity.amount=0;
  await sandbox.window.openOpportunityFull('demo-opportunity');
  assert.doesNotMatch(nodes.get('oppFullContent').innerHTML,/id="oppFullContactLink"/);
  assert.match(nodes.get('oppFullContent').innerHTML,/Sin contacto vinculado/);
  assert.match(nodes.get('oppFullContent').innerHTML,/0.00 €/);
  assert.match(nodes.get('oppFullContent').innerHTML,/todavía no tiene notas/);
  assert.ok(calls.includes('hidden'),'The existing overlay is opened');
  console.log('PASS: real detail renderer, one title, full name, amounts, dates, escaped notes, contact route and edit/delete context.');
})().catch(error=>{console.error(error);process.exitCode=1;});
