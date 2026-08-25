const http = require('http');
const { URL } = require('url');
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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:3000');
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
