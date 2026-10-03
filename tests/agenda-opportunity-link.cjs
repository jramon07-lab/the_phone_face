const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/agenda-core.js','utf8');
const handler=source.slice(source.indexOf('$("agendaSave").onclick=async()=>{'),source.indexOf('window.completeAgenda='));
async function run(context,editing,fail=false){
 const fields={agendaSave:{disabled:false},agendaMsg:{},agendaTitle:{value:'Seguimiento'},agendaDescription:{value:'Revisar instalación'},agendaCustomer:{value:'Titular',dataset:{contactId:'contact'}},agendaPhone:{value:'600000000'},agendaStarts:{value:'2026-10-06T10:00'},agendaReminder:{value:''},agendaEditStatus:{value:'pending'}};let saved,options;
 const scope={agendaComposerContext:context,agendaEditingRow:editing,agendaSelectedType:'Tarea',perms:{can_manage_agenda:true},$:(id)=>fields[id],sb:{auth:{getUser:async()=>({data:{user:{id:'staff'}}})}},agendaCreateMeta:()=>({notes:'Observación'}),selectedAgendaReminderMinutes:()=>[0],agendaTypeKey:()=> 'tarea',tpfSetSaving(){},tpfResetSaving(){},tpfShowSaveError(){},resetAgendaComposer(){},setAgendaComposer(){},console,window:{TPFRefreshTasks:async()=>{},TPFTaskModel:{save:async(_sb,row,opts)=>{saved=row;options=opts;if(fail)throw Error('Conflicto');return{...row,id:opts.id||'new-task'}}}}};
 vm.runInNewContext(handler,scope);await fields.agendaSave.onclick();return{saved,options,scope};
}
(async()=>{
 let callback;const fresh=await run({opportunityId:'op-1',onSaved:x=>callback=x},null);assert.equal(fresh.saved.agenda_meta.opportunity_id,'op-1');assert.equal(fresh.saved.related_record_id,'contact');assert.equal(callback.id,'new-task');assert.equal(fresh.options.canManage,true);assert.equal(fresh.scope.agendaComposerContext,null);
 const editing=await run({}, {id:'task',agenda_meta:{opportunity_id:'op-existing'}});assert.equal(editing.saved.agenda_meta.opportunity_id,'op-existing');assert.equal(editing.options.id,'task');
 const ordinary=await run({},null);assert.equal(ordinary.saved.agenda_meta.opportunity_id,undefined);
 const context={opportunityId:'op-conflict'};const conflict=await run(context,null,true);assert.equal(conflict.scope.agendaComposerContext,context);assert.equal(conflict.saved.agenda_meta.opportunity_id,'op-conflict');
 console.log('Agenda preserves opportunity and contact links on creation, editing and retry.');
})().catch(e=>{console.error(e);process.exitCode=1});
