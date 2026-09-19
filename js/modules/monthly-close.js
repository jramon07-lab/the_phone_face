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
#tpfMonthlyClose{position:fixed;inset:0;z-index:100700;background:radial-gradient(circle at 15% 0%,#2563eb40,transparent 34%),linear-gradient(135deg,#08111fef,#111827e8);display:flex;align-items:stretch;justify-content:center;padding:10px;overflow:hidden}
.tpfMonthlyCard{width:min(1700px,99vw);height:98vh;background:#eef3fb;border:1px solid #ffffff42;border-radius:22px;box-shadow:0 34px 110px #0009;display:flex;flex-direction:column;overflow:hidden;overscroll-behavior:contain}
.tpfMonthlyHead{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:15px 22px;background:linear-gradient(135deg,#081936,#123f9f 58%,#1d4ed8);color:#fff}
.tpfMonthlyTitleRow{display:flex;align-items:center;gap:12px}
.tpfMonthlyBadge{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:999px;background:#ffffff1c;border:1px solid #ffffff35;color:#dbeafe;font-size:12px;font-weight:900;letter-spacing:.03em;text-transform:uppercase}
.tpfMonthlyHead h2{margin:0;font-size:25px;letter-spacing:-.03em}
.tpfMonthlyHead small{display:block;color:#dbeafe;margin-top:4px;font-weight:700}
.tpfMonthlyHead .tpfMonthlyCloseX{width:40px;height:40px;padding:0;border:1px solid #ffffff55;border-radius:13px;background:#ffffff18;color:#fff;font-size:24px;line-height:1;cursor:pointer}
.tpfMonthlyBody{flex:1 1 auto;min-height:0;padding:12px;display:flex;flex-direction:column;gap:10px;overflow:hidden}
.tpfMonthlyMain{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:12px;overflow:hidden}
.tpfMonthlyStats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.tpfMonthlyStat{position:relative;overflow:hidden;padding:14px 18px;border:1px solid #c9d8ef;border-radius:18px;background:linear-gradient(180deg,#fff,#f6f9ff);box-shadow:0 10px 24px #10182812}
.tpfMonthlyStat:before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:#2563eb}
.tpfMonthlyStat:nth-child(2):before{background:#16a34a}.tpfMonthlyStat:nth-child(3):before{background:#f97316}
.tpfMonthlyStat b{display:block;font-size:27px;line-height:1.05;color:#0f172a;letter-spacing:-.03em}
.tpfMonthlyStat small{display:block;margin-top:5px;color:#64748b;font-weight:900;text-transform:lowercase}
.tpfMonthlyTabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-items:center;padding:5px;border:1px solid #cbd8ec;border-radius:18px;background:#fff;box-shadow:0 8px 20px #10182812}
.tpfMonthlyTab{display:flex;justify-content:center;align-items:center;gap:8px;border:0;border-radius:14px;background:transparent;color:#334155;padding:12px 14px;font-weight:950;cursor:pointer}
.tpfMonthlyTab.active{background:#155eef;color:#fff;box-shadow:0 10px 22px #155eef2d}
.tpfMonthlyTabCount{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:24px;padding:0 7px;border-radius:999px;background:#eef2ff;color:#1d4ed8;font-size:12px}
.tpfMonthlyTab.active .tpfMonthlyTabCount{background:#ffffff29;color:#fff}
.tpfMonthlySection,.tpfMonthlyInfo{border:1px solid #cdd9ea;border-radius:18px;background:#fff;box-shadow:0 10px 24px #10182812}
.tpfMonthlySection{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.tpfMonthlyView{display:none}
.tpfMonthlyView.active{display:flex}
.tpfMonthlySectionHead{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:13px 17px;border-bottom:1px solid #dce5f2;background:linear-gradient(180deg,#fff,#f6f9ff)}
.tpfMonthlySectionHead b{font-size:18px;color:#0f172a;letter-spacing:-.02em}
.tpfMonthlySectionHead p{margin:3px 0 0;color:#667085;font-size:12px;font-weight:750}
.tpfMonthlyHint{font-size:12px;color:#667085;text-align:right;font-weight:800}
.tpfMonthlySelectAll{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #dbe4f0;border-radius:999px;background:#f8fafc;white-space:nowrap}
.tpfMonthlyTableWrap{flex:1 1 auto;min-height:0;max-height:calc(98vh - 240px);overflow-y:auto;overflow-x:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:#fff}
.tpfMonthlyTable{width:100%;border-collapse:separate;border-spacing:0}
.tpfMonthlyTable th,.tpfMonthlyTable td{padding:10px 15px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:middle}
.tpfMonthlyTable th{position:sticky;top:0;z-index:2;background:#eaf1fb;font-size:11px;color:#334155;text-transform:uppercase;letter-spacing:.055em}
.tpfMonthlyTable tr:nth-child(even) td{background:#f8fbff}
.tpfMonthlyTable tr:hover td{background:#eaf3ff}
.tpfMonthlyTable input[type="checkbox"]{width:16px;height:16px;accent-color:#155eef}
.tpfMonthlyTable b{color:#0b1220;font-size:14px}
.tpfMonthlyTable small{color:#475569;font-weight:900}
.tpfMonthlyMeta{display:flex;flex-wrap:wrap;gap:5px 10px;margin-top:4px;color:#667085;font-size:12px;font-weight:700}
.tpfMonthlyMeta span{white-space:nowrap;display:inline-flex;align-items:center;padding:2px 6px;border-radius:999px;background:#f1f5f9;color:#475569}
.tpfMonthlyParty{display:inline-flex;margin-top:6px;padding:3px 7px;border-radius:999px;background:#f5f3ff;color:#6d28d9;font-size:12px;font-weight:900}
.tpfMonthlyAmount{font-weight:950;color:#0f2f68;white-space:nowrap}
.tpfMonthlyDate{white-space:nowrap;color:#334155;font-weight:850}
.tpfMonthlyEmpty{padding:26px 16px;color:#667085;text-align:center}
.tpfMonthlyInfo{padding:8px 11px;background:#fff7ed;color:#9a3412;border-color:#fed7aa;font-size:12px;line-height:1.32;font-weight:800}
.tpfMonthlyFoot{position:sticky;bottom:0;z-index:5;display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 16px;border-top:1px solid #d6e0ef;background:#fff}
.tpfMonthlyFootText{color:#475467;font-size:13px;font-weight:800}
.tpfMonthlyFootActions{display:flex;gap:10px;align-items:center}
.tpfMonthlyFoot button{border:1px solid #d0d5dd;border-radius:12px;background:#fff;padding:11px 16px;font-weight:900;cursor:pointer}
.tpfMonthlyFoot .primary{background:#155eef;border-color:#155eef;color:#fff;box-shadow:0 10px 22px #155eef33}
.tpfMonthlyFoot button:disabled{opacity:.55;cursor:not-allowed}
@media(max-width:1180px){.tpfMonthlyTable th:nth-child(4),.tpfMonthlyTable td:nth-child(4){display:none}}
@media(max-height:760px){.tpfMonthlyHead{padding:10px 16px}.tpfMonthlyHead h2{font-size:20px}.tpfMonthlyHead small{display:none}.tpfMonthlyBody{padding:10px}.tpfMonthlyTabs{gap:6px}.tpfMonthlyTab{padding:8px 11px}.tpfMonthlyTable th,.tpfMonthlyTable td{padding-top:8px;padding-bottom:8px}.tpfMonthlyStat{padding:9px 12px}.tpfMonthlyStat b{font-size:20px}.tpfMonthlyTableWrap{max-height:calc(98vh - 206px)}}
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
    root.innerHTML='<section class="tpfMonthlyCard" role="dialog" aria-modal="true"><header class="tpfMonthlyHead"><div><div class="tpfMonthlyTitleRow"><span class="tpfMonthlyBadge">Control mensual</span><h2>Cierre de mes</h2></div><small>Pasa solo las ventas tramitadas a Ganado. Las ofertas pendientes, revisiones y fechas quedan intactas.</small></div><button class="tpfMonthlyCloseX" type="button" aria-label="Cerrar" data-close>×</button></header><div class="tpfMonthlyBody"><div class="tpfMonthlyStats"><div class="tpfMonthlyStat"><b>'+data.tramitado.length+'</b><small>ventas en Tramitado</small></div><div class="tpfMonthlyStat"><b>'+money(total)+'</b><small>importe seleccionado</small></div><div class="tpfMonthlyStat"><b>'+data.pending.length+'</b><small>ofertas pendientes</small></div></div><div class="tpfMonthlyTabs" role="tablist"><button class="tpfMonthlyTab active" type="button" data-monthly-view="sales">Ventas para cerrar <span class="tpfMonthlyTabCount">'+data.tramitado.length+'</span></button><button class="tpfMonthlyTab" type="button" data-monthly-view="pending">Ofertas pendientes <span class="tpfMonthlyTabCount">'+data.pending.length+'</span></button></div><main class="tpfMonthlyMain"><section class="tpfMonthlySection tpfMonthlyView active" data-monthly-panel="sales"><div class="tpfMonthlySectionHead"><div><b>Ventas para cerrar</b><p>Selecciona únicamente las ventas que quieres pasar a Ganado.</p></div><label class="tpfMonthlySelectAll"><input id="tpfMonthlyAll" type="checkbox" checked> Seleccionar todas</label></div><div class="tpfMonthlyTableWrap"><table class="tpfMonthlyTable"><thead><tr><th></th><th>Cliente / oportunidad</th><th>Importe</th><th>Fecha prevista</th></tr></thead><tbody>'+rows+'</tbody></table></div></section><section class="tpfMonthlySection tpfMonthlyView" data-monthly-panel="pending"><div class="tpfMonthlySectionHead"><div><b>Ofertas pendientes</b><p>Vista de control. Se ven aquí, pero no se moverán al cerrar el mes.</p></div><div class="tpfMonthlyInfo">Fechas previstas y revisiones de 3 y 11 meses no se modifican.</div></div><div class="tpfMonthlyTableWrap"><table class="tpfMonthlyTable"><thead><tr><th>Cliente / oportunidad</th><th>Columna</th><th>Importe</th><th>Fecha prevista</th></tr></thead><tbody>'+pendingRows+'</tbody></table></div></section></main></div><footer class="tpfMonthlyFoot"><div class="tpfMonthlyFootText" id="tpfMonthlySelectedText">'+data.tramitado.length+' seleccionada(s) para pasar a Ganado</div><div class="tpfMonthlyFootActions"><button type="button" data-close>Cancelar</button><button id="tpfMonthlySave" class="primary" type="button">Pasar seleccionadas a Ganado</button></div></footer></section>';
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
