const https = require('https');

function getText(url){
  return new Promise((resolve,reject)=>{
    https.get(url,{headers:{'User-Agent':'The-Phone-Face-Menu-Clean'}},r=>{
      if(r.statusCode>=300 && r.statusCode<400 && r.headers.location){r.resume();return getText(r.headers.location).then(resolve,reject)}
      if(r.statusCode!==200){r.resume();return reject(new Error('HTTP '+r.statusCode))}
      let body='';r.setEncoding('utf8');r.on('data',c=>body+=c);r.on('end',()=>resolve(body));
    }).on('error',reject)
  })
}

const MENU_CLEAN = `
<style id="tpf-menu-clean-v1">
/* Ocultar del menú principal sin borrar datos ni lógica interna */
.nav[data-view="search"][data-sheet="LIQUIDACION"],
.nav[data-view="search"][data-sheet="DATA"],
.nav[data-view="search"][data-sheet="CLAWBACK"],
.nav[data-view="search"][data-sheet="AJUSTES"]{display:none!important}
</style>`;

module.exports=async function(req,res){
  try{
    const host=req.headers['x-forwarded-host']||req.headers.host;
    if(!host)throw new Error('Host no disponible');
    let html=await getText(`https://${host}/api/index-fix?_clean=${Date.now()}`);
    html=html.includes('</head>')?html.replace('</head>',MENU_CLEAN+'\n</head>'):MENU_CLEAN+html;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store, max-age=0');
    res.setHeader('X-TPF-Menu','clean-v1');
    res.status(200).send(html);
  }catch(e){res.status(500).send('No se pudo cargar The Phone Face: '+(e?.message||e))}
};
