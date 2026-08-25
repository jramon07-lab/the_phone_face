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

function applyFinalFix(html){
  html=html.replace('$("cpNewOpp").onclick=$("cpSideNewOpp").onclick=openContactNewOpportunity;','if($("cpNewOpp"))$("cpNewOpp").onclick=openContactNewOpportunity;if($("cpSideNewOpp"))$("cpSideNewOpp").onclick=openContactNewOpportunity;');
  html=html.replace('$("cpNewTask").onclick=$("cpSideNewTask").onclick=openContactTaskPage;','if($("cpNewTask"))$("cpNewTask").onclick=openContactTaskPage;if($("cpSideNewTask"))$("cpSideNewTask").onclick=openContactTaskPage;');
  const css=`<style id="tpf-final-fix-v1">.referenceTopUser{display:flex!important;align-items:center!important;flex:0 0 auto!important}#logout{display:inline-flex!important;visibility:visible!important;opacity:1!important;align-items:center!important;justify-content:center!important;white-space:nowrap!important}@media(max-width:760px){.referenceTopbar{padding-left:8px!important;padding-right:8px!important;gap:8px!important}.globalSearchWrap{width:calc(100% - 86px)!important;min-width:0!important}.referenceTopUser{display:flex!important}.referenceTopUser #who{display:none!important}#logout{display:inline-flex!important}}</style>`;
  if(!html.includes('id="tpf-final-fix-v1"')) html=html.includes('</head>')?html.replace('</head>',css+'\n</head>'):css+html;
  return html;
}

module.exports=async function(req,res){
  try{
    const captured=await new Promise((resolve,reject)=>clean(req,captureResponse(resolve,reject)).catch(reject));
    Object.entries(captured.headers).forEach(([k,v])=>res.setHeader(k,v));
    res.setHeader('X-TPF-Final-Fix','onclick-null+logout-visible-v1');
    res.status(captured.statusCode).send(applyFinalFix(captured.body));
  }catch(e){res.status(500).send('No se pudo cargar The Phone Face: '+(e?.message||e));}
};

module.exports.applyFinalFix=applyFinalFix;
