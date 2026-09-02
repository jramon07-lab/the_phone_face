const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const css=fs.readFileSync(path.join(__dirname,'../assets/mobile.css'),'utf8');
assert.match(css,/\.m-view\{[^}]*overflow-x:hidden;[^}]*overflow-y:auto/);
assert.match(css,/\.m-page\{[^}]*min-width:0;[^}]*max-width:100%/);
assert.match(css,/\.m-form-grid\{[^}]*min-width:0;[^}]*max-width:100%/);
assert.match(css,/\.m-login input,\.m-input,\.m-select,\.m-textarea\{[^}]*width:100%;min-width:0;max-width:100%/);
assert.match(css,/\.m-task-actions button\{[^}]*min-width:0;[^}]*white-space:normal/);

console.log('mobile horizontal layout guard: ok');
