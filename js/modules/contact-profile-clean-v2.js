(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
let timelineObserver=null,opportunityObserver=null,busy=false;

function addStyles(){
 if($('tpfContactCleanV2Styles'))return;
 const s=document.createElement('style');s.id='tpfContactCleanV2Styles';s.textContent=`
#contactModal.tpfContactCleanV2 .contactProfile{background:#f6f8fb}
#contactModal.tpfContactCleanV2 .cpTop{height:64px;padding:0 28px;box-shadow:0 1px 2px rgba(16,24,40,.04)}
#contactModal.tpfContactCleanV2 .cpNav{color:#344054;font-size:14px;font-weight:600}
#contactModal.tpfContactCleanV2 .cpColumns{grid-template-columns:minmax(270px,300px) minmax(500px,1fr) minmax(320px,360px);gap:14px;max-width:1680px;padding:14px}
#contactModal.tpfContactCleanV2 .cpLeft,#contactModal.tpfContactCleanV2 .cpCenter{border-color:#e4e9f0;border-radius:12px;box-shadow:0 1px 2px rgba(16,24,40,.025)}
#contactModal.tpfContactCleanV2 .cpLeft{top:78px;background:transparent;border:0;overflow:visible;display:flex;flex-direction:column;gap:10px}
#contactModal.tpfContactCleanV2 .cpIdentity,#contactModal.tpfContactCleanV2 .cpData{background:#fff;border:1px solid #e4e9f0;border-radius:12px}
#contactModal.tpfContactCleanV2 .cpIdentity{padding:18px 16px 16px}
#contactModal.tpfContactCleanV2 .cpAvatar{width:54px;height:54px;border-radius:13px;margin-bottom:9px;background:#0b5bd3;box-shadow:0 5px 14px rgba(11,91,211,.18)}
#contactModal.tpfContactCleanV2 .cpName{font-size:17px!important;line-height:1.2!important;min-height:34px;text-overflow:ellipsis}
#contactModal.tpfContactCleanV2 .cpNameSplit{display:none!important}
#contactModal.tpfContactCleanV2 .cpBadge{padding:4px 9px;border-radius:7px}
#contactModal.tpfContactCleanV2 .cpQuick{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:13px}
#contactModal.tpfContactCleanV2 .cpQuick button{min-width:0;min-height:39px;padding:7px 5px;background:#fff;border-color:#dfe5ec;border-radius:9px;font-size:10px;font-weight:700}
#contactModal.tpfContactCleanV2 .cpQuick button:hover{border-color:#8eb4e8;background:#f7fbff}
#contactModal.tpfContactCleanV2 #tpfContactWhatsappMain{display:none!important}
#contactModal.tpfContactCleanV2 .cpOwner{order:2;background:#fff;border:1px solid #e4e9f0;border-radius:10px;padding:10px 14px}
#contactModal.tpfContactCleanV2 .cpData{order:3;padding:15px;display:flex;flex-direction:column}
#contactModal.tpfContactCleanV2 .tpfContactEditBar{margin-bottom:7px}
#contactModal.tpfContactCleanV2 .tpfContactEditBar h3{font-size:16px}
#contactModal.tpfContactCleanV2 .tpfContactEditBar button{min-width:auto;padding:6px 9px;font-size:10px}
#contactModal.tpfContactCleanV2 .tpfContactProtectedHint{margin:0 0 10px;font-size:9px}
#contactModal.tpfContactCleanV2 .cpData>label{margin-top:7px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.035em}
#contactModal.tpfContactCleanV2 .cpData>input,#contactModal.tpfContactCleanV2 .cpData>textarea{min-height:36px;margin-top:2px;border-color:#e1e6ed;border-radius:8px;font-size:12px}
#contactModal.tpfContactCleanV2 .cpData>textarea{min-height:64px}
#contactModal.tpfContactCleanV2 .cpData>label:has(+ #contactPhone){order:10}#contactModal.tpfContactCleanV2 #contactPhone{order:11}
#contactModal.tpfContactCleanV2 .cpData>label:has(+ #contactDni){order:20}#contactModal.tpfContactCleanV2 #contactDni{order:21}
#contactModal.tpfContactCleanV2 .cpData>label:has(+ #contactObservations){order:30}#contactModal.tpfContactCleanV2 #contactObservations{order:31}
#contactModal.tpfContactCleanV2 .cpData>label:has(+ #contactNotes){order:40}#contactModal.tpfContactCleanV2 #contactNotes{order:41}
#contactModal.tpfContactCleanV2 #contactBankLabel{order:50}#contactModal.tpfContactCleanV2 #contactBank{order:51}
#contactModal.tpfContactCleanV2 .cpData>label:has(+ #contactEmail){order:60}#contactModal.tpfContactCleanV2 #contactEmail{order:61}
#contactModal.tpfContactCleanV2 .contactCustomFieldsBox{display:none!important}
#contactModal.tpfContactCleanV2 .contactLabelsBox{order:70;margin-top:10px;padding:9px;background:#fafbfd;border-color:#e7ebf1}
#contactModal.tpfContactCleanV2 #contactMeta{order:80}.tpfContactCleanV2 .cpDuplicateHint{order:81}.tpfContactCleanV2 #contactMsg{order:82}
#contactModal.tpfContactCleanV2 .cpDuplicateHint{display:none}
#contactModal.tpfContactCleanV2 .cpDelete{order:4;margin:0;width:100%;background:#fff;border:1px solid #f1c5c1;color:#b42318}
#contactModal.tpfContactCleanV2 .cpCenter{padding:0 24px;min-height:calc(100vh - 92px)}
#contactModal.tpfContactCleanV2 .cpTabs{height:52px;gap:28px}.tpfContactCleanV2 .cpTabs b{height:52px}
#contactModal.tpfContactCleanV2 .cpActivityHead{padding:18px 0 10px}
#contactModal.tpfContactCleanV2 .cpActivityHead h2{font-size:22px}
#contactModal.tpfContactCleanV2 .cpFullHistoryHead{padding:7px 0 9px;border-bottom:1px solid #eef1f5;align-items:center}
#contactModal.tpfContactCleanV2 .cpFullHistoryHead h3{font-size:14px}
#contactModal.tpfContactCleanV2 .cpTimeline{padding:6px 4px 30px 7px}
#contactModal.tpfContactCleanV2 .cpEvent{border-left:0;padding:11px 8px 13px 48px;min-height:45px;border-bottom:1px solid #eef1f5}
#contactModal.tpfContactCleanV2 .cpEvent:last-child{border-bottom:0}
#contactModal.tpfContactCleanV2 .cpDot{left:9px;top:17px;width:24px;height:24px;border:0;background:#eef4ff;box-shadow:inset 0 0 0 7px #0b5bd3}
#contactModal.tpfContactCleanV2 .cpEvent-task,#contactModal.tpfContactCleanV2 .cpEvent-task_done{--event-color:#16a34a}
#contactModal.tpfContactCleanV2 .cpEvent-task .cpDot,#contactModal.tpfContactCleanV2 .cpEvent-task_done .cpDot{background:#eaf8ef;box-shadow:inset 0 0 0 7px var(--event-color)}
#contactModal.tpfContactCleanV2 .cpEventBody{gap:3px}.tpfContactCleanV2 .cpEventBody small{font-size:10px}.tpfContactCleanV2 .cpEventBody b{font-size:13px}.tpfContactCleanV2 .cpEventBody div{font-size:11px}
#contactModal.tpfContactCleanV2 .tpfHistoryDay{padding:15px 7px 4px;color:#0b5bd3;font-size:12px;font-weight:800}
#contactModal.tpfContactCleanV2 .tpfTechnicalActivity{margin:12px 4px 0;border:1px solid #e4e9f0;border-radius:9px;background:#fafbfd;overflow:hidden}
#contactModal.tpfContactCleanV2 .tpfTechnicalActivity summary{padding:10px 12px;cursor:pointer;color:#667085;font-size:10px;font-weight:700;list-style-position:inside}
#contactModal.tpfContactCleanV2 .tpfTechnicalList{padding:0 8px 4px}
#contactModal.tpfContactCleanV2 .tpfTechnicalList .cpEvent{opacity:.78}
#contactModal.tpfContactCleanV2 .cpRight{top:78px;background:transparent}
#contactModal.tpfContactCleanV2 .cpSideSection{border-color:#e4e9f0;border-radius:12px;padding:14px;margin-bottom:12px;box-shadow:0 1px 2px rgba(16,24,40,.025)}
#contactModal.tpfContactCleanV2 .cpSideTitle{padding-bottom:9px;margin-bottom:9px}.tpfContactCleanV2 .cpSideTitle b{font-size:15px}
#contactModal.tpfContactCleanV2 .cpOppStat{padding:7px 5px;background:#fff}.tpfContactCleanV2 .cpOppStat b{font-size:16px}
#contactModal.tpfContactCleanV2 .oppUnifiedCard{padding:11px!important;border-radius:10px!important;box-shadow:none!important}
body:has(#contactModal:not(.hidden)) #oppDetailModal:not(.hidden){z-index:80000!important;pointer-events:auto!important}
#contactModal.tpfContactCleanV2 .cpSideSection:has(#cpInfo){display:none}
#contactModal.tpfContactCleanV2 #cpTaskPage .cpTaskPageTop,#contactModal.tpfContactCleanV2 #cpTaskDetailPage .cpTaskPageTop{top:0!important;height:60px!important;padding:0 24px!important}
#contactModal.tpfContactCleanV2 #cpTaskPage .cpTaskPageBody,#contactModal.tpfContactCleanV2 #cpTaskDetailPage .cpTaskPageBody{max-width:1000px!important;margin:18px auto 28px!important;grid-template-columns:minmax(0,1fr) 240px!important;gap:14px!important;padding:0 18px!important}
#contactModal.tpfContactCleanV2 #cpTaskPage .cpTaskFormCard,#contactModal.tpfContactCleanV2 #cpTaskPage .cpTaskContactCard,#contactModal.tpfContactCleanV2 #cpTaskDetailPage .cpTaskFormCard,#contactModal.tpfContactCleanV2 #cpTaskDetailPage .cpTaskContactCard{padding:18px!important;border-radius:12px!important}
#contactModal.tpfContactCleanV2 #cpTaskPage .cpTaskFormCard>h2,#contactModal.tpfContactCleanV2 #cpTaskDetailPage .cpTaskFormCard>h2{display:none!important}
#contactModal.tpfContactCleanV2 #cpTaskContactLabel{margin:0 0 10px;color:#667085}
#contactModal.tpfContactCleanV2 #cpTaskPage .cpTaskFormCard>label,#contactModal.tpfContactCleanV2 #cpTaskDetailPage .cpTaskFormCard>label{margin-top:11px}
#contactModal.tpfContactCleanV2 #cpTaskPage .tpfTaskDateStack{gap:13px!important;margin-top:12px!important}
#contactModal.tpfContactCleanV2 #cpTaskPage .tpfTaskDateHeading{font-size:12px!important;margin-bottom:5px!important}
#contactModal.tpfContactCleanV2 #cpTaskPage .tpfPickerGrid{grid-template-columns:minmax(180px,1fr) 86px 86px!important;gap:8px!important}
#contactModal.tpfContactCleanV2 #cpTaskPage .tpfPickerDateBtn,#contactModal.tpfContactCleanV2 #cpTaskPage .tpfPickerGrid select{min-height:40px!important;height:40px!important}
#contactModal.tpfContactCleanV2 #cpTaskNotes,#contactModal.tpfContactCleanV2 #cpTaskDetailNotes{min-height:88px!important;height:88px;resize:vertical}
#contactModal.tpfContactCleanV2 #cpTaskPage .cpTaskOptions,#contactModal.tpfContactCleanV2 #cpTaskDetailPage .cpTaskOptions{gap:14px;margin:12px 0 8px;padding:10px}
#contactModal.tpfContactCleanV2 #cpTaskPage .cpTaskContactCard,#contactModal.tpfContactCleanV2 #cpTaskDetailPage .cpTaskContactCard{top:78px!important}
#contactModal.tpfContactCleanV2 #cpTaskContactName,#contactModal.tpfContactCleanV2 #cpTaskDetailContactName{font-size:15px;margin:8px 0 3px}
#contactModal.tpfContactCleanV2 #cpTaskPage .cpTaskTip,#contactModal.tpfContactCleanV2 #cpTaskDetailPage .cpTaskTip{margin-top:12px;padding:10px}
#contactModal.tpfContactCleanV2 #cpTaskDetailPage .modalGrid{gap:10px;margin-top:10px}
#contactModal.tpfContactCleanV2 #cpTaskDetailPage .cpTaskStatusBox{margin:12px 0;padding:10px 12px}
#contactModal.tpfContactCleanV2 #cpTaskDetailPage .cpTaskDetailActions{margin-top:12px;padding-top:12px}
@media(max-width:1180px){#contactModal.tpfContactCleanV2 .cpColumns{grid-template-columns:280px 1fr}.tpfContactCleanV2 .cpRight{grid-column:1/-1;position:static;display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:12px}.tpfContactCleanV2 .cpSideSection{margin:0}}
@media(max-width:820px){#contactModal.tpfContactCleanV2 #cpTaskPage .cpTaskPageBody,#contactModal.tpfContactCleanV2 #cpTaskDetailPage .cpTaskPageBody{grid-template-columns:1fr!important}.tpfContactCleanV2 #cpTaskPage .cpTaskContactCard,.tpfContactCleanV2 #cpTaskDetailPage .cpTaskContactCard{position:static!important}}
@media(max-width:760px){#contactModal.tpfContactCleanV2 .cpColumns{display:block;padding:8px}.tpfContactCleanV2 .cpLeft,.tpfContactCleanV2 .cpCenter,.tpfContactCleanV2 .cpRight{position:static;margin-bottom:10px}.tpfContactCleanV2 .cpRight{display:block}.tpfContactCleanV2 .cpSideSection{margin-bottom:10px}}
 `;document.head.appendChild(s);
}

function dayLabel(text){
 const m=String(text||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(!m)return'';
 const d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1])),today=new Date();today.setHours(0,0,0,0);d.setHours(0,0,0,0);
 const diff=Math.round((today-d)/86400000);if(diff===0)return'Hoy';if(diff===1)return'Ayer';
 return d.toLocaleDateString('es-ES',{day:'numeric',month:'long',year:d.getFullYear()===today.getFullYear()?undefined:'numeric'});
}

