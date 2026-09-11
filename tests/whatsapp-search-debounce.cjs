'use strict';
const fs=require('node:fs'),assert=require('node:assert');
const source=fs.readFileSync('js/modules/whatsapp-performance-max.js','utf8');
const runtime=fs.readFileSync('js/modules/runtime.js','utf8');
const html=fs.readFileSync('index.html','utf8');

assert.match(source,/const waSearchIndex=new Map\(\)/,'search text must be indexed per conversation');
assert.match(source,/function waPerformanceSearchEntry\(chat\)/,'search must reuse normalized names and phones');
assert.match(source,/clearTimeout\(waSearchTimer\);waSearchTimer=setTimeout\(\(\)=>window\.renderWhatsAppChats\?\.\(\),220\)/,'typing must render once after the user pauses');
assert.doesNotMatch(source,/search\.addEventListener\('input',\(\)=>window\.renderWhatsAppChats\?\.\(\)\)/,'typing must not render synchronously for every letter');
assert.match(runtime,/file==='whatsapp-performance-max\.js'\?'20260911-search-debounce-1'/,'runtime must force the fixed search module');
assert.match(html,/runtime\.js\?v=20260911-search-debounce-1/,'the browser must refresh the runtime loader');
console.log('WhatsApp search stays indexed and debounced');
