(function(){
'use strict';
const M=window.TPFModules;if(!M)return;

function install(){
  if(typeof window.sb==='undefined' || typeof window.$!=='function'){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(typeof window.sb!=='undefined' && typeof window.$==='function'){
        clearInterval(timer);
        installFastDashboard();
      }else if(tries>=40){
        clearInterval(timer);
      }
    },100);
    return;
  }
  installFastDashboard();
}

function installFastDashboard(){
  if(window.__tpfFastDashboardInstalled)return;
  window.__tpfFastDashboardInstalled=true;

  const fastDashboard=async function(){
    try{
      const [oppR,stageR,taskR,countR,actR]=await Promise.all([
        sb.from('sales_opportunities').select('*').order('updated_at',{ascending:false}).limit(1000),
        sb.from('sales_stages').select('*').eq('active',true).order('position'),
        sb.from('agenda_items').select('*').order('starts_at',{ascending:true}).limit(500),
        sb.from('records').select('id',{count:'exact',head:true}).eq('source_sheet','BASE DE DATOS'),
        sb.from('crm_audit_log').select('*').order('created_at',{ascending:false}).limit(20)
      ]);

      const d={
        opps:oppR.data||[],
        stages:stageR.data||[],
        tasks:taskR.data||[],
        contactCount:Number(countR.count||0),
        activity:[]
      };
      const localActivity=typeof localAuditRead==='function'?localAuditRead():[];
      d.activity=actR.error?localActivity:[...(actR.data||[]),...localActivity]
        .sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))
        .slice(0,50);

      const today=localDateKey();
      const open=d.opps.filter(oppIsOpen), expired=d.opps.filter(oppIsExpired);
      const amount=d.opps.reduce((s,o)=>s+Number(o.amount||0),0);
      const wonStageIds=new Set(d.stages.filter(s=>stageLooksWon(s.name)).map(s=>s.id));
      const won=d.opps.filter(o=>wonStageIds.has(o.stage_id)||/won|ganad/i.test(String(o.status||''))).length;
      const pending=d.tasks.filter(t=>String(t.status||'pending')==='pending');
      const todayTasks=pending.filter(t=>String(t.starts_at||'').slice(0,10)===today).length;

      $('mOppTotal').textContent=d.opps.length;
      $('mOppAmount').textContent=fmtMoney(amount);
      $('mOppOpen').textContent=open.length;
      $('mOppExpired').textContent=expired.length;
      $('mTasks').textContent=pending.length;
      $('mTasksToday').textContent=todayTasks?`${todayTasks} para hoy`:'Ninguna para hoy';
      $('mContacts').textContent=d.contactCount;
      $('mConversion').textContent=d.opps.length?`${Math.round(won/d.opps.length*100)}%`:'0%';

      crmAlertsCache=buildAlerts(d);
      updateAlertBadge();
      $('dashAlerts').innerHTML=crmAlertsCache.slice(0,6).map(a=>`<div class="dashItem"><div class="dashItemMain"><b>${esc(a.title)}</b><small>${esc(a.sub)}</small></div><div class="itemActionPack"><span class="pill ${a.severity}">${a.type==='expired'?'Vencida':a.type==='stale'?'Sin seguimiento':'Hoy'}</span>${renderCrmActions(a)}</div></div>`).join('')||'<div class="small">Todo al día. No hay avisos prioritarios.</div>';

      const counts=d.stages.map(s=>({name:s.name,count:d.opps.filter(o=>o.stage_id===s.id).length}));
      const mx=Math.max(1,...counts.map(x=>x.count));
      $('dashFunnel').innerHTML=counts.map(x=>`<div class="funnelRow"><span>${esc(x.name)}</span><div class="funnelBar"><div class="funnelFill" style="width:${Math.max(3,x.count/mx*100)}%"></div></div><b>${x.count}</b></div>`).join('')||'<div class="small">No hay columnas.</div>';
      $('dashActivity').innerHTML=d.activity.slice(0,8).map(a=>`<div class="dashItem"><div class="dashItemMain"><b>${esc(a.summary||a.action)}</b><small>${new Date(a.created_at).toLocaleString('es-ES')}</small></div><div class="itemActionPack"><span class="pill">${esc(a.entity_type)}</span>${renderAuditActions(a)}</div></div>`).join('')||'<div class="small">La actividad nueva aparecerá aquí.</div>';
    }catch(e){
      console.error('Dashboard ligero',e);
      const box=$('dashAlerts');if(box)box.innerHTML=`<div class="small">${esc(e.message||'No se pudo cargar el resumen')}</div>`;
    }
  };

  window.loadDashboard=fastDashboard;
  const btn=$('dashRefresh');
  if(btn)btn.onclick=fastDashboard;
}

M.register('dashboard-performance-guard',{install});
})();
