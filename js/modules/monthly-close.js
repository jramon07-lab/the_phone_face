(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M)return;

  const $=id=>document.getElementById(id);
  const text=value=>String(value||'').trim();
  const normal=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(value||0));
  const escape=value=>text(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const stageNamed=(stage,word)=>normal(stage?.name).includes(word);

  function addStyle(){
    if($('tpfMonthlyCloseStyle'))return;
    const style=document.createElement('style');
    style.id='tpfMonthlyCloseStyle';
    style.textContent=`
#tpfMonthlyClose{position:fixed;inset:0;z-index:100700;background:linear-gradient(135deg,#101828e6,#111827bf);display:flex;align-items:stretch;justify-content:center;padding:8px}
.tpfMonthlyCard{width:min(1560px,99vw);height:98vh;background:#f6f8fb;border:1px solid #ffffff2e;border-radius:18px;box-shadow:0 30px 90px #0008;display:flex;flex-direction:column;overflow:hidden}
.tpfMonthlyHead{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 18px;background:linear-gradient(135deg,#0f2f68,#155eef);color:#fff}
.tpfMonthlyHead h2{margin:0;font-size:21px;letter-spacing:-.02em}
.tpfMonthlyHead small{display:block;color:#dbeafe;margin-top:2px}
.tpfMonthlyHead .tpfMonthlyCloseX{width:34px;height:34px;padding:0;border:1px solid #ffffff55;border-radius:10px;background:#ffffff18;color:#fff;font-size:22px;line-height:1;cursor:pointer}
.tpfMonthlyBody{flex:1;min-height:0;padding:10px;display:grid;grid-template-columns:minmax(0,1fr) clamp(300px,27vw,360px);gap:10px}
.tpfMonthlyMain,.tpfMonthlyAside{min-height:0;display:flex;flex-direction:column;gap:10px}
.tpfMonthlyStats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.tpfMonthlyStat{padding:12px 14px;border:1px solid #d8e2f4;border-radius:14px;background:#fff;box-shadow:0 8px 22px #1018280a}
.tpfMonthlyStat b{display:block;font-size:24px;line-height:1.1;color:#102a56;letter-spacing:-.02em}
.tpfMonthlyStat small{color:#667085;font-weight:700}
.tpfMonthlySection,.tpfMonthlyPendingPanel,.tpfMonthlyInfo{border:1px solid #dfe7f3;border-radius:14px;background:#fff;box-shadow:0 8px 22px #1018280a}
.tpfMonthlySection{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.tpfMonthlySectionHead,.tpfMonthlyPendingHead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:11px 13px;border-bottom:1px solid #e8edf5;background:#fbfdff}
.tpfMonthlySectionHead b,.tpfMonthlyPendingHead b{font-size:16px;color:#172b4d}
.tpfMonthlyHint{font-size:12px;color:#667085;text-align:right}
.tpfMonthlyTableWrap{flex:1;min-height:0;overflow:auto}
.tpfMonthlyTable{width:100%;border-collapse:separate;border-spacing:0}
.tpfMonthlyTable th,.tpfMonthlyTable td{padding:10px 12px;border-bottom:1px solid #edf1f7;text-align:left;vertical-align:middle}
.tpfMonthlyTable th{position:sticky;top:0;z-index:2;background:#f8fafc;font-size:11px;color:#475467;text-transform:uppercase;letter-spacing:.04em}
.tpfMonthlyTable tr:hover td{background:#f8fbff}
.tpfMonthlyTable b{color:#1d2939}
.tpfMonthlyTable small{color:#667085;font-weight:700}
.tpfMonthlyAmount{font-weight:800;color:#102a56;white-space:nowrap}
.tpfMonthlyDate{white-space:nowrap;color:#344054}
.tpfMonthlyEmpty{padding:26px 16px;color:#667085;text-align:center}
.tpfMonthlyPendingPanel{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.tpfMonthlyPendingHead{background:linear-gradient(135deg,#fff7ed,#fff)}
.tpfMonthlyPendingCount{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:28px;border-radius:999px;background:#ffedd5;color:#9a3412;font-weight:900}
.tpfMonthlyPendingList{margin:0;padding:7px;list-style:none;overflow:auto}
.tpfMonthlyPendingList li{padding:10px;border-radius:12px;border:1px solid #edf1f7;background:#fff;margin-bottom:7px}
.tpfMonthlyPendingList b{display:block;color:#1d2939}
.tpfMonthlyPendingMeta{display:flex;gap:7px;flex-wrap:wrap;margin-top:7px}
.tpfMonthlyPendingMeta span{display:inline-flex;padding:4px 7px;border-radius:999px;background:#f2f4f7;color:#475467;font-size:11px;font-weight:800}
.tpfMonthlyInfo{padding:10px 12px;background:#fffbeb;color:#7a2e0e;border-color:#fedf89;font-size:12px;line-height:1.32}
.tpfMonthlyFoot{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 14px;border-top:1px solid #dfe7f3;background:#fff}
.tpfMonthlyFootText{color:#475467;font-size:13px}
.tpfMonthlyFootActions{display:flex;gap:10px;align-items:center}
.tpfMonthlyFoot button{border:1px solid #d0d5dd;border-radius:11px;background:#fff;padding:10px 14px;font-weight:800;cursor:pointer}
.tpfMonthlyFoot .primary{background:#155eef;border-color:#155eef;color:#fff;box-shadow:0 8px 20px #155eef2e}
.tpfMonthlyFoot button:disabled{opacity:.55;cursor:not-allowed}
@media(max-width:1180px){.tpfMonthlyBody{grid-template-columns:minmax(0,1fr) 310px}.tpfMonthlyTable th:nth-child(4),.tpfMonthlyTable td:nth-child(4){display:none}}
@media(max-height:760px){.tpfMonthlyHead{display:none}.tpfMonthlyBody{padding-top:8px}.tpfMonthlyTable th,.tpfMonthlyTable td{padding-top:8px;padding-bottom:8px}.tpfMonthlyStat{padding-top:10px;padding-bottom:10px}.tpfMonthlyStat b{font-size:22px}}
@media(max-width:1000px){#tpfMonthlyClose{padding:8px}.tpfMonthlyCard{height:98vh;width:98vw;border-radius:18px}.tpfMonthlyBody{grid-template-columns:1fr;overflow:auto}.tpfMonthlySection{min-height:520px}.tpfMonthlyAside{min-height:360px}.tpfMonthlyStats{grid-template-columns:1fr}.tpfMonthlyFoot{position:sticky;bottom:0;align-items:flex-start;flex-direction:column}.tpfMonthlyFootActions{width:100%;justify-content:flex-end}}
@media(max-width:680px){.tpfMonthlyHead{padding:16px}.tpfMonthlyHead h2{font-size:21px}.tpfMonthlyBody{padding:10px}.tpfMonthlyTable th:nth-child(3),.tpfMonthlyTable td:nth-child(3){display:none}.tpfMonthlyFootActions{flex-direction:column}.tpfMonthlyFootActions button{width:100%}}
`;
    document.head.appendChild(style);
  }

  function close(){document.querySelector('#tpfMonthlyClose')?.remove()}

  async function reloadSales(){
    try{if(typeof loadSales==='function')await loadSales()}catch(error){console.warn('Cierre de mes: no se pudo recargar el panel',error)}
  }

  function board(){
    let cache={};
    try{cache=salesCache||{}}catch(_){cache=window.salesCache||{}}
    const stages=Array.isArray(cache.stages)?cache.stages:[];
    const opportunities=Array.isArray(cache.opportunities)?cache.opportunities:[];
    const stage=id=>stages.find(item=>String(item.id)===String(id));
    return {
      stages,
      tramitado:opportunities.filter(item=>stageNamed(stage(item.stage_id),'tramit')),
      pending:opportunities.filter(item=>{
        const name=normal(stage(item.stage_id)?.name);
        return item.status!=='lost'&&!stageNamed(stage(item.stage_id),'tramit')&&!stageNamed(stage(item.stage_id),'ganad')&&!stageNamed(stage(item.stage_id),'perdid')&&!name.includes('antigu');
      })
    };
  }

  async function moveSelected(ids,stages){
    const won=stages.find(stage=>stageNamed(stage,'ganad'));
    if(!won)throw new Error('No existe la columna «Ganado».');
    for(const id of ids){
      const result=await sb.from('sales_opportunities').update({stage_id:won.id,position:0}).eq('id',id);
      if(result.error)throw result.error;
    }
  }

  function selectedIds(root){
    return [...root.querySelectorAll('[data-monthly-id]:checked')].map(item=>item.dataset.monthlyId);
  }

  function refreshSelectedSummary(root){
    const count=selectedIds(root).length;
    const label=$('tpfMonthlySelectedText');
    if(label)label.textContent=count+' seleccionada(s) para pasar a Ganado';
  }

  async function open(){
    addStyle();
    close();
    await reloadSales();
    const data=board();
    const total=data.tramitado.reduce((sum,item)=>sum+Number(item.amount||0),0);
    const root=document.createElement('div');
    root.id='tpfMonthlyClose';
    const rows=data.tramitado.map(item=>'<tr><td><input type="checkbox" data-monthly-id="'+escape(item.id)+'" checked></td><td><b>'+escape(item.client_name||item.title||'Sin nombre')+'</b><br><small>'+escape(item.title||'')+'</small></td><td class="tpfMonthlyAmount">'+money(item.amount)+'</td><td class="tpfMonthlyDate">'+escape(item.expected_date||'—')+'</td></tr>').join('')||'<tr><td colspan="4" class="tpfMonthlyEmpty">No hay oportunidades en Tramitado para cerrar.</td></tr>';
    const pending=data.pending.map(item=>{
      const stage=data.stages.find(stage=>String(stage.id)===String(item.stage_id));
      return '<li><b>'+escape(item.client_name||item.title||'Sin nombre')+'</b><small>'+escape(item.title||'')+'</small><div class="tpfMonthlyPendingMeta"><span>'+escape(stage?.name||'Sin columna')+'</span><span>'+money(item.amount)+'</span><span>'+escape(item.expected_date||'Sin fecha')+'</span></div></li>';
    }).join('')||'<li><b>No hay ofertas pendientes.</b><small>Todo está listo para cerrar.</small></li>';
    root.innerHTML='<section class="tpfMonthlyCard" role="dialog" aria-modal="true"><header class="tpfMonthlyHead"><div><h2>Cierre de mes</h2><small>Pantalla de control para pasar ventas tramitadas a Ganado sin tocar revisiones ni fechas.</small></div><button class="tpfMonthlyCloseX" type="button" aria-label="Cerrar" data-close>×</button></header><div class="tpfMonthlyBody"><main class="tpfMonthlyMain"><div class="tpfMonthlyStats"><div class="tpfMonthlyStat"><b>'+data.tramitado.length+'</b><small>ventas en Tramitado</small></div><div class="tpfMonthlyStat"><b>'+money(total)+'</b><small>importe seleccionado</small></div><div class="tpfMonthlyStat"><b>'+data.pending.length+'</b><small>ofertas pendientes</small></div></div><section class="tpfMonthlySection"><div class="tpfMonthlySectionHead"><div><b>Ventas para cerrar</b><div class="tpfMonthlyHint">Marca solo las que quieras mover a Ganado.</div></div><label class="tpfMonthlyHint"><input id="tpfMonthlyAll" type="checkbox" checked> Seleccionar todas</label></div><div class="tpfMonthlyTableWrap"><table class="tpfMonthlyTable"><thead><tr><th></th><th>Cliente / oportunidad</th><th>Importe</th><th>Fecha prevista</th></tr></thead><tbody>'+rows+'</tbody></table></div></section></main><aside class="tpfMonthlyAside"><section class="tpfMonthlyPendingPanel"><div class="tpfMonthlyPendingHead"><div><b>Ofertas pendientes</b><div class="tpfMonthlyHint">Se ven aquí, pero no se moverán.</div></div><span class="tpfMonthlyPendingCount">'+data.pending.length+'</span></div><ul class="tpfMonthlyPendingList">'+pending+'</ul></section><div class="tpfMonthlyInfo">Importante: el cierre solo cambia la columna de las ventas marcadas a <b>Ganado</b>. No modifica fechas previstas, revisiones de 3 meses ni revisiones de 11 meses.</div></aside></div><footer class="tpfMonthlyFoot"><div class="tpfMonthlyFootText" id="tpfMonthlySelectedText">'+data.tramitado.length+' seleccionada(s) para pasar a Ganado</div><div class="tpfMonthlyFootActions"><button type="button" data-close>Cancelar</button><button id="tpfMonthlySave" class="primary" type="button">Pasar seleccionadas a Ganado</button></div></footer></section>';
    document.body.appendChild(root);
    root.querySelectorAll('[data-close]').forEach(button=>button.onclick=close);
    const all=$('tpfMonthlyAll');
    all.onchange=()=>{root.querySelectorAll('[data-monthly-id]').forEach(item=>item.checked=all.checked);refreshSelectedSummary(root)};
    root.querySelectorAll('[data-monthly-id]').forEach(item=>item.onchange=refreshSelectedSummary.bind(null,root));
    $('tpfMonthlySave').onclick=async()=>{
      const ids=selectedIds(root);
      if(!ids.length)return alert('Selecciona al menos una oportunidad.');
      if(!confirm('Se moverán '+ids.length+' oportunidad(es) a Ganado. Las fechas y revisiones no cambiarán.'))return;
      const button=$('tpfMonthlySave');
      button.disabled=true;
      try{
        await moveSelected(ids,data.stages);
        await reloadSales();
        close();
        alert(ids.length+' oportunidades marcadas como Ganado.');
      }catch(error){
        alert(error?.message||'No se pudo cerrar el mes.');
      }finally{button.disabled=false}
    };
  }

  function mount(){
    addStyle();
    const anchor=$('newOpp');
    if(!anchor||$('tpfMonthlyCloseBtn'))return;
    const button=document.createElement('button');
    button.type='button';
    button.id='tpfMonthlyCloseBtn';
    button.className='secondary';
    button.textContent='Cierre de mes';
    button.onclick=open;
    anchor.after(button);
  }

  M.register('monthly-close',{install(){mount();window.addEventListener('tpf:sales-updated',mount);setInterval(mount,1000)}});
})();
