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

function serveModuleAsset(pathname,res){
  const prefix='/js/modules/';
  if(!pathname.startsWith(prefix)) return false;
  const relative=pathname.slice(prefix.length);
  if(!relative || relative.includes('..') || relative.includes('/') || !relative.endsWith('.js')){
    res.statusCode=404;
    res.end('Not found');
    return true;
  }
  const file=path.join(__dirname,'..','js','modules',relative);
  if(!fs.existsSync(file)){
    res.statusCode=404;
    res.end('Not found');
    return true;
  }
  res.statusCode=200;
  res.setHeader('Content-Type','application/javascript; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(fs.readFileSync(file,'utf8'));
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:3000');
    if (serveModuleAsset(url.pathname,res)) return;
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
