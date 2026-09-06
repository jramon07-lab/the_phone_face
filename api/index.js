const https = require('https');
const fs = require('fs');
const path = require('path');

const RAW_BASE = 'https://raw.githubusercontent.com/jramon07-lab/the_phone_face';


function rawIndexUrl(){
  const sha=String(process.env.VERCEL_GIT_COMMIT_SHA||'').trim();
  if(!/^[a-f0-9]{40}$/i.test(sha))return null;
  return `${RAW_BASE}/${sha}/index.html`;
}

function getText(url){
  return new Promise((resolve,reject)=>{
    https.get(url,{headers:{'User-Agent':'The-Phone-Face-Vercel'}},r=>{
      if(r.statusCode>=300 && r.statusCode<400 && r.headers.location){
        r.resume(); return getText(r.headers.location).then(resolve,reject);
      }
      if(r.statusCode!==200){r.resume(); return reject(new Error('HTTP '+r.statusCode));}
      let body=''; r.setEncoding('utf8');
      r.on('data',c=>body+=c); r.on('end',()=>resolve(body));
    }).on('error',reject);
  });
}

const PATCH = '';

async function buildHtml(){
  let html='';
  try{
    html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  }catch(_){
    const url=rawIndexUrl();if(!url)throw Error('No está disponible el índice de este despliegue.');
    html=await getText(url);
  }
  return html.includes('</body>')?html.replace('</body>',PATCH+'\n</body>'):html+PATCH;
}

async function handler(req,res){
  try{
    const out=await buildHtml();
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store, max-age=0');
    res.setHeader('X-TPF-Patch','agenda-v4-labels-fix');
    res.status(200).send(out);
  }catch(e){res.status(500).send('No se pudo cargar The Phone Face: '+(e?.message||e))}
}

handler.buildHtml=buildHtml;
handler.PATCH=PATCH;
handler.RAW_INDEX=rawIndexUrl();
module.exports=handler;
