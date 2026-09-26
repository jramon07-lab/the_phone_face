const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const source=fs.readFileSync('api/green.js','utf8');
const start=source.indexOf('async function greenTimedFetch(');
const end=source.indexOf('\n  async function greenFetchUrl',start);
async function scenario(stallBody){
  let expire,cleared=false,signal;
  const context={AbortController,
    setTimeout(fn,ms){assert.equal(ms,12000);expire=fn;return 1},
    clearTimeout(){cleared=true},
    fetch:async(_url,opts)=>{signal=opts.signal;return {
      ok:true,status:200,
      text:()=>stallBody?new Promise((resolve,reject)=>{
        signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});
      }):Promise.resolve('{"stateInstance":"authorized"}')
    }}
  };
  vm.createContext(context);vm.runInContext(source.slice(start,end)+';this.read=greenTimedFetch;',context);
  const pending=context.read('https://provider.invalid/read');
  await new Promise(setImmediate);
  if(stallBody){
    assert.equal(cleared,false,'deadline must remain active after headers, while reading body');
    expire();await assert.rejects(pending,{name:'AbortError'});
    assert.equal(signal.aborted,true);
  }else{
    const result=await pending;
    assert.equal(result.response.status,200);
    assert.equal(JSON.parse(result.text).stateInstance,'authorized');
    assert.equal(signal.aborted,false);
  }
  assert.equal(cleared,true,'timer released for both success and failure');
}
(async()=>{await scenario(true);await scenario(false);console.log('PASS: provider response deadline covers stalled body and normal JSON');})().catch(e=>{console.error(e);process.exitCode=1});
