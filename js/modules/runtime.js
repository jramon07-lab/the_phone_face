(function(){
'use strict';
if(window.TPFModules&&window.TPFModules.version>=2)return;
const states=new Map(),errs=[];
function emit(name,state,detail=''){const item={name,state,detail:String(detail||''),at:new Date().toISOString()};states.set(name,item);try{window.dispatchEvent(new CustomEvent('tpf:module-status',{detail:item}))}catch(_){}return item}
function report(name,error,context=''){console.error('[TPF:'+name+']',context,error);const item={module:name,error:String(error?.message||error||'Error'),context:String(context||''),at:new Date().toISOString()};errs.push(item);if(errs.length>100)errs.shift();try{window.dispatchEvent(new CustomEvent('tpf:module-error',{detail:item}))}catch(_){}return emit(name,'error',item.error)}
function register(name,definition={}){emit(name,'loading');try{const result=definition.install?.(api);if(result&&typeof result.then==='function')return Promise.resolve(result).then(()=>emit(name,'ready'),error=>report(name,error,'install'));return emit(name,'ready')}catch(error){return report(name,error,'install')}}
function guard(name,fn){if(typeof fn!=='function')return fn;function guarded(...args){try{const value=fn.apply(this,args);return value&&typeof value.then==='function'?Promise.resolve(value).catch(error=>{report(name,error);throw error}):value}catch(error){report(name,error);throw error}}return guarded}
function wrapGlobals(name,names=[]){return names.flatMap(key=>{const fn=window[key];if(typeof fn!=='function'||fn.__tpfGuarded)return[];const safe=guard(name,fn);Object.assign(safe,fn);Object.defineProperty(safe,'__tpfGuarded',{value:true});window[key]=safe;return[key]})}
const api={version:2,register,guard,wrapGlobals,report,emit,status:()=>[...states.values()],errors:()=>[...errs],clearErrors:()=>{errs.length=0}};
window.TPFModules=api;emit('runtime','ready');
(function(){const Native=window.MutationObserver;if(!Native||Native.__tpfSafe)return;function SafeMutationObserver(callback){let automationTarget=false,queued=false,pending=[],proxy=null;const native=new Native(records=>{if(!automationTarget){callback(records,proxy);return}pending.push(...records);if(queued)return;queued=true;setTimeout(()=>{queued=false;const batch=pending.splice(0,300);try{callback(batch,proxy)}catch(error){report('mutation-observer',error,'automations')}},60)});proxy={observe(target,options){try{automationTarget=!!(target&&(target.id==='view-automations'||target.closest?.('#view-automations')))}catch(_){automationTarget=false}return native.observe(target,options)},disconnect(){pending.length=0;queued=false;return native.disconnect()},takeRecords(){return native.takeRecords()}};return proxy}SafeMutationObserver.__tpfSafe=true;SafeMutationObserver.prototype=Native.prototype;window.MutationObserver=SafeMutationObserver})();

// Estos son solo módulos que no se cargan directamente desde index.html.
// Mantener una única fuente de carga evita que ventas, ofertas, etiquetas y fichas
// se inicialicen dos veces y se pisen entre sí.
const files=[
 'automations-stability-guard.js','contacts-active-only.js','contacts-list-ui.js','contacts-list-layout-fix.js','contacts-filter-layout.js','contacts-final-fix.js','contacts-approved-fixes.js','contacts-four-fixes.js','contact-profile.js','contact-bank-native.js','contact-activity-tabs.js','contact-opportunity-actions.js','contact-open-nonblocking.js','contact-actions-bridge.js','contact-automation-status.js','automations-auth-guard.js','automations-flow-status.js','dashboard-performance-guard.js','email-m365-lazy.js','whatsapp-read-guard.js','whatsapp-ui-fixes.js','whatsapp-status-throttle.js','whatsapp-performance-max.js','whatsapp-archive-sync.js','whatsapp-templates-persistence-bridge.js','whatsapp-templates-library-v3.js','whatsapp-template-first-name.js','whatsapp-template-picker-direct.js','whatsapp-schedule-direct-v3.js','search-fallback.js','contacts-lock-final.js','whatsapp-large-screen.js','sidebar-fixed-safe.js','sidebar-clean-compact.js','whatsapp-five-fixes.js','whatsapp-reply-isolated.js','whatsapp-composer-autogrow.js','whatsapp-contact-reuse.js','whatsapp-contact-edit-back.js','automations-flow-builder.js','automations-pro-v2.js','automations-pro-v2-fix.js','automations-builder-pro-ui.js','automations-final-polish.js','automations-execution-controls.js','automations-edit-flow-fix.js','contact-automation-consistency.js','whatsapp-automation-inbox.js'
];
function version(file){
 const idleStable=file==='automations-pro-v2.js'||file==='automations-pro-v2-fix.js'?'20260907-idle-stable-1':'';if(idleStable)return idleStable;
 if(file==='dashboard-performance-guard.js')return'20260911-dashboard-owner-1';
 if(file==='whatsapp-contact-edit-back.js')return'20260909-draft-close-1';
 if(file==='whatsapp-ui-fixes.js')return'20260911-status-fair-1';
 if(file==='whatsapp-performance-max.js')return'20260918-nickname-index-1';
 if(file==='contact-automation-status.js')return'20260918-summary-restore-1';
 if(file==='contact-activity-tabs.js')return'20260908-activity-2';
 if(file==='automations-execution-controls.js')return'20260908-customer-groups-1';
 if(file==='whatsapp-archive-sync.js')return'20260908-archive-reliability-1';
 if(file==='whatsapp-composer-autogrow.js')return'20260907-autogrow-2';
 if(file==='whatsapp-automation-inbox.js')return'20260907-auto-inbox-3';
 if(file==='contacts-list-ui.js')return'20260918-integrity-apodo-visible-1';
 if(file==='contact-open-nonblocking.js')return'20260906-fresh-contact-1';
 if(file==='whatsapp-status-throttle.js')return'20260907-stability-1';
 if(file==='whatsapp-five-fixes.js')return'20260906-contact-create-stable-1';
 if(file==='whatsapp-templates-library-v3.js')return'20260906-search-focus-1';
 if(file==='whatsapp-contact-reuse.js')return'20260906-contact-wait-1';
 if(file==='automations-final-polish.js')return'20260906-no-flicker-2';
 if(file==='contacts-lock-final.js')return'20260906-task-overlay-1';
 if(file==='contact-profile.js')return'20260908-profile-loading-2';
 if(['contacts-final-fix.js','contacts-approved-fixes.js'].includes(file))return'20260906-sales-identity-2';
 if(['automations-flow-builder.js','automations-builder-pro-ui.js'].includes(file))return'20260906-single-builder-1';
 return'20260918-single-loader-1';
}
for(const file of files){const script=document.createElement('script');script.src='/js/modules/'+file+'?v='+version(file);script.async=false;document.head.appendChild(script)}
})();
