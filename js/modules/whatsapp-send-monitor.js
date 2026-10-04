(function(){
'use strict';
let busy=false,last=0,data=null,mountTimer=0;
function mount(){
 const home=document.getElementById('view-dashboard');if(!home)return null;
 const anchor=home.querySelector('#dashRefresh');if(!anchor)return null;
 let button=document.getElementById('waSendMonitor');
 if(button&&button.tagName!=='BUTTON'){button.remove();button=null;}
 if(!button){button=document.createElement('button');button.id='waSendMonitor';button.type='button';button.className='tdHeroGhost secondary waMonitorButton';button.innerHTML='<span>Envíos y avisos</span><span data-wa-pending class="waMonitorCount">…</span><span data-wa-warning class="waMonitorWarning" hidden></span>';button.onclick=()=>window.TPFAutomationControlCenter?.open();anchor.before(button);last=0;}
 else if(button.parentElement!==anchor.parentElement)anchor.before(button);
 if(!document.getElementById('waMonitorStyles')){const s=document.createElement('style');s.id='waMonitorStyles';s.textContent='.waMonitorButton{display:inline-flex!important;align-items:center;gap:7px;white-space:nowrap;padding:9px 11px!important;font-size:12px!important}.waMonitorCount{display:inline-flex;align-items:center;justify-content:center;min-width:22px;padding:2px 6px;border-radius:12px;background:#eaf2ff;color:#175cd3;font-weight:800}.waMonitorWarning{padding:2px 6px;border-radius:12px;background:#fff1d6;color:#9a6700;font-weight:800}.waMonitorButton [hidden]{display:none!important}.waMonitorButton.hasWarning{border-color:#e9bd68!important}';document.head.appendChild(s);}
 return button;
}
function paint(button,d){
 const pending=Number(d.pending_today||0)+Number(d.manual_pending_today||0),issues=Number(d.failed_24h||0)+Number(d.duplicate_pending||0);
 button.querySelector('[data-wa-pending]').textContent=String(pending);
 const warning=button.querySelector('[data-wa-warning]');warning.hidden=!issues&&d.enabled!==false;warning.textContent=d.enabled===false?'Pausado':'⚠ '+issues;
 button.classList.toggle('hasWarning',issues>0||d.enabled===false);
 button.title=pending+' pendientes hoy · '+Number(d.sent_today||0)+' enviados hoy'+(issues?' · '+issues+' avisos de fallos o duplicados':'')+(d.enabled===false?' · Automatizaciones pausadas':'');
 button.setAttribute('aria-label','Envíos y avisos · '+button.title);
}
async function refresh(force=false){
 const button=mount();if(!button||busy||(!force&&Date.now()-last<60000)||document.getElementById('app')?.classList.contains('hidden')||(!force&&document.getElementById('view-dashboard')?.classList.contains('hidden')))return;
 busy=true;try{const r=await sb.rpc('crm_whatsapp_send_monitor');if(r.error)throw r.error;data=r.data||{};last=Date.now();paint(button,data);}catch(e){button.querySelector('[data-wa-pending]').textContent='—';button.title='Abrir envíos. No se pudo actualizar el resumen.';last=Date.now();}finally{busy=false;}
}
window.TPFWhatsappSendMonitor={refresh,getData:()=>data};
document.addEventListener('click',e=>{if(e.target.closest?.('.nav[data-view="dashboard"],#dashRefresh'))setTimeout(()=>refresh(true),300);},true);
const home=document.getElementById('view-dashboard');if(home)new MutationObserver(()=>{if(mountTimer)return;mountTimer=setTimeout(()=>{mountTimer=0;refresh();},80);}).observe(home,{childList:true,subtree:true});
setInterval(()=>refresh(),15000);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>refresh());else refresh();
})();
