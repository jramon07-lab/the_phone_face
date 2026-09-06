const clean = require('./index-clean');

function captureResponse(resolve,reject){
  let statusCode=200;
  const headers={};
  return {
    setHeader(name,value){headers[name]=value;},
    status(code){statusCode=code;return this;},
    send(body){resolve({statusCode,headers,body:String(body??'')});},
    json(value){resolve({statusCode,headers,body:JSON.stringify(value)});}
  };
}

function relocateLateModals(html){
  const blockStart=html.indexOf('<div id="contactLabelsModal"');
  const blockEnd=blockStart>=0?html.indexOf('<script id="tpf-v13-final-bindings">',blockStart):-1;
  const bindPos=html.indexOf('$("contactManageLabels").onclick');
  if(blockStart<0||blockEnd<0||bindPos<0||blockStart<bindPos)return html;
  const scriptStart=html.lastIndexOf('<script',bindPos);
  if(scriptStart<0)return html;
  const modalBlock=html.slice(blockStart,blockEnd);
  html=html.slice(0,blockStart)+html.slice(blockEnd);
  return html.slice(0,scriptStart)+modalBlock+html.slice(scriptStart);
}

function applyFinalFix(html){
  html=relocateLateModals(html);
  html=html.replace('$("exportSearchExcel").onclick=exportUnifiedSearchToExcel;','if($("exportSearchExcel"))$("exportSearchExcel").onclick=exportUnifiedSearchToExcel;');
  html=html.replace('$("cpNewOpp").onclick=$("cpSideNewOpp").onclick=openContactNewOpportunity;','if($("cpNewOpp"))$("cpNewOpp").onclick=openContactNewOpportunity;if($("cpSideNewOpp"))$("cpSideNewOpp").onclick=openContactNewOpportunity;');
  html=html.replace('$("cpNewTask").onclick=$("cpSideNewTask").onclick=openContactTaskPage;','if($("cpNewTask"))$("cpNewTask").onclick=openContactTaskPage;if($("cpSideNewTask"))$("cpSideNewTask").onclick=openContactTaskPage;');
  const css=`<style id="tpf-final-fix-v5">
.referenceTopbar{display:flex!important;min-height:64px!important;height:64px!important;align-items:center!important;justify-content:space-between!important;position:relative!important;z-index:80!important;background:#fff!important;overflow:visible!important}
.referenceTopUser{display:flex!important;align-items:center!important;flex:0 0 auto!important;visibility:visible!important;opacity:1!important}
#logout{display:inline-flex!important;visibility:visible!important;opacity:1!important;align-items:center!important;justify-content:center!important;white-space:nowrap!important;position:static!important;z-index:auto!important}
.referenceUser #logout{margin-left:auto!important;padding:6px 9px!important;min-width:auto!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:7px!important;background:rgba(255,255,255,.08)!important;color:#fff!important;font-size:11px!important;line-height:1!important;flex:0 0 auto!important}
.referenceUser:has(#logout) .referenceOnline{display:none!important}
@media(max-width:760px){.referenceTopbar{display:flex!important;padding-left:8px!important;padding-right:8px!important;gap:8px!important}.globalSearchWrap{width:100%!important;min-width:0!important}.referenceTopUser{display:none!important}}
</style>`;
  html=html.replace(/<style id="tpf-final-fix-v[1-4]">[\s\S]*?<\/style>/g,'');
  if(!html.includes('id="tpf-final-fix-v5"')) html=html.includes('</head>')?html.replace('</head>',css+'\n</head>'):css+html;

  const authGuard='<script src="/js/modules/automations-auth-guard.js"></script>';
  if(!html.includes('/js/modules/automations-auth-guard.js')) html=html.includes('</body>')?html.replace('</body>',authGuard+'\n</body>'):html+authGuard;
  const autoUi='<script src="/js/modules/automations-ui-polish.js"></script>';
  if(!html.includes('/js/modules/automations-ui-polish.js')) html=html.includes('</body>')?html.replace('</body>',autoUi+'\n</body>'):html+autoUi;
  const autoFlow='<script src="/js/modules/automations-flow-builder.js"></script>';
  if(!html.includes('/js/modules/automations-flow-builder.js')&&!html.includes('/js/modules/runtime.js')) html=html.includes('</body>')?html.replace('</body>',autoFlow+'\n</body>'):html+autoFlow;
  const autoSource='<script src="/js/modules/automations-contact-source-ui.js"></script>';
  if(!html.includes('/js/modules/automations-contact-source-ui.js')) html=html.includes('</body>')?html.replace('</body>',autoSource+'\n</body>'):html+autoSource;
  const contactProfile='<script src="/js/modules/contact-profile.js"></script>';
  if(!html.includes('/js/modules/contact-profile.js')) html=html.includes('</body>')?html.replace('</body>',contactProfile+'\n</body>'):html+contactProfile;
  const waReadGuard='<script src="/js/modules/whatsapp-read-guard.js"></script>';
  if(!html.includes('/js/modules/whatsapp-read-guard.js')) html=html.includes('</body>')?html.replace('</body>',waReadGuard+'\n</body>'):html+waReadGuard;

  const logoutScript=`<script id="tpf-logout-rescue-v4">(function(){var queued=false;function sync(){queued=false;var b=document.getElementById('logout'),side=document.querySelector('.referenceUser');if(!b||!side)return;if(b.parentElement!==side)side.appendChild(b);b.style.setProperty('display','inline-flex','important');b.style.setProperty('visibility','visible','important');b.style.setProperty('opacity','1','important');b.style.setProperty('position','static','important');b.style.removeProperty('top');b.style.removeProperty('right');b.style.removeProperty('z-index');}function queue(){if(queued)return;queued=true;requestAnimationFrame(sync);}function start(){queue();document.querySelectorAll('.nav').forEach(function(n){n.addEventListener('click',function(){queue();setTimeout(queue,120);});});window.addEventListener('resize',queue,{passive:true});document.addEventListener('visibilitychange',function(){if(!document.hidden)queue();});setTimeout(queue,300);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})();</script>`;
  html=html.replace(/<script id="tpf-logout-rescue-v[1-3]">[\s\S]*?<\/script>/g,'');
  if(!html.includes('id="tpf-logout-rescue-v4"')) html=html.includes('</body>')?html.replace('</body>',logoutScript+'\n</body>'):html+logoutScript;
  return html;
}

module.exports=async function(req,res){
  try{
    const captured=await new Promise((resolve,reject)=>clean(req,captureResponse(resolve,reject)).catch(reject));
    Object.entries(captured.headers).forEach(([k,v])=>res.setHeader(k,v));
    res.setHeader('X-TPF-Final-Fix','late-modals+logout-event-driven+contact-profile-v12+whatsapp-read-safe');
    res.status(captured.statusCode).send(applyFinalFix(captured.body));
  }catch(e){res.status(500).send('No se pudo cargar The Phone Face: '+(e?.message||e));}
};

module.exports.applyFinalFix=applyFinalFix;
module.exports.relocateLateModals=relocateLateModals;
