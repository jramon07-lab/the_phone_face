const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/modules/browser-navigation.js'),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,140));
function fixture(){
 const listeners={},nodes={},stack=[null];let cursor=0,screen={type:'main',mainView:'dashboard'},confirm=true;
 const listen=(n,f)=>(listeners[n]??=[]).push(f);
 const emit=async(n,e={})=>{for(const fn of listeners[n]||[])await fn(e);};
 const history={get state(){return stack[cursor];},replaceState(s){stack[cursor]=s;},pushState(s){stack.splice(cursor+1);stack.push(s);cursor++;},go(n){const next=cursor+n;if(next<0||next>=stack.length)return;cursor=next;const state=stack[cursor];setTimeout(()=>emit('popstate',{state}),0);}};
 const document={body:{},getElementById:id=>nodes[id]||null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:listen};
 const window={__TPF_HISTORY:[],tpfCaptureCurrentScreen:()=>({...screen}),tpfRestoreCapturedScreen:async s=>{screen={...s};},addEventListener:listen,confirm:()=>confirm,alert:msg=>{throw Error(msg);}};
 vm.runInNewContext(source,{window,document,location:{pathname:'/'},history,getComputedStyle:()=>({display:'block'}),MutationObserver:class{observe(){}},setTimeout,clearTimeout,Event,Map,Set,Date,Math});
 function node(id){const el={id,isConnected:true,value:'',type:'text',textContent:'',scrollTop:0,disabled:false,readOnly:false,closest:selector=>selector.startsWith('.hidden')?(el.hidden?el:null):selector.startsWith('#contactModal')?el:el,matches:selector=>selector==='input,textarea,select',contains:x=>x===el};nodes[id]=el;return el;}
 return {window,history,emit,node,get screen(){return screen;},get cursor(){return cursor;},get length(){return stack.length;},set confirm(v){confirm=v;},async navigate(s){screen=s;await emit('tpf:contact-open');await tick();}};
}
(async()=>{
 const f=fixture();assert.equal(f.cursor,0);
 await f.navigate({type:'main',mainView:'contacts'});
 await f.navigate({type:'contact',id:'a',mainView:'contacts'});
 assert.equal(f.cursor,2);
 f.history.go(-1);await tick();assert.equal(f.screen.type,'main');assert.equal(f.screen.mainView,'contacts');
 f.history.go(1);await tick();assert.equal(f.screen.id,'a');
 f.history.go(-1);await tick();await f.navigate({type:'main',mainView:'sales'});
 assert.equal(f.cursor,2);assert.equal(f.length,3);assert.equal(f.history.state.tpfNavigation.index,2);
 f.history.go(-1);await tick();assert.equal(f.screen.mainView,'contacts');
 f.history.go(-1);await tick();assert.equal(f.screen.mainView,'dashboard');
 const g=fixture();await g.navigate({type:'contact',id:'a',mainView:'contacts'});
 const input=g.node('editorInput');await g.emit('focusin',{target:input});input.value='draft';g.confirm=false;
 g.history.go(-1);await tick();assert.equal(g.cursor,1);assert.equal(g.screen.id,'a');assert.equal(input.value,'draft');
 let prevented=false;await g.emit('beforeunload',{preventDefault(){prevented=true;}});assert.equal(prevented,true);
 g.confirm=true;g.history.go(-1);await tick();assert.equal(g.screen.mainView,'dashboard');
 const h=fixture();await h.navigate({type:'main',mainView:'contacts'});await h.navigate({type:'contact',id:'a',mainView:'contacts'});
 const back=h.node('contactClose');back.textContent='Volver';await h.emit('click',{target:back});await h.navigate({type:'main',mainView:'contacts'});await tick();
 assert.equal(h.cursor,1);assert.equal(h.length,3);h.history.go(-1);await tick();assert.equal(h.screen.mainView,'dashboard');
 const rapid=fixture();await rapid.navigate({type:'main',mainView:'contacts'});await rapid.navigate({type:'contact',id:'b',mainView:'contacts'});
 rapid.window.tpfRestoreCapturedScreen=async s=>{await new Promise(r=>setTimeout(r,25));await rapid.navigate(s);};
 rapid.history.go(-1);rapid.history.go(-1);await new Promise(r=>setTimeout(r,450));assert.equal(rapid.cursor,0);assert.equal(rapid.screen.mainView,'dashboard');
 console.log('PASS browser navigation: Back/Forward, branching, unsaved guard, unload, native Back');
})().catch(e=>{console.error(e);process.exitCode=1;});
