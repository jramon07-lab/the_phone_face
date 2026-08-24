const https = require('https');

function getText(url){
  return new Promise((resolve,reject)=>{
    https.get(url,{headers:{'User-Agent':'The-Phone-Face-UI-Wrapper'}},r=>{
      if(r.statusCode>=300 && r.statusCode<400 && r.headers.location){r.resume();return getText(r.headers.location).then(resolve,reject)}
      if(r.statusCode!==200){r.resume();return reject(new Error('HTTP '+r.statusCode))}
      let body='';r.setEncoding('utf8');r.on('data',c=>body+=c);r.on('end',()=>resolve(body));
    }).on('error',reject)
  })
}

module.exports=async function(req,res){
  try{
    const host=req.headers.host;
    const html=await getText('https://'+host+'/api/index?ui_base=1&t='+Date.now());
    const tag='<link rel="stylesheet" href="/tpf-ui-v22.css?v=22-final">';
    const out=html.includes('</head>')?html.replace('</head>',tag+'\n</head>'):tag+html;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store, max-age=0');
    res.setHeader('X-TPF-UI','v22-live');
    res.status(200).send(out);
  }catch(e){res.status(500).send('No se pudo cargar la interfaz: '+(e?.message||e))}
};