function polishTimeline(){
 const root=$('cpTimeline');if(!root||busy)return;busy=true;
 timelineObserver?.disconnect();
 try{
  root.querySelectorAll('.tpfHistoryDay').forEach(x=>x.remove());
  const existing=root.querySelector('.tpfTechnicalActivity');if(existing){[...existing.querySelectorAll('.cpEvent')].forEach(x=>root.appendChild(x));existing.remove()}
  const events=[...root.querySelectorAll(':scope > .cpEvent')],technical=[];let last='';
  events.forEach(event=>{
   const title=event.querySelector('.cpEventBody b')?.textContent||'';
   if(/^Tarea(?: completada)?\s*[·:-]\s*TPF prueba editar tarea/i.test(title)){technical.push(event);return}
   const label=dayLabel(event.querySelector('.cpEventBody small')?.textContent);
   if(label&&label!==last){const h=document.createElement('div');h.className='tpfHistoryDay';h.textContent=label;root.insertBefore(h,event);last=label}
  });
  if(technical.length){const details=document.createElement('details');details.className='tpfTechnicalActivity';const summary=document.createElement('summary');summary.textContent=`Mostrar actividad técnica (${technical.length})`;const list=document.createElement('div');list.className='tpfTechnicalList';technical.forEach(x=>list.appendChild(x));details.append(summary,list);root.appendChild(details)}
 }finally{if(timelineObserver)timelineObserver.observe(root,{childList:true});busy=false}
}

