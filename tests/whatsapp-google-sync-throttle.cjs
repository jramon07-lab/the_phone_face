'use strict';
const fs=require('node:fs'),assert=require('node:assert');
const source=fs.readFileSync('js/modules/contact-google-inline.js','utf8');
const html=fs.readFileSync('index.html','utf8');

assert.match(source,/const selected=selectedWa\(\);if\(selected\)chats=\[selected\]/,'name memory must only inspect the active chat');
assert.doesNotMatch(source,/chats=\[\.\.\.\(waLiveState\?\.chats\|\|\[\]\)\]/,'Google synchronization must not traverse every chat');
assert.match(source,/function scheduleWhatsappRefresh\(delay=700\)/,'WhatsApp/Google refreshes must be debounced');
assert.match(source,/if\(waRefreshRunning\)\{waRefreshPending=true;return\}/,'only one WhatsApp/Google refresh may run at a time');
assert.doesNotMatch(source,/setInterval\(\(\)=>\{[^}]*refreshWhatsapp\(\)\},5000\)/,'the full Google comparison must not run every five seconds');
assert.match(source,/scheduleWhatsappRefresh\(900\)/,'a chat change must schedule one deferred comparison');
assert.match(source,/\},60000\)/,'background reconciliation must be spaced to one minute');
assert.match(html,/contact-google-inline\.js\?v=20260911-whatsapp-freeze-2/,'the browser must load the throttled contact synchronizer');
console.log('WhatsApp and Google contact reconciliation stays deferred and single-flight');
