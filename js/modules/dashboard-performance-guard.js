(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const D={built:false,busy:false,lastLoad:0,data:null,activityAll:false,backupJson:null,backupCsv:null,commercialTab:'today'};

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
function initials(name){return String(name||'C').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'C'}
function queryWithTimeout(query,ms=9000){return Promise.race([Promise.resolve(query),new Promise(resolve=>setTimeout(()=>resolve({data:[],count:0,error:{message:'Tiempo de espera agotado'}}),ms))])}


function icon(name){
const paths={
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
 link.href='/assets/dashboard-home.css?v=20260919-home-verified-1';document.head.appendChild(link);
}

function build(){
const v=$('view-dashboard');if(!v||D.built)return;
D.backupJson=$('backupJson');D.backupCsv=$('backupCsv');
v.classList.add('tpfDashPro');v.dataset.homeVersion='20260919-home-verified-1';
v.innerHTML=`
<header class="tdHero"><div class="tdHeroCopy"><span class="tdEyebrow">THE PHONE FACE <span> / </span> INICIO</span><h1>Tu día, de un vistazo.</h1><p>Menos buscar. Más tiempo para tus clientes.</p></div><div class="tdHeroRight"><span id="tdToday" class="tdToday"></span><div class="tdActions"><button id="dashRefresh" class="tdBtn tdRefresh">Actualizar</button><button id="dashNewOpp" class="tdBtn primary">＋ Nueva oportunidad</button><div class="tdMore"><button id="tdMoreBtn" class="tdBtn" aria-label="Más opciones">⋯</button><div id="tdMoreMenu" class="tdMoreMenu hidden"><div id="tdBackupJson"></div><div id="tdBackupCsv"></div><div id="backupMsg" class="small"></div></div></div></div></div></header>
<div id="tdDataStatus" class="tdDataStatus" role="status" hidden></div>
<div class="tdMetrics">
<button class="tdMetric" data-route="sales"><span class="tdMetricLabel">Oportunidades</span><i>${icon('briefcase')}</i><b id="mOppTotal">—</b><small id="mOppAmount">—</small></button>
<button class="tdMetric" data-route="sales"><span class="tdMetricLabel">Abiertas</span><i>${icon('stack')}</i><b id="mOppOpen">—</b><small>Con fecha vigente</small></button>
<button class="tdMetric red" data-route="alerts-expired"><span class="tdMetricLabel">Vencidas</span><i>${icon('clock')}</i><b id="mOppExpired">—</b><small>Necesitan seguimiento</small></button>
<button class="tdMetric green" data-route="agenda"><span class="tdMetricLabel">Tareas pendientes</span><i>${icon('check')}</i><b id="mTasks">—</b><small id="mTasksToday">—</small></button>
<button class="tdMetric" data-route="database"><span class="tdMetricLabel">Contactos</span><i>${icon('users')}</i><b id="mContacts">—</b><small>En tu CRM</small></button>
<button class="tdMetric" data-route="sales"><span class="tdMetricLabel">Conversión</span><i>${icon('target')}</i><b id="mConversion">—</b><small>Ganadas / total</small></button>
</div>
<div class="tdTop">
<section class="tdCard tdAttention"><div class="tdHead"><div><span class="tdSectionLabel">TU PRÓXIMO PASO</span><h2>Necesita tu atención <span id="tdPriorityCount" class="tdBadge"></span></h2><p>Vencidas y gestiones de hoy, en un solo lugar.</p></div><button class="tdLink" data-route="alerts">Ver todo ${icon('arrow')}</button></div><div id="dashAlerts" aria-live="polite"></div><details class="tdFollowDetails"><summary>Detalle de seguimientos vencidos</summary><div id="dashPriorityFollowups"></div></details></section>
<section class="tdCard tdCommercial"><div class="tdHead"><div><span class="tdSectionLabel">DE UN VISTAZO</span><h2>Hoy comercial</h2><p>Elige un grupo para ver qué tienes pendiente.</p></div><span class="tdSectionIcon">${icon('calendar')}</span></div><div id="dashContactToday"></div></section>
</div>
<div class="tdSectionHeading"><h2>Así va tu negocio</h2><span>Ventas, objetivo y previsión</span></div>
<div class="tdBottom">
<section class="tdCard"><div class="tdHead"><h2>Embudo de ventas</h2><button class="tdLink" data-route="sales" aria-label="Abrir panel de ventas">${icon('arrow')}</button></div><div id="dashFunnel"></div><div id="tdFunnelFoot" class="tdFunnelFoot"></div></section>
<section class="tdCard tdGoalCard"><div class="tdHead"><h2>Objetivo del mes</h2><button id="dashGoalEdit" class="tdLink">Editar</button></div><div class="tdGoalHero"><span>Conseguido este mes</span><b id="dashWonAmount">—</b><span>de <strong id="dashGoalAmount">—</strong></span></div><div class="tdGoalTrack"><div id="dashGoalBarFill" class="tdGoalFill"></div></div><div class="tdGoalProgressRow"><span>Progreso del objetivo</span><b id="dashGoalProgress">—</b></div><div id="tdGoalNote" class="tdGoalNote"></div><span id="dashForecastAmount" hidden></span></section>
<section class="tdCard"><div class="tdHead"><h2>Previsión comercial</h2><button class="tdLink" data-route="sales" aria-label="Ver previsión comercial">${icon('arrow')}</button></div><div id="dashForecastBreakdown"></div></section>
</div>
<section class="tdCard tdActivityCard"><div class="tdHead"><h2>Actividad reciente</h2><button id="tdActivityMore" class="tdLink">Ver toda la actividad</button></div><div id="dashActivity"></div></section>
<div id="tdGoalModal" class="tdModal hidden" role="dialog" aria-modal="true" aria-labelledby="tdGoalTitle"><div class="tdModalCard"><h3 id="tdGoalTitle">Objetivo del mes</h3><p>Define el objetivo comercial del mes actual.</p><label for="tdGoalAmountInput">Objetivo de facturación (€)</label><input id="tdGoalAmountInput" type="number" min="0" step="0.01"><label for="tdGoalCountInput">Objetivo de oportunidades ganadas</label><input id="tdGoalCountInput" type="number" min="0" step="1"><div id="tdGoalMsg" class="small"></div><div class="tdModalActions"><button id="tdGoalCancel" class="tdBtn">Cancelar</button><button id="tdGoalSave" class="tdBtn primary">Guardar objetivo</button></div></div></div>`;
if(D.backupJson){D.backupJson.className='';D.backupJson.textContent='Descargar copia completa (JSON)';$('tdBackupJson').appendChild(D.backupJson)}
if(D.backupCsv){D.backupCsv.className='';D.backupCsv.textContent='Exportar oportunidades (CSV)';$('tdBackupCsv').appendChild(D.backupCsv)}
D.built=true;bind();
}

function bind(){$('dashRefresh').onclick=load;$('dashNewOpp').onclick=()=>{route('sales');setTimeout(()=>$('newOpp')?.click(),120)};$('tdMoreBtn').onclick=e=>{e.stopPropagation();$('tdMoreMenu').classList.toggle('hidden')};$('dashGoalEdit').onclick=openGoal;$('tdGoalCancel').onclick=closeGoal;$('tdGoalSave').onclick=saveGoal;$('tdGoalModal').onclick=e=>{if(e.target===$('tdGoalModal'))closeGoal()};$('tdActivityMore').onclick=()=>{D.activityAll=!D.activityAll;renderActivity()};$('view-dashboard').addEventListener('click',handleClick)}
function handleClick(e){const el=e.target instanceof Element?e.target:null;if(!el)return;const commercial=el.closest('[data-commercial-view]');if(commercial&&D.data){D.commercialTab=commercial.dataset.commercialView;renderCommercial(D.data,new Map(D.data.stages.map(s=>[String(s.id),s])),D.data.tasks.filter(t=>status(t.status||'pending')==='pending'));$('tdTab-'+D.commercialTab)?.focus();return}const r=el.closest('[data-route]')?.dataset.route;if(r){if(r==='alerts-expired'){route('alerts');setTimeout(()=>document.querySelector('[data-alert-filter="expired"]')?.click(),100)}else route(r);return}const dots=el.closest('[data-dots]');if(dots){e.stopPropagation();document.querySelectorAll('.tdRowMenu').forEach(m=>m.classList.add('hidden'));dots.closest('.tdPriorityRow')?.querySelector('.tdRowMenu')?.classList.toggle('hidden');return}const act=el.closest('[data-action]');if(act){e.stopPropagation();action(act.dataset.action,act.dataset.type,act.dataset.id);return}const row=el.closest('[data-open]');if(row)openItem(row.dataset.type,row.dataset.id)}
function openItem(type,id){if(type==='opportunity')window.openOpportunityFull?.(id);else if(type==='task'){if(window.openAlertTask)window.openAlertTask(id);else window.openContactTaskDetail?.(id)}else if(type==='contact'&&id)window.openContact?.(id);else if(type==='agenda')route('agenda')}
function action(name,type,id){if(name==='open')openItem(type,id);else if(name==='edit'){if(type==='opportunity')window.openOpportunityCard?.(id);else if(type==='task')window.editAlertTask?.(id)}else if(name==='delete'){if(type==='opportunity')window.deleteOpp?.(id);else if(type==='task')window.deleteAlertTask?.(id);setTimeout(load,650)}}

async function fetchData(){const today=localDay(),month=today.slice(0,7),monthStart=`${month}-01`;const results=await Promise.all([queryWithTimeout(sb.from('sales_opportunities').select('*').order('updated_at',{ascending:false}).limit(1000)),queryWithTimeout(sb.from('sales_stages').select('*').eq('active',true).order('position')),queryWithTimeout(sb.from('agenda_items').select('*').order('starts_at',{ascending:true}).limit(500)),queryWithTimeout(sb.from('records').select('id',{count:'exact',head:true}).eq('source_sheet','BASE DE DATOS')),queryWithTimeout(sb.from('crm_audit_log').select('*').order('created_at',{ascending:false}).limit(40)),queryWithTimeout(sb.rpc('crm_get_month_goal',{p_month:monthStart}))]);const [oppR,stageR,taskR,countR,auditR,goalR]=results;return{opps:oppR.data||[],stages:stageR.data||[],tasks:taskR.data||[],contacts:Number(countR.count||0),activity:auditR.data||[],goal:Array.isArray(goalR.data)?goalR.data[0]||{}:goalR.data||{},today,month,monthStart,warnings:results.filter(r=>r.error).map(r=>r.error.message)}}
async function load(){if(!appOpen()){return}build();if(!dashboardOpen())return;if(D.busy)return;if(Date.now()-D.lastLoad<350)return;D.lastLoad=Date.now();D.busy=true;const b=$('dashRefresh');if(b){b.disabled=true;b.textContent='Actualizando…'}try{D.data=await fetchData();render()}catch(e){console.error('Inicio',e);if($('dashAlerts'))$('dashAlerts').innerHTML=`<div class="tdEmpty">${esc(e?.message||'No se pudo cargar el resumen.')}</div>`}finally{D.busy=false;if($('dashRefresh')){$('dashRefresh').disabled=false;$('dashRefresh').textContent='↻ Actualizar'}}}
function render(){const d=D.data;if(!d)return;const map=new Map(d.stages.map(s=>[String(s.id),s])),won=d.opps.filter(o=>isWon(o,map)),open=d.opps.filter(o=>isOpen(o,map,d.today)),expired=d.opps.filter(o=>isExpired(o,map,d.today)),pending=d.tasks.filter(t=>status(t.status||'pending')==='pending'),todayTasks=pending.filter(t=>localDay(t.starts_at)===d.today),totalAmount=d.opps.reduce((n,o)=>n+Number(o.amount||0),0);$('mOppTotal').textContent=d.opps.length;$('mOppAmount').textContent=money(totalAmount);$('mOppOpen').textContent=open.length;$('mOppExpired').textContent=expired.length;$('mTasks').textContent=pending.length;$('mTasksToday').textContent=todayTasks.length?`${todayTasks.length} para hoy`:'Ninguna para hoy';$('mContacts').textContent=d.contacts;$('mConversion').textContent=d.opps.length?`${Math.round(won.length/d.opps.length*100)}%`:'0%';renderPriority(d,map,pending);renderFunnel(d);renderCommercial(d,map,pending);renderGoal(d,won,open);renderForecast(d,map);renderFollowups(expired);renderActivity();$('tdToday').textContent=new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',weekday:'long',day:'numeric',month:'long'}).format(new Date());$('tdDataStatus').hidden=!d.warnings.length;$('tdDataStatus').textContent=d.warnings.length?'No se han podido cargar todos los datos. Pulsa Actualizar para volver a comprobarlos.':'';}
function priorityRows(d,map,pending){const rows=[];for(const o of d.opps){const k=String(o.expected_date||'').slice(0,10);if(isExpired(o,map,d.today))rows.push({type:'opportunity',id:o.id,tone:'red',tag:'Vencida',title:o.title||'Oportunidad vencida',sub:`${o.client_name||'Sin cliente'} · Fecha ${localDate(k)}`,rank:0,date:k});else if(k===d.today)rows.push({type:'opportunity',id:o.id,tone:'',tag:'Hoy',title:o.title||'Oportunidad para hoy',sub:o.client_name||'Sin cliente',rank:1,date:k})}for(const t of pending){const k=localDay(t.starts_at);if(k<d.today)rows.push({type:'task',id:t.id,tone:'red',tag:'Vencida',title:t.title||'Tarea atrasada',sub:`Tarea · ${t.customer_name||'Sin cliente'}`,rank:0,date:k});else if(k===d.today)rows.push({type:'task',id:t.id,tone:'',tag:'Hoy',title:t.title||'Tarea para hoy',sub:t.customer_name||'Agenda',rank:1,date:k})}return rows.sort((a,b)=>a.rank-b.rank||String(a.date).localeCompare(String(b.date)))}
function renderPriority(d,map,pending){const all=priorityRows(d,map,pending),rows=all.slice(0,6);$('tdPriorityCount').textContent=all.length;if($('navAlertCount'))$('navAlertCount').textContent=all.length;$('dashAlerts').innerHTML=rows.length?rows.map(x=>`<div class="tdPriorityRow ${x.tone}" data-open="1" data-type="${x.type}" data-id="${x.id}"><i class="tdLine"></i><div class="tdMain"><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></div><div class="tdRight"><span class="tdPill ${x.tone}">${esc(x.tag)}</span><button class="tdDots" data-dots="1" aria-label="Acciones de esta gestión">⋯</button></div><div class="tdRowMenu hidden"><button data-action="open" data-type="${x.type}" data-id="${x.id}">Abrir</button><button data-action="edit" data-type="${x.type}" data-id="${x.id}">Editar</button><button class="danger" data-action="delete" data-type="${x.type}" data-id="${x.id}">Eliminar</button></div></div>`).join(''):'<div class="tdEmpty">Todo al día. No hay prioridades.</div>'}
function renderFunnel(d){const rows=d.stages.map(s=>({name:s.name,count:d.opps.filter(o=>String(o.stage_id)===String(s.id)).length})),max=Math.max(1,...rows.map(x=>x.count));$('dashFunnel').className='tdFunnel';$('dashFunnel').innerHTML=rows.length?rows.map(x=>`<div class="tdFunnelRow"><span>${esc(x.name)}</span><div class="tdTrack"><div class="tdFill" style="width:${x.count?Math.max(3,x.count/max*100):0}%"></div></div><b>${x.count}</b></div>`).join(''):'<div class="tdEmpty">No hay columnas de ventas.</div>';$('tdFunnelFoot').innerHTML=`<div class="tdMiniStat"><span>Total oportunidades</span><b>${d.opps.length}</b></div><div class="tdMiniStat"><span>Importe total</span><b>${money(d.opps.reduce((n,o)=>n+Number(o.amount||0),0))}</b></div>`}

function commercialGroups(d,map,pending){
const active=d.opps.filter(o=>!isWon(o,map)&&!isLost(o,map)&&!/^cancel|^reject/.test(status(o.status)));
const opportunity=o=>({type:'opportunity',id:o.id,title:o.client_name||o.title||'Sin cliente',sub:o.title||'Oportunidad',meta:money(o.amount)});
const byDate=(a,b)=>String(a.expected_date||'9999').localeCompare(String(b.expected_date||'9999'));
const inStage=pattern=>active.filter(o=>pattern.test(status(map.get(String(o.stage_id))?.name))).sort(byDate).map(opportunity);
return [
{key:'today',title:'Para hoy',caption:'Tareas y cierres',icon:'calendar',route:'agenda',empty:'No hay tareas ni cierres previstos para hoy.',rows:[
...pending.filter(t=>localDay(t.starts_at)===d.today).sort((a,b)=>String(a.starts_at).localeCompare(String(b.starts_at))).map(t=>({type:'task',id:t.id,title:t.customer_name||t.title||'Tarea',sub:t.title||'Tarea de agenda',meta:localTime(t.starts_at)})),
...active.filter(o=>String(o.expected_date||'').slice(0,10)===d.today).map(opportunity)]},
{key:'followup',title:'En seguimiento',caption:'Oportunidades abiertas',icon:'message',route:'sales',empty:'No hay oportunidades en seguimiento.',rows:inStage(/seguimiento/)},
{key:'pending',title:'Por tramitar',caption:'Aceptadas, pendientes',icon:'briefcase',route:'sales',empty:'No hay oportunidades pendientes de tramitar.',rows:inStage(/pendiente.*tramitar/)},
{key:'processed',title:'Tramitadas',caption:'Pendientes de cerrar',icon:'check',route:'sales',empty:'No hay ventas en Tramitado.',rows:inStage(/^tramitad/)}
];
}
function renderCommercial(d,map,pending){
const groups=commercialGroups(d,map,pending),selected=groups.find(g=>g.key===D.commercialTab)||groups[0];
$('dashContactToday').innerHTML=`
<div class="tdCommercialTabs" role="tablist" aria-label="Grupos comerciales">${groups.map(g=>`<button id="tdTab-${g.key}" class="tdCommercialTab ${g.key===selected.key?'isActive':''}" role="tab" aria-selected="${g.key===selected.key}" aria-controls="tdCommercialPanel" data-commercial-view="${g.key}"><span class="tdCommercialIcon">${icon(g.icon)}</span><b>${g.rows.length}</b><span>${g.title}</span><small>${g.caption}</small></button>`).join('')}</div>
<div id="tdCommercialPanel" role="tabpanel" aria-labelledby="tdTab-${selected.key}" class="tdCommercialPanel"><div class="tdCommercialCaption"><strong>${selected.title}</strong><span>${selected.rows.length} en total</span></div>
${selected.rows.length?selected.rows.slice(0,3).map(r=>`<button class="tdCommercialRow" data-open="1" data-type="${r.type}" data-id="${esc(r.id)}"><span class="tdAvatar">${esc(initials(r.title))}</span><span class="tdMain"><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></span><span class="tdCommercialMeta">${esc(r.meta)}</span>${icon('arrow')}</button>`).join(''):`<div class="tdCommercialEmpty">${icon(selected.icon)}<strong>${selected.empty}</strong><span>Puedes revisar los otros grupos de arriba.</span></div>`}
</div><button class="tdCommercialFooter" data-route="${selected.route}">${selected.route==='agenda'?'Abrir agenda':'Abrir panel de ventas'} ${icon('arrow')}</button>`;
}

function renderGoal(d,won,open){const target=Number(d.goal?.target_amount||0),wonAmount=won.filter(o=>localDay(o.updated_at||o.expected_date||o.created_at).startsWith(d.month)).reduce((n,o)=>n+Number(o.amount||0),0),forecast=open.reduce((n,o)=>n+Number(o.amount||0),0),pct=target?Math.min(100,Math.round(wonAmount/target*100)):0;$('dashGoalAmount').textContent=money(target);$('dashWonAmount').textContent=money(wonAmount);$('dashGoalProgress').textContent=`${pct}%`;$('dashForecastAmount').textContent=money(forecast);$('dashGoalBarFill').style.width=`${pct}%`;$('tdGoalNote').textContent=target?`Previsión abierta: ${money(forecast)}`:'Añade un objetivo para seguir el progreso del mes.'}
function renderForecast(d,map){const rows=d.stages.map(s=>({name:s.name,amount:d.opps.filter(o=>String(o.stage_id)===String(s.id)&&!isLost(o,map)).reduce((n,o)=>n+Number(o.amount||0),0)})).slice(0,7);$('dashForecastBreakdown').innerHTML=rows.length?rows.map(x=>`<div class="tdListRow"><b>${esc(x.name)}</b><span>${money(x.amount)}</span></div>`).join(''):'<div class="tdEmpty">No hay previsión comercial.</div>'}
function renderFollowups(expired){const rows=[...expired].sort((a,b)=>String(a.expected_date||'').localeCompare(String(b.expected_date||''))).slice(0,6);$('dashPriorityFollowups').innerHTML=rows.length?rows.map(o=>`<div class="tdFollowRow" data-open="1" data-type="opportunity" data-id="${o.id}"><b>${esc(o.client_name||o.title||'Oportunidad')}</b><span>${localDate(o.expected_date)}</span><strong>${money(o.amount||0)}</strong><span class="tdPill red">Vencida</span></div>`).join(''):'<div class="tdEmpty">No hay seguimientos vencidos.</div>'}
function activityInfo(a){const type=status(a.entity_type),txt=status(`${a.action||''} ${a.summary||''}`);if(type==='agenda'||type==='task'){if(/delete|papelera/.test(txt))return['🗑','Tarea eliminada'];if(/complete|complet/.test(txt))return['✓','Tarea completada'];return['▣','Tarea actualizada']}if(type==='opportunity'){if(/delete|papelera/.test(txt))return['🗑','Oportunidad eliminada'];if(/move|movid/.test(txt))return['↔','Oportunidad movida'];return['▣','Oportunidad actualizada']}if(type==='contact')return['♙','Contacto actualizado'];if(type.includes('whatsapp'))return['◉','WhatsApp enviado'];return['•','Actividad del CRM']}
function renderActivity(){if(!D.data)return;const rows=D.data.activity.slice(0,D.activityAll?24:6);$('dashActivity').innerHTML=rows.length?rows.map(a=>{const [icon,label]=activityInfo(a),type=status(a.entity_type),openType=type==='agenda'||type==='task'?'task':type==='opportunity'?'opportunity':type==='contact'?'contact':'';const text=String(a.details?.label||a.details?.title||a.summary||a.action||label).replace(/enviado a papelera(?: local)?/i,label);return`<div class="tdActivityRow" ${openType&&a.entity_id?`data-open="1" data-type="${openType}" data-id="${a.entity_id}"`:''}><span class="tdActIcon">${icon}</span><strong>${esc(label)}</strong><span class="tdActText">${esc(text)}</span><span class="tdActTime">${localDateTime(a.created_at)}</span></div>`}).join(''):'<div class="tdEmpty">La actividad nueva aparecerá aquí.</div>';$('tdActivityMore').textContent=D.activityAll?'Ver menos':'Ver toda la actividad'}
function openGoal(){const g=D.data?.goal||{};$('tdGoalAmountInput').value=Number(g.target_amount||0)||'';$('tdGoalCountInput').value=Number(g.target_opportunities||0)||'';$('tdGoalMsg').textContent='';$('tdGoalModal').classList.remove('hidden')}
function closeGoal(){$('tdGoalModal').classList.add('hidden')}
async function saveGoal(){const b=$('tdGoalSave');b.disabled=true;$('tdGoalMsg').textContent='Guardando…';try{const r=await queryWithTimeout(sb.rpc('crm_set_month_goal',{p_month:D.data?.monthStart||`${localDay().slice(0,7)}-01`,p_target_amount:Math.max(0,Number($('tdGoalAmountInput').value||0)),p_target_opportunities:Math.max(0,Math.floor(Number($('tdGoalCountInput').value||0)))}));if(r.error)throw r.error;closeGoal();D.lastLoad=0;await load()}catch(e){$('tdGoalMsg').textContent=e?.message||'No se pudo guardar el objetivo.'}finally{b.disabled=false}}

function hideTemplateLeak(){if(dashboardOpen())$('view-wa-templates-v3')?.classList.add('hidden')}
function startWhenReady(){let attempts=0;const timer=setInterval(()=>{attempts++;if(appOpen()){clearInterval(timer);build();hideTemplateLeak();if(dashboardOpen())load()}else if(attempts>=240)clearInterval(timer)},250)}
function install(){ensureCss();window.loadDashboard=load;document.addEventListener('click',e=>{const el=e.target instanceof Element?e.target:null;if(!el)return;if(!el.closest('#tdMoreBtn,.tdMoreMenu'))$('tdMoreMenu')?.classList.add('hidden');if(el.closest('.nav[data-view="dashboard"]'))setTimeout(()=>{build();hideTemplateLeak();D.lastLoad=0;load()},120)},true);startWhenReady()}
M.register('dashboard-performance-guard',{install});
})();
