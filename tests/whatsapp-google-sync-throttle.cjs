'use strict';
const fs=require('node:fs'),assert=require('node:assert');
const source=fs.readFileSync('js/modules/contact-google-inline.js','utf8');
const html=fs.readFileSync('index.html','utf8');

assert.match(source,/const selected\s*=\s*selectedWa\(\);\s*if\s*\(selected\)\s*chats\s*=\s*\[selected\]/,'name memory must only inspect the active chat');
assert.doesNotMatch(source,/chats=\[\.\.\.\(waLiveState\?\.chats\|\|\[\]\)\]/,'Google synchronization must not traverse every chat');
assert.match(source,/function scheduleWhatsappRefresh\(delay\s*=\s*700,\s*checkGoogle\s*=\s*false\)/,'WhatsApp/Google refreshes must be debounced');
assert.match(source,/if\s*\(waRefreshRunning\)\s*\{\s*waRefreshPending\s*=\s*true;\s*return;?\s*\}/,'only one WhatsApp/Google refresh may run at a time');
assert.doesNotMatch(source,/setInterval\(\(\)=>\{[^}]*refreshWhatsapp\(\)\},5000\)/,'the full Google comparison must not run every five seconds');
assert.match(source,/scheduleWhatsappRefresh\(900,\s*false\)/,'a chat change must not download the full Google address book');
assert.match(source,/if\s*\(connected\s*&&\s*checkGoogle\)/,'Google comparison must run only when explicitly requested');
assert.match(source,/\},\s*60000\)/,'background reconciliation must be spaced to one minute');
assert.match(html,/contact-google-inline\.js\?v=/,'the browser must load the on-demand contact synchronizer');
console.log('WhatsApp and Google contact reconciliation stays deferred and single-flight');
