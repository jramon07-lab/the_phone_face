const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

async function run(){
  let releaseSales,opened=false,renders=0;
  const salesPromise=new Promise(resolve=>{releaseSales=resolve});
  const window={
    TPFModules:{register(_name,definition){definition.install()}},
    openContact(id){opened=true;context.currentContact={id};return Promise.resolve(id)},
    addEventListener(){},
    dispatchEvent(){},
    __tpfContactAutomationConsistency:false
  };
  const context=vm.createContext({
    window,console,
    currentContact:null,
    document:{getElementById(){return null},addEventListener(){},hidden:false},
    setTimeout,clearTimeout,setInterval(){return 1},clearInterval(){},
    loadSales(){return salesPromise},
    renderContactProfile(){renders++;return Promise.resolve()},
    sb:{channel(){return{on(){return this},subscribe(){return this}}}}
  });
  vm.runInContext(fs.readFileSync('js/modules/contact-automation-consistency.js','utf8'),context);
  const result=window.openContact('contact-1');
  assert.equal(opened,true,'La ficha esperó innecesariamente a cargar las oportunidades');
  releaseSales();
  assert.equal(await result,'contact-1');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(renders,1,'Las oportunidades nuevas no refrescaron la ficha ya abierta');
  console.log('PASS: la ficha abre sin bloquearse y actualiza oportunidades en segundo plano');
}
run().catch(error=>{console.error(error);process.exitCode=1});
