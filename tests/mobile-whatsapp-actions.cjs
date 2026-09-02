const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../js/mobile-app.js'),'utf8');
const testSource=source.replace(/\s*boot\(\);\s*\}\)\(\);\s*$/,`
window.__mobileWhatsAppActionsTest={
  state,renderMobileWaActions,openMobileWaActions,closeMobileWaSheet,
  openMobileWaTemplates,useMobileWaTemplate,openMobileWaLabels,saveMobileWaLabels,
  openMobileWaLinkedAction,renderContactOpportunity,saveContactOpportunity,
  renderNewTask,saveTask,sendMobileWaFile
};
})();`);
assert.notEqual(testSource,source,'No se pudo preparar mobile-app.js para la prueba');

function classes(initial=[]){
  const values=new Set(initial);return {add(...names){names.forEach(name=>values.add(name));},remove(...names){names.forEach(name=>values.delete(name));},contains(name){return values.has(name);},toggle(name,force){if(force===undefined)force=!values.has(name);force?values.add(name):values.delete(name);return force;}};
}

let selectedLabelInputs=[];
const focusTarget={focus(){}};
const sheet={dataset:{},classList:classes(['hidden']),attributes:{},_html:'',set innerHTML(value){this._html=value;},get innerHTML(){return this._html;},setAttribute(name,value){this.attributes[name]=String(value);},querySelector(){return focusTarget;},querySelectorAll(selector){return selector==='.m-wa-label-row input:checked'?selectedLabelInputs:[];}};
const composer={value:'',focus(){this.focused=true;},setSelectionRange(start,end){this.selection=[start,end];}};
const toast={textContent:'',className:'',classList:classes()};
const formNodes={
  mobileWaActionSheet:sheet,mobileApp:{inert:false},mobileWaComposer:composer,mobileToast:toast,
  contactOppTitle:{value:'Renovación móvil'},contactOppStage:{value:'stage-1'},contactOppDate:{value:'2026-09-30'},contactOppAmount:{value:'25,50'},contactOppNotes:{value:'Desde WhatsApp'},mobileContactOppMsg:{textContent:''},
  newTaskTitle:{value:'Llamar al cliente'},newTaskStarts:{value:'2026-09-03T10:30'},newTaskNotes:{value:'Tarea desde el chat'},mobileTaskMsg:{textContent:''}
};
const actionButtons={
  '[data-action="save-contact-opportunity"]':{disabled:false},
  '[data-action="save-task"]':{disabled:false}
};

const rpcCalls=[];
const inserts=[];
const rpcResults={
  wa_list_templates:{data:[{id:7,name:'Saludo',body:'Hola {nombre}, DNI {dni}, teléfono {telefono}',category:'Atención'}],error:null},
  crm_list_labels:{data:[{id:'label-1',name:'Cliente'},{id:'label-2',name:'Renovación'}],error:null},
  crm_get_contact_labels:{data:[{id:'label-1',name:'Cliente'}],error:null},
  crm_set_contact_labels:{data:true,error:null}
};
const client={
  auth:{async getSession(){return {data:{session:{access_token:'token'}},error:null};}},
  async rpc(name,args){rpcCalls.push({name,args});return rpcResults[name]||{data:null,error:null};},
  from(table){return {insert(row){inserts.push({table,row});return this;},select(){return this;},single(){return Promise.resolve({data:{id:`${table}-1`},error:null});}};}
};
let fetchCount=0;
const location={hash:'#/whatsapp-chat/34695661409%40c.us',replace(value){this.hash=value;}};
const context={
  window:{supabase:{createClient(){return client;}}},console,Intl,URL,URLSearchParams,AbortController,Date,
  location,history:{length:1,back(){}},confirm(){return true;},
  document:{hidden:false,activeElement:null,getElementById(id){return formNodes[id]||null;},querySelector(selector){return actionButtons[selector]||null;},querySelectorAll(){return [];},addEventListener(){}},
  fetch(){fetchCount+=1;throw new Error('No debe haber llamadas de red WhatsApp en esta prueba');},
  setTimeout(fn){if(typeof fn==='function')fn();return 1;},clearTimeout(){},addEventListener(){}
};
vm.createContext(context);vm.runInContext(testSource,context);
const api=context.window.__mobileWhatsAppActionsTest;

