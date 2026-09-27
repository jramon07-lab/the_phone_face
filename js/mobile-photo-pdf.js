(function(){
'use strict';
async function decodeImage(file){
 if(typeof createImageBitmap==='function'){try{return await createImageBitmap(file,{imageOrientation:'from-image'});}catch(_) {}}
 const url=URL.createObjectURL(file);try{return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('No se pudo abrir '+file.name+'. Prueba con una foto JPEG o PNG.'));img.src=url;});}finally{URL.revokeObjectURL(url);}
}
async function imageOf(file){
 if(!window.TPFMobileDNG?.isDNG(file))return {image:await decodeImage(file),orientation:1};
 const candidates=await window.TPFMobileDNG.previews(file);
 for(const candidate of candidates){try{return {image:await decodeImage(candidate.blob),orientation:candidate.orientation};}catch(_) {}}
 throw Error('Este RAW no contiene una previsualización que se pueda convertir aquí. Puedes guardar el DNG original.');
}
async function renderPhoto(file,check,rotation=0,maxEdge=2000){
  const decoded=await imageOf(file),img=decoded.image,o=decoded.orientation;let canvas;
  try{
   check();const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;if(!w||!h)throw Error('La foto no tiene dimensiones válidas.');
   const ratio=Math.min(1,maxEdge/Math.max(w,h)),dw=Math.max(1,Math.round(w*ratio)),dh=Math.max(1,Math.round(h*ratio)),swap=o>=5&&o<=8;canvas=document.createElement('canvas');const bw=swap?dh:dw,bh=swap?dw:dh,turn=((rotation%4)+4)%4;canvas.width=turn%2?bh:bw;canvas.height=turn%2?bw:bh;
   const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);const turns={1:[0,1,-1,0,bh,0],2:[-1,0,0,-1,bw,bh],3:[0,-1,1,0,0,bw]};if(turns[turn])ctx.transform(...turns[turn]);const transforms={2:[-1,0,0,1,dw,0],3:[-1,0,0,-1,dw,dh],4:[1,0,0,-1,0,dh],5:[0,1,1,0,0,0],6:[0,1,-1,0,dh,0],7:[0,-1,-1,0,dh,dw],8:[0,-1,1,0,0,dw]};if(transforms[o])ctx.transform(...transforms[o]);ctx.drawImage(img,0,0,dw,dh);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.78));if(!blob)throw Error('No se pudo preparar la foto.');
   check();return {width:canvas.width,height:canvas.height,blob};
  }finally{img.close?.();if(canvas){canvas.width=1;canvas.height=1;}}
}
async function optimize(file,{check=()=>{},rotation=0}={}){
 check();if(!file.size||file.size>100*1024*1024)throw Error('Cada foto debe ocupar entre 1 byte y 100 MB.');
 // Small JPEGs need no decoding or re-encoding.
 const jpeg=/^image\/(jpeg|jpg|pjpeg)$/i.test(file.type||'')||/\.jpe?g$/i.test(file.name||'');
 if(!rotation&&jpeg&&file.size<=1024*1024)return file;
 const page=await renderPhoto(file,check,rotation);check();
 if(!rotation&&jpeg&&page.blob.size>=file.size)return file;
 const name=(String(file.name||'Foto').replace(/\.[^.]+$/,'').replace(/[\x00-\x1f/\\]/g,'_').slice(0,180)||'Foto')+'.jpg';
 return new File([page.blob],name,{type:'image/jpeg'});
}
async function build(files,name,{check=()=>{},progress=()=>{},rotations=[]}={}){
 if(!files.length||files.length>12)throw Error('Elige entre 1 y 12 fotos para el PDF.');
 if(files.some(f=>!f.size||f.size>100*1024*1024))throw Error('Cada foto debe ocupar entre 1 byte y 100 MB.');
 name=String(name||'').trim().replace(/\.pdf$/i,'');if(!name||name.length>190||/[\x00-\x1f/\\]/.test(name))throw Error('Escribe un nombre válido para el PDF.');
 const pages=[];
 for(let i=0;i<files.length;i++){
  check();progress('Preparando página '+(i+1)+' de '+files.length+'…');
  const page=await renderPhoto(files[i],check,rotations[i]||0);pages.push({width:page.width,height:page.height,bytes:new Uint8Array(await page.blob.arrayBuffer())});
 }
 check();const pdf=window.TPFDocumentScanCore.pdf(pages);return new File([pdf],name+'.pdf',{type:'application/pdf'});
}
async function preview(file){return (await renderPhoto(file,()=>{},0,320)).blob;}
window.TPFMobilePhotoPDF={build,optimize,preview};
})();
