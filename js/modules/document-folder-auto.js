(function(){
'use strict';
let choosing=false;
function choose(candidates,name){
 if(choosing)return Promise.reject(Error('Termina primero la selección de carpeta que está abierta.'));
 choosing=true;
 return new Promise((resolve,reject)=>{
  const dialog=document.createElement('dialog');dialog.className='tpfAutoFolderDialog';dialog.setAttribute('aria-label','Elegir carpeta del cliente');
  const heading=document.createElement('h2');heading.textContent='Hay varias carpetas de '+name;
  const description=document.createElement('p');description.textContent='Elige la correcta. No se creará otra carpeta ni se moverán archivos.';
  dialog.append(heading,description);
  const finish=(id,error)=>{choosing=false;dialog.close();dialog.remove();error?reject(error):resolve(id);};
  for(const candidate of candidates){
   const row=document.createElement('div');row.className='tpfAutoFolderCandidate';
   const label=document.createElement('strong');label.textContent=candidate.name;
   const info=document.createElement('small');info.textContent='Identificador: '+candidate.id;
   const open=document.createElement('a');open.textContent='Abrir en Drive ↗';open.href='https://drive.google.com/drive/folders/'+encodeURIComponent(candidate.id);open.target='_blank';open.rel='noopener noreferrer';
   const select=document.createElement('button');select.type='button';select.textContent='Usar esta carpeta';select.onclick=()=>finish(candidate.id);
   row.append(label,info,open,select);dialog.append(row);
  }
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancelar';cancel.onclick=()=>finish(null,Error('Selección cancelada. No se ha guardado el archivo.'));dialog.append(cancel);
  dialog.addEventListener('cancel',event=>{event.preventDefault();cancel.click();});document.body.append(dialog);dialog.showModal();
 });
}
async function ensure({contactId,data,check=()=>{},notice=()=>{}}){
 if(!contactId)throw Error('Vincula primero este chat a una ficha de cliente.');
 const snapshot=JSON.parse(JSON.stringify(data||{}));
 const call=async folderId=>{
  check();const session=await sb.auth.getSession(),token=session.data?.session?.access_token;check();
  if(!token)throw Error('Inicia sesión de nuevo.');
  const r=await fetch('/api/crm-documents?action=ensureFolder',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({contactId,expectedData:snapshot,confirmed:true,...(folderId?{folderId}:{})})});
  const result=await r.json();check();if(!r.ok||!result.ok)throw Error(result.error||'No se pudo preparar la carpeta del cliente.');return result;
 };
 notice('Buscando o preparando la carpeta en 01 Clientes…');
 let result=await call();
 if(result.needsChoice){
  if(!Array.isArray(result.candidates)||!result.candidates.length)throw Error('No se pudieron obtener las coincidencias.');
  const id=await choose(result.candidates,result.contactName||'este cliente');check();result=await call(id);
 }
 if(result.needsChoice||!result.link?.folder_id||!result.data||!result.folder)throw Error('La carpeta no quedó preparada. Actualiza la ficha.');
 notice(result.created?'Carpeta creada y vinculada: '+result.link.folder_name:'Carpeta vinculada: '+result.link.folder_name);
 return result;
}
const style=document.createElement('style');style.textContent='.tpfAutoFolderDialog{width:min(560px,90vw);max-height:85dvh;overflow:auto;padding:24px;border:1px solid #d0d8e5;border-radius:14px;background:#fff;color:#17243c;box-shadow:0 20px 80px #15294c33}.tpfAutoFolderDialog::backdrop{background:#12213b80}.tpfAutoFolderCandidate{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:14px 0;border-top:1px solid #e4e8f0}.tpfAutoFolderCandidate strong,.tpfAutoFolderCandidate small{width:100%;overflow-wrap:anywhere}.tpfAutoFolderCandidate a{color:#0b5bd3}.tpfAutoFolderDialog button{padding:9px 12px;cursor:pointer;border:1px solid #cbd5e1;border-radius:8px;background:#f7f9fc;color:#17243c}';document.head.append(style);
window.TPFDocumentFolderAuto={ensure};
})();
