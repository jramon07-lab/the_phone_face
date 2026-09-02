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
  function recoverSingleDniVariant(value,strict){
    if(!/^[0-9][A-Z0-9]{7,8}$/.test(value))return '';
    if(strict&&value.length!==9)return '';
    if(/^[6789]\d{8}$/.test(value))return '';
    const body=value.slice(0,8);
    if((body.match(/\d/g)||[]).length<5)return '';
    const digitMap={O:'0',I:'1',L:'1',Z:'2',G:'6',B:'8'};
    const digits=body.replace(/[OILZGB]/g,letter=>digitMap[letter]);
    if(!/^\d{8}$/.test(digits))return '';
    // No conviertas un teléfono español en DNI cuando su último dígito
    // llegue como un carácter parecido (por ejemplo, 600000008 -> 60000000B).
    if(/^[6789]/.test(digits)&&(value.length===8||/[0-9OILZGB]/.test(value[8]||'')))return '';
    const expected=expectedDniLetter(digits);
    if(value.length===8)return strict?'':digits+expected;
    const lookalikes={S:'S58B',B:'B8',Z:'Z2',G:'G6',L:'L1I'}[expected]||expected;
    return lookalikes.includes(value[8])?digits+expected:'';
  }
  function recoverDniFromOcr(candidate,strict){
    const value=String(candidate||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    const variants=[value];
    if(value.length===10){
      const body=value.slice(0,8),tail=value.slice(8);
      // En iPhone el último glifo puede duplicarse: S -> 58, 8S, SS o 88.
      if([...tail].every(char=>'S58B'.includes(char))){
        variants.push(body+tail[0],body+tail.at(-1));
      }
      // Tolera una sola duplicación adyacente dentro del cuerpo OCR.
      for(let index=1;index<value.length;index+=1){
        if(value[index]===value[index-1])variants.push(value.slice(0,index)+value.slice(index+1));
      }
    }
    const recovered=new Set(variants.map(item=>recoverSingleDniVariant(item,strict)).filter(Boolean));
    return recovered.size===1?[...recovered][0]:'';
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
    return '';
  }
  const DOCUMENT_LABEL=/\b(?:DOCUMENT[OEA0]|D0CUMENT0|DOCURNENTO|DOCUNIENTO|DNI|NIF)\b/i;
  const DOCUMENT_HINT=/\b(?:DNI|NIF|D[O0]C[A-Z0-9]{4,10})\b/i;
  const PHONE_LABEL=/\b(?:MSISDN|MSIDN|FIJO|MOVIL|TELEFONO)\b/i;
  const FIELD_LABEL=/\b(?:DOCUMENT[OEA0]|D0CUMENT0|DOCURNENTO|DOCUNIENTO|DNI|NIF|MSISDN|MSIDN|FIJO|MOVIL|TELEFONO|CRITERIO)\b/i;
  const NAME_BLOCKED=/\b(?:MYCRM|BUSQUEDA|BUSCAR|CRITERIO|DOCUMENTO|DNI|NIF|MSISDN|MSIDN|FIJO|MOVIL|TELEFONO|CLIENTE|MULTIMARCA|FECHA|DIRECCION|NACIMIENTO|NACIONALIDAD|DATOS|COMPARTIDOS|SUSCRIPCION|DISPOSITIVO|SINFIN|ILIMITADOS|CONV|GB)\b/i;
  const NAME_START=/\b(?:BUSQUEDA|BUSCAR)\b/i;
  const NAME_END=/\b(?:DATOS\s+COMPARTIDOS|SUSCRIPCION|DISPOSITIVO)\b/i;

  function dniFromFragment(fragment,strict){
    const withoutLabel=fold(fragment).replace(new RegExp(DOCUMENT_LABEL.source,'ig'),' ');
    const compact=withoutLabel.replace(/[^A-Z0-9]/g,'');
    const direct=validDni(compact)||recoverDniFromOcr(compact,strict);
    if(direct)return direct;
    const tokens=withoutLabel.match(/[A-Z0-9]+/g)||[];
    for(const token of tokens){
      const dni=validDni(token)||recoverDniFromOcr(token,strict);
      if(dni)return dni;
    }
    return '';
  }
  function lineDni(line){
    return dniFromFragment(line);
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
      let useful=0;
      for(let offset=1;offset<=5&&index+offset<lines.length;offset+=1){
        const next=lines[index+offset];
        if(!tidy(next))continue;
        if(FIELD_LABEL.test(fold(next)))break;
        useful+=1;
        const value=valueFromLine(next);
        if(value)return value;
        if(useful>=2)break;
      }
    }
    return '';
  }
  function dniBeforePhoneLabel(lines){
    for(let index=0;index<lines.length;index+=1){
      const current=fold(lines[index]);
      const phoneMatch=current.match(PHONE_LABEL);
      if(!phoneMatch)continue;
      const probes=[current.slice(0,phoneMatch.index)];
      let hasDocumentHint=DOCUMENT_HINT.test(current.slice(0,phoneMatch.index));
      let useful=0;
      for(let offset=1;offset<=5&&index-offset>=0;offset+=1){
        const previous=lines[index-offset];
        if(!tidy(previous))continue;
        if(PHONE_LABEL.test(fold(previous)))break;
        useful+=1;
        probes.push(previous);
        if(DOCUMENT_HINT.test(fold(previous))){hasDocumentHint=true;break;}
        if(useful>=3)break;
      }
      if(!hasDocumentHint)continue;
      for(const probe of probes){
        const value=dniFromFragment(probe,true);
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
    const dni=valueAfterLabel(lines,DOCUMENT_LABEL,lineDni)||dniBeforePhoneLabel(lines);
    const phone=valueAfterLabel(lines,PHONE_LABEL,linePhone);
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
      await worker.setParameters({tessedit_pageseg_mode:api.PSM?.SINGLE_BLOCK||'6'});
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
