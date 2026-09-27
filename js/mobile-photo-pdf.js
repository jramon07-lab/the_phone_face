(function(){
'use strict';
async function imageOf(file){
 if(typeof createImageBitmap==='function'){try{return await createImageBitmap(file,{imageOrientation:'from-image'});}catch(_) {}}
 const url=URL.createObjectURL(file);try{return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('No se pudo abrir '+file.name+'. Prueba con una foto JPEG o PNG.'));img.src=url;});}finally{URL.revokeObjectURL(url);}
}
async function build(files,name,{check=()=>{},progress=()=>{}}={}){
 if(!files.length||files.length>12)throw Error('Elige entre 1 y 12 fotos para el PDF.');
 if(files.some(f=>!f.size||f.size>30*1024*1024))throw Error('Cada foto debe ocupar entre 1 byte y 30 MB.');
 name=String(name||'').trim().replace(/\.pdf$/i,'');if(!name||name.length>190||/[\x00-\x1f/\\]/.test(name))throw Error('Escribe un nombre válido para el PDF.');
 const pages=[];
 for(let i=0;i<files.length;i++){
  check();progress('Preparando página '+(i+1)+' de '+files.length+'…');
  const img=await imageOf(files[i]);let canvas;
  try{
   check();const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;if(!w||!h)throw Error('La foto no tiene dimensiones válidas.');
   const ratio=Math.min(1,2000/Math.max(w,h));canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*ratio));canvas.height=Math.max(1,Math.round(h*ratio));
   const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));if(!blob)throw Error('No se pudo preparar la foto.');
   pages.push({width:canvas.width,height:canvas.height,bytes:new Uint8Array(await blob.arrayBuffer())});
  }finally{img.close?.();if(canvas){canvas.width=1;canvas.height=1;}}
 }
 check();const pdf=window.TPFDocumentScanCore.pdf(pages);return new File([pdf],name+'.pdf',{type:'application/pdf'});
}
window.TPFMobilePhotoPDF={build};
})();
