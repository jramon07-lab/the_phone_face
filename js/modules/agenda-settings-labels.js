/* TPF AGENDA GLOBAL V4 + LABELS FIX - 2026-08-24 */
(function(){
const D={reminder_minutes:[10],notify_in_app:true,notify_email:false,sync_google_calendar:false};let c={...D};const $=id=>document.getElementById(id);
const localDateTime=v=>{if(!v)return '';const d=new Date(v);if(Number.isNaN(d.getTime()))return '';const z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+'T'+z(d.getHours())+':'+z(d.getMinutes())};
async function load(){try{const {data,error}=await sb.from('app_settings').select('value').eq('key','agenda_global_defaults').maybeSingle();if(error)throw error;if(data?.value&&typeof data.value==='object')c={...D,...data.value}}catch(e){try{c={...D,...JSON.parse(localStorage.getItem('tpf_agenda_global_defaults')||'{}')}}catch(_){}}apply();fill()}
function apply(){if($('agendaCreateCard')?.classList.contains('open'))return;const m=(c.reminder_minutes||[]).map(Number);document.querySelectorAll('.agendaReminderPreset').forEach(x=>x.checked=m.includes(Number(x.value)));if($('agendaNotifyApp'))$('agendaNotifyApp').checked=!!c.notify_in_app;if($('agendaNotifyEmail'))$('agendaNotifyEmail').checked=!!c.notify_email;if($('agendaSyncGoogle'))$('agendaSyncGoogle').checked=!!c.sync_google_calendar}
function ensure(){const v=$('view-settings');if(!v||$('agendaGlobalSettingsCard'))return;const card=document.createElement('div');card.id='agendaGlobalSettingsCard';card.className='card';card.innerHTML='<h3 style="margin-bottom:6px">🔔 Avisos de Agenda</h3><div class="small" style="margin-bottom:14px">Configuración general para todos los usuarios. Se aplica automáticamente a los nuevos recordatorios.</div><div style="font-weight:700;font-size:13px;margin-bottom:8px">Avisarme antes</div><div id="agendaGlobalMinutes" class="row" style="margin-bottom:12px"><label><input type="checkbox" value="10" style="width:auto"> 10 min antes</label><label><input type="checkbox" value="30" style="width:auto"> 30 min antes</label><label><input type="checkbox" value="60" style="width:auto"> 1 hora antes</label><label><input type="checkbox" value="120" style="width:auto"> 2 horas antes</label><label><input type="checkbox" value="1440" style="width:auto"> 1 día antes</label></div><div style="font-weight:700;font-size:13px;margin-bottom:8px">Canales</div><div class="row" style="margin-bottom:14px"><label><input id="agendaGlobalApp" type="checkbox" style="width:auto"> Aviso en The Phone Face</label><label><input id="agendaGlobalEmail" type="checkbox" style="width:auto"> Email</label><label><input id="agendaGlobalGoogle" type="checkbox" style="width:auto"> Añadir a Google Calendar</label></div><button id="agendaGlobalSave" class="primary">Guardar avisos para todos</button><span id="agendaGlobalMsg" class="small" style="margin-left:10px"></span>';const first=v.querySelector('.card');if(first&&first.nextSibling)v.insertBefore(card,first.nextSibling);else v.appendChild(card);$('agendaGlobalSave').onclick=save;fill()}
function fill(){if(!$('agendaGlobalSettingsCard'))return;const m=(c.reminder_minutes||[]).map(Number);document.querySelectorAll('#agendaGlobalMinutes input').forEach(x=>x.checked=m.includes(Number(x.value)));if($('agendaGlobalApp'))$('agendaGlobalApp').checked=!!c.notify_in_app;if($('agendaGlobalEmail'))$('agendaGlobalEmail').checked=!!c.notify_email;if($('agendaGlobalGoogle'))$('agendaGlobalGoogle').checked=!!c.sync_google_calendar}
async function save(){const msg=$('agendaGlobalMsg');const value={reminder_minutes:[...document.querySelectorAll('#agendaGlobalMinutes input:checked')].map(x=>Number(x.value)),notify_in_app:!!$('agendaGlobalApp')?.checked,notify_email:!!$('agendaGlobalEmail')?.checked,sync_google_calendar:!!$('agendaGlobalGoogle')?.checked};if(msg)msg.textContent='Guardando...';localStorage.setItem('tpf_agenda_global_defaults',JSON.stringify(value));try{const {error}=await sb.from('app_settings').upsert({key:'agenda_global_defaults',value},{onConflict:'key'});if(error)throw error;c=value;apply();if(msg)msg.textContent='Guardado para todos ✓'}catch(e){if(msg)msg.textContent='No se pudo guardar para todos: '+(e?.message||e)}}
let tpfLabels=[];
function escLabel(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]))}
function renderLabels(){
  const box=$('labelsGlobalList');if(!box)return;
  const q=($('labelSearch')?.value||'').trim().toLowerCase();
  const rows=tpfLabels.filter(x=>!q||String(x.name||'').toLowerCase().includes(q));
  box.innerHTML=rows.length?rows.map(x=>'<div class="labelManagerRow" data-label-id="'+escLabel(x.id)+'"><span>'+escLabel(x.name)+'</span><div><button type="button" class="secondary tpfLabelRename">Renombrar</button> <button type="button" class="danger tpfLabelDelete">Eliminar</button></div></div>').join(''):'';
  if($('labelsEmpty'))$('labelsEmpty').style.display=rows.length?'none':'';
}
async function loadLabelsFixed(){
  const {data,error}=await sb.rpc('crm_list_labels');
  if(error)throw error;
  tpfLabels=Array.isArray(data)?data:[];
  renderLabels();
  return tpfLabels;
}
async function createLabelFixed(){
  const input=$('labelNewName'),btn=$('labelCreate'),msg=$('labelCreateMsg');
  const name=(input?.value||'').trim();
  if(!name){if(msg)msg.textContent='Escribe un nombre para la etiqueta.';return;}
  if(btn)btn.disabled=true;if(msg)msg.textContent='Creando...';
  try{
    const {error}=await sb.rpc('crm_create_label',{p_name:name});
    if(error)throw error;
    if(input)input.value='';
    await loadLabelsFixed();
    if(msg)msg.textContent='Etiqueta creada ✓';
  }catch(e){if(msg)msg.textContent='Error: '+(e?.message||e)}finally{if(btn)btn.disabled=false}
}
async function renameLabelFixed(id){
  const item=tpfLabels.find(x=>String(x.id)===String(id));if(!item)return;
  const name=prompt('Nuevo nombre de la etiqueta',item.name||'');if(name===null)return;
  const clean=name.trim();if(!clean)return;
  const {error}=await sb.rpc('crm_rename_label',{p_id:id,p_name:clean});if(error){alert(error.message);return;}await loadLabelsFixed();
}
async function deleteLabelFixed(id){
  const item=tpfLabels.find(x=>String(x.id)===String(id));
  if(!confirm('¿Eliminar la etiqueta "'+(item?.name||'')+'"?'))return;
  const {error}=await sb.rpc('crm_delete_label',{p_id:id});if(error){alert(error.message);return;}await loadLabelsFixed();
}
function bindLabelsFixed(){
  document.addEventListener('click',e=>{
    const create=e.target.closest('#labelCreate');
    if(create){e.preventDefault();e.stopImmediatePropagation();createLabelFixed();return;}
    const reload=e.target.closest('#labelsReload');
    if(reload){e.preventDefault();e.stopImmediatePropagation();loadLabelsFixed().catch(err=>alert(err.message));return;}
    const ren=e.target.closest('.tpfLabelRename');
    if(ren){e.preventDefault();e.stopImmediatePropagation();renameLabelFixed(ren.closest('[data-label-id]')?.dataset.labelId);return;}
    const del=e.target.closest('.tpfLabelDelete');
    if(del){e.preventDefault();e.stopImmediatePropagation();deleteLabelFixed(del.closest('[data-label-id]')?.dataset.labelId);return;}
  },true);
  document.addEventListener('input',e=>{if(e.target?.id==='labelSearch')renderLabels()});
  document.querySelectorAll('[data-view="labels"]').forEach(el=>el.addEventListener('click',()=>setTimeout(()=>loadLabelsFixed().catch(err=>{if($('labelCreateMsg'))$('labelCreateMsg').textContent='Error: '+err.message}),100)));
}

window.TPFAgendaDefaults={get:()=>({...c,reminder_minutes:[...(c.reminder_minutes||[])]})};
function init(){ensure();load();bindLabelsFixed();document.querySelectorAll('[data-view="agenda"],[data-view="settings"]').forEach(el=>el.addEventListener('click',()=>setTimeout(()=>{ensure();apply()},100)));new MutationObserver(()=>{ensure();}).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
