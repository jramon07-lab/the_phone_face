'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');

const core=fs.readFileSync('js/modules/system-status-core.js','utf8');
const card=fs.readFileSync('js/modules/system-status.js','utf8');

assert.match(core,/function isExpectedGoogleContactsConflict\(type,message,detail\)/);
assert.match(core,/t\.includes\('409'\)[\s\S]*text\.includes\('\/api\/google-contacts\?action=proxy'\)/);
assert.match(core,/isExpectedGoogleContactsConflict\(type,message,detail\)\|\|isExpectedWhatsappTransient/);
assert.match(card,/function nonBlockingGoogleConflict\(item\)/);
assert.match(card,/filter\(row=>\{if\(nonBlockingGoogleConflict\(row\)\)return false;/);

console.log('system status ignores only safe Google Contacts 409 conflicts');
