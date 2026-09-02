(function(){
  'use strict';
  const ASSET_ROOT='/ocr-assets/tesseract-5.1.1';
  const SCRIPT=`${ASSET_ROOT}/tesseract.min.js`;
  const ENGINE_OPTIONS=Object.freeze({
    workerPath:`${ASSET_ROOT}/worker.min.js`,
    corePath:`${ASSET_ROOT}/tesseract-core-lstm.wasm.js`,
    langPath:ASSET_ROOT,
    workerBlobURL:false
  });
  let loader=null;

  function load(){
    if(window.Tesseract)return Promise.resolve(window.Tesseract);
    if(loader)return loader;
    loader=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=SCRIPT;script.async=true;script.crossOrigin='anonymous';
      script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error('No se pudo iniciar el lector.'));
      script.onerror=()=>reject(new Error('No se pudo descargar el lector del documento.'));
      document.head.appendChild(script);
    }).catch(error=>{loader=null;throw error;});
    return loader;
  }

  function report(onProgress,status,progress){
    if(typeof onProgress==='function')onProgress({status,progress:Number(progress||0)});
  }
  function decodeImage(file){
    if(typeof createImageBitmap==='function'){
      return (async()=>{
        try{
          let bitmap;
          try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}
          catch(_){bitmap=await createImageBitmap(file);}
          if(bitmap.width&&bitmap.height){
            return {source:bitmap,width:bitmap.width,height:bitmap.height,release:()=>bitmap.close?.()};
          }
          bitmap.close?.();
        }catch(_){/* Safari antiguo o HEIC: se prueba con Image. */}
        return decodeImageWithElement(file);
      })();
    }
    return decodeImageWithElement(file);
  }
  function decodeImageWithElement(file){
    const url=URL.createObjectURL(file);
    return new Promise((resolve,reject)=>{
      const image=new Image();
      image.decoding='async';
      image.style.imageOrientation='from-image';
      image.onload=()=>{
        if(!image.naturalWidth||!image.naturalHeight){
          URL.revokeObjectURL(url);
          reject(new Error('La imagen no tiene dimensiones válidas.'));
          return;
        }
        resolve({source:image,width:image.naturalWidth,height:image.naturalHeight,release:()=>URL.revokeObjectURL(url)});
      };
      image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('El iPhone no pudo decodificar esta foto.'));};
      image.src=url;
    });
  }
  function canvasJpeg(canvas,quality){
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>{
      if(blob)resolve(blob);else reject(new Error('No se pudo convertir la foto a JPEG.'));
    },'image/jpeg',quality));
  }
  async function prepareImageForOcr(file,onProgress){
    if(!file||typeof file.size!=='number')throw new Error('Selecciona una imagen válida.');
    if(file.type&&!String(file.type).toLowerCase().startsWith('image/'))throw new Error('El archivo seleccionado no es una imagen.');
    report(onProgress,'preparing image',0.03);
    let decoded,canvas;
    try{
      decoded=await decodeImage(file);
      const maxSide=1800;
      const scale=Math.min(1,maxSide/Math.max(decoded.width,decoded.height));
      const width=Math.max(1,Math.round(decoded.width*scale));
      const height=Math.max(1,Math.round(decoded.height*scale));
      canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const context=canvas.getContext('2d',{alpha:false});
      if(!context)throw new Error('El navegador no pudo preparar la foto.');
      context.fillStyle='#fff';context.fillRect(0,0,width,height);
      context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
      context.drawImage(decoded.source,0,0,width,height);
      const jpeg=await canvasJpeg(canvas,.9);
      report(onProgress,'image prepared',0.08);
      if(typeof File==='function'){
        const base=String(file.name||'captura').replace(/\.[^.]+$/,'');
        return new File([jpeg],`${base}.jpg`,{type:'image/jpeg',lastModified:file.lastModified||Date.now()});
      }
      return jpeg;
    }finally{
      decoded?.release?.();
      if(canvas){canvas.width=1;canvas.height=1;}
    }
  }

  function tidy(value){return String(value||'').replace(/[|]/g,'I').replace(/\s+/g,' ').trim();}
  function fold(value){return tidy(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();}
  function normalizePhone(value){
    const digits=String(value||'').replace(/\D/g,'');
    if(/^34[6789]\d{8}$/.test(digits))return digits.slice(2);
    return /^[6789]\d{8}$/.test(digits)?digits:'';
  }
  const DNI_LETTERS='TRWAGMYFPDXBNJZSQVHLCKE';
  function expectedDniLetter(digits){
    return /^\d{8}$/.test(digits)?DNI_LETTERS[Number(digits)%23]:'';
  }
  function expectedNieLetter(prefix,digits){
    const first={X:'0',Y:'1',Z:'2'}[prefix];
    return first&&/^\d{7}$/.test(digits)?DNI_LETTERS[Number(first+digits)%23]:'';
  }
  function validDni(candidate){
    const value=String(candidate||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(/^[XYZ]\d{7}[A-Z]$/.test(value)){
      return value.at(-1)===expectedNieLetter(value[0],value.slice(1,8))?value:'';
    }
    if(/^\d{8}[A-Z]$/.test(value)){
      return value.at(-1)===expectedDniLetter(value.slice(0,8))?value:'';
    }
    if(/^[ABCDEFGHJNPQRSUVW]\d{7}[A-Z0-9]$/.test(value))return value;

    if(/^\d{8}$/.test(value))return value+expectedDniLetter(value);
    // El modelo español suele leer la S final del DNI como 5 u 8.
    if(/^\d{8}[58]$/.test(value)){
      const digits=value.slice(0,8),letter=expectedDniLetter(digits);
      return letter==='S'?digits+letter:'';
    }
    return '';
  }
  const FIELD_LABEL=/\b(?:DOCUMENTO|DNI|NIF|MSISDN|MSIDN|FIJO|MOVIL|TELEFONO|CRITERIO)\b/i;
  const NAME_BLOCKED=/\b(?:MYCRM|BUSQUEDA|BUSCAR|CRITERIO|DOCUMENTO|DNI|NIF|MSISDN|MSIDN|FIJO|MOVIL|TELEFONO|CLIENTE|MULTIMARCA|FECHA|DIRECCION|NACIMIENTO|NACIONALIDAD|DATOS|COMPARTIDOS|SUSCRIPCION|DISPOSITIVO|SINFIN|ILIMITADOS|CONV|GB)\b/i;
  const NAME_START=/\b(?:BUSQUEDA|BUSCAR)\b/i;
  const NAME_END=/\b(?:DATOS\s+COMPARTIDOS|SUSCRIPCION|DISPOSITIVO)\b/i;

  function lineDni(line){
    const compact=fold(line).replace(/[^A-Z0-9]/g,'');
    return validDni(compact);
  }
  function linePhone(line){
    return normalizePhone(line);
  }
  function valueAfterLabel(lines,label,valueFromLine){
    for(let index=0;index<lines.length;index+=1){
      const current=fold(lines[index]);
      if(!label.test(current))continue;
      const inline=valueFromLine(current.replace(new RegExp(label.source,'ig'),''));
      if(inline)return inline;
      for(let offset=1;offset<=2&&index+offset<lines.length;offset+=1){
        const next=lines[index+offset];
        if(FIELD_LABEL.test(fold(next)))break;
        const value=valueFromLine(next);
        if(value)return value;
      }
    }
    return '';
  }
  function cleanNameLine(line){
    const words=tidy(line).match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:['-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*/g)||[];
    return words.filter(word=>word.length>=2).join(' ');
  }
  function plausibleName(line){
    const value=cleanNameLine(line);
    const folded=fold(value);
    if(!value||NAME_BLOCKED.test(folded)||/\d/.test(value))return false;
    if(!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/.test(value))return false;
    const words=value.split(/\s+/).filter(Boolean);
    if(words.length<2||words.length>5||words.join('').length<6)return false;
    const letters=value.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g)||[];
    const upper=value.match(/[A-ZÁÉÍÓÚÜÑ]/g)||[];
    return upper.length/Math.max(letters.length,1)>=0.65;
  }
  function nameFromLines(lines){
    const clean=lines.map(tidy);
    const anchors=clean.map((line,index)=>NAME_START.test(fold(line))?index:-1).filter(index=>index>=0);
    for(let anchor=anchors.length-1;anchor>=0;anchor-=1){
      const index=anchors[anchor];
      for(let offset=1;offset<=12&&index+offset<clean.length;offset+=1){
        const candidate=cleanNameLine(clean[index+offset]);
        if(NAME_END.test(fold(candidate)))break;
        if(plausibleName(candidate))return candidate;
      }
    }
    return '';
  }
  function splitName(full){
    const words=tidy(full).split(' ').filter(Boolean);
    if(words.length<2)return {first:words[0]||'',last:''};
    return {first:words.shift(),last:words.join(' ')};
  }
  function extract(text){
    const raw=String(text||'');
    const lines=raw.split(/\r?\n/);
    const dni=valueAfterLabel(lines,/\b(?:DOCUMENTO|DNI|NIF)\b/i,lineDni);
    const phone=valueAfterLabel(lines,/\b(?:MSISDN|MSIDN|FIJO|MOVIL|TELEFONO)\b/i,linePhone);
    const fullName=nameFromLines(lines);
    return {dni,phone,fullName,...splitName(fullName),rawText:raw};
  }

  async function recognize(file,onProgress){
    let phase='image';
    let worker=null;
    let engineError='';
    try{
      const input=await prepareImageForOcr(file,onProgress);
      phase='reader';report(onProgress,'loading reader',0.1);
      const api=await load();
      phase='recognition';
      worker=await api.createWorker('spa',api.OEM?.LSTM_ONLY||1,{
        ...ENGINE_OPTIONS,
        logger:event=>{if(event?.status)report(onProgress,event.status,event.progress);},
        errorHandler:error=>{engineError=String(error?.message||error||'').trim();}
      });
      const result=await worker.recognize(input,{}, {text:true,blocks:false,hocr:false,tsv:false});
      return extract(result?.data?.text||'');
    }catch(error){
      const message=String(error?.message||engineError||(typeof error==='string'?error:'')).trim();
      console.warn('[TPF OCR]',phase,message);
      if(phase==='image')throw new Error(message||'El iPhone no pudo preparar esta foto.');
      if(phase==='reader')throw new Error('No se pudo iniciar el lector en el iPhone. Pulsa «Detectar datos» para reintentar.');
      throw new Error('No se pudo completar la lectura en el iPhone. Pulsa «Detectar datos» para reintentar.');
    }finally{
      if(worker)await worker.terminate().catch(()=>{});
    }
  }

  window.TPFMobileOCR={recognize,extract,prepareImageForOcr};
  if(document.documentElement)document.documentElement.dataset.ocrReady='tesseract-5.1.1-iphone';
})();
