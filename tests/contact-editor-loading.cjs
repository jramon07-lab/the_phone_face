const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function fixture(){
  const listeners={},nodes={};
  const listen=(name,fn)=>(listeners[name]??=[]).push(fn);
  const emit=(name,event={})=>{for(const fn of listeners[name]||[])fn(event);};
  function node(id,value=''){
    const classes=new Set();
    const el={id,value,type:'text',textContent:'',dataset:{},isConnected:true,disabled:false,readOnly:false,
      classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v)},
      closest:s=>s.startsWith('.hidden')?(classes.has('hidden')?el:null):el,
      matches:s=>s==='input,textarea,select'&&id.startsWith('tpfCreate'),
      contains:x=>x===el,querySelectorAll:()=>[],querySelector:()=>null};
    nodes[id]=el;return el;
  }
  const back=node('tpfContactsCreateBack');back.classList.add('hidden');
  const title=node('title'),subtitle=node('subtitle');
  back.querySelector=s=>s.endsWith('h3')?title:subtitle;
  back.contains=el=>el.id.startsWith('tpfCreate');
  const save=node('tpfContactsCreateSave'),cancel=node('tpfContactsCreateCancel'),close=node('tpfContactsCreateClose');
  const nativeCancel=()=>back.classList.add('hidden');cancel.onclick=close.onclick=nativeCancel;
  const first=node('tpfCreateFirst');
  for(const suffix of ['Last','Nickname','Phone','Email','Dni','Bank','Notes','Obs','Labels'])node('tpfCreate'+suffix);
  const add=node('tpfContactsAdd');
  add.click=()=>{
    first.value='';back.classList.remove('hidden');
    // The shared form focuses its first input before the profile fills it.
    emit('focusin',{target:first});
  };
  let releaseLabels;
  const labels=new Promise(resolve=>releaseLabels=resolve);
  const document={body:{},getElementById:id=>nodes[id]||null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:listen};
  const window={TPFModules:{register(){}},addEventListener:listen,dispatchEvent:e=>{emit(e.type,e);return true;},
    tpfCaptureCurrentScreen:()=>({type:'contact',id:'synthetic-contact',mainView:'contacts'}),
    tpfRestoreCapturedScreen:async()=>{},confirm:()=>false};
  const context=vm.createContext({window,document,location:{pathname:'/'},
    currentContact:{id:'synthetic-contact',data:{NOMBRE:'Control',APELLIDOS:'Local'}},
    sb:{rpc:()=>labels},history:{state:null,replaceState(){},pushState(){},go(){}},
    getComputedStyle:()=>({display:'block'}),MutationObserver:class{observe(){}},
    setTimeout,clearTimeout,Event,CustomEvent,Map,Set,Date,Math});
  vm.runInContext(fs.readFileSync('js/modules/browser-navigation.js','utf8'),context);
  vm.runInContext(fs.readFileSync('js/modules/contact-profile.js','utf8').replace("  M.register('contact-profile',", "  window.testEditor={openCreateModalEdit,returnFromCreateEdit};\n  M.register('contact-profile',"),context);
  const guarded=()=>{let blocked=false;emit('beforeunload',{preventDefault(){blocked=true;}});return blocked;};
  return {window,back,first,save,cancel,nativeCancel,emit,guarded,releaseLabels};
}

(async()=>{
  const f=fixture(),opening=f.window.testEditor.openCreateModalEdit();
  await Promise.resolve();
  assert.equal(f.first.value,'Control');
  assert.equal(f.guarded(),false,'Loading a contact after autofocus must not become an unsaved user edit');
  f.emit('beforeinput',{target:f.first});f.first.value='User draft';
  assert.equal(f.guarded(),true,'A real edit while labels load must remain protected');
  f.releaseLabels({data:[]});await opening;
  assert.equal(f.guarded(),true,'Late label loading must not clear a real edit');
  f.first.value='Control';assert.equal(f.guarded(),false,'Restoring the original value makes the editor clean');
  await f.window.testEditor.returnFromCreateEdit();
  assert.equal(f.back.classList.contains('hidden'),true);

  const g=fixture(),pending=g.window.testEditor.openCreateModalEdit();
  await Promise.resolve();await g.window.testEditor.returnFromCreateEdit();
  g.releaseLabels({data:[]});await pending;
  assert.equal(g.back.classList.contains('hidden'),true);
  assert.equal(g.cancel.onclick,g.nativeCancel,'A late response must not replace handlers after cancellation');
  console.log('PASS contact editor loading: clean baseline, real draft protection, cancellation during label loading');
})().catch(error=>{console.error(error);process.exitCode=1;});
