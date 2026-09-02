const assert=require('node:assert/strict');
const handler=require('../api/ocr-asset');

function response(){
  return {
    headers:{},statusCode:0,body:null,
    setHeader(name,value){this.headers[String(name).toLowerCase()]=value;},
    status(code){this.statusCode=code;return this;},
    send(body){this.body=body;return this;},
    json(body){this.body=body;return this;},
    end(body){this.body=body;return this;}
  };
}

(async()=>{
  const originalFetch=global.fetch;
  const fetched=[];
  global.fetch=async(url,options)=>{
    fetched.push({url,options});
    return {ok:true,status:200,arrayBuffer:async()=>Uint8Array.from([1,2,3]).buffer};
  };
  try{
    const ok=response();
    await handler({method:'GET',query:{asset:'worker'}},ok);
    assert.equal(ok.statusCode,200);
    assert.deepEqual([...ok.body],[1,2,3]);
    assert.match(ok.headers['content-type'],/javascript/);
    assert.match(ok.headers['cache-control'],/immutable/);
    assert.match(fetched[0].url,/tesseract\.js@5\.1\.1\/dist\/worker\.min\.js$/);

    const missing=response();
    await handler({method:'GET',query:{asset:'unknown'}},missing);
    assert.equal(missing.statusCode,404);

    const method=response();
    await handler({method:'POST',query:{asset:'worker'}},method);
    assert.equal(method.statusCode,405);
  }finally{
    global.fetch=originalFetch;
  }
  console.log('OCR asset proxy: ok');
})().catch(error=>{console.error(error);process.exitCode=1;});
