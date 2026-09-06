(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id),safe=v=>String(v??'');
const imageName=(name,mime)=>/\.[a-z0-9]{2,5}$/i.test(name)?name:`Foto de WhatsApp - ${new Date().toISOString().slice(0,10)}.${mime.includes('png')?'png':'jpg'}`;
const live=()=>typeof waLiveState!=='undefined'?waLiveState:null;
const eligible=info=>['image','document','file'].includes(info?.kind)&&!!(info.url||info.thumb||/(image|document|file)/i.test(info.type||''));
function incoming(m){return typeof window.waMessageDirection==='function'?window.waMessageDirection(m)==='in':m?.outgoing===false;}
function mediaInfo(m){return typeof window.waMediaInfo==='function'?window.waMediaInfo(m):null;}
function history(){return [...(live()?.history||[])].sort((a,b)=>Number(window.waMessageTimestamp?.(a)||a?.timestamp||0)-Number(window.waMessageTimestamp?.(b)||b?.timestamp||0)).filter(m=>{const info=mediaInfo(m),text=safe(window.waMessageText?.(m)),type=safe(info?.type||m?.messageData?.typeMessage||m?.typeMessage).toLowerCase(),isMedia=!!(info?.url||info?.thumb||/(image|sticker|video|audio|voice|document|file)/i.test(info?.type||''));return isMedia||text||!['textmessage','extendedtextmessage'].includes(type);});}
function documentName(info){const name=safe(info?.name).trim();const mime=safe(info?.mime).toLowerCase();const internal=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(name);if(!name||internal)return imageName('',mime);return name.slice(0,180);}
function contact(){return live()?.contact||null;}
function linked(){return contact()?.data?.TPF_DOCUMENTS||null;}
function capture(){
 const c=contact(),chatId=safe(live()?.selected?.id),snapshot=JSON.parse(JSON.stringify(c?.data||{})),link=snapshot.TPF_DOCUMENTS||null;
 return {c,chatId,snapshot,link,check(){
  if(safe(live()?.selected?.id)!==chatId||contact()?.id!==c?.id||JSON.stringify(linked())!==JSON.stringify(link))throw Error('El chat o la carpeta han cambiado. Vuelve a abrir el archivo.');
 }};
}
function requireLink(ctx){ctx.check();if(!ctx.c?.id||!ctx.link?.folder_id||!ctx.link?.folder_name)throw Error('Vincula primero la carpeta de documentos de este cliente.');}
async function prepare(ctx){
 ctx.check();if(ctx.link)return ctx;
 if(!ctx.c?.id)throw Error('Vincula primero este chat a una ficha de cliente.');
 if(!window.TPFDocumentFolderAuto)throw Error('Actualiza la página para preparar la carpeta automáticamente.');
 const result=await window.TPFDocumentFolderAuto.ensure({contactId:ctx.c.id,data:ctx.snapshot,check:ctx.check,notice:show});
 ctx.check();if(JSON.stringify(ctx.c.data)!==JSON.stringify(ctx.snapshot))throw Error('La ficha cambió. Actualízala antes de guardar el archivo.');ctx.c.data=result.data;return capture();
}
function downloadUrl(id,name){const chatId=safe(live()?.selected?.id);return `/api/green?action=download&chatId=${encodeURIComponent(chatId)}&idMessage=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`;}
function show(text,kind=''){let el=$('tpfWaDocumentNotice');if(!el){el=document.createElement('div');el.id='tpfWaDocumentNotice';el.className='tpfWaDocumentNotice';document.body.appendChild(el);}el.textContent=text;el.className='tpfWaDocumentNotice '+kind;clearTimeout(show.timer);show.timer=setTimeout(()=>el.remove(),4200);}
function button(label,action,id,info){const b=document.createElement('button');b.type='button';b.className='tpfWaDocAction';b.textContent=label;b.dataset.waDocAction=action;b.dataset.waDocId=id;b.dataset.waDocChat=safe(live()?.selected?.id);b.dataset.waDocName=documentName(info);b.dataset.waDocMime=safe(info?.mime||'');b.dataset.waDocKind=safe(info?.kind||'file');return b;}
function decorate(){const box=$('waMessages');if(!box||!live()?.selected)return;const rows=history(),nodes=[...box.querySelectorAll('.waMsg')];nodes.forEach((node,index)=>{const m=rows[index],info=mediaInfo(m),id=safe(m?.idMessage);if(!m||!id||!incoming(m)||!eligible(info))return;const bubble=node.querySelector('.waBubble');if(!bubble||bubble.querySelector('[data-tpf-wa-document]'))return;const actions=document.createElement('div');actions.dataset.tpfWaDocument='1';actions.className='tpfWaDocumentActions';actions.append(button('Guardar en PC','pc',id,info),button('Guardar en documentos','drive',id,info));if(info?.kind==='image')actions.append(button('PDF de DNI','dni',id,info));bubble.append(actions);});}
async function fetchFile(id,name,mime){const r=await fetch(downloadUrl(id,name),{cache:'no-store'});if(!r.ok)throw Error('No se pudo descargar el archivo de WhatsApp.');const blob=await r.blob();if(!blob.size)throw Error('El archivo recibido está vacío.');return new File([blob],imageName(name,mime||blob.type),{type:mime||blob.type||'application/octet-stream'});}
async function auth(){const s=await sb.auth.getSession(),token=s.data?.session?.access_token;if(!token)throw Error('Inicia sesión de nuevo.');return token;}
async function docs(action,body,ctx){ctx.check();const token=await auth(),id=ctx.c?.id;ctx.check();if(!id)throw Error('Este chat todavía no tiene una ficha de cliente.');const q=new URLSearchParams({action,contactId:id}),r=await fetch('/api/crm-documents?'+q,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify({...body,contactId:id})}:{})}),d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'No se pudo guardar el documento.');return d;}
async function upload(file,ctx){ctx.check();const link=ctx.link;if(!link)throw Error('Este cliente todavía no tiene una carpeta de documentos vinculada.');if(file.size>100*1024*1024)throw Error('El archivo supera el máximo de 100 MB.');const d=await docs('upload',{expectedLink:link,name:file.name,size:file.size,mimeType:file.type},ctx);ctx.check();const r=await fetch(d.uploadUrl,{method:'PUT',headers:{'Content-Type':file.type},body:file});if(!r.ok)throw Error('Google no confirmó la subida.');}
function savePc(id,name,mime){const finalName=imageName(name,mime);const a=document.createElement('a');a.href=downloadUrl(id,finalName);a.download=finalName;a.style.display='none';document.body.appendChild(a);a.click();a.remove();show('Descarga iniciada. La carpeta depende de los ajustes de tu navegador.','ok');}
async function saveDrive(id,name,mime,ctx){
 requireLink(ctx);show('Descargando el archivo de WhatsApp…');
 const file=await fetchFile(id,name,mime);ctx.check();
 show('Guardando en documentos del cliente…');await upload(file,ctx);
 show('Guardado en '+ctx.link.folder_name+'.','ok');
}
async function dni(id,name,mime,ctx){
 requireLink(ctx);if(!window.TPFDocumentScanner)throw Error('El escáner de DNI aún no está disponible.');
 show('Preparando foto de DNI…');const file=await fetchFile(id,name,mime);ctx.check();
 const {c,snapshot,link:savedLink}=ctx;
 window.TPFDocumentScanner.open({initialFiles:[file],name:safe(c.data?.['NOMBRE Y APELLIDOS']||c.fullName||c.name||'Cliente'),folderName:safe(savedLink.folder_name),holderName:snapshot.TPF_TITULAR?.same===false?snapshot.TPF_TITULAR.holder_name:'',
 check:ctx.check,upload:file=>upload(file,ctx),
 saveExpiry:async value=>{const result=await docs('expiry',{...value,confirmed:true,expectedData:snapshot},ctx);c.data.TPF_DNI_EXPIRY=result.expiry;},
 refresh:()=>{}});
}
const pending=new Set();
function askName(name,mime){
 const original=imageName(name,mime),ext=original.match(/\.[a-z0-9]{2,5}$/i)?.[0]||'';
 const value=window.prompt('Nombre del archivo para guardar en documentos'+(ext?' (se conserva '+ext+')':'')+':',ext?original.slice(0,-ext.length):original);
 if(value===null)return null;
 let result=value.trim();
 if(!result||/[\x00-\x1f/\\]/.test(result))throw Error('Escribe un nombre válido, sin barras.');
 if(ext&&!result.toLowerCase().endsWith(ext.toLowerCase()))result+=ext;
 if(result.length>200)throw Error('El nombre del archivo es demasiado largo.');
 return result;
}
async function act(target){
 const action=target.dataset.waDocAction,id=safe(target.dataset.waDocId),name=safe(target.dataset.waDocName),mime=safe(target.dataset.waDocMime),chatId=safe(target.dataset.waDocChat),key=chatId+':'+id;
 if(!action||!id||target.disabled||pending.has(key))return;
 try{
  if(chatId!==safe(live()?.selected?.id))throw Error('El chat ha cambiado. Vuelve a abrir el archivo.');
  let ctx=capture();target.disabled=true;pending.add(key);
  let saveName=name;
  if(action==='drive'){saveName=askName(name,mime);if(saveName===null)return;ctx.check();}
  if(action==='drive'||action==='dni')ctx=await prepare(ctx);
  if(action==='pc')savePc(id,name,mime);
  if(action==='drive')await saveDrive(id,saveName,mime,ctx);
  if(action==='dni')await dni(id,name,mime,ctx);
 }catch(error){show(error.message||'No se pudo completar la acción.','error');}
 finally{target.disabled=false;pending.delete(key);}
}
function style(){if($('tpfWaReceivedDocumentsCss'))return;const s=document.createElement('style');s.id='tpfWaReceivedDocumentsCss';s.textContent='#view-whatsapplive .tpfWaDocumentActions{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-start;margin-top:7px}.tpfWaDocAction{border:1px solid #cbd5e1;background:#fff;color:#175cd3;border-radius:8px;padding:7px 10px;font:600 12px/1.1 system-ui;cursor:pointer}.tpfWaDocAction:disabled{opacity:.55;cursor:wait}.tpfWaDocMenu{display:flex;flex-direction:column;gap:6px;align-items:stretch;margin:7px 0;padding:8px;background:#fff;border:1px solid #d7dee8;border-radius:10px;box-shadow:0 5px 18px #102a4c22}.tpfWaDocMenu .tpfWaDocAction{text-align:left;color:#17243c;border:0;background:#f7f9fc}.tpfWaDocMenu .tpfWaDocAction:hover{background:#eaf3ff}.tpfWaDocumentNotice{position:fixed;z-index:100000;right:20px;bottom:20px;max-width:min(380px,calc(100vw - 40px));padding:12px 15px;border-radius:10px;background:#17243c;color:#fff;box-shadow:0 10px 30px #0003;font:14px/1.35 system-ui}.tpfWaDocumentNotice.ok{background:#147a46}.tpfWaDocumentNotice.error{background:#b42318}@media(max-width:700px){.tpfWaDocumentNotice{right:12px;bottom:84px}.tpfWaDocAction{min-height:36px}}';document.head.appendChild(s);}
function install(){style();document.addEventListener('click',e=>{const target=e.target.closest?.('[data-wa-doc-action]');if(target){e.preventDefault();e.stopPropagation();act(target);}},true);const watch=new MutationObserver(()=>requestAnimationFrame(decorate));watch.observe(document.body,{childList:true,subtree:true});setTimeout(decorate,800);}
M.register('whatsapp-received-documents',{install});
})();
