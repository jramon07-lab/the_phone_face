const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const nodes=new Map();let setting=null,fail=false;
const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false});return nodes.get(id)};
const client={from(table){assert.equal(table,'app_settings');return {select(){return this},eq(k,v){assert.equal(v,'agenda_types');return this},async maybeSingle(){return {data:{value:setting},error:fail?new Error('offline'):null}}}}};
const context={window:{supabase:{createClient:()=>client}},document:{getElementById:node},console,Intl,Date,URLSearchParams,setTimeout,clearTimeout};
const source=fs.readFileSync('js/mobile-app.js','utf8').replace(/\s*boot\(\);\s*\}\)\(\);\s*$/,`window.api={loadMobileTaskTypes,taskTypeOptions,taskTypeFields,readTaskTypeFields,setRow(row){taskDetail.row=row}};})();`);
vm.runInNewContext(source,context);const a=context.window.api;
(async()=>{
 await a.loadMobileTaskTypes();for(const t of ['Tarea','Llamada','Cita','WhatsApp'])assert(a.taskTypeOptions('Tarea').includes(t));
 setting=[{name:'Visita',icon:'x',color:'#fff'}];await a.loadMobileTaskTypes();assert(a.taskTypeOptions('Anterior').includes('Visita'));assert(a.taskTypeOptions('Anterior').includes('Anterior'));
 fail=true;await a.loadMobileTaskTypes();assert(a.taskTypeOptions('Tarea').includes('Llamada'));
 assert(a.taskTypeFields('newTask','Llamada').includes('Volver a llamar'));assert(a.taskTypeFields('newTask','Cita',{location:'<x>'}).includes('&lt;x&gt;'));
 a.setRow({agenda_type:'Cita',agenda_meta:{location:'Antes',future:'retain'}});node('editTaskType').value='Llamada';node('editTaskDuration').value='45';node('editTaskResult').value='callback';
 let value=a.readTaskTypeFields('editTask');assert.equal(value.agenda_type,'Llamada');assert.equal(value.agenda_meta.duration,'45');assert.equal(value.agenda_meta.result,'callback');assert.equal(value.agenda_meta.future,'retain');assert(!('location' in value.agenda_meta));
 node('newTaskType').value='WhatsApp';node('newTaskWhatsappMessage').value='Recordar documentación';value=a.readTaskTypeFields('newTask');assert.equal(value.agenda_meta.whatsapp_message,'Recordar documentación');assert(!('whatsapp_enabled' in value));assert(a.taskTypeFields('newTask','WhatsApp').includes('no programa un envío'));
 console.log('PASS: shared catalog, fallback, legacy and custom types, metadata, escaping, no WhatsApp scheduling');
})().catch(e=>{console.error(e);process.exitCode=1});
