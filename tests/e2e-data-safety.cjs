const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const e2eDir=path.join(__dirname,'e2e');
const specs=fs.readdirSync(e2eDir).filter(name=>name.endsWith('.spec.js')).sort();
const directDatabaseMutation=/\.(?:insert|upsert|update|delete)\s*\(/g;

for(const name of specs){
  const source=fs.readFileSync(path.join(e2eDir,name),'utf8');
  assert.doesNotMatch(
    source,
    directDatabaseMutation,
    `${name} no puede escribir directamente en la base de datos real`
  );
}

console.log(`e2e data safety: ok (${specs.length} specs de solo lectura)`);
