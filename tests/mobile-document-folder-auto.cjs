const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{},document:{createElement:()=>({}),head:{appendChild(){}}},URL,console};
let source=fs.readFileSync('js/mobile-documents.js','utf8');
source=source.replace('window.TPFMobileDocuments={mount,leave};','window.testFolder={prepareFolder,setModel:m=>model=m};');
vm.runInNewContext(source,context);
let calls=0,updates=0,current=true;
const client={auth:{}},contact={id:'one',data:{NOTAS:'conservar'},source:'crm'};
const m={id:'one',options:{contact,client,isCurrent:()=>current,update:()=>updates++},files:[],host:{querySelector:()=>null}};
context.window.testFolder.setModel(m);
context.window.TPFDocumentFolderAuto={ensure:async args=>{calls++;assert.equal(args.client,client);assert.equal(args.contactId,'one');args.check();return {data:{...args.data,TPF_DOCUMENTS:{folder_id:'folder'}},link:{folder_id:'folder'},folder:{canUpload:true}};}};
(async()=>{
 await context.window.testFolder.prepareFolder(m);assert.equal(calls,1);assert.equal(updates,1);assert.equal(contact.data.NOTAS,'conservar');assert.equal(m.link.folder_id,'folder');
 await context.window.testFolder.prepareFolder(m);assert.equal(calls,1,'reuse ready folder');
 m.link=null;context.window.TPFDocumentFolderAuto.ensure=async args=>{current=false;args.check();};
 await assert.rejects(context.window.testFolder.prepareFolder(m),/Vuelve a abrir/);assert.equal(updates,1,'no stale contact update');
 console.log('PASS mobile folder preparation uses mobile session, retains contact data, reuses folder and stops on navigation. Network mocked.');
})().catch(e=>{console.error(e);process.exit(1)});
