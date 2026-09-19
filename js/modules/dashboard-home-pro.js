(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
const number=id=>Number(String($(id)?.textContent||'0').replace(/[^0-9]/g,''))||0;
const stageCount=name=>{const item=[...document.querySelectorAll('#dashFunnel > *')].find(x=>String(x.textContent||'').toLowerCase().includes(name));return Number(String(item?.textContent||'0').match(/\d+(?!.*\d)/)?.[0]||0)};
function addStyle(){
 if($('dashboardHomeProCss'))return;
 const style=document.createElement('style');style.id='dashboardHomeProCss';
 style.textContent=`
 #view-dashboard.tpfDashPro{padding:24px 26px 34px!important;background:linear-gradient(135deg,#f8faff 0%,#eef4ff 100%)!important}
 .tpfDashPro .dashHero{align-items:center;margin:0 0 18px;padding:20px 22px;border:1px solid #dce7f6;border-radius:18px;background:linear-gradient(110deg,#fff,#f4f8ff);box-shadow:0 10px 28px rgba(29,78,216,.07)}
 .tpfDashPro .dashHero h1{font-size:29px;letter-spacing:-.04em}.tpfDashPro .dashHero p{font-size:13px}.tpfDashPro .dashHeroActions button{height:40px;border-radius:10px}
 .tpfDashPro .metricGrid{gap:12px;margin-bottom:12px}.tpfDashPro .metricCard{position:relative;padding:15px 16px;border:1px solid #e1e9f5;border-radius:15px;background:#fff;box-shadow:0 5px 18px rgba(16,24,40,.045);overflow:hidden;transition:.18s ease}
 .tpfDashPro .metricCard:before{content:'';position:absolute;inset:0 auto 0 0;width:4px;background:#2563eb}.tpfDashPro .metricCard.dangerMetric:before{background:#dc2626}.tpfDashPro .metricCard:hover{transform:translateY(-2px);box-shadow:0 12px 24px rgba(16,24,40,.09)}
 .tpfDashPro .metricCard strong{font-size:25px;letter-spacing:-.04em}.tpfDashPro .metricCard span{font-weight:700;font-size:11px;color:#475467}.tpfDashPro .metricCard small{font-size:10px}
 .tpfDashPro .dashColumns,.tpfDashPro .commercialDashboard{gap:12px;margin-bottom:12px}.tpfDashPro .dashPanel{padding:16px;border:1px solid #e1e9f5;border-radius:16px;background:#fff;box-shadow:0 6px 20px rgba(16,24,40,.045)}
 .tpfDashPro .dashPanelHead{margin-bottom:11px}.tpfDashPro .dashPanelHead h3{font-size:15px}.tpfDashPro .linkBtn{padding:6px 9px;border-radius:8px;background:#eff5ff}.tpfDashPro .linkBtn:hover{background:#dbeafe}
 .tdHomeToday{display:grid;gap:8px}.tdHomeTodayIntro{margin:0 0 4px;color:#667085;font-size:11px}.tdHomeTodayRow{display:grid;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;padding:10px;border:1px solid #e7edf6;border-radius:11px;background:linear-gradient(90deg,#fcfdff,#f4f8ff);text-align:left;cursor:pointer;transition:.16s ease}
 .tdHomeTodayRow:hover{border-color:#bdd2f5;transform:translateX(2px)}.tdHomeTodayIcon{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:#e9f1ff;color:#1857c9;font-size:16px}.tdHomeTodayCopy b{display:block;color:#123d91;font-size:19px;line-height:1}.tdHomeTodayCopy small{display:block;margin-top:3px;color:#667085;font-size:10px}.tdHomeTodayArrow{font-size:20px;color:#98a2b3}
 .tpfDashPro .dashList>div,.tpfDashPro .forecastList>div{border-color:#edf1f6}@media(max-width:760px){#view-dashboard.tpfDashPro{padding:13px!important}.tpfDashPro .dashHero{padding:16px;border-radius:14px}.tpfDashPro .dashHero h1{font-size:23px}}
 `;
 document.head.appendChild(style);
}
function row(icon,value,label,route){return '<button class="tdHomeTodayRow" type="button" data-route="'+route+'"><span class="tdHomeTodayIcon">'+icon+'</span><span class="tdHomeTodayCopy"><b>'+value+'</b><small>'+label+'</small></span><span class="tdHomeTodayArrow">›</span></button>'}
function refresh(){
 const box=$('dashContactToday');const panel=box?.closest('.dashPanel');if(!box||!panel)return;
 panel.querySelector('h3').textContent='✦ Hoy comercial';
 const action=panel.querySelector('.linkBtn');if(action){action.textContent='Ver agenda';action.onclick=()=>window.openAppView?.('agenda')}
 const today=number('mTasksToday'), pending=number('mTasks'), followups=stageCount('seguimiento'), processing=stageCount('tramitado')+stageCount('pendiente de tramitar');
 const html='<p class="tdHomeTodayIntro">Lo que necesita atención para avanzar hoy.</p>'+row('☎',today,today===1?'gestión para hoy':'gestiones para hoy','agenda')+row('✓',pending,pending===1?'tarea pendiente':'tareas pendientes','agenda')+row('✦',followups,'ofertas a seguir','sales')+row('▣',processing,'tramitaciones','sales');
 if(box.dataset.homeProHtml!==html){box.dataset.homeProHtml=html;box.className='tdHomeToday';box.innerHTML=html}
}
function install(){
 addStyle();const root=$('view-dashboard');if(!root)return;
 root.classList.add('tpfDashPro');
 root.addEventListener('click',event=>{const button=event.target.closest('.tdHomeTodayRow');if(button)window.openAppView?.(button.dataset.route)});
 let queued=false;const later=()=>{if(queued)return;queued=true;setTimeout(()=>{queued=false;refresh()},20)};
 new MutationObserver(later).observe(root,{childList:true,subtree:true,characterData:true});
 setTimeout(refresh,350);setTimeout(refresh,1200);
}
M.register('dashboard-home-pro',{install});
})();