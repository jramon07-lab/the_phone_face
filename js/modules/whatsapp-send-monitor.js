(function(){
'use strict';
let busy=false,last=0,data=null,mountTimer=0;
function mount(){
 const home=document.getElementById('view-dashboard');if(!home)return null;
 const anchor=home.querySelector('#dashRefresh');if(!anchor)return null;
 let button=document.getElementById('waSendMonitor');
 if(button&&button.tagName!=='BUTTON'){button.remove();button=null;}
 if(!button){button=document.createElement('button');button.id='waSendMonitor';button.type='button';button.className='tdHeroGhost secondary waMonitorButton';button.innerHTML='<span>Envíos y avisos</span><span data-wa-pending class="waMonitorCount">…</span><span data-wa-warning class="waMonitorWarning" hidden></span>';button.onclick=()=>window.TPFAutomationControlCenter?.open();anchor.before(button);last=0;}
 else if(button.parentElement!==anchor.parentElement&&!button.closest('.tdQuickItems'))anchor.before(button);
 if(!document.getElementById('waMonitorStyles')){const s=document.createElement('style');s.id='waMonitorStyles';s.textContent='.waMonitorButton{display:inline-flex!important;align-items:center;gap:7px;white-space:nowrap;padding:9px 11px!important;font-size:12px!important}.waMonitorCount{display:inline-flex;align-items:center;justify-content:center;min-width:22px;padding:2px 6px;border-radius:12px;background:#eaf2ff;color:#175cd3;font-weight:800}.waMonitorWarning{padding:2px 6px;border-radius:12px;background:#fff1d6;color:#9a6700;font-weight:800}.waMonitorButton [hidden]{display:none!important}.waMonitorButton.hasWarning{border-color:#e9bd68!important}';s.textContent+='.waMonitorSummary{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:9px 13px;margin:0 0 14px;border:1px solid #d7e5f7;border-radius:9px;background:#eaf2ff;color:#34546f;font-size:12px}.waMonitorSummary b{font-size:14px;color:#175cd3}.waMonitorSummaryNote{margin-left:auto;color:#426752;font-size:11px}.waMonitorSummary.hasWarning .waMonitorSummaryNote{color:#9a6700}.waMonitorSummary button{border:0!important;background:transparent!important;color:#175cd3!important;padding:0!important;font-size:12px!important;font-weight:700}.waMonitorSummary button:hover{text-decoration:underline}.waMonitorSummary [hidden]{display:none!important}.waMonitorButton .waMonitorCount{display:none}@media(max-width:700px){.waMonitorSummary{gap:8px 13px}.waMonitorSummaryNote{margin-left:0}.waMonitorSummary button{margin-left:auto}}';document.head.appendChild(s);}
 let summary=document.getElementById('waSendMonitorSummary');
 const heading=home.querySelector('.tdCommandBar');
 if(heading){
  if(!summary){summary=document.createElement('div');summary.id='waSendMonitorSummary';summary.className='waMonitorSummary';summary.setAttribute('aria-label','Resumen de envíos de WhatsApp');summary.innerHTML='<strong>WhatsApp</strong><span><b data-wa-sent>—</b> enviados hoy</span><span><b data-wa-summary-pending>—</b> pendientes hoy</span><span><b data-wa-unanswered>—</b> recordatorios sin respuesta</span><span data-wa-summary-note class="waMonitorSummaryNote">Actualizando…</span><button type="button" data-wa-open>Ver envíos →</button>';summary.querySelector('[data-wa-open]').onclick=()=>window.TPFAutomationControlCenter?.open();heading.after(summary);if(data)paint(button,data);}
  else if(summary.previousElementSibling!==heading)heading.after(summary);
 }
 return button;
}
function paint(button,d){
 const pending=Number(d.pending_today||0)+Number(d.manual_pending_today||0),issues=Number(d.failed_24h||0)+Number(d.duplicate_pending||0);
 button.querySelector('[data-wa-pending]').textContent=String(pending);
 const warning=button.querySelector('[data-wa-warning]');warning.hidden=!issues&&d.enabled!==false;warning.textContent=d.enabled===false?'Pausado':'⚠ '+issues;
 button.classList.toggle('hasWarning',issues>0||d.enabled===false);
 button.title=pending+' pendientes hoy · '+Number(d.sent_today||0)+' enviados hoy'+(issues?' · '+issues+' avisos de fallos o duplicados':'')+(d.enabled===false?' · Automatizaciones pausadas':'');
 button.setAttribute('aria-label','Envíos y avisos · '+button.title);
 const summary=document.getElementById('waSendMonitorSummary');if(summary){summary.querySelector('[data-wa-sent]').textContent=String(Number(d.sent_today||0));summary.querySelector('[data-wa-summary-pending]').textContent=String(pending);summary.querySelector('[data-wa-unanswered]').textContent=String(Number(d.unanswered_reminders||0));const note=[];if(d.enabled===false)note.push('Automatizaciones pausadas');if(Number(d.failed_24h||0))note.push(Number(d.failed_24h)+' fallos en 24 h');if(Number(d.duplicate_pending||0))note.push(Number(d.duplicate_pending)+' posibles duplicados');summary.querySelector('[data-wa-summary-note]').textContent=note.join(' · ')||'✓ Sin fallos ni duplicados';summary.classList.toggle('hasWarning',issues>0||d.enabled===false);}

}
async function refresh(force=false){
 const button=mount();if(!button||busy||(!force&&Date.now()-last<60000)||document.getElementById('app')?.classList.contains('hidden')||(!force&&document.getElementById('view-dashboard')?.classList.contains('hidden')))return;
 busy=true;try{const r=await sb.rpc('crm_whatsapp_send_monitor');if(r.error)throw r.error;data=r.data||{};last=Date.now();paint(button,data);}catch(e){button.querySelector('[data-wa-pending]').textContent='—';button.title='Abrir envíos. No se pudo actualizar el resumen.';const summary=document.getElementById('waSendMonitorSummary');if(summary){summary.querySelectorAll('b').forEach(el=>el.textContent='—');summary.querySelector('[data-wa-summary-note]').textContent='No se pudo actualizar';summary.classList.add('hasWarning');}last=Date.now();}finally{busy=false;}
}
window.TPFWhatsappSendMonitor={refresh,getData:()=>data};
document.addEventListener('click',e=>{if(e.target.closest?.('.nav[data-view="dashboard"],#dashRefresh'))setTimeout(()=>refresh(true),300);},true);
const home=document.getElementById('view-dashboard');if(home)new MutationObserver(()=>{if(mountTimer)return;mountTimer=setTimeout(()=>{mountTimer=0;refresh();},80);}).observe(home,{childList:true,subtree:true});
setInterval(()=>refresh(),15000);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>refresh());else refresh();
})();

