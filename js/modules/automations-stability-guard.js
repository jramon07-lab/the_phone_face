(function(){
'use strict';
if(window.__tpfAutomationsStabilityGuard)return;
window.__tpfAutomationsStabilityGuard=true;

const M=window.TPFModules;
const state={wrapped:new Set(),lastLongTask:0};

function report(err,context){
  try{M?.report?.('automations-stability',err,context)}catch(_){console.warn('[TPF automations stability]',context,err)}
}

function singleFlight(name){
  const original=window[name];
  if(typeof original!=='function'||original.__tpfSingleFlight)return false;
  let pending=null;
  const wrapped=function(){
    if(pending)return pending;
    let result;
    try{result=original.apply(this,arguments)}catch(e){report(e,name);throw e}
    if(!result||typeof result.then!=='function')return result;
    pending=Promise.resolve(result).catch(e=>{report(e,name);throw e}).finally(()=>{pending=null});
    return pending;
  };
  wrapped.__tpfSingleFlight=true;
  wrapped.__tpfOriginal=original;
  window[name]=wrapped;
  state.wrapped.add(name);
  return true;
}

function wrapHeavyCalls(){
  singleFlight('auto2PrepareOptions');
  singleFlight('loadAutomations');
}

let navBusy=false;
function guardNavigation(){
  document.addEventListener('click',e=>{
    const nav=e.target?.closest?.('.nav[data-view="automations"]');
    if(!nav)return;
    if(navBusy){
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    navBusy=true;
    setTimeout(()=>{navBusy=false},900);
  },true);
}

function monitorLongTasks(){
  try{
    if(!('PerformanceObserver' in window))return;
    const po=new PerformanceObserver(list=>{
      for(const entry of list.getEntries()){
        if(entry.duration<180)return;
        state.lastLongTask=Date.now();
        try{M?.emit?.('automations-stability','warning','Tarea larga '+Math.round(entry.duration)+' ms')}catch(_){}
      }
    });
    po.observe({entryTypes:['longtask']});
  }catch(_){}
}

function boot(){
  wrapHeavyCalls();
  let tries=0;
  const timer=setInterval(()=>{
    wrapHeavyCalls();
    tries++;
    if((state.wrapped.has('auto2PrepareOptions')&&state.wrapped.has('loadAutomations'))||tries>=40)clearInterval(timer);
  },100);
}

guardNavigation();
monitorLongTasks();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
M?.register?.('automations-stability',{install(){}});
})();