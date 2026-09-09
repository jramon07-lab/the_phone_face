const assert=require('node:assert/strict');
const fs=require('node:fs');
const B=require('../lib/crm-backup-core');
const observed=JSON.parse(fs.readFileSync('docs/crm-audit/database-inventory.json','utf8')).tables.filter(t=>t.schema==='public');
const missing=observed.filter(t=>!B.TABLES.includes(t.table)&&!Object.hasOwn(B.EXCLUDED,t.table));
assert.deepEqual(missing.map(t=>t.table),[],'Every observed public table must be included or explicitly excluded');
for(const row of observed.filter(t=>B.TABLES.includes(t.table))){
 assert.deepEqual(B.PRIMARY_KEYS[row.table]||['id'],row.primary_key,'Pagination must use the actual primary key: '+row.table);
}
console.log('PASS backup coverage against live schema inventory, including pagination keys');
