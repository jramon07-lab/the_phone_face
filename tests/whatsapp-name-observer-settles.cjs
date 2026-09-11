'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/modules/contact-google-inline.js','utf8');

// A bounded DOM/MutationObserver scheduler: assigning identical non-empty
// textContent still replaces its text node and notifies childList observers.
// Never run a regressed microtask loop on the host event loop.
function fixture({confirmed=true,nickname='Alias de prueba',wrongPhone=false}={}){
  const jobs=[],observers=[],nodes=new Map(),storage=new Map();
  let writes=0,storageWrites=0,callbacks=0;
  function changed(node){
    for(const observer of observers){
      if(!observer.targets.some(target=>target===node||target.contains(node)))continue;
      observer.pending=true;
      if(observer.queued)continue;
      observer.queued=true;
      jobs.push(()=>{observer.queued=false;if(!observer.pending)return;observer.pending=false;callbacks++;observer.callback()});
    }
  }
  class Element{
    constructor(id='',text=''){this.id=id;this._text=text;this.parent=null;this.children=[];this.className='';const classes=new Set();this.classList={toggle:(c,on)=>{if(on)classes.add(c);else classes.delete(c)},contains:c=>classes.has(c)};if(id)nodes.set(id,this)}
    get textContent(){return this._text}
    set textContent(value){const next=String(value),mutates=!!next||!!this._text;this._text=next;writes++;if(mutates)changed(this)}
    contains(node){for(let current=node;current;current=current.parent)if(current===this)return true;return false}
    append(node){node.parent=this;this.children.push(node);changed(this);return node}
    closest(selector){if(selector==='.waChatRowMain')return this.parent;return null}
    querySelector(selector){return selector==='.tpfWaListNickname'?this.children.find(n=>n.className==='tpfWaListNickname')||null:null}
    insertAdjacentElement(position,node){this.parent.append(node)}
  }
  const list=new Element('waLiveChats'),main=list.append(new Element()),label=main.append(new Element('', 'NOMBRE ORIGINAL'));
  for(const id of ['waChatName','waSideName'])new Element(id,'NOMBRE ORIGINAL');
  for(const id of ['waChatNickname','waSideNickname'])new Element(id,'');
  const chat={id:'34900000001@c.us',name:'NOMBRE ORIGINAL'};
  const row={id:'synthetic-record',data:{NOMBRE:'Nombre',APELLIDOS:'Corregido',APODO:nickname,'TELÉFONO':wrongPhone?'900000002':'900000001'}};
  if(confirmed)row.data.TPF_WHATSAPP_NAME_CONFIRMED={chat_id:chat.id};
  class Observer{
    constructor(callback){this.callback=callback;this.targets=[];this.pending=false;this.queued=false;observers.push(this)}
    observe(target){if(!this.targets.includes(target))this.targets.push(target)}
    disconnect(){this.targets=[];this.pending=false}
  }
  const sandbox={console,Map,Set,Date,MutationObserver:Observer,queueMicrotask:fn=>jobs.push(fn),setTimeout:fn=>jobs.push(fn),clearTimeout(){},setInterval(){},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>{storageWrites++;storage.set(key,value)}},document:{getElementById:id=>nodes.get(id)||null,querySelector:selector=>selector==='.waChatRow.active .waChatRowTop b'?label:null,createElement:()=>new Element()},waLiveState:{selected:chat,contact:row,selectionVersion:1}};
  sandbox.window={TPFModules:{register(){}}};
  vm.createContext(sandbox);
  const marker="M.register('contact-google-inline',{install});";
  assert.ok(source.includes(marker),'test must execute the actual module');
  vm.runInContext(source.replace(marker,"window.nameTest={applyUnifiedWhatsappName,scheduleWhatsappNameRepair,watchWhatsappNames};"),sandbox,{timeout:1000});
  const api=sandbox.window.nameTest;api.watchWhatsappNames();
  return{api,nodes,label,row,jobs,state:sandbox.waLiveState,stats:()=>({writes,storageWrites,callbacks}),flush(){let count=0;while(jobs.length&&count<100){jobs.shift()();count++}assert.equal(jobs.length,0,'Name observer must settle; self-generated mutations are starving the browser event loop');return count},repaint(){label.textContent='NOMBRE ORIGINAL'}};
}

const f=fixture();
f.repaint();
f.flush();
for(const id of ['waChatName','waSideName'])assert.equal(f.nodes.get(id).textContent,'Nombre Corregido');
for(const id of ['waChatNickname','waSideNickname'])assert.equal(f.nodes.get(id).textContent,'Alias de prueba');
assert.equal(f.label.textContent,'Nombre Corregido');
assert.equal(f.label.parent.querySelector('.tpfWaListNickname').textContent,'Alias de prueba');
const stable=f.stats();f.api.applyUnifiedWhatsappName();f.flush();
assert.equal(f.stats().writes,stable.writes,'an unchanged identity must not rewrite the DOM');
assert.equal(f.stats().storageWrites,stable.storageWrites,'an unchanged identity must not rewrite local storage');

for(let i=0;i<30;i++){f.repaint();f.flush()}
f.row.data.APODO='Otro alias';f.repaint();f.flush();
assert.equal(f.nodes.get('waSideNickname').textContent,'Otro alias');
f.row.data.APODO='';f.repaint();f.flush();
assert.equal(f.nodes.get('waSideNickname').textContent,'');
assert.equal(f.nodes.get('waSideNickname').classList.contains('hidden'),true);
for(const options of [{confirmed:false},{wrongPhone:true},{nickname:''}]){const other=fixture(options);other.repaint();other.flush();if(options.confirmed===false||options.wrongPhone)assert.equal(other.label.textContent,'NOMBRE ORIGINAL')}
console.log('Name observer settles after search/repaint, preserves all three names, ignores unconfirmed/mismatched contacts, and avoids duplicate DOM/storage writes');
for(const target of [null,{id:'other',data:{NOMBRE:'Otro','TELÉFONO':'900000002'}},{id:'wrong',data:{'TELÉFONO':'900000001'}}]){
 const next=fixture();next.repaint();next.flush();
 next.state.selected={id:'34900000002@c.us',name:'Otro'};next.state.contact=target;next.state.selectionVersion++;
 next.repaint();next.flush();
 for(const id of ['waChatNickname','waSideNickname']){assert.equal(next.nodes.get(id).textContent,'','Changing to an unconfirmed/missing/mismatched contact must remove the previous nickname');assert.equal(next.nodes.get(id).classList.contains('hidden'),true)}
 next.state.contact=next.row;next.state.selected={id:'34900000001@c.us',name:'Original'};next.repaint();next.flush();
 assert.equal(next.nodes.get('waSideNickname').textContent,'Alias de prueba','Returning to the confirmed contact restores only its own nickname');
}