function polishOpportunities(){
 const root=$('cpOpportunities');if(!root)return;
 root.querySelectorAll('.tpfOppToggle').forEach(button=>button.remove());
 root.querySelectorAll('.oppUnifiedCard').forEach(card=>{
  card.classList.remove('tpfOppCollapsed');delete card.dataset.tpfClean;
 });
}

function syncObservation(){
 const field=$('contactObservations');if(!field)return;
 let data=null;try{data=typeof currentContact!=='undefined'?currentContact?.data:null}catch(_){data=null}
 if(!data)return;
 const keys=['OBSERVACIONES','OBSERVACION','Observaciones','observaciones','OBSERVATIONS'];
 const value=keys.map(key=>data?.[key]).find(item=>item!=null&&String(item).trim());
 if(value!=null&&String(value).trim())field.value=String(value);
 const noteKeys=['NOTAS','NOTES'];
 const note=noteKeys.map(key=>data?.[key]).find(item=>item!=null&&String(item).trim());
 if(note==null&&value!=null&&String(value).trim()&&$('contactNotes'))$('contactNotes').value='';
}

function apply(){
 const modal=$('contactModal');if(!modal)return;modal.classList.add('tpfContactCleanV2');
 const title=$('tpfContactEditBar')?.querySelector('h3');if(title)title.textContent='Datos del contacto';
 syncObservation();polishTimeline();polishOpportunities();
}

function install(){
 addStyles();apply();
 const timeline=$('cpTimeline'),opps=$('cpOpportunities');
 if(timeline&&!timelineObserver){timelineObserver=new MutationObserver(()=>requestAnimationFrame(polishTimeline));timelineObserver.observe(timeline,{childList:true})}
 if(opps&&!opportunityObserver){opportunityObserver=new MutationObserver(()=>requestAnimationFrame(polishOpportunities));opportunityObserver.observe(opps,{childList:true})}
 document.addEventListener('click',e=>{if(e.target.closest?.('#contactModal:not(.hidden),[onclick*="openContact"]'))setTimeout(apply,40)},true);
 window.addEventListener('tpf:contact-open',()=>{setTimeout(apply,250);setTimeout(apply,900)});
}
M.register('contact-profile-clean-v2',{install});
})();
