const https = require('https');

const RAW_INDEX = 'https://raw.githubusercontent.com/jramon07-lab/the_phone_face/main/index.html';

function getText(url){
  return new Promise((resolve,reject)=>{
    https.get(url,{headers:{'User-Agent':'The-Phone-Face-Vercel'}},r=>{
      if(r.statusCode>=300 && r.statusCode<400 && r.headers.location){
        r.resume(); return getText(r.headers.location).then(resolve,reject);
      }
      if(r.statusCode!==200){r.resume(); return reject(new Error('HTTP '+r.statusCode));}
      let body=''; r.setEncoding('utf8');
      r.on('data',c=>body+=c); r.on('end',()=>resolve(body));
    }).on('error',reject);
  });
}

const PATCH = String.raw`<script id="tpf-agenda-global-v2">
/* TPF AGENDA GLOBAL V2 */
(function(){
const D={reminder_minutes:[10],notify_in_app:true,notify_email:false,sync_google_calendar:false};let c={...D};const $=id=>document.getElementById(id);
async function load(){try{const {data,error}=await sb.from('app_settings').select('value').eq('key','agenda_global_defaults').maybeSingle();if(error)throw error;if(data?.value&&typeof data.value==='object')c={...D,...data.value}}catch(e){try{c={...D,...JSON.parse(localStorage.getItem('tpf_agenda_global_defaults')||'{}')}}catch(_){}}apply();fill()}
function apply(){const m=(c.reminder_minutes||[]).map(Number);document.querySelectorAll('.agendaReminderPreset').forEach(x=>x.checked=m.includes(Number(x.value)));if($('agendaNotifyApp'))$('agendaNotifyApp').checked=!!c.notify_in_app;if($('agendaNotifyEmail'))$('agendaNotifyEmail').checked=!!c.notify_email;if($('agendaSyncGoogle'))$('agendaSyncGoogle').checked=!!c.sync_google_calendar}
function hideAvisos(){const b=$('agendaCreateCard');if(!b)return;const card=[...b.querySelectorAll(':scope > .card')].find(x=>/avisos/i.test(x.textContent||''));if(!card)return;card.style.display='none';if(!$('agendaGlobalInfo')){const n=document.createElement('div');n.id='agendaGlobalInfo';n.className='small';n.style.cssText='margin:10px 0 14px;padding:11px 13px;border:1px solid #dfe7f3;border-radius:8px;background:#f8fbff;color:#536070';n.innerHTML='🔔 Los avisos se aplican automáticamente desde <b>Ajustes → Avisos de Agenda</b>.';card.parentNode.insertBefore(n,card)}}
function ensure(){const v=$('view-settings');if(!v||$('agendaGlobalSettingsCard'))return;const card=document.createElement('div');card.id='agendaGlobalSettingsCard';card.className='card';card.innerHTML='<h3 style="margin-bottom:6px">🔔 Avisos de Agenda</h3><div class="small" style="margin-bottom:14px">Configuración general para todos los usuarios. Se aplica automáticamente a los nuevos recordatorios.</div><div style="font-weight:700;font-size:13px;margin-bottom:8px">Avisarme antes</div><div id="agendaGlobalMinutes" class="row" style="margin-bottom:12px"><label><input type="checkbox" value="10" style="width:auto"> 10 min antes</label><label><input type="checkbox" value="30" style="width:auto"> 30 min antes</label><label><input type="checkbox" value="60" style="width:auto"> 1 hora antes</label><label><input type="checkbox" value="120" style="width:auto"> 2 horas antes</label><label><input type="checkbox" value="1440" style="width:auto"> 1 día antes</label></div><div style="font-weight:700;font-size:13px;margin-bottom:8px">Canales</div><div class="row" style="margin-bottom:14px"><label><input id="agendaGlobalApp" type="checkbox" style="width:auto"> Aviso en The Phone Face</label><label><input id="agendaGlobalEmail" type="checkbox" style="width:auto"> Email</label><label><input id="agendaGlobalGoogle" type="checkbox" style="width:auto"> Añadir a Google Calendar</label></div><button id="agendaGlobalSave" class="primary">Guardar avisos para todos</button><span id="agendaGlobalMsg" class="small" style="margin-left:10px"></span>';const first=v.querySelector('.card');if(first&&first.nextSibling)v.insertBefore(card,first.nextSibling);else v.appendChild(card);$('agendaGlobalSave').onclick=save;fill()}
function fill(){if(!$('agendaGlobalSettingsCard'))return;const m=(c.reminder_minutes||[]).map(Number);document.querySelectorAll('#agendaGlobalMinutes input').forEach(x=>x.checked=m.includes(Number(x.value)));if($('agendaGlobalApp'))$('agendaGlobalApp').checked=!!c.notify_in_app;if($('agendaGlobalEmail'))$('agendaGlobalEmail').checked=!!c.notify_email;if($('agendaGlobalGoogle'))$('agendaGlobalGoogle').checked=!!c.sync_google_calendar}
async function save(){const msg=$('agendaGlobalMsg');const value={reminder_minutes:[...document.querySelectorAll('#agendaGlobalMinutes input:checked')].map(x=>Number(x.value)),notify_in_app:!!$('agendaGlobalApp')?.checked,notify_email:!!$('agendaGlobalEmail')?.checked,sync_google_calendar:!!$('agendaGlobalGoogle')?.checked};if(msg)msg.textContent='Guardando...';localStorage.setItem('tpf_agenda_global_defaults',JSON.stringify(value));try{const {error}=await sb.from('app_settings').upsert({key:'agenda_global_defaults',value},{onConflict:'key'});if(error)throw error;c=value;apply();if(msg)msg.textContent='Guardado para todos ✓'}catch(e){if(msg)msg.textContent='No se pudo guardar para todos: '+(e?.message||e)}}
async function openFixed(id){try{if(typeof tpfRememberScreen==='function')tpfRememberScreen();$('contactModal')?.classList.remove('hidden');$('cpTaskPage')?.classList.remove('hidden');const cols=document.querySelector('#contactModal .cpColumns');if(cols)cols.style.display='none';const top=document.querySelector('#contactModal .cpTop');if(top)top.style.display='none';if(typeof openContactTaskDetail!=='function')throw new Error('No está disponible la ficha de tarea.');await openContactTaskDetail(id);$('cpTaskDetailPage')?.classList.remove('hidden')}catch(e){alert(e?.message||String(e))}}
function init(){window.openAgendaItem=openFixed;window.editAgendaItem=openFixed;ensure();hideAvisos();load();document.querySelectorAll('[data-view="agenda"],[data-view="settings"]').forEach(el=>el.addEventListener('click',()=>setTimeout(()=>{ensure();hideAvisos();apply()},100)));new MutationObserver(()=>{ensure();hideAvisos()}).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
</script>`;

module.exports=async function(req,res){try{const html=await getText(RAW_INDEX+'?v='+Date.now());const out=html.includes('</body>')?html.replace('</body>',PATCH+'\n</body>'):html+PATCH;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store, max-age=0');res.status(200).send(out)}catch(e){res.status(500).send('No se pudo cargar The Phone Face: '+(e?.message||e))}};
