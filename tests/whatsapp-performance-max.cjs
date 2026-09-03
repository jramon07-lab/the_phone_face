const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../js/modules/whatsapp-performance-max.js'),'utf8');
const marker="M.register('whatsapp-performance-max',{install});";
assert.ok(source.includes(marker),'No se encontró el registro del módulo');
const testSource=source.replace(marker,`window.__waPerformanceTest={
  waPerformanceMatches,waPerformanceFilterRows,waPerformanceVisibleAvatarIds,
  waPerformanceLoadAvatar,waPerformancePage,waAvatarRetry
};${marker}`);

function eventTarget(){
  const listeners=new Map();
  return{
    listeners,
    addEventListener(type,handler,options){
      const capture=options===true||!!options?.capture;
      const rows=listeners.get(type)||[];rows.push({handler,capture});listeners.set(type,rows);
    },
    removeEventListener(type,handler,options){
      const capture=options===true||!!options?.capture;
      listeners.set(type,(listeners.get(type)||[]).filter(item=>item.handler!==handler||item.capture!==capture));
    },
    dispatch(type){
      const event={target:this,stopped:false,stopImmediatePropagation(){this.stopped=true}};
      const rows=listeners.get(type)||[];
      for(const item of rows.filter(x=>x.capture)){item.handler(event);if(event.stopped)return event}
      for(const item of rows.filter(x=>!x.capture)){item.handler(event);if(event.stopped)return event}
      return event;
    }
  };
}

const search=Object.assign(eventTarget(),{value:''});
const list=Object.assign(eventTarget(),{
  innerHTML:'',scrollTop:0,scrollHeight:1000,clientHeight:240,avatarNodes:[],
  insertAdjacentHTML(_where,value){this.innerHTML+=String(value)},
  querySelectorAll(selector){return selector==='[data-wa-avatar-id]'?this.avatarNodes:[]},
  contains(node){return this.avatarNodes.includes(node)},
  getBoundingClientRect(){return{top:0,bottom:240,height:240,width:320}}
});
const avatarNodes=[];
let oldSearchCalls=0;
function originalRender(){oldSearchCalls+=1}
search.addEventListener('input',originalRender);

const raf=[];
let timerId=0;
const timers=[];
const metas={favorite:{favorite:true},archived:{archived:true},pinned:{pinned:true}};
const state={
  filter:'all',selected:null,avatars:{},avatarPending:{},livePreview:{},history:[],
  chats:Array.from({length:161},(_,index)=>({id:`34600${String(index).padStart(6,'0')}@c.us`,name:`Cliente ${index}`}))
};
const context={
  console,
  waLiveState:state,
  renderWhatsAppChats:originalRender,
  _waRenderChatsBase:originalRender,
  hydrateWaAvatars:async()=>{},
  waMeta(id){return metas[id]||{}},
  waIsUnanswered(id){return id==='waiting'},
  waUnreadCount(id){return id==='unread'?2:0},
  waChatServerUnread(chat){return Number(chat?.serverUnread||0)},
  waNormalizePhone(id){return String(id||'').replace(/\D/g,'')},
  waInitials(name){return String(name).slice(0,2).toUpperCase()},
  waChatServerPreview(){return''},waLivePreviewText(){return''},waMessageTimestamp(){return 0},waTime(){return''},
  waApplyAvatar(el,url){el.applied=url},
  waApi:async()=>({urlAvatar:''}),
  esc(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')},
  CSS:{escape(value){return String(value)}},
  Date,Map,Set,Promise,
  setTimeout(fn,delay){timerId+=1;timers.push({id:timerId,fn,delay});return timerId},
  clearTimeout(id){const row=timers.find(x=>x.id===id);if(row)row.cancelled=true},
  requestAnimationFrame(fn){raf.push(fn);return raf.length},
  fetch:async()=>({ok:true}),
  document:{
    getElementById(id){return id==='waLiveSearch'?search:id==='waLiveChats'?list:null},
    querySelectorAll(selector){
      const match=String(selector).match(/data-wa-avatar-id="([^"]+)"/);
      return match?avatarNodes.filter(node=>node.dataset.waAvatarId===match[1]):[];
    }
  }
};
context.window=context;
context.TPFModules={register(_name,module){module.install()}};
vm.createContext(context);
vm.runInContext(testSource,context);
const api=context.__waPerformanceTest;

function flushFrames(){while(raf.length)raf.shift()()}
function rowCount(){return(list.innerHTML.match(/<div class="waChatRow(?: |")/g)||[]).length}

