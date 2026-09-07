(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
const PAGE_SIZE=20;
const state={page:1,all:[],summaryAt:0,loading:false,bound:false};

function stamp(value){const n=new Date(value||0).getTime();return Number.isFinite(n)?n:0}
function delivery(row){return String(row?.whatsapp_delivery_status||'').toLowerCase()}
function isDue(row){return !stamp(row?.whatsapp_scheduled_at||row?.starts_at)||stamp(row?.whatsapp_scheduled_at||row?.starts_at)<=Date.now()}
function group(row){
 const d=delivery(row),status=String(row?.status||'').toLowerCase();
 if(status==='cancelled'||d==='cancelled')return'cancelled';
 if(status==='completed'||d==='sent')return'completed';
 if(d==='paused')return'paused';
 if(d==='error'||d==='failed'||d==='uncertain')return'error';
 if(status==='pending')return isDue(row)?'due':'future';
 return'other';
}
function matches(row,filter){
 const value=group(row);
 if(filter==='all')return true;
 if(filter==='pending')return value==='due'||value==='future';
 return value===filter;
}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function formatDate(value){if(!value)return'—';return new Date(value).toLocaleString('es-ES',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function currentFilter(){return $('waFilter')?.value||'pending'}

function addStyles(){
 if($('wapProStyles'))return;
 const style=document.createElement('style');style.id='wapProStyles';style.textContent=`
#view-whatsapp{max-width:1500px!important;margin:0 auto;padding-bottom:28px}
#view-whatsapp .wapPageHeader{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}
#view-whatsapp .wapPageHeader h2{margin-bottom:4px}
#view-whatsapp .wapHeaderActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#view-whatsapp .wapKpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}
#view-whatsapp .wapKpis>button{appearance:none;text-align:left;padding:14px 16px;border:1px solid #dfe5ed;border-radius:14px;background:#fff;color:#172033;cursor:pointer;box-shadow:0 2px 8px #102a4c0a}
#view-whatsapp .wapKpis>button:hover{border-color:#9bbcf0;background:#f8fbff}
#view-whatsapp .wapKpis span,#view-whatsapp .wapKpis small{display:block;color:#667085}
#view-whatsapp .wapKpis span{font-size:11px;font-weight:750}#view-whatsapp .wapKpis b{display:block;margin:4px 0 2px;font-size:24px}
#view-whatsapp .wapKpis small{font-size:9px}#view-whatsapp .wapKpis .warning b{color:#b54708}
#view-whatsapp .waToolbar{padding:10px 12px!important;margin-bottom:12px!important}
#view-whatsapp .wapFilterTabs{display:flex;gap:5px;overflow-x:auto;padding:0 0 9px;scrollbar-width:thin}
#view-whatsapp .wapFilterTabs button{flex:0 0 auto;border:0;border-radius:999px;padding:7px 11px;background:#f1f4f8;color:#475467;font-size:10px;font-weight:800;cursor:pointer}
#view-whatsapp .wapFilterTabs button.active{background:#175cd3;color:#fff}
#view-whatsapp .wapSearchRow{display:grid!important;grid-template-columns:minmax(260px,1fr) auto;gap:10px!important}
#view-whatsapp #waFilter{display:none!important}#view-whatsapp #waSearch{width:100%;min-width:0;margin:0}
#view-whatsapp #wapResultCount{white-space:nowrap;align-self:center}
#view-whatsapp .wapComposer{margin-bottom:12px!important;padding:16px!important;border-color:#b9d3fb!important;background:#fbfdff}
#view-whatsapp .wapComposer.hidden{display:none!important}
#view-whatsapp .wapSectionHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
#view-whatsapp .wapSectionHead h3{margin:0 0 3px}
#view-whatsapp .wapComposer textarea{min-height:100px;max-height:220px;resize:vertical}
#view-whatsapp .wapListCard{padding:0!important;overflow:visible!important}
#view-whatsapp .wapListCard table{width:100%;table-layout:fixed}
#view-whatsapp .wapListCard th{padding:10px 12px;background:#f8fafc;color:#667085;font-size:9px;text-transform:uppercase;letter-spacing:.04em}
#view-whatsapp .wapListCard td{height:54px;padding:8px 12px;border-top:1px solid #edf1f5;vertical-align:middle;font-size:11px}
#view-whatsapp .wapListCard th:nth-child(1){width:145px}#view-whatsapp .wapListCard th:nth-child(2){width:180px}
#view-whatsapp .wapListCard th:nth-child(3){width:120px}#view-whatsapp .wapListCard th:nth-child(5){width:150px}
#view-whatsapp .wapListCard th:nth-child(6){width:56px}
#view-whatsapp .waMessageCell{min-width:0!important;max-width:none!important;white-space:nowrap!important;overflow:hidden;text-overflow:ellipsis}
#view-whatsapp .wapRow{cursor:pointer}.wapRow:hover{background:#f8fbff}
#view-whatsapp .wapActionsCell{position:relative;text-align:right}
#view-whatsapp .wapMenu{position:relative;display:inline-block}
#view-whatsapp .wapMenu summary{display:grid;place-items:center;width:34px;height:34px;border:1px solid #d7dee8;border-radius:9px;background:#fff;cursor:pointer;font-size:16px;list-style:none}
#view-whatsapp .wapMenu summary::-webkit-details-marker{display:none}
#view-whatsapp .wapMenuBody{position:absolute;right:0;top:39px;z-index:100;width:190px;padding:6px;border:1px solid #d7dee8;border-radius:11px;background:#fff;box-shadow:0 12px 35px #102a4c26}
#view-whatsapp .wapMenuBody button{display:block!important;width:100%;margin:0!important;padding:9px 10px!important;border:0!important;background:#fff!important;color:#344054!important;text-align:left!important;border-radius:7px!important;font-size:10px!important}
#view-whatsapp .wapMenuBody button:hover{background:#f1f5f9!important}
#view-whatsapp .wapMenuBody .agendaWaSend{color:#14753a!important}
#view-whatsapp .wapPagination{display:flex;align-items:center;justify-content:center;gap:14px;padding:12px;border-top:1px solid #edf1f5}
#view-whatsapp .wapPagination.hidden{display:none!important}
#view-whatsapp .wapPagination button:disabled{opacity:.4}
.wapDetail{width:min(680px,calc(100% - 24px));border:0;border-radius:17px;padding:0;box-shadow:0 25px 80px #102a4c55}
.wapDetail::backdrop{background:#102033aa}.wapDetailHead{display:flex;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid #e5eaf0}
.wapDetailHead h3{margin:3px 0 0}.wapDetailHead button{width:34px;height:34px;border:0;border-radius:50%;font-size:20px}
.wapDetailBody{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:18px 20px}.wapDetailBody>div{padding:10px;border:1px solid #e5eaf0;border-radius:10px}
.wapDetailBody span{display:block;margin-bottom:4px;color:#667085;font-size:10px}.wapDetailBody .wide{grid-column:1/-1}.wapDetailBody pre{margin:0;white-space:pre-wrap;word-break:break-word;font:inherit}
@media(max-width:900px){#view-whatsapp .wapKpis{grid-template-columns:1fr 1fr}#view-whatsapp .wapListCard{overflow-x:auto!important}#view-whatsapp .wapListCard table{min-width:850px}}
@media(max-width:600px){#view-whatsapp .wapPageHeader{align-items:flex-start;flex-direction:column}#view-whatsapp .wapHeaderActions{width:100%}#view-whatsapp .wapHeaderActions button{flex:1}#view-whatsapp .wapKpis{grid-template-columns:1fr 1fr}#view-whatsapp .wapKpis>button{padding:11px}#view-whatsapp .wapDetailBody{grid-template-columns:1fr}.wapDetailBody .wide{grid-column:auto}}
`;document.head.appendChild(style);
}

function updateSummary(){
 const counts={due:0,future:0,completed:0,error:0};
state.all.forEach(row=>{const key=group(row);if(Object.prototype.hasOwnProperty.call(counts,key))counts[key]++});
 [['wapKpiDue','due'],['wapKpiFuture','future'],['wapKpiSent','completed'],['wapKpiIssues','error']].forEach(([id,key])=>{if($(id))$(id).textContent=String(counts[key])});
}
async function loadSummary(force=false){
 if(state.loading||(!force&&Date.now()-state.summaryAt<30000))return;
 state.loading=true;
 try{
  const {data,error}=await sb.from('agenda_items').select('id,status,starts_at,whatsapp_scheduled_at,whatsapp_delivery_status').eq('whatsapp_enabled',true).limit(1500);
  if(error)throw error;state.all=data||[];state.summaryAt=Date.now();updateSummary();
 }catch(error){console.warn('Resumen de WhatsApp programados',error)}
 finally{state.loading=false}
}

function visibleIndexes(rows){const filter=currentFilter();return rows.map((row,index)=>matches(row,filter)?index:-1).filter(index=>index>=0)}
function closeMenus(except){document.querySelectorAll('#view-whatsapp .wapMenu[open]').forEach(menu=>{if(menu!==except)menu.removeAttribute('open')})}
function openDetail(row){
 if(!row)return;$('wapDetail')?.remove();
 const dialog=document.createElement('dialog');dialog.id='wapDetail';dialog.className='wapDetail';
 const status={due:'Listo para enviar',future:'Programado',completed:'Enviado',error:'Necesita revisión',paused:'Pausado',cancelled:'Cancelado'}[group(row)]||'Sin estado';
 dialog.innerHTML=`<div class="wapDetailHead"><div><span class="small">${esc(status)}</span><h3>${esc(row.customer_name||'Contacto')}</h3></div><button type="button" data-close>×</button></div><div class="wapDetailBody"><div><span>Fecha y hora</span><b>${esc(formatDate(row.whatsapp_scheduled_at||row.starts_at))}</b></div><div><span>Teléfono</span><b>${esc(row.whatsapp_phone||row.customer_phone||'—')}</b></div><div class="wide"><span>Mensaje completo</span><pre>${esc(row.whatsapp_message||'Sin mensaje')}</pre></div>${row.whatsapp_delivery_error?`<div class="wide"><span>Incidencia</span><b>${esc(row.whatsapp_delivery_error)}</b></div>`:''}</div>`;
 document.body.appendChild(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
}
function decorate(){
 const rows=Array.isArray(window.__waRows)?window.__waRows:[];
 const indexes=visibleIndexes(rows),pages=Math.max(1,Math.ceil(indexes.length/PAGE_SIZE));
 state.page=Math.min(Math.max(1,state.page),pages);
 const start=(state.page-1)*PAGE_SIZE,shown=new Set(indexes.slice(start,start+PAGE_SIZE));
 [...document.querySelectorAll('#waRows tr')].forEach((tr,index)=>{
  tr.classList.add('wapRow');tr.dataset.wapId=String(rows[index]?.id||'');tr.style.display=shown.has(index)?'':'none';
  const message=tr.children[3];if(message)message.title=String(rows[index]?.whatsapp_message||'');
  const cell=tr.children[5];if(cell&&!cell.querySelector('.wapMenu')){
   cell.classList.add('wapActionsCell');const buttons=[...cell.querySelectorAll('button')],menu=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');
   menu.className='wapMenu';summary.textContent='•••';summary.title='Acciones';body.className='wapMenuBody';buttons.forEach(button=>body.appendChild(button));menu.append(summary,body);cell.replaceChildren(menu);
   menu.addEventListener('toggle',()=>{if(menu.open)closeMenus(menu)});
  }
 });
 if($('wapResultCount'))$('wapResultCount').textContent=`${indexes.length} resultado${indexes.length===1?'':'s'}`;
 if($('wapPageInfo'))$('wapPageInfo').textContent=`Página ${state.page} de ${pages}`;
 if($('wapPrev'))$('wapPrev').disabled=state.page<=1;
 if($('wapNext'))$('wapNext').disabled=state.page>=pages;
 $('wapPagination')?.classList.toggle('hidden',indexes.length<=PAGE_SIZE);
 document.querySelectorAll('#wapFilterTabs [data-wap-filter]').forEach(button=>button.classList.toggle('active',button.dataset.wapFilter===currentFilter()));
 if($('waEmpty'))$('waEmpty').style.display=indexes.length?'none':'block';
}
async function enhanceLoad(base,args){
 const result=await base.apply(window,args);await loadSummary();decorate();return result;
}
function toggleComposer(show){
 const composer=$('wapComposer');if(!composer)return;composer.classList.toggle('hidden',!show);
 if(show){composer.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>$('waCustomer')?.focus(),180)}
}
function bind(){
 if(state.bound)return;state.bound=true;addStyles();
 const liveButton=document.querySelector('#view-whatsapplive .ccLaunch');liveButton?.remove();
 $('waNewProgram').onclick=()=>toggleComposer(true);$('waCloseComposer').onclick=()=>toggleComposer(false);
 $('wapPrev').onclick=()=>{state.page=Math.max(1,state.page-1);decorate()};
 $('wapNext').onclick=()=>{state.page++;decorate()};
 document.querySelectorAll('#view-whatsapp [data-wap-filter]').forEach(button=>button.onclick=()=>{if(!$('waFilter'))return;$('waFilter').value=button.dataset.wapFilter;state.page=1;window.loadWhatsappPrograms()});
 const base=window.loadWhatsappPrograms;
 if(typeof base==='function'&&!base.__tpfProgramsPro){const wrapped=function(){return enhanceLoad(base,arguments)};wrapped.__tpfProgramsPro=true;window.loadWhatsappPrograms=wrapped}
 if($('waReload'))$('waReload').onclick=()=>{state.summaryAt=0;window.loadWhatsappPrograms()};
 if($('waFilter'))$('waFilter').onchange=()=>{state.page=1;window.loadWhatsappPrograms()};
 if($('waSearch'))$('waSearch').oninput=()=>{state.page=1;window.loadWhatsappPrograms()};
 $('waRows')?.addEventListener('click',event=>{if(event.target.closest('button,summary,.wapMenu'))return;const tr=event.target.closest('tr');if(!tr)return;openDetail((window.__waRows||[]).find(row=>String(row.id)===tr.dataset.wapId))});
 const observer=new MutationObserver(()=>{const msg=String($('waMsg')?.textContent||'');if(/programado|actualizado/i.test(msg))setTimeout(()=>toggleComposer(false),450)});
 if($('waMsg'))observer.observe($('waMsg'),{childList:true,characterData:true,subtree:true});
 document.addEventListener('click',event=>{if(!event.target.closest('#view-whatsapp .wapMenu'))closeMenus()});
 loadSummary(true);setTimeout(()=>window.loadWhatsappPrograms?.(),100);
}
M.register('whatsapp-programs-pro',{install(){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind()}});
})();
