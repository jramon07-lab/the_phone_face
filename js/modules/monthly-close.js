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
#tpfMonthlyClose{position:fixed;inset:0;z-index:100700;background:linear-gradient(135deg,#101828e6,#111827bf);display:flex;align-items:stretch;justify-content:center;padding:8px;overflow:hidden}
.tpfMonthlyCard{width:min(1560px,99vw);height:98vh;background:#f6f8fb;border:1px solid #ffffff2e;border-radius:18px;box-shadow:0 30px 90px #0008;display:flex;flex-direction:column;overflow:hidden;overscroll-behavior:contain}
.tpfMonthlyHead{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 18px;background:linear-gradient(135deg,#0f2f68,#155eef);color:#fff}
.tpfMonthlyHead h2{margin:0;font-size:21px;letter-spacing:-.02em}
.tpfMonthlyHead small{display:block;color:#dbeafe;margin-top:2px}
.tpfMonthlyHead .tpfMonthlyCloseX{width:34px;height:34px;padding:0;border:1px solid #ffffff55;border-radius:10px;background:#ffffff18;color:#fff;font-size:22px;line-height:1;cursor:pointer}
.tpfMonthlyBody{flex:1 1 auto;min-height:0;padding:10px;display:flex;flex-direction:column;gap:10px;overflow:hidden}
.tpfMonthlyMain{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:10px;overflow:hidden}
.tpfMonthlyStats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.tpfMonthlyStat{padding:12px 14px;border:1px solid #d8e2f4;border-radius:14px;background:#fff;box-shadow:0 8px 22px #1018280a}
.tpfMonthlyStat b{display:block;font-size:24px;line-height:1.1;color:#102a56;letter-spacing:-.02em}
.tpfMonthlyStat small{color:#667085;font-weight:700}
.tpfMonthlyTabs{display:flex;gap:8px;align-items:center}
.tpfMonthlyTab{border:1px solid #d0d5dd;border-radius:999px;background:#fff;color:#344054;padding:9px 13px;font-weight:900;cursor:pointer}
.tpfMonthlyTab.active{background:#155eef;border-color:#155eef;color:#fff;box-shadow:0 8px 18px #155eef24}
.tpfMonthlyTabCount{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:22px;margin-left:6px;padding:0 6px;border-radius:999px;background:#f2f4f7;color:#344054;font-size:12px}
.tpfMonthlyTab.active .tpfMonthlyTabCount{background:#ffffff29;color:#fff}
.tpfMonthlySection,.tpfMonthlyInfo{border:1px solid #dfe7f3;border-radius:14px;background:#fff;box-shadow:0 8px 22px #1018280a}
.tpfMonthlySection{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.tpfMonthlyView{display:none}
.tpfMonthlyView.active{display:flex}
.tpfMonthlySectionHead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:11px 13px;border-bottom:1px solid #e8edf5;background:#fbfdff}
.tpfMonthlySectionHead b{font-size:16px;color:#172b4d}
.tpfMonthlyHint{font-size:12px;color:#667085;text-align:right}
.tpfMonthlyTableWrap{flex:1 1 auto;min-height:0;max-height:calc(98vh - 230px);overflow-y:auto;overflow-x:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.tpfMonthlyTable{width:100%;border-collapse:separate;border-spacing:0}
.tpfMonthlyTable th,.tpfMonthlyTable td{padding:10px 12px;border-bottom:1px solid #edf1f7;text-align:left;vertical-align:middle}
.tpfMonthlyTable th{position:sticky;top:0;z-index:2;background:#f8fafc;font-size:11px;color:#475467;text-transform:uppercase;letter-spacing:.04em}
.tpfMonthlyTable tr:hover td{background:#f8fbff}
.tpfMonthlyTable b{color:#1d2939}
.tpfMonthlyTable small{color:#667085;font-weight:700}
.tpfMonthlyMeta{display:flex;flex-wrap:wrap;gap:5px 10px;margin-top:4px;color:#667085;font-size:12px;font-weight:700}
.tpfMonthlyMeta span{white-space:nowrap}
.tpfMonthlyParty{display:block;margin-top:4px;color:#6d28d9;font-size:12px;font-weight:800}
.tpfMonthlyAmount{font-weight:800;color:#102a56;white-space:nowrap}
.tpfMonthlyDate{white-space:nowrap;color:#344054}
.tpfMonthlyEmpty{padding:26px 16px;color:#667085;text-align:center}
.tpfMonthlyInfo{padding:10px 12px;background:#fffbeb;color:#7a2e0e;border-color:#fedf89;font-size:12px;line-height:1.32}
.tpfMonthlyFoot{position:sticky;bottom:0;z-index:5;display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 14px;border-top:1px solid #dfe7f3;background:#fff}
.tpfMonthlyFootText{color:#475467;font-size:13px}
.tpfMonthlyFootActions{display:flex;gap:10px;align-items:center}
.tpfMonthlyFoot button{border:1px solid #d0d5dd;border-radius:11px;background:#fff;padding:10px 14px;font-weight:800;cursor:pointer}
.tpfMonthlyFoot .primary{background:#155eef;border-color:#155eef;color:#fff;box-shadow:0 8px 20px #155eef2e}
.tpfMonthlyFoot button:disabled{opacity:.55;cursor:not-allowed}
@media(max-width:1180px){.tpfMonthlyTable th:nth-child(4),.tpfMonthlyTable td:nth-child(4){display:none}}
@media(max-height:760px){.tpfMonthlyHead{display:none}.tpfMonthlyBody{padding-top:8px}.tpfMonthlyTabs{gap:6px}.tpfMonthlyTab{padding:7px 11px}.tpfMonthlyTable th,.tpfMonthlyTable td{padding-top:8px;padding-bottom:8px}.tpfMonthlyStat{padding:7px 10px}.tpfMonthlyStat b{font-size:18px}.tpfMonthlyTableWrap{max-height:calc(98vh - 180px)}}
@media(max-width:1000px){#tpfMonthlyClose{padding:8px}.tpfMonthlyCard{height:98vh;width:98vw;border-radius:18px}.tpfMonthlyStats{grid-template-columns:1fr}.tpfMonthlyTabs{flex-wrap:wrap}.tpfMonthlyFoot{align-items:flex-start;flex-direction:column}.tpfMonthlyFootActions{width:100%;justify-content:flex-end}}
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

  async function contactLookup(){
    try{
      if(!window.TPFRecordLinks?.load)return {records:new Map(),lookup:null};
      const rows=await window.TPFRecordLinks.load(sb);
      return {records:new Map(rows.map(row=>[String(row.id),row])),lookup:window.TPFRecordLinks.index(rows)};
    }catch(error){
      console.warn('Cierre de mes: no se pudieron cargar los contactos vinculados',error);
      return {records:new Map(),lookup:null};
    }
  }

  function recordValues(record){
    const data=record?.data||{};
    return {
      name:text(data['NOMBRE Y APELLIDOS']||[data.NOMBRE,data.APELLIDOS].filter(Boolean).join(' ')),
      phone:text(data['TELÉFONO']||data.TELEFONO||data.PHONE||data.MOVIL),
      dni:text(data['DNI / NIF']||data.DNI||data.NIF)
    };
  }

  function managerNames(item,contacts){
    const id=String(item.record_id||item.contact_id||'');
    if(!id||!contacts.lookup?.managers?.has(id))return [];
    return [...contacts.lookup.managers.get(id)].map(managerId=>recordValues(contacts.records.get(String(managerId))).name).filter(Boolean);
  }

  function identityCell(item,contacts){
    const record=contacts.records.get(String(item.record_id||''));
    const values=recordValues(record);
    const info=window.TPFContactParty?.opportunityIdentity?.(item,record)||{};
    const holder=text(info.holder);
    const managers=[text(info.manager),...managerNames(item,contacts)].filter(Boolean);
    const phone=text(item.phone||info.recipient_phone||values.phone);
    const dni=text(info.dni||values.dni);
    const party=[];
    if(holder&&normal(holder)!==normal(item.client_name||values.name))party.push('Titular: '+holder);
    if(managers.length)party.push('Gestionado por: '+[...new Set(managers)].join(' · '));
    const meta=[phone?'Tel. '+phone:'',dni?'DNI '+dni:''].filter(Boolean).map(value=>'<span>'+escape(value)+'</span>').join('');
    return '<b>'+escape(item.client_name||holder||item.title||'Sin nombre')+'</b><br><small>'+escape(item.title||'')+'</small>'+(meta?'<div class="tpfMonthlyMeta">'+meta+'</div>':'')+(party.length?'<span class="tpfMonthlyParty">'+escape(party.join(' · '))+'</span>':'');
  }

  async function open(){
    addStyle();
    close();
    await reloadSales();
    const data=board();
    const contacts=await contactLookup();
    const total=data.tramitado.reduce((sum,item)=>sum+Number(item.amount||0),0);
    const root=document.createElement('div');
    root.id='tpfMonthlyClose';
    const rows=data.tramitado.map(item=>'<tr><td><input type="checkbox" data-monthly-id="'+escape(item.id)+'" checked></td><td>'+identityCell(item,contacts)+'</td><td class="tpfMonthlyAmount">'+money(item.amount)+'</td><td class="tpfMonthlyDate">'+escape(item.expected_date||'—')+'</td></tr>').join('')||'<tr><td colspan="4" class="tpfMonthlyEmpty">No hay oportunidades en Tramitado para cerrar.</td></tr>';
    const pendingRows=data.pending.map(item=>{
      const stage=data.stages.find(stage=>String(stage.id)===String(item.stage_id));
      return '<tr><td>'+identityCell(item,contacts)+'</td><td>'+escape(stage?.name||'Sin columna')+'</td><td class="tpfMonthlyAmount">'+money(item.amount)+'</td><td class="tpfMonthlyDate">'+escape(item.expected_date||'Sin fecha')+'</td></tr>';
    }).join('')||'<tr><td colspan="4" class="tpfMonthlyEmpty">No hay ofertas pendientes.</td></tr>';
    root.innerHTML='<section class="tpfMonthlyCard" role="dialog" aria-modal="true"><header class="tpfMonthlyHead"><div><h2>Cierre de mes</h2><small>Pantalla de control para pasar ventas tramitadas a Ganado sin tocar revisiones ni fechas.</small></div><button class="tpfMonthlyCloseX" type="button" aria-label="Cerrar" data-close>×</button></header><div class="tpfMonthlyBody"><div class="tpfMonthlyStats"><div class="tpfMonthlyStat"><b>'+data.tramitado.length+'</b><small>ventas en Tramitado</small></div><div class="tpfMonthlyStat"><b>'+money(total)+'</b><small>importe seleccionado</small></div><div class="tpfMonthlyStat"><b>'+data.pending.length+'</b><small>ofertas pendientes</small></div></div><div class="tpfMonthlyTabs" role="tablist"><button class="tpfMonthlyTab active" type="button" data-monthly-view="sales">Ventas para cerrar <span class="tpfMonthlyTabCount">'+data.tramitado.length+'</span></button><button class="tpfMonthlyTab" type="button" data-monthly-view="pending">Ofertas pendientes <span class="tpfMonthlyTabCount">'+data.pending.length+'</span></button></div><main class="tpfMonthlyMain"><section class="tpfMonthlySection tpfMonthlyView active" data-monthly-panel="sales"><div class="tpfMonthlySectionHead"><div><b>Ventas para cerrar</b><div class="tpfMonthlyHint">Marca solo las que quieras mover a Ganado.</div></div><label class="tpfMonthlyHint"><input id="tpfMonthlyAll" type="checkbox" checked> Seleccionar todas</label></div><div class="tpfMonthlyTableWrap"><table class="tpfMonthlyTable"><thead><tr><th></th><th>Cliente / oportunidad</th><th>Importe</th><th>Fecha prevista</th></tr></thead><tbody>'+rows+'</tbody></table></div></section><section class="tpfMonthlySection tpfMonthlyView" data-monthly-panel="pending"><div class="tpfMonthlySectionHead"><div><b>Ofertas pendientes</b><div class="tpfMonthlyHint">Solo se muestran para revisar. No se moverán al cerrar.</div></div><div class="tpfMonthlyInfo">No se modifican fechas ni revisiones.</div></div><div class="tpfMonthlyTableWrap"><table class="tpfMonthlyTable"><thead><tr><th>Cliente / oportunidad</th><th>Columna</th><th>Importe</th><th>Fecha prevista</th></tr></thead><tbody>'+pendingRows+'</tbody></table></div></section></main></div><footer class="tpfMonthlyFoot"><div class="tpfMonthlyFootText" id="tpfMonthlySelectedText">'+data.tramitado.length+' seleccionada(s) para pasar a Ganado</div><div class="tpfMonthlyFootActions"><button type="button" data-close>Cancelar</button><button id="tpfMonthlySave" class="primary" type="button">Pasar seleccionadas a Ganado</button></div></footer></section>';
    document.body.appendChild(root);
    const activeScroll=()=>root.querySelector('.tpfMonthlyView.active .tpfMonthlyTableWrap');
    root.addEventListener('wheel',event=>{
      const area=activeScroll();
      if(!area||event.target.closest('.tpfMonthlyFootActions')||event.target.closest('.tpfMonthlyTab'))return;
      event.preventDefault();
      area.scrollTop+=event.deltaY;
    },{passive:false});
    let touchY=0;
    root.addEventListener('touchstart',event=>{touchY=event.touches?.[0]?.clientY||0},{passive:true});
    root.addEventListener('touchmove',event=>{
      const area=activeScroll();
      const y=event.touches?.[0]?.clientY||0;
      if(!area||!touchY)return;
      event.preventDefault();
      area.scrollTop+=touchY-y;
      touchY=y;
    },{passive:false});
    root.querySelectorAll('[data-close]').forEach(button=>button.onclick=close);
    root.querySelectorAll('[data-monthly-view]').forEach(button=>button.onclick=()=>{
      const view=button.dataset.monthlyView;
      root.querySelectorAll('[data-monthly-view]').forEach(item=>item.classList.toggle('active',item===button));
      root.querySelectorAll('[data-monthly-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.monthlyPanel===view));
    });
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
