'use strict';
const fs=require('node:fs'),assert=require('node:assert');
const core=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
const performance=fs.readFileSync('js/modules/whatsapp-performance-max.js','utf8');

assert.match(core,/function waMarkActiveChatRow\(chatId\)/,'chat selection must update only the active row');
assert.ok((core.match(/data-wa-chat-id=/g)||[]).length>=2,'core chat rows must expose a stable identity');
const selector=core.slice(core.indexOf('window.selectWhatsAppChat=async(chatId)=>{'),core.indexOf('async function loadWaHistory',core.indexOf('window.selectWhatsAppChat=async(chatId)=>{')));
assert.match(selector,/waMarkActiveChatRow\(chatId\)/,'the base selector must use the lightweight row update');
assert.doesNotMatch(selector,/renderWhatsAppChats\(\)/,'the base selector must not rebuild the conversation list');
assert.match(core,/await _selectWhatsAppChatTotal\(chatId\);[\s\S]*?waMarkActiveChatRow\(id\)/,'the extended selector must not rebuild the list after loading');
assert.match(performance,/const CHAT_PAGE_SIZE=40/,'the first conversation page must stay small on slower PCs');
assert.match(performance,/data-wa-chat-id=/,'the progressive renderer must preserve row identity');
console.log('WhatsApp chat switches update one row instead of rebuilding the conversation list');
