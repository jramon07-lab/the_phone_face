'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/contact-profile.js','utf8');
const nodes=new Map();for(const id of ['tpfContactsCreateSave','tpfContactsCreateMsg','tpfCreateFirst','tpfCreateLast','tpfCreateNickname','tpfCreatePhone','tpfCreateEmail','tpfCreateDni','tpfCreateBank','tpfCreateNotes','tpfCreateObs','tpfCreateLabels'])nodes.set(id,{value:'',textContent:'',querySelectorAll:()=>[]});
nodes.get('tpfCreateFirst').value='Control';
let reopened=false,restored=false,releaseList,saved,fail=false;
const ctx={createEditState:{id:'test'},byId:id=>nodes.get(id),CustomEvent:class{},
 restoreCreateModal:()=>{restored=true},window:{TPFContactParty:{read:()=>({same:true})},TPFContactEditor:{readText:()=>({NOTAS:'',OBSERVACIONES:''})},
 tpfReloadContacts:()=>new Promise(r=>releaseList=r),openContact:async id=>{assert.equal(id,'test');reopened=true},dispatchEvent(){}},
 sb:{from(){return{select(){return this},update(row){saved=row;return this},eq(){return this},maybeSingle:async()=>({data:{data:{APODO:'Anterior',KEEP:'preservado',NOTAS:'vieja',OBSERVACIONES:'vieja'}}}),then(resolve){return Promise.resolve({error:fail?{message:'Guardado rechazado'}:null}).then(resolve)}}},rpc:async()=>({})}};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('  async function saveCreateModalEdit(){'),source.indexOf('  async function openCreateModalEdit(){')),ctx);
(async()=>{
 await ctx.saveCreateModalEdit();assert(reopened);assert(restored);assert(releaseList,'List refresh should be started without blocking');
 assert.equal(saved.data.NOTAS,'');assert.equal(saved.data.OBSERVACIONES,'');assert.equal(saved.data.KEEP,'preservado');releaseList();
 reopened=restored=false;fail=true;await ctx.saveCreateModalEdit();assert(!reopened&&!restored);assert.equal(nodes.get('tpfContactsCreateMsg').textContent,'Guardado rechazado');assert.equal(nodes.get('tpfContactsCreateSave').disabled,false);
 console.log('PASS saved contact reopens without waiting for full list; empty notes, preservation and failed save remain correct');
})().catch(e=>{console.error(e);process.exitCode=1});
