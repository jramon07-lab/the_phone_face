'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=file=>fs.readFileSync('js/modules/'+file,'utf8');
function node(hidden=false){const classes=new Set(hidden?['hidden']:[]),attrs={};return {dataset:{},value:'',inert:false,isConnected:true,classList:{contains:x=>classes.has(x),add:x=>classes.add(x),remove:x=>classes.delete(x)},getAttribute:key=>attrs[key]??null,setAttribute:(key,value)=>{attrs[key]=String(value)},removeAttribute:key=>{delete attrs[key]},contains:()=>true,focus(){this.focused=true;}};}
(async()=>{
 const nodes={oppDetailModal:node(),oppModalId:node(),contactModal:node(true),contactClose:node()},listeners=[],observers=[];
 nodes.oppModalId.value='opportunity';const draft='No perder este borrador';nodes.oppDetailModal.draft=draft;
 const window={__TPF_HISTORY:['sales'],dispatchEvent(){},TPFModules:{register(name,module){module.install()},report(name,error){throw error;}}};
 const context={window,document:{getElementById:id=>nodes[id]||null,addEventListener:(name,handler,capture)=>listeners.push({name,handler,capture})},currentContact:null,performance,setTimeout,MutationObserver:class{constructor(fn){observers.push(fn)}observe(){}},CustomEvent:class{}};
 window.openContact=id=>{window.__TPF_HISTORY.push('opportunity');context.currentContact={id};nodes.contactModal.classList.remove('hidden');return new Promise(()=>{});};
 vm.runInNewContext(source('contact-open-nonblocking.js'),context);
 assert.equal(await window.openContact('holder'),true,'Visible contact must not wait for background rendering');
 assert.equal(nodes.oppDetailModal.getAttribute('data-tpf-suspended'),'contact');assert.equal(nodes.oppDetailModal.inert,true);assert.equal(nodes.contactModal.classList.contains('tpfOpportunityContactFront'),true);
 let stopped=false;listeners.find(x=>x.name==='click').handler({target:{closest:()=>nodes.contactClose},preventDefault(){},stopImmediatePropagation(){stopped=true;}});
 assert.equal(stopped,true);assert.equal(nodes.contactModal.classList.contains('hidden'),true);assert.equal(nodes.oppDetailModal.classList.contains('hidden'),false);assert.equal(nodes.oppDetailModal.draft,draft);assert.equal(nodes.oppDetailModal.inert,false);assert.equal(window.__TPF_HISTORY.length,1);
 // Opening the same mounted contact is a valid result, not a timeout.
 nodes.oppDetailModal.classList.add('hidden');nodes.contactModal.classList.remove('hidden');window.__TPF_HISTORY=[];
 assert.equal(await window.openContact('holder'),true);assert.equal(nodes.oppDetailModal.getAttribute('data-tpf-suspended'),null);
 // The shared contact editor must preserve the opportunity and enforce the exact contact ID.
 nodes.oppDetailModal.classList.remove('hidden');nodes.tpfContactsCreateBack=node(true);nodes.tpfCreateFirst=node();nodes.tpfContactsCreateCancel={click(){nodes.tpfContactsCreateBack.classList.add('hidden');}};
 window.TPFContactRelations={opportunityContacts:()=>({contacts:[{id:'holder'}]})};let opened=0;
 window.TPFContactsList={async edit(id){opened++;nodes.tpfContactsCreateBack.dataset.editId=id;nodes.tpfContactsCreateBack.classList.remove('hidden');}};
 context.MutationObserver=class{constructor(fn){observers.push(fn)}observe(){}disconnect(){}};
 vm.runInNewContext(source('opportunity-contact-context.js'),context);const C=window.TPFOpportunityContext;
 await assert.rejects(()=>C.editContact('unrelated'),/identificar/);assert.equal(opened,0);
 await C.editContact('holder');assert.equal(opened,1);assert.equal(nodes.tpfCreateFirst.focused,true);assert.equal(nodes.oppDetailModal.inert,true);assert.equal(nodes.oppDetailModal.draft,draft);
 nodes.tpfContactsCreateBack.classList.add('hidden');observers.at(-1)();assert.equal(nodes.oppDetailModal.inert,false);assert.equal(nodes.oppDetailModal.draft,draft);
 window.TPFContactsList.edit=async id=>{nodes.tpfContactsCreateBack.dataset.editId=id;nodes.tpfContactsCreateBack.classList.remove('hidden');nodes.oppModalId.value='other';};
 await C.editContact('holder');assert.equal(nodes.tpfContactsCreateBack.classList.contains('hidden'),true,'A late edit response must not open over another opportunity');
 console.log('PASS: foreground contact navigation, return with draft, background render isolation, same contact, exact contact editor and stale response cancellation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
