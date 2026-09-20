'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
const code=source.slice(source.indexOf('async function crmChangeSingleContactLabel('),source.indexOf('function crmShowLabelUndo('));
(async()=>{
 let labels=['a','b'],calls=[],fail=false;
 const ctx={crmGetContactLabels:async id=>{assert.equal(id,'original-contact');return labels.map(id=>({id}));},sb:{rpc:async(name,args)=>{assert.equal(name,'crm_set_contact_labels');calls.push(JSON.parse(JSON.stringify(args)));if(fail)return{error:new Error('denied')};labels=Array.from(args.p_label_ids);return{error:null};}}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 await ctx.crmChangeSingleContactLabel('original-contact','a',false);assert.deepEqual(labels,['b']);
 labels.push('new');await ctx.crmChangeSingleContactLabel('original-contact','a',true);assert.deepEqual(labels,['b','new','a']);
 await ctx.crmChangeSingleContactLabel('original-contact','a',true);assert.equal(calls.length,2);
 await ctx.crmChangeSingleContactLabel('original-contact','missing',false);assert.equal(calls.length,2);
 fail=true;await assert.rejects(ctx.crmChangeSingleContactLabel('original-contact','b',false),/denied/);assert.deepEqual(labels,['b','new','a']);
 assert(calls.every(c=>c.p_contact_id==='original-contact'));
 console.log('PASS: remove one label, undo preserves newer assignments, no-op, captured contact and RPC failure. Mocked data only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
