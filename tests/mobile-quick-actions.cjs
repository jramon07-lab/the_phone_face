const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../js/mobile-app.js'),'utf8');
const testSource=source.replace(/\s*boot\(\);\s*\}\)\(\);\s*$/,`
window.__mobileQuickActions={state,renderMobileQuickActions,openMobileQuickActions,closeMobileWaSheet,renderContactChooser,renderMobileTemplateLibrary,renderMobileLabelLibrary,handleViewClick};
})();`);
assert.notEqual(testSource,source,'No se pudo preparar mobile-app.js para la prueba');

function classes(initial=[]){const values=new Set(initial);return {add(...names){names.forEach(name=>values.add(name));},remove(...names){names.forEach(name=>values.delete(name));},contains(name){return values.has(name);},toggle(name,force){if(force===undefined)force=!values.has(name);force?values.add(name):values.delete(name);return force;}};}
const focusTarget={focus(){}};
const sheet={dataset:{},classList:classes(['hidden']),attributes:{},innerHTML:'',setAttribute(name,value){this.attributes[name]=String(value);},querySelector(){return focusTarget;},querySelectorAll(){return [];}};
const nodes={mobileWaActionSheet:sheet,mobileApp:{inert:false},mobileToast:{textContent:'',className:'',classList:classes()},mobileCameraStatus:{textContent:''},mobileCapturePhoto:{disabled:true}};
const location={hash:'#/home',replace(value){this.hash=value;}};
const context={
  window:{},console,Intl,URL,URLSearchParams,Date,location,history:{length:1,back(){}},navigator:{},confirm(){return true;},
  document:{hidden:false,activeElement:null,getElementById(id){return nodes[id]||null;},querySelectorAll(){return [];},querySelector(){return null;},addEventListener(){}},
  setTimeout(fn){if(typeof fn==='function')fn();return 1;},clearTimeout(){},addEventListener(){}
};
vm.createContext(context);vm.runInContext(testSource,context);
const api=context.window.__mobileQuickActions;

api.state.user={id:'user-1',email:'ramon@example.com'};
api.state.perms={is_admin:true};
api.state.contacts=[{id:'contact-1',first:'María',last:'López',fullName:'María López',phone:'695661409',dni:'12345678Z',email:'maria@example.com'}];
api.state.board={stages:[{id:'stage-1',name:'Contactado'}],opportunities:[],fields:[]};
api.state.tasks=[];
api.state.whatsapp.selectedId='34695661409@c.us';

const html=api.renderMobileQuickActions();
const labels=['Escanear contacto','Crear contacto manualmente','Nueva oportunidad','Nueva tarea','Plantillas','Etiquetas'];
for(const label of labels)assert.match(html,new RegExp(label));
for(let index=1;index<labels.length;index+=1)assert.ok(html.indexOf(labels[index-1])<html.indexOf(labels[index]),'Las acciones deben conservar el orden prometido');

const trigger={attributes:{},setAttribute(name,value){this.attributes[name]=String(value);},focus(){this.focused=true;}};
api.openMobileQuickActions(trigger);
assert.equal(sheet.dataset.kind,'quick-actions');
assert.equal(sheet.dataset.chatId,'','El + global no debe heredar el chat seleccionado');
assert.equal(nodes.mobileApp.inert,true);
assert.equal(trigger.attributes['aria-expanded'],'true');

function click(action,extra={}){api.handleViewClick({target:{closest(){return {dataset:{action,...extra}};}},preventDefault(){}});}
click('quick-task');
assert.equal(location.hash,'#/choose-contact/task');
assert.match(api.renderContactChooser('task'),/new-task\/contact-1\?origin=quick/);
assert.match(api.renderContactChooser('task'),/María López/);
assert.match(api.renderContactChooser('opportunity'),/new-contact-opportunity\/contact-1\?origin=quick/);
assert.match(api.renderContactChooser('invalid'),/No disponible/);

api.state.library.templatesLoaded=true;
api.state.library.templates=[{id:'tpl-1',name:'Saludo',text:'Hola {nombre}',category:'Atención',shortcut:'/hola'}];
const templates=api.renderMobileTemplateLibrary();
assert.match(templates,/Saludo/);assert.match(templates,/data-action="new-template"/);assert.match(templates,/data-action="edit-template"/);assert.match(templates,/data-action="delete-template"/);assert.doesNotMatch(templates,/open-desktop/);

api.state.library.labelsLoaded=true;
api.state.library.labels=[{id:'label-1',name:'Cliente'}];
api.state.library.labelCategories={'label-1':'Seguimiento'};
api.state.library.labelCounts={'label-1':2};
const labelsHtml=api.renderMobileLabelLibrary();
assert.match(labelsHtml,/Cliente/);assert.match(labelsHtml,/Seguimiento/);assert.match(labelsHtml,/2 contactos/);assert.match(labelsHtml,/data-action="assign-label"/);assert.doesNotMatch(labelsHtml,/open-desktop/);

api.state.perms={is_admin:false,can_view_database:true,can_create_database:false,can_view_sales:false,can_edit_sales:false,can_manage_agenda:false,can_manage_templates:false,can_manage_labels:false};
const restricted=api.renderMobileQuickActions();
for(const action of ['quick-scan','quick-manual','quick-opportunity','quick-task','quick-templates','quick-labels'])assert.match(restricted,new RegExp(`data-action="${action}"[^>]* disabled`));

console.log('mobile global quick actions: ok');
