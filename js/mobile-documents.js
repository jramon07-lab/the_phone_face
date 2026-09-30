(function(){
'use strict';
let model=null,serial=0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy=v=>JSON.parse(JSON.stringify(v));
function clearDraft(m){if(m.draft){for(const item of m.draft.items)if(item.url)URL.revokeObjectURL(item.url);m.draft=null;}}
function leave(){if(model){const old=model;model=null;old.observer?.disconnect();clearDraft(old);old.dialogs?.forEach(d=>d.close());serial++;}}
function mount(host,options){if(!host)return;if(!model||model.id!==options.contact.id||model.userId!==options.userId){model={id:options.contact.id,userId:options.userId,host,options,serial:++serial,status:null,folder:null,files:[],next:'',busy:false,message:'',uploaded:[],query:'',thumbs:new Map(),dialogs:new Set(),link:options.contact.data?.TPF_DOCUMENTS||null};draw(model);reload(model);return;}model.host=host;model.options=options;draw(model);}
function active(m){return model===m&&m.options.isCurrent();}
function check(m){if(!active(m))throw Error('Vuelve a abrir Documentos del cliente antes de continuar.');}
async function api(m,action,body,params={}){check(m);const session=await m.options.client.auth.getSession(),token=session.data?.session?.access_token;if(!token)throw Error('Inicia sesión de nuevo.');check(m);const q=new URLSearchParams({action,contactId:m.id,...params}),r=await fetch('/api/crm-documents?'+q,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify({...body,contactId:m.id})}:{})}),d=await r.json();if(!r.ok||!d.ok){if(d.code==='GOOGLE_RECONNECT_REQUIRED'&&m.status){m.status.connected=false;m.status.reconnectRequired=true;m.files=[];m.folder=null;m.next='';}throw Error(d.error||'No se pudo completar la operación.');}check(m);return d;}
function say(m,text){if(!active(m))return;m.message=text;const el=m.host?.querySelector('[data-md-message]');if(el)el.textContent=text;}
async function run(m,fn){if(!active(m)||m.busy)return;m.busy=true;draw(m);try{await fn();}catch(e){say(m,e.message);}finally{m.busy=false;if(active(m))draw(m);}}
async function reload(m,more=false){return run(m,async()=>{say(m,m.files.length?'Actualizando archivos…':'Cargando documentos…');const d=await api(m,'mobileList',null,more?{page:m.next}:m.options.quickUpload?{uploadOnly:'1'}:{});const same=m.link?.folder_id===d.link?.folder_id;m.status=d.status;m.link=d.link;if(d.record){m.options.contact.data=d.record.data;m.options.update({...d.record,created_at:m.options.contact.createdAt,updated_at:m.options.contact.updatedAt});}else m.options.contact.data.TPF_DOCUMENTS=d.link;m.folder=d.folder;m.files=more&&same?m.files.concat(d.files):d.files;m.next=d.nextPageToken||'';say(m,'');});}
async function prepareFolder(m){
 check(m);if(m.link&&m.folder?.canUpload)return;
 const c=m.options.contact,snapshot=JSON.stringify(c.data||{});
 const validate=()=>{check(m);if(JSON.stringify(c.data||{})!==snapshot)throw Error('La ficha cambió. Vuelve a abrir Documentos.');};
 if(!window.TPFDocumentFolderAuto)throw Error('Actualiza la página para preparar la carpeta.');
 const result=await window.TPFDocumentFolderAuto.ensure({contactId:m.id,data:c.data,client:m.options.client,check:validate,notice:text=>say(m,text)});validate();
 c.data=result.data;m.link=result.link;m.folder=result.folder;m.files=[];m.next='';
 m.options.update({id:m.id,source_sheet:c.source,data:c.data,created_at:c.createdAt,updated_at:c.updatedAt});
 check(m);if(!m.folder?.canUpload)throw Error('Google no permite subir archivos a esta carpeta.');
}
function safeUrl(value){try{const u=new URL(value);if(u.protocol==='https:'&&['drive.google.com','docs.google.com'].includes(u.hostname))return u.href;}catch(_){}return '';}
function draw(m){if(!active(m))return;const c=m.options.contact,link=m.link,connected=m.status?.connected,allowed=connected&&m.status?.canUpload&&(!link||m.folder?.canUpload),disabled=m.busy?'disabled':'',folderUrl=link?.provider==='google_drive'&&/^[\w-]{10,200}$/.test(link.folder_id)?'https://drive.google.com/drive/folders/'+link.folder_id:'';
m.host.innerHTML=`<section class="m-info-card m-docs ${m.options.quickUpload?'m-docs-quick':''}"><h2>Documentos</h2><p>${connected?'Google Drive conectado':m.status?.reconnectRequired?'Google Drive necesita renovar la conexión':m.status?'Google Drive pendiente de conectar':'Comprobando conexión…'}</p>${link?'<p><b>Carpeta:</b> '+esc(m.folder?.name||link.folder_name)+'</p>':'<p>La carpeta se preparará al guardar el primer documento.</p>'}<div class="m-doc-actions">${m.status?.canManage&&!connected?'<button type="button" class="m-primary" data-md-connect '+(m.status.configured?disabled:'disabled')+'>'+(m.status.reconnectRequired?'Volver a conectar Google Drive':'Conectar Google Drive')+'</button>':''}${folderUrl?'<a class="m-secondary" target="_blank" rel="noopener noreferrer" href="'+folderUrl+'">Abrir carpeta ↗</a>':''}<button type="button" class="m-secondary" data-md-refresh ${disabled}>Actualizar archivos</button>${allowed?'<button type="button" class="m-primary" data-md-upload '+disabled+'>Subir archivo o foto</button><button type="button" class="m-secondary" data-md-scan '+disabled+'>Escanear DNI</button><input type="file" data-md-file accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,image/x-adobe-dng,image/dng,.dng" multiple hidden>':''}${connected&&m.status?.canManage?'<button type="button" class="m-secondary" data-md-choose '+disabled+'>'+(link?'Cambiar carpeta':'Vincular carpeta existente')+'</button>':''}</div>${m.status&&!connected?'<p>'+(m.status?.canManage?'Renueva la autorización aquí para volver a consultar y subir archivos.':'El administrador debe conectar Google Drive. Se usará aquí la misma conexión.')+'</p>':''}${connected&&link&&m.folder&&!m.folder.canUpload?'<p>Google permite consultar esta carpeta, pero no añadir archivos.</p>':''}<div data-md-picker hidden></div>${m.uploaded?.length&&m.options.createTask?'<div class="m-info-card" role="status"><b>Archivo guardado. ¿Crear una tarea?</b><p>'+m.uploaded.map(f=>esc(f.name)).join('<br>')+'</p><button type="button" class="m-primary" data-md-task '+disabled+'>Crear tarea</button> <button type="button" class="m-secondary" data-md-dismiss '+disabled+'>Ahora no</button></div>':''}<p data-md-message role="status">${esc(m.message)}</p>${!m.options.quickUpload?`<label class="m-doc-search"><input type="search" data-md-search placeholder="Buscar archivo" aria-label="Buscar archivo" value="${esc(m.query||'')}"></label><div data-md-list>${fileList(m)}</div>${m.next?'<button type="button" class="m-secondary" data-md-more '+disabled+'>Ver más archivos</button>':''}`:''}<h3>Caducidad del DNI</h3>${['contact','holder'].filter(k=>c.data?.TPF_DNI_EXPIRY?.[k]?.date).map(k=>'<p>'+ (k==='holder'?'Titular':'Contacto')+': <b>'+esc(c.data.TPF_DNI_EXPIRY[k].date.split('-').reverse().join('/'))+'</b> · Confirmada</p>').join('')||'<p>Pendiente de lectura y confirmación.</p>'}</section>`;
const $=s=>m.host.querySelector(s);$('[data-md-task]')?.addEventListener('click',()=>{if(!m.busy&&active(m))m.options.createTask(m.uploaded.slice());});$('[data-md-dismiss]')?.addEventListener('click',()=>{m.uploaded=[];draw(m);});$('[data-md-connect]')?.addEventListener('click',()=>run(m,async()=>{const d=await api(m,'authorize',{mobile:true});const u=new URL(d.url);if(u.origin!=='https://accounts.google.com')throw Error('No se pudo abrir la autorización de Google.');window.location.assign(u.href);}));m.host.querySelectorAll('[data-md-trash]').forEach(b=>b.onclick=()=>{const f=m.files.find(f=>f.id===b.dataset.mdTrash);if(!f||!confirm('¿Enviar «'+f.name+'» a la papelera de Google Drive?'))return;run(m,async()=>{await api(m,'trash',{fileId:f.id,fileName:f.name,expectedLink:m.link,confirmed:true});m.files=m.files.filter(x=>x.id!==f.id);say(m,'Archivo enviado a la papelera de Google Drive.');});});bindFileList(m);$('[data-md-search]')?.addEventListener('input',e=>{m.query=e.target.value;const list=$('[data-md-list]');list.innerHTML=fileList(m);bindFileList(m);});$('[data-md-refresh]').onclick=()=>reload(m);$('[data-md-more]')?.addEventListener('click',()=>reload(m,true));$('[data-md-scan]')?.addEventListener('click',()=>scan(m));$('[data-md-upload]')?.addEventListener('click',()=>{m.adding=false;$('[data-md-file]').click();});$('[data-md-file]')?.addEventListener('change',e=>{const files=[...e.target.files];e.target.value='';if(m.adding&&m.draft){m.adding=false;addDraftFiles(m,files);}else chooseUploadFormat(m,files);});$('[data-md-choose]')?.addEventListener('click',()=>choose(m));if(m.draft&&!m.busy)renderDraft(m);
}
function fileUrl(f){return safeUrl(f.webViewLink)||(/^[\w-]{10,200}$/.test(f.id)?'https://drive.google.com/file/d/'+f.id+'/view':'');}
function fileList(m){
 const query=String(m.query||'').toLocaleLowerCase('es'),files=m.files.filter(f=>String(f.name).toLocaleLowerCase('es').includes(query));
 if(!files.length)return m.folder?'<p>'+ (query?'No hay coincidencias en los archivos cargados.':'No hay archivos en esta carpeta.')+'</p>':'';
 return files.map(f=>`<article class="m-doc-file" data-file-id="${esc(f.id)}"><div class="m-doc-file-main"><button class="m-doc-thumb" data-md-view="${esc(f.id)}" type="button" aria-label="Vista previa de ${esc(f.name)}" ${m.busy?'disabled':''}><span>${/pdf/i.test(f.mimeType||f.name)?'PDF':/^image/.test(f.mimeType||'')?'FOTO':'DOC'}</span>${m.thumbs?.get(f.id)?`<img alt="" src="${esc(m.thumbs.get(f.id))}">`:''}</button><div><b>${esc(f.name)}</b><small>${esc(f.modifiedTime?new Date(f.modifiedTime).toLocaleDateString('es-ES'):'')}${f.size?' · '+Math.ceil(Number(f.size)/1024)+' KB':''}</small></div><details><summary aria-label="Opciones de ${esc(f.name)}">⋯</summary><button type="button" data-md-share="${esc(f.id)}">Compartir enlace</button>${m.status?.canUpload?`<button type="button" data-md-trash="${esc(f.id)}" ${m.busy?'disabled':''}>Borrar</button>`:''}</details></div><div class="m-doc-row-actions"><button class="m-secondary" type="button" data-md-view="${esc(f.id)}" ${m.busy?'disabled':''}>Ver</button>${m.options.createTask?`<button class="m-secondary" type="button" data-md-file-task="${esc(f.id)}" ${m.busy?'disabled':''}>Crear tarea</button>`:''}</div></article>`).join('');
}
function bindFileList(m){
 const find=id=>m.files.find(f=>f.id===id);
 m.host.querySelectorAll('[data-md-view]').forEach(b=>b.onclick=()=>{const f=find(b.dataset.mdView);if(f&&!m.busy)previewFile(m,f);});
 m.host.querySelectorAll('[data-md-file-task]').forEach(b=>b.onclick=()=>{const f=find(b.dataset.mdFileTask);if(f&&active(m)&&!m.busy&&fileUrl(f))m.options.createTask([{...f,webViewLink:fileUrl(f)}]);});
 m.host.querySelectorAll('[data-md-share]').forEach(b=>b.onclick=()=>{const f=find(b.dataset.mdShare);if(f)shareFile(m,f);});
 m.host.querySelectorAll('[data-md-trash]').forEach(b=>b.onclick=()=>{const f=find(b.dataset.mdTrash);if(!f||m.busy||!confirm('¿Enviar «'+f.name+'» a la papelera de Google Drive?'))return;run(m,async()=>{await api(m,'trash',{fileId:f.id,fileName:f.name,expectedLink:m.link,confirmed:true});m.files=m.files.filter(x=>x.id!==f.id);say(m,'Archivo enviado a la papelera.');});});
 observeThumbnails(m);
}
function observeThumbnails(m){
 m.observer?.disconnect();if(m.options.quickUpload||m.busy||typeof IntersectionObserver==='undefined')return;
 m.observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){m.observer.unobserve(entry.target);const id=entry.target.dataset.fileId;const f=m.files.find(f=>f.id===id);if(f?.hasThumbnail&&!m.thumbs.has(id)){(m.thumbQueue||(m.thumbQueue=new Set())).add(id);}}drainThumbnails(m);},{rootMargin:'100px'});
 m.host.querySelectorAll('[data-file-id]').forEach(el=>m.observer.observe(el));
}
async function drainThumbnails(m){
 if(m.busy||m.thumbLoading||!active(m)||!m.thumbQueue?.size)return;m.thumbLoading=true;
 try{while(active(m)&&!m.busy&&m.thumbQueue.size){const ids=[...m.thumbQueue].slice(0,4);ids.forEach(id=>m.thumbQueue.delete(id));let result;try{result=await api(m,'thumbnails',{ids,expectedLink:m.link});}catch(_){ids.forEach(id=>m.thumbs.set(id,null));continue;}
  for(const item of result.images||[]){if(!active(m))return;const data=/^data:image\/(jpeg|png|webp);base64,/.test(item.data||'')?item.data:null;m.thumbs.set(item.id,data);if(data)m.host.querySelectorAll('[data-file-id]').forEach(el=>{if(el.dataset.fileId!==item.id)return;const box=el.querySelector('.m-doc-thumb');if(box&&!box.querySelector('img')){const img=document.createElement('img');img.alt='';img.src=data;box.appendChild(img);}});}
 }}finally{m.thumbLoading=false;}
}
function docDialog(m,title){
 const dialog=document.createElement('dialog');dialog.className='m-doc-dialog';dialog.setAttribute('aria-label',title);dialog.innerHTML='<header><strong>'+esc(title)+'</strong><button type="button" aria-label="Cerrar">✕</button></header><div class="m-doc-dialog-body"></div>';
 document.body.appendChild(dialog);(m.dialogs||(m.dialogs=new Set())).add(dialog);dialog.querySelector('header button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{m.dialogs.delete(dialog);dialog.remove();},{once:true});dialog.showModal();return dialog;
}
async function shareFile(m,f){
 if(!active(m))return;const url=fileUrl(f);if(!url)return;
 try{if(navigator.share){await navigator.share({title:f.name,url});return;}await navigator.clipboard.writeText(url);say(m,'Enlace copiado. Se mantienen los permisos de Google Drive.');}catch(e){if(e.name!=='AbortError')say(m,'No se pudo compartir. Abre el archivo en Drive para copiar su enlace.');}
}
function previewFile(m,f){
 if(!active(m)||!fileUrl(f))return;const dialog=docDialog(m,f.name),body=dialog.querySelector('.m-doc-dialog-body');
 body.innerHTML=`<div data-file-preview></div><p class="m-doc-help">También puedes abrir el original en Drive.</p><div class="m-doc-actions"><a class="m-secondary" target="_blank" rel="noopener noreferrer" href="${esc(fileUrl(f))}">Abrir en Drive ↗</a>${m.options.createTask?'<button type="button" class="m-primary" data-task>Crear tarea</button>':''}<button type="button" class="m-secondary" data-share>Compartir</button></div>`;
 window.TPFDocumentPreview.mount({host:body.querySelector('[data-file-preview]'),dialog,client:m.options.client,contactId:m.id,file:f,isCurrent:()=>active(m)});
 body.querySelector('[data-task]')?.addEventListener('click',()=>{if(active(m)){dialog.close();m.options.createTask([{...f,webViewLink:fileUrl(f)}]);}});body.querySelector('[data-share]').onclick=()=>shareFile(m,f);
}
function confirmDuplicate(m,files,name){
 if(!active(m))return Promise.resolve(false);
 return new Promise(resolve=>{const dialog=docDialog(m,'Posible duplicado'),body=dialog.querySelector('.m-doc-dialog-body');let accepted=false;
 body.innerHTML='<p>Ya existe un archivo con el nombre <b>'+esc(name)+'</b> en esta ficha.</p><p class="m-doc-help">Puede ser otro documento. No se borrará ni reemplazará ninguno.</p><div class="m-doc-actions">'+files.filter(f=>fileUrl(f)).map(f=>'<a class="m-secondary" target="_blank" rel="noopener noreferrer" href="'+esc(fileUrl(f))+'">Ver existente ↗</a>').join('')+'<button type="button" class="m-primary" data-anyway>Subir igualmente</button><button type="button" class="m-secondary" data-stop>Cancelar</button></div>';
 body.querySelector('[data-anyway]').onclick=()=>{accepted=true;dialog.close();};body.querySelector('[data-stop]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>resolve(accepted&&active(m)),{once:true});});
}
function uploadMime(file){
 const ext=String(file.name||'').split('.').pop().toLowerCase(),raw=String(file.type||'').split(';')[0].trim().toLowerCase();
 const known={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',heif:'image/heif',dng:'image/x-adobe-dng'};
 return (!raw||raw==='application/octet-stream')?(known[ext]||raw):({'image/jpg':'image/jpeg','image/pjpeg':'image/jpeg','image/x-png':'image/png'}[raw]||raw);
}
function sendFile(url,file,mime,progress){
 if(typeof XMLHttpRequest==='undefined')return fetch(url,{method:'PUT',headers:{'Content-Type':mime},body:file});
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();xhr.open('PUT',url);xhr.setRequestHeader('Content-Type',mime);xhr.timeout=120000;
  xhr.upload.onprogress=e=>{if(e.lengthComputable)progress(Math.min(100,Math.floor(e.loaded/e.total*100)));};
  xhr.upload.onload=()=>progress(100);
  xhr.onload=()=>resolve({ok:xhr.status>=200&&xhr.status<300,json:async()=>JSON.parse(xhr.responseText)});
  xhr.onerror=xhr.ontimeout=xhr.onabort=()=>reject(Error('No se pudo confirmar la subida. Actualiza los archivos antes de repetirla.'));
  xhr.send(file);
 });
}
async function uploadOne(m,file,link){check(m);say(m,'Preparando la subida en Google Drive…');const mime=uploadMime(file),payload={expectedLink:link,name:file.name,size:file.size,mimeType:mime,checkDuplicates:true};let d=await api(m,'upload',payload);if(d.duplicates?.length){if(!await confirmDuplicate(m,d.duplicates,file.name))throw Error('Subida cancelada. Se conserva el archivo existente.');check(m);d=await api(m,'upload',{...payload,allowDuplicate:true});}check(m);say(m,'Enviando '+file.name+' · '+(file.size/1024/1024).toFixed(1)+' MB…');let r;try{r=await sendFile(d.uploadUrl,file,d.mimeType||mime,percent=>say(m,percent===100?'Envío completado. Confirmando guardado en Google Drive…':'Enviando '+file.name+' · '+percent+'% · '+(file.size/1024/1024).toFixed(1)+' MB'));}catch(_){throw Error('No se pudo confirmar la subida. Actualiza los archivos antes de repetirla.');}if(!r.ok)throw Error('Google no confirmó la subida. Actualiza los archivos antes de repetirla.');const saved=await r.json().catch(()=>null);if(active(m)&&saved?.id){const url=safeUrl(saved.webViewLink)||(/^[\w-]+$/.test(saved.id)?'https://drive.google.com/file/d/'+saved.id+'/view':'');if(url){const entry={id:saved.id,name:saved.name||file.name,webViewLink:url,mimeType:mime,size:file.size,modifiedTime:new Date().toISOString(),hasThumbnail:true};(m.uploaded||(m.uploaded=[])).push(entry);m.files=[entry,...(m.files||[]).filter(f=>f.id!==entry.id)];}}return saved;}
function chooseUploadFormat(m,files){
 if(!files.length||m.busy||!active(m))return;clearDraft(m);
 m.draft={items:[],format:files.every(f=>uploadMime(f).startsWith('image/'))?'pdf':'original',name:'Documento'};
 addDraftFiles(m,files);
}
function addDraftFiles(m,files){
 if(!m.draft||!active(m))return;
 if(m.draft.items.length+files.length>12){say(m,'Puedes preparar hasta 12 archivos a la vez.');return;}
 for(const file of files){const item={file,name:file.name.replace(/\.[^.]+$/,''),rotation:0,url:null};m.draft.items.push(item);
  if(uploadMime(file).startsWith('image/')){
   if(window.TPFMobileDNG?.isDNG(file)){
    window.TPFMobilePhotoPDF?.preview(file).then(blob=>{if(active(m)&&m.draft?.items.includes(item)){item.url=URL.createObjectURL(blob);if(!m.busy)renderDraft(m);}}).catch(()=>{});
   }else item.url=URL.createObjectURL(file);
  }
 }
 if(!m.draft.items.every(i=>uploadMime(i.file).startsWith('image/')))m.draft.format='original';
 renderDraft(m);
}
function renderDraft(m){
 if(!active(m)||!m.draft||m.busy)return;const draft=m.draft,box=m.host.querySelector('[data-md-picker]');if(!box)return;box.hidden=false;
 const images=draft.items.every(i=>uploadMime(i.file).startsWith('image/'));
 box.innerHTML=`<section class="m-doc-prep"><h3>Preparar archivo</h3>${images?`<div class="m-doc-formats" role="group" aria-label="Formato de archivo">${[['pdf','PDF'],['optimized','Foto optimizada'],['original','Original']].map(([k,l])=>`<button type="button" data-format="${k}" aria-pressed="${draft.format===k}" class="${draft.format===k?'m-primary':'m-secondary'}">${l}</button>`).join('')}</div>`:''}${draft.format==='pdf'?`<label>Nombre del PDF<input data-name value="${esc(draft.name)}" maxlength="190"></label>`:''}<p class="m-doc-help">${draft.format==='original'?'Se conserva el formato y la calidad del archivo original.':'Ordena las páginas con las flechas y gira las fotos si lo necesitas.'}</p><div class="m-doc-pages">${draft.items.map((item,index)=>`<article class="m-doc-page"><div class="m-doc-page-image">${item.url?`<img src="${esc(item.url)}" alt="Foto ${index+1}" style="transform:rotate(${draft.format==='original'?0:item.rotation*90}deg)">`:'<span>Archivo</span>'}<b>${index+1}</b></div>${draft.format!=='pdf'?`<label>Nombre<input data-item-name="${index}" value="${esc(item.name)}" maxlength="180"></label>`:`<small>${esc(item.file.name)}</small>`}<div class="m-doc-page-tools">${draft.format!=='original'?`<button type="button" data-rotate="${index}" aria-label="Girar foto ${index+1}">↻ Girar</button>`:''}<button type="button" data-move="${index}" data-step="-1" aria-label="Mover archivo ${index+1} antes" ${index===0?'disabled':''}>↑</button><button type="button" data-move="${index}" data-step="1" aria-label="Mover archivo ${index+1} después" ${index===draft.items.length-1?'disabled':''}>↓</button><button type="button" data-remove="${index}" aria-label="Quitar archivo ${index+1}">×</button></div></article>`).join('')}</div><div class="m-doc-actions"><button type="button" class="m-secondary" data-add>Añadir foto o archivo</button><button type="button" class="m-primary" data-save>Subir ${draft.format==='pdf'?'PDF':'archivo'+(draft.items.length>1?'s':'')}</button><button type="button" class="m-secondary" data-cancel>Cancelar</button></div></section>`;
 box.querySelector('[data-name]')?.addEventListener('input',e=>draft.name=e.target.value);
 box.querySelectorAll('[data-item-name]').forEach(el=>el.oninput=()=>draft.items[Number(el.dataset.itemName)].name=el.value);
 box.querySelectorAll('[data-format]').forEach(el=>el.onclick=()=>{draft.format=el.dataset.format;renderDraft(m);});
 box.querySelectorAll('[data-rotate]').forEach(el=>el.onclick=()=>{const item=draft.items[Number(el.dataset.rotate)];item.rotation=(item.rotation+1)%4;renderDraft(m);});
 box.querySelectorAll('[data-move]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.move),j=i+Number(el.dataset.step);if(j<0||j>=draft.items.length)return;[draft.items[i],draft.items[j]]=[draft.items[j],draft.items[i]];renderDraft(m);});
 box.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{const [item]=draft.items.splice(Number(el.dataset.remove),1);if(item.url)URL.revokeObjectURL(item.url);if(!draft.items.length){clearDraft(m);box.hidden=true;}else renderDraft(m);});
 box.querySelector('[data-add]').onclick=()=>{m.adding=true;m.host.querySelector('[data-md-file]').click();};
 box.querySelector('[data-cancel]').onclick=()=>{clearDraft(m);box.hidden=true;box.innerHTML='';};
 box.querySelector('[data-save]').onclick=()=>uploadDraft(m);
 box.querySelectorAll('img').forEach(img=>img.onerror=()=>{img.alt='Vista previa no disponible';img.removeAttribute('src');});
}
function namedFile(file,name){
 const base=String(name||'').trim();if(!base||base.length>180||/[\x00-\x1f/\\]/.test(base))throw Error('Escribe un nombre válido para cada archivo, sin barras.');
 const ext=file.name.match(/\.[^.]+$/)?.[0]||'';const full=base.toLowerCase().endsWith(ext.toLowerCase())?base:base+ext;
 return new File([file],full,{type:file.type||uploadMime(file)});
}
async function uploadDraft(m){
 if(m.busy||!active(m)||!m.draft?.items.length)return;const draft=m.draft;m.uploaded=[];
 await run(m,async()=>{
  await prepareFolder(m);const link=copy(m.link);
  if(draft.format==='pdf'){
   const pdf=await window.TPFMobilePhotoPDF.build(draft.items.map(i=>i.file),draft.name,{check:()=>check(m),progress:t=>say(m,t),rotations:draft.items.map(i=>i.rotation)});
   await uploadOne(m,pdf,link);clearDraft(m);
  }else{
   // Validate all names before creating any remote files.
   draft.items.forEach(i=>namedFile(i.file,i.name));let done=0;const total=draft.items.length;
   while(draft.items.length){const item=draft.items[0];check(m);say(m,'Preparando archivo '+(done+1)+' de '+total+'…');
    const prepared=draft.format==='optimized'?await window.TPFMobilePhotoPDF.optimize(item.file,{check:()=>check(m),rotation:item.rotation}):item.file;
    await uploadOne(m,namedFile(prepared,item.name),link);if(item.url)URL.revokeObjectURL(item.url);draft.items.shift();done++;
   }clearDraft(m);
  }
  say(m,'Guardado. Puedes crear una tarea sobre el archivo.');
 });
}
async function scan(m,initialFiles=[]){if(m.busy||!active(m)||!window.TPFDocumentScanner)return;let ready=false;await run(m,async()=>{await prepareFolder(m);ready=true;});if(!ready||!active(m))return;m.uploaded=[];const snapshot=copy(m.options.contact.data),link=copy(m.link),c=m.options.contact;window.TPFDocumentScanner.open({initialFiles,name:c.fullName,folderName:m.folder.name,holderName:snapshot.TPF_TITULAR?.same===false?snapshot.TPF_TITULAR.holder_name:'',check:()=>check(m),upload:file=>uploadOne(m,file,link),saveExpiry:async value=>{const d=await api(m,'expiry',{...value,confirmed:true,expectedData:snapshot});m.options.contact.data.TPF_DNI_EXPIRY=d.expiry;m.options.update({id:m.id,source_sheet:c.source,data:m.options.contact.data,created_at:c.createdAt,updated_at:c.updatedAt});draw(m);},refresh:()=>{if(active(m))reload(m);}});}
function choose(m){if(m.busy)return;const box=m.host.querySelector('[data-md-picker]');box.hidden=false;box.innerHTML='<label>Enlace o identificador de la carpeta<input data-md-folder type="text" placeholder="Pega el enlace de Google Drive"></label><label class="m-doc-check"><input type="checkbox" data-md-confirm> Confirmo que la carpeta corresponde a este cliente.</label><button type="button" class="m-primary" data-md-link>Guardar vinculación</button>';box.querySelector('[data-md-link]').onclick=()=>{const folderId=box.querySelector('[data-md-folder]').value,confirmed=box.querySelector('[data-md-confirm]').checked;if(!confirmed){say(m,'Confirma la carpeta antes de guardar.');return;}run(m,async()=>{const d=await api(m,'link',{folderId,confirmed:true,expectedLink:m.link});m.link=d.link;m.options.contact.data.TPF_DOCUMENTS=d.link;m.files=[];m.folder=null;m.next='';say(m,'Carpeta vinculada. Pulsa Actualizar archivos.');});};}
window.TPFMobileDocuments={mount,leave};
const css=document.createElement('style');css.textContent='.m-docs{min-width:0}.m-docs h2{margin-top:0}.m-doc-actions{display:flex;flex-wrap:wrap;gap:10px}.m-doc-actions>*{min-height:44px;max-width:100%;box-sizing:border-box}.m-doc-file{display:flex;gap:10px;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid #dce3ef}.m-doc-file>div{min-width:0;overflow-wrap:anywhere}.m-doc-file small{display:block;color:#667085;margin-top:5px}.m-doc-file a{flex:none}.m-docs [hidden]{display:none!important}.m-docs input:not([type=checkbox]){width:100%;padding:12px;box-sizing:border-box;font-size:16px}.m-docs label{display:block;margin:12px 0}.m-docs .m-doc-check{display:flex;gap:10px;align-items:center}.m-docs [data-md-message]{overflow-wrap:anywhere}.tpfScan input,.tpfScan select{font-size:16px}.tpfScan{box-sizing:border-box}.tpfScan .scanHead p{overflow-wrap:anywhere}.tpfScan .scanHead>div{min-width:0;flex:1}.tpfScan .scanFoot button{min-height:44px}@media(max-width:600px){.tpfScan{width:96vw;max-height:92dvh}.tpfScan .scanHead,.tpfScan .scanFoot{padding:10px;gap:8px}.tpfScan h2{font-size:20px}.tpfScan .scanBody{padding:12px}.tpfScan canvas{max-height:48dvh}.tpfScan .scanFoot{justify-content:flex-start}.tpfScan .scanFoot button{flex:1;padding:10px}.m-doc-actions>*{flex:1 1 140px}}';document.head.appendChild(css);
})();
