(function(){
'use strict';
let busy=false,last=0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function mount(){
 const home=document.getElementById('view-dashboard');if(!home||document.getElementById('waSendMonitor'))return;
 const card=document.createElement('section');card.id='waSendMonitor';card.className='dashPanel';
 card.innerHTML='<div class="dashPanelHead"><h3>Control de envíos de WhatsApp</h3><button type="button" data-wa-refresh class="linkBtn">Actualizar</button></div><div data-wa-counts>Cargando…</div><p data-wa-notice class="small"></p><div class="row"><button type="button" data-wa-detail class="secondary">Ver envíos</button><button type="button" data-wa-pause class="secondary" disabled>Pausar automatizaciones</button></div><p class="small">Cuenta mensajes registrados en el CRM. Los pendientes incluyen envíos ya preparados y pueden aumentar al avanzar las automatizaciones. Estos datos no indican denuncias ni garantizan que WhatsApp no restrinja la cuenta.</p>';
 const anchor=home.querySelector('.tdPulseGrid,.dashHero,.tdCommandBar');if(anchor)anchor.after(card);else home.prepend(card);
 card.querySelector('[data-wa-refresh]').onclick=()=>refresh(true);
 card.querySelector('[data-wa-detail]').onclick=()=>window.TPFAutomationControlCenter?.open();
 card.querySelector('[data-wa-pause]').onclick=async()=>{if(busy)return;const button=card.querySelector('[data-wa-pause]'),paused=button.dataset.enabled==='true';if(!confirm(paused?'¿Pausar el motor de automatizaciones? Los envíos manuales seguirán disponibles y los mensajes ya en envío pueden completarse.':'¿Reanudar el motor de automatizaciones? Se procesarán los pendientes, incluidos los vencidos.'))return;busy=true;button.disabled=true;try{const r=await sb.rpc('crm_whatsapp_pause_engine',{p_paused:paused});if(r.error)throw r.error;}catch(e){card.querySelector('[data-wa-notice]').textContent=e.message;}finally{busy=false;await refresh(true);}};
}
async function refresh(force=false){
 mount();const card=document.getElementById('waSendMonitor');if(!card||busy||(!force&&Date.now()-last<60000)||document.getElementById('app')?.classList.contains('hidden')||document.getElementById('view-dashboard')?.classList.contains('hidden'))return;
 busy=true;try{const r=await sb.rpc('crm_whatsapp_send_monitor');if(r.error)throw r.error;const d=r.data||{},items=[['Enviados hoy',d.sent_today],['Pendientes hoy',Number(d.pending_today||0)+Number(d.manual_pending_today||0)],['Recordatorios sin respuesta',d.unanswered_reminders],['Fallos en 24 h',d.failed_24h],['Posibles duplicados en cola',d.duplicate_pending]];
 card.querySelector('[data-wa-counts]').innerHTML='<div style="display:flex;flex-wrap:wrap;gap:24px;padding:12px 0">'+items.map(([label,value])=>'<div><span class="small">'+esc(label)+'</span><strong style="display:block;font-size:25px">'+esc(value||0)+'</strong></div>').join('')+'</div>';
 const notes=[];if(d.duplicate_pending>0)notes.push('Revisa los posibles duplicados antes de enviar.');if(d.failed_24h>0)notes.push('Hay envíos fallidos que revisar.');if(d.daily_average>=5&&d.sent_today>2*d.daily_average)notes.push('Hoy se supera el doble de la media diaria de los 7 días anteriores ('+d.daily_average+').');if(!d.enabled)notes.push('Motor de automatizaciones pausado.');
 card.querySelector('[data-wa-notice]').textContent=notes.join(' ')||'Sin avisos de fallos, duplicados o aumento de volumen en estos contadores.';
 const button=card.querySelector('[data-wa-pause]');button.dataset.enabled=String(d.enabled);button.textContent=d.enabled?'Pausar automatizaciones':'Reanudar automatizaciones';button.disabled=false;last=Date.now();
 }catch(e){card.querySelector('[data-wa-counts]').textContent='No se pudo cargar: '+e.message;}finally{busy=false;}
}
document.addEventListener('click',e=>{if(e.target.closest?.('.nav[data-view="dashboard"],#dashRefresh'))setTimeout(()=>refresh(true),300);},true);
const home=document.getElementById('view-dashboard');if(home)new MutationObserver(()=>refresh()).observe(home,{childList:true});
setInterval(()=>refresh(),15000);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>refresh());else refresh();
})();
