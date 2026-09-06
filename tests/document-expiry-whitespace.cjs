const assert=require('node:assert/strict'),C=require('../js/modules/document-scan-core.js');
assert.deepEqual(C.expiryDates('VALIDEZ\n\n13  03  2029'),['2029-03-13']);
assert.deepEqual(C.expiryDates('NACIMIENTO\n23 01 1977'),[]);
assert.deepEqual(C.expiryDates('VALIDEZ\n31 02 2029'),[]);
console.log('PASS expiry whitespace and unrelated date exclusions');
