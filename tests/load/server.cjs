// Read-only, loopback-only laboratory. Never connects to a CRM database.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const core=fs.readFileSync(path.join(root,'js/modules/contacts-sales-core.js'),'utf8');
const start=core.indexOf('let salesCache='),end=core.indexOf('async function loadSales()',start);
if(start<0||end<start)throw Error('Sales renderer boundaries changed');
const routes={
 '/':['text/html',fs.readFileSync(path.join(__dirname,'fixture.html'),'utf8')],
 '/renderer.js':['text/javascript',core.slice(start,end)],
 '/sales.js':['text/javascript',fs.readFileSync(path.join(root,'js/modules/sales-fullscreen-ui.js'),'utf8')],
 '/baseline.js':['text/javascript',fs.readFileSync(path.join(__dirname,'baseline-sales.js'),'utf8')],
 '/app.css':['text/css',fs.readFileSync(path.join(root,'assets/app.css'),'utf8')]
};
http.createServer((req,res)=>{
 const entry=routes[req.url];
 res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'none'; form-action 'none'; base-uri 'none'");
 if(req.method!=='GET'||!entry){res.writeHead(403);res.end('LAB: request blocked');return}
 res.writeHead(200,{'Content-Type':entry[0]});res.end(entry[1]);
}).listen(4174,'127.0.0.1');
