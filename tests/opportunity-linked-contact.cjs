const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('js/core/20-main.js','utf8');
const start=source.indexOf('async function findContactRecordForOpportunity(o){');
const end=source.indexOf('\n}\n\nwindow.openSalesOpportunityContact',start)+2;
assert.notEqual(start,-1,'Missing opportunity contact resolver');
assert.notEqual(end,1,'Cannot isolate opportunity contact resolver');
const resolver=source.slice(start,end);

const linked=resolver.indexOf('.eq("id",linkedContactId)');
const boundedFallback=resolver.indexOf('.limit(1000)');
assert.ok(linked>=0,'Opportunity must resolve its linked contact ID directly');
assert.ok(boundedFallback>=0,'Keep the bounded name/phone fallback for legacy opportunities');
assert.ok(linked<boundedFallback,'Linked contact ID must win before the 1,000-record fallback');
assert.match(resolver,/o\.record_id\|\|o\.contact_id\|\|o\.related_record_id/,'Use the persisted contact link before ambiguous contact fields');
console.log('PASS: linked opportunity contact resolves before bounded legacy search.');
