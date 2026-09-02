const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../js/mobile-app.js'),'utf8');
const testSource=source.replace(/\s*boot\(\);\s*\}\)\(\);\s*$/,`
window.__mobileLibraries={state,loadMobileTemplates,loadMobileLabels,saveMobileTemplate,saveMobileLabel,deleteMobileTemplate,deleteMobileLabel,mobileFilteredTemplates,mobileFilteredLabels};
})();`);
assert.notEqual(testSource,source,'No se pudo preparar mobile-app.js para la prueba');

function classes(){return {add(){},remove(){},contains(){return false;},toggle(){}};}
const nodes={
  mobileApp:{classList:classes()},mobileView:{innerHTML:'',scrollTop:0},mobileAdd:{classList:classes()},mobileToast:{textContent:'',className:'',classList:classes()},
  mobileTemplateName:{value:'Recordatorio'},mobileTemplateBody:{value:'Hola {nombre}'},mobileTemplateEditCategory:{value:'Atención'},mobileTemplateShortcut:{value:'/recordar'},mobileTemplateMsg:{textContent:''},
  mobileLabelName:{value:'Renovación'},mobileLabelEditCategory:{value:'Vodafone'},mobileLabelMsg:{textContent:''}
};
const buttons={'[data-action="save-template"]':{disabled:false},'[data-action="save-label"]':{disabled:false}};
const rpcCalls=[],fromCalls=[];
let templates=[{id:'tpl-1',name:'Saludo',body:'Hola',category:'Atención',shortcut:'/hola'}];
let labels=[{id:'label-1',name:'Cliente'}];
const client={
  async rpc(name,args){rpcCalls.push({name,args});if(name==='wa_list_templates')return {data:templates,error:null};if(name==='wa_upsert_template'){templates=[...templates,{id:'tpl-2',name:args.p_name,body:args.p_body,category:args.p_category,shortcut:args.p_shortcut}];return {data:'tpl-2',error:null};}if(name==='wa_delete_template'){templates=templates.filter(row=>row.id!==args.p_id);return {data:true,error:null};}if(name==='crm_list_labels')return {data:labels,error:null};if(name==='crm_create_label'){labels=[...labels,{id:'label-2',name:args.p_name}];return {data:true,error:null};}if(name==='crm_rename_label')return {data:true,error:null};if(name==='crm_delete_label'){labels=labels.filter(row=>row.id!==args.p_id);return {data:true,error:null};}return {data:null,error:null};},
  from(table){fromCalls.push(table);if(table==='crm_contact_labels')return {async select(){return {data:[{label_id:'label-1'},{label_id:'label-1'}],error:null};}};if(table==='app_settings')return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{value:{'label-1':'Seguimiento'}},error:null};},async upsert(payload,options){fromCalls.push({table,payload,options});return {data:true,error:null};}};throw new Error(`Tabla inesperada: ${table}`);}
};
const location={hash:'#/home',replace(value){this.hash=value;}};
const context={
  window:{supabase:{createClient(){return client;}}},console,Intl,URL,URLSearchParams,Date,location,history:{length:1,back(){}},navigator:{},confirm(){return true;},
  document:{hidden:false,getElementById(id){return nodes[id]||null;},querySelector(selector){return buttons[selector]||null;},querySelectorAll(){return [];},addEventListener(){},activeElement:null},
  setTimeout(fn){if(typeof fn==='function')fn();return 1;},clearTimeout(){},addEventListener(){}
};
vm.createContext(context);vm.runInContext(testSource,context);
const api=context.window.__mobileLibraries;

async function run(){
  api.state.user={id:'user-1'};api.state.perms={is_admin:true};api.state.whatsapp.templates=[{id:'chat-only'}];api.state.whatsapp.labels=[{id:'chat-label'}];
  await api.loadMobileTemplates(true);
  assert.deepEqual(Array.from(api.state.library.templates,row=>row.id),['tpl-1']);
  assert.deepEqual(Array.from(api.state.whatsapp.templates,row=>row.id),['chat-only'],'La biblioteca no debe mutar el selector de WhatsApp');
  api.state.library.templateQuery='saludo';assert.deepEqual(Array.from(api.mobileFilteredTemplates(),row=>row.id),['tpl-1']);api.state.library.templateQuery='';

  await api.loadMobileLabels(true);
  assert.deepEqual(Array.from(api.state.library.labels,row=>row.id),['label-1']);
  assert.equal(api.state.library.labelCounts['label-1'],2);assert.equal(api.state.library.labelCategories['label-1'],'Seguimiento');
  assert.deepEqual(Array.from(api.state.whatsapp.labels,row=>row.id),['chat-label'],'El gestor no debe mutar las etiquetas del chat');

  await api.saveMobileTemplate('');
  const templateSave=rpcCalls.find(call=>call.name==='wa_upsert_template');
  assert.deepEqual(JSON.parse(JSON.stringify(templateSave.args)),{p_id:null,p_name:'Recordatorio',p_body:'Hola {nombre}',p_category:'Atención',p_shortcut:'/recordar'});
  assert.equal(location.hash,'#/templates');

  location.hash='#/home';await api.saveMobileLabel('');
  assert.ok(rpcCalls.some(call=>call.name==='crm_create_label'&&call.args.p_name==='Renovación'));
  const categorySave=fromCalls.find(call=>typeof call==='object'&&call.table==='app_settings');
  assert.equal(categorySave.payload.key,'crm_label_categories_v1');assert.equal(categorySave.payload.value['label-2'],'Vodafone');
  assert.equal(location.hash,'#/labels');

  const before=rpcCalls.length;api.state.perms={is_admin:false,can_manage_templates:false,can_manage_labels:false};await api.saveMobileTemplate('');await api.saveMobileLabel('');assert.equal(rpcCalls.length,before,'Sin permiso no se debe ejecutar ninguna mutación');
  console.log('mobile template and label libraries: ok');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
