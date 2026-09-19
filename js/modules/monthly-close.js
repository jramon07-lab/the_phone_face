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
    style.textContent='#tpfMonthlyClose{position:fixed;inset:0;z-index:100700;background:#10182899;display:grid;place-items:center;padding:18px}.tpfMonthlyCard{width:min(1010px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 60px #0005}.tpfMonthlyHead,.tpfMonthlyFoot{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:20px 26px;border-bottom:1px solid #e4e7ec}.tpfMonthlyHead h2{margin:0;font-size:22px}.tpfMonthlyHead small{display:block;color:#667085;margin-top:4px}.tpfMonthlyHead button{width:34px;height:34px;padding:0;font-size:23px;line-height:1}.tpfMonthlyBody{padding:22px 26px}.tpfMonthlyStats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:22px}.tpfMonthlyStat{padding:15px 17px;border:1px solid #d9e2f1;border-radius:12px;background:#f8fbff}.tpfMonthlyStat b{display:block;font-size:23px;color:#172b4d}.tpfMonthlyStat small{color:#667085}.tpfMonthlySection{border:1px solid #e4e7ec;border-radius:12px;overflow:hidden}.tpfMonthlySectionHead{display:flex;justify-content:space-between;align-items:center;padding:13px 15px;background:#f9fafb}.tpfMonthlySectionHead b{font-size:15px}.tpfMonthlyHint{font-size:12px;color:#667085}.tpfMonthlyTable{width:100%;border-collapse:collapse}.tpfMonthlyTable th,.tpfMonthlyTable td{padding:12px 14px;border-bottom:1px solid #eaecf0;text-align:left}.tpfMonthlyTable tr:last-child td{border-bottom:0}.tpfMonthlyTable th{font-size:12px;color:#475467;background:#fff}.tpfMonthlyEmpty{padding:20px 14px;color:#667085}.tpfMonthlyPending{margin-top:16px;border:1px solid #e4e7ec;border-radius:12px;background:#fff}.tpfMonthlyPending summary{padding:14px 15px;font-weight:800;cursor:pointer;list-style:none}.tpfMonthlyPending summary::-webkit-details-marker{display:none}.tpfMonthlyPending summary:after{content:"⌄";float:right;color:#667085}.tpfMonthlyPending[open] summary{border-bottom:1px solid #eaecf0}.tpfMonthlyPending[open] summary:after{content:"⌃"}.tpfMonthlyPending ul{margin:0;padding:8px 15px 13px;list-style:none}.tpfMonthlyPending li{padding:7px 0;border-bottom:1px solid #f2f4f7}.tpfMonthlyPending li:last-child{border-bottom:0}.tpfMonthlyWarn{padding:11px 13px;background:#fffaeb;color:#7a2e0e;border:1px solid #fedf89;border-radius:9px;margin-top:16px;font-size:13px}.tpfMonthlyFoot{border-top:1px solid #e4e7ec;border-bottom:0;justify-content:flex-end}.tpfMonthlyFoot button,.tpfMonthlyHead button{border:1px solid #d0d5dd;border-radius:9px;background:#fff;padding:10px 13px;font-weight:700;cursor:pointer}.tpfMonthlyFoot .primary{background:#155eef;border-color:#155eef;color:#fff}@media(max-width:680px){.tpfMonthlyStats{grid-template-columns:1fr}.tpfMonthlyTable th:nth-child(3),.tpfMonthlyTable td:nth-child(3){display:none}.tpfMonthlyHead,.tpfMonthlyBody,.tpfMonthlyFoot{padding-left:14px;padding-right:14px}}';
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

  async function open(){
    addStyle();
    close();
    // The modal must use the same fresh board data that is displayed behind it.
    await reloadSales();
    const data=board();
    const total=data.tramitado.reduce((sum,item)=>sum+Number(item.amount||0),0);
    const root=document.createElement('div');
    root.id='tpfMonthlyClose';
    const rows=data.tramitado.map(item=>'<tr><td><input type="checkbox" data-monthly-id="'+escape(item.id)+'" checked></td><td><b>'+escape(item.client_name||item.title||'Sin nombre')+'</b><br><small>'+escape(item.title||'')+'</small></td><td>'+money(item.amount)+'</td><td>'+escape(item.expected_date||'—')+'</td></tr>').join('')||'<tr><td colspan="4" class="tpfMonthlyEmpty">No hay oportunidades en Tramitado para cerrar.</td></tr>';
    const pending=data.pending.map(item=>'<li><b>'+escape(item.client_name||item.title||'Sin nombre')+'</b> · '+escape(data.stages.find(stage=>String(stage.id)===String(item.stage_id))?.name||'')+' · '+money(item.amount)+'</li>').join('')||'<li>No hay ofertas pendientes.</li>';
    root.innerHTML='<section class="tpfMonthlyCard" role="dialog" aria-modal="true"><header class="tpfMonthlyHead"><div><h2>Cierre de mes</h2><small>Revisa las ventas tramitadas antes de cerrarlas como Ganado.</small></div><button type="button" aria-label="Cerrar" data-close>×</button></header><div class="tpfMonthlyBody"><div class="tpfMonthlyStats"><div class="tpfMonthlyStat"><b>'+data.tramitado.length+'</b><small>ventas en Tramitado</small></div><div class="tpfMonthlyStat"><b>'+money(total)+'</b><small>importe seleccionado</small></div><div class="tpfMonthlyStat"><b>'+data.pending.length+'</b><small>ofertas pendientes</small></div></div><section class="tpfMonthlySection"><div class="tpfMonthlySectionHead"><b>Ventas para cerrar</b><span class="tpfMonthlyHint">Solo se moverán las que marques.</span></div><table class="tpfMonthlyTable"><thead><tr><th><input id="tpfMonthlyAll" type="checkbox" checked></th><th>Cliente / oportunidad</th><th>Importe</th><th>Fecha prevista</th></tr></thead><tbody>'+rows+'</tbody></table></section><details class="tpfMonthlyPending"><summary>Ver ofertas pendientes ('+data.pending.length+')</summary><ul>'+pending+'</ul></details><div class="tpfMonthlyWarn">Las ofertas pendientes solo se muestran: no se mueven. Las fechas previstas y las revisiones de 3 y 11 meses no se modifican.</div></div><footer class="tpfMonthlyFoot"><button type="button" data-close>Cancelar</button><button id="tpfMonthlySave" class="primary" type="button">Marcar seleccionadas como Ganado</button></footer></section>';
    document.body.appendChild(root);
    root.querySelectorAll('[data-close]').forEach(button=>button.onclick=close);
    const all=$('tpfMonthlyAll');
    all.onchange=()=>root.querySelectorAll('[data-monthly-id]').forEach(item=>item.checked=all.checked);
    $('tpfMonthlySave').onclick=async()=>{
      const ids=[...root.querySelectorAll('[data-monthly-id]:checked')].map(item=>item.dataset.monthlyId);
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
