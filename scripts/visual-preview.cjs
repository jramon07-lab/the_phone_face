/* Local-only visual sandbox: production HTML/CSS, synthetic data, no production JS/API. */
const fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'..');
const render=require('../api/final-fix');
async function html(){return new Promise((resolve,reject)=>{const res={setHeader(){},status(){return this},send(value){resolve(String(value))},json(value){reject(new Error(JSON.stringify(value)))}};Promise.resolve(render({headers:{host:'localhost:3100'},url:'/'},res)).catch(reject)})}
http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost:3100');
 if(u.pathname==='/'){
 let out=await html();out=out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 out=out.replace('</head>','<link rel="stylesheet" href="/tests/fixtures/pro-preview/preview.css"></head>');
 out=out.replace('</body>','<script src="/tests/fixtures/pro-preview/preview.js"></script><script src="/js/modules/contact-desktop-layout.js"></script><script src="/js/modules/contact-workspace-pro.js"></script><script src="/js/modules/dashboard-performance-guard.js"></script><script src="/tests/fixtures/pro-preview/finish.js"></script></body>');
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; form-action 'none'");res.end(out);return;
 }
 if(!/^\/(assets|js|tests\/fixtures\/pro-preview)\//.test(u.pathname)){res.statusCode=404;res.end('Offline preview');return;}
 const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+'/'))throw Error('Invalid path');
 res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(fs.readFileSync(file));
}catch(e){res.statusCode=500;res.end(e.message)}}).listen(3100,'0.0.0.0',()=>console.log('Preview on http://localhost:3100'));
