'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const s=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
let calls=0;
const c={waLiveState:{avatars:{},avatarPending:{}},waApi:async()=>{calls++;return {urlAvatar:'photo'}}};
vm.createContext(c);vm.runInContext(s.slice(s.indexOf('async function waLoadAvatar('),s.indexOf('async function hydrateWaAvatars(')),c);
(async()=>{
 for(const id of ['', 'status@broadcast', '120363123456789012@g.us','12345678901234567@lid'])assert.equal(await c.waLoadAvatar(id),'');
 assert.equal(calls,0,'unsupported IDs must never reach avatar endpoint');
 assert.equal(await c.waLoadAvatar('34600000000@c.us'),'photo');assert.equal(calls,1);
 assert.equal(await c.waLoadAvatar('34600000000@c.us'),'photo');assert.equal(calls,1,'valid photo is cached');
 console.log('Unsupported avatar identifiers skipped; individual photos and cache retained');
})().catch(e=>{console.error(e);process.exitCode=1});
