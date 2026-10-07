/* Refresh a superseded build only when no open detail or draft will be lost. */
(function(){
 'use strict';
 const current=document.getElementById('tpfBuildBadge')?.dataset.tpfFullCommit;
 if(!/^[a-f0-9]{40}$/i.test(current||''))return;
 const drafts=new Set();let changed=false,checking=false,reloading=false,lastAction=Date.now(),timer;
 const visible=node=>node?.isConnected&&!node.closest('.hidden,[hidden]')&&node.getClientRects().length>0;
 function unsafe(){
  for(const node of drafts)if(visible(node))return true;
  return [...document.querySelectorAll('dialog[open],[role=dialog],.modalBack,.waTemplateBack,.agendaModal,#contactModal,#oppDetailModal,#waQuickModal,#agendaCreateCard,#tpfContactsCreateBack')].some(visible)||!!document.querySelector('[aria-busy="true"]');
 }
 function notice(){
  if(document.getElementById('tpfUpdateNotice'))return;
  const banner=document.createElement('div');banner.id='tpfUpdateNotice';banner.setAttribute('role','status');
  banner.style.cssText='position:fixed;left:12px;right:12px;bottom:36px;z-index:100000;padding:12px;background:#edf5ff;border:1px solid #9dc0f4;border-radius:10px;color:#24354b;font:13px system-ui';
  banner.textContent='Hay una versión nueva. Guarda o cierra lo que estás editando; la aplicación se actualizará al terminar.';document.body.appendChild(banner);
 }
 function refresh(){
  if(!changed||reloading||document.hidden)return;
  if(unsafe()){notice();return;}
  if(Date.now()-lastAction<1500){clearTimeout(timer);timer=setTimeout(refresh,1600);return;}
  reloading=true;location.reload();
 }
 async function check(){
  if(checking||document.hidden)return;
  checking=true;
  try{const response=await fetch('/api/deployment-version',{cache:'no-store'});if(!response.ok)return;const data=await response.json();if(data.environment==='production'&&/^[a-f0-9]{40}$/i.test(data.sha||'')&&data.sha!==current){changed=true;refresh();}}
  catch(_){/* A failed connectivity check must not interrupt the current screen. */}
  finally{checking=false;}
 }
 document.addEventListener('input',event=>{if(event.isTrusted&&event.target.matches('input:not([type=search]),textarea'))drafts.add(event.target);},true);
 document.addEventListener('change',event=>{if(event.isTrusted&&event.target.matches('select,input:not([type=search])'))drafts.add(event.target);},true);
 for(const name of ['pointerdown','keydown'])document.addEventListener(name,()=>{lastAction=Date.now();clearTimeout(timer);timer=setTimeout(refresh,1600);},true);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});window.addEventListener('focus',()=>void check());
 new MutationObserver(()=>{if(changed){clearTimeout(timer);timer=setTimeout(refresh,1600);}}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class','open','hidden','aria-busy']});
 setInterval(check,60000);void check();
})();
