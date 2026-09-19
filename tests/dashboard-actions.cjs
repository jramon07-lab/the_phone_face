'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/dashboard-performance-guard.js','utf8');
const css=fs.readFileSync('assets/dashboard-home.css','utf8');
assert.match(css,/#view-dashboard\.tpfDashPro:not\(\.hidden\)>\.tdCommandBar\{display:flex!important\}/,'Inicio toolbar must remain visible despite legacy WhatsApp header suppression');
const nodes=new Map(),selectors=new Map(),calls=[];
function element(id,hidden=false){
  const classes=new Set(hidden?['hidden']:[]);
  const node={id,hidden:false,textContent:'',classList:{contains:n=>classes.has(n),add:n=>classes.add(n),remove:n=>classes.delete(n)},click(){calls.push(id)}};
  nodes.set(id,node);return node;
}
const sandbox={window:{TPFModules:{register(){}}},document:{getElementById:id=>nodes.get(id)||null,querySelector:selector=>selectors.get(selector)||null},Intl,Date,Map,console,setTimeout,clearTimeout,setInterval,clearInterval};
vm.runInNewContext(source.replace("M.register('dashboard-performance-guard'","window.testActions={openNewOpportunity,openNewContact,navigate,openItem,action,runAction};M.register('dashboard-performance-guard'"),sandbox);
const actions=sandbox.window.testActions,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

(async()=>{
  element('app');element('view-dashboard');const notice=element('tdDataStatus');
  const oppModal=element('oppDetailModal',true),fullPage=element('opportunityFullPage',true);
  let salesReady=false,loads=0;
  sandbox.window.loadSales=async()=>{loads++;await sleep(160);salesReady=true};
  const newOpp=element('newOpp');
  newOpp.click=()=>{assert.equal(salesReady,true,'new opportunity must wait for the real sales cache, not a fixed 120 ms');calls.push('new-opportunity');oppModal.classList.remove('hidden')};
  await actions.openNewOpportunity();
  assert.equal(loads,1);assert.equal(oppModal.classList.contains('hidden'),false);

  salesReady=false;oppModal.classList.add('hidden');
  sandbox.window.openOpportunityCard=id=>{assert.equal(salesReady,true,'Edit needs salesCache populated on a cold Inicio');calls.push('edit:'+id);oppModal.classList.remove('hidden')};
  await actions.action('edit','opportunity','opp-1');
  assert.ok(calls.includes('edit:opp-1'));assert.equal(loads,2);

  salesReady=false;
  sandbox.window.openOpportunityFull=id=>{assert.equal(salesReady,true,'detail needs stages to display the actual status');calls.push('open:'+id);fullPage.classList.remove('hidden')};
  await actions.openItem('opportunity','opp-1');
  assert.ok(calls.includes('open:opp-1'));assert.equal(loads,3);

  const contactModal=element('tpfContactsCreateBack',true);
  selectors.set('.nav[data-view="database"]',{click(){calls.push('database');setTimeout(()=>{const button=element('tpfContactsAdd');button.click=()=>{calls.push('create-contact');setTimeout(()=>contactModal.classList.remove('hidden'),80)}},170)}});
  await actions.openNewContact();
  assert.ok(calls.includes('database')&&calls.includes('create-contact'));
  assert.equal(contactModal.classList.contains('hidden'),false,'must open creation form, not merely the contacts list');
  assert.equal((source.match(/data-home-action="new-contact"/g)||[]).length,3,'both contact CTAs share the creation action and delegated handler');

  let expired=false;
  selectors.set('.nav[data-view="alerts"]',{click(){calls.push('alerts');setTimeout(()=>selectors.set('#view-alerts .avCounter[data-kind="expired"]',{click(){expired=true}}),170)}});
  await actions.navigate('alerts-expired');
  assert.equal(expired,true,'must activate the real Avisos v2 counter, not removed legacy markup');

  let taskId='';sandbox.window.openAlertTask=async id=>{taskId=id};
  await actions.openItem('task','task-1');assert.equal(taskId,'task-1');
  await actions.runAction(async()=>{throw new Error('Acción no disponible')});
  assert.equal(notice.hidden,false);assert.equal(notice.textContent,'Acción no disponible','action failures must be visible');
  console.log('dashboard actions: cold/slow new opportunity, edit, detail, contact creation, real expired filter, task and surfaced errors passed');
})().catch(error=>{console.error(error);process.exitCode=1});
