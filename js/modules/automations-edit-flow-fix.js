(function(){
'use strict';
const M=window.TPFModules;if(!M||window.__tpfAutomationEditFlowFix)return;
window.__tpfAutomationEditFlowFix=true;
const $=id=>document.getElementById(id);
let activeId='',activePromise=null,lastStarted=0;
function rule(id){return (Array.isArray(window.crmAutomations)?window.crmAutomations:[]).find(x=>String(x.id)===String(id))}
function buttonId(button){return (button?.getAttribute('onclick')||'').match(/auto2Edit\('([^']+)'\)/)?.[1]||''}
function isFlowButton(button,id){const r=rule(id);if(r)return r.action_type==='flow_v1';const row=button?.closest?.('.auto2Rule');return row?.dataset?.tpfFlowRule==='1'||/flujo avanzado/i.test(row?.textContent||'')}
function showBuilder(){const view=$('view-automations'),builder=$('tpfFlowBuilder');if(!view||!builder)return false;builder.dataset.tpfInitialMode='edit';view.classList.add('tpfFlowMode','apBuilderOpen');builder.style.display='block';const heading=$('tpfBuilderProHeading');if(heading)heading.textContent='Editar automatización';return true}
async function waitForApi(){for(let i=0;i<30;i++){if(window.TPFAutomationFlow?.editFlow)return window.TPFAutomationFlow;await new Promise(r=>setTimeout(r,50))}return null}
async function ensureRule(id){let r=rule(id);if(r)return r;try{await window.loadAutomations?.()}catch(_){}r=rule(id);if(r)return r;try{const res=await window.sb?.rpc?.('crm_list_automations');if(!res?.error&&Array.isArray(res?.data)){window.crmAutomations=res.data;r=rule(id)}}catch(_){}return r}
function showError(text){const msg=$('tpfFlowMessage');if(msg){msg.className='tpfFlowMessage err';msg.textContent=text}}
async function openEdit(id){
 if(!id)return false;
 const now=Date.now();if(activePromise&&activeId===id)return activePromise;if(activeId===id&&now-lastStarted<250)return true;
 activeId=id;lastStarted=now;showBuilder();
 activePromise=(async()=>{
   const r=await ensureRule(id);if(!r||r.action_type!=='flow_v1'){showError('No se pudo cargar esta automatización. Vuelve a la lista y pulsa Editar de nuevo.');return false}
   const api=await waitForApi();if(!api){showError('El editor avanzado no está disponible.');return false}
   const ok=await api.editFlow(id);if(!ok){showError('No se pudieron recuperar los pasos guardados.');return false}
   showBuilder();
   const heading=$('tpfBuilderProHeading');if(heading)heading.textContent='Editar automatización';
   setTimeout(()=>{const h=$('tpfBuilderProHeading');if(h)h.textContent='Editar automatización'},120);
   return true;
 })().finally(()=>{activePromise=null});
 return activePromise;
}
function capture(ev){const button=ev.target?.closest?.('button[onclick*="auto2Edit"]');if(!button)return;const id=buttonId(button);if(!id||!isFlowButton(button,id))return;ev.preventDefault();ev.stopImmediatePropagation();void openEdit(id)}
M.register('automations-edit-flow-fix',{install(){document.addEventListener('pointerdown',capture,true);document.addEventListener('click',capture,true)}});
})();
