'use strict';
const fs=require('node:fs'),assert=require('node:assert');
const core=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
const fixes=fs.readFileSync('js/modules/whatsapp-five-fixes.js','utf8');
const html=fs.readFileSync('index.html','utf8');

assert.match(core,/const WA_HISTORY_LIMIT=250,WA_HISTORY_LOCAL_CHATS=20,WA_CHAT_RENDER_LIMIT=250/,'history, local cache and visible conversation list must stay bounded');
assert.doesNotMatch(core,/p_limit:1500/,'opening a chat must not request 1,500 persisted messages');
assert.match(core,/p_limit:WA_HISTORY_LIMIT/,'persisted history must use the bounded limit');
assert.match(core,/const changed=waStableSig\(merged\)!==waStableSig\(waLiveState\.history\|\|\[\]\)/,'history must detect whether visible messages actually changed');
assert.match(core,/if\(changed\)\{waCacheHistory[\s\S]*?renderWaMessages/,'unchanged history must not rebuild the message DOM');
assert.doesNotMatch(core,/Promise\.all\(\[waRefreshHybridSummary\(\),waLiveState\.selected\?window\.loadWaHistory\(false\)/,'the 15-second shared sync must not reload and persist the entire selected conversation');
assert.match(core,/before!==waStableSig\(waLiveState\.chats\|\|\[\]\)/,'an unchanged summary must not rebuild the conversation list');
assert.doesNotMatch(fixes,/setInterval\(\(\)=>\{if\(!waViewVisible\(\)\)return;[^}]*patchMessages/,'the maintenance timer must not traverse every visible message repeatedly');
assert.match(html,/whatsapp-green-core\.js\?v=20260911-freeze-guard-2/,'the browser must load the lightweight WhatsApp core');
assert.match(html,/runtime\.js\?v=20260910-google-audit-1/,'the stable runtime loader must remain unchanged');
console.log('WhatsApp history and background refresh remain bounded');
