const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const css=fs.readFileSync(path.join(__dirname,'../assets/mobile.css'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../js/mobile-app.js'),'utf8');
assert.match(css,/\.m-view\{[^}]*overflow-x:hidden;[^}]*overflow-y:auto/);
assert.match(css,/\.m-page\{[^}]*min-width:0;[^}]*max-width:100%/);
assert.match(css,/\.m-form-grid\{[^}]*min-width:0;[^}]*max-width:100%/);
assert.match(css,/\.m-login input,\.m-input,\.m-select,\.m-textarea\{[^}]*width:100%;min-width:0;max-width:100%/);
assert.match(css,/\.m-task-actions button\{[^}]*min-width:0;[^}]*white-space:normal/);
assert.match(css,/\.m-task-card\{[^}]*min-width:0;[^}]*max-width:100%/);
assert.match(css,/\.m-task-card \.m-list-row\{[^}]*grid-template-columns:42px minmax\(0,1fr\);[^}]*min-width:0;[^}]*max-width:100%/);
assert.match(css,/\.m-task-card \.m-badge\{[^}]*grid-column:2;[^}]*max-width:100%;[^}]*white-space:nowrap/);
assert.match(app,/class="m-list-card m-task-card"/);
assert.match(css,/\.m-task-filters\{[^}]*grid-template-columns:repeat\(6,minmax\(0,1fr\)\);[^}]*min-width:0;[^}]*max-width:100%/);
assert.match(css,/\.m-task-filter\{[^}]*grid-column:span 2;[^}]*min-width:0;[^}]*overflow:hidden;[^}]*white-space:nowrap/);
assert.match(css,/\.m-task-filter:nth-child\(n\+4\)\{grid-column:span 3\}/);

console.log('mobile horizontal layout guard: ok');
