const https = require('https');

function getText(url){
  return new Promise((resolve,reject)=>{
    https.get(url,{headers:{'User-Agent':'The-Phone-Face-Stable-Recovery'}},r=>{
      if(r.statusCode>=300 && r.statusCode<400 && r.headers.location){r.resume();return getText(r.headers.location).then(resolve,reject)}
      if(r.statusCode!==200){r.resume();return reject(new Error('HTTP '+r.statusCode))}
      let body='';r.setEncoding('utf8');r.on('data',c=>body+=c);r.on('end',()=>resolve(body));
    }).on('error',reject)
  })
}

const EARLY = `<script id="tpf-stable-early-v2">\nvar crmAutomations=[];\ntry{if(localStorage.getItem('tpf_sidebar_recovery_v2')!=='1'){localStorage.setItem('tpf_sidebar_collapsed','0');localStorage.setItem('tpf_sidebar_recovery_v2','1')}}catch(e){}\n</script>`;

module.exports=async function(req,res){
  try{
    const host=req.headers.host;
    let html=await getText('https://'+host+'/api/index?stable_base=1&t='+Date.now());

    // Evita el TDZ de crmAutomations: la segunda loadAutomations() puede ejecutarse
    // durante el arranque antes de llegar a la declaración original con let.
    html=html.replace('let crmAutomations=[];','crmAutomations=crmAutomations||[];');

    // Inicializa la variable y recupera una sola vez la barra lateral ANTES de que
    // se ejecute cualquier script de la aplicación.
    html=html.includes('<head>')?html.replace('<head>','<head>\n'+EARLY):EARLY+html;

    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store, max-age=0');
    res.setHeader('X-TPF-Recovery','stable-v2');
    res.status(200).send(html);
  }catch(e){res.status(500).send('No se pudo cargar The Phone Face: '+(e?.message||e))}
};
