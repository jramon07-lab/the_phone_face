const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const finalFix = require('../api/final-fix');

function adaptResponse(res) {
  let statusCode = 200;
  return {
    setHeader(name, value) { res.setHeader(name, value); },
    status(code) { statusCode = code; return this; },
    send(body) {
      res.statusCode = statusCode;
      res.end(body == null ? '' : String(body));
    },
    json(value) {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(value));
    }
  };
}

function serveStaticAsset(pathname,res){
  const roots=[
    {prefix:'/js/',dir:path.join(__dirname,'..','js'),type:'application/javascript; charset=utf-8'},
    {prefix:'/assets/',dir:path.join(__dirname,'..','assets'),type:'text/css; charset=utf-8'}
  ];
  const root=roots.find(x=>pathname.startsWith(x.prefix));
  if(!root)return false;

  const relative=decodeURIComponent(pathname.slice(root.prefix.length));
  if(!relative || relative.includes('..') || relative.startsWith('/') || relative.includes('\\')){
    res.statusCode=404;res.end('Not found');return true;
  }
  const file=path.resolve(root.dir,relative);
  const base=path.resolve(root.dir)+path.sep;
  if(!file.startsWith(base) || !fs.existsSync(file) || !fs.statSync(file).isFile()){
    res.statusCode=404;res.end('Not found');return true;
  }
  res.statusCode=200;
  res.setHeader('Content-Type',root.type);
  res.setHeader('Cache-Control','no-store');
  res.end(fs.readFileSync(file,'utf8'));
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:3000');
    if (serveStaticAsset(url.pathname,res)) return;
    if (url.pathname === '/' || url.pathname === '/index.html') {
      req.headers.host = req.headers.host || '127.0.0.1:3000';
      await finalFix(req, adaptResponse(res));
      return;
    }
    if (url.pathname === '/healthz') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: true, source: 'local-branch-preview' }));
      return;
    }
    res.statusCode = 404;
    res.end('Not found');
  } catch (error) {
    res.statusCode = 500;
    res.end('Local preview error: ' + (error?.stack || error));
  }
});

server.listen(3000, '0.0.0.0', () => {
  console.log('TPF local branch preview listening on http://0.0.0.0:3000');
});
