const assert=require('node:assert/strict'),C=require('../js/modules/document-scan-core.js');
assert(C.orientationScore('APELLIDOS NOMBRE VALIDEZ\n13 03 2029')>=6);
assert(C.orientationScore('DOMICILIO LUGAR PROVINCIA')>=6);
assert.equal(C.orientationScore(''),0);
assert.equal(C.orientationScore('123 456 789'),0);
assert.equal(C.orientationScore('unrelated text'),0);
console.log('PASS meaningful document text required for automatic orientation');
