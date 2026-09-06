(function(){
'use strict';
const host=document.getElementById('cpDocumentsPending');if(!host)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let epoch=0,id='',link=null,status=null,files=[],next='',folder=null,busy=false;
const current=()=>{try{return currentContact;}catch(_){return null;}};
const name=()=>document.getElementById('contactName')?.value||'este cliente';
const providerName=p=>p==='onedrive'?'OneDrive':'Google Drive';
function linkUrl(l){if(l?.provider==='google_drive'&&/^[\w-]{10,200}$/.test(l.folder_id))return 'https://drive.google.com/drive/folders/'+l.folder_id;return '';}
function fileUrl(f){try{const u=new URL(f.webViewLink);if(u.protocol==='https:'&&['drive.google.com','docs.google.com'].includes(u.hostname))return u.href;}catch(_){}return '';}
async function call(action,body){const targetId=id;const session=await sb.auth.getSession(),token=session.data?.session?.access_token;if(!token)throw Error('Inicia sesión de nuevo.');const q=new URLSearchParams({action,contactId:targetId});if(body&&action==='search')q.set('q',body.q);if(body&&action==='list'&&body.page)q.set('page',body.page);const write=['link','upload','authorize','trash'].includes(action),r=await fetch('/api/crm-documents?'+q,{method:write?'POST':'GET',headers:{Authorization:'Bearer '+token,...(write?{'Content-Type':'application/json'}:{})},...(write?{body:JSON.stringify({...body,contactId:targetId})}:{})}),d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'No se pudo completar la operación.');return d;}
function message(value){const el=host.querySelector('[data-doc-message]');if(el)el.textContent=value;}
function render(){
 const connected=!!status?.connected,url=linkUrl(link),title=folder?.name||link?.folder_name;
 host.innerHTML=`<div class="cpRefDrive"><strong>Documentos del cliente</strong><span class="cpPendingBadge">${link?esc(providerName(link.provider)):connected?'Google Drive conectado':'Pendiente de conectar'}</span></div>
 <p>${title?'Carpeta: <b>'+esc(title)+'</b>':'Una carpeta para todos los PDF y fotografías de '+esc(name())+'.'}</p>
 <div class="cpRefDocActions">${url?'<a class="secondary" href="'+url+'" target="_blank" rel="noopener noreferrer">Abrir en Google Drive ↗</a>':''}
 ${status?.canManage&&!connected?'<button type="button" data-doc-connect '+(!status.configured?'disabled':'')+'>Conectar Google Drive</button>':''}
 ${status?.canManage&&connected?'<button type="button" data-doc-choose>'+(link?'Cambiar carpeta':'Vincular carpeta existente')+'</button>':''}
 ${link&&connected?'<button type="button" data-doc-refresh>Actualizar archivos</button>':''}
 ${link&&connected&&status?.canUpload?'<button type="button" data-doc-upload '+(!folder?.canUpload?'disabled':'')+'>Subir PDF / fotos</button><button type="button" data-doc-scan '+(!folder?.canUpload?'disabled':'')+'>Fotos / cámara a PDF</button><input type="file" data-doc-file hidden accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif" multiple>':''}</div>
 ${!connected?'<p>La autorización de Documentos es independiente de las copias de seguridad. '+(status?.canManage?'Conecta Google Drive para buscar tus carpetas y acceder a sus archivos.':'El administrador debe conectar Google Drive.')+'</p>':''}
 <p data-doc-message role="status" aria-live="polite"></p><div data-doc-picker hidden></div>
 <div class="tpfDocsFiles">${files.length?files.map(f=>{const u=fileUrl(f);return '<div class="tpfDocsFile"><span><b>'+esc(f.name)+'</b><small>'+esc(f.modifiedTime?new Date(f.modifiedTime).toLocaleDateString('es-ES'):'')+(f.size?' · '+Math.ceil(Number(f.size)/1024)+' KB':'')+'</small></span>'+(u?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">Ver ↗</a>':'')+(status?.canUpload?'<button type="button" data-doc-trash="'+esc(f.id)+'">Borrar</button>':'')+'</div>';}).join(''):link&&connected&&folder?'<p>No hay archivos en esta carpeta.</p>':''}</div>
 ${next?'<button type="button" data-doc-more>Ver más archivos</button>':''}
 <p class="small">Fotos a PDF: recorte y caducidad con confirmación. Guardar documentos desde WhatsApp: pendiente. OneDrive: preparado como proveedor futuro; todavía sin conectar.</p>`;
 host.querySelectorAll('[data-doc-trash]').forEach(b=>b.onclick=()=>{const f=files.find(f=>f.id===b.dataset.docTrash);if(!f||!confirm('¿Enviar «'+f.name+'» a la papelera de Google Drive?'))return;run(async()=>{const e=epoch;await call('trash',{fileId:f.id,fileName:f.name,expectedLink:link,confirmed:true});if(e!==epoch)return;files=files.filter(x=>x.id!==f.id);render();message('Archivo enviado a la papelera de Google Drive.');});});
 host.querySelector('[data-doc-connect]')?.addEventListener('click',()=>run(async()=>{const branch='https://the-phone-face-app-whatsapp-git-4c8eb2-jramon-07-2402s-projects.vercel.app';if(location.origin!==branch){message('Para conectar, abre el enlace fijo de la rama.');const a=document.createElement('a');a.href=branch+'/';a.textContent='Abrir enlace fijo';host.querySelector('[data-doc-message]').append(' ',a);return;}const d=await call('authorize',{});location.assign(d.url);}));
 host.querySelector('[data-doc-choose]')?.addEventListener('click',choose);
 host.querySelector('[data-doc-refresh]')?.addEventListener('click',()=>loadFiles(false));
 host.querySelector('[data-doc-more]')?.addEventListener('click',()=>loadFiles(true));
 host.querySelector('[data-doc-scan]')?.addEventListener('click',()=>scanDocument());
 host.querySelector('[data-doc-upload]')?.addEventListener('click',()=>host.querySelector('[data-doc-file]').click());
 host.querySelector('[data-doc-file]')?.addEventListener('change',e=>upload([...e.target.files]));
}

function showExpiry(){
 const card=document.querySelector('.cpRefExpiry'),v=current()?.data?.TPF_DNI_EXPIRY;if(!card)return;
 card.innerHTML='<h3>Caducidad del DNI</h3>'+(['contact','holder'].filter(k=>v?.[k]?.date).map(k=>'<p><b>'+(k==='holder'?'Titular':'Contacto')+':</b> '+esc(v[k].date.split('-').reverse().join('/'))+' · Confirmada</p>').join('')||'<p>Pendiente de lectura y confirmación.</p>');
}
function scanDocument(initialFiles=[]){
 if(busy||!folder?.canUpload||!window.TPFDocumentScanner)return;
 const target=id,captured=JSON.parse(JSON.stringify(link)),snapshot=JSON.parse(JSON.stringify(current().data)),e=epoch;
 const check=()=>{if(id!==target||epoch!==e)throw Error('La ficha ha cambiado. Cierra y vuelve a abrir el escáner.');};
 window.TPFDocumentScanner.open({initialFiles,name:name(),folderName:folder.name,holderName:snapshot.TPF_TITULAR?.same===false?snapshot.TPF_TITULAR.holder_name:'',
 check,
 upload:async file=>{check();const ext=file.name.split('.').pop().toLowerCase(),mime=file.type||({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',heic:'image/heic',heif:'image/heif',webp:'image/webp',pdf:'application/pdf'}[ext]||'');const d=await call('upload',{expectedLink:captured,name:file.name,size:file.size,mimeType:mime});check();let r;try{r=await fetch(d.uploadUrl,{method:'PUT',headers:{'Content-Type':mime},body:file});}catch(_){throw Error('No se pudo confirmar la subida.');}if(!r.ok)throw Error('Google no confirmó la subida.');},
 saveExpiry:async value=>{check();const session=await sb.auth.getSession(),r=await fetch('/api/crm-documents?action=expiry',{method:'POST',headers:{Authorization:'Bearer '+session.data?.session?.access_token,'Content-Type':'application/json'},body:JSON.stringify({...value,contactId:target,confirmed:true,expectedData:snapshot})}),d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'No se pudo guardar la caducidad.');if(current()?.id===target){current().data.TPF_DNI_EXPIRY=d.expiry;showExpiry();}},
 refresh:()=>{if(id===target)loadFiles(false);}
 });
}

async function run(fn){if(busy)return;const runEpoch=epoch;busy=true;host.setAttribute('aria-busy','true');const buttons=[...host.querySelectorAll('button')].map(b=>[b,b.disabled]);buttons.forEach(([b])=>b.disabled=true);try{await fn();}catch(e){if(runEpoch===epoch)message(e.message);}finally{busy=false;host.removeAttribute('aria-busy');buttons.forEach(([b,disabled])=>{if(b.isConnected)b.disabled=disabled;});}}
async function loadFiles(more){const e=epoch;await run(async()=>{message('Cargando archivos…');const d=await call('list',more?{page:next}:{});if(e!==epoch)return;folder=d.folder;files=more?files.concat(d.files):d.files;next=d.nextPageToken||'';render();});}
function choose(){
 const box=host.querySelector('[data-doc-picker]');box.hidden=false;
 box.innerHTML='<label>Buscar por nombre del contacto o titular<input data-doc-query type="search" placeholder="Nombre de la carpeta"></label><button type="button" data-doc-search>Buscar carpetas</button><div data-doc-results></div><label>O pega el enlace o identificador de la carpeta<input data-doc-id placeholder="https://drive.google.com/drive/folders/…"></label><label class="tpfDocsConfirm"><input type="checkbox" data-doc-confirm> Confirmo que esta carpeta corresponde a '+esc(name())+'.</label><button type="button" data-doc-link>Guardar vinculación</button><button type="button" data-doc-cancel>Cancelar</button><p class="small">Cambiar la vinculación no mueve ni elimina archivos de la carpeta anterior.</p>';
 const input=box.querySelector('[data-doc-query]');input.value=name();
 box.querySelector('[data-doc-cancel]').onclick=()=>{box.hidden=true;};
 box.querySelector('[data-doc-search]').onclick=()=>run(async()=>{const e=epoch;message('Buscando carpetas…');const d=await call('search',{q:input.value});if(e!==epoch)return;const results=box.querySelector('[data-doc-results]');results.replaceChildren();(d.files||[]).forEach(f=>{const b=document.createElement('button');b.type='button';b.textContent=f.name;b.onclick=()=>{box.querySelector('[data-doc-id]').value=f.id;box.querySelector('[data-doc-confirm]').checked=false;message('Carpeta elegida: '+f.name+'. Confirma la relación antes de guardar.');};results.appendChild(b);});message(d.files?.length?(d.nextPageToken?'Hay más resultados. Afina el nombre si no ves la carpeta.':'Elige la carpeta correcta.'):'No se encontraron carpetas. Prueba con parte del nombre o pega su enlace.');});
 box.querySelector('[data-doc-link]').onclick=()=>run(async()=>{if(!box.querySelector('[data-doc-confirm]').checked)throw Error('Confirma que la carpeta corresponde a este cliente.');const e=epoch,target=id,d=await call('link',{folderId:box.querySelector('[data-doc-id]').value,confirmed:true,expectedLink:link});if(e!==epoch)return;link=d.link;folder=null;files=[];next='';if(current()?.id===target)current().data.TPF_DOCUMENTS=link;render();message('Carpeta vinculada. Pulsa Actualizar archivos para consultar su contenido.');});
}
async function upload(selected){if(!selected.length)return;if(selected.every(f=>/^image\//.test(f.type)||/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name))){scanDocument(selected);return;}const e=epoch,target=id,captured=link;await run(async()=>{let count=0;for(const file of selected){if(e!==epoch)break;message('Subiendo '+file.name+'…');const ext=file.name.split('.').pop().toLowerCase(),mime=file.type||({pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',heif:'image/heif'}[ext]||'');const d=await call('upload',{expectedLink:captured,name:file.name,size:file.size,mimeType:mime});if(e!==epoch)break;let r;try{r=await fetch(d.uploadUrl,{method:'PUT',headers:{'Content-Type':mime},body:file});}catch(_){throw Error('No se pudo confirmar la subida de '+file.name+'. Actualiza los archivos antes de repetirla.');}if(!r.ok)throw Error('Google no confirmó la subida de '+file.name+'. Actualiza los archivos antes de repetirla.');count++;}if(e===epoch&&target===id)message(count+' archivo(s) subido(s). Pulsa Actualizar archivos para verlos.');});}
async function refresh(){showExpiry();const contact=current();if(!contact?.id)return;const e=++epoch;id=contact.id;link=contact.data?.TPF_DOCUMENTS||null;status=null;files=[];folder=null;next='';render();message('Comprobando conexión…');try{const d=await call('status');if(e!==epoch)return;status=d;render();if(link&&status.connected&&!busy)await loadFiles(false);}catch(error){if(e===epoch)message(error.message);}}
const css=document.createElement('style');css.textContent='#cpDocumentsPending [data-doc-picker]{padding:16px;background:#f6f8fc;border:1px solid #e3e8f0;border-radius:10px;margin:12px 0}#cpDocumentsPending [data-doc-picker] label{display:block;margin:12px 0}#cpDocumentsPending input:not([type=checkbox]){width:100%;box-sizing:border-box}#cpDocumentsPending .tpfDocsConfirm{display:flex;gap:8px;align-items:center}#cpDocumentsPending input[type=checkbox]{width:auto!important;margin:0}#cpDocumentsPending [data-doc-results]{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}#cpDocumentsPending .tpfDocsFile{display:flex;gap:12px;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #e8edf4}#cpDocumentsPending .tpfDocsFile span{min-width:0;overflow-wrap:anywhere}#cpDocumentsPending .tpfDocsFile small{display:block;color:#667085}#cpDocumentsPending button:not(:disabled){cursor:pointer}#cpDocumentsPending a{color:#0b5bd3}#cpDocumentsPending [data-doc-message]{color:#344054;overflow-wrap:anywhere}';document.head.appendChild(css);
window.addEventListener('tpf:contact-open',refresh);window.addEventListener('tpf:contact-updated',refresh);
new MutationObserver(()=>{if(document.getElementById('contactModal').classList.contains('hidden'))epoch++;}).observe(document.getElementById('contactModal'),{attributes:true,attributeFilter:['class']});
})();