async function run(){
  const chatId='34695661409@c.us';
  api.state.user={id:'user-1'};api.state.perms={is_admin:true};api.state.loading=true;
  api.state.contacts=[{id:'contact-1',first:'María',last:'López',fullName:'María López',phone:'695661409',dni:'12345678Z'}];
  api.state.board={stages:[{id:'stage-1',pipeline_id:'pipeline-1',name:'Contactado'}],opportunities:[],fields:[]};
  api.state.whatsapp.selectedId=chatId;api.state.whatsapp.chats=[{id:chatId,name:'María López'}];

  const trigger={attributes:{},setAttribute(name,value){this.attributes[name]=String(value);},focus(){this.focused=true;}};
  api.openMobileWaActions(trigger);
  assert.equal(sheet.classList.contains('hidden'),false);
  assert.equal(sheet.dataset.chatId,chatId);
  assert.equal(trigger.attributes['aria-expanded'],'true');
  for(const label of ['Foto o archivo','Usar plantilla','Crear tarea','Crear oportunidad','Añadir etiqueta'])assert.match(sheet.innerHTML,new RegExp(label));

  await api.openMobileWaTemplates();
  assert.equal(rpcCalls.at(-1).name,'wa_list_templates');
  assert.match(sheet.innerHTML,/Saludo/);
  api.useMobileWaTemplate(0);
  assert.equal(composer.value,'Hola María, DNI 12345678Z, teléfono 695661409');
  assert.equal(fetchCount,0,'Elegir una plantilla no debe enviar WhatsApp');
  assert.equal(sheet.classList.contains('hidden'),true);

  api.openMobileWaActions(trigger);await api.openMobileWaLabels();
  assert.deepEqual(rpcCalls.slice(-2).map(call=>call.name),['crm_list_labels','crm_get_contact_labels']);
  assert.match(sheet.innerHTML,/value="label-1" checked/);
  selectedLabelInputs=[{value:'label-1'},{value:'label-2'}];
  await api.saveMobileWaLabels();
  const labelSave=rpcCalls.find(call=>call.name==='crm_set_contact_labels');
  assert.deepEqual(JSON.parse(JSON.stringify(labelSave.args)),{p_contact_id:'contact-1',p_label_ids:['label-1','label-2']});
  assert.equal(sheet.classList.contains('hidden'),true);
  assert.equal(trigger.focused,true,'Al guardar etiquetas el foco debe volver al botón +');

  trigger.focused=false;rpcResults.crm_set_contact_labels={data:null,error:new Error('Fallo simulado')};api.openMobileWaActions(trigger);await api.openMobileWaLabels();selectedLabelInputs=[{value:'label-2'}];await api.saveMobileWaLabels();
  assert.deepEqual(Array.from(api.state.whatsapp.labelIds),['label-1'],'Un fallo debe restaurar las etiquetas confirmadas');
  assert.match(sheet.innerHTML,/Fallo simulado/);rpcResults.crm_set_contact_labels={data:true,error:null};

  api.openMobileWaActions(trigger);api.openMobileWaLinkedAction('task');
  assert.equal(location.hash,'#/new-task/contact-1?chat=34695661409%40c.us');
  assert.match(api.renderNewTask('contact-1'),/data-fallback="whatsapp-chat\/34695661409%40c\.us"/);
  await api.saveTask('contact-1');
  assert.equal(inserts.at(-1).table,'agenda_items');
  assert.equal(inserts.at(-1).row.related_record_id,'contact-1');
  assert.equal(location.hash,'#/whatsapp-chat/34695661409%40c.us');

  location.hash='#/whatsapp-chat/34695661409%40c.us';api.openMobileWaActions(trigger);api.openMobileWaLinkedAction('opportunity');
  assert.equal(location.hash,'#/new-contact-opportunity/contact-1?chat=34695661409%40c.us');
  assert.match(api.renderContactOpportunity('contact-1'),/Oportunidad para María López/);
  await api.saveContactOpportunity('contact-1');
  const opportunity=inserts.at(-1);assert.equal(opportunity.table,'sales_opportunities');
  assert.equal(opportunity.row.record_id,'contact-1');assert.equal(opportunity.row.stage_id,'stage-1');assert.equal(opportunity.row.amount,25.5);
  assert.equal(location.hash,'#/whatsapp-chat/34695661409%40c.us');
  assert.equal(fetchCount,0,'Tareas, oportunidades y etiquetas no deben llamar al envío WhatsApp');

  api.state.whatsapp.selectedId='34600000000@c.us';location.hash='#/whatsapp-chat/34600000000%40c.us';
  await api.sendMobileWaFile({size:10,name:'foto.jpg',type:'image/jpeg'},chatId);
  assert.match(toast.textContent,/cambiaste de conversación/);
  assert.equal(fetchCount,0,'Un archivo del chat anterior no debe enviarse al chat nuevo');

  api.state.contacts=[];api.openMobileWaActions(trigger);
  assert.match(sheet.innerHTML,/data-action="wa-create-task"[^>]* disabled/);
  assert.match(sheet.innerHTML,/Primero crea o vincula el contacto/);

  console.log('mobile WhatsApp chat actions: ok');
}

run().catch(error=>{console.error(error);process.exitCode=1;});