async function run(){
  assert.equal(api.waPerformanceMatches({id:'34695661409@c.us',name:'Rosario Aneas'},'rosario'),true);
  assert.equal(api.waPerformanceMatches({id:'34695661409@c.us',name:'Ramón Sánchez'},'ramon'),true,'la búsqueda debe ignorar tildes');
  const normalize=context.waNormalizePhone;
  context.waNormalizePhone=()=>{throw new Error('No debe probar el teléfono con una consulta alfabética vacía')};
  assert.equal(api.waPerformanceMatches({id:'34695661409@c.us',name:'Ramón'},'zzzzz'),false);
  context.waNormalizePhone=normalize;
  assert.equal(api.waPerformanceMatches({id:'34695661409@c.us',name:'Ramón'},'566140'),true);

  const filters=[
    {id:'regular',name:'Normal'},
    {id:'favorite',name:'Favorito'},
    {id:'archived',name:'Archivado'},
    {id:'pinned',name:'Fijado'},
    {id:'unread',name:'No leído'},
    {id:'waiting',name:'Sin responder'},
    {id:'group@g.us',name:'Grupo'},
    {id:'contact@c.us',name:'Cliente'}
  ];
  assert.deepEqual(Array.from(api.waPerformanceFilterRows(filters,'favorites',''),x=>x.id),['pinned','favorite']);
  assert.deepEqual(Array.from(api.waPerformanceFilterRows(filters,'archived',''),x=>x.id),['archived']);
  assert.ok(!Array.from(api.waPerformanceFilterRows(filters,'all',''),x=>x.id).includes('archived'));
  assert.deepEqual(Array.from(api.waPerformanceFilterRows(filters,'unanswered',''),x=>x.id),['waiting']);
  assert.deepEqual(Array.from(api.waPerformanceFilterRows(filters,'groups',''),x=>x.id),['group@g.us']);
  assert.deepEqual(Array.from(api.waPerformanceFilterRows(filters,'contacts',''),x=>x.id),['contact@c.us']);
  assert.deepEqual(Array.from(api.waPerformanceFilterRows(filters,'unread',''),x=>x.id),['unread']);

  context.renderWhatsAppChats();flushFrames();
  assert.equal(rowCount(),80,'la primera pintura debe estar acotada');
  assert.match(list.innerHTML,/waLiveLoadMore[^>]*>Mostrar más \(81\)<\/button>/);
  list.scrollTop=800;list.dispatch('scroll');flushFrames();
  assert.equal(rowCount(),160,'el scroll debe cargar el siguiente lote');
  assert.match(list.innerHTML,/Mostrar más \(1\)/);

  search.value='cliente 125';
  let futureSearchCalls=0;search.addEventListener('input',()=>{futureSearchCalls+=1});
  const inputEvent=search.dispatch('input');flushFrames();
  assert.equal(inputEvent.stopped,false,'no debe bloquear listeners añadidos por otros módulos');
  assert.equal(oldSearchCalls,0);
  assert.equal(futureSearchCalls,1);
  assert.equal(rowCount(),1);
  assert.match(list.innerHTML,/Cliente 125/);

  const makeAvatar=(id,top)=>({dataset:{waAvatarId:id,waInitials:'CL'},getBoundingClientRect(){return{top,bottom:top+40}}});
  for(let index=0;index<20;index++)avatarNodes.push(makeAvatar(`avatar-${index}`,index*50));
  list.avatarNodes=avatarNodes;
  const visible=api.waPerformanceVisibleAvatarIds(avatarNodes.map(x=>x.dataset.waAvatarId));
  assert.deepEqual(Array.from(visible),['avatar-0','avatar-1','avatar-2','avatar-3','avatar-4','avatar-5']);

  let avatarCalls=0;
  context.waApi=async()=>{
    avatarCalls+=1;
    if(avatarCalls===1)throw new Error('fallo temporal');
    return{urlAvatar:'https://cdn.test/avatar.jpg'};
  };
  await api.waPerformanceLoadAvatar('avatar-0');
  assert.equal(api.waAvatarRetry.get('avatar-0').attempts,1);
  await api.waPerformanceLoadAvatar('avatar-0');
  assert.equal(avatarCalls,2,'un fallo temporal debe poder reintentarse');
  assert.equal(state.avatars['avatar-0'],'https://cdn.test/avatar.jpg');
  assert.equal(avatarNodes[0].applied,'https://cdn.test/avatar.jpg');

  console.log('WhatsApp performance max OK');
}

run().catch(error=>{console.error(error);process.exitCode=1});
