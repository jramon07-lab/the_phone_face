(function(){
  'use strict';
  const SCRIPT='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
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
    });
    return loader;
  }

  function tidy(value){return String(value||'').replace(/[|]/g,'I').replace(/\s+/g,' ').trim();}
  function fold(value){return tidy(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();}
  function normalizePhone(value){
    const digits=String(value||'').replace(/\D/g,'');
    if(/^34[6789]\d{8}$/.test(digits))return digits.slice(2);
    return /^[6789]\d{8}$/.test(digits)?digits:'';
  }
  function validDni(candidate){
    const value=String(candidate||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(/^[XYZ]\d{7}[A-Z]$/.test(value))return value;
    if(/^\d{8}[A-Z]$/.test(value))return value;
    if(/^[A-Z]\d{7}[A-Z0-9]$/.test(value))return value;
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
    const api=await load();
    const result=await api.recognize(file,'spa',{logger:event=>{
      if(typeof onProgress==='function'&&event?.status){
        onProgress({status:event.status,progress:Number(event.progress||0)});
      }
    }});
    return extract(result?.data?.text||'');
  }

  window.TPFMobileOCR={recognize,extract};
})();
