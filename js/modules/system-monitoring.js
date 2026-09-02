(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const LOCAL_ERROR_KEY='tpf_system_errors_v1';
const SYNCED_KEY='tpf_system_synced_v1';
const LOCAL_TEMP_KEYS=['tpf_system_errors_v1','tpf_system_synced_v1','tpf_external_checks_v1','tpf_wa_history_cache_v2','tpf_wa_chat_meta_v3','tpf_wa_action_stats'];
const SESSION_TEMP_PREFIXES=['tpf_alerts_v2_','tpfSalesLeft'];
const SAFE_CACHE_NAME=/^(tpf|the[-_ ]?phone[-_ ]?face|workbox)/i;
const INTERNAL_RPC=/crm_(report|list|set|cleanup)_system_event|crm_system_health_snapshot/i;
let rows=[],health=null,green={state:null,health:null},loading=false,lastAction='',searchTimer=null,storageInfo=null;
const sentAt=new Map();

function isAdmin(){try{return !!perms?.is_admin}catch(_){return false}}
function route(){return `${location.pathname}${location.hash||''}`.split('?')[0].slice(0,180)}
function version(){return String($('tpfBuildBadge')?.dataset?.tpfCommit||'').trim().slice(0,80)}
function device(){const ua=navigator.userAgent||'';if(/iphone|ipad|ipod/i.test(ua))return'iOS';if(/android/i.test(ua))return'Android';if(/windows/i.test(ua))return'Windows';if(/macintosh|mac os/i.test(ua))return'macOS';if(/linux/i.test(ua))return'Linux';return'Desconocido'}
function redactString(value){return String(value??'')
  .replace(/([?&](?:token|key|code|password|secret|access_token|refresh_token)=)[^&#\s]+/gi,'$1[REDACTADO]')
  .replace(/(authorization\s*:\s*bearer\s+)[^\s]+/gi,'$1[REDACTADO]')
  .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[REDACTADO]');}
function redact(value,key=''){
  if(/password|passwd|secret|token|authorization|cookie|api.?key/i.test(key))return'[REDACTADO]';
  if(Array.isArray(value))return value.slice(0,100).map(item=>redact(item));
  if(value&&typeof value==='object'){const out={};Object.entries(value).slice(0,100).forEach(([k,v])=>{out[k]=redact(v,k)});return out}
  return typeof value==='string'?redactString(value).slice(0,1200):value;
}
function simpleHash(value){let h=2166136261;for(const char of String(value||'')){h^=char.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
function synced(){try{return JSON.parse(localStorage.getItem(SYNCED_KEY)||'{}')||{}}catch(_){return{}}}
function markSynced(item){try{const all=synced(),key=simpleHash(`${item?.at||''}|${item?.type||''}|${item?.message||''}`);all[key]=Date.now();const keep=Object.fromEntries(Object.entries(all).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,120));localStorage.setItem(SYNCED_KEY,JSON.stringify(keep))}catch(_){}}
function wasSynced(item){return !!synced()[simpleHash(`${item?.at||''}|${item?.type||''}|${item?.message||''}`)]}
function inferModule(text){const value=String(text||'').toLowerCase();if(/green|whatsapp|\/api\/mobile-green/.test(value))return'WhatsApp';if(/agenda|task|tarea/.test(value))return'Agenda';if(/opportun|venta|sales/.test(value))return'Oportunidades';if(/record|contact|database/.test(value))return'Contactos';if(/automat|cron|server_automation/.test(value))return'Automatizaciones';if(/ocr|scan|tesseract|cámara|camera/.test(value))return'Escáner OCR';if(/auth|login|session|permiso/.test(value))return'Acceso y permisos';if(/supabase|rest\/v1|rpc\//.test(value))return'Supabase';return'Interfaz';}
function severityFor(type,text){const value=`${type||''} ${text||''}`.toLowerCase();if(/fatal|unhandled|promesa/.test(value))return'critical';if(/http 429|rate.?limit|límite/.test(value))return'warning';if(/http 4\d\d/.test(value))return'warning';return'error'}
function payload(input={}){const message=redactString(input.message||input.error||'Error desconocido').slice(0,500),detail=redactString(input.detail||'').slice(0,1000),module=input.module||inferModule(`${message} ${detail}`);return{
  p_source:input.source||'desktop',p_module:String(module).slice(0,80),p_severity:input.severity||severityFor(input.type,message),p_message:message,p_detail:detail,p_route:route(),p_device:device(),p_app_version:version(),p_context:{platform:navigator.platform||'',viewport:`${innerWidth}x${innerHeight}`,online:navigator.onLine,action:String(input.action||lastAction||'').slice(0,100),http_status:String(input.httpStatus||'')}
}}
async function report(input={}){
  if(typeof sb==='undefined'||!sb?.rpc)return false;
  const data=payload(input),joined=`${data.p_message} ${data.p_detail}`;if(INTERNAL_RPC.test(joined))return false;
  const key=simpleHash(`${data.p_source}|${data.p_module}|${data.p_severity}|${data.p_message}|${data.p_route}`),now=Date.now();if(now-Number(sentAt.get(key)||0)<30000)return true;sentAt.set(key,now);
  try{const {error}=await sb.rpc('crm_report_system_event',data);if(error)throw error;return true}catch(_){return false}
}
window.tpfReportSystemEvent=report;

function readLocalErrors(){try{const data=JSON.parse(localStorage.getItem(LOCAL_ERROR_KEY)||'[]');return Array.isArray(data)?data:[]}catch(_){return[]}}
async function flushLocalErrors(){for(const item of readLocalErrors().slice(0,60).reverse()){if(wasSynced(item)||INTERNAL_RPC.test(`${item?.message||''} ${item?.detail||''}`))continue;if(await report({type:item.type,message:item.message,detail:item.detail}))markSynced(item)}}
function capture(){
  addEventListener('tpf:system-error',event=>{const item=event.detail||{};report({type:item.type,message:item.message,detail:item.detail}).then(ok=>{if(ok)markSynced(item)})});
  addEventListener('tpf:module-error',event=>{const item=event.detail||{};if(item.module==='isolation-test'&&item.error==='fallo-controlado')return;report({source:'desktop',module:item.module||'Módulo',message:item.error||'Error interno del módulo',detail:item.context||'',severity:'error'})});
  addEventListener('error',event=>{const target=event.target;if(target&&target!==window&&(target.src||target.href)){report({message:'No se pudo cargar un recurso del CRM',detail:target.src||target.href,module:'Recursos',severity:'error'})}},true);
  document.addEventListener('click',event=>{const target=event.target?.closest?.('button,[data-view],[data-action],a');if(target)lastAction=(target.getAttribute('aria-label')||target.textContent||target.dataset?.view||target.dataset?.action||'').trim().replace(/\s+/g,' ').slice(0,100)},true);
}

function ensureUi(){
  const host=$('view-system');if(!host||$('tpfIncidentRegistry'))return;
  const head=host.querySelector('.systemStatusHead');if(head&&!$('systemExportDiagnostic')){const actions=document.createElement('div');actions.className='systemHeadActions';actions.innerHTML='<button id="systemReportProblem" class="secondary" type="button">Informar de un problema</button><button id="systemExportDiagnostic" class="secondary" type="button">Exportar diagnóstico</button>';head.appendChild(actions)}
  const anchor=$('tpfModuleStatusCard')||host.querySelector('.systemStatusCard');
  const operations=document.createElement('div');operations.id='tpfOperationalChecks';operations.className='card';operations.innerHTML='<div class="systemStatusHead"><div><h3>Servicios y procesos automáticos</h3><p class="small">Comprobación real de cron, automatizaciones, envíos programados y GREEN-API.</p></div><span id="tpfOperationsChecked" class="small">Pendiente</span></div><div id="tpfOperationsGrid" class="tpfOperationsGrid"><div class="systemEmpty">Comprobando servicios…</div></div>';
  const registry=document.createElement('div');registry.id='tpfIncidentRegistry';registry.className='card';registry.innerHTML='<div class="systemStatusHead"><div><h3>Registro diario de incidencias</h3><p class="small">Errores detectados en ordenador y móvil, compartidos entre dispositivos.</p></div><button id="tpfIncidentRefresh" class="secondary" type="button">Actualizar registro</button></div><div id="tpfIncidentMetrics" class="tpfIncidentMetrics"></div><div class="tpfIncidentFilters"><select id="tpfIncidentDays" aria-label="Periodo"><option value="1">Hoy</option><option value="7" selected>7 días</option><option value="30">30 días</option><option value="90">90 días</option><option value="0">Todo</option></select><select id="tpfIncidentStatus" aria-label="Estado"><option value="all">Todos los estados</option><option value="active">Activas</option><option value="resolved">Resueltas</option><option value="ignored">Ignoradas</option></select><input id="tpfIncidentSearch" type="search" placeholder="Buscar error, módulo o dispositivo…" aria-label="Buscar incidencias"></div><div id="tpfIncidentList" class="tpfIncidentTableWrap"><div class="systemEmpty">Cargando incidencias…</div></div><p class="systemCoverageNote">Se registran fallos técnicos detectables (JavaScript, red, APIs, guardados, permisos, WhatsApp, automatizaciones y OCR). Un fallo puramente visual puede no generar error; para eso usa “Informar de un problema”.</p>';
  const maintenance=document.createElement('div');maintenance.id='tpfMaintenanceCard';maintenance.className='card';maintenance.innerHTML='<div class="systemStatusHead"><div><h3>Mantenimiento seguro</h3><p class="small">Libera caché y temporales técnicos sin tocar ningún dato comercial.</p></div><button id="tpfMaintenanceScan" class="secondary" type="button">Analizar espacio</button></div><div class="tpfMaintenanceGrid"><div class="tpfMaintenanceBox"><span>Caché y temporales de este navegador</span><b id="tpfBrowserStorage">Analizando…</b><small id="tpfBrowserStorageDetail">Solo recursos y copias técnicas regenerables.</small><button id="tpfCleanBrowser" class="secondary" type="button">Limpiar caché segura</button></div><div class="tpfMaintenanceBox"><span>Historial técnico central</span><b>Conservación protegida</b><small>Solo elimina incidencias resueltas o ignoradas con más de 30 días.</small><button id="tpfCleanCentral" class="secondary" type="button">Eliminar temporales antiguos</button></div><div class="tpfMaintenanceBox"><span>Temporales del servidor</span><b>Limpieza automática</b><small>Vercel no los conserva entre ejecuciones, por lo que no se acumulan ni requieren borrado manual.</small></div></div><div class="tpfProtectedData"><b>Siempre protegido:</b> contactos, oportunidades, tareas, agenda, chats, archivos de clientes, plantillas, usuarios, sesiones y configuración.</div><div id="tpfMaintenanceResult" class="small" aria-live="polite"></div>';
  anchor?.after(operations);operations.after(registry);registry.after(maintenance);
  const dialog=document.createElement('dialog');dialog.id='tpfProblemDialog';dialog.className='tpfProblemDialog';dialog.innerHTML='<form method="dialog"><div class="systemStatusHead"><div><h3>Informar de un problema</h3><p class="small">Añádelo al registro central para poder revisarlo.</p></div><button value="cancel" class="secondary" type="submit">Cerrar</button></div><label>Módulo<select id="tpfProblemModule"><option>Interfaz</option><option>Contactos</option><option>Oportunidades</option><option>Agenda</option><option>WhatsApp</option><option>Automatizaciones</option><option>Escáner OCR</option><option>Acceso y permisos</option><option>Otro</option></select></label><label>Qué ha ocurrido<textarea id="tpfProblemText" maxlength="500" required placeholder="Describe qué estabas haciendo y qué ha fallado"></textarea></label><div class="tpfDialogActions"><button value="cancel" class="secondary" type="submit">Cancelar</button><button id="tpfProblemSend" value="default" class="primary" type="button">Guardar incidencia</button></div><div id="tpfProblemResult" class="small" aria-live="polite"></div></form>';document.body.appendChild(dialog);
}

function badge(state,label){return `<span class="tpfStatusBadge ${esc(state)}">${esc(label)}</span>`}
function severityLabel(value){return({critical:'Crítica',error:'Error',warning:'Aviso',info:'Info'})[value]||value}
function statusLabel(value){return({active:'Activa',resolved:'Resuelta',ignored:'Ignorada'})[value]||value}
function sourceLabel(value){return({desktop:'PC',mobile:'Móvil',manual:'Manual',health:'Sistema',automation:'Automatización',frontend:'Interfaz'})[value]||value}
function fmt(value){const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'})}
function renderRows(){
  const metrics=$('tpfIncidentMetrics'),list=$('tpfIncidentList');if(!metrics||!list)return;
  const active=rows.filter(x=>x.status==='active').length,critical=rows.filter(x=>x.status==='active'&&x.severity==='critical').length,resolved=rows.filter(x=>x.status==='resolved').length;
  metrics.innerHTML=`<div><span>Activas</span><b>${active}</b></div><div class="critical"><span>Críticas</span><b>${critical}</b></div><div class="resolved"><span>Resueltas</span><b>${resolved}</b></div><div><span>Resultados</span><b>${rows.length}</b></div>`;
  if(!rows.length){list.innerHTML='<div class="systemEmpty"><b>Sin incidencias en este periodo</b><span>Los errores nuevos aparecerán aquí automáticamente.</span></div>';return}
  list.innerHTML=`<table class="tpfIncidentTable"><thead><tr><th>Última detección</th><th>Módulo</th><th>Dispositivo</th><th>Incidencia</th><th>Severidad</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map(item=>`<tr><td data-label="Última detección"><b>${esc(fmt(item.last_seen_at))}</b><small>${Number(item.occurrences||1)>1?`${Number(item.occurrences)} veces`:''}</small></td><td data-label="Módulo">${esc(item.module||'General')}</td><td data-label="Dispositivo">${esc(sourceLabel(item.source))} · ${esc(item.device||'—')}</td><td data-label="Incidencia"><b>${esc(item.message)}</b>${item.detail?`<small>${esc(item.detail)}</small>`:''}${item.route?`<small>${esc(item.route)}</small>`:''}</td><td data-label="Severidad">${badge(item.severity,severityLabel(item.severity))}</td><td data-label="Estado">${badge(item.status,statusLabel(item.status))}</td><td>${item.status==='active'?`<button class="tpfRowAction" data-system-resolve="${item.id}" type="button">Resolver</button>`:`<button class="tpfRowAction" data-system-reopen="${item.id}" type="button">Reabrir</button>`}</td></tr>`).join('')}</tbody></table>`;
}
function healthState(problem,warn=false){return problem?'bad':warn?'warn':'ok'}
function healthTile(title,state,value,detail){return `<div class="tpfOperation ${state}"><span class="systemDot ${state==='ok'?'systemDotOk':state==='warn'?'systemDotWarn':'systemDotBad'}"></span><div><strong>${esc(title)}</strong><b>${esc(value)}</b><small>${esc(detail)}</small></div></div>`}
function renderHealth(){
  const grid=$('tpfOperationsGrid');if(!grid)return;const h=health||{},cron=h.cron||{},auto=h.automations||{},wa=h.whatsapp||{},gh=green.health||{},gs=green.state||{};
  const greenAuthorized=String(gh.state||gs.state||gs.data?.stateInstance||'').toLowerCase()==='authorized',greenBad=gh.ok===false||gs.ok===false,greenWarn=!greenBad&&(!greenAuthorized||gh.degraded===true||gh.providerHealthy===false);
  const cronProblem=Number(cron.latest_failed||0)+Number(cron.stalled||0)>0,autoProblem=Number(auto.stuck||0)>0,waOverdue=Number(wa.overdue_jobs||0)+Number(wa.overdue_agenda||0),waFailed=Number(wa.failed_jobs_24h||0)+Number(wa.failed_agenda_24h||0);
  grid.innerHTML=[
    healthTile('GREEN-API',healthState(greenBad,greenWarn),greenAuthorized?'Autorizado':greenBad?'No disponible':'Con aviso',greenAuthorized&&!greenWarn?'Estado y proveedor responden correctamente':'Revisa el estado del proveedor'),
    healthTile('Cron del servidor',healthState(cronProblem,Number(cron.failed_24h||0)>0),`${Number(cron.active||0)} activos`,cronProblem?`${Number(cron.latest_failed||0)} último fallo · ${Number(cron.stalled||0)} atascados`:`${Number(cron.failed_24h||0)} fallos en 24 h`),
    healthTile('Automatizaciones',healthState(autoProblem,Number(auto.failed_24h||0)>0),autoProblem?`${Number(auto.stuck||0)} atascadas`:'Sin atascos',`${Number(auto.failed_24h||0)} fallos en 24 h`),
    healthTile('WhatsApp programados',healthState(waOverdue>0,waFailed>0),waOverdue?`${waOverdue} vencidos`:'Al día',`${waFailed} fallos en 24 h`)
  ].join('');if($('tpfOperationsChecked'))$('tpfOperationsChecked').textContent=h.checked_at?`Comprobado ${fmt(h.checked_at)}`:'Comprobación incompleta';
}
async function loadAll(){
  if(!isAdmin()||loading)return;ensureUi();loading=true;if($('tpfIncidentList'))$('tpfIncidentList').innerHTML='<div class="systemEmpty">Actualizando registro…</div>';
  const days=Number($('tpfIncidentDays')?.value||7),status=$('tpfIncidentStatus')?.value||'all',search=$('tpfIncidentSearch')?.value?.trim()||'';
  try{
    const [eventsResult,healthResult,greenHealthResponse,greenStateResponse]=await Promise.all([
      sb.rpc('crm_list_system_events',{p_days:days,p_limit:250,p_status:status,p_search:search}),
      sb.rpc('crm_system_health_snapshot'),
      fetch('/api/green-health',{cache:'no-store'}),
      fetch('/api/green?action=state',{cache:'no-store'})
    ]);
    if(eventsResult.error)throw eventsResult.error;if(healthResult.error)throw healthResult.error;rows=eventsResult.data||[];health=healthResult.data||{};
    green.health=await greenHealthResponse.json().catch(()=>({ok:false}));green.state=await greenStateResponse.json().catch(()=>({ok:false}));renderRows();renderHealth();
  }catch(error){if($('tpfIncidentList'))$('tpfIncidentList').innerHTML=`<div class="systemEmpty"><b>No se pudo cargar el registro central</b><span>${esc(error?.message||'Inténtalo de nuevo.')}</span></div>`;report({source:'health',module:'Estado del sistema',message:'No se pudo cargar el registro central',detail:error?.message||'',severity:'error'})}
  finally{loading=false;scanStorage()}
}

async function scanStorage(){
  let bytes=0,items=0,cacheNames=[];for(const key of LOCAL_TEMP_KEYS){const value=localStorage.getItem(key);if(value!==null){bytes+=new Blob([value]).size;items++}}for(let i=0;i<sessionStorage.length;i++){const key=sessionStorage.key(i)||'';if(SESSION_TEMP_PREFIXES.some(prefix=>key.startsWith(prefix))){bytes+=new Blob([sessionStorage.getItem(key)||'']).size;items++}}
  try{cacheNames=(await caches.keys()).filter(name=>SAFE_CACHE_NAME.test(name));items+=cacheNames.length}catch(_){}
  let estimate=null;try{estimate=await navigator.storage?.estimate?.()}catch(_){}storageInfo={bytes,items,cacheNames,estimate};const size=bytes<1024?`${bytes} B`:bytes<1048576?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1048576).toFixed(1)} MB`;if($('tpfBrowserStorage'))$('tpfBrowserStorage').textContent=items?`${size} eliminables`:'Sin temporales pendientes';if($('tpfBrowserStorageDetail'))$('tpfBrowserStorageDetail').textContent=`${items} elemento(s) técnico(s) regenerable(s). No incluye datos del CRM.`;
}
async function cleanBrowser(){
  await flushLocalErrors();await scanStorage();if(!confirm(`Se eliminarán ${storageInfo?.items||0} elementos de caché y temporales regenerables de este navegador. No se borrará ningún dato del CRM. ¿Continuar?`))return;let removed=0;
  for(const key of LOCAL_TEMP_KEYS){if(localStorage.getItem(key)!==null){localStorage.removeItem(key);removed++}}
  const sessionKeys=[];for(let i=0;i<sessionStorage.length;i++)sessionKeys.push(sessionStorage.key(i)||'');for(const key of sessionKeys){if(SESSION_TEMP_PREFIXES.some(prefix=>key.startsWith(prefix))){sessionStorage.removeItem(key);removed++}}
  try{for(const name of(await caches.keys()).filter(item=>SAFE_CACHE_NAME.test(item))){if(await caches.delete(name))removed++}}catch(_){}
  if($('tpfMaintenanceResult'))$('tpfMaintenanceResult').textContent=`Limpieza terminada: ${removed} elemento(s) técnico(s) eliminados. Los datos del CRM siguen intactos.`;await scanStorage();window.renderSystemErrors?.();
}
async function cleanCentral(){if(!confirm('Solo se eliminarán incidencias resueltas o ignoradas con más de 30 días. Las incidencias activas y todos los datos del CRM se conservarán. ¿Continuar?'))return;const {data,error}=await sb.rpc('crm_cleanup_system_events',{p_older_than_days:30});if(error){$('tpfMaintenanceResult').textContent=error.message;return}$('tpfMaintenanceResult').textContent=`Limpieza central terminada: ${Number(data||0)} registro(s) técnico(s) antiguo(s) eliminados.`;await loadAll()}
async function setStatus(id,status){const {error}=await sb.rpc('crm_set_system_event_status',{p_id:Number(id),p_status:status});if(error){alert(error.message);return}await loadAll()}
async function submitProblem(){const text=$('tpfProblemText')?.value?.trim();if(!text){$('tpfProblemResult').textContent='Describe brevemente lo que ha ocurrido.';return}const button=$('tpfProblemSend');button.disabled=true;button.textContent='Guardando…';const ok=await report({source:'manual',module:$('tpfProblemModule')?.value||'Otro',severity:'error',message:text,detail:`Acción anterior: ${lastAction||'no disponible'}`});button.disabled=false;button.textContent='Guardar incidencia';if(!ok){$('tpfProblemResult').textContent='No se pudo guardar. Comprueba la conexión y vuelve a intentarlo.';return}$('tpfProblemText').value='';$('tpfProblemDialog').close();await loadAll()}

function diagnostic(){let modules=[];try{modules=M.status?.()||[]}catch(_){}return redact({schema:'tpf-diagnostic-v1',generated_at:new Date().toISOString(),app:{host:location.host,route:route(),version:version(),online:navigator.onLine,viewport:`${innerWidth}x${innerHeight}`,device:device(),user_agent:navigator.userAgent},modules,system_errors:readLocalErrors(),central_summary:{rows:rows.length,active:rows.filter(x=>x.status==='active').length,critical:rows.filter(x=>x.status==='active'&&x.severity==='critical').length},health})}
window.tpfBuildDiagnostic=diagnostic;
function exportDiagnostic(){const blob=new Blob([JSON.stringify(diagnostic(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`tpf-diagnostico-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

function bind(){
  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('button,[data-system-resolve],[data-system-reopen]');if(!target)return;
    if(target.id==='systemRefresh'||target.id==='tpfIncidentRefresh')setTimeout(loadAll,80);
    if(target.id==='systemExportDiagnostic')exportDiagnostic();
    if(target.id==='systemReportProblem')$('tpfProblemDialog')?.showModal();
    if(target.id==='tpfProblemSend')submitProblem();
    if(target.id==='tpfMaintenanceScan')scanStorage();
    if(target.id==='tpfCleanBrowser')cleanBrowser();
    if(target.id==='tpfCleanCentral')cleanCentral();
    if(target.dataset.systemResolve)setStatus(target.dataset.systemResolve,'resolved');
    if(target.dataset.systemReopen)setStatus(target.dataset.systemReopen,'active');
    if(target.closest?.('.nav[data-view="system"]'))setTimeout(loadAll,180);
  });
  document.addEventListener('change',event=>{if(['tpfIncidentDays','tpfIncidentStatus'].includes(event.target?.id))loadAll()});
  document.addEventListener('input',event=>{if(event.target?.id!=='tpfIncidentSearch')return;clearTimeout(searchTimer);searchTimer=setTimeout(loadAll,350)});
  addEventListener('tpf:system-status-refreshed',()=>setTimeout(loadAll,50));
}

M.register('system-monitoring',{install(){capture();ensureUi();bind();setTimeout(flushLocalErrors,1200);setTimeout(scanStorage,250);}});
})();
