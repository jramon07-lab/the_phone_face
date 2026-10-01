'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
const start=source.indexOf('(function syncWhatsAppLayout(){');
assert.ok(start>=0);
const code=source.slice(start,source.indexOf('\n/* ===== WhatsApp CRM Total ===== */',start));
function node(hidden=false){const names=new Set(hidden?['hidden']:[]);return {classList:{contains:x=>names.has(x),toggle(x,on){on?names.add(x):names.delete(x)}}};}
const view=node(true),app=node(true),body=node();let update;const observed=[];
vm.runInNewContext(code,{document:{body,getElementById:id=>id==='app'?app:view},MutationObserver:class{constructor(fn){update=fn}observe(el){observed.push(el)}},setTimeout(){throw Error('Layout must not wait for a timer')}});
const active=()=>body.classList.contains('wa-fullscreen-mode');
assert.equal(active(),false,'hidden WhatsApp heading must not activate its layout');
app.classList.toggle('hidden',false);update();assert.equal(active(),false);
view.classList.toggle('hidden',false);update();assert.equal(active(),true,'entry sets layout before the next paint');
view.classList.toggle('hidden',true);update();assert.equal(active(),false,'leaving restores other menus');
view.classList.toggle('hidden',false);view.classList.toggle('hidden',true);update();assert.equal(active(),false,'rapid navigation cannot leave a delayed WhatsApp layout');
view.classList.toggle('hidden',false);update();app.classList.toggle('hidden',true);update();assert.equal(active(),false,'logout restores login layout');
assert.deepEqual(observed,[view,app]);
console.log('PASS WhatsApp layout follows visible view without delayed resize or stale navigation');
