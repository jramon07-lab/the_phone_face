const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {File}=require('node:buffer');
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.style={};this.events={};this.nodes={};this._html='';this.classList={contains:()=>false};this.isConnected=true;this.disabled=false;}
 set innerHTML(value){this._html=value;this.nodes={};}get innerHTML(){return this._html;}
 append(...items){items.forEach(x=>{x.parent=this;this.children.push(x);});}appendChild(x){this.append(x);return x;}
 setAttribute(){}removeAttribute(){}addEventListener(type,fn){this.events[type]=fn;}click(){return this.onclick?.()||this.events.click?.();}
 showModal(){this.open=true;}close(){this.open=false;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
 querySelector(selector){const attr=selector.match(/^\[([^\]]+)\]$/)?.[1];if(attr&&!this._html.includes(attr))return null;if(!attr&&!this._html.includes(selector.slice(1)))return null;return this.nodes[selector]||(this.nodes[selector]=new Element());}
 querySelectorAll(){return [];}replaceChildren(){this.children=[];}
}
const body=new Element('body'),head=new Element('head'),host=new Element(),modal=new Element();
const document={body,head,createElement:tag=>new Element(tag),querySelector:()=>null,getElementById(id){return id==='cpDocumentsPending'?host:id==='contactModal'?modal:id==='contactName'?{value:'Contacto de prueba'}:null;}};
const link={version:1,provider:'google_drive',folder_id:'test_folder',folder_name:'Contacto de prueba'},folder={id:link.folder_id,name:link.folder_name,canUpload:true};
let mode='normal',fetchHook=null,scanner=null;const calls=[];
const context=vm.createContext({console,document,File,URLSearchParams,Response,Date,setTimeout,clearTimeout,
 MutationObserver:class{observe(){}},addEventListener(){},
 fetch:async(url,options={})=>{calls.push({url,options});if(fetchHook)await fetchHook(url,options);
  if(url.includes('ensureFolder')){const b=JSON.parse(options.body);if(mode==='choice'&&!b.folderId)return Response.json({ok:true,needsChoice:true,contactName:'Prueba',candidates:[{id:'candidate_one',name:'Prueba'},{id:'candidate_two',name:'Prueba'}]});return Response.json({ok:true,created:!b.folderId,link,data:{...b.expectedData,TPF_DOCUMENTS:link},folder});}
  if(url.includes('action=status'))return Response.json({ok:true,connected:true,canUpload:true,canManage:true});
  if(url.includes('action=list'))return Response.json({ok:true,folder,files:[]});
  if(url.includes('action=upload'))return Response.json({ok:true,uploadUrl:'https://upload.test/file'});
  if(url==='https://upload.test/file')return new Response('{}');throw Error('Unexpected fetch');
 },sb:{auth:{getSession:async()=>({data:{session:{access_token:'test-only'}}})}},TPFDocumentScanner:{open(options){scanner=options;}}
});context.window=context;
vm.runInContext('let currentContact={id:"test-contact",data:{NOMBRE:"Contacto",APELLIDOS:"De prueba",NOTAS:"Conservar"}};',context);
const current=()=>vm.runInContext('currentContact',context);
vm.runInContext(fs.readFileSync('js/modules/document-folder-auto.js','utf8'),context);
const contactSource=fs.readFileSync('js/modules/contact-documents.js','utf8');
vm.runInContext(contactSource.replace("window.addEventListener('tpf:contact-open',refresh);","window.testDocs={refresh,upload};window.addEventListener('tpf:contact-open',refresh);"),context);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function chooseDialog(){for(let i=0;i<30;i++){const d=body.children.find(x=>x.tagName==='dialog');if(d)return d;await tick();}throw Error('No choice dialog');}
(async()=>{
 await context.testDocs.refresh();assert(host.innerHTML.includes('Crear / vincular carpeta'));assert(host.innerHTML.includes('data-doc-upload'));assert(!host.innerHTML.includes('WhatsApp: pendiente'));assert(!calls.some(x=>x.url.includes('ensureFolder')),'Opening a profile never creates a folder');
 await host.querySelector('[data-doc-ensure]').click();assert.equal(current().data.TPF_DOCUMENTS.folder_id,link.folder_id);assert.equal(current().data.NOTAS,'Conservar');assert(host.innerHTML.includes('Abrir en Google Drive'));assert(!host.innerHTML.includes('data-doc-ensure'));
 delete current().data.TPF_DOCUMENTS;calls.length=0;await context.testDocs.refresh();await context.testDocs.upload([new File(['pdf'],'documento.pdf',{type:'application/pdf'})]);
 const routes=calls.map(x=>x.url);assert(routes.findIndex(x=>x.includes('ensureFolder'))<routes.findIndex(x=>x.includes('action=upload')));assert(calls.some(x=>x.options.method==='PUT'),'PDF upload follows preparation');
 delete current().data.TPF_DOCUMENTS;await context.testDocs.refresh();await context.testDocs.upload([new File(['photo'],'foto.jpg',{type:'image/jpeg'})]);assert(scanner);assert.equal(scanner.initialFiles.length,1);assert.equal(scanner.folderName,folder.name);
 delete current().data.TPF_DOCUMENTS;await context.testDocs.refresh();scanner=null;await host.querySelector('[data-doc-scan]').click();assert(scanner,'Camera/PDF entry prepares folder before opening scanner');
 console.log('PASS profile renders prepare/upload buttons without a folder; opening is read-only; prepare, PDF upload and camera/scanner use shared helper');

 mode='choice';calls.length=0;const data={NOMBRE:'Prueba'};
 const chosen=context.TPFDocumentFolderAuto.ensure({contactId:'test-contact',data});let dialog=await chooseDialog();
 const rows=dialog.children.filter(x=>x.className==='tpfAutoFolderCandidate');assert.equal(rows.length,2);rows[1].children.find(x=>x.tagName==='button').click();
 await chosen;assert.equal(JSON.parse(calls[1].options.body).folderId,'candidate_two');
 calls.length=0;const canceled=context.TPFDocumentFolderAuto.ensure({contactId:'test-contact',data});const cancellation=assert.rejects(canceled,/cancelada/);dialog=await chooseDialog();dialog.children.find(x=>x.textContent==='Cancelar').click();await cancellation;assert.equal(calls.length,1,'Canceling a choice performs no second write');
 calls.length=0;let changed=false;const stale=context.TPFDocumentFolderAuto.ensure({contactId:'test-contact',data,check(){if(changed)throw Error('changed');}});const rejection=assert.rejects(stale,/changed/);dialog=await chooseDialog();changed=true;dialog.children.find(x=>x.className==='tpfAutoFolderCandidate').children.find(x=>x.tagName==='button').click();await rejection;assert.equal(calls.length,1,'Context change during choice must prevent linking');
 console.log('PASS duplicate-folder chooser, cancellation and context-change protection. All network mocked.');
})().catch(error=>{console.error(error);process.exitCode=1;});
