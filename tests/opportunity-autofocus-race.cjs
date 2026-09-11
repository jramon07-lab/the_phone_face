const assert=require('node:assert/strict');
const fs=require('node:fs');

const files=[
  'js/modules/contacts-sales-core.js',
  'js/core/20-main.js'
];

for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  assert.match(
    source,
    /const active=document\.activeElement;\s*if\(active&&active!==title&&modal\.contains\(active\)\)return;\s*title\.focus\(\);/,
    `${file} must not steal focus after another opportunity field is being edited`
  );
  assert.doesNotMatch(
    source,
    /setTimeout\(\(\)=>\$\("oppModalTitle"\)\?\.focus\(\),50\)/,
    `${file} must not use the unsafe delayed title autofocus`
  );
}

console.log('Opportunity autofocus race regression checks passed');
