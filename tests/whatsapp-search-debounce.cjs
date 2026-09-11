'use strict';
const fs=require('node:fs'),assert=require('node:assert');
const source=fs.readFileSync('js/modules/whatsapp-performance-max.js','utf8');
const core=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
const runtime=fs.readFileSync('js/modules/runtime.js','utf8');
const html=fs.readFileSync('index.html','utf8');

assert.match(source,/const waSearchIndex=new Map\(\)/,'search text must be indexed per conversation');
assert.match(source,/function waPerformanceSearchEntry\(chat\)/,'search must reuse normalized names and phones');
assert.match(source,/clearTimeout\(waSearchTimer\);waSearchTimer=setTimeout\(\(\)=>window\.renderWhatsAppChats\?\.\(\),220\)/,'typing must render once after the user pauses');
assert.doesNotMatch(source,/search\.addEventListener\('input',\(\)=>window\.renderWhatsAppChats\?\.\(\)\)/,'typing must not render synchronously for every letter');
assert.match(core,/const phoneQuery=q\.replace\(\/\\D\/g,""\)/,'the core must separate text and phone searches');
assert.equal((core.match(/phoneQuery&&waNormalizePhone\(c\.id\)\.includes\(phoneQuery\)/g)||[]).length,2,'both core renderers must reject empty phone queries');
assert.match(core,/function waHandleLiveSearch\(\)\{clearTimeout\(waLiveSearchTimer\);waLiveSearchTimer=setTimeout\(\(\)=>renderWhatsAppChats\(\),220\)\}/,'the core search must be safe before optional modules load');
assert.match(source,/removeEventListener\('input',waHandleLiveSearch\)/,'the optimized search must replace the early safe handler');
assert.match(runtime,/file==='whatsapp-performance-max\.js'\?'20260911-search-root-1'/,'runtime must force the fixed search module');
assert.match(html,/whatsapp-green-core\.js\?v=20260911-shared-history-1/,'the browser must refresh the fixed WhatsApp core');
assert.match(html,/runtime\.js\?v=20260911-search-root-1/,'the browser must refresh the runtime loader');
console.log('WhatsApp search stays indexed and debounced');
