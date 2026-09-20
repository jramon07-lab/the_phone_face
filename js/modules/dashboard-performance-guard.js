(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const D={built:false,busy:false,actionBusy:false,lastLoad:0,data:null,activityAll:false,activityFilter:'commercial',upcomingAll:false,backupJson:null,backupCsv:null,filter:'priority',query:'',pageSize:'10',page:0};
const WORK_STATE_KEY='tpf.home.worklist.v1';
function restoreWorkState(){try{const saved=JSON.parse(window.sessionStorage.getItem(WORK_STATE_KEY)||'null');if(!saved)return;if(['priority','calls','followup','processing'].includes(saved.filter))D.filter=saved.filter;if(typeof saved.query==='string')D.query=saved.query;if(['10','25','50','all'].includes(saved.pageSize))D.pageSize=saved.pageSize;if(Number.isInteger(saved.page)&&saved.page>=0)D.page=saved.page}catch(_){}}
function saveWorkState(){try{window.sessionStorage.setItem(WORK_STATE_KEY,JSON.stringify({filter:D.filter,query:D.query,pageSize:D.pageSize,page:D.page}))}catch(_){}}
restoreWorkState();

function appOpen(){const app=$('app');return !!app&&!app.classList.contains('hidden')}
function dashboardOpen(){const v=$('view-dashboard');return appOpen()&&!!v&&!v.classList.contains('hidden')}
function money(v){try{return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',minimumFractionDigits:2}).format(Number(v||0))}catch(_){return `${Number(v||0).toFixed(2)} €`}}
function localDay(v=new Date()){const d=v instanceof Date?v:new Date(v);if(!Number.isFinite(d.getTime()))return'';const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const x=Object.fromEntries(p.filter(a=>a.type!=='literal').map(a=>[a.type,a.value]));return `${x.year}-${x.month}-${x.day}`}
function localTime(v){const d=new Date(v);if(!Number.isFinite(d.getTime()))return'—';return d.toLocaleTimeString('es-ES',{timeZone:'Europe/Madrid',hour:'2-digit',minute:'2-digit'})}
function localDate(v){const k=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(k))return'—';return `${k.slice(8,10)}/${k.slice(5,7)}/${k.slice(0,4)}`}
function localDateTime(v){const d=new Date(v);if(!Number.isFinite(d.getTime()))return'—';return d.toLocaleString('es-ES',{timeZone:'Europe/Madrid',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function status(v){return String(v||'').trim().toLowerCase()}
function stageWon(n){return /ganad|cerrad.*gan|venta|contratad/i.test(String(n||''))}
function stageLost(n){return /perdid|rechazad|cancelad|cerrad.*per/i.test(String(n||''))}
function isWon(o,stages){return /won|ganad/.test(status(o.status))||stageWon(stages.get(String(o.stage_id))?.name)}
function isLost(o,stages){return /lost|perdid|cancelad|rechazad/.test(status(o.status))||stageLost(stages.get(String(o.stage_id))?.name)}
function isExpired(o,stages,today){return !isWon(o,stages)&&!isLost(o,stages)&&!!o.expected_date&&String(o.expected_date).slice(0,10)<today}
function isOpen(o,stages,today){return !isWon(o,stages)&&!isLost(o,stages)&&!isExpired(o,stages,today)}
function route(view){document.querySelector(`.nav[data-view="${view}"]`)?.click()}
function waitFor(check,message,ms=10000){return new Promise((resolve,reject)=>{const started=Date.now();function poll(){let value;try{value=check()}catch(error){reject(error);return}if(value){resolve(value);return}if(Date.now()-started>=ms){reject(new Error(message));return}setTimeout(poll,50)}poll()})}
function visible(id){const element=$(id);return element&&!element.classList.contains('hidden')?element:null}
async function runAction(fn){
  if(D.actionBusy)return;
  D.actionBusy=true;
  try{await fn()}catch(error){const message=error?.message||'No se pudo abrir esta acción. Vuelve a intentarlo.';const notice=$('tdDataStatus');if(notice){notice.hidden=false;notice.textContent=message}if(!dashboardOpen()&&typeof window.alert==='function')window.alert(message);else if(!notice)console.error('Inicio',error)}finally{D.actionBusy=false}
}
async function prepareSales(){
  const loader=await waitFor(()=>typeof window.loadSales==='function'&&window.loadSales,'El panel de ventas todavía no está disponible. Vuelve a intentarlo.');
  await loader();
}
async function openNewOpportunity(){
  await prepareSales();
  const button=await waitFor(()=>$('newOpp'),'No se encontró el botón de nueva oportunidad.');
  button.click();
  await waitFor(()=>visible('oppDetailModal'),'No se pudo abrir la nueva oportunidad. Comprueba tus permisos y las columnas de ventas.');
}
async function openNewContact(){
  route('database');
  const button=await waitFor(()=>$('tpfContactsAdd'),'El formulario de contactos todavía no está disponible.');
  button.click();
  await waitFor(()=>visible('tpfContactsCreateBack'),'No se pudo abrir el formulario de contacto. Comprueba tus permisos y vuelve a intentarlo.');
}
async function navigate(view){
  if(view!=='alerts-expired'){route(view);return}
  route('alerts');
  const button=await waitFor(()=>document.querySelector('#view-alerts .avCounter[data-kind="expired"]')||document.querySelector('#view-alerts [data-alert-filter="expired"]'),'No se pudo abrir el filtro de avisos vencidos.');
  button.click();
}
function initials(name){return String(name||'C').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'C'}
function queryWithTimeout(query,ms=9000){return Promise.race([Promise.resolve(query),new Promise(resolve=>setTimeout(()=>resolve({data:[],count:0,error:{message:'Tiempo de espera agotado'}}),ms))])}


function icon(name){
const paths={
 phone:'<path d="M5 3h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2Z"/>',
 file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 12h8M8 16h8"/>',
 list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01"/>',
 checkCircle:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 moreVertical:'<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
 down:'<path d="m6 9 6 6 6-6"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 11.6-2L20 8M4 16l2.4 3A7 7 0 0 0 18 17"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12a23 23 0 0 0 18 0M12 11v4"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 check:'<rect x="3" y="3" width="18" height="18" rx="5"/><path d="m7 12 3 3 7-7"/>',
 users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 chart:'<path d="M4 3v17h17M8 16v-5M13 16V7M18 16V4"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 17h2"/>',
 message:'<path d="M21 11a8 8 0 0 1-8 8H7l-5 3V11a9 9 0 0 1 19 0Z"/><path d="M7 10h9M7 14h5"/>',
 alert:'<path d="m10 4-8 14a2 2 0 0 0 2 3h16a2 2 0 0 0 2-3L14 4a2 2 0 0 0-4 0Z"/><path d="M12 9v4M12 17h.01"/>',
 stack:'<path d="m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>'
};
return '<svg class="tdIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.briefcase)+'</svg>';
}
function ensureCss(){
 if($('dashboardSafeProCss'))return;
 const link=document.createElement('link');link.id='dashboardSafeProCss';link.rel='stylesheet';
 link.href='/assets/dashboard-home.css?v=20260920-inicio-12';document.head.appendChild(link);
}

function build(){
  const v=$('view-dashboard');if(!v||D.built)return;
  D.backupJson=$('backupJson');D.backupCsv=$('backupCsv');
  v.classList.add('tpfDashPro');v.dataset.homeVersion='20260920-inicio-12';
  v.innerHTML=`
  <header class="tdCommandBar"><div class="tdPageIntro"><span class="tdPageEyebrow">THE PHONE FACE · INICIO</span><h1>Inicio</h1><div class="tdDate"><span id="tdGreeting">Tu centro de ventas</span><span aria-hidden="true">·</span><span id="tdToday"></span></div></div><div class="tdCommandActions"><div class="tdHeroQuick"><button id="dashNewOpp" class="tdHeroNew">${icon('plus')} Nueva oportunidad</button><button class="tdHeroGhost" data-home-action="new-contact">${icon('users')} Nuevo contacto</button><button class="tdHeroGhost" data-route="agenda">${icon('calendar')} Agenda</button></div><button id="dashRefresh" class="tdIconButton" aria-label="Actualizar Inicio" title="Actualizar Inicio">${icon('refresh')}</button><div class="tdMore"><button id="tdMoreBtn" class="tdIconButton" aria-label="Más opciones">${icon('more')}</button><div id="tdMoreMenu" class="tdMoreMenu hidden"><div id="tdBackupJson"></div><div id="tdBackupCsv"></div><div id="backupMsg" class="small"></div></div></div></div></header>
  <div id="tdDataStatus" class="tdDataStatus" role="status" hidden></div>
  <section class="tdSalesHero" aria-label="Resumen comercial"><div class="tdHeroNumber"><span>Oportunidades abiertas</span><b id="mOppTotal">—</b><small>Con fecha vigente</small></div><div class="tdHeroNumber"><span>Importe total</span><b id="mOppAmount">—</b><small>Todas las oportunidades</small></div><div class="tdHeroNumber"><span>Vendido este mes</span><b id="dashWonAmount">—</b><small>Oportunidades ganadas</small></div><div class="tdHeroTarget"><div id="tdGoalRing" class="tdGoalRing"><b id="dashGoalProgress">—</b><span>objetivo</span></div><div class="tdHeroGoal"><span>Objetivo del mes</span><strong id="dashGoalAmount">—</strong><div class="tdGoalRail"><span id="tdGoalRailFill"></span></div><em id="tdGoalForecastLine">Calculando previsión…</em><button id="dashGoalEdit" class="tdHeroLink">Editar objetivo</button></div></div><span id="dashForecastAmount" hidden></span></section>
  <section class="tdPulseGrid" aria-label="Indicadores de actividad"><button class="tdPulse blue" data-home-filter="calls"><span class="tdPulseIcon">${icon('phone')}</span><span><small>LLAMADAS</small><b id="tdPulseCalls">—</b><em>Para atender</em></span>${icon('arrow')}</button><button class="tdPulse violet" data-home-filter="followup"><span class="tdPulseIcon">${icon('message')}</span><span><small>OFERTAS A SEGUIR</small><b id="tdPulseFollowup">—</b><em>Clientes esperando</em></span>${icon('arrow')}</button><button class="tdPulse amber" data-home-filter="processing"><span class="tdPulseIcon">${icon('file')}</span><span><small>TRAMITACIONES</small><b id="tdPulseProcessing">—</b><em>Pendientes de gestionar</em></span>${icon('arrow')}</button><button class="tdPulse coral" data-route="alerts-expired"><span class="tdPulseIcon">${icon('alert')}</span><span><small>VENCIDAS</small><b id="tdPulseExpired">—</b><em id="tdPulseExpiredText">Revisar ahora</em></span>${icon('arrow')}</button></section>
  <div class="tdCockpitGrid">
    <section class="tdCard tdPriorityCard">
      <div class="tdHead"><div class="tdTitleBlock">${icon('list')}<div><h2>Tu mesa de trabajo</h2><p id="tdPrioritySub">Clientes y oportunidades que requieren tu atención.</p></div></div><button id="tdAddContact" class="tdBtn outline" data-home-action="new-contact">＋ Añadir contacto</button></div>
      <div class="tdWorkspaceControls"><div class="tdFilterBar" id="tdFilterBar" role="group" aria-label="Filtrar tu mesa de trabajo"><button class="tdWorkTab" data-home-filter="priority" aria-pressed="false">Prioridades <span class="tdWorkTabCount" id="tdTabCountPriority">0</span></button><button class="tdWorkTab" data-home-filter="calls" aria-pressed="false">Llamadas <span class="tdWorkTabCount" id="tdTabCountCalls">0</span></button><button class="tdWorkTab" data-home-filter="followup" aria-pressed="false">Seguimientos <span class="tdWorkTabCount" id="tdTabCountFollowup">0</span></button><button class="tdWorkTab" data-home-filter="processing" aria-pressed="false">Tramitaciones <span class="tdWorkTabCount" id="tdTabCountProcessing">0</span></button></div>
      <div class="tdWorkToolbar"><div class="tdWorkSearchField"><label for="tdWorkSearch">Buscar en este grupo</label><input id="tdWorkSearch" type="search" placeholder="Nombre, interés o teléfono" autocomplete="off"></div><button id="tdClearSearch" class="tdBtn outline" type="button" disabled>Limpiar</button><div class="tdPageSizeField"><label for="tdPageSize">Por página</label><select id="tdPageSize"><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="all">Todas</option></select></div></div></div>
      <div id="dashAlerts" class="tdTableWrap" aria-live="polite"></div>
      <div class="tdTableFooter"><span id="tdPageInfo"></span><div><button id="tdPrevPage" class="tdPageButton" aria-label="Página anterior">‹</button><button id="tdNextPage" class="tdPageButton" aria-label="Página siguiente">›</button><button class="tdLink" data-route="alerts">Ver avisos ${icon('arrow')}</button></div></div>
    </section>
    <section class="tdFocusZone"><div class="tdFocusTitle"><span>${icon('target')}</span><div><small>GESTIÓN PRIORITARIA</small><h2>Tu siguiente acción</h2></div></div><div id="tdFocusContent" class="tdFocusContent"></div></section>
    <aside class="tdSideRail"><section class="tdCard tdUpcomingCard"><div class="tdHead"><div class="tdTitleBlock">${icon('calendar')}<div><h2>Próximos seguimientos <span id="tdUpcomingCount" class="tdWorkTabCount">0</span></h2><p>Tareas y oportunidades, por fecha.</p></div></div></div><div id="dashPriorityFollowups"></div><button id="tdUpcomingMore" class="tdLink tdUpcomingMore" aria-expanded="false" hidden>Ver próximos</button><button class="tdBtn tdAgendaButton" data-route="agenda">Ver todas las tareas ${icon('arrow')}</button></section><section class="tdCard tdActivityCard"><div class="tdHead"><div class="tdTitleBlock">${icon('clock')}<div><h2>Actividad reciente</h2><p>Últimos 40 eventos registrados en el CRM.</p></div></div><button id="tdActivityMore" class="tdLink" aria-expanded="false">Ver toda</button></div><div class="tdActivityFilters" role="group" aria-label="Tipo de actividad"><button id="tdActivityCommercial" class="tdWorkTab" data-activity-filter="commercial" aria-pressed="true">Comercial <span id="tdActivityCommercialCount" class="tdWorkTabCount">0</span></button><button id="tdActivityTechnical" class="tdWorkTab" data-activity-filter="technical" aria-pressed="false">Técnica / pruebas <span id="tdActivityTechnicalCount" class="tdWorkTabCount">0</span></button></div><div id="dashActivity"></div></section></aside>
  </div>
  <details class="tdBusinessDetails"><summary><span>${icon('chart')} Analítica y previsión</span><small>Embudo, objetivo y todos los indicadores ${icon('down')}</small></summary>
    <div class="tdBusinessContent"><section class="tdAnalysisHero"><div><span class="tdAnalysisEyebrow">CONTROL COMERCIAL</span><h2>Embudo, previsión e indicadores</h2><p>La foto completa del negocio, actualizada con tus oportunidades reales.</p></div><div class="tdAnalysisHeroStats"><div><span>Abiertas</span><b id="tdAnalysisOpen">—</b></div><div><span>Previsión</span><b id="tdAnalysisForecast">—</b></div><div><span>Conversión</span><b id="tdAnalysisConversion">—</b></div></div><button id="dashNewOppDetail" class="tdBtn primary">＋ Nueva oportunidad</button></section><div class="tdBusinessHead"><div><h2>Indicadores principales</h2><p>Accesos al panel de ventas, los avisos, la agenda y los contactos.</p></div></div>
    <div class="tdMetrics">
      <button class="tdMetric" data-route="sales"><span>Oportunidades</span><b id="tdMetricOppTotal">—</b><small id="tdMetricOppAmount">—</small></button>
      <button class="tdMetric" data-route="sales"><span>Abiertas</span><b id="tdMetricOppOpen">—</b><small>Con fecha vigente</small></button>
      <button class="tdMetric red" data-route="alerts-expired"><span>Vencidas</span><b id="tdMetricOppExpired">—</b><small>Necesitan seguimiento</small></button>
      <button class="tdMetric" data-route="agenda"><span>Tareas pendientes</span><b id="tdMetricTasks">—</b><small id="tdMetricTasksToday">—</small></button>
      <button class="tdMetric" data-route="database"><span>Contactos</span><b id="tdMetricContacts">—</b><small>En tu CRM</small></button>
      <button class="tdMetric" data-route="sales"><span>Conversión</span><b id="tdMetricConversion">—</b><small>Ganadas / total</small></button>
    </div>
    <div class="tdBottom">
      <section class="tdCard"><div class="tdHead"><h2>Embudo de ventas</h2><button class="tdLink" data-route="sales" aria-label="Abrir panel de ventas">${icon('arrow')}</button></div><div id="dashFunnel"></div><div id="tdFunnelFoot" class="tdFunnelFoot"></div></section>
      <section class="tdCard"><div class="tdHead"><h2>Objetivo del mes</h2></div><div class="tdGoalHero"><span>Conseguido este mes</span><b id="tdGoalDetailAmount">—</b><span>Consulta el resumen principal para editarlo.</span></div><div id="tdGoalNote" class="tdGoalNote"></div></section>
      <section class="tdCard"><div class="tdHead"><h2>Previsión comercial</h2><button class="tdLink" data-route="sales" aria-label="Ver previsión comercial">${icon('arrow')}</button></div><div id="dashForecastBreakdown"></div></section>
    </div>
    </div>
  </details>
  <div id="tdGoalModal" class="tdModal hidden" role="dialog" aria-modal="true" aria-labelledby="tdGoalTitle"><div class="tdModalCard"><h3 id="tdGoalTitle">Objetivo del mes</h3><p>Define el objetivo comercial del mes actual.</p><label for="tdGoalAmountInput">Objetivo de facturación (€)</label><input id="tdGoalAmountInput" type="number" min="0" step="0.01"><label for="tdGoalCountInput">Objetivo de oportunidades ganadas</label><input id="tdGoalCountInput" type="number" min="0" step="1"><div id="tdGoalMsg" class="small"></div><div class="tdModalActions"><button id="tdGoalCancel" class="tdBtn">Cancelar</button><button id="tdGoalSave" class="tdBtn primary">Guardar objetivo</button></div></div></div>`;
  if(D.backupJson){D.backupJson.className='';D.backupJson.textContent='Descargar copia completa (JSON)';$('tdBackupJson').appendChild(D.backupJson)}
  if(D.backupCsv){D.backupCsv.className='';D.backupCsv.textContent='Exportar oportunidades (CSV)';$('tdBackupCsv').appendChild(D.backupCsv)}
  D.built=true;bind();
}

function bind(){
  $('dashRefresh').onclick=load;
  const openNewOpp=()=>runAction(openNewOpportunity);$('dashNewOpp').onclick=openNewOpp;$('dashNewOppDetail').onclick=openNewOpp;
  $('tdMoreBtn').onclick=e=>{e.stopPropagation();$('tdMoreMenu').classList.toggle('hidden')};
  $('dashGoalEdit').onclick=openGoal;$('tdGoalCancel').onclick=closeGoal;$('tdGoalSave').onclick=saveGoal;
  $('tdGoalModal').onclick=e=>{if(e.target===$('tdGoalModal'))closeGoal()};
  $('tdActivityMore').onclick=()=>{D.activityAll=!D.activityAll;renderActivity()};
  $('tdUpcomingMore').onclick=()=>{D.upcomingAll=!D.upcomingAll;renderHomePanels()};
  $('tdWorkSearch').value=D.query;$('tdPageSize').value=D.pageSize;
  $('tdWorkSearch').oninput=e=>{D.query=e.target.value;D.page=0;renderHomePanels()};
  $('tdClearSearch').onclick=()=>{D.query='';D.page=0;$('tdWorkSearch').value='';renderHomePanels();$('tdWorkSearch').focus()};
  $('tdPageSize').onchange=e=>{D.pageSize=['10','25','50','all'].includes(e.target.value)?e.target.value:'10';D.page=0;renderHomePanels()};
  $('tdPrevPage').onclick=()=>{D.page=Math.max(0,D.page-1);renderHomePanels()};
  $('tdNextPage').onclick=()=>{D.page++;renderHomePanels()};
  $('view-dashboard').addEventListener('click',handleClick);
  $('view-dashboard').addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('#view-dashboard .tdRowMenu').forEach(m=>m.classList.add('hidden'))});
  document.addEventListener('scroll',repositionRowMenus,true);
  window.addEventListener('resize',repositionRowMenus);
  document.addEventListener('click',e=>{if(!e.target?.closest?.('#view-dashboard [data-dots], #view-dashboard .tdRowMenu'))document.querySelectorAll('#view-dashboard .tdRowMenu').forEach(m=>m.classList.add('hidden'))},true);
}

function positionRowMenu(menu,dots){
  const anchor=dots.getBoundingClientRect(),box=menu.getBoundingClientRect();
  if(anchor.bottom<=0||anchor.top>=window.innerHeight||anchor.right<=0||anchor.left>=window.innerWidth){menu.classList.add('hidden');return}
  menu.style.left=Math.max(8,Math.min(anchor.right-box.width,window.innerWidth-box.width-8))+'px';
  menu.style.top=Math.max(8,Math.min(window.innerHeight-box.height-8,anchor.bottom+box.height+8<=window.innerHeight?anchor.bottom+5:anchor.top-box.height-5))+'px';
}
function repositionRowMenus(){
  document.querySelectorAll('#view-dashboard .tdRowMenu:not(.hidden)').forEach(menu=>{
    const dots=menu.closest('tr')?.querySelector('[data-dots]');
    if(dots)positionRowMenu(menu,dots);else menu.classList.add('hidden');
  });
}

function handleClick(e){
  const el=e.target instanceof Element?e.target:null;if(!el)return;
  if(el.closest('[data-home-action="new-contact"]')){runAction(openNewContact);return}
  const filter=el.closest('[data-home-filter]');
  if(filter&&D.data){if(D.filter!==filter.dataset.homeFilter){D.filter=filter.dataset.homeFilter;D.page=0}renderHomePanels();return}
  const activityFilter=el.closest('[data-activity-filter]');
  if(activityFilter&&D.data){D.activityFilter=activityFilter.dataset.activityFilter==='technical'?'technical':'commercial';D.activityAll=false;renderActivity();return}
  const r=el.closest('[data-route]')?.dataset.route;
  if(r){runAction(()=>navigate(r));return}
  const dots=el.closest('[data-dots]');
  if(dots){e.stopPropagation();const menu=dots.closest('tr')?.querySelector('.tdRowMenu'),wasOpen=menu&&!menu.classList.contains('hidden');document.querySelectorAll('#view-dashboard .tdRowMenu').forEach(m=>m.classList.add('hidden'));if(menu&&!wasOpen){menu.classList.remove('hidden');positionRowMenu(menu,dots)}return}
  const act=el.closest('[data-action]');if(act){e.stopPropagation();document.querySelectorAll('#view-dashboard .tdRowMenu').forEach(m=>m.classList.add('hidden'));runAction(()=>action(act.dataset.action,act.dataset.type,act.dataset.id));return}
  const row=el.closest('[data-open]');if(row)runAction(()=>openItem(row.dataset.type,row.dataset.id));
}
async function callAction(name,id){const fn=await waitFor(()=>typeof window[name]==='function'&&window[name],'Esta acción todavía no está disponible. Vuelve a intentarlo.');return fn(id)}
async function openItem(type,id){
  if(type==='opportunity'){await prepareSales();await callAction('openOpportunityFull',id);await waitFor(()=>visible('opportunityFullPage'),'No se pudo abrir la oportunidad. Puede haberse eliminado o no estar accesible.');}
  else if(type==='task')await callAction(typeof window.openAlertTask==='function'?'openAlertTask':'openContactTaskDetail',id);
  else if(type==='contact'&&id)await callAction('openContact',id);
  else if(type==='agenda')route('agenda');
}
async function action(name,type,id){
  if(name==='open')return openItem(type,id);
  if(name==='edit'){
    if(type==='opportunity'){await prepareSales();await callAction('openOpportunityCard',id);await waitFor(()=>visible('oppDetailModal'),'No se pudo abrir el editor de la oportunidad. Puede haberse eliminado o no estar accesible.');}
    else if(type==='task')await callAction('editAlertTask',id);
  }else if(name==='delete'){
    if(type==='opportunity'){await prepareSales();await callAction('deleteOpp',id);}
    else if(type==='task')await callAction('deleteAlertTask',id);
    D.lastLoad=0;await load();
  }
}

async function fetchData(){const today=localDay(),month=today.slice(0,7),monthStart=`${month}-01`;const results=await Promise.all([queryWithTimeout(sb.from('sales_opportunities').select('*').order('updated_at',{ascending:false}).limit(1000)),queryWithTimeout(sb.from('sales_stages').select('*').eq('active',true).order('position')),queryWithTimeout(sb.from('agenda_items').select('*').order('starts_at',{ascending:true}).limit(500)),queryWithTimeout(sb.from('records').select('id',{count:'exact',head:true}).eq('source_sheet','BASE DE DATOS')),queryWithTimeout(sb.from('crm_audit_log').select('*').order('created_at',{ascending:false}).limit(40)),queryWithTimeout(sb.rpc('crm_get_month_goal',{p_month:monthStart}))]);const [oppR,stageR,taskR,countR,auditR,goalR]=results;return{opps:oppR.data||[],stages:stageR.data||[],tasks:taskR.data||[],contacts:Number(countR.count||0),activity:auditR.data||[],goal:Array.isArray(goalR.data)?goalR.data[0]||{}:goalR.data||{},today,month,monthStart,warnings:results.filter(r=>r.error).map(r=>r.error.message)}}
async function load(){if(!appOpen()){return}build();if(!dashboardOpen())return;if(D.busy)return;if(Date.now()-D.lastLoad<350)return;D.lastLoad=Date.now();D.busy=true;const b=$('dashRefresh');if(b){b.disabled=true;b.setAttribute('aria-busy','true')}try{D.data=await fetchData();render()}catch(e){console.error('Inicio',e);if($('dashAlerts'))$('dashAlerts').innerHTML=`<div class="tdEmpty">${esc(e?.message||'No se pudo cargar el resumen.')}</div>`}finally{D.busy=false;if($('dashRefresh')){$('dashRefresh').disabled=false;$('dashRefresh').removeAttribute('aria-busy')}}}
function render(){const d=D.data;if(!d)return;const map=new Map(d.stages.map(s=>[String(s.id),s])),won=d.opps.filter(o=>isWon(o,map)),open=d.opps.filter(o=>isOpen(o,map,d.today)),expired=d.opps.filter(o=>isExpired(o,map,d.today)),pending=d.tasks.filter(t=>status(t.status||'pending')==='pending'),todayTasks=pending.filter(t=>localDay(t.starts_at)===d.today),totalAmount=d.opps.reduce((n,o)=>n+Number(o.amount||0),0),forecast=open.reduce((n,o)=>n+Number(o.amount||0),0),conversion=d.opps.length?`${Math.round(won.length/d.opps.length*100)}%`:'0%';$('mOppTotal').textContent=open.length;$('mOppAmount').textContent=money(totalAmount);[['tdMetricOppTotal',d.opps.length],['tdMetricOppAmount',money(totalAmount)],['tdMetricOppOpen',open.length],['tdMetricOppExpired',expired.length],['tdMetricTasks',pending.length],['tdMetricTasksToday',todayTasks.length?`${todayTasks.length} para hoy`:'Ninguna para hoy'],['tdMetricContacts',d.contacts],['tdMetricConversion',conversion],['tdAnalysisOpen',open.length],['tdAnalysisForecast',money(forecast)],['tdAnalysisConversion',conversion]].forEach(([id,value])=>{$(id).textContent=value});renderPriority(d,map,pending);renderFunnel(d);renderCommercial(d,map,pending);renderPulse(d,map,pending,todayTasks,expired);renderFocus(d,map,pending);renderGoal(d,won,open);renderForecast(d,map);renderUpcoming(d,map,pending);renderActivity();$('tdGreeting').textContent=Number(new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',hour:'numeric',hourCycle:'h23'}).format(new Date()))<14?'Buenos días':'Buenas tardes';$('tdToday').textContent=new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',weekday:'long',day:'numeric',month:'long'}).format(new Date());$('tdDataStatus').hidden=!d.warnings.length;$('tdDataStatus').textContent=d.warnings.length?'No se han podido cargar todos los datos. Pulsa Actualizar para volver a comprobarlos.':'';}
function activeOpportunity(o,map){return !isWon(o,map)&&!isLost(o,map)&&!/^cancel|^reject/.test(status(o.status))}

function isCall(t){return /llamada|^call$/.test(status(t.agenda_type||t.type))||(!t.agenda_type&&/llamar|llamada|contactar por tel/i.test(t.title||''))}

function opportunityRow(o,map,today){
  const stage=map.get(String(o.stage_id))?.name||'Abierta',expired=isExpired(o,map,today);
  const tone=/tramitad/i.test(stage)?'green':/pendiente.*tramitar/i.test(stage)?'amber':/seguimiento/i.test(stage)?'blue':'muted';
  return{type:'opportunity',id:String(o.id),contactId:String(o.record_id||o.contact_id||o.customer_id||''),name:o.client_name||o.contact_name||o.customer_name||'Sin cliente',phone:o.phone||'',title:o.title||'Oportunidad',stage,tone,updated:o.updated_at||o.created_at||'',date:String(o.expected_date||'').slice(0,10),dateTime:false,expired,rank:expired?0:1,amount:o.amount};
}

function taskRow(t,today){
  const date=localDay(t.starts_at),call=isCall(t);
  return{type:'task',id:String(t.id),contactId:String(t.related_record_id||''),name:t.customer_name||'Sin cliente',phone:t.customer_phone||'',title:t.title||'Tarea',stage:call?'Llamar':t.agenda_type||'Tarea',tone:call?'blue':'amber',updated:t.updated_at||t.created_at||'',date,dateTime:true,when:t.starts_at,expired:!!date&&date<today,rank:date&&date<today?0:1,description:t.description||''};
}

function commercialGroups(d,map,pending){
  const active=d.opps.filter(o=>activeOpportunity(o,map)),byDate=(a,b)=>String(a.expected_date||'9999').localeCompare(String(b.expected_date||'9999'));
  const calls=pending.filter(t=>isCall(t)&&localDay(t.starts_at)&&localDay(t.starts_at)<=d.today).sort((a,b)=>String(a.starts_at).localeCompare(String(b.starts_at)));
  const todayCalls=calls.filter(t=>localDay(t.starts_at)===d.today).length;
  const followup=active.filter(o=>/seguimiento/i.test(map.get(String(o.stage_id))?.name||'')).sort(byDate);
  const processing=active.filter(o=>/pendiente.*tramitar|^tramitad/i.test(map.get(String(o.stage_id))?.name||'')).sort(byDate);
  const toProcess=processing.filter(o=>/pendiente/i.test(map.get(String(o.stage_id))?.name||'')).length;
  return [
    {key:'calls',title:'llamadas pendientes',caption:todayCalls+' para hoy · '+(calls.length-todayCalls)+(calls.length-todayCalls===1?' atrasada':' atrasadas'),icon:'phone',tone:'blue',rows:calls.map(t=>taskRow(t,d.today))},
    {key:'followup',title:'ofertas a seguir',caption:'Oportunidades en Seguimiento',icon:'file',tone:'amber',rows:followup.map(o=>opportunityRow(o,map,d.today))},
    {key:'processing',title:'tramitaciones',caption:toProcess+' por tramitar · '+(processing.length-toProcess)+(processing.length-toProcess===1?' tramitada':' tramitadas'),icon:'checkCircle',tone:'green',rows:processing.map(o=>opportunityRow(o,map,d.today))}
  ];
}

function priorityRows(d,map,pending){
  const rows=d.opps.filter(o=>activeOpportunity(o,map)&&o.expected_date&&String(o.expected_date).slice(0,10)<=d.today).map(o=>opportunityRow(o,map,d.today));
  rows.push(...pending.filter(t=>localDay(t.starts_at)&&localDay(t.starts_at)<=d.today).map(t=>taskRow(t,d.today)));
  return rows.sort((a,b)=>a.rank-b.rank||a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
}

function renderHomePanels(){
  if(!D.data)return;
  const d=D.data,map=new Map(d.stages.map(s=>[String(s.id),s])),pending=d.tasks.filter(t=>status(t.status||'pending')==='pending');
  renderCommercial(d,map,pending);renderPriority(d,map,pending);renderUpcoming(d,map,pending);renderFocus(d,map,pending);
}

function renderCommercial(d,map,pending){
  const groups=commercialGroups(d,map,pending),counts={priority:priorityRows(d,map,pending).length,...Object.fromEntries(groups.map(g=>[g.key,g.rows.length]))};
  for(const key of ['priority','calls','followup','processing'])$('tdTabCount'+key.charAt(0).toUpperCase()+key.slice(1)).textContent=counts[key];
  document.querySelectorAll('#view-dashboard [data-home-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.homeFilter===D.filter)));
}

function renderPulse(d,map,pending,todayTasks,expired){
  const groups=commercialGroups(d,map,pending),byKey=Object.fromEntries(groups.map(g=>[g.key,g]));
  $('tdPulseCalls').textContent=byKey.calls?.rows.length||0;
  $('tdPulseFollowup').textContent=byKey.followup?.rows.length||0;
  $('tdPulseProcessing').textContent=byKey.processing?.rows.length||0;
  $('tdPulseExpired').textContent=expired.length;
  $('tdPulseExpiredText').textContent=expired.length?'Revisar ahora':'Todo controlado';
}

function renderFocus(d,map,pending){
  const first=priorityRows(d,map,pending)[0],el=$('tdFocusContent');
  if(!first){el.innerHTML=`<div class="tdFocusEmpty">${icon('checkCircle')}<span>No tienes ninguna gestión urgente. Buen trabajo.</span></div>`;return}
  const isTask=first.type==='task',when=first.dateTime&&first.date===d.today?localTime(first.when):localDate(first.date);
  el.innerHTML=`<button class="tdFocusAction" data-open="1" data-type="${first.type}" data-id="${esc(first.id)}"><span class="tdFocusAvatar">${esc(initials(first.name))}</span><span class="tdFocusPerson"><b>${esc(first.name)}</b><small>${esc(first.title)}</small></span><span class="tdFocusDeadline ${first.expired?'late':''}">${icon(first.expired?'alert':isTask?'phone':'clock')}<span>${first.expired?'Vencida':when}</span></span><span class="tdFocusOpen">Abrir ${icon('arrow')}</span></button>`;
}

function workRows(rows,query){
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' '),search=normalize(query);
  if(!search)return rows;
  const digits=search.replace(/\D/g,''),phoneSearch=digits.length>0&&/^[+\d\s().-]+$/.test(search);
  return rows.filter(x=>normalize([x.name,x.title,x.phone].join(' ')).includes(search)||(phoneSearch&&String(x.phone||'').replace(/\D/g,'').includes(digits)));
}

function renderPriority(d,map,pending){
  const all=priorityRows(d,map,pending),group=commercialGroups(d,map,pending).find(g=>g.key===D.filter),groupRows=group?group.rows:all,rows=workRows(groupRows,D.query),pageSize=D.pageSize==='all'?Math.max(1,rows.length):Number(D.pageSize);
  D.page=Math.max(0,Math.min(D.page,Math.ceil(rows.length/pageSize)-1));
  const start=D.page*pageSize,page=rows.slice(start,start+pageSize);
  $('tdPrioritySub').textContent=group?group.caption:'Gestiones vencidas y pendientes para hoy, ordenadas por fecha.';
  $('tdClearSearch').disabled=!D.query;
  $('tdPageInfo').textContent=rows.length?`${start+1}–${Math.min(start+pageSize,rows.length)} de ${rows.length} gestiones`:(D.query.trim()?'Sin coincidencias en este grupo':'Sin gestiones en este grupo');
  $('tdPrevPage').disabled=D.page===0;$('tdNextPage').disabled=start+pageSize>=rows.length;
  saveWorkState();
  $('dashAlerts').innerHTML=page.length?`<table class="tdPriorityTable"><thead><tr><th scope="col">Cliente</th><th scope="col">Oportunidad / tarea</th><th scope="col">Estado</th><th scope="col">Fecha prevista</th><th scope="col" class="tdAmountHeading">Importe</th><th scope="col"><span class="tdSrOnly">Acciones</span></th></tr></thead><tbody>${page.map(x=>`<tr>
    <td>${x.contactId?`<button class="tdClientButton" data-open="1" data-type="contact" data-id="${esc(x.contactId)}" aria-label="Abrir contacto: ${esc(x.name)}">`:'<div class="tdClientButton" title="Sin contacto vinculado">'}<span class="tdAvatar">${esc(initials(x.name))}</span><span><b title="${esc(x.name)}">${esc(x.name)}</b><small>${esc(x.phone||'Sin teléfono')}${x.contactId?'':' · Sin vincular'}</small></span>${x.contactId?'</button>':'</div>'}</td>
    <td><button class="tdInterestButton" data-open="1" data-type="${x.type}" data-id="${esc(x.id)}">${esc(x.title)}</button><small class="tdLastActivity">${x.updated?'Actualizada: '+esc(localDate(localDay(x.updated)))+' · '+esc(localTime(x.updated)):'Sin fecha de actualización'}</small></td>
    <td><span class="tdStatusPill ${x.tone}">${icon(x.stage==='Llamar'?'phone':x.tone==='green'?'checkCircle':x.tone==='amber'?'file':'refresh')}<span>${esc(x.stage)}</span></span></td>
    <td><span class="tdNextAction ${x.expired?'isLate':''}">${icon('calendar')}<span>${esc(localDate(x.date))}${x.dateTime?'<small class="tdScheduledTime">'+(x.date===d.today?'Hoy · ':'')+esc(localTime(x.when))+'</small>':''}${x.expired?'<small>Vencida</small>':''}</span></span></td>
    <td class="tdAmount">${x.type==='opportunity'?esc(money(x.amount)):'<span class="tdNoAmount" aria-label="Sin importe">—</span>'}</td>
    <td class="tdMenuCell"><button class="tdDots" data-dots="1" aria-label="Acciones de ${esc(x.name)}">${icon('moreVertical')}</button><div class="tdRowMenu hidden"><button data-action="open" data-type="${x.type}" data-id="${esc(x.id)}">Abrir</button><button data-action="edit" data-type="${x.type}" data-id="${esc(x.id)}">Editar</button><button class="danger" data-action="delete" data-type="${x.type}" data-id="${esc(x.id)}">Eliminar</button></div></td>
  </tr>`).join('')}</tbody></table>`:`<div class="tdEmpty">${icon(D.query.trim()?'list':'checkCircle')}<strong>${D.query.trim()?'No hay coincidencias.':group?'No hay '+esc(group.title)+'.':'Todo al día.'}</strong><span>${D.query.trim()?'Prueba otro nombre, interés o teléfono, o limpia la búsqueda.':group?'Puedes consultar los otros grupos de tu mesa de trabajo.':'No hay gestiones vencidas ni pendientes para hoy.'}</span></div>`;
}

function upcomingRows(d,map,pending){
  const rows=pending.filter(t=>status(t.status||'pending')==='pending'&&t.starts_at&&localDay(t.starts_at)>=d.today).map(t=>taskRow(t,d.today));
  rows.push(...d.opps.filter(o=>activeOpportunity(o,map)&&o.expected_date&&String(o.expected_date).slice(0,10)>=d.today).map(o=>opportunityRow(o,map,d.today)));
  return rows.sort((a,b)=>a.date.localeCompare(b.date)||String(a.when||'').localeCompare(String(b.when||''))||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}

function renderUpcoming(d,map,pending){
  const rows=upcomingRows(d,map,pending),shown=D.upcomingAll?rows:rows.slice(0,3),button=$('tdUpcomingMore');
  $('tdUpcomingCount').textContent=rows.length;
  button.hidden=rows.length<=3;button.textContent=D.upcomingAll?'Ver menos':`Ver próximos (${rows.length})`;button.setAttribute('aria-expanded',String(D.upcomingAll));
  $('dashPriorityFollowups').innerHTML=shown.map(x=>`<button class="tdUpcoming ${x.type==='task'?'amber':'green'}" data-open="1" data-type="${x.type}" data-id="${esc(x.id)}"><span class="tdUpcomingIcon">${icon(x.type==='task'?'calendar':'file')}</span><span class="tdUpcomingText"><span class="tdUpcomingTop"><b>${esc(x.name)}</b><time>${x.dateTime&&x.date===d.today?esc(localTime(x.when)):esc(localDate(x.date))}</time></span><strong>${esc(x.title)}</strong><small>${esc(x.description||x.stage)}${x.date===d.today?' · Hoy':''}</small></span></button>`).join('')||`<div class="tdEmpty">${icon('calendar')}<strong>Sin seguimientos programados</strong><span>Las tareas pendientes y oportunidades con próxima fecha aparecerán aquí.</span></div>`;
}
function renderFunnel(d){const rows=d.stages.map(s=>({name:s.name,count:d.opps.filter(o=>String(o.stage_id)===String(s.id)).length})),max=Math.max(1,...rows.map(x=>x.count));$('dashFunnel').className='tdFunnel';$('dashFunnel').innerHTML=rows.length?rows.map(x=>`<div class="tdFunnelRow"><span>${esc(x.name)}</span><div class="tdTrack"><div class="tdFill" style="width:${x.count?Math.max(3,x.count/max*100):0}%"></div></div><b>${x.count}</b></div>`).join(''):'<div class="tdEmpty">No hay columnas de ventas.</div>';$('tdFunnelFoot').innerHTML=`<div class="tdMiniStat"><span>Total oportunidades</span><b>${d.opps.length}</b></div><div class="tdMiniStat"><span>Importe total</span><b>${money(d.opps.reduce((n,o)=>n+Number(o.amount||0),0))}</b></div>`}

function renderGoal(d,won,open){const target=Number(d.goal?.target_amount||0),wonAmount=won.filter(o=>localDay(o.updated_at||o.expected_date||o.created_at).startsWith(d.month)).reduce((n,o)=>n+Number(o.amount||0),0),forecast=open.reduce((n,o)=>n+Number(o.amount||0),0),pct=target?Math.min(100,Math.round(wonAmount/target*100)):0;$('dashGoalAmount').textContent=money(target);$('dashWonAmount').textContent=money(wonAmount);$('tdGoalDetailAmount').textContent=money(wonAmount);$('dashGoalProgress').textContent=`${pct}%`;$('dashForecastAmount').textContent=money(forecast);$('tdGoalRing').style.setProperty('--td-goal-progress',`${pct}%`);$('tdGoalRailFill').style.width=`${pct}%`;$('tdGoalForecastLine').textContent=target?`Previsión abierta: ${money(forecast)}`:'Añade un objetivo para seguir el progreso del mes.';$('tdGoalNote').textContent=target?`Previsión abierta: ${money(forecast)}`:'Añade un objetivo para seguir el progreso del mes.'}
function renderForecast(d,map){const rows=d.stages.map(s=>({name:s.name,amount:d.opps.filter(o=>String(o.stage_id)===String(s.id)&&!isLost(o,map)).reduce((n,o)=>n+Number(o.amount||0),0)}));$('dashForecastBreakdown').innerHTML=rows.length?rows.map(x=>`<div class="tdListRow"><b>${esc(x.name)}</b><span>${money(x.amount)}</span></div>`).join(''):'<div class="tdEmpty">No hay previsión comercial.</div>'}
function activityKind(a){
  for(const value of [a.action,a.summary]){
    const text=status(value);
    if(/restor|restaur/.test(text))return 'restored';
    if(/delet|remov|purg|eliminad|borrad|papelera/.test(text))return 'deleted';
    if(/creat|cread|alta de/.test(text))return 'created';
    if(/complet/.test(text))return 'completed';
    if(/mov(?:e|id)|cambio de (?:estado|columna)/.test(text))return 'moved';
    if(/updat|edit|actualiz|modific/.test(text))return 'updated';
    if(/sent|enviad/.test(text))return 'sent';
  }
  return '';
}
function isTechnicalActivity(a){
  const details=a.details||{},type=status(a.entity_type),source=status(details.source);
  if(['system','validation','test'].includes(type)||details.is_test===true||['e2e','automated_test','validation'].includes(source))return true;
  const names=[details.label,details.title].map(value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim());
  // Only known generated test names: ordinary names containing "Demo" stay visible.
  return names.some(name=>/^(?:Validacion(?: Excel)? \d{13} (?:Demo|Contacto|Editado|Movil)|Integral \d{13} (?:Gestor|Titular) Demo)$/i.test(name));
}
function activityInfo(a){
  const type=status(a.entity_type),kind=activityKind(a),entity=type==='agenda'||type==='task'?'Tarea':type==='opportunity'?'Oportunidad':type==='contact'?'Contacto':'';
  if(entity){
    const endings=entity==='Contacto'?{created:'creado',updated:'actualizado',deleted:'eliminado',restored:'restaurado',moved:'movido',completed:'completado'}:{created:'creada',updated:'actualizada',deleted:'eliminada',restored:'restaurada',moved:'movida',completed:'completada'};
    const icons={created:'plus',updated:'file',deleted:'alert',restored:'refresh',moved:'arrow',completed:'checkCircle'};
    return[icons[kind]||'clock',endings[kind]?`${entity} ${endings[kind]}`:`Actividad ${entity==='Contacto'?'del contacto':entity==='Tarea'?'de la tarea':'de la oportunidad'}`];
  }
  if(type.includes('whatsapp'))return['message',kind==='sent'?'WhatsApp enviado':'Actividad de WhatsApp'];
  return['clock','Actividad del CRM'];
}
function renderActivity(){
  if(!D.data)return;
  const all=D.data.activity||[],technical=all.filter(isTechnicalActivity),commercial=all.filter(a=>!isTechnicalActivity(a)),group=D.activityFilter==='technical'?technical:commercial,rows=D.activityAll?group:group.slice(0,5),lifecycle=new Map();
  for(const a of [...all].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))){
    const key=`${status(a.entity_type)}:${a.entity_id}`,kind=activityKind(a);
    if(a.entity_id&&!lifecycle.has(key)&&['deleted','restored','created'].includes(kind))lifecycle.set(key,kind);
  }
  $('tdActivityCommercialCount').textContent=commercial.length;$('tdActivityTechnicalCount').textContent=technical.length;
  $('tdActivityCommercial').setAttribute('aria-pressed',String(D.activityFilter!=='technical'));$('tdActivityTechnical').setAttribute('aria-pressed',String(D.activityFilter==='technical'));
  $('dashActivity').innerHTML=rows.length?rows.map(a=>{
    const [iconName,label]=activityInfo(a),type=status(a.entity_type),deleted=activityKind(a)==='deleted'||lifecycle.get(`${type}:${a.entity_id}`)==='deleted';
    const openType=type==='agenda'||type==='task'?'task':type==='opportunity'?'opportunity':type==='contact'?'contact':'';
    const canOpen=!deleted&&openType&&a.entity_id;
    const text=String(a.details?.label||a.details?.title||a.summary||a.action||label).replace(/enviado a papelera(?: local)?/i,label);
    return`<${canOpen?'button type="button"':'div'} class="tdActivityRow${canOpen?'':' tdActivityInfo'}" ${canOpen?`data-open="1" data-type="${openType}" data-id="${esc(a.entity_id)}"`:deleted?'title="Actividad histórica de un registro eliminado"':''}><span class="tdActIcon">${icon(iconName)}</span><strong>${esc(label)}</strong><span class="tdActText">${esc(text)}</span><span class="tdActTime">${localDateTime(a.created_at)}</span></${canOpen?'button':'div'}>`;
  }).join(''):`<div class="tdEmpty">${icon('clock')}<strong>Sin actividad ${D.activityFilter==='technical'?'técnica / de pruebas':'comercial'} en los últimos eventos.</strong><span>${D.activityFilter!=='technical'&&technical.length?'Puedes consultar los registros de validación en Técnica / pruebas.':'Los nuevos eventos de este grupo aparecerán aquí.'}</span></div>`;
  $('tdActivityMore').textContent=D.activityAll?'Ver menos':`Ver toda (${group.length})`;
  $('tdActivityMore').hidden=group.length<=5;$('tdActivityMore').setAttribute('aria-expanded',String(D.activityAll));
}
function openGoal(){const g=D.data?.goal||{};$('tdGoalAmountInput').value=Number(g.target_amount||0)||'';$('tdGoalCountInput').value=Number(g.target_opportunities||0)||'';$('tdGoalMsg').textContent='';$('tdGoalModal').classList.remove('hidden')}
function closeGoal(){$('tdGoalModal').classList.add('hidden')}
async function saveGoal(){const b=$('tdGoalSave');b.disabled=true;$('tdGoalMsg').textContent='Guardando…';try{const r=await queryWithTimeout(sb.rpc('crm_set_month_goal',{p_month:D.data?.monthStart||`${localDay().slice(0,7)}-01`,p_target_amount:Math.max(0,Number($('tdGoalAmountInput').value||0)),p_target_opportunities:Math.max(0,Math.floor(Number($('tdGoalCountInput').value||0)))}));if(r.error)throw r.error;closeGoal();D.lastLoad=0;await load()}catch(e){$('tdGoalMsg').textContent=e?.message||'No se pudo guardar el objetivo.'}finally{b.disabled=false}}

function hideTemplateLeak(){if(dashboardOpen())$('view-wa-templates-v3')?.classList.add('hidden')}
function startWhenReady(){
  const app=$('app');
  if(!app){document.addEventListener('DOMContentLoaded',startWhenReady,{once:true});return}
  let observer=null,started=false;
  function ready(){
    if(started||!appOpen())return;
    started=true;observer?.disconnect();
    build();hideTemplateLeak();if(dashboardOpen())load();
  }
  // Login can take arbitrarily long. Observe the shell instead of expiring
  // after 60 seconds and leaving the old dashboard visible until navigation.
  observer=new MutationObserver(ready);
  observer.observe(app,{attributes:true,attributeFilter:['class','hidden','style']});
  ready();
}
function install(){ensureCss();window.loadDashboard=load;document.addEventListener('click',e=>{const el=e.target instanceof Element?e.target:null;if(!el)return;if(!el.closest('#tdMoreBtn,.tdMoreMenu'))$('tdMoreMenu')?.classList.add('hidden');if(el.closest('.nav[data-view="dashboard"]'))setTimeout(()=>{build();hideTemplateLeak();D.lastLoad=0;load()},120)},true);startWhenReady()}
M.register('dashboard-performance-guard',{install});
})();
