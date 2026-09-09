const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const enhancements=fs.readFileSync('js/core/30-enhancements.js','utf8');
const start=enhancements.indexOf('function waTaskContext(contactId)');
const end=enhancements.indexOf('\n  async function refreshTasks()',start);
assert.ok(start>0&&end>start,'WhatsApp task renderer context helpers are present');

let releasePeople;
const peoplePending=new Promise(resolve=>{releasePeople=resolve});
const elements={
  waSideTasks:{innerHTML:'current chat tasks'},
  waSideTaskCount:{textContent:'9'},
  waSideViewTasks:{classList:{add(){},toggle(){}}}
};
const query={
  select(){return this},eq(){return this},or(){return this},order(){return this},
  async range(){return {data:[{id:'task-a',title:'Only A',status:'pending'}],error:null}}
};
const context={
  waLiveState:{selected:{id:'chat-a'},contact:{id:'contact-a'},selectionVersion:1},
  byId:id=>elements[id]||null,
  sb:{from(){return query}},
  window:{TPFRecordLinks:{load:()=>peoplePending,related:rows=>rows}},
  console
};
vm.createContext(context);
vm.runInContext(`${enhancements.slice(start,end)};this.renderWaTasks=renderWaTasks;this.waTaskContext=waTaskContext`,context);

(async()=>{
  const rendering=context.renderWaTasks(context.waTaskContext());
  context.waLiveState.selected={id:'chat-b'};
  context.waLiveState.contact={id:'contact-b'};
  context.waLiveState.selectionVersion=2;
  releasePeople([]);
  await rendering;
  assert.equal(elements.waSideTasks.innerHTML,'current chat tasks','a delayed task query cannot overwrite the new conversation');
  assert.equal(elements.waSideTaskCount.textContent,'9','a delayed task query cannot overwrite the new task counter');

  const connector=fs.readFileSync('js/modules/whatsapp-contact-reuse.js','utf8');
  assert.match(connector,/const expected=contactContext\(\);[\s\S]*?const tasks=await relatedTasks\(expected\);[\s\S]*?if\(!tasks\|\|!contactContextIsCurrent\(expected\)\)return;/,
    'task-row reuse also rejects results from the previous conversation');
  console.log('WhatsApp side panel: delayed task data stays isolated to its original chat');
})().catch(error=>{console.error(error);process.exitCode=1});
