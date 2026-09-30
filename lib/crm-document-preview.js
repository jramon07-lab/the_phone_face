'use strict';
// Keep the JSON/base64 response below the platform's response-size limit.
const MAX_BYTES=3*1024*1024;
const TYPES=new Set(['application/pdf','image/jpeg','image/png','image/webp']);
module.exports=async function({fileId,link,t,drive,request,fail}){
 const f=await drive(t,'files/'+fileId+'?supportsAllDrives=true&fields=id,name,mimeType,size,parents,trashed,capabilities(canDownload)');
 if(f.trashed||!f.parents?.includes(link.folder_id))throw fail(403,'El archivo no pertenece a esta ficha.');
 if(f.capabilities?.canDownload!==true)throw fail(403,'Google no permite descargar este archivo.');
 if(!TYPES.has(f.mimeType))return {ok:true,external:true,reason:'Este formato se abre desde «Abrir en Drive».'};
 if(Number(f.size)>MAX_BYTES)return {ok:true,external:true,reason:'Este archivo supera los 3 MB de vista previa. Ábrelo en Drive.'};
 const r=await request('https://www.googleapis.com/drive/v3/files/'+fileId+'?alt=media&supportsAllDrives=true',{headers:{Authorization:'Bearer '+t},redirect:'error'});
 if(!r.ok)throw fail(502,'No se pudo cargar el archivo de Google Drive. Vuelve a intentarlo.');
 if(Number(r.headers.get('content-length'))>MAX_BYTES){await r.body?.cancel();return {ok:true,external:true,reason:'Este archivo supera los 3 MB de vista previa. Ábrelo en Drive.'};}
 const reader=r.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES){await reader.cancel();return {ok:true,external:true,reason:'Este archivo supera los 3 MB de vista previa. Ábrelo en Drive.'};}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
 return {ok:true,mimeType:f.mimeType,base64:Buffer.concat(chunks).toString('base64')};
};
