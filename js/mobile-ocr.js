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
  function normalizePhone(value){
    const digits=String(value||'').replace(/\D/g,'');
    if(digits.length===11&&digits.startsWith('34'))return digits.slice(2);
    return digits.length>=9?digits.slice(-9):digits;
  }
  function validDni(candidate){
    const value=String(candidate||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(/^[XYZ]\d{7}[A-Z]$/.test(value))return value;
    if(/^\d{8}[A-Z]$/.test(value))return value;
    if(/^[A-Z]\d{7}[A-Z0-9]$/.test(value))return value;
    return '';
  }
  function nameFromLines(lines){
    const blocked=/DNI|NIF|DOCUMENT|CRITERIO|MISIDN|FIJO|MOVIL|TEL[EÉ]FONO|CLIENTE|BUSQUEDA|MULTIMARCA|FECHA|DIRECCI[OÓ]N|NACIMIENTO|NACIONALIDAD/i;
    const candidates=lines.map(tidy).filter(line=>{
      if(!line||blocked.test(line)||/\d{3,}/.test(line))return false;
      const words=line.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]/g,'').trim().split(/\s+/).filter(Boolean);
      return words.length>=2&&words.length<=6&&words.join('').length>=6;
    });
    const best=candidates.sort((a,b)=>{
      const au=(a.match(/[A-ZÁÉÍÓÚÜÑ]/g)||[]).length/Math.max(a.replace(/\s/g,'').length,1);
      const bu=(b.match(/[A-ZÁÉÍÓÚÜÑ]/g)||[]).length/Math.max(b.replace(/\s/g,'').length,1);
      return bu-au||b.length-a.length;
    })[0]||'';
    return best.toLowerCase().replace(/(^|[\s'-])([a-záéíóúüñ])/g,(m,p,c)=>p+c.toUpperCase());
  }
  function splitName(full){
    const words=tidy(full).split(' ').filter(Boolean);
    if(words.length<2)return {first:words[0]||'',last:''};
    return {first:words.shift(),last:words.join(' ')};
  }
  function extract(text){
    const raw=String(text||'');
    const compact=raw.toUpperCase().replace(/[\s.\-_/]/g,'');
    const dniMatches=compact.match(/(?:[XYZ]\d{7}[A-Z]|\d{8}[A-Z]|[ABCDEFGHJNPQRSUVW]\d{7}[A-Z0-9])/g)||[];
    const phoneMatches=raw.match(/(?:\+?34[\s.\-]*)?(?:[6789](?:[\s.\-]*\d){8})/g)||[];
    const fullName=nameFromLines(raw.split(/\r?\n/));
    return {dni:dniMatches.map(validDni).find(Boolean)||'',phone:normalizePhone(phoneMatches[0]||''),fullName,...splitName(fullName),rawText:raw};
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
