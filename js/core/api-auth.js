(function(){
'use strict';
if(window.TPFAPIAuth)return;
const protectedPaths=new Set(['/api/green','/api/green-reply','/api/green-file-safe','/api/green-status','/api/green-read-safe','/api/telegram']);
const original=window.fetch.bind(window);
window.fetch=async function(input,init){
 let url;try{url=new URL(typeof input==='string'?input:input.url,location.href)}catch(_){return original(input,init)}
 if(url.origin!==location.origin||!protectedPaths.has(url.pathname))return original(input,init);
 const headers=new Headers(init?.headers||(typeof input==='object'?input.headers:undefined));
 if(!headers.has('Authorization')){
  let client;try{client=typeof sb!=='undefined'?sb:window.sb}catch(_){client=window.sb}
  const result=await client?.auth?.getSession(),token=result?.data?.session?.access_token;
  if(token)headers.set('Authorization','Bearer '+token);
 }
 return original(input,{...init,headers});
};
async function download(url,name){
 const target=new URL(url,location.href);
 if(target.origin!==location.origin||target.pathname!=='/api/green')throw Error('Descarga no válida.');
 const response=await window.fetch(url,{cache:'no-store'});
 if(!response.ok)throw Error('No se pudo descargar el archivo. Comprueba la sesión e inténtalo de nuevo.');
 const blob=await response.blob();if(!blob.size)throw Error('El archivo recibido está vacío.');
 const objectUrl=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=objectUrl;link.download=name||'archivo';document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
}
window.TPFAPIAuth={download};
})();
