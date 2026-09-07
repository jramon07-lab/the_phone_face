'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const automatic=html.indexOf('data-wa-tab="automatic"');
const green=html.indexOf('/js/modules/whatsapp-green-core.js');

assert.ok(automatic>=0,'La pestaña Automáticos debe existir en el HTML inicial');
assert.ok(green>automatic,'La pestaña debe existir antes de que WhatsApp conecte los clics');
assert.match(html,/data-wa-tab="all">Conversaciones<\/button>\s*<button[^>]*data-wa-tab="automatic"/);
console.log('WhatsApp automatic tab is present before click handlers are bound.');
