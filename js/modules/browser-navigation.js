(function(){
'use strict';
// PC only. No database writes, message sends, or changes to approved handlers.
if(window.TPFBrowserNavigation||!window.tpfCaptureCurrentScreen||location.pathname.startsWith('/movil'))return;
const $=id=>document.getElementById(id),MARK='tpfNavigation',session=Date.now().toString(36)+Math.random().toString(36).slice(2);
const layers=[['tpfContactsCreateBack','tpfContactsCreateCancel'],['waFilePreviewModal','waFilePreviewClose'],['waTemplateModal','waTemplateClose'],['waQuickModal','waQuickClose'],['agendaTypeModal','agendaCloseTypes'],['agendaCreateCard','agendaCloseCreate'],['oppDetailModal','oppModalCloseX'],['cpTaskDetailPage','cpTaskDetailBack'],['cpTaskPage','cpTaskBack']];
const backIds=new Set(['contactClose','oppFullBack','salesFullBackBtn',...layers.map(x=>x[1]),'tpfContactsCreateClose','oppModalClose','waQuickCancel']);
const entries=new Map(),edited=new Map();let position=0,current=null,busy=false,repair=null,timer=null,nativeReturn=false,popQueue=Promise.resolve();
const visible=el=>!!el&&el.isConnected&&!el.closest('.hidden,[hidden],[aria-hidden="true"]')&&getComputedStyle(el).display!=='none';
function topLayer(){const dialog=[...document.querySelectorAll('dialog[open]')].pop();if(dialog)return {el:dialog,close:null,key:'dialog:'+dialog.className};for(const [id,close] of layers)if(visible($(id)))return {el:$(id),close,key:id};return null;}
function capture(){
 const screen=window.tpfCaptureCurrentScreen(),layer=topLayer();
 const tab=visible($('contactModal'))?document.querySelector('[data-cp-ref-tab][aria-selected="true"]')?.dataset.cpRefTab||'':'';
 return {screen,tab,layer:layer?.key||'',close:layer?.close||null,key:JSON.stringify([screen.type,screen.id,screen.contactId,screen.mainView,screen.waChatId,tab,layer?.key||'']),scroll:[$('contactModal')?.scrollTop||0,$('waMessages')?.scrollTop||0],internal:[...(window.__TPF_HISTORY||[])]};
}
function mark(n){return {...(history.state||{}),[MARK]:{session,index:n}};}
function update(){if(current){const s=capture();if(s.key===current.key){current=s;entries.set(position,s);}}}
function dirty(){for(const [el,value] of edited){if(!visible(el)){edited.delete(el);continue;}if(fieldValue(el)!==value)return true;}return false;}
function fieldValue(el){return el.type==='checkbox'||el.type==='radio'?String(el.checked):el.type==='file'?[...(el.files||[])].map(f=>f.name+':'+f.size).join('|'):el.value;}
function editorFor(el){const layer=topLayer();if(layer?.el.contains(el))return layer.el;return el.closest?.('#contactModal.tpf-contact-editing,#cpNoteForm');}
function remember(e){const el=e.target;if(!el?.matches?.('input,textarea,select')||el.disabled||el.readOnly||!editorFor(el))return;if(!edited.has(el))edited.set(el,fieldValue(el));}
function approve(){return !dirty()||window.confirm('Tienes cambios sin guardar. ¿Quieres salir y descartarlos?');}
function schedule(){clearTimeout(timer);timer=setTimeout(sync,100);}
function sync(){
 if(busy||window.__TPF_RESTORING)return;
 const state=capture();dirty();
 if(!current){current=state;entries.set(position,state);history.replaceState(mark(position),'');return;}
 if(current.key===state.key){current=state;entries.set(position,state);nativeReturn=false;return;}
 // Native Back/Cancel/Save already performed the transition: consume the
 // matching history entry rather than creating a loop back into the editor.
 let previous=null;
 for(const [i,s] of entries)if(i<position&&s.key===state.key&&(nativeReturn||current.layer))previous=i;
 nativeReturn=false;
 if(previous!==null){busy=true;repair={index:previous,state};history.go(previous-position);return;}
 for(const i of entries.keys())if(i>position)entries.delete(i);
 position++;current=state;entries.set(position,state);history.pushState(mark(position),'');
 // Keep only lightweight snapshots in memory; never put form values in URLs/history.
 while(entries.size>100)entries.delete(entries.keys().next().value);
}
function restoreScroll(s){const tab=s.tab&&$('cpRefTab-'+s.tab);if(tab&&visible(tab))tab.click();if($('contactModal'))$('contactModal').scrollTop=s.scroll[0];if($('waMessages')&&s.screen.mainView==='whatsapplive')$('waMessages').scrollTop=s.scroll[1];}
async function closeLayer(layer){
 if(layer.close){const button=$(layer.close);if(!button||button.disabled)return false;button.click();}
 else {const event=new Event('cancel',{cancelable:true});if(layer.el.dispatchEvent(event))layer.el.close();}
 await new Promise(r=>setTimeout(r,0));return !visible(layer.el)||layer.el.tagName==='DIALOG'&&!layer.el.open;
}
async function restore(target){
 let layer=topLayer();
 for(let i=0;layer&&layer.key!==target.layer&&i<12;i++){
  if(!await closeLayer(layer))throw Error('Termina o cancela la operación abierta antes de volver.');layer=topLayer();
 }
 let now=capture();
 // Never replay an editor opener or a save/send click with Forward. If its
 // form was closed, return to the safe parent rather than resurrect a draft.
 if(target.layer&&now.layer!==target.layer){return now;}
 if(now.key!==target.key){
  if(now.screen.type===target.screen.type&&now.screen.id===target.screen.id&&now.screen.contactId===target.screen.contactId&&now.screen.mainView===target.screen.mainView&&now.screen.waChatId===target.screen.waChatId){restoreScroll(target);}
  else {await window.tpfRestoreCapturedScreen(target.screen);restoreScroll(target);}
 }
 window.__TPF_HISTORY=[...target.internal];restoreScroll(target);return capture();
}
async function pop(e){
 const marker=e.state?.[MARK];
 if(marker?.session!==session){current=null;position=0;busy=false;repair=null;entries.clear();edited.clear();return;}
 const dest=marker.index;
 if(repair){if(dest===repair.index){position=dest;current=repair.state;entries.set(dest,current);repair=null;busy=false;}return;}
 const target=entries.get(dest);
 if(!target){current=capture();position=dest;entries.set(dest,current);return;}
 if(busy){repair={index:position,state:current};history.go(position-dest);return;}
 if(!approve()){busy=true;repair={index:position,state:current};history.go(position-dest);return;}
 busy=true;
 try{const restored=await restore(target);position=dest;current=restored;entries.set(dest,restored);edited.clear();}
 catch(error){window.alert(error.message||'No se pudo volver a la pantalla anterior.');repair={index:position,state:capture()};history.go(position-dest);}
 finally{if(!repair)busy=false;}
}
function click(e){
 const button=e.target.closest?.('button,a,.nav,[role="button"]');if(!button)return;
 const back=backIds.has(button.id)||/^(←\s*)?(volver|cancelar|cerrar)(\s|$)/i.test(button.textContent.trim());
 if(busy&&e.isTrusted&&(back||button.matches('.nav'))){e.preventDefault();e.stopImmediatePropagation();return;}
 if(!busy&&(back||button.matches('.nav'))&&!approve()){e.preventDefault();e.stopImmediatePropagation();return;}
 if(!busy){update();nativeReturn=back;}schedule();
}
document.addEventListener('click',click,true);
for(const event of ['focusin','beforeinput','pointerdown','keydown'])document.addEventListener(event,remember,true);
document.addEventListener('input',schedule,true);document.addEventListener('change',schedule,true);
window.addEventListener('popstate',e=>{popQueue=popQueue.then(()=>pop(e));});
window.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue='';}});
document.addEventListener('scroll',()=>{if(!busy)update();},true);
const watched=new Set(['contactModal','opportunityFullPage',...layers.map(x=>x[0])]);
new MutationObserver(records=>{if(records.some(r=>watched.has(r.target.id)||r.target.id==='waMessages'||r.target.id?.startsWith('view-')||r.target.matches?.('dialog,[data-cp-ref-tab]')||r.type==='childList'&&[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(watched.has(n.id)||n.matches?.('dialog')))))schedule();}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','open','aria-selected','aria-hidden']});
window.addEventListener('tpf:contact-open',schedule);window.addEventListener('tpf:contact-updated',schedule);
window.TPFBrowserNavigation={version:1};sync();
})();
