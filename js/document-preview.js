(function(){
'use strict';
window.TPFDocumentPreview={async mount({host,dialog,client,contactId,file,isCurrent=()=>true}){
 let url='',closed=false;const controller=new AbortController();
 const dispose=()=>{closed=true;controller.abort();if(url){URL.revokeObjectURL(url);url='';}};
 dialog.addEventListener('close',dispose,{once:true});
 const live=()=>!closed&&host.isConnected&&isCurrent();
 const renderError=text=>{if(!live())return;host.replaceChildren();const p=document.createElement('p');p.textContent=text;host.append(p);const retry=document.createElement('button');retry.type='button';retry.textContent='Reintentar vista previa';retry.onclick=()=>{dispose();window.TPFDocumentPreview.mount({host,dialog,client,contactId,file,isCurrent});};host.append(retry);};
 host.setAttribute('role','status');host.textContent='Cargando vista previa…';
 const timer=setTimeout(()=>controller.abort(),30000);
 try{
  const session=await client.auth.getSession();if(!live())return;
  const token=session.data?.session?.access_token;if(!token)throw Error('Inicia sesión de nuevo en el CRM.');
  const q=new URLSearchParams({action:'preview',contactId,fileId:file.id});
  const response=await fetch('/api/crm-documents?'+q,{headers:{Authorization:'Bearer '+token},signal:controller.signal});
  const data=await response.json();if(!live())return;
  if(!response.ok||!data.ok)throw Error(data.error||'No se pudo cargar la vista previa.');
  if(data.external){host.textContent=data.reason;return;}
  if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(data.mimeType)||typeof data.base64!=='string'||data.base64.length>4194304)throw Error('Formato de vista previa no válido.');
  const bytes=Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0));
  url=URL.createObjectURL(new Blob([bytes],{type:data.mimeType}));
  const media=document.createElement(data.mimeType==='application/pdf'?'iframe':'img');
  media.title='Vista previa de '+file.name;if(media.tagName==='IMG')media.alt=file.name;
  media.style.cssText='display:block;width:100%;height:65vh;object-fit:contain;border:0;background:#f7f8fa';
  media.src=url;media.onerror=()=>renderError('No se pudo mostrar el archivo. Puedes abrirlo en Drive.');
  host.removeAttribute('role');host.replaceChildren(media);
 }catch(error){if(live())renderError(error.name==='AbortError'?'La vista previa ha tardado demasiado. Puedes reintentar o abrir en Drive.':error.message);}
 finally{clearTimeout(timer);}
}};
})();
