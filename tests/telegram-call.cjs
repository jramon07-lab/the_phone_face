'use strict';
const assert=require('assert');
const handler=require('../api/telegram-call');

function run({method='GET',phone=''}){
  return new Promise(resolve=>{
    const res={statusCode:0,headers:{},body:null,setHeader(k,v){this.headers[k]=v},status(code){this.statusCode=code;return this},json(body){this.body=body;resolve(this);return this},end(){resolve(this);return this}};
    handler({method,query:{phone}},res);
  });
}
(async()=>{
  let res=await run({phone:'+34600333248'});
  assert.equal(res.statusCode,302);
  assert.equal(res.headers.Location,'tel:+34600333248');
  assert.equal(res.headers['Cache-Control'],'no-store');
  res=await run({phone:'javascript:alert(1)'});
  assert.equal(res.statusCode,400);
  res=await run({method:'POST',phone:'+34600333248'});
  assert.equal(res.statusCode,405);
  console.log('PASS Telegram call: redirección telefónica validada y sin redirección abierta.');
})().catch(error=>{console.error(error);process.exitCode=1});
