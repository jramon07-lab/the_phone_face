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
  const css=`<style id="tpf-final-fix-v3">
.referenceTopbar{display:flex!important;min-height:64px!important;height:64px!important;align-items:center!important;justify-content:space-between!important;position:relative!important;z-index:80!important;background:#fff!important;overflow:visible!important}
.referenceTopUser{display:flex!important;align-items:center!important;flex:0 0 auto!important;visibility:visible!important;opacity:1!important}
#logout{display:inline-flex!important;visibility:visible!important;opacity:1!important;align-items:center!important;justify-content:center!important;white-space:nowrap!important;position:fixed!important;top:12px!important;right:12px!important;z-index:99999!important;background:#f5f6f8!important;color:#425067!important}
@media(max-width:760px){.referenceTopbar{display:flex!important;padding-left:8px!important;padding-right:8px!important;gap:8px!important}.globalSearchWrap{width:calc(100% - 86px)!important;min-width:0!important}.referenceTopUser{display:flex!important}.referenceTopUser #who{display:none!important}#logout{display:inline-flex!important}}
</style>`;
  html=html.replace(/<style id="tpf-final-fix-v[12]">[\s\S]*?<\/style>/g,'');
  if(!html.includes('id="tpf-final-fix-v3"')) html=html.includes('</head>')?html.replace('</head>',css+'\n</head>'):css+html;

  const logoutScript=`<script id="tpf-logout-rescue-v1">(function(){function rescue(){var b=document.getElementById('logout');if(!b)return;if(b.parentElement!==document.body)document.body.appendChild(b);b.style.setProperty('display','inline-flex','important');b.style.setProperty('visibility','visible','important');b.style.setProperty('opacity','1','important');b.style.setProperty('position','fixed','important');b.style.setProperty('top','12px','important');b.style.setProperty('right','12px','important');b.style.setProperty('z-index','99999','important');}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',rescue);else rescue();setTimeout(rescue,100);setTimeout(rescue,1000);})();</script>`;
  if(!html.includes('id="tpf-logout-rescue-v1"')) html=html.includes('</body>')?html.replace('</body>',logoutScript+'\n</body>'):html+logoutScript;
  return html;
}

module.exports=async function(req,res){
  try{
    const captured=await new Promise((resolve,reject)=>clean(req,captureResponse(resolve,reject)).catch(reject));
    Object.entries(captured.headers).forEach(([k,v])=>res.setHeader(k,v));
    res.setHeader('X-TPF-Final-Fix','late-modals-before-bindings+logout-rescue-v4');
    res.status(captured.statusCode).send(applyFinalFix(captured.body));
  }catch(e){res.status(500).send('No se pudo cargar The Phone Face: '+(e?.message||e));}
};

module.exports.applyFinalFix=applyFinalFix;
module.exports.relocateLateModals=relocateLateModals;
