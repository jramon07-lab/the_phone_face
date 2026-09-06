const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {File}=require('node:buffer');
const source=fs.readFileSync('js/modules/whatsapp-received-documents.js','utf8');
const core=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');

class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.style={};this.className='';this.textContent='';this.disabled=false;}
  append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
  appendChild(child){this.append(child);return child;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
  querySelectorAll(selector){const matches=child=>selector==='[data-tpf-wa-document]'?!!child.dataset.tpfWaDocument:selector==='[data-wa-doc-action]'?!!child.dataset.waDocAction:selector[0]==='.'?child.className.split(' ').includes(selector.slice(1)):false;return this.children.flatMap(child=>[...(matches(child)?[child]:[]),...child.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  click(){this.onClick?.();}
}
const body=new Element('body'),head=new Element('head'),box=new Element();box.id='waMessages';body.append(box);
const findId=(el,id)=>el.id===id?el:el.children.map(child=>findId(child,id)).find(Boolean);
const downloads=[],calls=[],timers=[],frames=[],observers=[];
const document={body,head,getElementById:id=>findId(body,id)||findId(head,id),querySelectorAll:s=>body.querySelectorAll(s),addEventListener(){},createElement(tag){const el=new Element(tag);if(tag==='a')el.onClick=()=>downloads.push({href:el.href,name:el.download});return el;}};
let fetchHook=null,authHook=null,scanner=null;
const ctx=vm.createContext({document,console,File,URLSearchParams,Date,Response,Blob,
  setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},requestAnimationFrame(fn){frames.push(fn);},
  MutationObserver:class{constructor(fn){observers.push(fn);}observe(){}},
  fetch:async(url,options={})=>{calls.push({url,options});if(fetchHook)await fetchHook(url,options);if(url.includes('action=ensureFolder')){const body=JSON.parse(options.body),link=client(body.contactId).data.TPF_DOCUMENTS;return Response.json({ok:true,created:true,link,data:{...body.expectedData,TPF_DOCUMENTS:link},folder:{id:link.folder_id,name:link.folder_name,canUpload:true}});}if(url.startsWith('/api/green?'))return new Response('test-photo',{headers:{'Content-Type':'image/jpeg'}});if(url.startsWith('/api/crm-documents?'))return Response.json({ok:true,uploadUrl:'https://upload.test/file',expiry:{contact:{date:'2030-01-01'}}});if(url==='https://upload.test/file')return new Response('{}');throw Error('Unexpected network call');},
  sb:{auth:{async getSession(){if(authHook)await authHook();return {data:{session:{access_token:'test-only'}}};}}},
});
ctx.window=ctx;
ctx.TPFModules={register(name,def){assert.equal(name,'whatsapp-received-documents');def.install();}};
ctx.TPFDocumentScanner={open(options){scanner=options;}};
// Match the real CRM: a global `let` is NOT a property of window.
vm.runInContext('let waLiveState={selected:{id:"chat-a"},history:[],contact:null};',ctx);
vm.runInContext(core.slice(core.indexOf('function waMessageText('),core.indexOf('function waMediaHtml(')),ctx);
vm.runInContext(source.replace("M.register('whatsapp-received-documents',", "window.testReceived={decorate,act};M.register('whatsapp-received-documents',"),ctx);
const state=()=>vm.runInContext('waLiveState',ctx);
const client=(id='client-a')=>({id,data:{NOMBRE:'Prueba',TPF_DOCUMENTS:{provider:'google_drive',folder_id:'folder-'+id,folder_name:'Carpeta '+id}}});
const msg=(id,kind='image',outgoing=false,name='foto.jpg',mime='image/jpeg')=>({idMessage:id,timestamp:Number(id.replace(/\D/g,''))||1,outgoing,typeMessage:kind+'Message',fileName:name,mimeType:mime,downloadUrl:'https://media.test/'+id});
function render(rows){state().history=rows;box.children=[];for(const m of [...rows].sort((a,b)=>(a.timestamp||0)-(b.timestamp||0))){if(m.typeMessage==='textMessage'&&!m.textMessage)continue;const node=new Element(),bubble=new Element();node.className='waMsg '+(m.outgoing?'out':'in');bubble.className='waBubble hasMedia';node.append(bubble);box.append(node);}ctx.testReceived.decorate();return box.querySelectorAll('[data-wa-doc-action]');}
const button=(id,action)=>box.querySelectorAll('[data-wa-doc-action]').find(b=>b.dataset.waDocId===id&&b.dataset.waDocAction===action);

(async()=>{
  assert.equal(ctx.waLiveState,undefined,'Regression fixture must retain lexical state');
  state().contact=client();
  const buttons=render([{idMessage:'empty',typeMessage:'textMessage'},msg('photo1'),msg('pdf2','document',false,'contrato.pdf','application/pdf'),msg('sent3','image',true),{idMessage:'text',typeMessage:'textMessage',textMessage:'Hola'}]);
  assert.deepEqual(buttons.map(b=>b.textContent),['Guardar en PC','Guardar en documentos','PDF de DNI','Guardar en PC','Guardar en documentos'],'Received photos/PDFs must show buttons even though window.waLiveState is undefined');
  ctx.testReceived.decorate();assert.equal(box.querySelectorAll('[data-wa-doc-action]').length,5,'Redraw must not duplicate actions');
  await ctx.testReceived.act(button('pdf2','pc'));assert.equal(downloads.length,1);assert.equal(downloads[0].name,'contrato.pdf');assert.match(downloads[0].href,/chatId=chat-a/);assert.match(downloads[0].href,/idMessage=pdf2/);
  await ctx.testReceived.act(button('photo1','drive'));
  const upload=calls.find(call=>call.url.includes('action=upload'));assert(upload,'Drive button must reach upload API');assert.equal(JSON.parse(upload.options.body).contactId,'client-a');assert.equal(JSON.parse(upload.options.body).expectedLink.folder_id,'folder-client-a');assert(calls.some(call=>call.options.method==='PUT'));
  await ctx.testReceived.act(button('photo1','dni'));assert(scanner,'DNI button opens existing scanner');assert.equal(scanner.initialFiles.length,1);assert.equal(scanner.initialFiles[0].type,'image/jpeg');assert.equal(scanner.folderName,'Carpeta client-a');
  calls.length=0;state().contact=null;await ctx.testReceived.act(button('photo1','drive'));assert.equal(calls.length,0,'No upload/download without linked contact');
  vm.runInContext(fs.readFileSync('js/modules/document-folder-auto.js','utf8'),ctx);
  state().contact=client();delete state().contact.data.TPF_DOCUMENTS;await ctx.testReceived.act(button('photo1','drive'));assert(calls[0].url.includes('action=ensureFolder'),'Prepare missing folder before downloading/uploading');assert(calls.some(c=>c.options.method==='PUT'));assert.equal(state().contact.data.TPF_DOCUMENTS.folder_id,'folder-client-a');
  calls.length=0;delete state().contact.data.TPF_DOCUMENTS;scanner=null;await ctx.testReceived.act(button('photo1','dni'));assert(calls[0].url.includes('action=ensureFolder'));assert(scanner,'DNI scanner should open after creating folder');
  calls.length=0;delete state().contact.data.TPF_DOCUMENTS;fetchHook=async url=>{if(url.includes('action=ensureFolder')){state().selected={id:'chat-b'};state().contact=client('client-b');}};
  await ctx.testReceived.act(button('photo1','drive'));assert(!calls.some(c=>c.url.startsWith('/api/green?')),'Stop if chat changes during folder preparation');
  fetchHook=null;state().selected={id:'chat-a'};
  state().contact=client();calls.length=0;
  fetchHook=async url=>{if(url.startsWith('/api/green?')){state().selected={id:'chat-b'};state().contact=client('client-b');}};
  await ctx.testReceived.act(button('photo1','drive'));assert(!calls.some(c=>c.url.includes('action=upload')),'Switching chat during download must not save to another client');
  fetchHook=null;calls.length=0;state().selected={id:'chat-a'};state().contact=client();
  authHook=async()=>{state().selected={id:'chat-b'};state().contact=client('client-b');};
  await ctx.testReceived.act(button('photo1','drive'));assert(!calls.some(c=>c.url.includes('action=upload')),'Switching during auth must not change upload destination');
  authHook=null;calls.length=0;state().selected={id:'chat-a'};state().contact=client();
  fetchHook=async url=>{if(url.includes('action=upload'))state().contact.data.TPF_DOCUMENTS.folder_id='changed-folder';};
  await ctx.testReceived.act(button('photo1','drive'));assert(!calls.some(c=>c.options.method==='PUT'),'Folder change before PUT must cancel upload');
  fetchHook=null;calls.length=0;state().selected={id:'chat-a'};state().contact=client();
  await ctx.testReceived.act(button('photo1','dni'));state().selected={id:'chat-b'};state().contact=client('client-b');
  assert.throws(scanner.check,/han cambiado/);await assert.rejects(scanner.upload(new File(['pdf'],'DNI.pdf',{type:'application/pdf'})),/han cambiado/);
  calls.length=0;const beforeDownloads=downloads.length;await ctx.testReceived.act(button('photo1','pc'));assert.equal(downloads.length,beforeDownloads,'Stale buttons must not download from another chat');
  console.log('PASS: lexical state, visible photo/PDF buttons, skipped messages, outgoing/text excluded, no duplicates, PC download, Drive upload, scanner handoff, missing links and chat/folder/auth race guards. All network mocked.');
})().catch(error=>{console.error(error);process.exitCode=1;});
