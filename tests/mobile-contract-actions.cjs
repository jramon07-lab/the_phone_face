const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/mobile-app.js'),'utf8');
const begin=source.indexOf('  function mobileWaContractStage(');
const end=source.indexOf('  async function loadMobileWaUpcoming(',begin);
assert.ok(begin>=0&&end>begin);
const state={board:{stages:[
  {id:'follow',name:'Seguimiento'},{id:'pending',name:'Pendiente de tramitar'},
  {id:'processed',name:'Tramitado'},{id:'won',name:'Ganado'},
  {id:'lost',name:'Perdido'},{id:'review',name:'Próximo'}
]}};
let rows=[],canEdit=true;
const context={
 state,
 foldText:value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase(),
 opportunityIsClosed:o=>['won','lost','closed','completed','cancelled'].includes(o?.status),
 mobileWaChatOpportunities:()=>rows,
 has:()=>canEdit,
 esc:value=>String(value??'').replace(/[&<>"']/g,''),
 mobileWaChatName:()=> 'Gestor',mobileWaSelectedChat:()=>({}),
 mobileLinkedNavigation:()=> ''
};
vm.createContext(context);
vm.runInContext(source.slice(begin,end)+'\nthis.api={mobileWaCanAcceptContract,renderMobileWaContractContext};',context);
const opp=(id,stage,status='open')=>({id,stage_id:stage,status,client_name:'Titular '+id});
for(const stage of ['follow','pending'])assert.equal(context.api.mobileWaCanAcceptContract(opp(stage,stage)),true);
for(const stage of ['processed','won','lost','review','missing'])assert.equal(context.api.mobileWaCanAcceptContract(opp(stage,stage)),false);
assert.equal(context.api.mobileWaCanAcceptContract(opp('closed','follow','won')),false);
rows=[opp('processed','processed')];
let html=context.api.renderMobileWaContractContext('phone');
assert.ok(!html.includes('Aceptar oferta / tramitar'));
assert.ok(html.includes('Gestionar contrato · Tramitado'));
assert.ok(html.includes('data-route="opportunity/processed"'));
rows=[opp('won','won')];
assert.ok(!context.api.renderMobileWaContractContext('phone').includes('Aceptar oferta / tramitar'));
rows=[opp('processed','processed'),opp('pending','follow')];
html=context.api.renderMobileWaContractContext('phone');
assert.ok(html.includes('data-action="mobile-accept-chat"'));
assert.ok(html.includes('data-action="mobile-accept-contract" data-id="pending"'));
assert.ok(!html.includes('data-action="mobile-accept-contract" data-id="processed"'));
rows=[opp('a','processed'),opp('b','won')];
html=context.api.renderMobileWaContractContext('phone');
assert.ok(html.includes('Gestionar contratos'));
assert.ok(!html.includes('Aceptar oferta / tramitar'));
rows=[opp('pending','follow')];canEdit=false;
assert.ok(!context.api.renderMobileWaContractContext('phone').includes('Aceptar oferta / tramitar'));
assert.equal(context.api.renderMobileWaContractContext('group@g.us'),'');
assert.ok(source.includes("client.from('sales_opportunities').select('id,status,stage_id').in('id',ids)"),'Dialog checks current opportunity state before offering acceptance');
assert.ok(source.includes('.filter(mobileWaCanAcceptContract).map(o=>o.id)'),'Chat acceptance only passes pending contracts');
console.log('PASS mobile contract actions by stage, mixed contracts, permissions and current-state guard');
