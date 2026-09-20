'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const callbacks={},nodes={};let copied='',fallback=0;
function element(text=''){return {textContent:text,isConnected:true,dataset:{},style:{},classList:{add(){}},setAttribute(){},matches:()=>false,closest:()=>null,append(){},querySelectorAll:()=>[],cloneNode(){return element(this.textContent)},focus(){},select(){},remove(){}};}
const document={body:{append(node){if(node.id)nodes[node.id]=node}},getElementById:id=>nodes[id],querySelectorAll:()=>[],createElement:()=>element(),addEventListener(){},execCommand(){fallback++;return false;}};
const context={window:{addEventListener:(name,handler)=>{callbacks[name]=handler}},document,navigator:{clipboard:{async writeText(value){copied=value}}},MutationObserver:class{observe(){}},setTimeout(){},clearTimeout(){}};
const source=fs.readFileSync('js/modules/copyable-data.js','utf8').replace('window.TPFCopyData={valueOf,empty,copy,notify}','window.TPFCopyData={valueOf,empty,copy,notify,attach}');
vm.runInNewContext(source,context);const C=context.window.TPFCopyData;
(async()=>{
 assert.equal(C.empty('—'),true);assert.equal(C.empty('Sin teléfono'),true);assert.equal(C.empty('00000000T'),false);
 assert.equal(C.valueOf({value:' 600000001 '}),'600000001');assert.equal(C.valueOf(element('DNI: 00000000T')),'00000000T');
 let button;const field=element('600000001');field.append=node=>{button=node};C.attach(field,'teléfono');assert(button);
 field.textContent='600000002';let stopped=false,prevented=false;
 await callbacks.click({target:{closest:()=>button},preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}});
 assert.equal(copied,'600000002','Copy reads the current value, not the old rendered value');assert(stopped&&prevented,'Copy must not also open a row or submit its form');assert.equal(button.dataset.copied,'true');assert.equal(nodes.tpfCopyStatus.textContent,'Texto copiado');C.notify(false);assert.equal(nodes.tpfCopyStatus.textContent,'No se pudo copiar');
 copied='';assert.equal(await C.copy('—'),false);assert.equal(copied,'');
 context.navigator.clipboard.writeText=async()=>{throw Error('Clipboard denied')};assert.equal(await C.copy('600000001'),false);assert.equal(fallback,1,'Clipboard rejection must use the fallback without claiming success');
 const secret={type:'password',closest(){throw Error('Password must be excluded')}};C.attach(secret,'clave');
 console.log('PASS: exact current copy value, empty placeholders, copy-only click, clipboard fallback and password exclusion.');
})().catch(error=>{console.error(error);process.exitCode=1;});
