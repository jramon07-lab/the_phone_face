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
  function jpegInput(blob,file,suffix){
    if(typeof File!=='function')return blob;
    const base=String(file.name||'captura').replace(/\.[^.]+$/,'');
    return new File([blob],`${base}${suffix||''}.jpg`,{type:'image/jpeg',lastModified:file.lastModified||Date.now()});
  }
  function ratioRect(width,height,leftRatio,topRatio,widthRatio,heightRatio){
    const left=Math.max(0,Math.min(width-1,Math.floor(width*leftRatio)));
    const top=Math.max(0,Math.min(height-1,Math.floor(height*topRatio)));
    const right=Math.max(left+1,Math.min(width,Math.ceil(width*(leftRatio+widthRatio))));
    const bottom=Math.max(top+1,Math.min(height,Math.ceil(height*(topRatio+heightRatio))));
    return {left,top,width:right-left,height:bottom-top};
  }
  async function prepareOcrSource(file,onProgress,withFormCrop){
    if(!file||typeof file.size!=='number')throw new Error('Selecciona una imagen válida.');
    if(file.type&&!String(file.type).toLowerCase().startsWith('image/'))throw new Error('El archivo seleccionado no es una imagen.');
    report(onProgress,'preparing image',0.03);
    let decoded,canvas,formCanvas;
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
      // Libera el lienzo grande antes de preparar el recorte: en iPhone evita
      // mantener dos superficies completas a la vez.
      canvas.width=1;canvas.height=1;

      let formInput=null;
      if(withFormCrop){
        try{
          const sourceRect=ratioRect(decoded.width,decoded.height,.02,.20,.87,.44);
          const formScale=Math.min(2,maxSide/Math.max(sourceRect.width,sourceRect.height));
          const formWidth=Math.max(1,Math.round(sourceRect.width*formScale));
          const formHeight=Math.max(1,Math.round(sourceRect.height*formScale));
          if(formWidth<200||formHeight<120)throw new Error('El recorte del documento es demasiado pequeño.');
          formCanvas=document.createElement('canvas');formCanvas.width=formWidth;formCanvas.height=formHeight;
          const formContext=formCanvas.getContext('2d',{alpha:false});
          if(!formContext)throw new Error('No se pudo crear el recorte del documento.');
          formContext.fillStyle='#fff';formContext.fillRect(0,0,formWidth,formHeight);
          formContext.imageSmoothingEnabled=true;formContext.imageSmoothingQuality='high';
          formContext.drawImage(decoded.source,sourceRect.left,sourceRect.top,sourceRect.width,sourceRect.height,0,0,formWidth,formHeight);
          const formJpeg=await canvasJpeg(formCanvas,.92);
          if(!formJpeg.size)throw new Error('El recorte del documento está vacío.');
          formInput=jpegInput(formJpeg,file,'-documento');
        }catch(cropError){
          // La lectura general sigue siendo válida si Safari no puede crear el
          // recorte; recognize() conserva un último fallback sobre toda la foto.
          console.warn('[TPF OCR] prepare document crop',String(cropError?.message||cropError||'').trim());
        }
      }
      report(onProgress,'image prepared',0.08);
      return {
        input:jpegInput(jpeg,file,''),
        formInput
      };
    }finally{
      decoded?.release?.();
      if(canvas){canvas.width=1;canvas.height=1;}
      if(formCanvas){formCanvas.width=1;formCanvas.height=1;}
    }
  }
  async function prepareImageForOcr(file,onProgress){
    return (await prepareOcrSource(file,onProgress,false)).input;
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
      // En iPhone el último glifo puede desdoblarse en dos lecturas distintas: S -> 58 u 8S.
      if(tail[0]!==tail[1]&&[...tail].every(char=>'S58B'.includes(char))){
        variants.push(body+tail[0],body+tail.at(-1));
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
  const DOCUMENT_LABEL=/\b(?:DOCUMENT[OEA0]|D0CUMENT0|DOCURNENTO|DOCUNIENTO|DOCURNENLO|DNI|NIF)\b/i;
  const DOCUMENT_HINT=DOCUMENT_LABEL;
  const PHONE_LABEL=/\b(?:MSISDN|MSIDN|FIJO|MOVIL|TELEFONO)\b/i;
  const FIELD_LABEL=/\b(?:DOCUMENT[OEA0]|D0CUMENT0|DOCURNENTO|DOCUNIENTO|DOCURNENLO|DNI|NIF|MSISDN|MSIDN|FIJO|MOVIL|TELEFONO|CRITERIO)\b/i;
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
  function personNameCase(value){
    return tidy(value).toLocaleLowerCase('es-ES').replace(/(^|[\s'-])([a-záéíóúüñ])/g,(_match,before,letter)=>before+letter.toLocaleUpperCase('es-ES'));
  }
  function extract(text){
    const raw=String(text||'');
    const lines=raw.split(/\r?\n/);
    const dni=valueAfterLabel(lines,DOCUMENT_LABEL,lineDni)||dniBeforePhoneLabel(lines);
    const phone=valueAfterLabel(lines,PHONE_LABEL,linePhone);
    const fullName=personNameCase(nameFromLines(lines));
    return {dni,phone,fullName,...splitName(fullName),rawText:raw};
  }
  function mergeResults(primary,supplement){
    const fullName=primary.fullName||supplement.fullName;
    return {
      dni:primary.dni||supplement.dni,
      phone:primary.phone||supplement.phone,
      fullName,
      ...splitName(fullName),
      rawText:`LECTURA GENERAL\n${primary.rawText||''}\n\nLECTURA ZONA DOCUMENTO\n${supplement.rawText||''}`
    };
  }

  async function recognize(file,onProgress){
    let phase='image';
    let worker=null;
    let engineError='';
    let pass='loading';
    let lastProgress=0;
    try{
      const prepared=await prepareOcrSource(file,onProgress,true);
      phase='reader';report(onProgress,'loading reader',0.1);
      const api=await load();
      phase='recognition';
      worker=await api.createWorker('spa',api.OEM?.LSTM_ONLY||1,{
        ...ENGINE_OPTIONS,
        logger:event=>{
          if(!event?.status)return;
          const value=Math.max(0,Math.min(1,Number(event.progress)||0));
          const mapped=pass==='loading'?.12+(value*.18):(pass==='document'?.64+(value*.33):.32+(value*.28));
          lastProgress=Math.max(lastProgress,mapped);
          report(onProgress,pass==='document'&&event.status==='recognizing text'?'recognizing contact fields':event.status,lastProgress);
        },
        errorHandler:error=>{engineError=String(error?.message||error||'').trim();}
      });
      pass='general';
      // AUTO separa los campos del formulario; SINGLE_BLOCK los mezcla en iPhone
      // y puede hacer desaparecer por completo la fila del DNI.
      await worker.setParameters({tessedit_pageseg_mode:api.PSM?.AUTO||'3'});
      const output={text:true,blocks:false,hocr:false,tsv:false};
      const result=await worker.recognize(prepared.input,{},output);
      const primary=extract(result?.data?.text||'');
      if(primary.dni){report(onProgress,'recognition complete',1);return primary;}

      // No se adivinan números desde el texto general. Solo se reintenta sobre
      // el recorte que contiene las etiquetas del formulario y se rellenan los
      // campos que la primera pasada dejó vacíos.
      try{
        pass='document';lastProgress=Math.max(lastProgress,.6);
        report(onProgress,'checking contact fields',lastProgress);
        await worker.setParameters({tessedit_pageseg_mode:prepared.formInput?(api.PSM?.SINGLE_COLUMN||'4'):(api.PSM?.SPARSE_TEXT||'11')});
        const formResult=prepared.formInput
          ?await worker.recognize(prepared.formInput,{},output)
          :await worker.recognize(prepared.input,{},output);
        const formText=String(formResult?.data?.text||'');
        let supplement=extract(formText);
        // Si Safari decodifica el JPEG pero devuelve una lectura totalmente
        // vacía, queda un último intento disperso sobre la imagen completa.
        if(prepared.formInput&&!supplement.dni&&!formText.trim()){
          await worker.setParameters({tessedit_pageseg_mode:api.PSM?.SPARSE_TEXT||'11'});
          const sparseResult=await worker.recognize(prepared.input,{},output);
          supplement=mergeResults(supplement,extract(sparseResult?.data?.text||''));
        }
        const merged=mergeResults(primary,supplement);
        report(onProgress,'recognition complete',1);
        return merged;
      }catch(supplementError){
        console.warn('[TPF OCR] document region',String(supplementError?.message||supplementError||'').trim());
        report(onProgress,'recognition complete',1);
        return primary;
      }
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
  if(document.documentElement)document.documentElement.dataset.ocrReady='tesseract-5.1.1-iphone-physical-crop';
})();
